import { useMemo, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Minus,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Plus,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { CameraPhotoControl } from '../../components/CameraPhotoControl';
import { CatalogPicker } from '../../components/CatalogPicker';
import { CollectionToolbar } from '../../components/CollectionToolbar';
import { Modal } from '../../components/Modal';
import { PackageSizeFields } from '../../components/PackageSizeFields';
import { SearchInput } from '../../components/SearchInput';
import { TypeIconBadge } from '../../components/TypeIconBadge';
import { PACKAGE_UNITS, UNITS } from '../../constants/labels';
import { db } from '../../db/database';
import { useCollectionViewPrefs } from '../../hooks/useCollectionViewPrefs';
import type {
  CatalogItem,
  FinanceCategoryConfig,
  PackageUnit,
  ShoppingItem,
  StockLot,
  StorageLocation,
  SupermarketSection,
  SupermarketSectionConfig,
  Unit,
} from '../../types/domain';
import {
  saveImageAttachment,
  softDeleteAttachmentIfUnused,
} from '../../utils/attachmentStorage';
import { createSyncMetadata, nowIso } from '../../utils/id';
import {
  getOrderedSupermarketSections,
  getSupermarketSectionLabel,
  getSupermarketSectionVisual,
} from '../../utils/sectionVisuals';
import {
  formatLotQuantity,
  getStepForUnit,
  normalizeText,
  todayDateString,
} from '../../utils/units';
import { shouldExpandPanelsByDefault, type UiDensityMode } from '../../utils/viewPrefs';
import { saveFinanceTransaction } from '../finances/financeService';
import { formatEur } from '../finances/financeVisuals';
import { buildShoppingItem } from '../planner/plannerService';
import {
  buildNewStockLot,
  findMergeableStockLot,
  summarizeCatalogStock,
} from '../stock/stockService';
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
  supermarketSections?: SupermarketSectionConfig[];
  financeCategories?: FinanceCategoryConfig[];
  expiryWarningDays: number;
  deviceId: string;
  uiDensity?: UiDensityMode;
}

interface PutAwayRow {
  shoppingItem: ShoppingItem;
  resolvedCatalogId: string | null;
  locationId: string;
  quantity: number;
  unit: Unit;
  packageSize: string;
  packageUnit: PackageUnit;
  expiresAt: string;
  include: boolean;
  mergeExisting: boolean;
}

type ShoppingStatusFilter = 'all' | 'unchecked' | 'checked';

const STATUS_LABELS: Record<ShoppingStatusFilter, string> = {
  all: 'Todos',
  unchecked: 'Por comprar',
  checked: 'No carrinho',
};

function sortShoppingMetas(
  items: ShoppingItemDisplayMeta[],
  sortMode: ShoppingSortMode,
  sectionRankMap: Map<SupermarketSection, number>,
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
        (sectionRankMap.get(a.item.section) ?? 999) - (sectionRankMap.get(b.item.section) ?? 999);
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
              {item.photoAttachmentId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenQuick(item.id);
                  }}
                  aria-label={`Ver foto de ${item.label}`}
                  className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 transition hover:bg-teal-50 hover:text-teal-700"
                >
                  <Camera className="h-3 w-3" aria-hidden="true" />
                  Foto
                </button>
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

      {item.photoAttachmentId && (
        <button
          type="button"
          onClick={() => onOpenQuick(item.id)}
          aria-label={`Ver foto de ${item.label}`}
          title="Ver foto"
          className="shrink-0 rounded-lg bg-slate-100 p-1 text-slate-500 hover:bg-teal-50 hover:text-teal-700"
        >
          <Camera className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}

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
        <div className="flex w-full items-center justify-between pr-6">
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${
              item.checked
                ? 'border-teal-700 bg-teal-700 text-white'
                : 'border-slate-300 bg-white'
            }`}
          >
            {item.checked && <Check className="h-3 w-3" aria-hidden="true" />}
          </span>
          {item.photoAttachmentId && (
            <Camera
              className="h-3.5 w-3.5 text-teal-700"
              aria-label="Tem foto anexada"
            />
          )}
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
  supermarketSections,
  financeCategories = [],
  expiryWarningDays,
  deviceId,
  uiDensity = 'clean',
}: ShoppingViewProps) {
  const orderedSections = useMemo(
    () => getOrderedSupermarketSections(supermarketSections),
    [supermarketSections],
  );
  const sectionRankMap = useMemo(
    () => new Map(orderedSections.map((sec, idx) => [sec.id, idx])),
    [orderedSections],
  );
  const isComplete = uiDensity === 'complete';
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogItem | null>(null);
  const [freeText, setFreeText] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState<Unit>('un');
  const [pendingPkgSize, setPendingPkgSize] = useState('');
  const [pendingPkgUnit, setPendingPkgUnit] = useState<PackageUnit>('g');
  const [section, setSection] = useState<SupermarketSection>('pantry');
  const [showCatalogInput, setShowCatalogInput] = useState(true);
  const [pendingPhotoId, setPendingPhotoId] = useState<string | null>(null);
  const [quickCameraBusy, setQuickCameraBusy] = useState(false);

  const [addFormOpen, setAddFormOpen] = useState<boolean>(() =>
    shouldExpandPanelsByDefault(uiDensity),
  );
  const [filtersOpen, setFiltersOpen] = useState<boolean>(() =>
    shouldExpandPanelsByDefault(uiDensity),
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShoppingStatusFilter>('all');
  const [sectionFilter, setSectionFilter] = useState<SupermarketSection | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<ShoppingItem['source'] | 'all'>('all');

  const [prefs, updatePrefs] = useCollectionViewPrefs<ShoppingViewPreferences['sortMode']>(
    uiDensity,
    loadShoppingViewPreferences,
    saveShoppingViewPreferences,
    (nextDensity) => {
      const open = shouldExpandPanelsByDefault(nextDensity);
      setFiltersOpen(open);
      setAddFormOpen(open);
    },
  );
  const [collapsedSections, setCollapsedSections] = useState<Set<SupermarketSection>>(
    () => new Set(),
  );
  const [quickItemId, setQuickItemId] = useState<string | null>(null);

  const [putAwayOpen, setPutAwayOpen] = useState(false);
  const [putAwayRows, setPutAwayRows] = useState<PutAwayRow[]>([]);
  const [putAwayTotal, setPutAwayTotal] = useState('');
  const [putAwayStore, setPutAwayStore] = useState('');
  const [putAwayCategoryId, setPutAwayCategoryId] = useState('fin-cat-groceries');
  const [putAwayReceiptPhotoId, setPutAwayReceiptPhotoId] = useState<string | null>(null);
  const [showPutAwayReceiptPhoto, setShowPutAwayReceiptPhoto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const variableFinanceCategories = useMemo(
    () => financeCategories.filter((c) => !c.deletedAt && c.kind !== 'income'),
    [financeCategories],
  );

  const today = todayDateString();
  const catalogById = useMemo(
    () => new Map(catalogItems.map((c) => [c.id, c])),
    [catalogItems],
  );
  const catalogByNormalizedName = useMemo(
    () => new Map(catalogItems.map((c) => [normalizeText(c.name), c])),
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

  const effectiveSection = useMemo(
    () =>
      orderedSections.some((sec) => sec.id === section)
        ? section
        : (orderedSections[0]?.id ?? 'other'),
    [orderedSections, section],
  );

  const availableSections = useMemo(() => {
    const present = new Set(shoppingItems.map((i) => i.section));
    if (sectionFilter !== 'all') present.add(sectionFilter);
    const known = orderedSections.filter((s) => present.has(s.id)).map((s) => s.id);
    const knownSet = new Set(known);
    const extras = Array.from(present).filter((id) => !knownSet.has(id));
    return [...known, ...extras];
  }, [shoppingItems, sectionFilter, orderedSections]);

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
      visual: getShoppingItemVisual(item, supermarketSections),
      targetLocation: item.targetLocationId ? locationsById.get(item.targetLocationId) : undefined,
      sectionLabel: getSupermarketSectionLabel(item.section, supermarketSections),
      sourceLabel: SHOPPING_SOURCE_LABELS[item.source],
      quantityLabel: formatLotQuantity(item).compactLabel,
      step: getStepForUnit(item.unit),
    }));

    return sortShoppingMetas(metas, prefs.sortMode, sectionRankMap);
  }, [
    shoppingItems,
    statusFilter,
    sectionFilter,
    sourceFilter,
    search,
    locationsById,
    supermarketSections,
    prefs.sortMode,
    sectionRankMap,
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

    const orderedIds = orderedSections.map((sec) => sec.id);
    const orderedIdSet = new Set(orderedIds);
    const extraIds = Array.from(bySec.keys()).filter((id) => !orderedIdSet.has(id));

    return [...orderedIds, ...extraIds]
      .map((sec) => ({
        section: sec,
        label: getSupermarketSectionLabel(sec, supermarketSections),
        visual: getSupermarketSectionVisual(sec, supermarketSections),
        items: bySec.get(sec) ?? [],
      }))
      .filter((g) => g.items.length > 0);
  }, [prefs.groupEnabled, filteredMetas, orderedSections, supermarketSections]);

  const activeFiltersCount =
    (sectionFilter !== 'all' ? 1 : 0) + (sourceFilter !== 'all' ? 1 : 0);

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = selectedCatalog
      ? selectedCatalog.name
      : freeText.trim() || (pendingPhotoId ? 'Artigo com foto' : '');
    if (!label) return;

    const parsedPkgSize = Number(pendingPkgSize.replace(',', '.'));
    const hasPkg = unit === 'un' && Number.isFinite(parsedPkgSize) && parsedPkgSize > 0;

    const item = buildShoppingItem(
      {
        catalogItemId: selectedCatalog?.id ?? null,
        label,
        quantity: Number(qty.replace(',', '.')) || 1,
        unit,
        packageSize: hasPkg ? parsedPkgSize : null,
        packageUnit: hasPkg ? pendingPkgUnit : null,
        section: selectedCatalog ? selectedCatalog.supermarketSection : effectiveSection,
        targetLocationId: selectedCatalog?.defaultLocationId ?? locations[0]?.id ?? null,
        source: 'manual',
        photoAttachmentId: pendingPhotoId,
      },
      deviceId,
    );
    await db.shoppingItems.put(item);
    setSelectedCatalog(null);
    setFreeText('');
    setQty('1');
    setPendingPkgSize('');
    setPendingPhotoId(null);
  };

  const handleQuickCameraCapture = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setQuickCameraBusy(true);
    try {
      const saved = await saveImageAttachment(file);
      const defaultSection =
        sectionFilter !== 'all'
          ? sectionFilter
          : orderedSections.some((s) => s.id === 'other')
            ? 'other'
            : (orderedSections[0]?.id ?? 'other');
      const item = buildShoppingItem(
        {
          catalogItemId: null,
          label: 'Artigo com foto',
          quantity: 1,
          unit: 'un',
          section: defaultSection,
          targetLocationId: locations[0]?.id ?? null,
          source: 'manual',
          photoAttachmentId: saved.id,
        },
        deviceId,
      );
      await db.shoppingItems.put(item);
      if (statusFilter === 'checked') setStatusFilter('all');
      if (sourceFilter !== 'all') setSourceFilter('all');
      if (search) setSearch('');
      setQuickItemId(item.id);
      showNotice('Foto guardada na lista de compras.');
    } finally {
      setQuickCameraBusy(false);
    }
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
      | 'label'
      | 'quantity'
      | 'unit'
      | 'packageSize'
      | 'packageUnit'
      | 'section'
      | 'targetLocationId'
      | 'notes'
      | 'photoAttachmentId'
    >,
  ) => {
    await db.shoppingItems.put({
      ...item,
      ...patch,
      updatedAt: nowIso(),
      lastModifiedBy: deviceId,
    });
    if (item.photoAttachmentId && item.photoAttachmentId !== patch.photoAttachmentId) {
      void softDeleteAttachmentIfUnused(item.photoAttachmentId, { excludeShoppingId: item.id });
    }
  };

  const deleteItem = async (item: ShoppingItem) => {
    const now = nowIso();
    await db.shoppingItems.put({
      ...item,
      deletedAt: now,
      updatedAt: now,
      lastModifiedBy: deviceId,
    });
    if (item.photoAttachmentId) {
      void softDeleteAttachmentIfUnused(item.photoAttachmentId, { excludeShoppingId: item.id });
    }
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
      const cat = item.catalogItemId
        ? catalogById.get(item.catalogItemId)
        : catalogByNormalizedName.get(normalizeText(item.label));
      const rowUnit = item.unit ?? cat?.defaultUnit ?? 'un';
      const pkgSize = item.packageSize ?? cat?.defaultPackageSize ?? null;
      const pkgUnit = item.packageUnit ?? cat?.defaultPackageUnit ?? 'g';
      return {
        shoppingItem: item,
        resolvedCatalogId: cat?.id ?? null,
        locationId: item.targetLocationId || cat?.defaultLocationId || locations[0]?.id || '',
        quantity: item.quantity ?? 1,
        unit: rowUnit,
        packageSize: pkgSize ? String(pkgSize) : '',
        packageUnit: pkgUnit,
        expiresAt: '',
        include: true,
        mergeExisting: true,
      };
    });
    setPutAwayRows(rows);
    setPutAwayTotal('');
    setPutAwayStore('');
    const groceriesCat =
      variableFinanceCategories.find((c) => c.id === 'fin-cat-groceries') ??
      variableFinanceCategories[0];
    setPutAwayCategoryId(groceriesCat?.id ?? 'fin-cat-groceries');
    setPutAwayReceiptPhotoId(null);
    setShowPutAwayReceiptPhoto(false);
    setPutAwayOpen(true);
  };

  const handleConfirmPutAway = async () => {
    const now = nowIso();
    const workingLots: StockLot[] = [...stockLots];
    const lotsToSave: StockLot[] = [];
    const itemsToDelete: ShoppingItem[] = [];
    const catalogToCreate: CatalogItem[] = [];
    const createdByNormName = new Map<string, CatalogItem>();

    let addedCount = 0;
    let mergedCount = 0;

    for (const row of putAwayRows) {
      itemsToDelete.push({
        ...row.shoppingItem,
        deletedAt: now,
        updatedAt: now,
        lastModifiedBy: deviceId,
      });

      if (!row.include || !row.locationId) continue;

      const parsedPkg = Number(row.packageSize.replace(',', '.'));
      const hasPkg = row.unit === 'un' && Number.isFinite(parsedPkg) && parsedPkg > 0;
      const normalizedPkgSize = hasPkg ? parsedPkg : null;
      const normalizedPkgUnit = hasPkg ? row.packageUnit : null;

      let cat = row.resolvedCatalogId ? catalogById.get(row.resolvedCatalogId) : undefined;
      if (!cat) {
        const normName = normalizeText(row.shoppingItem.label);
        cat = catalogByNormalizedName.get(normName) ?? createdByNormName.get(normName);
      }
      if (!cat) {
        cat = {
          ...createSyncMetadata(deviceId),
          name: row.shoppingItem.label.trim(),
          aliases: [],
          category: 'food',
          trackingMode: 'exact',
          defaultUnit: row.unit,
          defaultPackageSize: normalizedPkgSize,
          defaultPackageUnit: normalizedPkgUnit,
          defaultLocationId: row.locationId,
          minStockQty: null,
          supermarketSection: row.shoppingItem.section,
        };
        catalogToCreate.push(cat);
        createdByNormName.set(normalizeText(cat.name), cat);
      }

      if (cat.trackingMode === 'qualitative') {
        const newLot = buildNewStockLot(
          {
            catalogItemId: cat.id,
            productLabel: row.shoppingItem.label,
            locationId: row.locationId,
            quantity: null,
            unit: null,
            qualitativeLevel: 'full',
            expiresAt: row.expiresAt || null,
          },
          deviceId,
        );
        workingLots.push(newLot);
        lotsToSave.push(newLot);
        addedCount += 1;
        continue;
      }

      const mergeable = row.mergeExisting
        ? findMergeableStockLot(workingLots, {
            catalogItemId: cat.id,
            locationId: row.locationId,
            unit: row.unit,
            packageSize: normalizedPkgSize,
            packageUnit: normalizedPkgUnit,
            expiresAt: row.expiresAt || null,
          })
        : undefined;

      if (mergeable) {
        const updatedLot: StockLot = {
          ...mergeable,
          quantity: Math.round(((mergeable.quantity ?? 0) + row.quantity) * 1000) / 1000,
          updatedAt: now,
          lastModifiedBy: deviceId,
        };
        const idx = workingLots.findIndex((l) => l.id === mergeable.id);
        if (idx >= 0) workingLots[idx] = updatedLot;
        const saveIdx = lotsToSave.findIndex((l) => l.id === mergeable.id);
        if (saveIdx >= 0) lotsToSave[saveIdx] = updatedLot;
        else lotsToSave.push(updatedLot);
        mergedCount += 1;
      } else {
        const newLot = buildNewStockLot(
          {
            catalogItemId: cat.id,
            productLabel: row.shoppingItem.label,
            locationId: row.locationId,
            quantity: row.quantity,
            unit: row.unit,
            packageSize: normalizedPkgSize,
            packageUnit: normalizedPkgUnit,
            qualitativeLevel: null,
            expiresAt: row.expiresAt || null,
          },
          deviceId,
        );
        workingLots.push(newLot);
        lotsToSave.push(newLot);
        addedCount += 1;
      }
    }

    await db.transaction('rw', [db.stockLots, db.shoppingItems, db.catalogItems], async () => {
      if (catalogToCreate.length) await db.catalogItems.bulkPut(catalogToCreate);
      if (lotsToSave.length) await db.stockLots.bulkPut(lotsToSave);
      if (itemsToDelete.length) await db.shoppingItems.bulkPut(itemsToDelete);
    });
    for (const del of itemsToDelete) {
      if (del.photoAttachmentId) {
        void softDeleteAttachmentIfUnused(del.photoAttachmentId, { excludeShoppingId: del.id });
      }
    }

    const parsedReceiptTotal = Number(putAwayTotal.trim().replace(',', '.'));
    let registeredExpenseAmount: number | null = null;
    if (Number.isFinite(parsedReceiptTotal) && parsedReceiptTotal > 0) {
      const storeTitle = putAwayStore.trim() || 'Supermercado';
      await saveFinanceTransaction(
        {
          title: storeTitle,
          kind: 'variable',
          categoryId: putAwayCategoryId || 'fin-cat-groceries',
          amount: parsedReceiptTotal,
          date: todayDateString(),
          status: 'paid',
          notes:
            itemsToDelete.length > 0
              ? `Compras de supermercado (${itemsToDelete.length} ${
                  itemsToDelete.length === 1 ? 'item' : 'itens'
                })`
              : '',
          photoAttachmentId: putAwayReceiptPhotoId,
        },
        deviceId,
      );
      registeredExpenseAmount = parsedReceiptTotal;
    } else if (putAwayReceiptPhotoId) {
      void softDeleteAttachmentIfUnused(putAwayReceiptPhotoId);
    }

    setPutAwayOpen(false);
    const totalPut = addedCount + mergedCount;
    const expenseSuffix =
      registeredExpenseAmount !== null
        ? ` · ${formatEur(registeredExpenseAmount)} registado em Finanças.`
        : '';
    if (mergedCount > 0 && addedCount > 0) {
      showNotice(
        `${totalPut} produto(s) arrumado(s) (${mergedCount} somado(s) ao stock)!${expenseSuffix}`,
      );
    } else if (mergedCount > 0) {
      showNotice(`${mergedCount} produto(s) somado(s) aos lotes existentes!${expenseSuffix}`);
    } else {
      showNotice(`${totalPut} produto(s) arrumado(s) no stock!${expenseSuffix}`);
    }
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
          {(isComplete || uncheckedCount > 0 || statusFilter === 'unchecked') && (
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
          {(isComplete || checkedItems.length > 0 || statusFilter === 'checked') && (
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
          <label
            className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            title="Tirar foto rápida para compras"
          >
            <Camera className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
            <span className="hidden sm:inline">
              {quickCameraBusy ? 'A guardar...' : 'Foto'}
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={quickCameraBusy}
              aria-label="Foto rápida para compras"
              onChange={handleQuickCameraCapture}
              className="hidden"
            />
          </label>
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
              supermarketSections={supermarketSections}
              deviceId={deviceId}
              selectedId={selectedCatalog?.id ?? null}
              onSelect={(cat) => {
                setSelectedCatalog(cat);
                const nextUnit = cat.trackingMode === 'qualitative' ? 'un' : cat.defaultUnit;
                setUnit(nextUnit);
                setPendingPkgSize(
                  nextUnit === 'un' && cat.defaultPackageSize
                    ? String(cat.defaultPackageSize)
                    : '',
                );
                setPendingPkgUnit(cat.defaultPackageUnit ?? 'g');
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
                value={effectiveSection}
                onChange={(e) => setSection(e.target.value)}
                aria-label="Secção do item"
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-teal-600"
              >
                {orderedSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
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

          {unit === 'un' && (
            <PackageSizeFields
              compact
              packageSize={pendingPkgSize}
              packageUnit={pendingPkgUnit}
              onChangeSize={setPendingPkgSize}
              onChangeUnit={setPendingPkgUnit}
              quantity={Number(qty.replace(',', '.')) || null}
            />
          )}

          <CameraPhotoControl
            attachmentId={pendingPhotoId}
            alt={selectedCatalog?.name || freeText || 'Foto do produto'}
            onChange={(nextId) => {
              if (pendingPhotoId && nextId !== pendingPhotoId) {
                void softDeleteAttachmentIfUnused(pendingPhotoId);
              }
              setPendingPhotoId(nextId);
            }}
          />
        </form>
      )}

      {/* Search + Collapsible Filters toggle */}
      <div className="flex items-center gap-1.5">
        <SearchInput
          size="sm"
          value={search}
          onChange={setSearch}
          placeholder="Pesquisar item ou nota..."
        />

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
              aria-label={`Remover filtro ${getSupermarketSectionLabel(sectionFilter, supermarketSections)}`}
            >
              <span>{getSupermarketSectionLabel(sectionFilter, supermarketSections)}</span>
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
                  {getSupermarketSectionLabel(s, supermarketSections)}
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
        supermarketSections={supermarketSections}
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
            {putAwayRows.map((row, idx) => {
              const parsedPkg = Number(row.packageSize.replace(',', '.'));
              const mergeCandidate =
                row.include && row.resolvedCatalogId && row.locationId
                  ? findMergeableStockLot(stockLots, {
                      catalogItemId: row.resolvedCatalogId,
                      locationId: row.locationId,
                      unit: row.unit,
                      packageSize: Number.isFinite(parsedPkg) && parsedPkg > 0 ? parsedPkg : null,
                      packageUnit: row.packageUnit,
                      expiresAt: row.expiresAt || null,
                    })
                  : undefined;

              return (
                <div key={row.shoppingItem.id} className="space-y-2 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 font-semibold text-slate-900">
                      <input
                        type="checkbox"
                        checked={row.include}
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
                    {!row.resolvedCatalogId && (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                        Novo no catálogo
                      </span>
                    )}
                  </div>

                  {row.include && (
                    <div className="space-y-2 pl-6">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <select
                          value={row.locationId}
                          aria-label={`Local para ${row.shoppingItem.label}`}
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
                            aria-label={`Quantidade de ${row.shoppingItem.label}`}
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
                            aria-label={`Unidade de ${row.shoppingItem.label}`}
                            onChange={(e) =>
                              setPutAwayRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, unit: e.target.value as Unit } : r,
                                ),
                              )
                            }
                            className="flex-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-xs"
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
                          aria-label={`Validade de ${row.shoppingItem.label}`}
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

                      {row.unit === 'un' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-medium text-slate-500">
                            Tamanho/un. (opc.):
                          </span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="Ex: 85"
                            aria-label={`Tamanho embalagem de ${row.shoppingItem.label}`}
                            value={row.packageSize}
                            onChange={(e) =>
                              setPutAwayRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, packageSize: e.target.value } : r,
                                ),
                              )
                            }
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                          />
                          <select
                            value={row.packageUnit}
                            aria-label={`Unidade embalagem de ${row.shoppingItem.label}`}
                            onChange={(e) =>
                              setPutAwayRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? { ...r, packageUnit: e.target.value as PackageUnit }
                                    : r,
                                ),
                              )
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                          >
                            {PACKAGE_UNITS.map((u) => (
                              <option key={u.value} value={u.value}>
                                {u.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {mergeCandidate && (
                        <label className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800">
                          <input
                            type="checkbox"
                            checked={row.mergeExisting}
                            onChange={(e) =>
                              setPutAwayRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, mergeExisting: e.target.checked } : r,
                                ),
                              )
                            }
                            className="h-3.5 w-3.5 rounded accent-emerald-700"
                          />
                          <span>
                            Somar ao lote existente ({mergeCandidate.quantity} {mergeCandidate.unit} +{' '}
                            {row.quantity})
                          </span>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bloco opcional: lançar total do talão em Finanças */}
          <div className="space-y-2 rounded-xl border border-violet-200/80 bg-violet-50/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-950">
                <Wallet className="h-3.5 w-3.5 text-violet-700" aria-hidden="true" />
                Registar gasto nas Finanças <span className="font-normal text-slate-500">(opcional)</span>
              </span>
              {!showPutAwayReceiptPhoto && (
                <button
                  type="button"
                  onClick={() => setShowPutAwayReceiptPhoto(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-violet-800 hover:bg-violet-50"
                >
                  <Camera className="h-3 w-3" aria-hidden="true" />
                  Foto talão
                </button>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label className="mb-0.5 block text-[11px] font-medium text-slate-600">
                  Total do talão (€)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={putAwayTotal}
                  onChange={(e) => setPutAwayTotal(e.target.value)}
                  placeholder="Ex.: 58,40"
                  aria-label="Total do talão (€)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-0.5 block text-[11px] font-medium text-slate-600">
                  Loja / descrição
                </label>
                <input
                  type="text"
                  value={putAwayStore}
                  onChange={(e) => setPutAwayStore(e.target.value)}
                  placeholder="Supermercado"
                  aria-label="Loja ou descrição da despesa"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-teal-500 focus:outline-none"
                />
              </div>

              {variableFinanceCategories.length > 0 && (
                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-slate-600">
                    Categoria
                  </label>
                  <select
                    value={putAwayCategoryId}
                    onChange={(e) => setPutAwayCategoryId(e.target.value)}
                    aria-label="Categoria financeira da compra"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-teal-500 focus:outline-none"
                  >
                    {variableFinanceCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {showPutAwayReceiptPhoto && (
              <div className="pt-1">
                <CameraPhotoControl
                  attachmentId={putAwayReceiptPhotoId}
                  alt="Talão de compras"
                  onChange={setPutAwayReceiptPhotoId}
                />
              </div>
            )}
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
