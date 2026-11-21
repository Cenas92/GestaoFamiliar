import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { TypeIconBadge } from '../../components/TypeIconBadge';
import { db } from '../../db/database';
import type { FinanceCategoryConfig } from '../../types/domain';
import { nowIso } from '../../utils/id';
import { FINANCE_KIND_PLURAL_LABELS, getFinanceCategoryVisual } from './financeVisuals';

interface FinanceBudgetsModalProps {
  open: boolean;
  onClose: () => void;
  categories: FinanceCategoryConfig[];
  deviceId: string;
  onSaved?: (msg: string) => void;
}

export function FinanceBudgetsModal({
  open,
  onClose,
  categories,
  deviceId,
  onSaved,
}: FinanceBudgetsModalProps) {
  const expenseCategories = useMemo(
    () =>
      categories
        .filter((c) => !c.deletedAt && c.kind !== 'income')
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-PT')),
    [categories],
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, string> = {};
    for (const cat of expenseCategories) {
      initial[cat.id] = cat.monthlyBudget ? String(cat.monthlyBudget).replace('.', ',') : '';
    }
    setValues(initial);
  }, [open, expenseCategories]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const now = nowIso();
      const updates: FinanceCategoryConfig[] = [];
      for (const cat of expenseCategories) {
        const raw = (values[cat.id] ?? '').trim().replace(',', '.');
        const parsed = raw ? Number(raw) : null;
        const nextBudget =
          parsed !== null && Number.isFinite(parsed) && parsed > 0
            ? Math.round(parsed * 100) / 100
            : null;
        if (nextBudget !== (cat.monthlyBudget ?? null)) {
          updates.push({
            ...cat,
            monthlyBudget: nextBudget,
            updatedAt: now,
            lastModifiedBy: deviceId,
          });
        }
      }
      if (updates.length > 0) {
        await db.financeCategories.bulkPut(updates);
      }
      onSaved?.('Orçamentos mensais atualizados.');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const variableCats = expenseCategories.filter((c) => c.kind === 'variable');
  const fixedCats = expenseCategories.filter((c) => c.kind === 'fixed');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Orçamentos mensais"
      subtitle="Define um limite mensal (€) para as categorias que queres acompanhar. Deixa vazio para sem limite."
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { key: 'variable' as const, items: variableCats },
          { key: 'fixed' as const, items: fixedCats },
        ].map(
          (group) =>
            group.items.length > 0 && (
              <div key={group.key} className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {FINANCE_KIND_PLURAL_LABELS[group.key]}
                </p>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                  {group.items.map((cat) => {
                    const visual = getFinanceCategoryVisual(cat);
                    return (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <TypeIconBadge visual={visual} size="sm" />
                          <span className="truncate text-xs font-semibold text-slate-800">
                            {cat.name}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={values[cat.id] ?? ''}
                            onChange={(e) =>
                              setValues((prev) => ({ ...prev, [cat.id]: e.target.value }))
                            }
                            placeholder="Sem limite"
                            aria-label={`Orçamento mensal para ${cat.name}`}
                            className="w-24 rounded-lg border border-slate-200 px-2.5 py-1 text-right text-xs font-semibold focus:border-teal-500 focus:outline-none"
                          />
                          <span className="text-xs font-medium text-slate-400">€</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ),
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-800 disabled:opacity-50"
          >
            {saving ? 'A guardar...' : 'Guardar limites'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
