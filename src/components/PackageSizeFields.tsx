import { PACKAGE_UNITS } from '../constants/labels';
import type { PackageUnit } from '../types/domain';
import { formatQuantity } from '../utils/units';

interface PackageSizeFieldsProps {
  packageSize: string;
  packageUnit: PackageUnit;
  onChangeSize: (value: string) => void;
  onChangeUnit: (unit: PackageUnit) => void;
  quantity?: number | null;
  label?: string;
  compact?: boolean;
}

export function PackageSizeFields({
  packageSize,
  packageUnit,
  onChangeSize,
  onChangeUnit,
  quantity,
  label = 'Tamanho de cada un. (opcional)',
  compact = false,
}: PackageSizeFieldsProps) {
  const parsedSize = Number(packageSize.replace(',', '.'));
  const totalLabel =
    quantity && quantity > 0 && Number.isFinite(parsedSize) && parsedSize > 0
      ? formatQuantity(quantity * parsedSize, packageUnit)
      : null;

  return (
    <div className={compact ? 'space-y-1' : 'rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 space-y-1.5'}>
      <div className="flex items-center justify-between gap-2">
        <label
          className={
            compact
              ? 'text-[11px] font-semibold text-slate-600'
              : 'text-xs font-semibold uppercase tracking-wide text-slate-500'
          }
        >
          {label}
        </label>
        {totalLabel && (
          <span className="rounded-md bg-teal-100 px-1.5 py-0.5 text-[11px] font-semibold text-teal-900">
            Total: {totalLabel}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          step="any"
          min="0"
          value={packageSize}
          onChange={(e) => onChangeSize(e.target.value)}
          placeholder="Ex: 85, 250, 1000"
          aria-label={label}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-teal-600"
        />
        <select
          value={packageUnit}
          onChange={(e) => onChangeUnit(e.target.value as PackageUnit)}
          aria-label="Unidade da embalagem"
          className="w-20 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-teal-600"
        >
          {PACKAGE_UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
