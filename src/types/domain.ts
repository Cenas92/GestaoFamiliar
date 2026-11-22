export type Unit = 'g' | 'kg' | 'ml' | 'L' | 'un' | 'tbsp' | 'tsp';

export type PackageUnit = 'g' | 'kg' | 'ml' | 'L';

export type QualitativeLevel = 'full' | 'low' | 'empty';

export type TrackingMode = 'exact' | 'qualitative';

export type LocationType =
  | 'fridge'
  | 'freezer'
  | 'pantry'
  | 'household'
  | 'pharmacy'
  | 'pets'
  | 'other';

export type LocationColorToken =
  | 'cyan'
  | 'blue'
  | 'amber'
  | 'emerald'
  | 'rose'
  | 'violet'
  | 'slate';

export type CatalogCategory =
  | 'food'
  | 'beverages'
  | 'cleaning'
  | 'hygiene_baby'
  | 'pets'
  | 'pharmacy';

export type SupermarketSection = string;

export type SectionColorToken =
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'sky'
  | 'orange'
  | 'cyan'
  | 'blue'
  | 'teal'
  | 'pink'
  | 'yellow'
  | 'red'
  | 'violet'
  | 'slate';

export type SectionIconKey =
  | 'apple'
  | 'croissant'
  | 'beef'
  | 'fish'
  | 'milk'
  | 'wheat'
  | 'carrot'
  | 'cookie'
  | 'snowflake'
  | 'cup_soda'
  | 'coffee'
  | 'spray_can'
  | 'sparkles'
  | 'baby'
  | 'paw_print'
  | 'pill'
  | 'shopping_basket'
  | 'package';

export interface SupermarketSectionConfig extends SyncMetadata {
  name: string;
  colorToken: SectionColorToken | string;
  icon: SectionIconKey | string;
  sortOrder: number;
}

export type RecipeCategory =
  | 'meat'
  | 'fish'
  | 'vegetarian'
  | 'soup'
  | 'pasta_rice'
  | 'breakfast_snack'
  | 'dessert'
  | 'sauce_base'
  | 'other';

export type MealSlot = 'lunch' | 'dinner' | 'snack';

export type HouseholdRole = 'adult' | 'child' | 'pet';

export interface SyncMetadata {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  lastModifiedBy: string;
}

export interface HouseholdMember extends SyncMetadata {
  name: string;
  role: HouseholdRole;
  dietaryNotes: string;
  allergies: string[];
  defaultServingsWeight: number;
  avatarColor: string;
}

export interface StorageLocation extends SyncMetadata {
  name: string;
  locationType: LocationType;
  colorToken: LocationColorToken;
  icon: string;
  sortOrder: number;
}

export interface CatalogItem extends SyncMetadata {
  name: string;
  aliases: string[];
  category: CatalogCategory;
  trackingMode: TrackingMode;
  defaultUnit: Unit;
  defaultPackageSize?: number | null;
  defaultPackageUnit?: PackageUnit | null;
  defaultLocationId: string;
  minStockQty: number | null;
  survivalTargetQty?: number | null;
  supermarketSection: SupermarketSection;
}

export interface StockLot extends SyncMetadata {
  catalogItemId: string;
  productLabel: string;
  locationId: string;
  quantity: number | null;
  unit: Unit | null;
  packageSize?: number | null;
  packageUnit?: PackageUnit | null;
  qualitativeLevel: QualitativeLevel | null;
  expiresAt: string | null;
  frozenOrCookedAt: string | null;
  isLeftover: boolean;
  sourceRecipeId: string | null;
  notes: string;
}

export interface RecipeIngredient {
  id: string;
  catalogItemId: string;
  customLabel: string;
  quantity: number | null;
  unit: Unit | null;
  toTaste: boolean;
  isOptional: boolean;
  substituteCatalogIds: string[];
}

export interface RecipeStep {
  id: string;
  order: number;
  instruction: string;
  robotTime: string;
  robotTemp: string;
  robotSpeed: string;
}

export interface Recipe extends SyncMetadata {
  title: string;
  prepMinutes: number;
  cookMinutes: number;
  baseServings: number;
  category: RecipeCategory;
  tags: string[];
  containsAllergens: string[];
  favoriteMemberIds: string[];
  kidFriendly: boolean;
  notes: string;
  photoAttachmentId: string | null;
  docAttachmentId: string | null;
  timesCooked: number;
  lastCookedAt: string | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

export interface MealPlanEntry extends SyncMetadata {
  date: string; // YYYY-MM-DD
  slot: MealSlot;
  recipeId: string | null;
  plannedServings: number;
  customLabel: string;
  completed: boolean;
}

export interface ShoppingItem extends SyncMetadata {
  catalogItemId: string | null;
  label: string;
  quantity: number | null;
  unit: Unit | null;
  packageSize?: number | null;
  packageUnit?: PackageUnit | null;
  section: SupermarketSection;
  checked: boolean;
  targetLocationId: string | null;
  source: 'manual' | 'low_stock' | 'recipe' | 'meal_plan';
  notes: string;
  photoAttachmentId?: string | null;
}

export interface AttachmentRecord {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  blob: Blob;
  driveFileId: string | null;
  uploadedToDrive: boolean;
  updatedAt: string;
  deletedAt: string | null;
}

export interface AppSettings {
  id: 'singleton';
  expiryWarningDays: number;
  deviceId: string;
  googleClientId: string;
  googleDriveFolderId: string | null;
  googleDriveFolderName: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: 'idle' | 'syncing' | 'ok' | 'error';
  lastSyncError: string | null;
  initialized: boolean;
}

export type FinanceKind = 'income' | 'fixed' | 'variable';

export type FinanceRecurringFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export type FinanceTransactionStatus = 'planned' | 'paid';

export type FinanceCategoryIconKey =
  | 'wallet'
  | 'briefcase'
  | 'home'
  | 'zap'
  | 'droplets'
  | 'wifi'
  | 'shield'
  | 'car'
  | 'shopping_cart'
  | 'utensils'
  | 'heart_pulse'
  | 'graduation_cap'
  | 'baby'
  | 'paw_print'
  | 'plane'
  | 'gift'
  | 'piggy_bank'
  | 'tv'
  | 'wrench'
  | 'credit_card'
  | 'receipt'
  | 'tag';

export interface FinanceCategoryConfig extends SyncMetadata {
  name: string;
  kind: FinanceKind;
  colorToken: SectionColorToken | string;
  icon: FinanceCategoryIconKey | string;
  sortOrder: number;
  monthlyBudget: number | null;
}

export interface FinanceRecurringRule extends SyncMetadata {
  title: string;
  kind: 'income' | 'fixed';
  categoryId: string;
  amount: number;
  frequency: FinanceRecurringFrequency;
  dayOfMonth: number;
  startMonth: string; // YYYY-MM
  isActive: boolean;
  memberId: string | null;
  notes: string;
}

export interface FinanceTransaction extends SyncMetadata {
  title: string;
  kind: FinanceKind;
  categoryId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  status: FinanceTransactionStatus;
  recurringRuleId: string | null;
  memberId: string | null;
  notes: string;
  photoAttachmentId: string | null;
  isWarranty: boolean;
  warrantyExpiresAt: string | null; // YYYY-MM-DD
  warrantyStore: string;
  excludeFromTotals: boolean;
}

export type AppTab =
  | 'today'
  | 'stock'
  | 'meals'
  | 'recipes'
  | 'planner'
  | 'shopping'
  | 'finances'
  | 'settings';
