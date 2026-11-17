import { Minus, Pencil, Plus, ShoppingCart, Snowflake, Trash2 } from 'lucide-react';
import { Modal } from '../../components/Modal';
import {
  CATALOG_CATEGORY_LABELS,
  LOCATION_COLOR_CLASSES,
  QUALITATIVE_LABELS,
  SUPERMARKET_SECTION_LABELS,
} from '../../constants/labels';
import type { CatalogItem, QualitativeLevel, StockLot } from '../../types/domain';
import { formatDatePt, formatLotQuantity } from '../../utils/units';
import { StockTypeBadge, type StockLotDisplayMeta } from './stockVisuals';

interface StockQuantityControlsProps {
  meta: StockLotDisplayMeta;
  onAdjustQuantity: (lot: StockLot, delta: number) => void;
  onSetQualitative: (lot: StockLot, level: QualitativeLevel) => void;
  variant?: 'card' | 'inline' | 'modal';
}

const QUALITATIVE_LEVELS: readonly QualitativeLevel[] = ['full', 'low', 'empty'];

function getQualitativeActiveClass(level: QualitativeLevel): string {
  switch (level) {
    case 'empty':
      return 'bg-rose-600 text-white';
    case 'low':
      return 'bg-amber-500 text-white';
    case 'full':
      return 'bg-teal-700 text-white';
  }
}

export function StockQuantityControls({
  meta,
  onAdjustQuantity,
  onSetQualitative,
  variant = 'card',
}: StockQuantityControlsProps) {
  const { lot, catalogItem, step } = meta;

  if (catalogItem?.trackingMode === 'qualitative') {
    if (variant === 'inline') {
      return (
        <div
          className="inline-flex shrink-0 rounded-lg bg-slate-100 p-0.5"
          role="group"
          aria-label={`Nível de ${lot.productLabel}`}
        >
          {QUALITATIVE_LEVELS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => onSetQualitative(lot, lvl)}
              className={`rounded-md px-1.5 py-1 text-[11px] font-semibold transition ${
                lot.qualitativeLevel === lvl
                  ? getQualitativeActiveClass(lvl)
                  : 'text-slate-600 hover:bg-white/70'
              }`}
            >
              {QUALITATIVE_LABELS[lvl]}
            </button>
          ))}
        </div>
      );
    }

    const paddingClass = variant === 'modal' ? 'py-2 text-sm' : 'py-1 text-xs';
    return (
      <div className="flex w-full gap-1.5">
        {QUALITATIVE_LEVELS.map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => onSetQualitative(lot, lvl)}
            className={`flex-1 rounded-lg font-semibold transition ${paddingClass} ${
              lot.qualitativeLevel === lvl
                ? getQualitativeActiveClass(lvl)
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {QUALITATIVE_LABELS[lvl]}
          </button>
        ))}
      </div>
    );
  }

  const { compactLabel: formattedQty, totalEquivalentLabel } = formatLotQuantity(
    lot,
    meta.catalogItem?.defaultUnit,
  );

  if (variant === 'inline') {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onAdjustQuantity(lot, -step)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
          aria-label={`Diminuir ${lot.productLabel}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[3.4rem] whitespace-nowrap px-0.5 text-center text-xs font-bold text-slate-900 tabular-nums">
          {formattedQty || '—'}
        </span>
        <button
          type="button"
          onClick={() => onAdjustQuantity(lot, step)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
          aria-label={`Aumentar ${lot.productLabel}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <button
            type="button"
            onClick={() => onAdjustQuantity(lot, -step)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-100"
            aria-label={`Diminuir ${lot.productLabel}`}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="text-base font-bold text-slate-900 tabular-nums">
            {formattedQty || '—'}
          </span>
          <button
            type="button"
            onClick={() => onAdjustQuantity(lot, step)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-100"
            aria-label={`Aumentar ${lot.productLabel}`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {totalEquivalentLabel && (
          <p className="text-center text-xs font-medium text-teal-800">
            Total equivalente: <span className="font-bold">{totalEquivalentLabel}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-bold text-slate-900">{formattedQty}</span>
        {totalEquivalentLabel && (
          <span className="text-xs font-medium text-teal-700">({totalEquivalentLabel})</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onAdjustQuantity(lot, -step)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
          aria-label={`Diminuir ${lot.productLabel}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onAdjustQuantity(lot, step)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
          aria-label={`Aumentar ${lot.productLabel}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

export function StockStatusBadges({ meta }: { meta: StockLotDisplayMeta }) {
  const { lot, location, expiry, daysFrozenOrCooked } = meta;

  return (
    <>
      {expiry.status === 'expired' && (
        <span className="rounded-lg bg-rose-100 px-2 py-0.5 font-semibold text-rose-800">
          Expirou em {formatDatePt(lot.expiresAt)}
        </span>
      )}
      {expiry.status === 'expiring_soon' && (
        <span className="rounded-lg bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
          Expira em {expiry.daysRemaining === 0 ? 'hoje' : `${expiry.daysRemaining}d`} (
          {formatDatePt(lot.expiresAt)})
        </span>
      )}
      {expiry.status === 'ok' && lot.expiresAt && (
        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-slate-600">
          Validade: {formatDatePt(lot.expiresAt)}
        </span>
      )}
      {daysFrozenOrCooked !== null && (
        <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-blue-700">
          {location?.locationType === 'freezer' ? 'Congelado' : 'Feito'} há {daysFrozenOrCooked}d (
          {formatDatePt(lot.frozenOrCookedAt)})
        </span>
      )}
    </>
  );
}

interface StockQuickModalProps {
  open: boolean;
  onClose: () => void;
  meta: StockLotDisplayMeta | null;
  onAdjustQuantity: (lot: StockLot, delta: number) => void;
  onSetQualitative: (lot: StockLot, level: QualitativeLevel) => void;
  onAddToShopping: (cat: CatalogItem) => void;
  onEdit: (lot: StockLot) => void;
  onDelete: (lot: StockLot) => void;
}

export function StockQuickModal({
  open,
  onClose,
  meta,
  onAdjustQuantity,
  onSetQualitative,
  onAddToShopping,
  onEdit,
  onDelete,
}: StockQuickModalProps) {
  if (!meta) return null;

  const { lot, catalogItem, location, visual, isLowStock, sourceRecipeTitle } = meta;
  const colors = LOCATION_COLOR_CLASSES[location?.colorToken ?? 'slate'];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lot.productLabel}
      subtitle={
        catalogItem && catalogItem.name !== lot.productLabel
          ? `Genérico: ${catalogItem.name}`
          : visual.label
      }
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <StockTypeBadge visual={visual} size="lg" />
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors.badge}`}
            >
              {location?.locationType === 'freezer' && <Snowflake className="h-3 w-3" />}
              {location?.name ?? 'Local'}
            </span>
            {lot.isLeftover && (
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
                Sobra
              </span>
            )}
            {isLowStock && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                Stock baixo
              </span>
            )}
            {catalogItem && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {CATALOG_CATEGORY_LABELS[catalogItem.category]} ·{' '}
                {meta.sectionLabel ?? SUPERMARKET_SECTION_LABELS[catalogItem.supermarketSection] ?? 'Outros'}
              </span>
            )}
          </div>
        </div>

        {(lot.expiresAt || meta.daysFrozenOrCooked !== null || sourceRecipeTitle || lot.notes) && (
          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
            {(lot.expiresAt || meta.daysFrozenOrCooked !== null) && (
              <div className="flex flex-wrap gap-1.5">
                <StockStatusBadges meta={meta} />
              </div>
            )}
            {sourceRecipeTitle && (
              <p className="text-slate-600">
                Origem: <span className="font-semibold text-slate-800">{sourceRecipeTitle}</span>
              </p>
            )}
            {lot.notes && <p className="whitespace-pre-wrap text-slate-600">{lot.notes}</p>}
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-500">Ajuste rápido</p>
          <StockQuantityControls
            meta={meta}
            onAdjustQuantity={onAdjustQuantity}
            onSetQualitative={onSetQualitative}
            variant="modal"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
          {catalogItem ? (
            <button
              type="button"
              onClick={() => {
                onAddToShopping(catalogItem);
                onClose();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-700"
            >
              <ShoppingCart className="h-4 w-4" />
              Compras
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(lot);
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete(lot);
              onClose();
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            <Trash2 className="h-4 w-4" />
            Remover
          </button>
        </div>
      </div>
    </Modal>
  );
}
