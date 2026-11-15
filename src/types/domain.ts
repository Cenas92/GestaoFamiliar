export type Unit = 'g' | 'kg' | 'ml' | 'L' | 'un' | 'tbsp' | 'tsp';

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

export type SupermarketSection =
  | 'produce'
  | 'meat_fish'
  | 'dairy'
  | 'pantry'
  | 'frozen'
  | 'bakery'
  | 'beverages'
  | 'cleaning'
  | 'hygiene_baby'
  | 'pets'
  | 'pharmacy'
  | 'other';

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
  defaultLocationId: string;
  minStockQty: number | null;
  supermarketSection: SupermarketSection;
}

export interface StockLot extends SyncMetadata {
  catalogItemId: string;
  productLabel: string;
  locationId: string;
  quantity: number | null;
  unit: Unit | null;
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
  section: SupermarketSection;
  checked: boolean;
  targetLocationId: string | null;
  source: 'manual' | 'low_stock' | 'recipe' | 'meal_plan';
  notes: string;
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

export type AppTab = 'today' | 'stock' | 'recipes' | 'planner' | 'shopping' | 'settings';
