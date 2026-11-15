import type {
  AttachmentRecord,
  CatalogItem,
  HouseholdMember,
  MealPlanEntry,
  Recipe,
  ShoppingItem,
  StockLot,
  StorageLocation,
  SyncMetadata,
} from '../types/domain';
import { nowIso } from '../utils/id';

export interface AttachmentManifestEntry {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  driveFileId: string | null;
  updatedAt: string;
  deletedAt: string | null;
}

export interface FamilySyncSnapshot {
  schemaVersion: 1;
  exportedAt: string;
  exportedByDevice: string;
  locations: StorageLocation[];
  catalogItems: CatalogItem[];
  stockLots: StockLot[];
  recipes: Recipe[];
  mealPlan: MealPlanEntry[];
  shoppingItems: ShoppingItem[];
  members: HouseholdMember[];
  attachmentManifest: AttachmentManifestEntry[];
}

export interface MergeCollectionResult<T> {
  merged: T[];
  addedFromRemote: number;
  updatedFromRemote: number;
  newerOnLocal: number;
}

function compareRecordsLww<T extends Pick<SyncMetadata, 'id' | 'updatedAt' | 'lastModifiedBy'>>(
  local: T,
  remote: T,
): 'local' | 'remote' | 'equal' {
  if (local.updatedAt === remote.updatedAt) {
    if (local.lastModifiedBy === remote.lastModifiedBy) return 'equal';
    return remote.lastModifiedBy > local.lastModifiedBy ? 'remote' : 'local';
  }
  return remote.updatedAt > local.updatedAt ? 'remote' : 'local';
}

export function mergeSyncCollections<T extends SyncMetadata>(
  localList: T[],
  remoteList: T[],
): MergeCollectionResult<T> {
  const map = new Map<string, T>();
  let addedFromRemote = 0;
  let updatedFromRemote = 0;
  let newerOnLocal = 0;

  for (const item of localList) {
    map.set(item.id, item);
  }

  for (const remoteItem of remoteList) {
    const localItem = map.get(remoteItem.id);
    if (!localItem) {
      map.set(remoteItem.id, remoteItem);
      addedFromRemote += 1;
      continue;
    }

    const winner = compareRecordsLww(localItem, remoteItem);
    if (winner === 'remote') {
      map.set(remoteItem.id, remoteItem);
      updatedFromRemote += 1;
    } else if (winner === 'local') {
      newerOnLocal += 1;
    }
  }

  // Count items that exist ONLY on local as newerOnLocal (need upload)
  const remoteIds = new Set(remoteList.map((r) => r.id));
  for (const localItem of localList) {
    if (!remoteIds.has(localItem.id)) {
      newerOnLocal += 1;
    }
  }

  return {
    merged: Array.from(map.values()),
    addedFromRemote,
    updatedFromRemote,
    newerOnLocal,
  };
}

export function mergeAttachmentManifest(
  localRecords: AttachmentRecord[],
  remoteManifest: AttachmentManifestEntry[],
): {
  mergedManifest: AttachmentManifestEntry[];
  missingLocalIds: string[];
  pendingUploadIds: string[];
} {
  const localMap = new Map(localRecords.map((a) => [a.id, a]));
  const mergedMap = new Map<string, AttachmentManifestEntry>();

  for (const rec of localRecords) {
    mergedMap.set(rec.id, {
      id: rec.id,
      fileName: rec.fileName,
      mimeType: rec.mimeType,
      sizeBytes: rec.sizeBytes,
      driveFileId: rec.driveFileId,
      updatedAt: rec.updatedAt,
      deletedAt: rec.deletedAt,
    });
  }

  const missingLocalIds: string[] = [];

  for (const remoteEntry of remoteManifest) {
    const localEntry = mergedMap.get(remoteEntry.id);
    if (!localEntry) {
      mergedMap.set(remoteEntry.id, remoteEntry);
      if (!remoteEntry.deletedAt && remoteEntry.driveFileId) {
        missingLocalIds.push(remoteEntry.id);
      }
      continue;
    }

    if (remoteEntry.updatedAt > localEntry.updatedAt) {
      mergedMap.set(remoteEntry.id, {
        ...remoteEntry,
        driveFileId: remoteEntry.driveFileId ?? localEntry.driveFileId,
      });
    } else if (!localEntry.driveFileId && remoteEntry.driveFileId) {
      mergedMap.set(remoteEntry.id, {
        ...localEntry,
        driveFileId: remoteEntry.driveFileId,
      });
    }
  }

  const pendingUploadIds: string[] = [];
  for (const entry of mergedMap.values()) {
    const localRec = localMap.get(entry.id);
    if (localRec && !localRec.deletedAt && !entry.driveFileId) {
      pendingUploadIds.push(entry.id);
    }
  }

  return {
    mergedManifest: Array.from(mergedMap.values()),
    missingLocalIds,
    pendingUploadIds,
  };
}

export interface FullMergeOutcome {
  mergedSnapshot: FamilySyncSnapshot;
  stats: {
    addedFromRemote: number;
    updatedFromRemote: number;
    localChangesToPush: number;
  };
  missingLocalAttachmentIds: string[];
  pendingUploadAttachmentIds: string[];
}

export function mergeFamilySnapshots(
  local: FamilySyncSnapshot,
  remote: FamilySyncSnapshot,
  localAttachments: AttachmentRecord[],
  deviceId: string,
): FullMergeOutcome {
  const locations = mergeSyncCollections(local.locations, remote.locations);
  const catalogItems = mergeSyncCollections(local.catalogItems, remote.catalogItems);
  const stockLots = mergeSyncCollections(local.stockLots, remote.stockLots);
  const recipes = mergeSyncCollections(local.recipes, remote.recipes);
  const mealPlan = mergeSyncCollections(local.mealPlan, remote.mealPlan);
  const shoppingItems = mergeSyncCollections(local.shoppingItems, remote.shoppingItems);
  const members = mergeSyncCollections(local.members, remote.members);

  const attachmentMerge = mergeAttachmentManifest(localAttachments, remote.attachmentManifest);

  const collections = [
    locations,
    catalogItems,
    stockLots,
    recipes,
    mealPlan,
    shoppingItems,
    members,
  ];

  const addedFromRemote = collections.reduce((acc, c) => acc + c.addedFromRemote, 0);
  const updatedFromRemote = collections.reduce((acc, c) => acc + c.updatedFromRemote, 0);
  const localChangesToPush = collections.reduce((acc, c) => acc + c.newerOnLocal, 0);

  return {
    mergedSnapshot: {
      schemaVersion: 1,
      exportedAt: nowIso(),
      exportedByDevice: deviceId,
      locations: locations.merged,
      catalogItems: catalogItems.merged,
      stockLots: stockLots.merged,
      recipes: recipes.merged,
      mealPlan: mealPlan.merged,
      shoppingItems: shoppingItems.merged,
      members: members.merged,
      attachmentManifest: attachmentMerge.mergedManifest,
    },
    stats: {
      addedFromRemote,
      updatedFromRemote,
      localChangesToPush,
    },
    missingLocalAttachmentIds: attachmentMerge.missingLocalIds,
    pendingUploadAttachmentIds: attachmentMerge.pendingUploadIds,
  };
}
