import type {
  CatalogItem,
  QualitativeLevel,
  StockLot,
  StorageLocation,
  Unit,
} from '../../types/domain';
import { createId, nowIso } from '../../utils/id';
import {
  convertQuantity,
  daysBetweenDateStrings,
  getUnitDimension,
  toBaseUnit,
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

  const defaultDim = getUnitDimension(catalogItem.defaultUnit);
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
      const lotUnit = lot.unit ?? catalogItem.defaultUnit;
      if (getUnitDimension(lotUnit) === defaultDim) {
        const converted = convertQuantity(lot.quantity, lotUnit, catalogItem.defaultUnit);
        if (converted !== null) {
          totalExactInDefaultUnit += converted;
        }
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
  deductInLotUnit: number;
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
  const targetDim = getUnitDimension(targetUnit);
  const targetBase = toBaseUnit(targetQuantity, targetUnit).value;

  const eligibleLots = lots
    .filter((lot) => {
      if (lot.deletedAt) return false;
      if (lot.quantity === null || lot.quantity <= 0 || !lot.unit) return false;
      return getUnitDimension(lot.unit) === targetDim;
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

  let remainingBase = targetBase;
  const plan: DeductionPlanItem[] = [];

  for (const lot of eligibleLots) {
    if (remainingBase <= 0.0001) break;
    const lotUnit = lot.unit!;
    const lotQty = lot.quantity!;
    const lotBase = toBaseUnit(lotQty, lotUnit).value;

    const takeBase = Math.min(lotBase, remainingBase);
    const deductInLotUnit = convertQuantity(
      takeBase,
      targetDim === 'mass' ? 'g' : targetDim === 'volume' ? 'ml' : 'un',
      lotUnit,
    )!;

    const remainingInLotUnit = Math.max(0, Math.round((lotQty - deductInLotUnit) * 1000) / 1000);
    plan.push({
      lotId: lot.id,
      locationName: locationsById.get(lot.locationId)?.name ?? 'Outro',
      productLabel: lot.productLabel,
      currentQuantity: lotQty,
      currentUnit: lotUnit,
      deductInLotUnit: Math.round(deductInLotUnit * 1000) / 1000,
      remainingInLotUnit,
    });

    remainingBase -= takeBase;
  }

  const unfulfilledInTargetUnit =
    remainingBase <= 0.0001
      ? 0
      : convertQuantity(
          remainingBase,
          targetDim === 'mass' ? 'g' : targetDim === 'volume' ? 'ml' : 'un',
          targetUnit,
        )!;

  return {
    plan,
    unfulfilledInTargetUnit: Math.round(unfulfilledInTargetUnit * 100) / 100,
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
      const shouldDelete = item.remainingInLotUnit <= 0.0001;
      return {
        ...lot,
        quantity: shouldDelete ? 0 : item.remainingInLotUnit,
        deletedAt: shouldDelete ? timestamp : null,
        updatedAt: timestamp,
        lastModifiedBy: deviceId,
      };
    });
}

export function buildNewStockLot(
  params: {
    catalogItemId: string;
    productLabel: string;
    locationId: string;
    quantity: number | null;
    unit: Unit | null;
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
    qualitativeLevel: params.qualitativeLevel,
    expiresAt: params.expiresAt || null,
    frozenOrCookedAt: params.frozenOrCookedAt || null,
    isLeftover: params.isLeftover ?? false,
    sourceRecipeId: params.sourceRecipeId ?? null,
    notes: params.notes?.trim() ?? '',
  };
}
