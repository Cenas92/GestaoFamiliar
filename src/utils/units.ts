import type { Unit } from '../types/domain';

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

export function formatQuantity(quantity: number | null, unit: Unit | null): string {
  if (quantity === null || unit === null) return '';
  const rounded = Math.round(quantity * 100) / 100;
  const unitLabel = unit === 'tbsp' ? 'c. sopa' : unit === 'tsp' ? 'c. chá' : unit;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/\.?0+$/, '')} ${unitLabel}`;
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
