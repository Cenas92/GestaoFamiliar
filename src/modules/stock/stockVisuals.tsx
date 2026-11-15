import { UtensilsCrossed } from 'lucide-react';
import { TypeIconBadge, type TypeVisualMeta } from '../../components/TypeIconBadge';
import type {
  CatalogCategory,
  CatalogItem,
  StockLot,
  StorageLocation,
  SupermarketSection,
} from '../../types/domain';
import { getSupermarketSectionVisual } from '../../utils/sectionVisuals';
import {
  loadCollectionPreferences,
  saveCollectionPreferences,
  type CollectionViewMode,
  type CollectionViewPreferences,
} from '../../utils/viewPrefs';
import type { LotExpiryInfo } from './stockService';

export interface StockLotDisplayMeta {
  lot: StockLot;
  catalogItem?: CatalogItem;
  location?: StorageLocation;
  visual: StockTypeVisual;
  expiry: LotExpiryInfo;
  step: number;
  daysFrozenOrCooked: number | null;
  isLowStock: boolean;
  sourceRecipeTitle: string | null;
  quantityLabel: string;
}

export type StockViewMode = CollectionViewMode;
export type StockSortMode = 'expiry' | 'name' | 'location';
export type StockViewPreferences = CollectionViewPreferences<StockSortMode>;

const DEFAULT_PREFERENCES: StockViewPreferences = {
  viewMode: 'line',
  sortMode: 'expiry',
  groupEnabled: false,
};

export const STOCK_PREFS_STORAGE_KEY = 'gestao_familiar_stock_view_prefs';

const VALID_SORT_MODES: readonly StockSortMode[] = ['expiry', 'name', 'location'];

export const STOCK_SORT_OPTIONS: { value: StockSortMode; label: string }[] = [
  { value: 'expiry', label: 'Validade' },
  { value: 'name', label: 'Nome A–Z' },
  { value: 'location', label: 'Localização' },
];

export function loadStockViewPreferences(): StockViewPreferences {
  return loadCollectionPreferences(
    STOCK_PREFS_STORAGE_KEY,
    VALID_SORT_MODES,
    DEFAULT_PREFERENCES,
    (raw) =>
      typeof raw.groupByLocation === 'boolean' ? { groupEnabled: raw.groupByLocation } : {},
  );
}

export function saveStockViewPreferences(prefs: StockViewPreferences): void {
  saveCollectionPreferences(STOCK_PREFS_STORAGE_KEY, prefs);
}

export type StockTypeVisual = TypeVisualMeta;

const LEFTOVER_VISUAL: StockTypeVisual = {
  Icon: UtensilsCrossed,
  label: 'Sobra / Refeição caseira',
  bgClass: 'bg-purple-100',
  textClass: 'text-purple-700',
};

const CATEGORY_FALLBACK_SECTION: Record<CatalogCategory, SupermarketSection> = {
  food: 'pantry',
  beverages: 'beverages',
  cleaning: 'cleaning',
  hygiene_baby: 'hygiene_baby',
  pets: 'pets',
  pharmacy: 'pharmacy',
};

/**
 * Resolves the generic visual symbol and palette for a stock lot from leftover state,
 * catalog supermarket section, or catalog category fallback.
 */
export function getStockTypeVisual(lot: StockLot, catalogItem?: CatalogItem): StockTypeVisual {
  if (lot.isLeftover) return LEFTOVER_VISUAL;
  if (!catalogItem) return getSupermarketSectionVisual('other');
  const section =
    catalogItem.supermarketSection ?? CATEGORY_FALLBACK_SECTION[catalogItem.category] ?? 'other';
  return getSupermarketSectionVisual(section);
}

export const StockTypeBadge = TypeIconBadge;
