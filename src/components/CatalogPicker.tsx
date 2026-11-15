import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { CATALOG_CATEGORY_LABELS, UNITS } from '../constants/labels';
import { db } from '../db/database';
import type {
  CatalogCategory,
  CatalogItem,
  StorageLocation,
  SupermarketSection,
  SupermarketSectionConfig,
  TrackingMode,
  Unit,
} from '../types/domain';
import { createSyncMetadata } from '../utils/id';
import { getOrderedSupermarketSections } from '../utils/sectionVisuals';
import { normalizeText } from '../utils/units';

interface CatalogPickerProps {
  catalogItems: CatalogItem[];
  locations: StorageLocation[];
  supermarketSections?: SupermarketSectionConfig[];
  deviceId: string;
  selectedId: string | null;
  onSelect: (item: CatalogItem) => void;
  placeholder?: string;
}

export function CatalogPicker({
  catalogItems,
  locations,
  supermarketSections,
  deviceId,
  selectedId,
  onSelect,
  placeholder = 'Procurar ingrediente ou produto...',
}: CatalogPickerProps) {
  const selectedItem = catalogItems.find((c) => c.id === selectedId) ?? null;
  const [query, setQuery] = useState(selectedItem?.name ?? '');
  const [focused, setFocused] = useState(false);
  const [creating, setCreating] = useState(false);

  const orderedSections = useMemo(
    () => getOrderedSupermarketSections(supermarketSections),
    [supermarketSections],
  );
  const [newCategory, setNewCategory] = useState<CatalogCategory>('food');
  const [newTrackingMode, setNewTrackingMode] = useState<TrackingMode>('exact');
  const [newUnit, setNewUnit] = useState<Unit>('un');
  const [newLocationId, setNewLocationId] = useState(locations[0]?.id ?? '');
  const [newSection, setNewSection] = useState<SupermarketSection>(() =>
    orderedSections.some((s) => s.id === 'pantry')
      ? 'pantry'
      : (orderedSections[0]?.id ?? 'other'),
  );

  const matches = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return catalogItems.slice(0, 10);
    return catalogItems
      .filter((item) => {
        if (normalizeText(item.name).includes(q)) return true;
        return item.aliases.some((alias) => normalizeText(alias).includes(q));
      })
      .slice(0, 12);
  }, [catalogItems, query]);

  const exactMatchExists = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return true;
    return catalogItems.some((c) => normalizeText(c.name) === q);
  }, [catalogItems, query]);

  const handleCreateInline = async () => {
    const cleanName = query.trim();
    if (!cleanName) return;
    const item: CatalogItem = {
      ...createSyncMetadata(deviceId),
      name: cleanName,
      aliases: [],
      category: newCategory,
      trackingMode: newTrackingMode,
      defaultUnit: newUnit,
      defaultLocationId: newLocationId || locations[0]?.id || '',
      minStockQty: null,
      supermarketSection: newSection,
    };
    await db.catalogItems.put(item);
    setCreating(false);
    setFocused(false);
    setQuery(item.name);
    onSelect(item);
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setFocused(true);
            setCreating(false);
          }}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        />
      </div>

      {focused && (
        <div className="mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {matches.map((item) => {
            const isSelected = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setQuery(item.name);
                  setFocused(false);
                  setCreating(false);
                  onSelect(item);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-teal-50 ${
                  isSelected ? 'bg-teal-50 font-medium text-teal-900' : 'text-slate-700'
                }`}
              >
                <span>{item.name}</span>
                <span className="text-xs text-slate-400">
                  {item.trackingMode === 'qualitative' ? 'Tem/Pouco' : item.defaultUnit}
                </span>
              </button>
            );
          })}

          {query.trim().length > 0 && !exactMatchExists && !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 border-t border-slate-100 bg-teal-50/70 px-3 py-2.5 text-left text-sm font-medium text-teal-800 hover:bg-teal-100"
            >
              <Plus className="h-4 w-4" />
              Criar "{query.trim()}" no catálogo
            </button>
          )}

          {creating && (
            <div className="space-y-2.5 border-t border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-700">
                Novo item no catálogo: "{query.trim()}"
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as CatalogCategory)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                >
                  {Object.entries(CATALOG_CATEGORY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={newTrackingMode}
                  onChange={(e) => setNewTrackingMode(e.target.value as TrackingMode)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="exact">Quantidade exata</option>
                  <option value="qualitative">Estado (Tem/Pouco)</option>
                </select>
                <select
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value as Unit)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <select
                  value={newLocationId}
                  onChange={(e) => setNewLocationId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              <select
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
              >
                {orderedSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    Corredor: {sec.name}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateInline}
                  className="rounded-lg bg-teal-700 px-3 py-1 text-xs font-medium text-white hover:bg-teal-800"
                >
                  Guardar e selecionar
                </button>
              </div>
            </div>
          )}

          {matches.length === 0 && !query.trim() && (
            <p className="px-3 py-2 text-xs text-slate-500">Catálogo vazio.</p>
          )}
        </div>
      )}
    </div>
  );
}
