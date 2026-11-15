import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Minus,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { CatalogPicker } from '../../components/CatalogPicker';
import { CollectionToolbar } from '../../components/CollectionToolbar';
import { Modal } from '../../components/Modal';
import { TypeIconBadge } from '../../components/TypeIconBadge';
import {
  SUPERMARKET_SECTION_LABELS,
  SUPERMARKET_SECTION_ORDER,
  UNITS,
} from '../../constants/labels';
import { db } from '../../db/database';
import type {
  CatalogItem,
  ShoppingItem,
  StockLot,
  StorageLocation,
  SupermarketSection,
  Unit,
} from '../../types/domain';
import { nowIso } from '../../utils/id';
import { getSupermarketSectionVisual } from '../../utils/sectionVisuals';
import {
  formatQuantity,
  getStepForUnit,
  normalizeText,
  todayDateString,
} from '../../utils/units';
import { buildShoppingItem } from '../planner/plannerService';
import { buildNewStockLot, summarizeCatalogStock } from '../stock/stockService';
import { ShoppingQuickModal } from './ShoppingQuickModal';
import {
  getShoppingItemVisual,
  loadShoppingViewPreferences,
  saveShoppingViewPreferences,
  SHOPPING_SORT_OPTIONS,
  SHOPPING_SOURCE_LABELS,
  type ShoppingItemDisplayMeta,
  type ShoppingSortMode,
  type ShoppingViewPreferences,
} from './shoppingVisuals';

interface ShoppingViewProps {
  shoppingItems: ShoppingItem[];
  catalogItems: CatalogItem[];
  stockLots: StockLot[];
  locations: StorageLocation[];
  expiryWarningDays: number;
  deviceId: string;
}

interface PutAwayRow {
  shoppingItem: ShoppingItem;
  locationId: string;
  quantity: number;
  unit: Unit;
  expiresAt: string;
  include: boolean;
}

type ShoppingStatusFilter = 'all' | 'unchecked' | 'checked';

const STATUS_LABELS: Record<ShoppingStatusFilter, string> = {
  all: 'Todos',
  unchecked: 'Por comprar',
  checked: 'No carrinho',
};

const SECTION_RANK = new Map<SupermarketSection, number>(
  SUPERMARKET_SECTION_ORDER.map((sec, idx) => [sec, idx]),
);

function isWideViewport(): boolean {
  return typeof window !== 'undefined' ? window.innerWidth >= 640 : true;
}

function sortShoppingMetas(
  items: ShoppingItemDisplayMeta[],
  sortMode: ShoppingSortMode,
): ShoppingItemDisplayMeta[] {
  return [...items].sort((a, b) => {
    if (sortMode === 'name') {
      const nameCmp = a.item.label.localeCompare(b.item.label, 'pt-PT');
      return nameCmp !== 0 ? nameCmp : Number(a.item.checked) - Number(b.item.checked);
    }
    if (sortMode === 'unchecked_first') {
      const checkDiff = Number(a.item.checked) - Number(b.item.checked);
      if (checkDiff !== 0) return checkDiff;
    } else {
      const secDiff =
        (SECTION_RANK.get(a.item.section) ?? 99) - (SECTION_RANK.get(b.item.section) ?? 99);
      if (secDiff !== 0) return secDiff;
      const checkDiff = Number(a.item.checked) - Number(b.item.checked);
      if (checkDiff !== 0) return checkDiff;
    }
    return a.item.label.localeCompare(b.item.label, 'pt-PT');
  });
}

function ShoppingCardItem({
  meta,
  detailed,
  groupedBySection,
  onToggleChecked,
  onAdjustQuantity,
  onOpenQuick,
  onDelete,
}: {
  meta: ShoppingItemDisplayMeta;
  detailed: boolean;
  groupedBySection: boolean;
  onToggleChecked: (item: ShoppingItem) => void;
  onAdjustQuantity: (item: ShoppingItem, delta: number) => void;
  onOpenQuick: (itemId: string) => void;
  onDelete: (item: ShoppingItem) => void;
}) {
  const { item, visual, targetLocation, sectionLabel, sourceLabel, quantityLabel, step } = meta;

  return (
    <div
      className={`flex flex-col justify-between gap-2 rounded-2xl border border-slate-200 shadow-xs transition ${
        item.checked ? 'bg-slate-50/70' : 'bg-white'
      } ${detailed ? 'p-3.5' : 'p-3'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <button
            type="button"
            onClick={() => onToggleChecked(item)}
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition ${
              item.checked
                ? 'border-teal-700 bg-teal-700 text-white'
                : 'border-slate-300 bg-white hover:border-teal-500'
            }`}
            aria-label={`Marcar ${item.label}`}
          >
            {item.checked && <Check className="h-4 w-4" />}
          </button>

          <TypeIconBadge visual={visual} size={detailed ? 'md' : 'sm'} />

          <div
            onClick={() => onToggleChecked(item)}
            className="min-w-0 flex-1 cursor-pointer"
          >
            <p
              className={`text-sm font-semibold ${
                item.checked ? 'text-slate-400 line-through' : 'text-slate-900'
              }`}
            >
              {item.label}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
              {(!groupedBySection || detailed) && (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                  {sectionLabel}
                </span>
              )}
              {detailed && (
                <>
                  <span className="rounded-md bg-teal-50 px-1.5 py-0.5 font-medium text-teal-800">
                    Origem: {sourceLabel}
                  </span>
                  {targetLocation && (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600">
                      Arrumar: {targetLocation.name}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onOpenQuick(item.id)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Editar"
            aria-label={`Opções de ${item.label}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            title="Remover"
            aria-label={`Remover ${item.label}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {item.notes &&
        (detailed ? (
          <p className="whitespace-pre-wrap rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
            {item.notes}
          </p>
        ) : (
          <p className="line-clamp-1 pl-8 text-xs text-slate-500">{item.notes}</p>
        ))}

      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
        <span className="text-xs font-bold text-slate-800">{quantityLabel || '1 un'}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAdjustQuantity(item, -step)}
            aria-label={`Diminuir ${item.label}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onAdjustQuantity(item, step)}
            aria-label={`Aumentar ${item.label}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ShoppingLineRow({
  meta,
  groupedBySection,
  onToggleChecked,
  onOpenQuick,
}: {
  meta: ShoppingItemDisplayMeta;
  groupedBySection: boolean;
  onToggleChecked: (item: ShoppingItem) => void;
  onOpenQuick: (itemId: string) => void;
}) {
  const { item, visual, sectionLabel, quantityLabel } = meta;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 transition ${
        item.checked ? 'bg-slate-50/70' : 'bg-white'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggleChecked(item)}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition ${
          item.checked
            ? 'border-teal-700 bg-teal-700 text-white'
            : 'border-slate-300 bg-white hover:border-teal-500'
        }`}
        aria-label={`Marcar ${item.label}`}
      >
        {item.checked && <Check className="h-3.5 w-3.5" />}
      </button>

      <TypeIconBadge visual={visual} size="sm" />

      <button
        type="button"
        onClick={() => onToggleChecked(item)}
        className="min-w-0 flex-1 text-left"
      >
        <p
          className={`truncate text-sm font-medium ${
            item.checked ? 'text-slate-400 line-through' : 'text-slate-900'
          }`}
        >
          {item.label}
        </p>
        {(!groupedBySection || item.notes) && (
          <p className="truncate text-[11px] text-slate-500">
            {!groupedBySection ? sectionLabel : ''}
            {!groupedBySection && item.notes ? ' · ' : ''}
            {item.notes}
          </p>
        )}
      </button>

      <span className="shrink-0 text-xs font-semibold text-slate-600">
        {quantityLabel}
      </span>

      <button
        type="button"
        onClick={() => onOpenQuick(item.id)}
        aria-label={`Opções de ${item.label}`}
        title="Opções e editar"
        className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}

function ShoppingGridTile({
  meta,
  onToggleChecked,
  onOpenQuick,
}: {
  meta: ShoppingItemDisplayMeta;
  onToggleChecked: (item: ShoppingItem) => void;
  onOpenQuick: (itemId: string) => void;
}) {
  const { item, visual, quantityLabel } = meta;

  return (
    <div
      className={`relative flex min-h-[120px] flex-col rounded-2xl border shadow-xs transition ${
        item.checked
          ? 'border-teal-200 bg-teal-50/40'
          : 'border-slate-200 bg-white hover:border-teal-400 hover:shadow-sm'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggleChecked(item)}
        aria-pressed={item.checked}
        aria-label={`${item.checked ? 'Desmarcar' : 'Marcar'} ${item.label}, ${quantityLabel || '1 un'}`}
        className="flex flex-1 flex-col justify-between p-2.5 text-center"
      >
        <div className="flex w-full items-center justify-between">
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${
              item.checked
                ? 'border-teal-700 bg-teal-700 text-white'
                : 'border-slate-300 bg-white'
            }`}
          >
            {item.checked && <Check className="h-3 w-3" aria-hidden="true" />}
          </span>
        </div>

        <div className={`my-1 flex justify-center ${item.checked ? 'opacity-55' : ''}`}>
          <TypeIconBadge visual={visual} size="lg" />
        </div>

        <div className="w-full">
          <p
            className={`line-clamp-2 min-h-[2rem] text-xs font-semibold leading-tight ${
              item.checked ? 'text-slate-400 line-through' : 'text-slate-900'
            }`}
          >
            {item.label}
          </p>
          <p
            className={`mt-1 truncate text-xs font-bold ${
              item.checked ? 'text-slate-400' : 'text-teal-800'
            }`}
          >
            {quantityLabel || '1 un'}
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onOpenQuick(item.id)}
        aria-label={`Opções de ${item.label}`}
        title="Opções e editar"
        className="absolute right-1.5 top-1.5 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ShoppingView({
  shoppingItems,
  catalogItems,
  stockLots,
  locations,
  expiryWarningDays,
  deviceId,
}: ShoppingViewProps) {
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogItem | null>(null);
  const [freeText, setFreeText] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState<Unit>('un');
  const [section, setSection] = useState<SupermarketSection>('pantry');
  const [showCatalogInput, setShowCatalogInput] = useState(true);

  const [addFormOpen, setAddFormOpen] = useState<boolean>(isWideViewport);
  const [filtersOpen, setFiltersOpen] = useState<boolean>(isWideViewport);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShoppingStatusFilter>('all');
  const [sectionFilter, setSectionFilter] = useState<SupermarketSection | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<ShoppingItem['source'] | 'all'>('all');

  const [prefs, setPrefs] = useState<ShoppingViewPreferences>(() => loadShoppingViewPreferences());
  const [collapsedSections, setCollapsedSections] = useState<Set<SupermarketSection>>(
    () => new Set(),
  );
  const [quickItemId, setQuickItemId] = useState<string | null>(null);

  const [putAwayOpen, setPutAwayOpen] = useState(false);
  const [putAwayRows, setPutAwayRows] = useState<PutAwayRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const updatePrefs = (patch: Partial<ShoppingViewPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveShoppingViewPreferences(next);
      return next;
    });
  };

  const today = todayDateString();
  const catalogById = useMemo(
    () => new Map(catalogItems.map((c) => [c.id, c])),
    [catalogItems],
  );
  const locationsById = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations],
  );

  const lowStockMissing = useMemo(() => {
    const queuedIds = new Set(
      shoppingItems.filter((s) => !s.checked && s.catalogItemId).map((s) => s.catalogItemId!),
    );
    return catalogItems
      .map((cat) => summarizeCatalogStock(cat, stockLots, expiryWarningDays, today))
      .filter((s) => s.isLowStock && !queuedIds.has(s.catalogItem.id));
  }, [catalogItems, stockLots, shoppingItems, expiryWarningDays, today]);

  const checkedItems = useMemo(
    () => shoppingItems.filter((s) => s.checked),
    [shoppingItems],
  );
  const uncheckedCount = shoppingItems.length - checkedItems.length;

  const availableSections = useMemo(() => {
    const present = new Set(shoppingItems.map((i) => i.section));
    if (sectionFilter !== 'all') present.add(sectionFilter);
    return SUPERMARKET_SECTION_ORDER.filter((s) => present.has(s));
  }, [shoppingItems, sectionFilter]);

  const availableSources = useMemo(() => {
    const present = new Set(shoppingItems.map((i) => i.source));
    if (sourceFilter !== 'all') present.add(sourceFilter);
    return (Object.keys(SHOPPING_SOURCE_LABELS) as ShoppingItem['source'][]).filter((s) =>
      present.has(s),
    );
  }, [shoppingItems, sourceFilter]);

  const filteredMetas = useMemo<ShoppingItemDisplayMeta[]>(() => {
    const q = normalizeText(search);
    const filtered = shoppingItems.filter((item) => {
      if (statusFilter === 'unchecked' && item.checked) return false;
      if (statusFilter === 'checked' && !item.checked) return false;
      if (sectionFilter !== 'all' && item.section !== sectionFilter) return false;
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
      if (q) {
        const hitLabel = normalizeText(item.label).includes(q);
        const hitNotes = normalizeText(item.notes).includes(q);
        if (!hitLabel && !hitNotes) return false;
      }
      return true;
    });

    const metas: ShoppingItemDisplayMeta[] = filtered.map((item) => ({
      item,
      visual: getShoppingItemVisual(item),
      targetLocation: item.targetLocationId ? locationsById.get(item.targetLocationId) : undefined,
      sectionLabel: SUPERMARKET_SECTION_LABELS[item.section],
      sourceLabel: SHOPPING_SOURCE_LABELS[item.source],
      quantityLabel: formatQuantity(item.quantity, item.unit),
      step: getStepForUnit(item.unit),
    }));

    return sortShoppingMetas(metas, prefs.sortMode);
  }, [
    shoppingItems,
    statusFilter,
    sectionFilter,
    sourceFilter,
    search,
    locationsById,
    prefs.sortMode,
  ]);

  const metaById = useMemo(
    () => new Map(filteredMetas.map((m) => [m.item.id, m])),
    [filteredMetas],
  );
  const activeQuickMeta = quickItemId ? (metaById.get(quickItemId) ?? null) : null;

  const groupedBySection = useMemo(() => {
    if (!prefs.groupEnabled) return [];
    const bySec = new Map<SupermarketSection, ShoppingItemDisplayMeta[]>();
    for (const meta of filteredMetas) {
      const bucket = bySec.get(meta.item.section);
      if (bucket) {
        bucket.push(meta);
      } else {
        bySec.set(meta.item.section, [meta]);
      }
    }

    return SUPERMARKET_SECTION_ORDER.map((sec) => ({
      section: sec,
      label: SUPERMARKET_SECTION_LABELS[sec],
      visual: getSupermarketSectionVisual(sec),
      items: bySec.get(sec) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [prefs.groupEnabled, filteredMetas]);

  const activeFiltersCount =
    (sectionFilter !== 'all' ? 1 : 0) + (sourceFilter !== 'all' ? 1 : 0);

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = selectedCatalog ? selectedCatalog.name : freeText.trim();
    if (!label) return;

    const item = buildShoppingItem(
      {
        catalogItemId: selectedCatalog?.id ?? null,
        label,
        quantity: Number(qty.replace(',', '.')) || 1,
        unit,
        section: selectedCatalog ? selectedCatalog.supermarketSection : section,
        targetLocationId: selectedCatalog?.defaultLocationId ?? locations[0]?.id ?? null,
        source: 'manual',
      },
      deviceId,
    );
    await db.shoppingItems.put(item);
    setSelectedCatalog(null);
    setFreeText('');
    setQty('1');
  };

  const handleImportLowStock = async () => {
    if (lowStockMissing.length === 0) return;
    const items = lowStockMissing.map((s) =>
      buildShoppingItem(
        {
          catalogItemId: s.catalogItem.id,
          label: s.catalogItem.name,
          quantity:
            s.catalogItem.minStockQty && s.catalogItem.trackingMode === 'exact'
              ? Math.max(1, s.catalogItem.minStockQty - s.totalExactInDefaultUnit)
              : 1,
          unit:
            s.catalogItem.trackingMode === 'qualitative'
              ? 'un'
              : s.catalogItem.defaultUnit,
          section: s.catalogItem.supermarketSection,
          targetLocationId: s.catalogItem.defaultLocationId,
          source: 'low_stock',
        },
        deviceId,
      ),
    );
    await db.shoppingItems.bulkPut(items);
    showNotice(`${items.length} item(ns) com stock baixo adicionado(s).`);
  };

  const toggleChecked = async (item: ShoppingItem) => {
    await db.shoppingItems.put({
      ...item,
      checked: !item.checked,
      updatedAt: nowIso(),
      lastModifiedBy: deviceId,
    });
  };

  const adjustQuantity = async (item: ShoppingItem, delta: number) => {
    const current = item.quantity ?? 1;
    const next = Math.max(0.1, Math.round((current + delta) * 100) / 100);
    await db.shoppingItems.put({
      ...item,
      quantity: next,
      updatedAt: nowIso(),
      lastModifiedBy: deviceId,
    });
  };

  const saveQuickEdit = async (
    item: ShoppingItem,
    patch: Pick<
      ShoppingItem,
      'label' | 'quantity' | 'unit' | 'section' | 'targetLocationId' | 'notes'
    >,
  ) => {
    await db.shoppingItems.put({
      ...item,
      ...patch,
      updatedAt: nowIso(),
      lastModifiedBy: deviceId,
    });
  };

  const deleteItem = async (item: ShoppingItem) => {
    const now = nowIso();
    await db.shoppingItems.put({
      ...item,
      deletedAt: now,
      updatedAt: now,
      lastModifiedBy: deviceId,
    });
  };

  const toggleSectionCollapsed = (sec: SupermarketSection) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sec)) {
        next.delete(sec);
      } else {
        next.add(sec);
      }
      return next;
    });
  };

  const openPutAwayModal = () => {
    const rows: PutAwayRow[] = checkedItems.map((item) => {
      const cat = item.catalogItemId ? catalogById.get(item.catalogItemId) : undefined;
      return {
        shoppingItem: item,
        locationId: item.targetLocationId || cat?.defaultLocationId || locations[0]?.id || '',
        quantity: item.quantity ?? 1,
        unit: item.unit ?? cat?.defaultUnit ?? 'un',
        expiresAt: '',
        include: Boolean(item.catalogItemId),
      };
    });
    setPutAwayRows(rows);
    setPutAwayOpen(true);
  };

  const handleConfirmPutAway = async () => {
    const now = nowIso();
    const lotsToCreate: StockLot[] = [];
    const itemsToDelete: ShoppingItem[] = [];

    for (const row of putAwayRows) {
      itemsToDelete.push({
        ...row.shoppingItem,
        deletedAt: now,
        updatedAt: now,
        lastModifiedBy: deviceId,
      });

      if (!row.include || !row.locationId) continue;
      const cat = row.shoppingItem.catalogItemId
        ? catalogById.get(row.shoppingItem.catalogItemId)
        : undefined;
      if (!cat) continue;

      lotsToCreate.push(
        buildNewStockLot(
          {
            catalogItemId: cat.id,
            productLabel: row.shoppingItem.label,
            locationId: row.locationId,
            quantity: cat.trackingMode === 'qualitative' ? null : row.quantity,
            unit: cat.trackingMode === 'qualitative' ? null : row.unit,
            qualitativeLevel: cat.trackingMode === 'qualitative' ? 'full' : null,
            expiresAt: row.expiresAt || null,
          },
          deviceId,
        ),
      );
    }

    await db.transaction('rw', [db.stockLots, db.shoppingItems], async () => {
      if (lotsToCreate.length) await db.stockLots.bulkPut(lotsToCreate);
      if (itemsToDelete.length) await db.shoppingItems.bulkPut(itemsToDelete);
    });

    setPutAwayOpen(false);
    showNotice(`${lotsToCreate.length} produto(s) arrumado(s) no stock!`);
  };

  const renderShoppingItems = (items: ShoppingItemDisplayMeta[]) => {
    if (prefs.viewMode === 'grid') {
      return (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {items.map((meta) => (
            <ShoppingGridTile
              key={meta.item.id}
              meta={meta}
              onToggleChecked={toggleChecked}
              onOpenQuick={setQuickItemId}
            />
          ))}
        </div>
      );
    }

    if (prefs.viewMode === 'line') {
      return (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          {items.map((meta) => (
            <ShoppingLineRow
              key={meta.item.id}
              meta={meta}
              groupedBySection={prefs.groupEnabled}
              onToggleChecked={toggleChecked}
              onOpenQuick={setQuickItemId}
            />
          ))}
        </div>
      );
    }

    const isDetailed = prefs.viewMode === 'detailed';
    return (
      <div className={isDetailed ? 'grid gap-3 lg:grid-cols-2' : 'grid gap-2.5 sm:grid-cols-2'}>
        {items.map((meta) => (
          <ShoppingCardItem
            key={meta.item.id}
            meta={meta}
            detailed={isDetailed}
            groupedBySection={prefs.groupEnabled}
            onToggleChecked={toggleChecked}
            onAdjustQuantity={adjustQuantity}
            onOpenQuick={setQuickItemId}
            onDelete={deleteItem}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-2.5">
      {/* First row: status strip + Arrumar / Adicionar controls (no duplicate heading) */}
      <div className="flex items-center justify-between gap-2">
        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
              statusFilter === 'all'
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Todos ({shoppingItems.length})
          </button>
          {(uncheckedCount > 0 || statusFilter === 'unchecked') && (
            <button
              type="button"
              onClick={() => setStatusFilter('unchecked')}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                statusFilter === 'unchecked'
                  ? 'border-teal-700 bg-teal-700 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Por comprar ({uncheckedCount})
            </button>
          )}
          {(checkedItems.length > 0 || statusFilter === 'checked') && (
            <button
              type="button"
              onClick={() => setStatusFilter('checked')}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                statusFilter === 'checked'
                  ? 'border-teal-700 bg-teal-700 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              No carrinho ({checkedItems.length})
            </button>
          )}
          {lowStockMissing.length > 0 && (
            <button
              type="button"
              onClick={handleImportLowStock}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Repor em falta ({lowStockMissing.length})
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {checkedItems.length > 0 && (
            <button
              type="button"
              onClick={openPutAwayModal}
              className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-800 sm:px-3"
            >
              <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Arrumar ({checkedItems.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setAddFormOpen((open) => !open)}
            aria-expanded={addFormOpen}
            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
              addFormOpen
                ? 'border-teal-300 bg-teal-50 text-teal-900'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Plus className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
            Adicionar
          </button>
        </div>
      </div>

      {toast && (
        <div className="rounded-xl bg-teal-900 px-3 py-1.5 text-xs font-medium text-white shadow">
          {toast}
        </div>
      )}

      {/* Collapsible Quick Add form (collapsed on mobile by default, open on PC) */}
      {addFormOpen && (
        <form
          onSubmit={handleAdd}
          className="space-y-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Adicionar à lista
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCatalogInput(!showCatalogInput);
                  setSelectedCatalog(null);
                }}
                className="text-xs font-medium text-teal-700 hover:underline"
              >
                {showCatalogInput ? 'Escrever texto livre' : 'Usar catálogo'}
              </button>
              <button
                type="button"
                onClick={() => setAddFormOpen(false)}
                aria-label="Recolher formulário de adição"
                className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 sm:hidden"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {showCatalogInput ? (
            <CatalogPicker
              key={selectedCatalog?.id ?? 'empty'}
              catalogItems={catalogItems}
              locations={locations}
              deviceId={deviceId}
              selectedId={selectedCatalog?.id ?? null}
              onSelect={(cat) => {
                setSelectedCatalog(cat);
                setUnit(cat.trackingMode === 'qualitative' ? 'un' : cat.defaultUnit);
                setSection(cat.supermarketSection);
              }}
              placeholder="Procurar produto para comprar..."
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Ex: Pilhas AA, Guardanapos..."
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-teal-600"
              />
              <select
                value={section}
                onChange={(e) => setSection(e.target.value as SupermarketSection)}
                aria-label="Secção do item"
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-teal-600"
              >
                {SUPERMARKET_SECTION_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {SUPERMARKET_SECTION_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              aria-label="Quantidade a adicionar"
              className="w-20 rounded-xl border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-teal-600"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
              aria-label="Unidade a adicionar"
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-teal-600"
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.value === 'tbsp' ? 'c. sopa' : u.value === 'tsp' ? 'c. chá' : u.value}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="ml-auto inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 sm:text-sm"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Guardar na lista
            </button>
          </div>
        </form>
      )}

      {/* Search + Collapsible Filters toggle */}
      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar item ou nota..."
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs sm:text-sm outline-none focus:border-teal-600"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpar pesquisa"
              className="absolute right-2 top-1.5 rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
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

      {/* Quick-clear chips when panel is collapsed and filters are active */}
      {!filtersOpen && activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {sectionFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setSectionFilter('all')}
              className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-semibold text-teal-900 hover:bg-teal-200"
              aria-label={`Remover filtro ${SUPERMARKET_SECTION_LABELS[sectionFilter]}`}
            >
              <span>{SUPERMARKET_SECTION_LABELS[sectionFilter]}</span>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
          {sourceFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setSourceFilter('all')}
              className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-semibold text-teal-900 hover:bg-teal-200"
              aria-label={`Remover filtro ${SHOPPING_SOURCE_LABELS[sourceFilter]}`}
            >
              <span>Origem: {SHOPPING_SOURCE_LABELS[sourceFilter]}</span>
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
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value as SupermarketSection | 'all')}
              aria-label="Filtrar por secção"
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-teal-600"
            >
              <option value="all">Secção: Todas</option>
              {availableSections.map((s) => (
                <option key={s} value={s}>
                  {SUPERMARKET_SECTION_LABELS[s]}
                </option>
              ))}
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as ShoppingItem['source'] | 'all')}
              aria-label="Filtrar por origem"
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-teal-600"
            >
              <option value="all">Origem: Todas</option>
              {availableSources.map((src) => (
                <option key={src} value={src}>
                  {SHOPPING_SOURCE_LABELS[src]}
                </option>
              ))}
            </select>
          </div>

          <CollectionToolbar
            viewMode={prefs.viewMode}
            onChangeViewMode={(viewMode) => updatePrefs({ viewMode })}
            sortMode={prefs.sortMode}
            sortOptions={SHOPPING_SORT_OPTIONS}
            sortAriaLabel="Ordenar compras"
            onChangeSortMode={(sortMode) => updatePrefs({ sortMode })}
            groupActive={prefs.groupEnabled}
            groupTitle="Agrupar por secção de supermercado"
            onToggleGroup={() => updatePrefs({ groupEnabled: !prefs.groupEnabled })}
          />
        </div>
      )}

      {/* Shopping list / sections */}
      {shoppingItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <ShoppingBag className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">Lista de compras vazia.</p>
          <p className="mt-1 text-xs text-slate-500">
            Toca em "Adicionar" para registar produtos ou envia ingredientes da ementa.
          </p>
        </div>
      ) : filteredMetas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            Nenhum item encontrado em "{STATUS_LABELS[statusFilter]}".
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Ajusta a pesquisa ou os filtros para ver outros artigos da lista.
          </p>
        </div>
      ) : prefs.groupEnabled ? (
        <div className="space-y-3">
          {groupedBySection.map((group) => {
            const collapsed = collapsedSections.has(group.section);
            const remaining = group.items.filter((m) => !m.item.checked).length;
            const { Icon } = group.visual;
            return (
              <section key={group.section} className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggleSectionCollapsed(group.section)}
                  aria-expanded={!collapsed}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-xs transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${group.visual.bgClass} ${group.visual.textClass}`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-bold text-slate-900">{group.label}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {remaining > 0 ? `${remaining} por comprar` : `${group.items.length} feito`}
                    </span>
                  </span>
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  )}
                </button>
                {!collapsed && renderShoppingItems(group.items)}
              </section>
            );
          })}
        </div>
      ) : (
        renderShoppingItems(filteredMetas)
      )}

      <ShoppingQuickModal
        open={activeQuickMeta !== null}
        onClose={() => setQuickItemId(null)}
        meta={activeQuickMeta}
        locations={locations}
        onToggleChecked={toggleChecked}
        onSaveItem={saveQuickEdit}
        onDeleteItem={deleteItem}
      />

      {/* Put Away Modal */}
      <Modal
        open={putAwayOpen}
        onClose={() => setPutAwayOpen(false)}
        title="Arrumar compras no Stock"
        subtitle="Os itens marcados serão removidos da lista e adicionados ao stock"
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-3">
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {putAwayRows.map((row, idx) => (
              <div key={row.shoppingItem.id} className="space-y-2 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 font-semibold text-slate-900">
                    <input
                      type="checkbox"
                      checked={row.include}
                      disabled={!row.shoppingItem.catalogItemId}
                      onChange={(e) =>
                        setPutAwayRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, include: e.target.checked } : r,
                          ),
                        )
                      }
                      className="h-4 w-4 rounded accent-teal-700"
                    />
                    {row.shoppingItem.label}
                  </label>
                  {!row.shoppingItem.catalogItemId && (
                    <span className="text-[11px] text-slate-400">
                      Item livre (só limpa da lista)
                    </span>
                  )}
                </div>

                {row.include && (
                  <div className="grid grid-cols-3 gap-2 pl-6">
                    <select
                      value={row.locationId}
                      onChange={(e) =>
                        setPutAwayRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, locationId: e.target.value } : r,
                          ),
                        )
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={row.quantity}
                        onChange={(e) =>
                          setPutAwayRows((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, quantity: Number(e.target.value) || 0 } : r,
                            ),
                          )
                        }
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                      />
                      <select
                        value={row.unit}
                        onChange={(e) =>
                          setPutAwayRows((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, unit: e.target.value as Unit } : r,
                            ),
                          )
                        }
                        className="rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-xs"
                      >
                        {UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="date"
                      value={row.expiresAt}
                      onChange={(e) =>
                        setPutAwayRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, expiresAt: e.target.value } : r,
                          ),
                        )
                      }
                      title="Data de validade opcional"
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPutAwayOpen(false)}
              className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmPutAway}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <PackageCheck className="h-4 w-4" />
              Confirmar arrumação
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
