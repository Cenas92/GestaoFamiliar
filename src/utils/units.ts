import type { PackageUnit, Unit } from '../types/domain';

export type UnitDimension = 'mass' | 'volume' | 'count';

export function getUnitDimension(unit: Unit): UnitDimension {
  switch (unit) {
    case 'g':
    case 'kg':
      return 'mass';
    case 'ml':
    case 'L':
    case 'tbsp':
    case 'tsp':
      return 'volume';
    case 'un':
      return 'count';
  }
}

/**
 * Converts a quantity into its canonical base unit for comparison:
 * - mass -> g
 * - volume -> ml (using 1 tbsp = 15 ml, 1 tsp = 5 ml)
 * - count -> un
 */
export function toBaseUnit(quantity: number, unit: Unit): { value: number; baseUnit: 'g' | 'ml' | 'un' } {
  switch (unit) {
    case 'g':
      return { value: quantity, baseUnit: 'g' };
    case 'kg':
      return { value: quantity * 1000, baseUnit: 'g' };
    case 'ml':
      return { value: quantity, baseUnit: 'ml' };
    case 'L':
      return { value: quantity * 1000, baseUnit: 'ml' };
    case 'tbsp':
      return { value: quantity * 15, baseUnit: 'ml' };
    case 'tsp':
      return { value: quantity * 5, baseUnit: 'ml' };
    case 'un':
      return { value: quantity, baseUnit: 'un' };
  }
}

export function fromBaseUnit(value: number, targetUnit: Unit): number {
  switch (targetUnit) {
    case 'g':
    case 'ml':
    case 'un':
      return value;
    case 'kg':
    case 'L':
      return value / 1000;
    case 'tbsp':
      return value / 15;
    case 'tsp':
      return value / 5;
  }
}

export function convertQuantity(quantity: number, fromUnit: Unit, toUnit: Unit): number | null {
  if (fromUnit === toUnit) return quantity;
  if (getUnitDimension(fromUnit) !== getUnitDimension(toUnit)) return null;
  const base = toBaseUnit(quantity, fromUnit);
  return fromBaseUnit(base.value, toUnit);
}

export function formatNumberCompact(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '');
}

export function formatQuantity(quantity: number | null, unit: Unit | null): string {
  if (quantity === null || unit === null) return '';
  const unitLabel = unit === 'tbsp' ? 'c. sopa' : unit === 'tsp' ? 'c. chá' : unit;
  return `${formatNumberCompact(quantity)} ${unitLabel}`;
}

export interface PackagedLotQuantityInput {
  quantity: number | null;
  unit: Unit | null;
  packageSize?: number | null;
  packageUnit?: PackageUnit | null;
}

/**
 * Converts a stock/shopping item quantity into a target unit, using per-unit package size
 * (e.g. `3 un × 85 g = 255 g`) when crossing between `un` and mass/volume dimensions.
 */
export function getLotTotalInUnit(
  lot: PackagedLotQuantityInput,
  targetUnit: Unit,
  fallbackUnit?: Unit,
): number | null {
  if (lot.quantity === null || lot.quantity <= 0) return 0;
  const lotUnit = lot.unit ?? fallbackUnit;
  if (!lotUnit) return null;

  if (getUnitDimension(lotUnit) === getUnitDimension(targetUnit)) {
    return convertQuantity(lot.quantity, lotUnit, targetUnit);
  }

  const pkgSize = lot.packageSize;
  const pkgUnit = lot.packageUnit;
  if (!pkgSize || pkgSize <= 0 || !pkgUnit) return null;

  if (lotUnit === 'un' && getUnitDimension(pkgUnit) === getUnitDimension(targetUnit)) {
    return convertQuantity(lot.quantity * pkgSize, pkgUnit, targetUnit);
  }

  if (targetUnit === 'un' && getUnitDimension(lotUnit) === getUnitDimension(pkgUnit)) {
    const inPkgUnit = convertQuantity(lot.quantity, lotUnit, pkgUnit);
    return inPkgUnit !== null ? inPkgUnit / pkgSize : null;
  }

  return null;
}

/**
 * Converts an amount expressed in `sourceUnit` back into `lot.unit`, accounting for
 * optional per-package weight/volume when crossing between `un` and mass/volume.
 */
export function convertAmountToLotUnit(
  amount: number,
  sourceUnit: Unit,
  lot: PackagedLotQuantityInput,
): number | null {
  if (!lot.unit) return null;
  if (getUnitDimension(sourceUnit) === getUnitDimension(lot.unit)) {
    return convertQuantity(amount, sourceUnit, lot.unit);
  }

  const pkgSize = lot.packageSize;
  const pkgUnit = lot.packageUnit;
  if (!pkgSize || pkgSize <= 0 || !pkgUnit) return null;

  if (lot.unit === 'un' && getUnitDimension(sourceUnit) === getUnitDimension(pkgUnit)) {
    const inPkgUnit = convertQuantity(amount, sourceUnit, pkgUnit);
    return inPkgUnit !== null ? inPkgUnit / pkgSize : null;
  }

  if (sourceUnit === 'un' && getUnitDimension(lot.unit) === getUnitDimension(pkgUnit)) {
    return convertQuantity(amount * pkgSize, pkgUnit, lot.unit);
  }

  return null;
}

/**
 * Formats lot quantities concisely (e.g. `3 un × 85g`) alongside total equivalent (`255 g`).
 */
export function formatLotQuantity(
  lot: PackagedLotQuantityInput,
  fallbackUnit?: Unit,
): { compactLabel: string; totalEquivalentLabel: string | null } {
  const unit = lot.unit ?? fallbackUnit ?? null;
  if (lot.quantity === null || unit === null) {
    return { compactLabel: '', totalEquivalentLabel: null };
  }

  if (unit === 'un' && lot.packageSize && lot.packageSize > 0 && lot.packageUnit) {
    const pkgText = `${formatNumberCompact(lot.packageSize)}${lot.packageUnit}`;
    return {
      compactLabel: `${formatQuantity(lot.quantity, 'un')} × ${pkgText}`,
      totalEquivalentLabel: formatQuantity(lot.quantity * lot.packageSize, lot.packageUnit),
    };
  }

  return {
    compactLabel: formatQuantity(lot.quantity, unit),
    totalEquivalentLabel: null,
  };
}

export function formatUnitLabel(unit: Unit): string {
  switch (unit) {
    case 'tbsp':
      return 'c. sopa (15 ml)';
    case 'tsp':
      return 'c. chá (5 ml)';
    default:
      return unit;
  }
}

export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function todayDateString(reference = new Date()): string {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, '0');
  const day = String(reference.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function daysBetweenDateStrings(fromDateStr: string, toDateStr: string): number {
  const [fy, fm, fd] = fromDateStr.split('-').map(Number);
  const [ty, tm, td] = toDateStr.split('-').map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24));
}

export function formatDatePt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function getWeekStartMonday(dateStr = todayDateString()): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = dt.getUTCDay(); // 0 = Sun, 1 = Mon...
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

export function formatWeekdayShortPt(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return names[dt.getUTCDay()];
}

export function getStepForUnit(unit: Unit | null): number {
  switch (unit) {
    case 'g':
    case 'ml':
      return 100;
    case 'kg':
    case 'L':
      return 0.5;
    default:
      return 1;
  }
}
