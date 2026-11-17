import type {
  CatalogItem,
  MealPlanEntry,
  PackageUnit,
  Recipe,
  ShoppingItem,
  StockLot,
  StorageLocation,
  SupermarketSection,
  Unit,
} from '../../types/domain';
import { createId, nowIso } from '../../utils/id';
import {
  addDaysToDateString,
  convertQuantity,
  getLotTotalInUnit,
  getUnitDimension,
  toBaseUnit,
  todayDateString,
} from '../../utils/units';
import { evaluateRecipeMatch } from './../recipes/matchingEngine';

export interface MissingPlanNeed {
  catalogItemId: string;
  label: string;
  missingQuantity: number | null;
  unit: Unit | null;
  section: SupermarketSection;
  targetLocationId: string | null;
}

/**
 * Calculates net missing ingredients across uncompleted meal plan entries in a date window.
 */
export function computeMealPlanMissingNeeds(
  entries: MealPlanEntry[],
  recipes: Recipe[],
  catalogItems: CatalogItem[],
  stockLots: StockLot[],
  existingShoppingItems: ShoppingItem[],
): MissingPlanNeed[] {
  const recipesById = new Map(recipes.filter((r) => !r.deletedAt).map((r) => [r.id, r]));
  const catalogById = new Map(catalogItems.filter((c) => !c.deletedAt).map((c) => [c.id, c]));

  // Aggregate demand per catalogItemId (separated by compatible base dimension when needed)
  const demandQuantitative = new Map<
    string,
    { baseQty: number; dim: 'mass' | 'volume' | 'count'; targetUnit: Unit }
  >();
  const demandQualitative = new Set<string>();

  for (const entry of entries) {
    if (entry.deletedAt || entry.completed || !entry.recipeId) continue;
    const recipe = recipesById.get(entry.recipeId);
    if (!recipe) continue;

    const ratio = Math.max(0.25, entry.plannedServings) / Math.max(1, recipe.baseServings);

    for (const ing of recipe.ingredients) {
      if (ing.isOptional || ing.toTaste) continue;
      const catalog = catalogById.get(ing.catalogItemId);
      if (!catalog) continue;

      if (catalog.trackingMode === 'qualitative' || ing.quantity === null || ing.unit === null) {
        demandQualitative.add(catalog.id);
        continue;
      }

      const ingDim = getUnitDimension(ing.unit);
      const scaledBase = toBaseUnit(ing.quantity * ratio, ing.unit).value;
      const key = `${catalog.id}::${ingDim}`;
      const existing = demandQuantitative.get(key);
      if (existing) {
        existing.baseQty += scaledBase;
      } else {
        const preferredUnit =
          getUnitDimension(catalog.defaultUnit) === ingDim ? catalog.defaultUnit : ing.unit;
        demandQuantitative.set(key, {
          baseQty: scaledBase,
          dim: ingDim,
          targetUnit: preferredUnit,
        });
      }
    }
  }

  // Sum existing stock and already-queued unchecked shopping items
  const activeLots = stockLots.filter((l) => !l.deletedAt);
  const activeShopping = existingShoppingItems.filter((s) => !s.deletedAt && !s.checked);
  const results: MissingPlanNeed[] = [];

  for (const [key, need] of demandQuantitative.entries()) {
    const catalogId = key.split('::')[0];
    const catalog = catalogById.get(catalogId);
    if (!catalog) continue;

    const baseUnitName = need.dim === 'mass' ? 'g' : need.dim === 'volume' ? 'ml' : 'un';
    let availableBase = 0;
    for (const lot of activeLots) {
      if (lot.catalogItemId !== catalogId || !lot.quantity || lot.quantity <= 0) continue;
      const inBase = getLotTotalInUnit(lot, baseUnitName, catalog.defaultUnit);
      if (inBase !== null) {
        availableBase += inBase;
      }
    }

    for (const shop of activeShopping) {
      if (shop.catalogItemId !== catalogId || !shop.quantity || shop.quantity <= 0) continue;
      const inBase = getLotTotalInUnit(shop, baseUnitName, catalog.defaultUnit);
      if (inBase !== null) {
        availableBase += inBase;
      }
    }

    const netBase = need.baseQty - availableBase;
    if (netBase <= 0.0001) continue;

    let displayUnit = need.targetUnit;
    let qty = convertQuantity(netBase, baseUnitName, displayUnit) ?? netBase;

    // Make large gram/ml amounts friendlier
    if (displayUnit === 'g' && qty >= 1000) {
      qty = qty / 1000;
      displayUnit = 'kg';
    } else if (displayUnit === 'ml' && qty >= 1000) {
      qty = qty / 1000;
      displayUnit = 'L';
    }

    results.push({
      catalogItemId: catalog.id,
      label: catalog.name,
      missingQuantity: Math.round(qty * 100) / 100,
      unit: displayUnit,
      section: catalog.supermarketSection,
      targetLocationId: catalog.defaultLocationId,
    });
  }

  for (const catalogId of demandQualitative) {
    const catalog = catalogById.get(catalogId);
    if (!catalog) continue;

    const hasStock = activeLots.some(
      (l) =>
        l.catalogItemId === catalogId &&
        (l.qualitativeLevel === 'full' || l.qualitativeLevel === 'low' || (l.quantity ?? 0) > 0),
    );
    const alreadyInList = activeShopping.some((s) => s.catalogItemId === catalogId);
    if (!hasStock && !alreadyInList) {
      results.push({
        catalogItemId: catalog.id,
        label: catalog.name,
        missingQuantity: 1,
        unit: 'un',
        section: catalog.supermarketSection,
        targetLocationId: catalog.defaultLocationId,
      });
    }
  }

  return results;
}

export interface DefrostReminder {
  entry: MealPlanEntry;
  recipeTitle: string;
  ingredientNames: string[];
}

export function getTomorrowDefrostReminders(
  entries: MealPlanEntry[],
  recipes: Recipe[],
  stockLots: StockLot[],
  catalogItems: CatalogItem[],
  locations: StorageLocation[],
  warningDays: number,
  todayStr = todayDateString(),
): DefrostReminder[] {
  const tomorrowStr = addDaysToDateString(todayStr, 1);
  const recipesById = new Map(recipes.filter((r) => !r.deletedAt).map((r) => [r.id, r]));
  const reminders: DefrostReminder[] = [];

  for (const entry of entries) {
    if (entry.deletedAt || entry.completed || entry.date !== tomorrowStr || !entry.recipeId) {
      continue;
    }
    const recipe = recipesById.get(entry.recipeId);
    if (!recipe) continue;

    const match = evaluateRecipeMatch(
      recipe,
      entry.plannedServings,
      stockLots,
      catalogItems,
      locations,
      [],
      warningDays,
      todayStr,
    );

    if (match.needsDefrost) {
      reminders.push({
        entry,
        recipeTitle: recipe.title,
        ingredientNames: match.defrostIngredientNames,
      });
    }
  }

  return reminders;
}

export function buildShoppingItem(
  params: {
    catalogItemId: string | null;
    label: string;
    quantity: number | null;
    unit: Unit | null;
    packageSize?: number | null;
    packageUnit?: PackageUnit | null;
    section: SupermarketSection;
    targetLocationId: string | null;
    source: ShoppingItem['source'];
    notes?: string;
    photoAttachmentId?: string | null;
  },
  deviceId: string,
): ShoppingItem {
  const now = nowIso();
  const hasPkg =
    params.unit === 'un' &&
    params.packageSize !== undefined &&
    params.packageSize !== null &&
    params.packageSize > 0 &&
    Boolean(params.packageUnit);
  return {
    id: createId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    lastModifiedBy: deviceId,
    catalogItemId: params.catalogItemId,
    label: params.label.trim(),
    quantity: params.quantity,
    unit: params.unit,
    packageSize: hasPkg ? params.packageSize! : null,
    packageUnit: hasPkg ? params.packageUnit! : null,
    section: params.section,
    checked: false,
    targetLocationId: params.targetLocationId,
    source: params.source,
    notes: params.notes?.trim() ?? '',
    photoAttachmentId: params.photoAttachmentId ?? null,
  };
}
