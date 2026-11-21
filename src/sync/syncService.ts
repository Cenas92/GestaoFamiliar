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
  sanitizeGoogleClientId,
  uploadDriveFile,
} from './googleDriveSync';
import { type FamilySyncSnapshot, mergeFamilySnapshots } from './mergeEngine';

let suppressAutoSyncDepth = 0;

export function isAutoSyncSuppressed(): boolean {
  return suppressAutoSyncDepth > 0;
}

export async function withSuppressedAutoSync<T>(fn: () => Promise<T>): Promise<T> {
  suppressAutoSyncDepth += 1;
  try {
    return await fn();
  } finally {
    suppressAutoSyncDepth -= 1;
  }
}

export async function buildLocalSnapshot(): Promise<{
  snapshot: FamilySyncSnapshot;
  attachments: AttachmentRecord[];
  deviceId: string;
}> {
  const [
    settings,
    locations,
    supermarketSections,
    catalogItems,
    stockLots,
    recipes,
    mealPlan,
    shoppingItems,
    members,
    financeCategories,
    financeRecurring,
    financeTransactions,
    attachments,
  ] = await Promise.all([
    db.settings.get('singleton'),
    db.locations.toArray(),
    db.supermarketSections.toArray(),
    db.catalogItems.toArray(),
    db.stockLots.toArray(),
    db.recipes.toArray(),
    db.mealPlan.toArray(),
    db.shoppingItems.toArray(),
    db.members.toArray(),
    db.financeCategories.toArray(),
    db.financeRecurring.toArray(),
    db.financeTransactions.toArray(),
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
      supermarketSections,
      catalogItems,
      stockLots,
      recipes,
      mealPlan,
      shoppingItems,
      members,
      financeCategories,
      financeRecurring,
      financeTransactions,
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
  const supermarketSections = snapshot.supermarketSections ?? [];
  const financeCategories = snapshot.financeCategories ?? [];
  const financeRecurring = snapshot.financeRecurring ?? [];
  const financeTransactions = snapshot.financeTransactions ?? [];
  await withSuppressedAutoSync(async () => {
    await db.transaction(
      'rw',
      [
        db.locations,
        db.supermarketSections,
        db.catalogItems,
        db.stockLots,
        db.recipes,
        db.mealPlan,
        db.shoppingItems,
        db.members,
        db.financeCategories,
        db.financeRecurring,
        db.financeTransactions,
      ],
      async () => {
        if (snapshot.locations.length) await db.locations.bulkPut(snapshot.locations);
        if (supermarketSections.length) await db.supermarketSections.bulkPut(supermarketSections);
        if (snapshot.catalogItems.length) await db.catalogItems.bulkPut(snapshot.catalogItems);
        if (snapshot.stockLots.length) await db.stockLots.bulkPut(snapshot.stockLots);
        if (snapshot.recipes.length) await db.recipes.bulkPut(snapshot.recipes);
        if (snapshot.mealPlan.length) await db.mealPlan.bulkPut(snapshot.mealPlan);
        if (snapshot.shoppingItems.length) await db.shoppingItems.bulkPut(snapshot.shoppingItems);
        if (snapshot.members.length) await db.members.bulkPut(snapshot.members);
        if (financeCategories.length) await db.financeCategories.bulkPut(financeCategories);
        if (financeRecurring.length) await db.financeRecurring.bulkPut(financeRecurring);
        if (financeTransactions.length) await db.financeTransactions.bulkPut(financeTransactions);
      },
    );
  });
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
    await withSuppressedAutoSync(async () => {
      for (const att of parsed.attachmentsBase64!) {
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
    });
  }

  return {
    added: outcome.stats.addedFromRemote,
    updated: outcome.stats.updatedFromRemote,
  };
}

export interface SyncExecutionResult {
  addedFromRemote: number;
  updatedFromRemote: number;
  localChangesPushed: number;
  pushedToRemote: boolean;
  uploadedAttachments: number;
  downloadedAttachments: number;
}

export interface SyncConfigInput {
  googleClientId: string;
  googleDriveFolderId: string | null;
}

let activeSyncPromise: Promise<SyncExecutionResult> | null = null;

/**
 * Folds multiple remote snapshots (e.g. if a second family_state.json was created before sharing)
 * into a single merged remote snapshot using standard LWW merge rules.
 */
export function combineRemoteSnapshots(
  snapshots: FamilySyncSnapshot[],
  deviceId: string,
): FamilySyncSnapshot | null {
  if (snapshots.length === 0) return null;
  let combined = snapshots[0];
  for (let i = 1; i < snapshots.length; i += 1) {
    combined = mergeFamilySnapshots(combined, snapshots[i], [], deviceId).mergedSnapshot;
  }
  return combined;
}

/**
 * Runs a full bidirectional Google Drive sync.
 * Pass explicit config from React state when triggered from a click handler so OAuth popup
 * stays synchronous with the user gesture (critical for mobile browsers).
 */
export function runGoogleDriveSync(
  interactive = true,
  configOverride?: SyncConfigInput,
): Promise<SyncExecutionResult> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = executeGoogleDriveSync(interactive, configOverride).finally(() => {
    activeSyncPromise = null;
  });

  return activeSyncPromise;
}

async function executeGoogleDriveSync(
  interactive: boolean,
  configOverride?: SyncConfigInput,
): Promise<SyncExecutionResult> {
  if (!navigator.onLine) {
    throw new Error('Sem ligação à internet. A app continua a funcionar offline normalmente.');
  }

  let clientId = sanitizeGoogleClientId(configOverride?.googleClientId ?? '');
  let folderId = configOverride?.googleDriveFolderId ?? null;

  if (!clientId || !folderId) {
    const settings = await db.settings.get('singleton');
    if (!settings) {
      throw new Error('Base de dados não inicializada.');
    }
    clientId = sanitizeGoogleClientId(settings.googleClientId);
    folderId = settings.googleDriveFolderId;
  }

  if (!clientId) {
    throw new Error('Falta configurar o Google OAuth Client ID nas Definições.');
  }
  if (!folderId) {
    throw new Error('Seleciona ou cria primeiro a pasta partilhada nas Definições.');
  }

  // IMPORTANT: Obtain OAuth token BEFORE awaiting any IndexedDB writes so mobile browsers
  // preserve user-gesture activation for the Google sign-in popup.
  const token = await ensureGoogleAccessToken(clientId, interactive);

  await db.settings.update('singleton', {
    lastSyncStatus: 'syncing',
    lastSyncError: null,
  });

  try {
    const [rootFiles, attachmentsFolderId, backupsFolderId] = await Promise.all([
      listDriveChildren(token, folderId),
      ensureSubfolder(token, folderId, ATTACHMENTS_FOLDER_NAME),
      ensureSubfolder(token, folderId, BACKUPS_FOLDER_NAME),
    ]);

    const stateFiles = rootFiles.filter((f) => f.name === STATE_FILE_NAME);
    const primaryStateFile =
      stateFiles.find((f) => f.capabilities?.canEdit !== false) ?? stateFiles[0];
    const { snapshot: localSnapshot, attachments: localAttachments, deviceId } =
      await buildLocalSnapshot();

    const parsedRemotes: FamilySyncSnapshot[] = [];
    for (const sf of stateFiles) {
      const remoteText = await downloadDriveFileText(token, sf.id);
      if (remoteText.trim()) {
        try {
          const parsed = JSON.parse(remoteText) as FamilySyncSnapshot;
          if (parsed.schemaVersion === 1) {
            parsedRemotes.push(parsed);
          }
        } catch {
          // Ignore malformed duplicate file
        }
      }
    }
    const remoteSnapshot = combineRemoteSnapshots(parsedRemotes, deviceId);

    let finalSnapshot = localSnapshot;
    let addedFromRemote = 0;
    let updatedFromRemote = 0;
    let localChangesPushed = 0;
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
      localChangesPushed = outcome.stats.localChangesToPush;
      missingAttachmentIds = outcome.missingLocalAttachmentIds;
      pendingUploadIds = outcome.pendingUploadAttachmentIds;

      if (localChangesPushed > 0 || addedFromRemote > 0 || updatedFromRemote > 0) {
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

        const sortedBackups = [...existingBackups].sort((a, b) => b.name.localeCompare(a.name));
        for (const old of sortedBackups.slice(7)) {
          await deleteDriveFile(token, old.id).catch(() => {});
        }
      }
    } else {
      localChangesPushed =
        (localSnapshot.supermarketSections?.length ?? 0) +
        localSnapshot.stockLots.length +
        localSnapshot.recipes.length +
        localSnapshot.mealPlan.length +
        localSnapshot.shoppingItems.length +
        localSnapshot.members.length;
    }

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
      await withSuppressedAutoSync(() =>
        db.attachments.update(rec.id, { driveFileId, uploadedToDrive: true }),
      );
      const entry = manifestMap.get(rec.id);
      if (entry) {
        entry.driveFileId = driveFileId;
      }
      uploadedAttachments += 1;
    }

    let downloadedAttachments = 0;
    for (const attId of missingAttachmentIds) {
      const entry = manifestMap.get(attId);
      if (!entry?.driveFileId || entry.deletedAt) continue;
      const blob = await downloadDriveFileBlob(token, entry.driveFileId);
      await withSuppressedAutoSync(() =>
        db.attachments.put({
          id: entry.id,
          fileName: entry.fileName,
          mimeType: entry.mimeType,
          sizeBytes: blob.size,
          blob,
          driveFileId: entry.driveFileId,
          uploadedToDrive: true,
          updatedAt: entry.updatedAt,
          deletedAt: null,
        }),
      );
      downloadedAttachments += 1;
    }

    finalSnapshot.attachmentManifest = Array.from(manifestMap.values());
    await applySnapshotToLocalDb(finalSnapshot);

    await uploadDriveFile(token, {
      folderId,
      fileName: STATE_FILE_NAME,
      mimeType: 'application/json',
      content: JSON.stringify(finalSnapshot),
      existingFileId: primaryStateFile?.id ?? null,
    });

    // Best-effort cleanup of any duplicate family_state.json files after merging them
    for (const dup of stateFiles) {
      if (primaryStateFile && dup.id !== primaryStateFile.id) {
        await deleteDriveFile(token, dup.id).catch(() => {});
      }
    }

    await db.settings.update('singleton', {
      lastSyncAt: nowIso(),
      lastSyncStatus: 'ok',
      lastSyncError: null,
    });

    return {
      addedFromRemote,
      updatedFromRemote,
      localChangesPushed,
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
