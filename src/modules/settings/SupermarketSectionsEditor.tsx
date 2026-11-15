import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { TypeIconBadge } from '../../components/TypeIconBadge';
import { buildStarterSupermarketSections } from '../../data/starterCatalog';
import { db } from '../../db/database';
import type {
  CatalogItem,
  SectionColorToken,
  SectionIconKey,
  ShoppingItem,
  SupermarketSectionConfig,
} from '../../types/domain';
import { createSyncMetadata, nowIso } from '../../utils/id';
import {
  getSectionColorStyle,
  getSectionIconComponent,
  SECTION_COLOR_OPTIONS,
  SECTION_ICON_OPTIONS,
} from '../../utils/sectionVisuals';

interface SupermarketSectionsEditorProps {
  sections: SupermarketSectionConfig[];
  catalogItems: CatalogItem[];
  shoppingItems: ShoppingItem[];
  deviceId: string;
  onNotify?: (msg: string) => void;
}

interface SectionDraft {
  name: string;
  colorToken: SectionColorToken | string;
  icon: SectionIconKey | string;
}

const DEFAULT_DRAFT: SectionDraft = {
  name: '',
  colorToken: 'teal',
  icon: 'shopping_basket',
};

function SectionStylePickers({
  draft,
  onChange,
}: {
  draft: SectionDraft;
  onChange: (next: SectionDraft) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <span className="mb-1 block text-[11px] font-semibold text-slate-500">Cor</span>
        <div className="flex flex-wrap gap-1.5">
          {SECTION_COLOR_OPTIONS.map((opt) => {
            const active = draft.colorToken === opt.token;
            return (
              <button
                key={opt.token}
                type="button"
                onClick={() => onChange({ ...draft, colorToken: opt.token })}
                title={opt.label}
                aria-label={`Cor ${opt.label}`}
                aria-pressed={active}
                className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${
                  active
                    ? 'scale-110 border-slate-900 ring-2 ring-slate-900/20'
                    : 'border-white shadow-xs hover:scale-105'
                } ${opt.swatchClass}`}
              >
                {active && <Check className="h-3 w-3 text-white" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="mb-1 block text-[11px] font-semibold text-slate-500">Ícone</span>
        <div className="flex flex-wrap gap-1">
          {SECTION_ICON_OPTIONS.map((opt) => {
            const Icon = opt.Icon;
            const active = draft.icon === opt.key;
            const selectedColor = getSectionColorStyle(draft.colorToken);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onChange({ ...draft, icon: opt.key })}
                title={opt.label}
                aria-label={`Ícone ${opt.label}`}
                aria-pressed={active}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                  active
                    ? `${selectedColor.bgClass} ${selectedColor.textClass} border-slate-900 ring-1 ring-slate-900/20`
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SupermarketSectionsEditor({
  sections,
  catalogItems,
  shoppingItems,
  deviceId,
  onNotify,
}: SupermarketSectionsEditorProps) {
  const orderedSections = useMemo(() => {
    const source = sections.length > 0 ? sections : buildStarterSupermarketSections(deviceId);
    return source
      .filter((s) => !s.deletedAt)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-PT'));
  }, [sections, deviceId]);

  const usageBySectionId = useMemo(() => {
    const counts = new Map<string, { catalog: number; shopping: number }>();
    for (const item of catalogItems) {
      if (item.deletedAt) continue;
      const prev = counts.get(item.supermarketSection) ?? { catalog: 0, shopping: 0 };
      prev.catalog += 1;
      counts.set(item.supermarketSection, prev);
    }
    for (const item of shoppingItems) {
      if (item.deletedAt) continue;
      const prev = counts.get(item.section) ?? { catalog: 0, shopping: 0 };
      prev.shopping += 1;
      counts.set(item.section, prev);
    }
    return counts;
  }, [catalogItems, shoppingItems]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SectionDraft>(DEFAULT_DRAFT);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');

  const [newDraft, setNewDraft] = useState<SectionDraft>(DEFAULT_DRAFT);

  const ensureMaterializedInDb = async (): Promise<SupermarketSectionConfig[]> => {
    const count = await db.supermarketSections.count();
    if (count === 0) {
      const starter = buildStarterSupermarketSections(deviceId);
      await db.supermarketSections.bulkPut(starter);
      return starter;
    }
    return orderedSections;
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedSections.length) return;

    await ensureMaterializedInDb();
    const reordered = [...orderedSections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const now = nowIso();
    const payload: SupermarketSectionConfig[] = reordered.map((sec, idx) => ({
      ...sec,
      sortOrder: idx + 1,
      updatedAt: now,
      lastModifiedBy: deviceId,
    }));
    await db.supermarketSections.bulkPut(payload);
  };

  const startEdit = (sec: SupermarketSectionConfig) => {
    setDeletingId(null);
    setEditingId(sec.id);
    setEditDraft({
      name: sec.name,
      colorToken: sec.colorToken,
      icon: sec.icon,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent, sec: SupermarketSectionConfig) => {
    e.preventDefault();
    const cleanName = editDraft.name.trim();
    if (!cleanName) return;

    await ensureMaterializedInDb();
    await db.supermarketSections.put({
      ...sec,
      name: cleanName,
      colorToken: editDraft.colorToken,
      icon: editDraft.icon,
      updatedAt: nowIso(),
      lastModifiedBy: deviceId,
    });
    setEditingId(null);
    onNotify?.(`Corredor "${cleanName}" atualizado.`);
  };

  const startDelete = (sec: SupermarketSectionConfig) => {
    if (orderedSections.length <= 1) return;
    setEditingId(null);
    const remaining = orderedSections.filter((s) => s.id !== sec.id);
    const defaultTarget = remaining.find((s) => s.id === 'other')?.id ?? remaining[0]?.id ?? '';
    setDeletingId(sec.id);
    setReassignTargetId(defaultTarget);
  };

  const handleConfirmDelete = async (sec: SupermarketSectionConfig) => {
    if (orderedSections.length <= 1) return;
    const remaining = orderedSections.filter((s) => s.id !== sec.id);
    const targetId =
      remaining.find((s) => s.id === reassignTargetId)?.id ??
      remaining.find((s) => s.id === 'other')?.id ??
      remaining[0]?.id;
    if (!targetId) return;

    await ensureMaterializedInDb();
    const now = nowIso();

    await db.transaction(
      'rw',
      [db.supermarketSections, db.catalogItems, db.shoppingItems],
      async () => {
        const affectedCatalog = (await db.catalogItems.toArray()).filter(
          (item) => !item.deletedAt && item.supermarketSection === sec.id,
        );
        if (affectedCatalog.length > 0) {
          await db.catalogItems.bulkPut(
            affectedCatalog.map((item) => ({
              ...item,
              supermarketSection: targetId,
              updatedAt: now,
              lastModifiedBy: deviceId,
            })),
          );
        }

        const affectedShopping = (await db.shoppingItems.toArray()).filter(
          (item) => !item.deletedAt && item.section === sec.id,
        );
        if (affectedShopping.length > 0) {
          await db.shoppingItems.bulkPut(
            affectedShopping.map((item) => ({
              ...item,
              section: targetId,
              updatedAt: now,
              lastModifiedBy: deviceId,
            })),
          );
        }

        await db.supermarketSections.put({
          ...sec,
          deletedAt: now,
          updatedAt: now,
          lastModifiedBy: deviceId,
        });
      },
    );

    const targetName = remaining.find((s) => s.id === targetId)?.name ?? 'outro corredor';
    setDeletingId(null);
    onNotify?.(`Corredor "${sec.name}" removido (produtos movidos para "${targetName}").`);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newDraft.name.trim();
    if (!cleanName) return;

    await ensureMaterializedInDb();
    const maxSort = orderedSections.reduce((acc, s) => Math.max(acc, s.sortOrder), 0);
    const created: SupermarketSectionConfig = {
      ...createSyncMetadata(deviceId),
      name: cleanName,
      colorToken: newDraft.colorToken,
      icon: newDraft.icon,
      sortOrder: maxSort + 1,
    };
    await db.supermarketSections.put(created);
    setNewDraft(DEFAULT_DRAFT);
    onNotify?.(`Corredor "${cleanName}" adicionado.`);
  };

  const previewColor = getSectionColorStyle(newDraft.colorToken);
  const PreviewIcon = getSectionIconComponent(newDraft.icon);

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Ordena os corredores pelo percurso do teu supermercado, altera o nome ou personaliza o ícone e
        a cor. As alterações sincronizam entre dispositivos.
      </p>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
        {orderedSections.map((sec, idx) => {
          const color = getSectionColorStyle(sec.colorToken);
          const Icon = getSectionIconComponent(sec.icon);
          const usage = usageBySectionId.get(sec.id) ?? { catalog: 0, shopping: 0 };
          const totalUsage = usage.catalog + usage.shopping;
          const remaining = orderedSections.filter((s) => s.id !== sec.id);

          if (editingId === sec.id) {
            const editColor = getSectionColorStyle(editDraft.colorToken);
            const EditIcon = getSectionIconComponent(editDraft.icon);
            return (
              <form
                key={sec.id}
                onSubmit={(e) => handleSaveEdit(e, sec)}
                className="space-y-2.5 bg-teal-50/40 p-3"
              >
                <div className="flex items-center gap-2">
                  <TypeIconBadge
                    visual={{
                      Icon: EditIcon,
                      label: editDraft.name || sec.name,
                      bgClass: editColor.bgClass,
                      textClass: editColor.textClass,
                    }}
                    size="sm"
                  />
                  <input
                    type="text"
                    value={editDraft.name}
                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                    aria-label="Nome do corredor"
                    placeholder="Nome do corredor..."
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium outline-none focus:border-teal-600"
                    required
                  />
                </div>

                <SectionStylePickers draft={editDraft} onChange={setEditDraft} />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Guardar alterações
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            );
          }

          return (
            <div key={sec.id} className="space-y-2 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-4 shrink-0 text-right text-[11px] font-semibold text-slate-400 tabular-nums">
                    {idx + 1}.
                  </span>
                  <TypeIconBadge
                    visual={{
                      Icon,
                      label: sec.name,
                      bgClass: color.bgClass,
                      textClass: color.textClass,
                    }}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{sec.name}</p>
                    {totalUsage > 0 && (
                      <p className="text-[11px] text-slate-500">
                        {usage.catalog > 0 ? `${usage.catalog} no catálogo` : ''}
                        {usage.catalog > 0 && usage.shopping > 0 ? ' · ' : ''}
                        {usage.shopping > 0 ? `${usage.shopping} na lista` : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, -1)}
                    aria-label={`Subir ${sec.name}`}
                    title="Mover para cima"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === orderedSections.length - 1}
                    onClick={() => handleMove(idx, 1)}
                    aria-label={`Descer ${sec.name}`}
                    title="Mover para baixo"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(sec)}
                    aria-label={`Editar ${sec.name}`}
                    title="Editar corredor"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {orderedSections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => startDelete(sec)}
                      aria-label={`Remover ${sec.name}`}
                      title="Remover corredor"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {deletingId === sec.id && (
                <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/70 p-2.5 text-xs">
                  {totalUsage > 0 ? (
                    <>
                      <p className="font-semibold text-rose-900">
                        Existem {usage.catalog} produto(s) no catálogo e {usage.shopping} item(ns) nas
                        compras neste corredor.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <label
                          htmlFor={`reassign-${sec.id}`}
                          className="font-medium text-rose-900"
                        >
                          Mover tudo para:
                        </label>
                        <select
                          id={`reassign-${sec.id}`}
                          value={reassignTargetId}
                          onChange={(e) => setReassignTargetId(e.target.value)}
                          className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
                        >
                          {remaining.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <p className="font-medium text-rose-900">
                      Remover o corredor "{sec.name}"? Não tem produtos associados.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirmDelete(sec)}
                      className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      Confirmar remoção
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(null)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleCreate} className="space-y-2.5 rounded-xl bg-slate-50 p-3">
        <div className="flex items-center gap-2">
          <TypeIconBadge
            visual={{
              Icon: PreviewIcon,
              label: newDraft.name || 'Novo corredor',
              bgClass: previewColor.bgClass,
              textClass: previewColor.textClass,
            }}
            size="sm"
          />
          <input
            type="text"
            value={newDraft.name}
            onChange={(e) => setNewDraft({ ...newDraft, name: e.target.value })}
            placeholder="Novo corredor (ex: Garrafeira, Biológicos...)"
            aria-label="Nome do novo corredor"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-teal-600"
          />
        </div>

        <SectionStylePickers draft={newDraft} onChange={setNewDraft} />

        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar corredor
        </button>
      </form>
    </div>
  );
}
