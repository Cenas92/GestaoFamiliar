import type { TypeVisualMeta } from '../../components/TypeIconBadge';
import type { ShoppingItem, StorageLocation } from '../../types/domain';
import { getSupermarketSectionVisual } from '../../utils/sectionVisuals';
import {
  loadCollectionPreferences,
  saveCollectionPreferences,
  type CollectionViewPreferences,
} from '../../utils/viewPrefs';

export type ShoppingSortMode = 'section' | 'unchecked_first' | 'name';
export type ShoppingViewPreferences = CollectionViewPreferences<ShoppingSortMode>;

const DEFAULT_SHOPPING_PREFS: ShoppingViewPreferences = {
  viewMode: 'medium',
  sortMode: 'section',
  groupEnabled: true,
};

export const SHOPPING_PREFS_STORAGE_KEY = 'gestao_familiar_shopping_view_prefs';

const VALID_SORT_MODES: readonly ShoppingSortMode[] = [
  'section',
  'unchecked_first',
  'name',
];

export const SHOPPING_SORT_OPTIONS: { value: ShoppingSortMode; label: string }[] = [
  { value: 'section', label: 'Corredor / Secção' },
  { value: 'unchecked_first', label: 'Por comprar primeiro' },
  { value: 'name', label: 'Nome A–Z' },
];

export const SHOPPING_SOURCE_LABELS: Record<ShoppingItem['source'], string> = {
  manual: 'Manual',
  low_stock: 'Stock baixo',
  recipe: 'Receita',
  meal_plan: 'Ementa',
};

export function loadShoppingViewPreferences(): ShoppingViewPreferences {
  return loadCollectionPreferences(
    SHOPPING_PREFS_STORAGE_KEY,
    VALID_SORT_MODES,
    DEFAULT_SHOPPING_PREFS,
  );
}

export function saveShoppingViewPreferences(prefs: ShoppingViewPreferences): void {
  saveCollectionPreferences(SHOPPING_PREFS_STORAGE_KEY, prefs);
}

export function getShoppingItemVisual(item: ShoppingItem): TypeVisualMeta {
  return getSupermarketSectionVisual(item.section);
}

export interface ShoppingItemDisplayMeta {
  item: ShoppingItem;
  visual: TypeVisualMeta;
  targetLocation?: StorageLocation;
  sectionLabel: string;
  sourceLabel: string;
  quantityLabel: string;
  step: number;
}
