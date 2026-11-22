import Dexie, { type Table } from 'dexie';
import {
  buildStarterCatalog,
  buildStarterFinanceAccounts,
  buildStarterFinanceCategories,
  buildStarterLocations,
  buildStarterSupermarketSections,
} from '../data/starterCatalog';
import type {
  AppSettings,
  AttachmentRecord,
  CatalogItem,
  FinanceAccount,
  FinanceCategoryConfig,
  FinanceRecurringRule,
  FinanceTransaction,
  HouseholdMember,
  MealPlanEntry,
  Recipe,
  ShoppingItem,
  StockLot,
  StorageLocation,
  SupermarketSectionConfig,
} from '../types/domain';
import { createId } from '../utils/id';

export class FamilyDatabase extends Dexie {
  locations!: Table<StorageLocation, string>;
  supermarketSections!: Table<SupermarketSectionConfig, string>;
  catalogItems!: Table<CatalogItem, string>;
  stockLots!: Table<StockLot, string>;
  recipes!: Table<Recipe, string>;
  mealPlan!: Table<MealPlanEntry, string>;
  shoppingItems!: Table<ShoppingItem, string>;
  members!: Table<HouseholdMember, string>;
  attachments!: Table<AttachmentRecord, string>;
  financeAccounts!: Table<FinanceAccount, string>;
  financeCategories!: Table<FinanceCategoryConfig, string>;
  financeRecurring!: Table<FinanceRecurringRule, string>;
  financeTransactions!: Table<FinanceTransaction, string>;
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
    this.version(2).stores({
      locations: 'id, sortOrder, locationType, updatedAt, deletedAt',
      supermarketSections: 'id, sortOrder, updatedAt, deletedAt',
      catalogItems: 'id, name, category, defaultLocationId, supermarketSection, updatedAt, deletedAt',
      stockLots: 'id, catalogItemId, locationId, expiresAt, frozenOrCookedAt, updatedAt, deletedAt',
      recipes: 'id, title, category, updatedAt, deletedAt',
      mealPlan: 'id, date, slot, recipeId, updatedAt, deletedAt',
      shoppingItems: 'id, catalogItemId, section, checked, updatedAt, deletedAt',
      members: 'id, role, updatedAt, deletedAt',
      attachments: 'id, updatedAt, deletedAt, uploadedToDrive',
      settings: 'id',
    });
    this.version(3).stores({
      locations: 'id, sortOrder, locationType, updatedAt, deletedAt',
      supermarketSections: 'id, sortOrder, updatedAt, deletedAt',
      catalogItems: 'id, name, category, defaultLocationId, supermarketSection, updatedAt, deletedAt',
      stockLots: 'id, catalogItemId, locationId, expiresAt, frozenOrCookedAt, updatedAt, deletedAt',
      recipes: 'id, title, category, updatedAt, deletedAt',
      mealPlan: 'id, date, slot, recipeId, updatedAt, deletedAt',
      shoppingItems: 'id, catalogItemId, section, checked, updatedAt, deletedAt',
      members: 'id, role, updatedAt, deletedAt',
      attachments: 'id, updatedAt, deletedAt, uploadedToDrive',
      financeCategories: 'id, kind, sortOrder, updatedAt, deletedAt',
      financeRecurring: 'id, kind, categoryId, isActive, updatedAt, deletedAt',
      financeTransactions:
        'id, month, date, kind, categoryId, status, recurringRuleId, isWarranty, updatedAt, deletedAt',
      settings: 'id',
    });
    this.version(4).stores({
      locations: 'id, sortOrder, locationType, updatedAt, deletedAt',
      supermarketSections: 'id, sortOrder, updatedAt, deletedAt',
      catalogItems: 'id, name, category, defaultLocationId, supermarketSection, updatedAt, deletedAt',
      stockLots: 'id, catalogItemId, locationId, expiresAt, frozenOrCookedAt, updatedAt, deletedAt',
      recipes: 'id, title, category, updatedAt, deletedAt',
      mealPlan: 'id, date, slot, recipeId, updatedAt, deletedAt',
      shoppingItems: 'id, catalogItemId, section, checked, updatedAt, deletedAt',
      members: 'id, role, updatedAt, deletedAt',
      attachments: 'id, updatedAt, deletedAt, uploadedToDrive',
      financeAccounts: 'id, accountType, memberId, sortOrder, updatedAt, deletedAt',
      financeCategories: 'id, kind, sortOrder, updatedAt, deletedAt',
      financeRecurring: 'id, kind, categoryId, isActive, updatedAt, deletedAt',
      financeTransactions:
        'id, month, date, kind, categoryId, status, recurringRuleId, isWarranty, updatedAt, deletedAt',
      settings: 'id',
    });
  }
}

export const db = new FamilyDatabase();

export async function ensureDatabaseSeeded(database: FamilyDatabase = db): Promise<AppSettings> {
  const existingSettings = await database.settings.get('singleton');
  if (existingSettings?.initialized) {
    const [sectionCount, financeCatCount, financeAccCount] = await Promise.all([
      database.supermarketSections.count(),
      database.financeCategories.count(),
      database.financeAccounts.count(),
    ]);
    if (sectionCount === 0) {
      await database.supermarketSections.bulkPut(
        buildStarterSupermarketSections(existingSettings.deviceId),
      );
    }
    if (financeCatCount === 0) {
      await database.financeCategories.bulkPut(
        buildStarterFinanceCategories(existingSettings.deviceId),
      );
    }
    if (financeAccCount === 0) {
      await database.financeAccounts.bulkPut(
        buildStarterFinanceAccounts(existingSettings.deviceId),
      );
    }
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
    [
      database.settings,
      database.locations,
      database.supermarketSections,
      database.financeAccounts,
      database.financeCategories,
      database.catalogItems,
    ],
    async () => {
      await database.settings.put(initialSettings);

      const locCount = await database.locations.count();
      if (locCount === 0) {
        await database.locations.bulkPut(buildStarterLocations(deviceId));
      }

      const sectionCount = await database.supermarketSections.count();
      if (sectionCount === 0) {
        await database.supermarketSections.bulkPut(buildStarterSupermarketSections(deviceId));
      }

      const financeAccCount = await database.financeAccounts.count();
      if (financeAccCount === 0) {
        await database.financeAccounts.bulkPut(buildStarterFinanceAccounts(deviceId));
      }

      const financeCatCount = await database.financeCategories.count();
      if (financeCatCount === 0) {
        await database.financeCategories.bulkPut(buildStarterFinanceCategories(deviceId));
      }

      const catCount = await database.catalogItems.count();
      if (catCount === 0) {
        await database.catalogItems.bulkPut(buildStarterCatalog(deviceId));
      }
    },
  );

  return initialSettings;
}
