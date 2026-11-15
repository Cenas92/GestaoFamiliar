import {
  Apple,
  Baby,
  Beef,
  Croissant,
  CupSoda,
  FileText,
  LayoutGrid,
  LayoutList,
  List,
  Milk,
  Package,
  PawPrint,
  Pill,
  Snowflake,
  SprayCan,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import type {
  CatalogCategory,
  CatalogItem,
  StockLot,
  StorageLocation,
  SupermarketSection,
} from '../../types/domain';
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

export type StockViewMode = 'detailed' | 'medium' | 'line' | 'grid';
export type StockSortMode = 'expiry' | 'name' | 'location';

export interface StockViewPreferences {
  viewMode: StockViewMode;
  sortMode: StockSortMode;
  groupByLocation: boolean;
}

const DEFAULT_PREFERENCES: StockViewPreferences = {
  viewMode: 'medium',
  sortMode: 'expiry',
  groupByLocation: false,
};

export const STOCK_PREFS_STORAGE_KEY = 'gestao_familiar_stock_view_prefs';

const VALID_VIEW_MODES: readonly StockViewMode[] = ['detailed', 'medium', 'line', 'grid'];
const VALID_SORT_MODES: readonly StockSortMode[] = ['expiry', 'name', 'location'];

export const STOCK_VIEW_MODE_OPTIONS: {
  id: StockViewMode;
  label: string;
  shortLabel: string;
  Icon: LucideIcon;
}[] = [
  { id: 'medium', label: 'Cartões padrão', shortLabel: 'Padrão', Icon: LayoutList },
  { id: 'detailed', label: 'Cartões detalhados', shortLabel: 'Detalhada', Icon: FileText },
  { id: 'line', label: 'Lista compacta em linha', shortLabel: 'Em linha', Icon: List },
  { id: 'grid', label: 'Grelha em quadrados', shortLabel: 'Quadrados', Icon: LayoutGrid },
];

export function loadStockViewPreferences(): StockViewPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STOCK_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<StockViewPreferences>;
    return {
      viewMode: VALID_VIEW_MODES.includes(parsed.viewMode as StockViewMode)
        ? (parsed.viewMode as StockViewMode)
        : DEFAULT_PREFERENCES.viewMode,
      sortMode: VALID_SORT_MODES.includes(parsed.sortMode as StockSortMode)
        ? (parsed.sortMode as StockSortMode)
        : DEFAULT_PREFERENCES.sortMode,
      groupByLocation:
        typeof parsed.groupByLocation === 'boolean'
          ? parsed.groupByLocation
          : DEFAULT_PREFERENCES.groupByLocation,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveStockViewPreferences(prefs: StockViewPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STOCK_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota or private browsing restrictions
  }
}

export interface StockTypeVisual {
  Icon: LucideIcon;
  label: string;
  bgClass: string;
  textClass: string;
}

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

const BADGE_SIZE_CLASSES = {
  sm: { box: 'h-7 w-7 rounded-lg', icon: 'h-4 w-4' },
  md: { box: 'h-9 w-9 rounded-xl', icon: 'h-5 w-5' },
  lg: { box: 'h-11 w-11 rounded-2xl', icon: 'h-6 w-6' },
} as const;

export function StockTypeBadge({
  visual,
  size = 'md',
}: {
  visual: StockTypeVisual;
  size?: keyof typeof BADGE_SIZE_CLASSES;
}) {
  const { Icon } = visual;
  const dims = BADGE_SIZE_CLASSES[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${dims.box} ${visual.bgClass} ${visual.textClass}`}
      title={visual.label}
      aria-label={visual.label}
    >
      <Icon className={dims.icon} aria-hidden="true" />
    </span>
  );
}
