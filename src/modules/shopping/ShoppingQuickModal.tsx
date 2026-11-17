import { useEffect, useMemo, useState } from 'react';
import { Check, Minus, Plus, Save, Trash2 } from 'lucide-react';
import { CameraPhotoControl } from '../../components/CameraPhotoControl';
import { Modal } from '../../components/Modal';
import { TypeIconBadge } from '../../components/TypeIconBadge';
import { UNITS } from '../../constants/labels';
import type {
  ShoppingItem,
  StorageLocation,
  SupermarketSection,
  SupermarketSectionConfig,
  Unit,
} from '../../types/domain';
import { softDeleteAttachmentIfUnused } from '../../utils/attachmentStorage';
import { getOrderedSupermarketSections } from '../../utils/sectionVisuals';
import { getStepForUnit } from '../../utils/units';
import type { ShoppingItemDisplayMeta } from './shoppingVisuals';

interface ShoppingQuickModalProps {
  open: boolean;
  onClose: () => void;
  meta: ShoppingItemDisplayMeta | null;
  locations: StorageLocation[];
  supermarketSections?: SupermarketSectionConfig[];
  onToggleChecked: (item: ShoppingItem) => void;
  onSaveItem: (
    item: ShoppingItem,
    patch: Pick<
      ShoppingItem,
      | 'label'
      | 'quantity'
      | 'unit'
      | 'section'
      | 'targetLocationId'
      | 'notes'
      | 'photoAttachmentId'
    >,
  ) => void;
  onDeleteItem: (item: ShoppingItem) => void;
}

export function ShoppingQuickModal({
  open,
  onClose,
  meta,
  locations,
  supermarketSections,
  onToggleChecked,
  onSaveItem,
  onDeleteItem,
}: ShoppingQuickModalProps) {
  const orderedSections = useMemo(
    () => getOrderedSupermarketSections(supermarketSections),
    [supermarketSections],
  );
  const [label, setLabel] = useState('');
  const [qtyStr, setQtyStr] = useState('1');
  const [unit, setUnit] = useState<Unit>('un');
  const [section, setSection] = useState<SupermarketSection>('pantry');
  const [targetLocationId, setTargetLocationId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [photoAttachmentId, setPhotoAttachmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !meta) return;
    setLabel(meta.item.label);
    setQtyStr(meta.item.quantity !== null ? String(meta.item.quantity) : '');
    setUnit(meta.item.unit ?? 'un');
    setSection(meta.item.section);
    setTargetLocationId(meta.item.targetLocationId ?? '');
    setNotes(meta.item.notes ?? '');
    setPhotoAttachmentId(meta.item.photoAttachmentId ?? null);
  }, [open, meta]);

  if (!meta) return null;
  const { item, visual, sectionLabel, sourceLabel } = meta;
  const step = getStepForUnit(unit);

  const handleCloseModal = () => {
    if (photoAttachmentId && photoAttachmentId !== (item.photoAttachmentId ?? null)) {
      void softDeleteAttachmentIfUnused(photoAttachmentId, { excludeShoppingId: item.id });
    }
    onClose();
  };

  const handlePhotoDraftChange = (nextPhotoId: string | null) => {
    if (
      photoAttachmentId &&
      photoAttachmentId !== nextPhotoId &&
      photoAttachmentId !== (item.photoAttachmentId ?? null)
    ) {
      void softDeleteAttachmentIfUnused(photoAttachmentId, { excludeShoppingId: item.id });
    }
    setPhotoAttachmentId(nextPhotoId);
  };

  const adjustDraftQty = (delta: number) => {
    const current = Number(qtyStr.replace(',', '.')) || 0;
    const next = Math.max(0.1, Math.round((current + delta) * 100) / 100);
    setQtyStr(String(next));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = label.trim() || item.label;
    const parsed = Number(qtyStr.replace(',', '.'));
    onSaveItem(item, {
      label: cleanLabel,
      quantity: Number.isFinite(parsed) && parsed > 0 ? parsed : item.quantity,
      unit,
      section,
      targetLocationId: targetLocationId || null,
      notes: notes.trim(),
      photoAttachmentId,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleCloseModal}
      title={item.label}
      subtitle={`${sectionLabel} · Origem: ${sourceLabel}`}
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <TypeIconBadge visual={visual} size="lg" />
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
                {sectionLabel}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
                {sourceLabel}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onToggleChecked(item)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              item.checked
                ? 'bg-teal-700 text-white hover:bg-teal-800'
                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {item.checked ? 'No carrinho' : 'Marcar'}
          </button>
        </div>

        <div className="space-y-1.5 rounded-2xl border border-slate-100 bg-slate-50/70 p-2.5">
          <span className="block text-xs font-semibold text-slate-600">Foto do produto</span>
          <CameraPhotoControl
            attachmentId={photoAttachmentId}
            alt={label || item.label}
            onChange={handlePhotoDraftChange}
          />
        </div>

        <div>
          <label htmlFor="shop-edit-label" className="mb-1 block text-xs font-semibold text-slate-600">
            Nome do artigo
          </label>
          <input
            id="shop-edit-label"
            type="text"
            value={label}
            onFocus={(e) => {
              if (e.target.value === 'Artigo com foto') e.target.select();
            }}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </div>

        <div>
          <span className="mb-1 block text-xs font-semibold text-slate-600">Quantidade</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => adjustDraftQty(-step)}
              aria-label={`Diminuir quantidade de ${item.label}`}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              step="any"
              min="0"
              value={qtyStr}
              onChange={(e) => setQtyStr(e.target.value)}
              aria-label="Quantidade"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm font-semibold outline-none focus:border-teal-600"
            />
            <button
              type="button"
              onClick={() => adjustDraftQty(step)}
              aria-label={`Aumentar quantidade de ${item.label}`}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" />
            </button>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
              aria-label="Unidade"
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-teal-600"
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.value === 'tbsp' ? 'c. sopa' : u.value === 'tsp' ? 'c. chá' : u.value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label
              htmlFor="shop-edit-section"
              className="mb-1 block text-xs font-semibold text-slate-600"
            >
              Corredor / Secção
            </label>
            <select
              id="shop-edit-section"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none focus:border-teal-600"
            >
              {orderedSections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name}
                </option>
              ))}
              {!orderedSections.some((sec) => sec.id === section) && (
                <option value={section}>Outros</option>
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="shop-edit-location"
              className="mb-1 block text-xs font-semibold text-slate-600"
            >
              Local ao arrumar
            </label>
            <select
              id="shop-edit-location"
              value={targetLocationId}
              onChange={(e) => setTargetLocationId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none focus:border-teal-600"
            >
              <option value="">Sem destino</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="shop-edit-notes" className="mb-1 block text-xs font-semibold text-slate-600">
            Notas (marca, embalagem, etc.)
          </label>
          <textarea
            id="shop-edit-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-teal-600"
          />
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => {
              onDeleteItem(item);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remover
          </button>

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-800"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}
