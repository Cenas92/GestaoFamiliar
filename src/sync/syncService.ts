import { db } from '../db/database';
import type { AttachmentRecord } from '../types/domain';
import { nowIso } from '../utils/id';
import {
  ATTACHMENTS_FOLDER_NAME,
  BACKUPS_FOLDER_NAME,
  STATE_FILE_NAME,
  deleteDriveFile,
  downloadDriveFileBlob,
  downloadDriveFileText,
  ensureGoogleAccessToken,
  ensureSubfolder,
  listDriveChildren,
  uploadDriveFile,
} from './googleDriveSync';
import {
  type FamilySyncSnapshot,
  mergeFamilySnapshots,
} from './mergeEngine';

export async function buildLocalSnapshot(): Promise<{
  snapshot: FamilySyncSnapshot;
  attachments: AttachmentRecord[];
  deviceId: string;
}> {
  const [
    settings,
    locations,
    catalogItems,
    stockLots,
    recipes,
    mealPlan,
    shoppingItems,
    members,
    attachments,
  ] = await Promise.all([
    db.settings.get('singleton'),
    db.locations.toArray(),
    db.catalogItems.toArray(),
    db.stockLots.toArray(),
    db.recipes.toArray(),
    db.mealPlan.toArray(),
    db.shoppingItems.toArray(),
    db.members.toArray(),
    db.attachments.toArray(),
  ]);

  const deviceId = settings?.deviceId ?? 'unknown-device';

  return {
    deviceId,
    attachments,
    snapshot: {
      schemaVersion: 1,
      exportedAt: nowIso(),
      exportedByDevice: deviceId,
      locations,
      catalogItems,
      stockLots,
      recipes,
      mealPlan,
      shoppingItems,
      members,
      attachmentManifest: attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        driveFileId: a.driveFileId,
        updatedAt: a.updatedAt,
        deletedAt: a.deletedAt,
      })),
    },
  };
}

export async function applySnapshotToLocalDb(snapshot: FamilySyncSnapshot): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.locations,
      db.catalogItems,
      db.stockLots,
      db.recipes,
      db.mealPlan,
      db.shoppingItems,
      db.members,
    ],
    async () => {
      if (snapshot.locations.length) await db.locations.bulkPut(snapshot.locations);
      if (snapshot.catalogItems.length) await db.catalogItems.bulkPut(snapshot.catalogItems);
      if (snapshot.stockLots.length) await db.stockLots.bulkPut(snapshot.stockLots);
      if (snapshot.recipes.length) await db.recipes.bulkPut(snapshot.recipes);
      if (snapshot.mealPlan.length) await db.mealPlan.bulkPut(snapshot.mealPlan);
      if (snapshot.shoppingItems.length) await db.shoppingItems.bulkPut(snapshot.shoppingItems);
      if (snapshot.members.length) await db.members.bulkPut(snapshot.members);
    },
  );
}

export interface ManualBackupPayload {
  snapshot: FamilySyncSnapshot;
  attachmentsBase64?: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    dataUrl: string;
    updatedAt: string;
  }>;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const resp = await fetch(dataUrl);
  return resp.blob();
}

export async function exportManualBackupJson(): Promise<string> {
  const { snapshot, attachments } = await buildLocalSnapshot();
  const activeAttachments = attachments.filter((a) => !a.deletedAt);
  const attachmentsBase64 = await Promise.all(
    activeAttachments.map(async (att) => ({
      id: att.id,
      fileName: att.fileName,
      mimeType: att.mimeType,
      dataUrl: await blobToDataUrl(att.blob),
      updatedAt: att.updatedAt,
    })),
  );
  const payload: ManualBackupPayload = { snapshot, attachmentsBase64 };
  return JSON.stringify(payload, null, 2);
}

export async function importManualBackupJson(
  rawJson: string,
): Promise<{ added: number; updated: number }> {
  const parsed = JSON.parse(rawJson) as ManualBackupPayload | FamilySyncSnapshot;
  const remoteSnapshot = 'snapshot' in parsed ? parsed.snapshot : parsed;
  if (!remoteSnapshot || remoteSnapshot.schemaVersion !== 1) {
    throw new Error('Ficheiro de backup inválido ou incompatível.');
  }

  const { snapshot: localSnapshot, attachments, deviceId } = await buildLocalSnapshot();
  const outcome = mergeFamilySnapshots(localSnapshot, remoteSnapshot, attachments, deviceId);
  await applySnapshotToLocalDb(outcome.mergedSnapshot);

  if ('attachmentsBase64' in parsed && Array.isArray(parsed.attachmentsBase64)) {
    for (const att of parsed.attachmentsBase64) {
      const existing = await db.attachments.get(att.id);
      if (!existing || att.updatedAt > existing.updatedAt) {
        const blob = await dataUrlToBlob(att.dataUrl);
        await db.attachments.put({
          id: att.id,
          fileName: att.fileName,
          mimeType: att.mimeType,
          sizeBytes: blob.size,
          blob,
          driveFileId: existing?.driveFileId ?? null,
          uploadedToDrive: existing?.uploadedToDrive ?? false,
          updatedAt: att.updatedAt,
          deletedAt: null,
        });
      }
    }
  }

  return {
    added: outcome.stats.addedFromRemote,
    updated: outcome.stats.updatedFromRemote,
  };
}

export interface SyncExecutionResult {
  addedFromRemote: number;
  updatedFromRemote: number;
  pushedToRemote: boolean;
  uploadedAttachments: number;
  downloadedAttachments: number;
}

export async function runGoogleDriveSync(interactive = true): Promise<SyncExecutionResult> {
  const settings = await db.settings.get('singleton');
  if (!settings) {
    throw new Error('Base de dados não inicializada.');
  }
  if (!settings.googleClientId.trim()) {
    throw new Error('Falta configurar o Google OAuth Client ID nas Definições.');
  }
  if (!settings.googleDriveFolderId) {
    throw new Error('Seleciona ou cria primeiro a pasta partilhada nas Definições.');
  }
  if (!navigator.onLine) {
    throw new Error('Sem ligação à internet. A app continua a funcionar offline normalmente.');
  }

  await db.settings.update('singleton', {
    lastSyncStatus: 'syncing',
    lastSyncError: null,
  });

  try {
    const token = await ensureGoogleAccessToken(settings.googleClientId, interactive);
    const rootFolderId = settings.googleDriveFolderId;

    const [rootFiles, attachmentsFolderId, backupsFolderId] = await Promise.all([
      listDriveChildren(token, rootFolderId),
      ensureSubfolder(token, rootFolderId, ATTACHMENTS_FOLDER_NAME),
      ensureSubfolder(token, rootFolderId, BACKUPS_FOLDER_NAME),
    ]);

    const stateFile = rootFiles.find((f) => f.name === STATE_FILE_NAME);
    const { snapshot: localSnapshot, attachments: localAttachments, deviceId } =
      await buildLocalSnapshot();

    let remoteSnapshot: FamilySyncSnapshot | null = null;
    if (stateFile) {
      const remoteText = await downloadDriveFileText(token, stateFile.id);
      if (remoteText.trim()) {
        const parsed = JSON.parse(remoteText) as FamilySyncSnapshot;
        if (parsed.schemaVersion === 1) {
          remoteSnapshot = parsed;
        }
      }
    }

    let finalSnapshot = localSnapshot;
    let addedFromRemote = 0;
    let updatedFromRemote = 0;
    let missingAttachmentIds: string[] = [];
    let pendingUploadIds: string[] = localAttachments
      .filter((a) => !a.deletedAt && !a.driveFileId)
      .map((a) => a.id);

    if (remoteSnapshot) {
      const outcome = mergeFamilySnapshots(
        localSnapshot,
        remoteSnapshot,
        localAttachments,
        deviceId,
      );
      finalSnapshot = outcome.mergedSnapshot;
      addedFromRemote = outcome.stats.addedFromRemote;
      updatedFromRemote = outcome.stats.updatedFromRemote;
      missingAttachmentIds = outcome.missingLocalAttachmentIds;
      pendingUploadIds = outcome.pendingUploadAttachmentIds;

      // Save rotating backup snapshot before pushing remote changes if there were meaningful edits
      if (outcome.stats.localChangesToPush > 0 || addedFromRemote > 0 || updatedFromRemote > 0) {
        const backupStamp = new Date().toISOString().slice(0, 10);
        const existingBackups = await listDriveChildren(token, backupsFolderId);
        const todayBackupName = `backup-${backupStamp}.json`;
        const existingToday = existingBackups.find((b) => b.name === todayBackupName);
        await uploadDriveFile(token, {
          folderId: backupsFolderId,
          fileName: todayBackupName,
          mimeType: 'application/json',
          content: JSON.stringify(remoteSnapshot),
          existingFileId: existingToday?.id ?? null,
        });

        // Prune older backups keeping most recent 7
        const sortedBackups = [...existingBackups].sort((a, b) => b.name.localeCompare(a.name));
        for (const old of sortedBackups.slice(7)) {
          await deleteDriveFile(token, old.id).catch(() => {});
        }
      }
    }

    // Upload pending attachments so manifest gets their driveFileIds
    let uploadedAttachments = 0;
    const manifestMap = new Map(finalSnapshot.attachmentManifest.map((m) => [m.id, m]));

    for (const attId of pendingUploadIds) {
      const rec = await db.attachments.get(attId);
      if (!rec || rec.deletedAt) continue;
      const driveFileId = await uploadDriveFile(token, {
        folderId: attachmentsFolderId,
        fileName: `${rec.id}-${rec.fileName}`,
        mimeType: rec.mimeType,
        content: rec.blob,
        existingFileId: rec.driveFileId,
      });
      await db.attachments.update(rec.id, { driveFileId, uploadedToDrive: true });
      const entry = manifestMap.get(rec.id);
      if (entry) {
        entry.driveFileId = driveFileId;
      }
      uploadedAttachments += 1;
    }

    // Download missing attachments referenced by remote recipes
    let downloadedAttachments = 0;
    for (const attId of missingAttachmentIds) {
      const entry = manifestMap.get(attId);
      if (!entry?.driveFileId || entry.deletedAt) continue;
      const blob = await downloadDriveFileBlob(token, entry.driveFileId);
      await db.attachments.put({
        id: entry.id,
        fileName: entry.fileName,
        mimeType: entry.mimeType,
        sizeBytes: blob.size,
        blob,
        driveFileId: entry.driveFileId,
        uploadedToDrive: true,
        updatedAt: entry.updatedAt,
        deletedAt: null,
      });
      downloadedAttachments += 1;
    }

    finalSnapshot.attachmentManifest = Array.from(manifestMap.values());
    await applySnapshotToLocalDb(finalSnapshot);

    // Push merged state back to Google Drive
    await uploadDriveFile(token, {
      folderId: rootFolderId,
      fileName: STATE_FILE_NAME,
      mimeType: 'application/json',
      content: JSON.stringify(finalSnapshot),
      existingFileId: stateFile?.id ?? null,
    });

    await db.settings.update('singleton', {
      lastSyncAt: nowIso(),
      lastSyncStatus: 'ok',
      lastSyncError: null,
    });

    return {
      addedFromRemote,
      updatedFromRemote,
      pushedToRemote: true,
      uploadedAttachments,
      downloadedAttachments,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao sincronizar.';
    await db.settings.update('singleton', {
      lastSyncStatus: 'error',
      lastSyncError: message,
    });
    throw err;
  }
}
