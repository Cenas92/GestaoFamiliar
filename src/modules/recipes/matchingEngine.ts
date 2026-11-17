import type {
  CatalogItem,
  HouseholdMember,
  Recipe,
  RecipeIngredient,
  StockLot,
  StorageLocation,
  Unit,
} from '../../types/domain';
import {
  convertQuantity,
  getLotTotalInUnit,
  getUnitDimension,
  normalizeText,
  toBaseUnit,
  todayDateString,
} from '../../utils/units';
import { getLotExpiryInfo } from '../stock/stockService';

export type RecipeMatchStatus = 'ready' | 'almost' | 'missing';

export interface IngredientMatchDetail {
  ingredient: RecipeIngredient;
  catalogItemName: string;
  requiredQuantity: number | null;
  requiredUnit: Unit | null;
  availableQuantity: number | null;
  missingQuantity: number | null;
  satisfied: boolean;
  usedSubstituteName: string | null;
  usedFreezer: boolean;
  unitMismatchNote: string | null;
  usesExpiringSoon: boolean;
  minDaysToExpiry: number | null;
}

export interface RecipeMatchResult {
  recipe: Recipe;
  desiredServings: number;
  status: RecipeMatchStatus;
  missingMandatoryCount: number;
  totalMandatoryCount: number;
  ingredientDetails: IngredientMatchDetail[];
  missingIngredients: IngredientMatchDetail[];
  usedSubstitutes: string[];
  needsDefrost: boolean;
  defrostIngredientNames: string[];
  expiringSoonCount: number;
  minDaysToExpiry: number | null;
  allergenConflicts: string[];
  score: number;
}

interface CandidateEval {
  satisfied: boolean;
  availableInTargetUnit: number | null;
  missingInTargetUnit: number | null;
  usedFreezer: boolean;
  unitMismatchNote: string | null;
  usesExpiringSoon: boolean;
  minDaysToExpiry: number | null;
}

function evaluateCatalogCandidate(
  catalogId: string,
  catalogMap: Map<string, CatalogItem>,
  lotsByCatalog: Map<string, StockLot[]>,
  locationsMap: Map<string, StorageLocation>,
  requiredQty: number | null,
  requiredUnit: Unit | null,
  toTaste: boolean,
  warningDays: number,
  todayStr: string,
): CandidateEval {
  const catalog = catalogMap.get(catalogId);
  const lots = lotsByCatalog.get(catalogId) ?? [];

  if (!catalog || lots.length === 0) {
    return {
      satisfied: false,
      availableInTargetUnit: 0,
      missingInTargetUnit: requiredQty,
      usedFreezer: false,
      unitMismatchNote: null,
      usesExpiringSoon: false,
      minDaysToExpiry: null,
    };
  }

  let usesExpiringSoon = false;
  let minDaysToExpiry: number | null = null;

  const analyzeLotMeta = (lot: StockLot) => {
    const exp = getLotExpiryInfo(lot, warningDays, todayStr);
    if (exp.status === 'expiring_soon' || exp.status === 'expired') {
      usesExpiringSoon = true;
    }
    if (exp.daysRemaining !== null) {
      minDaysToExpiry =
        minDaysToExpiry === null ? exp.daysRemaining : Math.min(minDaysToExpiry, exp.daysRemaining);
    }
  };

  // Qualitative or "q.b." ingredient matching
  if (toTaste || requiredQty === null || requiredUnit === null || catalog.trackingMode === 'qualitative') {
    const availableLots = lots.filter((l) => {
      if (catalog.trackingMode === 'qualitative') {
        return l.qualitativeLevel === 'full' || l.qualitativeLevel === 'low';
      }
      return l.quantity !== null && l.quantity > 0;
    });

    if (availableLots.length === 0) {
      return {
        satisfied: false,
        availableInTargetUnit: 0,
        missingInTargetUnit: requiredQty,
        usedFreezer: false,
        unitMismatchNote: null,
        usesExpiringSoon: false,
        minDaysToExpiry: null,
      };
    }

    let hasNonFreezer = false;
    let hasFreezer = false;
    for (const l of availableLots) {
      analyzeLotMeta(l);
      const isFreezer = locationsMap.get(l.locationId)?.locationType === 'freezer';
      if (isFreezer) hasFreezer = true;
      else hasNonFreezer = true;
    }

    return {
      satisfied: true,
      availableInTargetUnit: null,
      missingInTargetUnit: 0,
      usedFreezer: hasFreezer && !hasNonFreezer,
      unitMismatchNote: null,
      usesExpiringSoon,
      minDaysToExpiry,
    };
  }

  // Quantitative matching in compatible dimensions
  const reqDim = getUnitDimension(requiredUnit);
  const reqBase = toBaseUnit(requiredQty, requiredUnit).value;

  let nonFreezerBase = 0;
  let freezerBase = 0;
  const mismatchNotes: string[] = [];

  for (const l of lots) {
    if (l.quantity === null || l.quantity <= 0) continue;
    const lotUnit = l.unit ?? catalog.defaultUnit;
    const availableInReqUnit = getLotTotalInUnit(l, requiredUnit, catalog.defaultUnit);
    if (availableInReqUnit === null) {
      mismatchNotes.push(`${l.quantity} ${lotUnit}`);
      analyzeLotMeta(l);
      continue;
    }
    analyzeLotMeta(l);
    const baseVal = toBaseUnit(availableInReqUnit, requiredUnit).value;
    const isFreezer = locationsMap.get(l.locationId)?.locationType === 'freezer';
    if (isFreezer) freezerBase += baseVal;
    else nonFreezerBase += baseVal;
  }

  const totalBase = nonFreezerBase + freezerBase;
  const baseUnitName = reqDim === 'mass' ? 'g' : reqDim === 'volume' ? 'ml' : 'un';
  const availableInTarget =
    Math.round((convertQuantity(totalBase, baseUnitName, requiredUnit) ?? 0) * 100) / 100;

  if (totalBase + 0.0001 >= reqBase) {
    // Only needs defrosting if non-freezer stock isn't enough to satisfy requirement
    const usedFreezer = nonFreezerBase + 0.0001 < reqBase && freezerBase > 0;
    return {
      satisfied: true,
      availableInTargetUnit: availableInTarget,
      missingInTargetUnit: 0,
      usedFreezer,
      unitMismatchNote: null,
      usesExpiringSoon,
      minDaysToExpiry,
    };
  }

  // If stock exists in another unit dimension (e.g. "un" vs "g"), treat as available with note
  if (totalBase === 0 && mismatchNotes.length > 0) {
    const anyNonFreezer = lots.some(
      (l) => (l.quantity ?? 0) > 0 && locationsMap.get(l.locationId)?.locationType !== 'freezer',
    );
    const anyFreezer = lots.some(
      (l) => (l.quantity ?? 0) > 0 && locationsMap.get(l.locationId)?.locationType === 'freezer',
    );
    return {
      satisfied: true,
      availableInTargetUnit: null,
      missingInTargetUnit: 0,
      usedFreezer: anyFreezer && !anyNonFreezer,
      unitMismatchNote: `Stock em ${mismatchNotes.join(' + ')}`,
      usesExpiringSoon,
      minDaysToExpiry,
    };
  }

  const missingBase = Math.max(0, reqBase - totalBase);
  const missingInTarget =
    Math.round((convertQuantity(missingBase, baseUnitName, requiredUnit) ?? missingBase) * 100) / 100;

  return {
    satisfied: false,
    availableInTargetUnit: availableInTarget,
    missingInTargetUnit: missingInTarget,
    usedFreezer: freezerBase > 0 && nonFreezerBase === 0,
    unitMismatchNote: null,
    usesExpiringSoon,
    minDaysToExpiry,
  };
}

export function evaluateRecipeMatch(
  recipe: Recipe,
  desiredServings: number,
  stockLots: StockLot[],
  catalogItems: CatalogItem[],
  locations: StorageLocation[],
  members: HouseholdMember[],
  warningDays: number,
  todayStr = todayDateString(),
): RecipeMatchResult {
  const safeBase = Math.max(1, recipe.baseServings);
  const ratio = Math.max(0.25, desiredServings) / safeBase;

  const catalogMap = new Map(catalogItems.filter((c) => !c.deletedAt).map((c) => [c.id, c]));
  const locationsMap = new Map(locations.filter((l) => !l.deletedAt).map((l) => [l.id, l]));
  const lotsByCatalog = new Map<string, StockLot[]>();

  for (const lot of stockLots) {
    if (lot.deletedAt) continue;
    const list = lotsByCatalog.get(lot.catalogItemId) ?? [];
    list.push(lot);
    lotsByCatalog.set(lot.catalogItemId, list);
  }

  const ingredientDetails: IngredientMatchDetail[] = [];
  const missingIngredients: IngredientMatchDetail[] = [];
  const usedSubstitutes: string[] = [];
  const defrostIngredientNames: string[] = [];
  let totalMandatoryCount = 0;
  let missingMandatoryCount = 0;
  let expiringSoonCount = 0;
  let minDaysToExpiry: number | null = null;

  for (const ing of recipe.ingredients) {
    const primaryCatalog = catalogMap.get(ing.catalogItemId);
    const primaryName = ing.customLabel.trim() || primaryCatalog?.name || 'Ingrediente';
    const scaledQty =
      ing.quantity !== null && !ing.toTaste ? Math.round(ing.quantity * ratio * 100) / 100 : null;

    if (!ing.isOptional) {
      totalMandatoryCount += 1;
    }

    const primaryEval = evaluateCatalogCandidate(
      ing.catalogItemId,
      catalogMap,
      lotsByCatalog,
      locationsMap,
      scaledQty,
      ing.unit,
      ing.toTaste,
      warningDays,
      todayStr,
    );

    let chosenEval = primaryEval;
    let usedSubstituteName: string | null = null;

    if (!primaryEval.satisfied && ing.substituteCatalogIds.length > 0) {
      for (const subId of ing.substituteCatalogIds) {
        const subEval = evaluateCatalogCandidate(
          subId,
          catalogMap,
          lotsByCatalog,
          locationsMap,
          scaledQty,
          ing.unit,
          ing.toTaste,
          warningDays,
          todayStr,
        );
        if (subEval.satisfied) {
          chosenEval = subEval;
          usedSubstituteName = catalogMap.get(subId)?.name ?? 'Substituto';
          usedSubstitutes.push(`${primaryName} → ${usedSubstituteName}`);
          break;
        }
      }
    }

    const effectiveSatisfied = ing.isOptional ? true : chosenEval.satisfied;
    if (!effectiveSatisfied) {
      missingMandatoryCount += 1;
    }

    if (chosenEval.satisfied && chosenEval.usedFreezer) {
      defrostIngredientNames.push(usedSubstituteName ?? primaryName);
    }

    if (chosenEval.satisfied && chosenEval.usesExpiringSoon) {
      expiringSoonCount += 1;
    }
    if (chosenEval.satisfied && chosenEval.minDaysToExpiry !== null) {
      minDaysToExpiry =
        minDaysToExpiry === null
          ? chosenEval.minDaysToExpiry
          : Math.min(minDaysToExpiry, chosenEval.minDaysToExpiry);
    }

    const detail: IngredientMatchDetail = {
      ingredient: ing,
      catalogItemName: primaryName,
      requiredQuantity: scaledQty,
      requiredUnit: ing.toTaste ? null : ing.unit,
      availableQuantity: chosenEval.availableInTargetUnit,
      missingQuantity: effectiveSatisfied ? 0 : chosenEval.missingInTargetUnit,
      satisfied: chosenEval.satisfied,
      usedSubstituteName,
      usedFreezer: chosenEval.usedFreezer,
      unitMismatchNote: chosenEval.unitMismatchNote,
      usesExpiringSoon: chosenEval.usesExpiringSoon,
      minDaysToExpiry: chosenEval.minDaysToExpiry,
    };

    ingredientDetails.push(detail);
    if (!effectiveSatisfied) {
      missingIngredients.push(detail);
    }
  }

  let status: RecipeMatchStatus = 'missing';
  if (missingMandatoryCount === 0) {
    status = 'ready';
  } else if (missingMandatoryCount <= 2) {
    status = 'almost';
  }

  // Allergen conflicts against household members
  const recipeAllergensNorm = new Set(recipe.containsAllergens.map(normalizeText));
  const allergenConflicts: string[] = [];
  for (const member of members) {
    if (member.deletedAt) continue;
    for (const allergy of member.allergies) {
      if (recipeAllergensNorm.has(normalizeText(allergy))) {
        allergenConflicts.push(`${member.name} (${allergy})`);
      }
    }
  }

  // Ranking score: ready >> almost >> missing; prioritize expiring items; bonus for quick meals
  const tierScore = status === 'ready' ? 10000 : status === 'almost' ? 5000 : 0;
  const expiryScore = expiringSoonCount * 400 + (minDaysToExpiry !== null && minDaysToExpiry <= 3 ? 300 : 0);
  const missingPenalty = missingMandatoryCount * 200;
  const timeBonus = Math.max(0, 60 - (recipe.prepMinutes + recipe.cookMinutes));

  return {
    recipe,
    desiredServings,
    status,
    missingMandatoryCount,
    totalMandatoryCount,
    ingredientDetails,
    missingIngredients,
    usedSubstitutes,
    needsDefrost: defrostIngredientNames.length > 0,
    defrostIngredientNames,
    expiringSoonCount,
    minDaysToExpiry,
    allergenConflicts,
    score: tierScore + expiryScore - missingPenalty + timeBonus,
  };
}
