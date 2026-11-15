import {
  Beef,
  CakeSlice,
  ChefHat,
  Coffee,
  Fish,
  Flame,
  Leaf,
  Soup,
  Wheat,
} from 'lucide-react';
import { AttachmentImage } from '../../components/AttachmentPreview';
import {
  TypeIconBadge,
  type TypeBadgeSize,
  type TypeVisualMeta,
} from '../../components/TypeIconBadge';
import type { Recipe, RecipeCategory } from '../../types/domain';
import {
  loadCollectionPreferences,
  saveCollectionPreferences,
  type CollectionViewPreferences,
} from '../../utils/viewPrefs';

export type RecipeSortMode = 'compatibility' | 'time' | 'name' | 'cooked';
export type RecipeViewPreferences = CollectionViewPreferences<RecipeSortMode>;

const DEFAULT_RECIPE_PREFS: RecipeViewPreferences = {
  viewMode: 'medium',
  sortMode: 'compatibility',
  groupEnabled: false,
};

export const RECIPE_PREFS_STORAGE_KEY = 'gestao_familiar_recipe_view_prefs';

const VALID_SORT_MODES: readonly RecipeSortMode[] = [
  'compatibility',
  'time',
  'name',
  'cooked',
];

export const RECIPE_SORT_OPTIONS: { value: RecipeSortMode; label: string }[] = [
  { value: 'compatibility', label: 'Compatibilidade' },
  { value: 'time', label: 'Mais rápida' },
  { value: 'name', label: 'Nome A–Z' },
  { value: 'cooked', label: 'Mais cozinhada' },
];

export function loadRecipeViewPreferences(): RecipeViewPreferences {
  return loadCollectionPreferences(RECIPE_PREFS_STORAGE_KEY, VALID_SORT_MODES, DEFAULT_RECIPE_PREFS);
}

export function saveRecipeViewPreferences(prefs: RecipeViewPreferences): void {
  saveCollectionPreferences(RECIPE_PREFS_STORAGE_KEY, prefs);
}

export const RECIPE_CATEGORY_ORDER: readonly RecipeCategory[] = [
  'meat',
  'fish',
  'vegetarian',
  'soup',
  'pasta_rice',
  'breakfast_snack',
  'dessert',
  'sauce_base',
  'other',
];

const CATEGORY_VISUALS: Record<RecipeCategory, TypeVisualMeta> = {
  meat: {
    Icon: Beef,
    label: 'Carne',
    bgClass: 'bg-rose-100',
    textClass: 'text-rose-700',
  },
  fish: {
    Icon: Fish,
    label: 'Peixe',
    bgClass: 'bg-sky-100',
    textClass: 'text-sky-700',
  },
  vegetarian: {
    Icon: Leaf,
    label: 'Vegetariano',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-700',
  },
  soup: {
    Icon: Soup,
    label: 'Sopas',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
  },
  pasta_rice: {
    Icon: Wheat,
    label: 'Massas e Arroz',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-700',
  },
  breakfast_snack: {
    Icon: Coffee,
    label: 'Peq. Almoço / Lanche',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-800',
  },
  dessert: {
    Icon: CakeSlice,
    label: 'Sobremesas',
    bgClass: 'bg-pink-100',
    textClass: 'text-pink-700',
  },
  sauce_base: {
    Icon: Flame,
    label: 'Molhos e Bases',
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-700',
  },
  other: {
    Icon: ChefHat,
    label: 'Outros',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-600',
  },
};

export function getRecipeCategoryVisual(category: RecipeCategory): TypeVisualMeta {
  return CATEGORY_VISUALS[category] ?? CATEGORY_VISUALS.other;
}

const THUMB_SIZE_CLASSES: Record<TypeBadgeSize, string> = {
  sm: 'h-7 w-7 rounded-lg',
  md: 'h-9 w-9 rounded-xl',
  lg: 'h-11 w-11 rounded-2xl',
};

export function RecipeVisualThumb({
  recipe,
  size = 'md',
}: {
  recipe: Recipe;
  size?: TypeBadgeSize;
}) {
  if (recipe.photoAttachmentId) {
    return (
      <AttachmentImage
        attachmentId={recipe.photoAttachmentId}
        alt={recipe.title}
        className={`shrink-0 ${THUMB_SIZE_CLASSES[size]}`}
      />
    );
  }
  return <TypeIconBadge visual={getRecipeCategoryVisual(recipe.category)} size={size} />;
}
