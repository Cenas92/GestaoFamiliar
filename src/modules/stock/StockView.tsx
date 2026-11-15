import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Snowflake,
  Trash2,
  X,
} from 'lucide-react';
import { CollectionToolbar } from '../../components/CollectionToolbar';
import {
  CATALOG_CATEGORY_LABELS,
  LOCATION_COLOR_CLASSES,
  QUALITATIVE_LABELS,
  SUPERMARKET_SECTION_LABELS,
} from '../../constants/labels';
import { db } from '../../db/database';
import { useCollectionViewPrefs } from '../../hooks/useCollectionViewPrefs';
import type {
  CatalogCategory,
  CatalogItem,
  QualitativeLevel,
  Recipe,
  ShoppingItem,
  StockLot,
  StorageLocation,
} from '../../types/domain';
import { nowIso } from '../../utils/id';
import {
  daysBetweenDateStrings,
  formatDatePt,
  formatQuantity,
  getStepForUnit,
  normalizeText,
  todayDateString,
} from '../../utils/units';
import { shouldExpandPanelsByDefault, type UiDensityMode } from '../../utils/viewPrefs';
import { buildShoppingItem } from '../planner/plannerService';
import { CatalogManagerModal } from './CatalogManagerModal';
import { StockLotModal } from './StockLotModal';
import {
  StockQuantityControls,
  StockQuickModal,
  StockStatusBadges,
} from './StockQuickModal';
import { getLotExpiryInfo, summarizeCatalogStock } from './stockService';
import {
  getStockTypeVisual,
  loadStockViewPreferences,
  saveStockViewPreferences,
  STOCK_SORT_OPTIONS,
  StockTypeBadge,
  type StockLotDisplayMeta,
  type StockViewPreferences,
} from './stockVisuals';

interface StockViewProps {
  locations: StorageLocation[];
  catalogItems: CatalogItem[];
  stockLots: StockLot[];
  shoppingItems: ShoppingItem[];
  recipes?: Recipe[];
  expiryWarningDays: number;
  deviceId: string;
  uiDensity?: UiDensityMode;
  openCreateInitially?: boolean;
  onConsumeCreateInitial?: () => void;
}

type StatusFilter = 'all' | 'expiring' | 'low' | 'leftovers';

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'Todos',
  expiring: 'A expirar / Expirados',
  low: 'Stock baixo',
  leftovers: 'Sobras / Congelados',
};

interface LocationGroup {
  id: string;
  name: string;
  location?: StorageLocation;
  items: StockLotDisplayMeta[];
}

function compareLotsByExpiryThenName(a: StockLot, b: StockLot): number {
  if (a.expiresAt && b.expiresAt) {
    const cmp = a.expiresAt.localeCompare(b.expiresAt);
    if (cmp !== 0) return cmp;
  } else if (a.expiresAt) {
    return -1;
  } else if (b.expiresAt) {
    return 1;
  }
  return a.productLabel.localeCompare(b.productLabel, 'pt-PT');
}

function CardLotItem({
  meta,
  detailed,
  onAdjustQuantity,
  onSetQualitative,
  onAddToShopping,
  onEdit,
  onDelete,
}: {
  meta: StockLotDisplayMeta;
  detailed: boolean;
  onAdjustQuantity: (lot: StockLot, delta: number) => void;
  onSetQualitative: (lot: StockLot, level: QualitativeLevel) => void;
  onAddToShopping: (cat: CatalogItem) => void;
  onEdit: (lot: StockLot) => void;
  onDelete: (lot: StockLot) => void;
}) {
  const {
    lot,
    catalogItem,
    location,
    visual,
    isLowStock,
    sourceRecipeTitle,
    daysFrozenOrCooked,
  } = meta;
  const colors = LOCATION_COLOR_CLASSES[location?.colorToken ?? 'slate'];
  const createdDate = lot.createdAt.slice(0, 10);
  const updatedDate = lot.updatedAt.slice(0, 10);

  return (
    <div
      className={`flex flex-col justify-between gap-2.5 rounded-2xl border border-slate-200 bg-white shadow-xs ${
        detailed ? 'p-4' : 'p-3.5'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <StockTypeBadge visual={visual} size={detailed ? 'md' : 'sm'} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${colors.badge}`}
              >
                {location?.locationType === 'freezer' && <Snowflake className="h-3 w-3" />}
                {location?.name ?? 'Local'}
              </span>
              {lot.isLeftover && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-800">
                  Sobra
                </span>
              )}
              {isLowStock && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  Stock baixo
                </span>
              )}
              {detailed && catalogItem && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {CATALOG_CATEGORY_LABELS[catalogItem.category]} ·{' '}
                  {SUPERMARKET_SECTION_LABELS[catalogItem.supermarketSection]}
                </span>
              )}
            </div>
            <h3 className="mt-1.5 font-semibold text-slate-900">{lot.productLabel}</h3>
            {detailed && catalogItem && catalogItem.name !== lot.productLabel && (
              <p className="text-xs text-slate-500">Genérico: {catalogItem.name}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {catalogItem && (
            <button
              type="button"
              onClick={() => onAddToShopping(catalogItem)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-teal-50 hover:text-teal-700"
              title="Adicionar à Lista de Compras"
              aria-label={`Adicionar ${lot.productLabel} à Lista de Compras`}
            >
              <ShoppingCart className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(lot)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Editar"
            aria-label={`Editar ${lot.productLabel}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(lot)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            title="Remover"
            aria-label={`Remover ${lot.productLabel}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Metadata badges */}
      {(detailed || lot.expiresAt || daysFrozenOrCooked !== null || lot.notes) && (
        <div className="space-y-1.5 text-xs">
          {(lot.expiresAt ||
            daysFrozenOrCooked !== null ||
            (detailed &&
              (Boolean(sourceRecipeTitle) ||
                (catalogItem !== undefined && catalogItem.minStockQty !== null)))) && (
            <div className="flex flex-wrap gap-1.5">
              <StockStatusBadges meta={meta} />
              {detailed && sourceRecipeTitle && (
                <span className="rounded-lg bg-purple-50 px-2 py-0.5 text-purple-800">
                  Receita: {sourceRecipeTitle}
                </span>
              )}
              {detailed && catalogItem && catalogItem.minStockQty !== null && (
                <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-slate-600">
                  Mín. catálogo: {catalogItem.minStockQty}{' '}
                  {catalogItem.trackingMode === 'exact' ? catalogItem.defaultUnit : ''}
                </span>
              )}
            </div>
          )}

          {lot.notes &&
            (detailed ? (
              <p className="whitespace-pre-wrap rounded-xl bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
                {lot.notes}
              </p>
            ) : (
              <p className="line-clamp-1 text-slate-500">{lot.notes}</p>
            ))}

          {detailed && (
            <p className="text-[11px] text-slate-400">
              Atualizado em {formatDatePt(lot.updatedAt)}
              {createdDate !== updatedDate ? ` · Criado em ${formatDatePt(lot.createdAt)}` : ''}
            </p>
          )}
        </div>
      )}

      {/* Quick +/- or qualitative toggle */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
        <StockQuantityControls
          meta={meta}
          onAdjustQuantity={onAdjustQuantity}
          onSetQualitative={onSetQualitative}
          variant="card"
        />
      </div>
    </div>
  );
}

function LineLotRow({
  meta,
  onOpenQuick,
  onAdjustQuantity,
  onSetQualitative,
}: {
  meta: StockLotDisplayMeta;
  onOpenQuick: (lotId: string) => void;
  onAdjustQuantity: (lot: StockLot, delta: number) => void;
  onSetQualitative: (lot: StockLot, level: QualitativeLevel) => void;
}) {
  const { lot, location, visual, expiry } = meta;
  const colors = LOCATION_COLOR_CLASSES[location?.colorToken ?? 'slate'];

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 transition hover:bg-slate-50/70">
      <button
        type="button"
        onClick={() => onOpenQuick(lot.id)}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        aria-label={`Abrir ações rápidas para ${lot.productLabel}`}
      >
        <StockTypeBadge visual={visual} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} />
            <span className="truncate text-sm font-semibold text-slate-900">
              {lot.productLabel}
            </span>
            {lot.isLeftover && (
              <span className="shrink-0 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800">
                Sobra
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
            <span className="truncate">{location?.name ?? 'Local'}</span>
            {expiry.status === 'expired' && (
              <span className="font-semibold text-rose-700">
                Expirou {formatDatePt(lot.expiresAt)}
              </span>
            )}
            {expiry.status === 'expiring_soon' && (
              <span className="font-semibold text-amber-700">
                Expira {expiry.daysRemaining === 0 ? 'hoje' : `em ${expiry.daysRemaining}d`}
              </span>
            )}
            {expiry.status === 'ok' && lot.expiresAt && (
              <span>Val: {formatDatePt(lot.expiresAt)}</span>
            )}
          </div>
        </div>
      </button>

      <StockQuantityControls
        meta={meta}
        onAdjustQuantity={onAdjustQuantity}
        onSetQualitative={onSetQualitative}
        variant="inline"
      />
    </div>
  );
}

function GridLotTile({
  meta,
  onOpenQuick,
}: {
  meta: StockLotDisplayMeta;
  onOpenQuick: (lotId: string) => void;
}) {
  const { lot, catalogItem, location, visual, expiry, isLowStock, quantityLabel } = meta;
  const colors = LOCATION_COLOR_CLASSES[location?.colorToken ?? 'slate'];

  const borderTone =
    expiry.status === 'expired'
      ? 'border-rose-300 bg-rose-50/40'
      : expiry.status === 'expiring_soon'
        ? 'border-amber-300 bg-amber-50/35'
        : 'border-slate-200 bg-white';

  const qualLevel = lot.qualitativeLevel ?? 'full';
  const quantityTone =
    catalogItem?.trackingMode === 'qualitative'
      ? qualLevel === 'empty'
        ? 'text-rose-700'
        : qualLevel === 'low'
          ? 'text-amber-700'
          : 'text-teal-700'
      : 'text-teal-800';

  return (
    <button
      type="button"
      onClick={() => onOpenQuick(lot.id)}
      aria-label={`${lot.productLabel}, ${quantityLabel}, ${location?.name ?? 'Local'}`}
      className={`flex min-h-[124px] flex-col justify-between rounded-2xl border p-2.5 text-center shadow-xs transition hover:border-teal-400 hover:shadow-sm ${borderTone}`}
    >
      <div className="flex w-full items-center justify-between gap-1">
        <span className="inline-flex items-center gap-1" title={location?.name ?? 'Local'}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} />
          {location?.locationType === 'freezer' && (
            <Snowflake className="h-3 w-3 text-blue-500" aria-hidden="true" />
          )}
        </span>

        {expiry.status === 'expired' ? (
          <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
            Exp.
          </span>
        ) : expiry.status === 'expiring_soon' ? (
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
            {expiry.daysRemaining === 0 ? 'Hoje' : `${expiry.daysRemaining}d`}
          </span>
        ) : isLowStock ? (
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
            Baixo
          </span>
        ) : (
          <span />
        )}
      </div>

      <div className="my-1.5 flex justify-center">
        <StockTypeBadge visual={visual} size="lg" />
      </div>

      <div className="w-full">
        <p className="line-clamp-2 min-h-[2rem] text-xs font-semibold leading-tight text-slate-900">
          {lot.productLabel}
        </p>
        <p className={`mt-1 truncate text-xs font-bold ${quantityTone}`}>
          {quantityLabel || '—'}
        </p>
      </div>
    </button>
  );
}

export function StockView({
  locations,
  catalogItems,
  stockLots,
  shoppingItems,
  recipes = [],
  expiryWarningDays,
  deviceId,
  uiDensity = 'clean',
  openCreateInitially = false,
  onConsumeCreateInitial,
}: StockViewProps) {
  const isComplete = uiDensity === 'complete';
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState<boolean>(() =>
    shouldExpandPanelsByDefault(uiDensity),
  );

  const [prefs, updatePrefs] = useCollectionViewPrefs<StockViewPreferences['sortMode']>(
    uiDensity,
    loadStockViewPreferences,
    saveStockViewPreferences,
    (nextDensity) => setFiltersOpen(shouldExpandPanelsByDefault(nextDensity)),
  );
  const [collapsedLocationIds, setCollapsedLocationIds] = useState<Set<string>>(() => new Set());

  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<StockLot | null>(null);
  const [quickLotId, setQuickLotId] = useState<string | null>(null);
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  useEffect(() => {
    if (openCreateInitially) {
      setEditingLot(null);
      setLotModalOpen(true);
      onConsumeCreateInitial?.();
    }
  }, [openCreateInitially, onConsumeCreateInitial]);

  const today = todayDateString();
  const catalogById = useMemo(
    () => new Map(catalogItems.map((c) => [c.id, c])),
    [catalogItems],
  );
  const locationsById = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations],
  );
  const recipesById = useMemo(
    () => new Map(recipes.map((r) => [r.id, r])),
    [recipes],
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

  const visibleLocations = useMemo(
    () =>
      isComplete
        ? locations
        : locations.filter(
            (loc) => (locationCounts.get(loc.id) ?? 0) > 0 || selectedLocationId === loc.id,
          ),
    [isComplete, locations, locationCounts, selectedLocationId],
  );

  const activeFiltersCount =
    (selectedCategory !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

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
        if (prefs.sortMode === 'name') {
          const nameCmp = a.productLabel.localeCompare(b.productLabel, 'pt-PT');
          return nameCmp !== 0 ? nameCmp : compareLotsByExpiryThenName(a, b);
        }
        if (prefs.sortMode === 'location') {
          const locA = locationsById.get(a.locationId);
          const locB = locationsById.get(b.locationId);
          const orderDiff = (locA?.sortOrder ?? 999) - (locB?.sortOrder ?? 999);
          if (orderDiff !== 0) return orderDiff;
          const locNameCmp = (locA?.name ?? '').localeCompare(locB?.name ?? '', 'pt-PT');
          if (locNameCmp !== 0) return locNameCmp;
        }
        return compareLotsByExpiryThenName(a, b);
      });
  }, [
    stockLots,
    selectedLocationId,
    selectedCategory,
    statusFilter,
    search,
    catalogById,
    locationsById,
    expiryWarningDays,
    today,
    lowCatalogIds,
    prefs.sortMode,
  ]);

  const lotMetas = useMemo<StockLotDisplayMeta[]>(() => {
    return filteredLots.map((lot) => {
      const catalogItem = catalogById.get(lot.catalogItemId);
      const location = locationsById.get(lot.locationId);
      const visual = getStockTypeVisual(lot, catalogItem);
      const expiry = getLotExpiryInfo(lot, expiryWarningDays, today);
      const step = getStepForUnit(lot.unit);
      const daysFrozenOrCooked = lot.frozenOrCookedAt
        ? daysBetweenDateStrings(lot.frozenOrCookedAt, today)
        : null;
      const isLowStock = lowCatalogIds.has(lot.catalogItemId);
      const sourceRecipeTitle = lot.sourceRecipeId
        ? recipesById.get(lot.sourceRecipeId)?.title ?? null
        : null;
      const quantityLabel =
        catalogItem?.trackingMode === 'qualitative'
          ? QUALITATIVE_LABELS[lot.qualitativeLevel ?? 'full']
          : formatQuantity(lot.quantity, lot.unit);

      return {
        lot,
        catalogItem,
        location,
        visual,
        expiry,
        step,
        daysFrozenOrCooked,
        isLowStock,
        sourceRecipeTitle,
        quantityLabel,
      };
    });
  }, [filteredLots, catalogById, locationsById, recipesById, expiryWarningDays, today, lowCatalogIds]);

  const metaById = useMemo(
    () => new Map(lotMetas.map((m) => [m.lot.id, m])),
    [lotMetas],
  );

  const groupedSections = useMemo<LocationGroup[]>(() => {
    if (!prefs.groupEnabled) return [];
    const byLoc = new Map<string, StockLotDisplayMeta[]>();
    for (const meta of lotMetas) {
      const key = locationsById.has(meta.lot.locationId) ? meta.lot.locationId : '__unassigned__';
      const bucket = byLoc.get(key);
      if (bucket) {
        bucket.push(meta);
      } else {
        byLoc.set(key, [meta]);
      }
    }

    const sortedLocations = [...locations].sort((a, b) => a.sortOrder - b.sortOrder);
    const groups: LocationGroup[] = [];
    for (const loc of sortedLocations) {
      const items = byLoc.get(loc.id);
      if (items && items.length > 0) {
        groups.push({ id: loc.id, name: loc.name, location: loc, items });
      }
    }
    const unassigned = byLoc.get('__unassigned__');
    if (unassigned && unassigned.length > 0) {
      groups.push({ id: '__unassigned__', name: 'Sem localização', items: unassigned });
    }
    return groups;
  }, [prefs.groupEnabled, lotMetas, locations, locationsById]);

  const activeQuickMeta = quickLotId ? (metaById.get(quickLotId) ?? null) : null;

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

  const openEditLot = (lot: StockLot) => {
    setEditingLot(lot);
    setLotModalOpen(true);
  };

  const toggleGroupCollapsed = (groupId: string) => {
    setCollapsedLocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const renderLotItems = (items: StockLotDisplayMeta[]) => {
    if (prefs.viewMode === 'grid') {
      return (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {items.map((meta) => (
            <GridLotTile key={meta.lot.id} meta={meta} onOpenQuick={setQuickLotId} />
          ))}
        </div>
      );
    }

    if (prefs.viewMode === 'line') {
      return (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          {items.map((meta) => (
            <LineLotRow
              key={meta.lot.id}
              meta={meta}
              onOpenQuick={setQuickLotId}
              onAdjustQuantity={adjustQuantity}
              onSetQualitative={setQualitative}
            />
          ))}
        </div>
      );
    }

    const isDetailed = prefs.viewMode === 'detailed';
    return (
      <div className={isDetailed ? 'grid gap-3 lg:grid-cols-2' : 'grid gap-2.5 sm:grid-cols-2'}>
        {items.map((meta) => (
          <CardLotItem
            key={meta.lot.id}
            meta={meta}
            detailed={isDetailed}
            onAdjustQuantity={adjustQuantity}
            onSetQualitative={setQualitative}
            onAddToShopping={addCatalogToShopping}
            onEdit={openEditLot}
            onDelete={deleteLot}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-2.5">
      {/* First row: scrollable location pills + primary actions (no duplicate heading) */}
      <div className="flex items-center justify-between gap-2">
        <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedLocationId('all')}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
              selectedLocationId === 'all'
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Todos ({stockLots.length})
          </button>
          {visibleLocations.map((loc) => {
            const colors = LOCATION_COLOR_CLASSES[loc.colorToken];
            const count = locationCounts.get(loc.id) ?? 0;
            const active = selectedLocationId === loc.id;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => setSelectedLocationId(loc.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                  active
                    ? `${colors.badge} ring-1 ring-slate-300`
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                {loc.name} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isComplete ? (
            <button
              type="button"
              onClick={() => setCatalogModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <BookOpen className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
              <span>Catálogo</span>
            </button>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreMenuOpen((open) => !open)}
                aria-expanded={moreMenuOpen}
                aria-label="Mais opções do stock"
                title="Mais opções"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border transition ${
                  moreMenuOpen
                    ? 'border-teal-300 bg-teal-50 text-teal-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>

              {moreMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMoreMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setCatalogModalOpen(true);
                      }}
                      className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <span className="inline-flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-teal-700" aria-hidden="true" />
                        Catálogo de produtos
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">
                        {catalogItems.length}
                      </span>
                    </button>
                    {lowStockSummaries.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          setStatusFilter('low');
                        }}
                        className="flex w-full items-center justify-between gap-2 border-t border-slate-100 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <span className="inline-flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                          Stock baixo
                        </span>
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          {lowStockSummaries.length}
                        </span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setEditingLot(null);
              setLotModalOpen(true);
            }}
            className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-800 sm:px-3"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </button>
        </div>
      </div>

      {/* Quick status chips directly visible in Complete mode (pre-1.2.0 layout) */}
      {isComplete && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {(Object.entries(STATUS_FILTER_LABELS) as [StatusFilter, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  statusFilter === key
                    ? 'bg-teal-100 text-teal-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
                {key === 'low' && lowStockSummaries.length > 0
                  ? ` (${lowStockSummaries.length})`
                  : ''}
              </button>
            ),
          )}
        </div>
      )}

      {feedbackToast && (
        <div className="rounded-xl bg-teal-900 px-3 py-1.5 text-xs font-medium text-white shadow">
          {feedbackToast}
        </div>
      )}

      {/* Search + Collapsible Filters toggle */}
      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar produto ou nota..."
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs sm:text-sm outline-none focus:border-teal-600"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpar pesquisa"
              className="absolute right-2 top-1.5 rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${
            filtersOpen || activeFiltersCount > 0
              ? 'border-teal-300 bg-teal-50 text-teal-900'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Filtros e vista</span>
          {activeFiltersCount > 0 && (
            <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-teal-700 px-1 text-[10px] font-bold text-white">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Active filter quick-clear chips when panel is collapsed */}
      {!filtersOpen && activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedCategory !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-semibold text-teal-900 hover:bg-teal-200"
              aria-label={`Remover filtro ${CATALOG_CATEGORY_LABELS[selectedCategory]}`}
            >
              <span>{CATALOG_CATEGORY_LABELS[selectedCategory]}</span>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
          {statusFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-semibold text-teal-900 hover:bg-teal-200"
              aria-label={`Remover filtro ${STATUS_FILTER_LABELS[statusFilter]}`}
            >
              <span>{STATUS_FILTER_LABELS[statusFilter]}</span>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Collapsible Filters & View options panel (open on PC, collapsed on mobile) */}
      {filtersOpen && (
        <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xs">
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as CatalogCategory | 'all')}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-teal-600"
              aria-label="Filtrar por categoria"
            >
              <option value="all">Categoria: Todas</option>
              {Object.entries(CATALOG_CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-teal-600"
              aria-label="Filtrar por estado"
            >
              <option value="all">Estado: Todos</option>
              <option value="expiring">A expirar / Expirados</option>
              <option value="low">Stock baixo</option>
              <option value="leftovers">Sobras / Congelados</option>
            </select>
          </div>

          <CollectionToolbar
            viewMode={prefs.viewMode}
            onChangeViewMode={(viewMode) => updatePrefs({ viewMode })}
            sortMode={prefs.sortMode}
            sortOptions={STOCK_SORT_OPTIONS}
            sortAriaLabel="Ordenar stock"
            onChangeSortMode={(sortMode) => updatePrefs({ sortMode })}
            groupActive={prefs.groupEnabled}
            groupTitle="Agrupar por localização"
            onToggleGroup={() => updatePrefs({ groupEnabled: !prefs.groupEnabled })}
          />
        </div>
      )}

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
      {lotMetas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            Nenhum item encontrado com estes filtros.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Clica em "Adicionar" para registar o que tens no frigorífico, congelador ou despensa.
          </p>
        </div>
      ) : prefs.groupEnabled ? (
        <div className="space-y-4">
          {groupedSections.map((group) => {
            const colors = LOCATION_COLOR_CLASSES[group.location?.colorToken ?? 'slate'];
            const collapsed = collapsedLocationIds.has(group.id);
            return (
              <section key={group.id} className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggleGroupCollapsed(group.id)}
                  aria-expanded={!collapsed}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-xs transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                    {group.location?.locationType === 'freezer' && (
                      <Snowflake className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
                    )}
                    <span className="text-sm font-bold text-slate-900">{group.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {group.items.length}
                    </span>
                  </span>
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  )}
                </button>
                {!collapsed && renderLotItems(group.items)}
              </section>
            );
          })}
        </div>
      ) : (
        renderLotItems(lotMetas)
      )}

      <StockQuickModal
        open={activeQuickMeta !== null}
        onClose={() => setQuickLotId(null)}
        meta={activeQuickMeta}
        onAdjustQuantity={adjustQuantity}
        onSetQualitative={setQualitative}
        onAddToShopping={addCatalogToShopping}
        onEdit={openEditLot}
        onDelete={deleteLot}
      />

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
