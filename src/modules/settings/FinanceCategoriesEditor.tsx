import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { TypeIconBadge } from '../../components/TypeIconBadge';
import { buildStarterFinanceCategories } from '../../data/starterCatalog';
import { db } from '../../db/database';
import type {
  FinanceCategoryConfig,
  FinanceCategoryIconKey,
  FinanceKind,
  FinanceRecurringRule,
  FinanceTransaction,
  SectionColorToken,
} from '../../types/domain';
import { createSyncMetadata, nowIso } from '../../utils/id';
import { getSectionColorStyle, SECTION_COLOR_OPTIONS } from '../../utils/sectionVisuals';
import {
  FINANCE_ICON_OPTIONS,
  FINANCE_KIND_PLURAL_LABELS,
  getFinanceCategoryVisual,
} from '../finances/financeVisuals';

interface FinanceCategoriesEditorProps {
  categories: FinanceCategoryConfig[];
  recurringRules: FinanceRecurringRule[];
  transactions: FinanceTransaction[];
  deviceId: string;
  onNotify?: (msg: string) => void;
}

interface CategoryDraft {
  name: string;
  kind: FinanceKind;
  colorToken: SectionColorToken | string;
  icon: FinanceCategoryIconKey | string;
}

const KINDS: FinanceKind[] = ['income', 'fixed', 'variable'];

function CategoryStylePickers({
  draft,
  onChange,
}: {
  draft: CategoryDraft;
  onChange: (next: CategoryDraft) => void;
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
          {FINANCE_ICON_OPTIONS.map((opt) => {
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

export function FinanceCategoriesEditor({
  categories,
  recurringRules,
  transactions,
  deviceId,
  onNotify,
}: FinanceCategoriesEditorProps) {
  const [activeKind, setActiveKind] = useState<FinanceKind>('variable');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CategoryDraft>({
    name: '',
    kind: 'variable',
    colorToken: 'teal',
    icon: 'tag',
  });
  const [newDraft, setNewDraft] = useState<CategoryDraft>({
    name: '',
    kind: 'variable',
    colorToken: 'teal',
    icon: 'tag',
  });
  const [deletingCat, setDeletingCat] = useState<FinanceCategoryConfig | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const orderedAll = useMemo(() => {
    const source = categories.length > 0 ? categories : buildStarterFinanceCategories(deviceId);
    return source
      .filter((c) => !c.deletedAt)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-PT'));
  }, [categories, deviceId]);

  const visibleCategories = useMemo(
    () => orderedAll.filter((c) => c.kind === activeKind),
    [orderedAll, activeKind],
  );

  const usageCountById = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tx of transactions) {
      if (!tx.deletedAt) counts.set(tx.categoryId, (counts.get(tx.categoryId) ?? 0) + 1);
    }
    for (const rule of recurringRules) {
      if (!rule.deletedAt) counts.set(rule.categoryId, (counts.get(rule.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [transactions, recurringRules]);

  const ensurePersistedSeed = async () => {
    const count = await db.financeCategories.count();
    if (count === 0) {
      await db.financeCategories.bulkPut(buildStarterFinanceCategories(deviceId));
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = newDraft.name.trim();
    if (!name) {
      setError('Indica um nome para a categoria.');
      return;
    }

    await ensurePersistedSeed();
    const maxSort = orderedAll.reduce((acc, c) => Math.max(acc, c.sortOrder), 0);
    const created: FinanceCategoryConfig = {
      ...createSyncMetadata(deviceId),
      name,
      kind: activeKind,
      colorToken: newDraft.colorToken,
      icon: newDraft.icon,
      sortOrder: maxSort + 1,
      monthlyBudget: null,
    };
    await db.financeCategories.put(created);
    setNewDraft({ name: '', kind: activeKind, colorToken: 'teal', icon: 'tag' });
    onNotify?.(`Categoria "${name}" criada.`);
  };

  const startEdit = (cat: FinanceCategoryConfig) => {
    setDeletingCat(null);
    setEditingId(cat.id);
    setEditDraft({
      name: cat.name,
      kind: cat.kind,
      colorToken: cat.colorToken,
      icon: cat.icon,
    });
  };

  const saveEdit = async (cat: FinanceCategoryConfig) => {
    const name = editDraft.name.trim();
    if (!name) return;
    await ensurePersistedSeed();
    await db.financeCategories.put({
      ...cat,
      name,
      kind: editDraft.kind,
      colorToken: editDraft.colorToken,
      icon: editDraft.icon,
      updatedAt: nowIso(),
      lastModifiedBy: deviceId,
    });
    setEditingId(null);
    onNotify?.(`Categoria "${name}" atualizada.`);
  };

  const moveCategory = async (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= visibleCategories.length) return;
    await ensurePersistedSeed();
    const list = visibleCategories.slice();
    const [moved] = list.splice(index, 1);
    list.splice(targetIdx, 0, moved);

    const now = nowIso();
    const baseOrder = activeKind === 'income' ? 1 : activeKind === 'fixed' ? 100 : 200;
    await db.financeCategories.bulkPut(
      list.map((c, idx) => ({
        ...c,
        sortOrder: baseOrder + idx,
        updatedAt: now,
        lastModifiedBy: deviceId,
      })),
    );
  };

  const startDelete = (cat: FinanceCategoryConfig) => {
    const siblings = visibleCategories.filter((c) => c.id !== cat.id);
    if (siblings.length === 0) return;
    setEditingId(null);
    setDeletingCat(cat);
    setReassignTargetId(siblings[0].id);
  };

  const confirmDelete = async () => {
    if (!deletingCat || !reassignTargetId) return;
    await ensurePersistedSeed();
    const now = nowIso();

    const [allTx, allRules] = await Promise.all([
      db.financeTransactions.toArray(),
      db.financeRecurring.toArray(),
    ]);
    const txToUpdate = allTx
      .filter((t) => !t.deletedAt && t.categoryId === deletingCat.id)
      .map((t) => ({
        ...t,
        categoryId: reassignTargetId,
        updatedAt: now,
        lastModifiedBy: deviceId,
      }));
    const rulesToUpdate = allRules
      .filter((r) => !r.deletedAt && r.categoryId === deletingCat.id)
      .map((r) => ({
        ...r,
        categoryId: reassignTargetId,
        updatedAt: now,
        lastModifiedBy: deviceId,
      }));

    await db.transaction(
      'rw',
      [db.financeCategories, db.financeTransactions, db.financeRecurring],
      async () => {
        if (txToUpdate.length) await db.financeTransactions.bulkPut(txToUpdate);
        if (rulesToUpdate.length) await db.financeRecurring.bulkPut(rulesToUpdate);
        await db.financeCategories.put({
          ...deletingCat,
          deletedAt: now,
          updatedAt: now,
          lastModifiedBy: deviceId,
        });
      },
    );

    const removedName = deletingCat.name;
    setDeletingCat(null);
    onNotify?.(`Categoria "${removedName}" removida.`);
  };

  return (
    <div className="space-y-3">
      {/* Filtro por tipo */}
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => {
          const count = orderedAll.filter((c) => c.kind === k).length;
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                setActiveKind(k);
                setEditingId(null);
                setDeletingCat(null);
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                activeKind === k
                  ? 'bg-teal-700 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {FINANCE_KIND_PLURAL_LABELS[k]} ({count})
            </button>
          );
        })}
      </div>

      {/* Lista de categorias do tipo selecionado */}
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {visibleCategories.map((cat, idx) => {
          const isEditing = editingId === cat.id;
          const isDeleting = deletingCat?.id === cat.id;
          const usage = usageCountById.get(cat.id) ?? 0;
          const visual = getFinanceCategoryVisual(cat);

          if (isEditing) {
            return (
              <div key={cat.id} className="space-y-2.5 bg-slate-50/70 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={editDraft.name}
                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                    aria-label="Nome da categoria"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold"
                  />
                  <select
                    value={editDraft.kind}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, kind: e.target.value as FinanceKind })
                    }
                    aria-label="Tipo da categoria"
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {FINANCE_KIND_PLURAL_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>

                <CategoryStylePickers draft={editDraft} onChange={setEditDraft} />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(cat)}
                    className="rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            );
          }

          if (isDeleting) {
            const alternatives = visibleCategories.filter((c) => c.id !== cat.id);
            return (
              <div key={cat.id} className="space-y-2 bg-rose-50/60 p-3">
                <p className="text-xs font-semibold text-rose-900">
                  Remover «{cat.name}»?
                  {usage > 0
                    ? ` Os ${usage} registo(s) serão movidos para:`
                    : ' Esta categoria não tem registos.'}
                </p>
                {usage > 0 && (
                  <select
                    value={reassignTargetId}
                    onChange={(e) => setReassignTargetId(e.target.value)}
                    className="w-full rounded-xl border border-rose-200 bg-white px-2.5 py-1.5 text-xs"
                  >
                    {alternatives.map((alt) => (
                      <option key={alt.id} value={alt.id}>
                        {alt.name}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    Confirmar remoção
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingCat(null)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={cat.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <TypeIconBadge visual={visual} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">{cat.name}</p>
                  {usage > 0 && (
                    <p className="text-[10px] text-slate-400">
                      {usage} {usage === 1 ? 'registo' : 'registos'}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => moveCategory(idx, -1)}
                  disabled={idx === 0}
                  aria-label={`Subir ${cat.name}`}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveCategory(idx, 1)}
                  disabled={idx === visibleCategories.length - 1}
                  aria-label={`Descer ${cat.name}`}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(cat)}
                  aria-label={`Editar ${cat.name}`}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {visibleCategories.length > 1 && (
                  <button
                    type="button"
                    onClick={() => startDelete(cat)}
                    aria-label={`Remover ${cat.name}`}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Formulário Nova Categoria */}
      <form onSubmit={handleAdd} className="space-y-2.5 rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-700">
          Nova categoria em {FINANCE_KIND_PLURAL_LABELS[activeKind]}
        </p>
        <input
          type="text"
          value={newDraft.name}
          onChange={(e) => setNewDraft({ ...newDraft, name: e.target.value })}
          placeholder="Ex.: Ginásio, Desporto, Investimentos..."
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
        />
        <CategoryStylePickers draft={newDraft} onChange={setNewDraft} />
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar categoria
        </button>
      </form>
    </div>
  );
}
