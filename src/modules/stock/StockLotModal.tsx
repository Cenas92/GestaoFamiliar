import { useEffect, useState } from 'react';
import { CatalogPicker } from '../../components/CatalogPicker';
import { Modal } from '../../components/Modal';
import { QUALITATIVE_LABELS, UNITS } from '../../constants/labels';
import { db } from '../../db/database';
import type {
  CatalogItem,
  QualitativeLevel,
  StockLot,
  StorageLocation,
  SupermarketSectionConfig,
  Unit,
} from '../../types/domain';
import { nowIso as getNowIso } from '../../utils/id';
import { todayDateString } from '../../utils/units';
import { buildNewStockLot } from './stockService';

interface StockLotModalProps {
  open: boolean;
  onClose: () => void;
  editingLot: StockLot | null;
  catalogItems: CatalogItem[];
  locations: StorageLocation[];
  supermarketSections?: SupermarketSectionConfig[];
  deviceId: string;
  initialLocationId?: string;
}

export function StockLotModal({
  open,
  onClose,
  editingLot,
  catalogItems,
  locations,
  supermarketSections,
  deviceId,
  initialLocationId,
}: StockLotModalProps) {
  const [catalogItemId, setCatalogItemId] = useState<string | null>(null);
  const [productLabel, setProductLabel] = useState('');
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<Unit>('un');
  const [qualitativeLevel, setQualitativeLevel] = useState<QualitativeLevel>('full');
  const [expiresAt, setExpiresAt] = useState('');
  const [frozenOrCookedAt, setFrozenOrCookedAt] = useState('');
  const [isLeftover, setIsLeftover] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingLot) {
      setCatalogItemId(editingLot.catalogItemId);
      setProductLabel(editingLot.productLabel);
      setLocationId(editingLot.locationId);
      setQuantity(editingLot.quantity !== null ? String(editingLot.quantity) : '1');
      setUnit(editingLot.unit ?? 'un');
      setQualitativeLevel(editingLot.qualitativeLevel ?? 'full');
      setExpiresAt(editingLot.expiresAt ?? '');
      setFrozenOrCookedAt(editingLot.frozenOrCookedAt ?? '');
      setIsLeftover(editingLot.isLeftover);
      setNotes(editingLot.notes);
    } else {
      setCatalogItemId(null);
      setProductLabel('');
      setLocationId(initialLocationId || locations[0]?.id || '');
      setQuantity('1');
      setUnit('un');
      setQualitativeLevel('full');
      setExpiresAt('');
      setFrozenOrCookedAt('');
      setIsLeftover(false);
      setNotes('');
    }
  }, [open, editingLot, initialLocationId, locations]);

  const selectedCatalog = catalogItems.find((c) => c.id === catalogItemId) ?? null;
  const selectedLocation = locations.find((l) => l.id === locationId) ?? null;
  const isFreezerLocation = selectedLocation?.locationType === 'freezer';
  const showSecondaryDate = isLeftover || isFreezerLocation;

  const handleSelectCatalog = (item: CatalogItem) => {
    const prevCatalog = catalogItems.find((c) => c.id === catalogItemId);
    setCatalogItemId(item.id);
    if (!productLabel.trim() || productLabel === prevCatalog?.name) {
      setProductLabel(item.name);
    }
    setUnit(item.defaultUnit);
    if (!editingLot && item.defaultLocationId) {
      setLocationId(item.defaultLocationId);
      const loc = locations.find((l) => l.id === item.defaultLocationId);
      if (loc?.locationType === 'freezer' && !frozenOrCookedAt) {
        setFrozenOrCookedAt(todayDateString());
      }
    }
  };

  const handleLocationChange = (newLocId: string) => {
    setLocationId(newLocId);
    const loc = locations.find((l) => l.id === newLocId);
    if (loc?.locationType === 'freezer') {
      if (!frozenOrCookedAt) {
        setFrozenOrCookedAt(todayDateString());
      }
    } else if (!isLeftover) {
      setFrozenOrCookedAt('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogItemId || !selectedCatalog) {
      setError('Seleciona ou cria um item do catálogo.');
      return;
    }
    if (!locationId) {
      setError('Seleciona um local de armazenamento.');
      return;
    }

    const isQualitative = selectedCatalog.trackingMode === 'qualitative';
    const parsedQty = Number(quantity.replace(',', '.'));
    if (!isQualitative && (Number.isNaN(parsedQty) || parsedQty < 0)) {
      setError('Indica uma quantidade válida.');
      return;
    }

    const finalLabel = productLabel.trim() || selectedCatalog.name;
    const effectiveSecondaryDate = showSecondaryDate && frozenOrCookedAt ? frozenOrCookedAt : null;

    if (editingLot) {
      const updated: StockLot = {
        ...editingLot,
        catalogItemId,
        productLabel: finalLabel,
        locationId,
        quantity: isQualitative ? null : parsedQty,
        unit: isQualitative ? null : unit,
        qualitativeLevel: isQualitative ? qualitativeLevel : null,
        expiresAt: expiresAt || null,
        frozenOrCookedAt: effectiveSecondaryDate,
        isLeftover,
        notes: notes.trim(),
        updatedAt: getNowIso(),
        lastModifiedBy: deviceId,
      };
      await db.stockLots.put(updated);
    } else {
      const newLot = buildNewStockLot(
        {
          catalogItemId,
          productLabel: finalLabel,
          locationId,
          quantity: isQualitative ? null : parsedQty,
          unit: isQualitative ? null : unit,
          qualitativeLevel: isQualitative ? qualitativeLevel : null,
          expiresAt: expiresAt || null,
          frozenOrCookedAt: effectiveSecondaryDate,
          isLeftover,
          notes: notes.trim(),
        },
        deviceId,
      );
      await db.stockLots.put(newLot);
    }

    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingLot ? 'Editar item em stock' : 'Adicionar ao stock'}
      subtitle="Liga o produto a um ingrediente genérico do catálogo"
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ingrediente / Produto Genérico *
          </label>
          <CatalogPicker
            key={editingLot?.id ?? 'new'}
            catalogItems={catalogItems}
            locations={locations}
            supermarketSections={supermarketSections}
            deviceId={deviceId}
            selectedId={catalogItemId}
            onSelect={handleSelectCatalog}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nome / Marca específica (opcional)
            </label>
            <input
              type="text"
              value={productLabel}
              onChange={(e) => setProductLabel(e.target.value)}
              placeholder={selectedCatalog ? selectedCatalog.name : 'Ex: Tomate Chucha, Leite Mimosa'}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Local *
            </label>
            <select
              value={locationId}
              onChange={(e) => handleLocationChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedCatalog?.trackingMode === 'qualitative' ? (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Estado atual
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['full', 'low', 'empty'] as QualitativeLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setQualitativeLevel(level)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    qualitativeLevel === level
                      ? 'border-teal-700 bg-teal-50 text-teal-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {QUALITATIVE_LABELS[level]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Quantidade *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Unidade
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className={isFreezerLocation ? 'grid gap-3 sm:grid-cols-2' : ''}>
          <div>
            <label
              htmlFor="stock-expires-at"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Data de validade (opcional)
            </label>
            <input
              id="stock-expires-at"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
          </div>

          {isFreezerLocation && (
            <div>
              <label
                htmlFor="stock-frozen-at"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {isLeftover ? 'Data de congelação / sobras' : 'Data em que foi congelado'}
              </label>
              <input
                id="stock-frozen-at"
                type="date"
                value={frozenOrCookedAt}
                onChange={(e) => setFrozenOrCookedAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
              />
            </div>
          )}
        </div>

        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isLeftover}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsLeftover(checked);
                if (checked && !frozenOrCookedAt) {
                  setFrozenOrCookedAt(todayDateString());
                } else if (!checked && !isFreezerLocation) {
                  setFrozenOrCookedAt('');
                }
              }}
              className="h-4 w-4 rounded accent-teal-700"
            />
            Marcar como sobra / refeição caseira (tupperware)
          </label>

          {isLeftover && !isFreezerLocation && (
            <div>
              <label
                htmlFor="stock-cooked-at"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Data de preparação / sobras
              </label>
              <input
                id="stock-cooked-at"
                type="date"
                value={frozenOrCookedAt}
                onChange={(e) => setFrozenOrCookedAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
              />
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Notas (opcional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Aberto ontem, gaveta de baixo..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
          >
            {editingLot ? 'Guardar alterações' : 'Adicionar ao stock'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
