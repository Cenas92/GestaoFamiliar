import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { CATALOG_CATEGORY_LABELS, UNITS } from '../../constants/labels';
import { db } from '../../db/database';
import type {
  CatalogCategory,
  CatalogItem,
  StorageLocation,
  SupermarketSection,
  SupermarketSectionConfig,
  TrackingMode,
  Unit,
} from '../../types/domain';
import { createSyncMetadata, nowIso } from '../../utils/id';
import { getOrderedSupermarketSections } from '../../utils/sectionVisuals';
import { normalizeText } from '../../utils/units';

interface CatalogManagerModalProps {
  open: boolean;
  onClose: () => void;
  catalogItems: CatalogItem[];
  locations: StorageLocation[];
  supermarketSections?: SupermarketSectionConfig[];
  deviceId: string;
}

export function CatalogManagerModal({
  open,
  onClose,
  catalogItems,
  locations,
  supermarketSections,
  deviceId,
}: CatalogManagerModalProps) {
  const orderedSections = useMemo(
    () => getOrderedSupermarketSections(supermarketSections),
    [supermarketSections],
  );
  const defaultSectionId = orderedSections.some((s) => s.id === 'pantry')
    ? 'pantry'
    : (orderedSections[0]?.id ?? 'other');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [aliasesText, setAliasesText] = useState('');
  const [category, setCategory] = useState<CatalogCategory>('food');
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('exact');
  const [defaultUnit, setDefaultUnit] = useState<Unit>('un');
  const [defaultLocationId, setDefaultLocationId] = useState(locations[0]?.id ?? '');
  const [minStockQty, setMinStockQty] = useState('');
  const [section, setSection] = useState<SupermarketSection>(defaultSectionId);

  const filtered = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return catalogItems;
    return catalogItems.filter(
      (c) =>
        normalizeText(c.name).includes(q) ||
        c.aliases.some((a) => normalizeText(a).includes(q)),
    );
  }, [catalogItems, search]);

  const startNew = () => {
    setEditing(null);
    setCreating(true);
    setName('');
    setAliasesText('');
    setCategory('food');
    setTrackingMode('exact');
    setDefaultUnit('un');
    setDefaultLocationId(locations[0]?.id ?? '');
    setMinStockQty('');
    setSection(defaultSectionId);
  };

  const startEdit = (item: CatalogItem) => {
    setCreating(false);
    setEditing(item);
    setName(item.name);
    setAliasesText(item.aliases.join(', '));
    setCategory(item.category);
    setTrackingMode(item.trackingMode);
    setDefaultUnit(item.defaultUnit);
    setDefaultLocationId(item.defaultLocationId || locations[0]?.id || '');
    setMinStockQty(item.minStockQty !== null ? String(item.minStockQty) : '');
    setSection(item.supermarketSection);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const parsedMin = minStockQty.trim() ? Number(minStockQty.replace(',', '.')) : null;
    const aliases = aliasesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editing) {
      await db.catalogItems.put({
        ...editing,
        name: name.trim(),
        aliases,
        category,
        trackingMode,
        defaultUnit,
        defaultLocationId,
        minStockQty: parsedMin !== null && !Number.isNaN(parsedMin) ? parsedMin : null,
        supermarketSection: section,
        updatedAt: nowIso(),
        lastModifiedBy: deviceId,
      });
    } else {
      await db.catalogItems.put({
        ...createSyncMetadata(deviceId),
        name: name.trim(),
        aliases,
        category,
        trackingMode,
        defaultUnit,
        defaultLocationId,
        minStockQty: parsedMin !== null && !Number.isNaN(parsedMin) ? parsedMin : null,
        supermarketSection: section,
      });
    }
    setEditing(null);
    setCreating(false);
  };

  const handleDelete = async (item: CatalogItem) => {
    const now = nowIso();
    await db.catalogItems.put({
      ...item,
      deletedAt: now,
      updatedAt: now,
      lastModifiedBy: deviceId,
    });
  };

  const isFormOpen = creating || editing !== null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Catálogo de Produtos e Ingredientes"
      subtitle="Define unidades padrão, stock mínimo e corredor de supermercado"
      maxWidthClass="max-w-2xl"
    >
      {isFormOpen ? (
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Nome *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Sinónimos (separados por vírgula)
              </label>
              <input
                type="text"
                value={aliasesText}
                onChange={(e) => setAliasesText(e.target.value)}
                placeholder="Ex: tomate chucha, tomate cereja"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CatalogCategory)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {Object.entries(CATALOG_CATEGORY_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Controlo</label>
              <select
                value={trackingMode}
                onChange={(e) => setTrackingMode(e.target.value as TrackingMode)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="exact">Quantidade exata</option>
                <option value="qualitative">Estado (Tem/Pouco/Acabou)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Unidade padrão</label>
              <select
                value={defaultUnit}
                onChange={(e) => setDefaultUnit(e.target.value as Unit)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Local habitual</label>
              <select
                value={defaultLocationId}
                onChange={(e) => setDefaultLocationId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                {trackingMode === 'qualitative'
                  ? 'Alertar quando Pouco? (1=Sim)'
                  : `Stock mínimo (${defaultUnit})`}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={minStockQty}
                onChange={(e) => setMinStockQty(e.target.value)}
                placeholder="Sem alerta"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Secção supermercado
              </label>
              <select
                value={orderedSections.some((s) => s.id === section) ? section : defaultSectionId}
                onChange={(e) => setSection(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {orderedSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
              className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Guardar
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar no catálogo..."
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-600"
              />
            </div>
            <button
              type="button"
              onClick={startNew}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <Plus className="h-4 w-4" />
              Novo
            </button>
          </div>

          <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {CATALOG_CATEGORY_LABELS[item.category]} ·{' '}
                    {item.trackingMode === 'qualitative' ? 'Tem/Pouco' : item.defaultUnit}
                    {item.minStockQty ? ` · Mín: ${item.minStockQty}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-700"
                    aria-label={`Editar ${item.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Apagar ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
