import type {
  CatalogCategory,
  CatalogItem,
  PackageUnit,
  QualitativeLevel,
  StockLot,
  StorageLocation,
  SupermarketSection,
  Unit,
} from '../../types/domain';
import { createId, nowIso } from '../../utils/id';
import {
  convertAmountToLotUnit,
  daysBetweenDateStrings,
  formatQuantity,
  getLotTotalInUnit,
  todayDateString,
} from '../../utils/units';

export type ExpiryStatus = 'expired' | 'expiring_soon' | 'ok' | 'none';

export interface LotExpiryInfo {
  status: ExpiryStatus;
  daysRemaining: number | null;
}

export function getLotExpiryInfo(
  lot: StockLot,
  warningDays: number,
  todayStr = todayDateString(),
): LotExpiryInfo {
  if (!lot.expiresAt) {
    return { status: 'none', daysRemaining: null };
  }
  const diff = daysBetweenDateStrings(todayStr, lot.expiresAt);
  if (diff < 0) {
    return { status: 'expired', daysRemaining: diff };
  }
  if (diff <= warningDays) {
    return { status: 'expiring_soon', daysRemaining: diff };
  }
  return { status: 'ok', daysRemaining: diff };
}

export interface CatalogStockSummary {
  catalogItem: CatalogItem;
  lots: StockLot[];
  totalExactInDefaultUnit: number;
  hasMixedDimensions: boolean;
  bestQualitativeLevel: QualitativeLevel;
  isLowStock: boolean;
  isOutOfStock: boolean;
  hasExpired: boolean;
  hasExpiringSoon: boolean;
  earliestExpiry: string | null;
}

export function summarizeCatalogStock(
  catalogItem: CatalogItem,
  allLots: StockLot[],
  warningDays: number,
  todayStr = todayDateString(),
): CatalogStockSummary {
  const activeLots = allLots.filter(
    (l) => !l.deletedAt && l.catalogItemId === catalogItem.id,
  );

  let totalExactInDefaultUnit = 0;
  let hasMixedDimensions = false;
  let bestQual: QualitativeLevel = 'empty';
  let hasExpired = false;
  let hasExpiringSoon = false;
  let earliestExpiry: string | null = null;

  for (const lot of activeLots) {
    const exp = getLotExpiryInfo(lot, warningDays, todayStr);
    if (exp.status === 'expired') hasExpired = true;
    if (exp.status === 'expiring_soon') hasExpiringSoon = true;
    if (lot.expiresAt && (!earliestExpiry || lot.expiresAt < earliestExpiry)) {
      earliestExpiry = lot.expiresAt;
    }

    if (catalogItem.trackingMode === 'qualitative') {
      const level = lot.qualitativeLevel ?? (lot.quantity && lot.quantity > 0 ? 'full' : 'empty');
      if (level === 'full') bestQual = 'full';
      else if (level === 'low' && bestQual === 'empty') bestQual = 'low';
    } else if (lot.quantity !== null && lot.quantity > 0) {
      const converted = getLotTotalInUnit(lot, catalogItem.defaultUnit, catalogItem.defaultUnit);
      if (converted !== null) {
        totalExactInDefaultUnit += converted;
      } else {
        hasMixedDimensions = true;
      }
      bestQual = 'full';
    }
  }

  const isOutOfStock =
    catalogItem.trackingMode === 'qualitative'
      ? bestQual === 'empty'
      : totalExactInDefaultUnit <= 0 && !hasMixedDimensions;

  let isLowStock = false;
  if (catalogItem.trackingMode === 'qualitative') {
    if (catalogItem.minStockQty !== null && catalogItem.minStockQty > 0) {
      isLowStock = bestQual === 'low' || bestQual === 'empty';
    } else {
      isLowStock = bestQual === 'low';
    }
  } else if (catalogItem.minStockQty !== null && catalogItem.minStockQty > 0) {
    if (!hasMixedDimensions) {
      isLowStock = totalExactInDefaultUnit < catalogItem.minStockQty;
    }
  }

  return {
    catalogItem,
    lots: activeLots,
    totalExactInDefaultUnit,
    hasMixedDimensions,
    bestQualitativeLevel: bestQual,
    isLowStock,
    isOutOfStock,
    hasExpired,
    hasExpiringSoon,
    earliestExpiry,
  };
}

export interface DeductionPlanItem {
  lotId: string;
  locationName: string;
  productLabel: string;
  currentQuantity: number;
  currentUnit: Unit;
  packageSize: number | null;
  packageUnit: PackageUnit | null;
  deductInLotUnit: number;
  deductEquivalent: string | null;
  remainingInLotUnit: number;
}

/**
 * Computes FEFO (First-Expired, First-Out) lot deductions without mutating the database.
 */
export function planLotDeduction(
  lots: StockLot[],
  locationsById: Map<string, StorageLocation>,
  targetQuantity: number,
  targetUnit: Unit,
): { plan: DeductionPlanItem[]; unfulfilledInTargetUnit: number } {
  const eligibleLots = lots
    .filter((lot) => {
      if (lot.deletedAt) return false;
      if (lot.quantity === null || lot.quantity <= 0 || !lot.unit) return false;
      return getLotTotalInUnit(lot, targetUnit) !== null;
    })
    .sort((a, b) => {
      // Non-null earliest expiry first (FEFO), then non-freezer before freezer, then oldest created
      if (a.expiresAt && b.expiresAt) {
        if (a.expiresAt !== b.expiresAt) return a.expiresAt.localeCompare(b.expiresAt);
      } else if (a.expiresAt) {
        return -1;
      } else if (b.expiresAt) {
        return 1;
      }
      const locA = locationsById.get(a.locationId)?.locationType === 'freezer' ? 1 : 0;
      const locB = locationsById.get(b.locationId)?.locationType === 'freezer' ? 1 : 0;
      if (locA !== locB) return locA - locB;
      return a.createdAt.localeCompare(b.createdAt);
    });

  let remainingInTarget = targetQuantity;
  const plan: DeductionPlanItem[] = [];

  for (const lot of eligibleLots) {
    if (remainingInTarget <= 0.0001) break;
    const lotUnit = lot.unit!;
    const lotQty = lot.quantity!;
    const lotAvailInTarget = getLotTotalInUnit(lot, targetUnit);
    if (lotAvailInTarget === null || lotAvailInTarget <= 0) continue;

    const takeInTarget = Math.min(lotAvailInTarget, remainingInTarget);
    const deductRaw = convertAmountToLotUnit(takeInTarget, targetUnit, lot);
    if (deductRaw === null || deductRaw <= 0) continue;

    const deductInLotUnit = Math.min(lotQty, Math.round(deductRaw * 1000) / 1000);
    const remainingInLotUnit = Math.max(0, Math.round((lotQty - deductInLotUnit) * 1000) / 1000);
    const pkgSize = lot.packageSize ?? null;
    const pkgUnit = lot.packageUnit ?? null;
    const deductEquivalent =
      lotUnit === 'un' && pkgSize && pkgSize > 0 && pkgUnit
        ? formatQuantity(deductInLotUnit * pkgSize, pkgUnit)
        : null;

    plan.push({
      lotId: lot.id,
      locationName: locationsById.get(lot.locationId)?.name ?? 'Outro',
      productLabel: lot.productLabel,
      currentQuantity: lotQty,
      currentUnit: lotUnit,
      packageSize: pkgSize,
      packageUnit: pkgUnit,
      deductInLotUnit,
      deductEquivalent,
      remainingInLotUnit,
    });

    remainingInTarget = Math.max(0, remainingInTarget - takeInTarget);
  }

  const unfulfilledInTargetUnit =
    remainingInTarget <= 0.0001 ? 0 : Math.round(remainingInTarget * 100) / 100;

  return {
    plan,
    unfulfilledInTargetUnit,
  };
}

export function applyLotDeductions(
  lots: StockLot[],
  plan: DeductionPlanItem[],
  deviceId: string,
): StockLot[] {
  const planMap = new Map(plan.map((p) => [p.lotId, p]));
  const timestamp = nowIso();

  return lots
    .filter((lot) => planMap.has(lot.id))
    .map((lot) => {
      const item = planMap.get(lot.id)!;
      const shouldDelete = item.remainingInLotUnit <= 0.001;
      return {
        ...lot,
        quantity: shouldDelete ? 0 : item.remainingInLotUnit,
        deletedAt: shouldDelete ? timestamp : null,
        updatedAt: timestamp,
        lastModifiedBy: deviceId,
      };
    });
}

export function findMergeableStockLot(
  lots: StockLot[],
  candidate: {
    catalogItemId: string;
    locationId: string;
    unit: Unit;
    packageSize?: number | null;
    packageUnit?: PackageUnit | null;
    expiresAt?: string | null;
  },
): StockLot | undefined {
  const targetPkgSize =
    candidate.unit === 'un' && candidate.packageSize && candidate.packageSize > 0
      ? candidate.packageSize
      : null;
  const targetPkgUnit = targetPkgSize ? (candidate.packageUnit ?? null) : null;
  const targetExpiry = candidate.expiresAt || null;

  return lots.find((lot) => {
    if (lot.deletedAt || lot.isLeftover) return false;
    if (lot.catalogItemId !== candidate.catalogItemId) return false;
    if (lot.locationId !== candidate.locationId) return false;
    if (lot.unit !== candidate.unit) return false;
    const lotPkgSize =
      lot.unit === 'un' && lot.packageSize && lot.packageSize > 0 ? lot.packageSize : null;
    const lotPkgUnit = lotPkgSize ? (lot.packageUnit ?? null) : null;
    if (lotPkgSize !== targetPkgSize || lotPkgUnit !== targetPkgUnit) return false;
    return (lot.expiresAt || null) === targetExpiry;
  });
}

export function buildNewStockLot(
  params: {
    catalogItemId: string;
    productLabel: string;
    locationId: string;
    quantity: number | null;
    unit: Unit | null;
    packageSize?: number | null;
    packageUnit?: PackageUnit | null;
    qualitativeLevel: QualitativeLevel | null;
    expiresAt?: string | null;
    frozenOrCookedAt?: string | null;
    isLeftover?: boolean;
    sourceRecipeId?: string | null;
    notes?: string;
  },
  deviceId: string,
): StockLot {
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
    productLabel: params.productLabel.trim(),
    locationId: params.locationId,
    quantity: params.quantity,
    unit: params.unit,
    packageSize: hasPkg ? params.packageSize! : null,
    packageUnit: hasPkg ? params.packageUnit! : null,
    qualitativeLevel: params.qualitativeLevel,
    expiresAt: params.expiresAt || null,
    frozenOrCookedAt: params.frozenOrCookedAt || null,
    isLeftover: params.isLeftover ?? false,
    sourceRecipeId: params.sourceRecipeId ?? null,
    notes: params.notes?.trim() ?? '',
  };
}

export interface SurvivalKitPreset {
  key: string;
  name: string;
  matchCatalogId?: string;
  targetQty: number;
  unit: Unit;
  category: CatalogCategory;
  supermarketSection: SupermarketSection;
  preferredLocationType: 'pantry' | 'household' | 'pharmacy';
}

export const SURVIVAL_KIT_PRESETS: SurvivalKitPreset[] = [
  {
    key: 'water',
    name: 'Água engarrafada',
    targetQty: 18,
    unit: 'L',
    category: 'beverages',
    supermarketSection: 'beverages',
    preferredLocationType: 'pantry',
  },
  {
    key: 'tuna',
    name: 'Atum em conserva',
    matchCatalogId: 'starter-cat-atum-lata',
    targetQty: 8,
    unit: 'un',
    category: 'food',
    supermarketSection: 'pantry',
    preferredLocationType: 'pantry',
  },
  {
    key: 'beans',
    name: 'Feijão / Grão em conserva',
    matchCatalogId: 'starter-cat-feijao-lata',
    targetQty: 6,
    unit: 'un',
    category: 'food',
    supermarketSection: 'pantry',
    preferredLocationType: 'pantry',
  },
  {
    key: 'rice',
    name: 'Arroz',
    matchCatalogId: 'starter-cat-arroz',
    targetQty: 3000,
    unit: 'g',
    category: 'food',
    supermarketSection: 'pantry',
    preferredLocationType: 'pantry',
  },
  {
    key: 'pasta',
    name: 'Massa (esparguete / espirais)',
    matchCatalogId: 'starter-cat-massa',
    targetQty: 2000,
    unit: 'g',
    category: 'food',
    supermarketSection: 'pantry',
    preferredLocationType: 'pantry',
  },
  {
    key: 'milk_uht',
    name: 'Leite',
    matchCatalogId: 'starter-cat-leite',
    targetQty: 6,
    unit: 'L',
    category: 'beverages',
    supermarketSection: 'dairy',
    preferredLocationType: 'pantry',
  },
  {
    key: 'biscuits',
    name: 'Bolachas / Barras energéticas',
    targetQty: 4,
    unit: 'un',
    category: 'food',
    supermarketSection: 'pantry',
    preferredLocationType: 'pantry',
  },
  {
    key: 'batteries',
    name: 'Pilhas AA / AAA',
    targetQty: 8,
    unit: 'un',
    category: 'cleaning',
    supermarketSection: 'cleaning',
    preferredLocationType: 'household',
  },
  {
    key: 'candles',
    name: 'Velas e isqueiro / fósforos',
    targetQty: 4,
    unit: 'un',
    category: 'cleaning',
    supermarketSection: 'cleaning',
    preferredLocationType: 'household',
  },
  {
    key: 'first_aid',
    name: 'Paracetamol (adulto / xarope)',
    matchCatalogId: 'starter-cat-paracetamol',
    targetQty: 2,
    unit: 'un',
    category: 'pharmacy',
    supermarketSection: 'pharmacy',
    preferredLocationType: 'pharmacy',
  },
];

export interface SurvivalItemSummary {
  catalogItem: CatalogItem;
  currentQty: number;
  targetQty: number;
  missingQty: number;
  percent: number;
  isMet: boolean;
  earliestExpiry: string | null;
  hasExpired: boolean;
  hasExpiringSoon: boolean;
}

export interface SurvivalStockOverview {
  items: SurvivalItemSummary[];
  metCount: number;
  totalCount: number;
  overallPercent: number;
  missingItems: SurvivalItemSummary[];
}

export function summarizeSurvivalStock(
  catalogItems: CatalogItem[],
  stockLots: StockLot[],
  warningDays: number,
  todayStr = todayDateString(),
): SurvivalStockOverview {
  const items: SurvivalItemSummary[] = catalogItems
    .filter(
      (cat) =>
        !cat.deletedAt &&
        cat.survivalTargetQty !== undefined &&
        cat.survivalTargetQty !== null &&
        cat.survivalTargetQty > 0,
    )
    .map((cat) => {
      const targetQty = cat.survivalTargetQty as number;
      const summary = summarizeCatalogStock(cat, stockLots, warningDays, todayStr);
      const currentQty =
        cat.trackingMode === 'qualitative'
          ? summary.bestQualitativeLevel === 'full'
            ? targetQty
            : summary.bestQualitativeLevel === 'low'
              ? Math.round((targetQty / 2) * 100) / 100
              : 0
          : Math.round(summary.totalExactInDefaultUnit * 100) / 100;

      const missingQty = Math.max(0, Math.round((targetQty - currentQty) * 100) / 100);
      const percent = Math.min(100, Math.round((currentQty / targetQty) * 100));
      return {
        catalogItem: cat,
        currentQty,
        targetQty,
        missingQty,
        percent,
        isMet: missingQty <= 0,
        earliestExpiry: summary.earliestExpiry,
        hasExpired: summary.hasExpired,
        hasExpiringSoon: summary.hasExpiringSoon,
      };
    })
    .sort((a, b) => a.percent - b.percent || a.catalogItem.name.localeCompare(b.catalogItem.name, 'pt-PT'));

  const totalCount = items.length;
  const metCount = items.filter((i) => i.isMet).length;
  const overallPercent =
    totalCount > 0 ? Math.round(items.reduce((acc, i) => acc + i.percent, 0) / totalCount) : 0;

  return {
    items,
    metCount,
    totalCount,
    overallPercent,
    missingItems: items.filter((i) => !i.isMet),
  };
}
