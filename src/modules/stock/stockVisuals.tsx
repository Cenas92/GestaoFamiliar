import {
  Apple,
  Baby,
  Beef,
  Croissant,
  CupSoda,
  Milk,
  Package,
  PawPrint,
  Pill,
  Snowflake,
  SprayCan,
  UtensilsCrossed,
  Wheat,
} from 'lucide-react';
import { TypeIconBadge, type TypeVisualMeta } from '../../components/TypeIconBadge';
import type {
  CatalogCategory,
  CatalogItem,
  StockLot,
  StorageLocation,
  SupermarketSection,
} from '../../types/domain';
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
  viewMode: 'medium',
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

const SECTION_VISUALS: Record<SupermarketSection, StockTypeVisual> = {
  produce: {
    Icon: Apple,
    label: 'Fruta e Legumes',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-700',
  },
  bakery: {
    Icon: Croissant,
    label: 'Padaria e Pastelaria',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
  },
  meat_fish: {
    Icon: Beef,
    label: 'Talho e Peixaria',
    bgClass: 'bg-rose-100',
    textClass: 'text-rose-700',
  },
  dairy: {
    Icon: Milk,
    label: 'Lacticínios e Ovos',
    bgClass: 'bg-sky-100',
    textClass: 'text-sky-700',
  },
  pantry: {
    Icon: Wheat,
    label: 'Mercearia',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-700',
  },
  frozen: {
    Icon: Snowflake,
    label: 'Congelados',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-700',
  },
  beverages: {
    Icon: CupSoda,
    label: 'Bebidas',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
  },
  cleaning: {
    Icon: SprayCan,
    label: 'Limpeza e Casa',
    bgClass: 'bg-teal-100',
    textClass: 'text-teal-700',
  },
  hygiene_baby: {
    Icon: Baby,
    label: 'Higiene / Bebé',
    bgClass: 'bg-pink-100',
    textClass: 'text-pink-700',
  },
  pets: {
    Icon: PawPrint,
    label: 'Animais',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-800',
  },
  pharmacy: {
    Icon: Pill,
    label: 'Farmácia / Saúde',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
  },
  other: {
    Icon: Package,
    label: 'Outros',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-600',
  },
};

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
  if (!catalogItem) return SECTION_VISUALS.other;
  const section =
    catalogItem.supermarketSection ?? CATEGORY_FALLBACK_SECTION[catalogItem.category] ?? 'other';
  return SECTION_VISUALS[section] ?? SECTION_VISUALS.other;
}

export const StockTypeBadge = TypeIconBadge;
