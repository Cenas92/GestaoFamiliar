import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, ShieldCheck, Trash2 } from 'lucide-react';
import { CameraPhotoControl } from '../../components/CameraPhotoControl';
import { Modal } from '../../components/Modal';
import type {
  FinanceCategoryConfig,
  FinanceKind,
  FinanceTransaction,
  FinanceTransactionStatus,
  HouseholdMember,
} from '../../types/domain';
import { todayDateString } from '../../utils/units';
import {
  addYearsToDateString,
  clampDayToMonth,
  deleteFinanceTransaction,
  saveFinanceTransaction,
} from './financeService';

interface FinanceTransactionModalProps {
  open: boolean;
  onClose: () => void;
  editingTransaction: FinanceTransaction | null;
  activeMonth: string;
  categories: FinanceCategoryConfig[];
  members: HouseholdMember[];
  deviceId: string;
  initialKind?: FinanceKind;
  initialWarrantyMode?: boolean;
  initialPhotoAttachmentId?: string | null;
  onSaved?: (msg: string) => void;
}

function defaultDateForMonth(activeMonth: string): string {
  const today = todayDateString();
  if (today.startsWith(activeMonth)) return today;
  return clampDayToMonth(activeMonth, 1);
}

function pickDefaultCategoryId(
  categories: FinanceCategoryConfig[],
  kind: FinanceKind,
  warrantyMode: boolean,
): string {
  if (warrantyMode) {
    const tech = categories.find((c) => c.id === 'fin-cat-home-tech');
    if (tech) return tech.id;
  }
  const matching = categories.filter((c) => c.kind === kind);
  return matching[0]?.id ?? categories[0]?.id ?? 'fin-cat-other-variable';
}

export function FinanceTransactionModal({
  open,
  onClose,
  editingTransaction,
  activeMonth,
  categories,
  members,
  deviceId,
  initialKind = 'variable',
  initialWarrantyMode = false,
  initialPhotoAttachmentId = null,
  onSaved,
}: FinanceTransactionModalProps) {
  const [kind, setKind] = useState<FinanceKind>(initialKind);
  const [title, setTitle] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(() => defaultDateForMonth(activeMonth));
  const [status, setStatus] = useState<FinanceTransactionStatus>('paid');
  const [memberId, setMemberId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [photoAttachmentId, setPhotoAttachmentId] = useState<string | null>(null);
  const [isWarranty, setIsWarranty] = useState(false);
  const [warrantyStore, setWarrantyStore] = useState('');
  const [warrantyExpiresAt, setWarrantyExpiresAt] = useState('');
  const [includeInMonthlyTotals, setIncludeInMonthlyTotals] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirmDelete(false);

    if (editingTransaction) {
      setKind(editingTransaction.kind);
      setTitle(editingTransaction.title);
      setAmountInput(
        editingTransaction.amount > 0 ? String(editingTransaction.amount).replace('.', ',') : '',
      );
      setCategoryId(editingTransaction.categoryId);
      setDate(editingTransaction.date);
      setStatus(editingTransaction.status);
      setMemberId(editingTransaction.memberId ?? '');
      setNotes(editingTransaction.notes);
      setPhotoAttachmentId(editingTransaction.photoAttachmentId);
      setIsWarranty(editingTransaction.isWarranty);
      setWarrantyStore(editingTransaction.warrantyStore);
      setWarrantyExpiresAt(editingTransaction.warrantyExpiresAt ?? '');
      setIncludeInMonthlyTotals(!editingTransaction.excludeFromTotals);
      return;
    }

    const startKind: FinanceKind = initialWarrantyMode ? 'variable' : initialKind;
    const startDate = initialWarrantyMode ? todayDateString() : defaultDateForMonth(activeMonth);
    setKind(startKind);
    setTitle('');
    setAmountInput('');
    setCategoryId(pickDefaultCategoryId(categories, startKind, initialWarrantyMode));
    setDate(startDate);
    setStatus('paid');
    setMemberId('');
    setNotes('');
    setPhotoAttachmentId(initialPhotoAttachmentId ?? null);
    setIsWarranty(initialWarrantyMode);
    setWarrantyStore('');
    setWarrantyExpiresAt(initialWarrantyMode ? addYearsToDateString(startDate, 3) : '');
    setIncludeInMonthlyTotals(!initialWarrantyMode);
  }, [
    open,
    editingTransaction,
    activeMonth,
    categories,
    initialKind,
    initialWarrantyMode,
    initialPhotoAttachmentId,
  ]);

  const filteredCategories = useMemo(() => {
    const byKind = categories.filter((c) => c.kind === kind);
    return byKind.length > 0 ? byKind : categories;
  }, [categories, kind]);

  const handleChangeKind = (nextKind: FinanceKind) => {
    setKind(nextKind);
    const matchesCurrent = categories.some((c) => c.id === categoryId && c.kind === nextKind);
    if (!matchesCurrent) {
      setCategoryId(pickDefaultCategoryId(categories, nextKind, false));
    }
    if (nextKind === 'income') {
      setIsWarranty(false);
    }
  };

  const handleToggleWarranty = (checked: boolean) => {
    setIsWarranty(checked);
    if (checked && !warrantyExpiresAt) {
      setWarrantyExpiresAt(addYearsToDateString(date || todayDateString(), 3));
    }
    if (!checked) {
      setIncludeInMonthlyTotals(true);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Indica uma descrição (ex.: Supermercado, Ordenado, Máquina de café).');
      return;
    }

    const parsedAmount = Number(amountInput.trim().replace(',', '.'));
    const hasAmount = amountInput.trim().length > 0;
    if (hasAmount && (Number.isNaN(parsedAmount) || parsedAmount < 0)) {
      setError('Indica um valor válido em euros.');
      return;
    }
    if (!isWarranty && (!hasAmount || parsedAmount <= 0)) {
      setError('Indica um valor maior que 0 €.');
      return;
    }

    setSaving(true);
    try {
      await saveFinanceTransaction(
        {
          id: editingTransaction?.id,
          title: trimmedTitle,
          kind,
          categoryId: categoryId || pickDefaultCategoryId(categories, kind, isWarranty),
          amount: hasAmount ? parsedAmount : 0,
          date: date || todayDateString(),
          status,
          recurringRuleId: editingTransaction?.recurringRuleId ?? null,
          memberId: memberId || null,
          notes,
          photoAttachmentId,
          isWarranty,
          warrantyExpiresAt: isWarranty ? warrantyExpiresAt || null : null,
          warrantyStore: isWarranty ? warrantyStore : '',
          excludeFromTotals: isWarranty ? !includeInMonthlyTotals : false,
        },
        deviceId,
      );
      onSaved?.(
        editingTransaction
          ? 'Registo atualizado.'
          : isWarranty && !includeInMonthlyTotals
            ? 'Garantia guardada.'
            : 'Movimento registado.',
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTransaction) return;
    setSaving(true);
    try {
      await deleteFinanceTransaction(editingTransaction, deviceId);
      onSaved?.('Registo removido.');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = editingTransaction
    ? editingTransaction.isWarranty && editingTransaction.excludeFromTotals
      ? 'Editar garantia'
      : 'Editar movimento'
    : initialWarrantyMode
      ? 'Nova garantia'
      : 'Registar movimento';

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} maxWidthClass="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Tipo */}
        {!initialWarrantyMode && (
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1">
            {(
              [
                { id: 'variable', label: 'Variável', activeClass: 'bg-white text-rose-700 shadow-xs' },
                { id: 'fixed', label: 'Fixa', activeClass: 'bg-white text-amber-800 shadow-xs' },
                { id: 'income', label: 'Receita', activeClass: 'bg-white text-emerald-700 shadow-xs' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleChangeKind(opt.id)}
                className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                  kind === opt.id ? opt.activeClass : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Descrição e Valor */}
        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {initialWarrantyMode ? 'Produto / Equipamento' : 'Descrição'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                initialWarrantyMode
                  ? 'Ex.: Máquina de lavar, TV Sala, Aspirador...'
                  : kind === 'income'
                    ? 'Ex.: Ordenado, Subsídio de férias...'
                    : 'Ex.: Continente, Farmácia, Luz EDP...'
              }
              autoFocus
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Valor (€) {isWarranty ? <span className="font-normal text-slate-400">(opc.)</span> : ''}
            </label>
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

        {/* Categoria e Data */}
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
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {isWarranty ? 'Data da compra' : 'Data'}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Estado e Membro */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Estado</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setStatus('paid')}
                className={`inline-flex items-center justify-center gap-1 rounded-xl border py-2 text-xs font-semibold transition ${
                  status === 'paid'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {kind === 'income' ? 'Recebido' : 'Pago'}
              </button>
              <button
                type="button"
                onClick={() => setStatus('planned')}
                className={`rounded-xl border py-2 text-xs font-semibold transition ${
                  status === 'planned'
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Previsto
              </button>
            </div>
          </div>

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
        </div>

        {/* Garantia (apenas para despesas) */}
        {kind !== 'income' && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
            <label className="flex cursor-pointer items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <ShieldCheck className="h-4 w-4 text-teal-700" aria-hidden="true" />
                Guardar garantia deste produto
              </span>
              <input
                type="checkbox"
                checked={isWarranty}
                onChange={(e) => handleToggleWarranty(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
              />
            </label>

            {isWarranty && (
              <div className="space-y-2.5 pt-1">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                      Loja / Marca
                    </label>
                    <input
                      type="text"
                      value={warrantyStore}
                      onChange={(e) => setWarrantyStore(e.target.value)}
                      placeholder="Ex.: Worten, Amazon, IKEA..."
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                      Garantia válida até
                    </label>
                    <input
                      type="date"
                      value={warrantyExpiresAt}
                      onChange={(e) => setWarrantyExpiresAt(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-500">Atalhos desde a compra:</span>
                  {[2, 3, 5].map((yrs) => (
                    <button
                      key={yrs}
                      type="button"
                      onClick={() =>
                        setWarrantyExpiresAt(addYearsToDateString(date || todayDateString(), yrs))
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:border-teal-400 hover:text-teal-700"
                    >
                      +{yrs} anos
                    </button>
                  ))}
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={includeInMonthlyTotals}
                    onChange={(e) => setIncludeInMonthlyTotals(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                  />
                  <span>Contar também nas despesas do mês ({date.slice(0, 7)})</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Foto da fatura / talão / garantia */}
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">
            {isWarranty ? 'Foto da fatura / talão de garantia' : 'Foto de fatura / talão (opcional)'}
          </span>
          <CameraPhotoControl
            attachmentId={photoAttachmentId}
            alt={title || 'Fatura'}
            onChange={setPhotoAttachmentId}
          />
        </div>

        {/* Notas */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            Notas <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="N.º de série, detalhes da compra, referência..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </p>
        )}

        {/* Rodapé */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {editingTransaction ? (
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
              {saving ? 'A guardar...' : editingTransaction ? 'Guardar' : 'Registar'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
