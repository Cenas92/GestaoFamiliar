import Dexie, { type Table } from 'dexie';
import { buildStarterCatalog, buildStarterLocations } from '../data/starterCatalog';
import type {
  AppSettings,
  AttachmentRecord,
  CatalogItem,
  HouseholdMember,
  MealPlanEntry,
  Recipe,
  ShoppingItem,
  StockLot,
  StorageLocation,
} from '../types/domain';
import { createId } from '../utils/id';

export class FamilyDatabase extends Dexie {
  locations!: Table<StorageLocation, string>;
  catalogItems!: Table<CatalogItem, string>;
  stockLots!: Table<StockLot, string>;
  recipes!: Table<Recipe, string>;
  mealPlan!: Table<MealPlanEntry, string>;
  shoppingItems!: Table<ShoppingItem, string>;
  members!: Table<HouseholdMember, string>;
  attachments!: Table<AttachmentRecord, string>;
  settings!: Table<AppSettings, string>;

  constructor(name = 'GestaoFamiliarDB') {
    super(name);
    this.version(1).stores({
      locations: 'id, sortOrder, locationType, updatedAt, deletedAt',
      catalogItems: 'id, name, category, defaultLocationId, supermarketSection, updatedAt, deletedAt',
      stockLots: 'id, catalogItemId, locationId, expiresAt, frozenOrCookedAt, updatedAt, deletedAt',
      recipes: 'id, title, category, updatedAt, deletedAt',
      mealPlan: 'id, date, slot, recipeId, updatedAt, deletedAt',
      shoppingItems: 'id, catalogItemId, section, checked, updatedAt, deletedAt',
      members: 'id, role, updatedAt, deletedAt',
      attachments: 'id, updatedAt, deletedAt, uploadedToDrive',
      settings: 'id',
    });
  }
}

export const db = new FamilyDatabase();

export async function ensureDatabaseSeeded(database: FamilyDatabase = db): Promise<AppSettings> {
  const existingSettings = await database.settings.get('singleton');
  if (existingSettings?.initialized) {
    return existingSettings;
  }

  const deviceId = existingSettings?.deviceId ?? `dev-${createId().slice(0, 8)}`;
  const initialSettings: AppSettings = {
    id: 'singleton',
    expiryWarningDays: existingSettings?.expiryWarningDays ?? 5,
    deviceId,
    googleClientId: existingSettings?.googleClientId ?? '',
    googleDriveFolderId: existingSettings?.googleDriveFolderId ?? null,
    googleDriveFolderName: existingSettings?.googleDriveFolderName ?? null,
    lastSyncAt: existingSettings?.lastSyncAt ?? null,
    lastSyncStatus: 'idle',
    lastSyncError: null,
    initialized: true,
  };

  await database.transaction(
    'rw',
    [database.settings, database.locations, database.catalogItems],
    async () => {
      await database.settings.put(initialSettings);

      const locCount = await database.locations.count();
      if (locCount === 0) {
        await database.locations.bulkPut(buildStarterLocations(deviceId));
      }

      const catCount = await database.catalogItems.count();
      if (catCount === 0) {
        await database.catalogItems.bulkPut(buildStarterCatalog(deviceId));
      }
    },
  );

  return initialSettings;
}
