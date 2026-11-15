import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Minus,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Snowflake,
  Trash2,
} from 'lucide-react';
import {
  CATALOG_CATEGORY_LABELS,
  LOCATION_COLOR_CLASSES,
  QUALITATIVE_LABELS,
} from '../../constants/labels';
import { db } from '../../db/database';
import type {
  CatalogCategory,
  CatalogItem,
  QualitativeLevel,
  ShoppingItem,
  StockLot,
  StorageLocation,
  Unit,
} from '../../types/domain';
import { nowIso } from '../../utils/id';
import {
  daysBetweenDateStrings,
  formatDatePt,
  formatQuantity,
  normalizeText,
  todayDateString,
} from '../../utils/units';
import { buildShoppingItem } from '../planner/plannerService';
import { CatalogManagerModal } from './CatalogManagerModal';
import { StockLotModal } from './StockLotModal';
import { getLotExpiryInfo, summarizeCatalogStock } from './stockService';

interface StockViewProps {
  locations: StorageLocation[];
  catalogItems: CatalogItem[];
  stockLots: StockLot[];
  shoppingItems: ShoppingItem[];
  expiryWarningDays: number;
  deviceId: string;
}

type StatusFilter = 'all' | 'expiring' | 'low' | 'leftovers';

function getStepForUnit(unit: Unit | null): number {
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

export function StockView({
  locations,
  catalogItems,
  stockLots,
  shoppingItems,
  expiryWarningDays,
  deviceId,
}: StockViewProps) {
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<StockLot | null>(null);
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const today = todayDateString();
  const catalogById = useMemo(
    () => new Map(catalogItems.map((c) => [c.id, c])),
    [catalogItems],
  );
  const locationsById = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations],
  );

  const lowStockSummaries = useMemo(() => {
    return catalogItems
      .map((cat) => summarizeCatalogStock(cat, stockLots, expiryWarningDays, today))
      .filter((s) => s.isLowStock);
  }, [catalogItems, stockLots, expiryWarningDays, today]);

  const lowCatalogIds = useMemo(
    () => new Set(lowStockSummaries.map((s) => s.catalogItem.id)),
    [lowStockSummaries],
  );

  const locationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lot of stockLots) {
      counts.set(lot.locationId, (counts.get(lot.locationId) ?? 0) + 1);
    }
    return counts;
  }, [stockLots]);

  const filteredLots = useMemo(() => {
    const q = normalizeText(search);
    return stockLots
      .filter((lot) => {
        if (selectedLocationId !== 'all' && lot.locationId !== selectedLocationId) return false;
        const cat = catalogById.get(lot.catalogItemId);
        if (selectedCategory !== 'all' && cat?.category !== selectedCategory) return false;

        if (statusFilter === 'expiring') {
          const info = getLotExpiryInfo(lot, expiryWarningDays, today);
          if (info.status !== 'expired' && info.status !== 'expiring_soon') return false;
        } else if (statusFilter === 'low') {
          if (!lowCatalogIds.has(lot.catalogItemId)) return false;
        } else if (statusFilter === 'leftovers') {
          if (!lot.isLeftover && !lot.frozenOrCookedAt) return false;
        }

        if (q) {
          const matchLabel = normalizeText(lot.productLabel).includes(q);
          const matchCat = cat ? normalizeText(cat.name).includes(q) : false;
          const matchNotes = normalizeText(lot.notes).includes(q);
          if (!matchLabel && !matchCat && !matchNotes) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Expiring soonest first
        if (a.expiresAt && b.expiresAt) return a.expiresAt.localeCompare(b.expiresAt);
        if (a.expiresAt) return -1;
        if (b.expiresAt) return 1;
        return a.productLabel.localeCompare(b.productLabel, 'pt-PT');
      });
  }, [
    stockLots,
    selectedLocationId,
    selectedCategory,
    statusFilter,
    search,
    catalogById,
    expiryWarningDays,
    today,
    lowCatalogIds,
  ]);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 2600);
  };

  const adjustQuantity = async (lot: StockLot, delta: number) => {
    const current = lot.quantity ?? 0;
    const next = Math.max(0, Math.round((current + delta) * 100) / 100);
    const now = nowIso();
    if (next <= 0) {
      await db.stockLots.put({
        ...lot,
        quantity: 0,
        deletedAt: now,
        updatedAt: now,
        lastModifiedBy: deviceId,
      });
      showToast(`${lot.productLabel} marcado como terminado.`);
      return;
    }
    await db.stockLots.put({
      ...lot,
      quantity: next,
      updatedAt: now,
      lastModifiedBy: deviceId,
    });
  };

  const setQualitative = async (lot: StockLot, level: QualitativeLevel) => {
    await db.stockLots.put({
      ...lot,
      qualitativeLevel: level,
      updatedAt: nowIso(),
      lastModifiedBy: deviceId,
    });
  };

  const deleteLot = async (lot: StockLot) => {
    const now = nowIso();
    await db.stockLots.put({
      ...lot,
      deletedAt: now,
      updatedAt: now,
      lastModifiedBy: deviceId,
    });
  };

  const addCatalogToShopping = async (cat: CatalogItem) => {
    const alreadyQueued = shoppingItems.some(
      (s) => !s.checked && s.catalogItemId === cat.id,
    );
    if (alreadyQueued) {
      showToast(`${cat.name} já está na Lista de Compras.`);
      return;
    }
    const item = buildShoppingItem(
      {
        catalogItemId: cat.id,
        label: cat.name,
        quantity: cat.minStockQty && cat.trackingMode === 'exact' ? cat.minStockQty : 1,
        unit: cat.trackingMode === 'qualitative' ? 'un' : cat.defaultUnit,
        section: cat.supermarketSection,
        targetLocationId: cat.defaultLocationId,
        source: 'low_stock',
      },
      deviceId,
    );
    await db.shoppingItems.put(item);
    showToast(`${cat.name} adicionado à Lista de Compras.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Stock da Casa</h1>
          <p className="text-xs text-slate-500">
            {stockLots.length} registos ativos · {lowStockSummaries.length} abaixo do mínimo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCatalogModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <BookOpen className="h-4 w-4 text-teal-700" />
            Catálogo
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingLot(null);
              setLotModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </div>
      </div>

      {feedbackToast && (
        <div className="rounded-xl bg-teal-900 px-3.5 py-2 text-xs font-medium text-white shadow">
          {feedbackToast}
        </div>
      )}

      {/* Location pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedLocationId('all')}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            selectedLocationId === 'all'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Todos ({stockLots.length})
        </button>
        {locations.map((loc) => {
          const colors = LOCATION_COLOR_CLASSES[loc.colorToken];
          const count = locationCounts.get(loc.id) ?? 0;
          const active = selectedLocationId === loc.id;
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => setSelectedLocationId(loc.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? `${colors.badge} ring-2 ring-offset-1 ring-slate-300`
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
              {loc.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Search + Status + Category */}
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar produto, marca ou nota..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-600"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as CatalogCategory | 'all')}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
        >
          <option value="all">Todas as categorias</option>
          {Object.entries(CATALOG_CATEGORY_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['all', 'Todos'],
            ['expiring', 'A expirar / Expirados'],
            ['low', 'Stock baixo'],
            ['leftovers', 'Sobras / Congelados'],
          ] as [StatusFilter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              statusFilter === key
                ? 'bg-teal-100 text-teal-900'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Low stock items with zero active lots */}
      {statusFilter === 'low' &&
        lowStockSummaries.filter((s) => s.lots.length === 0).length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              Esgotados com stock mínimo definido
            </h3>
            <div className="flex flex-wrap gap-2">
              {lowStockSummaries
                .filter((s) => s.lots.length === 0)
                .map((s) => (
                  <button
                    key={s.catalogItem.id}
                    type="button"
                    onClick={() => addCatalogToShopping(s.catalogItem)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {s.catalogItem.name} (Mín: {s.catalogItem.minStockQty}{' '}
                    {s.catalogItem.trackingMode === 'exact' ? s.catalogItem.defaultUnit : ''})
                  </button>
                ))}
            </div>
          </div>
        )}

      {/* Lots list */}
      {filteredLots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            Nenhum item encontrado com estes filtros.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Clica em "Adicionar" para registar o que tens no frigorífico, congelador ou despensa.
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {filteredLots.map((lot) => {
            const cat = catalogById.get(lot.catalogItemId);
            const loc = locationsById.get(lot.locationId);
            const colors = LOCATION_COLOR_CLASSES[loc?.colorToken ?? 'slate'];
            const exp = getLotExpiryInfo(lot, expiryWarningDays, today);
            const step = getStepForUnit(lot.unit);
            const daysFrozenOrCooked = lot.frozenOrCookedAt
              ? daysBetweenDateStrings(lot.frozenOrCookedAt, today)
              : null;
            const isLow = lowCatalogIds.has(lot.catalogItemId);

            return (
              <div
                key={lot.id}
                className="flex flex-col justify-between gap-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${colors.badge}`}
                      >
                        {loc?.locationType === 'freezer' && <Snowflake className="h-3 w-3" />}
                        {loc?.name ?? 'Local'}
                      </span>
                      {lot.isLeftover && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-800">
                          Sobra
                        </span>
                      )}
                      {isLow && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          Stock baixo
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1.5 font-semibold text-slate-900">{lot.productLabel}</h3>
                    {cat && cat.name !== lot.productLabel && (
                      <p className="text-xs text-slate-500">Genérico: {cat.name}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {cat && (
                      <button
                        type="button"
                        onClick={() => addCatalogToShopping(cat)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                        title="Adicionar à Lista de Compras"
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLot(lot);
                        setLotModalOpen(true);
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteLot(lot)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Metadata badges */}
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {exp.status === 'expired' && (
                    <span className="rounded-lg bg-rose-100 px-2 py-0.5 font-semibold text-rose-800">
                      Expirou em {formatDatePt(lot.expiresAt)}
                    </span>
                  )}
                  {exp.status === 'expiring_soon' && (
                    <span className="rounded-lg bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                      Expira em{' '}
                      {exp.daysRemaining === 0 ? 'hoje' : `${exp.daysRemaining}d`} (
                      {formatDatePt(lot.expiresAt)})
                    </span>
                  )}
                  {exp.status === 'ok' && lot.expiresAt && (
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-slate-600">
                      Validade: {formatDatePt(lot.expiresAt)}
                    </span>
                  )}
                  {daysFrozenOrCooked !== null && (
                    <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-blue-700">
                      {loc?.locationType === 'freezer' ? 'Congelado' : 'Feito'} há{' '}
                      {daysFrozenOrCooked}d ({formatDatePt(lot.frozenOrCookedAt)})
                    </span>
                  )}
                  {lot.notes && <span className="text-slate-500">· {lot.notes}</span>}
                </div>

                {/* Quick +/- or qualitative toggle */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  {cat?.trackingMode === 'qualitative' ? (
                    <div className="flex w-full gap-1.5">
                      {(['full', 'low', 'empty'] as QualitativeLevel[]).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setQualitative(lot, lvl)}
                          className={`flex-1 rounded-lg py-1 text-xs font-semibold transition ${
                            lot.qualitativeLevel === lvl
                              ? lvl === 'empty'
                                ? 'bg-rose-600 text-white'
                                : lvl === 'low'
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-teal-700 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {QUALITATIVE_LABELS[lvl]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-bold text-slate-900">
                        {formatQuantity(lot.quantity, lot.unit)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => adjustQuantity(lot, -step)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          aria-label={`Diminuir ${lot.productLabel}`}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustQuantity(lot, step)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          aria-label={`Aumentar ${lot.productLabel}`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <StockLotModal
        open={lotModalOpen}
        onClose={() => setLotModalOpen(false)}
        editingLot={editingLot}
        catalogItems={catalogItems}
        locations={locations}
        deviceId={deviceId}
        initialLocationId={selectedLocationId !== 'all' ? selectedLocationId : undefined}
      />

      <CatalogManagerModal
        open={catalogModalOpen}
        onClose={() => setCatalogModalOpen(false)}
        catalogItems={catalogItems}
        locations={locations}
        deviceId={deviceId}
      />
    </div>
  );
}
