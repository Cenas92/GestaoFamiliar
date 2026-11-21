import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '../../components/Modal';
import type {
  FinanceCategoryConfig,
  FinanceRecurringFrequency,
  FinanceRecurringRule,
  HouseholdMember,
} from '../../types/domain';
import { deleteFinanceRecurringRule, saveFinanceRecurringRule } from './financeService';
import { FINANCE_FREQUENCY_LABELS } from './financeVisuals';

interface FinanceRecurringModalProps {
  open: boolean;
  onClose: () => void;
  editingRule: FinanceRecurringRule | null;
  activeMonth: string;
  categories: FinanceCategoryConfig[];
  members: HouseholdMember[];
  deviceId: string;
  initialKind?: 'income' | 'fixed';
  onSaved?: (msg: string) => void;
}

const FREQUENCIES: FinanceRecurringFrequency[] = ['monthly', 'quarterly', 'semiannual', 'annual'];

function pickRecurringCategory(
  categories: FinanceCategoryConfig[],
  kind: 'income' | 'fixed',
): string {
  const matching = categories.filter((c) => c.kind === kind);
  return matching[0]?.id ?? categories[0]?.id ?? (kind === 'income' ? 'fin-cat-salary' : 'fin-cat-housing');
}

export function FinanceRecurringModal({
  open,
  onClose,
  editingRule,
  activeMonth,
  categories,
  members,
  deviceId,
  initialKind = 'fixed',
  onSaved,
}: FinanceRecurringModalProps) {
  const [kind, setKind] = useState<'income' | 'fixed'>(initialKind);
  const [title, setTitle] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [frequency, setFrequency] = useState<FinanceRecurringFrequency>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [startMonth, setStartMonth] = useState(activeMonth);
  const [memberId, setMemberId] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirmDelete(false);

    if (editingRule) {
      setKind(editingRule.kind);
      setTitle(editingRule.title);
      setAmountInput(String(editingRule.amount).replace('.', ','));
      setCategoryId(editingRule.categoryId);
      setFrequency(editingRule.frequency);
      setDayOfMonth(String(editingRule.dayOfMonth));
      setStartMonth(editingRule.startMonth);
      setMemberId(editingRule.memberId ?? '');
      setNotes(editingRule.notes);
      setIsActive(editingRule.isActive);
      return;
    }

    setKind(initialKind);
    setTitle('');
    setAmountInput('');
    setCategoryId(pickRecurringCategory(categories, initialKind));
    setFrequency('monthly');
    setDayOfMonth(initialKind === 'income' ? '25' : '1');
    setStartMonth(activeMonth);
    setMemberId('');
    setNotes('');
    setIsActive(true);
  }, [open, editingRule, activeMonth, categories, initialKind]);

  const filteredCategories = useMemo(() => {
    const byKind = categories.filter((c) => c.kind === kind);
    return byKind.length > 0 ? byKind : categories;
  }, [categories, kind]);

  const handleChangeKind = (nextKind: 'income' | 'fixed') => {
    setKind(nextKind);
    const matchesCurrent = categories.some((c) => c.id === categoryId && c.kind === nextKind);
    if (!matchesCurrent) {
      setCategoryId(pickRecurringCategory(categories, nextKind));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Indica um nome (ex.: Ordenado André, Prestação da casa, Seguro do carro).');
      return;
    }

    const parsedAmount = Number(amountInput.trim().replace(',', '.'));
    if (!amountInput.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Indica um valor estimado maior que 0 €.');
      return;
    }

    const parsedDay = Math.max(1, Math.min(31, Number(dayOfMonth) || 1));

    setSaving(true);
    try {
      await saveFinanceRecurringRule(
        {
          id: editingRule?.id,
          title: trimmedTitle,
          kind,
          categoryId: categoryId || pickRecurringCategory(categories, kind),
          amount: parsedAmount,
          frequency,
          dayOfMonth: parsedDay,
          startMonth: startMonth || activeMonth,
          isActive,
          memberId: memberId || null,
          notes,
        },
        deviceId,
        activeMonth,
      );
      onSaved?.(editingRule ? 'Recorrência atualizada.' : 'Recorrência criada e projetada no mês.');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingRule) return;
    setSaving(true);
    try {
      await deleteFinanceRecurringRule(editingRule, deviceId, true);
      onSaved?.('Recorrência removida.');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingRule ? 'Editar fixa / ordenado' : 'Nova fixa / ordenado'}
      subtitle="É projetada automaticamente todos os meses aplicáveis como «Previsto»."
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Tipo */}
        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => handleChangeKind('fixed')}
            className={`rounded-lg py-1.5 text-xs font-semibold transition ${
              kind === 'fixed'
                ? 'bg-white text-amber-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Despesa fixa / periódica
          </button>
          <button
            type="button"
            onClick={() => handleChangeKind('income')}
            className={`rounded-lg py-1.5 text-xs font-semibold transition ${
              kind === 'income'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ordenado / Receita fixa
          </button>
        </div>

        {/* Nome e Valor */}
        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-700">Descrição</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                kind === 'income'
                  ? 'Ex.: Ordenado, Subsídio de alimentação...'
                  : 'Ex.: Prestação da casa, Luz, Seguro carro, IUC...'
              }
              autoFocus
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Valor (€)</label>
            <input
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Categoria e Periodicidade */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Categoria</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            >
              {filteredCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Periodicidade</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as FinanceRecurringFrequency)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            >
              {FREQUENCIES.map((freq) => (
                <option key={freq} value={freq}>
                  {FINANCE_FREQUENCY_LABELS[freq]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dia habitual e Mês de início */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Dia habitual do mês
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {frequency === 'monthly' ? 'A partir de' : 'Mês de referência'}
            </label>
            <input
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Membro e Ativa */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          {members.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Membro <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              >
                <option value="">Casa / Geral</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-end">
            <label className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              <span>Regra ativa</span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
              />
            </label>
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            Notas <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: Débito direto, apólice n.º..., entidade..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          {editingRule ? (
            confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  Confirmar apagar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Apagar
              </button>
            )
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
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
              {saving ? 'A guardar...' : editingRule ? 'Guardar' : 'Criar'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
