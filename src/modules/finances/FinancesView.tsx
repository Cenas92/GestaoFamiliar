import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Paperclip,
  PieChart,
  Plus,
  Repeat,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  X,
} from 'lucide-react';
import { AttachmentImage } from '../../components/AttachmentPreview';
import { SearchInput } from '../../components/SearchInput';
import { TypeIconBadge } from '../../components/TypeIconBadge';
import type {
  FinanceCategoryConfig,
  FinanceKind,
  FinanceRecurringRule,
  FinanceTransaction,
  FinanceTransactionStatus,
  HouseholdMember,
} from '../../types/domain';
import { saveImageAttachment } from '../../utils/attachmentStorage';
import { getSectionColorStyle } from '../../utils/sectionVisuals';
import { formatDatePt, todayDateString } from '../../utils/units';
import {
  FINANCE_PREFS_STORAGE_KEY,
  loadCollectionPreferences,
  saveCollectionPreferences,
  shouldExpandPanelsByDefault,
  type CollectionViewMode,
  type UiDensityMode,
} from '../../utils/viewPrefs';
import { FinanceBudgetsModal } from './FinanceBudgetsModal';
import { FinanceRecurringModal } from './FinanceRecurringModal';
import {
  buildCategoryBudgetProgress,
  buildMonthlyFinanceHistory,
  buildRecurringInstanceId,
  currentMonthString,
  ensureRecurringTransactionsForMonth,
  formatMonthLabelPt,
  formatMonthShortPt,
  getNextDueMonthForRule,
  getWarrantyStatus,
  isRecurringRuleDueInMonth,
  shiftMonth,
  summarizeMonthFinances,
  toggleFinanceTransactionPaid,
  type WarrantyStatus,
} from './financeService';
import { FinanceTransactionModal } from './FinanceTransactionModal';
import {
  FINANCE_FREQUENCY_LABELS,
  FINANCE_KIND_LABELS,
  formatEur,
  formatSignedEur,
  getFinanceCategoryVisual,
} from './financeVisuals';

export type FinanceSubTab = 'transactions' | 'recurring' | 'summary' | 'warranties';
type FinanceSortMode = 'date_desc' | 'amount_desc' | 'title_asc';

const VALID_FINANCE_SORTS: readonly FinanceSortMode[] = ['date_desc', 'amount_desc', 'title_asc'];

interface FinancesViewProps {
  categories: FinanceCategoryConfig[];
  recurringRules: FinanceRecurringRule[];
  transactions: FinanceTransaction[];
  members: HouseholdMember[];
  deviceId: string;
  uiDensity?: UiDensityMode;
  activeMonth: string;
  onActiveMonthChange: (month: string) => void;
}

export function FinancesView({
  categories,
  recurringRules,
  transactions,
  members,
  deviceId,
  uiDensity = 'clean',
  activeMonth,
  onActiveMonthChange,
}: FinancesViewProps) {
  const isComplete = uiDensity === 'complete';
  const today = todayDateString();
  const thisMonth = currentMonthString(today);

  const [subTab, setSubTab] = useState<FinanceSubTab>('transactions');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<FinanceKind | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<FinanceTransactionStatus | 'all'>('all');
  const [warrantyFilter, setWarrantyFilter] = useState<'all' | WarrantyStatus>('all');
  const [warrantySearch, setWarrantySearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(() => shouldExpandPanelsByDefault(uiDensity));

  const [prefs, setPrefs] = useState(() =>
    loadCollectionPreferences<FinanceSortMode>(
      FINANCE_PREFS_STORAGE_KEY,
      VALID_FINANCE_SORTS,
      { viewMode: 'line', sortMode: 'date_desc', groupEnabled: false },
      undefined,
      uiDensity,
    ),
  );

  // Modals state
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinanceTransaction | null>(null);
  const [txInitialKind, setTxInitialKind] = useState<FinanceKind>('variable');
  const [txWarrantyMode, setTxWarrantyMode] = useState(false);
  const [txInitialPhotoId, setTxInitialPhotoId] = useState<string | null>(null);

  const [recurringModalOpen, setRecurringModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FinanceRecurringRule | null>(null);
  const [recurringInitialKind, setRecurringInitialKind] = useState<'income' | 'fixed'>('fixed');
  const [budgetsModalOpen, setBudgetsModalOpen] = useState(false);
  const [historyMonths, setHistoryMonths] = useState<6 | 12>(6);

  const [toast, setToast] = useState<string | null>(null);
  const [capturingPhoto, setCapturingPhoto] = useState(false);

  const prevDensityRef = useRef(uiDensity);
  useEffect(() => {
    if (prevDensityRef.current !== uiDensity) {
      prevDensityRef.current = uiDensity;
      setFiltersOpen(shouldExpandPanelsByDefault(uiDensity));
      setPrefs(
        loadCollectionPreferences<FinanceSortMode>(
          FINANCE_PREFS_STORAGE_KEY,
          VALID_FINANCE_SORTS,
          { viewMode: 'line', sortMode: 'date_desc', groupEnabled: false },
          undefined,
          uiDensity,
        ),
      );
    }
  }, [uiDensity]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  // Auto-project recurring rules whenever activeMonth or active rules change
  const activeRulesSignature = useMemo(
    () =>
      recurringRules
        .map((r) => `${r.id}:${r.updatedAt}:${r.isActive ? 1 : 0}`)
        .join('|'),
    [recurringRules],
  );

  useEffect(() => {
    if (!deviceId || recurringRules.length === 0) return;
    void ensureRecurringTransactionsForMonth(activeMonth, deviceId);
  }, [activeMonth, deviceId, activeRulesSignature, recurringRules.length]);

  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const membersById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );
  const transactionsById = useMemo(
    () => new Map(transactions.map((t) => [t.id, t])),
    [transactions],
  );

  const monthSummary = useMemo(
    () => summarizeMonthFinances(activeMonth, transactions, categories),
    [activeMonth, transactions, categories],
  );

  const budgetProgress = useMemo(
    () => buildCategoryBudgetProgress(activeMonth, transactions, categories),
    [activeMonth, transactions, categories],
  );

  const alertBudgetCount = useMemo(
    () => budgetProgress.filter((b) => b.status === 'warning' || b.status === 'exceeded').length,
    [budgetProgress],
  );

  const monthlyHistory = useMemo(
    () => buildMonthlyFinanceHistory(activeMonth, historyMonths, transactions),
    [activeMonth, historyMonths, transactions],
  );

  const monthTransactions = useMemo(() => {
    return transactions.filter((t) => !t.excludeFromTotals && t.month === activeMonth);
  }, [transactions, activeMonth]);

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = monthTransactions.filter((tx) => {
      if (kindFilter !== 'all' && tx.kind !== kindFilter) return false;
      if (categoryFilter !== 'all' && tx.categoryId !== categoryFilter) return false;
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
      if (q) {
        const catName = categoriesById.get(tx.categoryId)?.name.toLowerCase() ?? '';
        const memberName = tx.memberId ? (membersById.get(tx.memberId)?.name.toLowerCase() ?? '') : '';
        const matches =
          tx.title.toLowerCase().includes(q) ||
          tx.notes.toLowerCase().includes(q) ||
          tx.warrantyStore.toLowerCase().includes(q) ||
          catName.includes(q) ||
          memberName.includes(q);
        if (!matches) return false;
      }
      return true;
    });

    return list.slice().sort((a, b) => {
      if (prefs.sortMode === 'amount_desc') {
        return b.amount - a.amount || b.date.localeCompare(a.date);
      }
      if (prefs.sortMode === 'title_asc') {
        return a.title.localeCompare(b.title, 'pt-PT');
      }
      // date_desc: planned first on equal date, newest date first
      return b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [
    monthTransactions,
    kindFilter,
    categoryFilter,
    statusFilter,
    search,
    categoriesById,
    membersById,
    prefs.sortMode,
  ]);

  const allWarranties = useMemo(() => {
    return transactions
      .filter((t) => t.isWarranty)
      .map((tx) => ({
        tx,
        info: getWarrantyStatus(tx.warrantyExpiresAt, today),
      }))
      .sort((a, b) => {
        // Expiring soon first, then active closest to expiry, then no_expiry, then expired
        const rank: Record<WarrantyStatus, number> = {
          expiring_soon: 0,
          active: 1,
          no_expiry: 2,
          expired: 3,
        };
        if (rank[a.info.status] !== rank[b.info.status]) {
          return rank[a.info.status] - rank[b.info.status];
        }
        return (a.tx.warrantyExpiresAt ?? '9999-12-31').localeCompare(
          b.tx.warrantyExpiresAt ?? '9999-12-31',
        );
      });
  }, [transactions, today]);

  const filteredWarranties = useMemo(() => {
    const q = warrantySearch.trim().toLowerCase();
    return allWarranties.filter(({ tx, info }) => {
      if (warrantyFilter !== 'all' && info.status !== warrantyFilter) return false;
      if (q) {
        const matches =
          tx.title.toLowerCase().includes(q) ||
          tx.warrantyStore.toLowerCase().includes(q) ||
          tx.notes.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [allWarranties, warrantyFilter, warrantySearch]);

  const incomeRules = useMemo(
    () => recurringRules.filter((r) => r.kind === 'income'),
    [recurringRules],
  );
  const fixedRules = useMemo(
    () => recurringRules.filter((r) => r.kind === 'fixed'),
    [recurringRules],
  );

  const activeFilterCount =
    (kindFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0);

  const updatePrefs = (patch: Partial<{ viewMode: CollectionViewMode; sortMode: FinanceSortMode }>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveCollectionPreferences(FINANCE_PREFS_STORAGE_KEY, next);
  };

  const openNewTransaction = (
    kind: FinanceKind = 'variable',
    warrantyMode = false,
    photoId: string | null = null,
  ) => {
    setEditingTx(null);
    setTxInitialKind(kind);
    setTxWarrantyMode(warrantyMode);
    setTxInitialPhotoId(photoId);
    setTxModalOpen(true);
  };

  const openEditTransaction = (tx: FinanceTransaction) => {
    setEditingTx(tx);
    setTxWarrantyMode(false);
    setTxInitialPhotoId(null);
    setTxModalOpen(true);
  };

  const openNewRecurring = (kind: 'income' | 'fixed' = 'fixed') => {
    setEditingRule(null);
    setRecurringInitialKind(kind);
    setRecurringModalOpen(true);
  };

  const openEditRecurring = (rule: FinanceRecurringRule) => {
    setEditingRule(rule);
    setRecurringModalOpen(true);
  };

  const handleQuickCameraCapture = async (
    e: ChangeEvent<HTMLInputElement>,
    asWarranty: boolean,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCapturingPhoto(true);
    try {
      const saved = await saveImageAttachment(file);
      openNewTransaction('variable', asWarranty, saved.id);
    } finally {
      setCapturingPhoto(false);
    }
  };

  const handleTogglePaid = async (tx: FinanceTransaction) => {
    const updated = await toggleFinanceTransactionPaid(tx, deviceId);
    showToast(
      updated.status === 'paid'
        ? updated.kind === 'income'
          ? 'Marcado como recebido.'
          : 'Marcado como pago.'
        : 'Voltou a «Previsto».',
    );
  };

  const expenseRatio =
    monthSummary.incomeTotal > 0
      ? Math.min(100, Math.round((monthSummary.expensesTotal / monthSummary.incomeTotal) * 100))
      : monthSummary.expensesTotal > 0
        ? 100
        : 0;

  return (
    <div className="space-y-3">
      {toast && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-900">
          {toast}
        </div>
      )}

      {/* Linha 1: Seletor de mês + Ações principais */}
      <div className="flex flex-nowrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onActiveMonthChange(shiftMonth(activeMonth, -1))}
            aria-label="Mês anterior"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="truncate px-1.5 text-sm font-bold text-slate-900">
            {formatMonthLabelPt(activeMonth)}
          </span>
          <button
            type="button"
            onClick={() => onActiveMonthChange(shiftMonth(activeMonth, 1))}
            aria-label="Mês seguinte"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {activeMonth !== thisMonth && (
            <button
              type="button"
              onClick={() => onActiveMonthChange(thisMonth)}
              className="ml-0.5 shrink-0 rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-100"
            >
              Hoje
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {subTab === 'warranties' ? (
            <>
              <label
                title="Fotografar fatura de garantia"
                className="inline-flex h-8 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Camera className="h-4 w-4 text-teal-700" aria-hidden="true" />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={capturingPhoto}
                  aria-label="Fotografar garantia com câmara"
                  onChange={(e) => handleQuickCameraCapture(e, true)}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => openNewTransaction('variable', true)}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl bg-teal-700 px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-800"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Garantia</span>
              </button>
            </>
          ) : subTab === 'recurring' ? (
            <button
              type="button"
              onClick={() => openNewRecurring('fixed')}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl bg-teal-700 px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-800"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Nova fixa</span>
            </button>
          ) : (
            <>
              <label
                title="Fotografar talão / fatura"
                className="inline-flex h-8 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Camera className="h-4 w-4 text-teal-700" aria-hidden="true" />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={capturingPhoto}
                  aria-label="Fotografar talão ou fatura com câmara"
                  onChange={(e) => handleQuickCameraCapture(e, false)}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => openNewTransaction('variable', false)}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl bg-teal-700 px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-800"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Registar</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cartão Resumo do Mês */}
      {subTab !== 'warranties' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="grid grid-cols-3 gap-2 text-center sm:text-left">
            <div>
              <p className="text-[11px] font-medium text-slate-500">Entradas</p>
              <p className="mt-0.5 text-sm font-bold text-emerald-700 sm:text-base">
                {formatEur(monthSummary.incomeTotal)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Saídas</p>
              <p className="mt-0.5 text-sm font-bold text-rose-700 sm:text-base">
                {formatEur(monthSummary.expensesTotal)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Saldo</p>
              <p
                className={`mt-0.5 text-sm font-bold sm:text-base ${
                  monthSummary.balanceTotal >= 0 ? 'text-teal-800' : 'text-rose-700'
                }`}
              >
                {formatEur(monthSummary.balanceTotal)}
              </p>
            </div>
          </div>

          {/* Barra proporcional limpa */}
          {(monthSummary.incomeTotal > 0 || monthSummary.expensesTotal > 0) && (
            <div className="mt-2.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    monthSummary.balanceTotal < 0
                      ? 'bg-rose-500'
                      : expenseRatio >= 85
                        ? 'bg-amber-500'
                        : 'bg-teal-600'
                  }`}
                  style={{ width: `${expenseRatio}%` }}
                />
              </div>
              {isComplete && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span>
                    Fixas: <strong className="text-slate-700">{formatEur(monthSummary.fixedTotal)}</strong> ·
                    Variáveis:{' '}
                    <strong className="text-slate-700">{formatEur(monthSummary.variableTotal)}</strong>
                  </span>
                  <span>
                    Pago: <strong className="text-slate-700">{formatEur(monthSummary.expensesPaid)}</strong>
                    {monthSummary.expensesPlanned > 0 && (
                      <>
                        {' '}
                        · Por pagar:{' '}
                        <strong className="text-amber-700">
                          {formatEur(monthSummary.expensesPlanned)}
                        </strong>
                      </>
                    )}
                  </span>
                </div>
              )}
              {isComplete && alertBudgetCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSubTab('summary')}
                  className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                >
                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>
                    {alertBudgetCount === 1
                      ? '1 orçamento em alerta este mês'
                      : `${alertBudgetCount} orçamentos em alerta este mês`}
                  </span>
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Sub-abas horizontais limpas */}
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {(
          [
            {
              id: 'transactions',
              label: `Movimentos (${monthTransactions.length})`,
              Icon: Clock,
            },
            {
              id: 'recurring',
              label: `Fixas (${recurringRules.length})`,
              Icon: Repeat,
            },
            {
              id: 'summary',
              label: 'Resumo',
              Icon: PieChart,
            },
            {
              id: 'warranties',
              label: `Garantias (${allWarranties.length})`,
              Icon: ShieldCheck,
            },
          ] as const
        ).map((tab) => {
          const active = subTab === tab.id;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= SUB-ABA: MOVIMENTOS ================= */}
      {subTab === 'transactions' && (
        <div className="space-y-2.5">
          {/* Pesquisa + botão Filtros e vista */}
          <div className="flex items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Pesquisar movimento, categoria ou nota..."
            />
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              aria-expanded={filtersOpen}
              className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
                filtersOpen || activeFilterCount > 0
                  ? 'border-teal-300 bg-teal-50 text-teal-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Filtros e vista</span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-teal-700 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Chips rápidos quando painel fechado e há filtros ativos */}
          {!filtersOpen && activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {kindFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setKindFilter('all')}
                  className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800"
                >
                  {FINANCE_KIND_LABELS[kindFilter]}
                  <X className="h-3 w-3" />
                </button>
              )}
              {categoryFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800"
                >
                  {categoriesById.get(categoryFilter)?.name ?? 'Categoria'}
                  <X className="h-3 w-3" />
                </button>
              )}
              {statusFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800"
                >
                  {statusFilter === 'paid' ? 'Pagos / Recebidos' : 'Previstos'}
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Painel recolhível único Filtros e vista */}
          {filtersOpen && (
            <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <select
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value as FinanceKind | 'all')}
                  aria-label="Filtrar por tipo"
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700"
                >
                  <option value="all">Tipo: Todos</option>
                  <option value="variable">Despesas variáveis</option>
                  <option value="fixed">Despesas fixas</option>
                  <option value="income">Receitas</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filtrar por categoria"
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700"
                >
                  <option value="all">Categoria: Todas</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as FinanceTransactionStatus | 'all')
                  }
                  aria-label="Filtrar por estado"
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700"
                >
                  <option value="all">Estado: Todos</option>
                  <option value="paid">Pago / Recebido</option>
                  <option value="planned">Previsto</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold text-slate-500">Vista:</span>
                  {(
                    [
                      { id: 'line', label: 'Em linha' },
                      { id: 'medium', label: 'Padrão' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePrefs({ viewMode: opt.id })}
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                        prefs.viewMode === opt.id
                          ? 'bg-teal-50 text-teal-800'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Ordenar:</span>
                  <select
                    value={prefs.sortMode}
                    onChange={(e) => updatePrefs({ sortMode: e.target.value as FinanceSortMode })}
                    aria-label="Ordenar movimentos"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700"
                  >
                    <option value="date_desc">Mais recentes</option>
                    <option value="amount_desc">Maior valor</option>
                    <option value="title_asc">Nome (A–Z)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Lista de movimentos */}
          {filteredTransactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
              <p className="text-sm font-semibold text-slate-700">
                {monthTransactions.length === 0
                  ? `Ainda sem movimentos em ${formatMonthLabelPt(activeMonth)}.`
                  : 'Nenhum movimento corresponde aos filtros.'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {monthTransactions.length === 0
                  ? 'Regista despesas do dia a dia ou cria os teus ordenados e despesas fixas na aba «Fixas».'
                  : 'Limpa a pesquisa ou ajusta os filtros para ver mais registos.'}
              </p>
              {monthTransactions.length === 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => openNewTransaction('variable', false)}
                    className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Registar despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSubTab('recurring');
                      openNewRecurring('income');
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Repeat className="h-3.5 w-3.5" />
                    Configurar ordenados / fixas
                  </button>
                </div>
              )}
            </div>
          ) : prefs.viewMode === 'line' ? (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {filteredTransactions.map((tx) => {
                const cat = categoriesById.get(tx.categoryId);
                const visual = getFinanceCategoryVisual(cat);
                const member = tx.memberId ? membersById.get(tx.memberId) : null;
                const isPaid = tx.status === 'paid';

                return (
                  <div
                    key={tx.id}
                    className={`flex items-center gap-2.5 px-3 py-2.5 transition hover:bg-slate-50/70 ${
                      !isPaid ? 'bg-amber-50/25' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => openEditTransaction(tx)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <TypeIconBadge visual={visual} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-slate-900">
                            {tx.title}
                          </span>
                          {tx.recurringRuleId && (
                            <Repeat
                              className="h-3 w-3 shrink-0 text-slate-400"
                              aria-label="Recorrente"
                            />
                          )}
                          {tx.photoAttachmentId && (
                            <Paperclip
                              className="h-3 w-3 shrink-0 text-slate-400"
                              aria-label="Com fatura anexada"
                            />
                          )}
                          {tx.isWarranty && (
                            <ShieldCheck
                              className="h-3.5 w-3.5 shrink-0 text-teal-600"
                              aria-label="Com garantia"
                            />
                          )}
                        </div>
                        <p className="truncate text-[11px] text-slate-500">
                          {cat?.name ?? 'Sem categoria'} · {formatDatePt(tx.date)}
                          {member ? ` · ${member.name}` : ''}
                        </p>
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditTransaction(tx)}
                        className={`text-right text-sm font-bold tabular-nums ${
                          tx.kind === 'income'
                            ? 'text-emerald-700'
                            : isPaid
                              ? 'text-slate-900'
                              : 'text-slate-500'
                        }`}
                      >
                        {formatSignedEur(tx.amount, tx.kind)}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTogglePaid(tx)}
                        aria-label={
                          isPaid
                            ? `Marcar ${tx.title} como previsto`
                            : `Marcar ${tx.title} como ${tx.kind === 'income' ? 'recebido' : 'pago'}`
                        }
                        title={
                          isPaid
                            ? tx.kind === 'income'
                              ? 'Recebido (tocar para voltar a previsto)'
                              : 'Pago (tocar para voltar a previsto)'
                            : 'Previsto (tocar para marcar como pago)'
                        }
                        className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                          isPaid
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border-amber-300 bg-white text-amber-600 hover:bg-amber-50'
                        }`}
                      >
                        {isPaid ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((tx) => {
                const cat = categoriesById.get(tx.categoryId);
                const visual = getFinanceCategoryVisual(cat);
                const member = tx.memberId ? membersById.get(tx.memberId) : null;
                const isPaid = tx.status === 'paid';

                return (
                  <div
                    key={tx.id}
                    className={`rounded-2xl border bg-white p-3 shadow-xs transition ${
                      isPaid ? 'border-slate-200' : 'border-amber-200 bg-amber-50/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <button
                        type="button"
                        onClick={() => openEditTransaction(tx)}
                        className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                      >
                        <TypeIconBadge visual={visual} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-bold text-slate-900">
                              {tx.title}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {FINANCE_KIND_LABELS[tx.kind]}
                            </span>
                            {tx.isWarranty && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                                <ShieldCheck className="h-3 w-3" />
                                Garantia
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {cat?.name ?? 'Sem categoria'} · {formatDatePt(tx.date)}
                            {member ? ` · ${member.name}` : ''}
                            {tx.photoAttachmentId ? ' · Fatura anexada' : ''}
                          </p>
                          {tx.notes && (
                            <p className="mt-1 line-clamp-1 text-xs text-slate-600">{tx.notes}</p>
                          )}
                        </div>
                      </button>

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            tx.kind === 'income' ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {formatSignedEur(tx.amount, tx.kind)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleTogglePaid(tx)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                            isPaid
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                          }`}
                        >
                          {isPaid ? (
                            <>
                              <Check className="h-3 w-3" />
                              {tx.kind === 'income' ? 'Recebido' : 'Pago'}
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3" />
                              Marcar {tx.kind === 'income' ? 'recebido' : 'pago'}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= SUB-ABA: FIXAS & ORDENADOS ================= */}
      {subTab === 'recurring' && (
        <div className="space-y-3">
          {recurringRules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Ainda sem ordenados ou despesas fixas configuradas.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Adiciona ordenados, prestação da casa, luz, água, seguros ou IUC. A app projeta-os
                automaticamente em cada mês aplicável.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => openNewRecurring('income')}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar ordenado
                </button>
                <button
                  type="button"
                  onClick={() => openNewRecurring('fixed')}
                  className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar despesa fixa
                </button>
              </div>
            </div>
          ) : (
            <>
              {(
                [
                  {
                    key: 'income',
                    title: 'Ordenados e Receitas Fixas',
                    rules: incomeRules,
                    addKind: 'income' as const,
                    addLabel: '+ Ordenado',
                  },
                  {
                    key: 'fixed',
                    title: 'Despesas Fixas & Periódicas',
                    rules: fixedRules,
                    addKind: 'fixed' as const,
                    addLabel: '+ Despesa fixa',
                  },
                ] as const
              ).map((group) => (
                <section key={group.key} className="space-y-1.5">
                  <div className="flex flex-nowrap items-center justify-between gap-2">
                    <h2 className="truncate text-xs font-bold uppercase tracking-wide text-slate-500">
                      {group.title} ({group.rules.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => openNewRecurring(group.addKind)}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-50"
                    >
                      {group.addLabel}
                    </button>
                  </div>

                  {group.rules.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-400">
                      Nenhum registo nesta secção.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      {group.rules.map((rule) => {
                        const cat = categoriesById.get(rule.categoryId);
                        const visual = getFinanceCategoryVisual(cat);
                        const dueThisMonth = isRecurringRuleDueInMonth(rule, activeMonth);
                        const instanceId = buildRecurringInstanceId(rule.id, activeMonth);
                        const monthInstance = transactionsById.get(instanceId);
                        const nextDue = !dueThisMonth
                          ? getNextDueMonthForRule(rule, activeMonth)
                          : null;

                        return (
                          <div
                            key={rule.id}
                            className={`flex items-center gap-2.5 px-3 py-2.5 ${
                              !rule.isActive ? 'opacity-55' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => openEditRecurring(rule)}
                              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                            >
                              <TypeIconBadge visual={visual} size="sm" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-sm font-semibold text-slate-900">
                                    {rule.title}
                                  </span>
                                  {rule.frequency !== 'monthly' && (
                                    <span className="shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                                      {FINANCE_FREQUENCY_LABELS[rule.frequency]}
                                    </span>
                                  )}
                                  {!rule.isActive && (
                                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                                      Pausada
                                    </span>
                                  )}
                                </div>
                                <p className="truncate text-[11px] text-slate-500">
                                  Dia {rule.dayOfMonth} · {cat?.name ?? 'Sem categoria'}
                                  {nextDue ? ` · Próxima: ${formatMonthShortPt(nextDue)}` : ''}
                                </p>
                              </div>
                            </button>

                            <div className="flex shrink-0 items-center gap-2">
                              <span
                                className={`text-sm font-bold tabular-nums ${
                                  rule.kind === 'income' ? 'text-emerald-700' : 'text-slate-900'
                                }`}
                              >
                                {formatEur(monthInstance?.amount ?? rule.amount)}
                              </span>

                              {dueThisMonth && monthInstance ? (
                                <button
                                  type="button"
                                  onClick={() => handleTogglePaid(monthInstance)}
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                                    monthInstance.status === 'paid'
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                  }`}
                                >
                                  {monthInstance.status === 'paid' ? (
                                    <>
                                      <Check className="h-3 w-3" />
                                      {rule.kind === 'income' ? 'Recebido' : 'Pago'}
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="h-3 w-3" />
                                      Previsto
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                                  <CalendarClock className="h-3 w-3" />
                                  {rule.isActive ? 'Noutro mês' : 'Inativa'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </>
          )}
        </div>
      )}

      {/* ================= SUB-ABA: RESUMO ================= */}
      {subTab === 'summary' && (
        <div className="space-y-3">
          {/* Divisão Estrutural */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] font-medium text-slate-500">Fixas</p>
              <p className="mt-0.5 text-sm font-bold text-slate-900">
                {formatEur(monthSummary.fixedTotal)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Pago: {formatEur(monthSummary.fixedPaid)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] font-medium text-slate-500">Variáveis</p>
              <p className="mt-0.5 text-sm font-bold text-slate-900">
                {formatEur(monthSummary.variableTotal)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Pago: {formatEur(monthSummary.variablePaid)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] font-medium text-slate-500">Por pagar</p>
              <p className="mt-0.5 text-sm font-bold text-amber-700">
                {formatEur(monthSummary.expensesPlanned)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">Previsto este mês</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] font-medium text-slate-500">Taxa poupança</p>
              <p
                className={`mt-0.5 text-sm font-bold ${
                  (monthSummary.savingsRate ?? 0) >= 0 ? 'text-teal-700' : 'text-rose-700'
                }`}
              >
                {monthSummary.savingsRate !== null ? `${monthSummary.savingsRate}%` : '—'}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">Saldo sobre entradas</p>
            </div>
          </div>

          {/* Orçamentos mensais por categoria */}
          <section className="rounded-2xl border border-slate-200 bg-white p-3.5">
            <div className="flex flex-nowrap items-center justify-between gap-2">
              <h2 className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-bold uppercase tracking-wide text-slate-500">
                <Target className="h-3.5 w-3.5 shrink-0 text-teal-700" aria-hidden="true" />
                <span className="truncate">Orçamentos mensais</span>
              </h2>
              <button
                type="button"
                onClick={() => setBudgetsModalOpen(true)}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-50"
              >
                {budgetProgress.length > 0 ? 'Ajustar limites' : 'Definir limites'}
              </button>
            </div>

            {budgetProgress.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">
                Define limites mensais (ex.: Supermercado 450 €, Combustível 150 €) para acompanhar
                o progresso por categoria.
              </p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {budgetProgress.map((item) => {
                  const visual = getFinanceCategoryVisual(item.category);
                  const barColor =
                    item.status === 'exceeded'
                      ? 'bg-rose-500'
                      : item.status === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-teal-600';
                  const statusTextClass =
                    item.status === 'exceeded'
                      ? 'text-rose-700'
                      : item.status === 'warning'
                        ? 'text-amber-700'
                        : 'text-emerald-700';

                  return (
                    <button
                      key={item.category.id}
                      type="button"
                      onClick={() => {
                        setCategoryFilter(item.category.id);
                        setKindFilter('all');
                        setSubTab('transactions');
                      }}
                      className="block w-full text-left transition hover:opacity-85"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <TypeIconBadge visual={visual} size="sm" />
                          <span className="truncate font-semibold text-slate-800">
                            {item.category.name}
                          </span>
                        </div>
                        <span className="shrink-0 tabular-nums text-slate-700">
                          <strong className="font-bold text-slate-900">
                            {formatEur(item.spent)}
                          </strong>{' '}
                          <span className="text-slate-400">/ {formatEur(item.budget)}</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${Math.min(100, Math.max(3, item.percent))}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className={`font-semibold ${statusTextClass}`}>
                          {item.status === 'exceeded'
                            ? `Ultrapassado em ${formatEur(Math.abs(item.remaining))}`
                            : `Disponível: ${formatEur(item.remaining)}`}
                        </span>
                        <span className="font-semibold tabular-nums text-slate-500">
                          {item.percent}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Evolução Mensal (Histórico Multi-mês) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-3.5">
            <div className="flex flex-nowrap items-center justify-between gap-2">
              <h2 className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-bold uppercase tracking-wide text-slate-500">
                <BarChart3 className="h-3.5 w-3.5 shrink-0 text-teal-700" aria-hidden="true" />
                <span className="truncate">Evolução mensal</span>
              </h2>
              <div className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 p-0.5">
                {([6, 12] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setHistoryMonths(n)}
                    aria-pressed={historyMonths === n}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                      historyMonths === n
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {n} meses
                  </button>
                ))}
              </div>
            </div>

            {monthlyHistory.activeMonthsCount === 0 ? (
              <p className="mt-2 text-xs text-slate-400">
                Sem movimentos nos últimos {historyMonths} meses para comparar.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {/* Gráfico de barras em pares (Entradas vs Saídas) */}
                <div
                  className="grid items-end gap-1.5 pt-2"
                  style={{
                    gridTemplateColumns: `repeat(${monthlyHistory.points.length}, minmax(0, 1fr))`,
                  }}
                >
                  {monthlyHistory.points.map((point) => {
                    const isSelected = point.month === activeMonth;
                    const incomeHeight =
                      monthlyHistory.maxBarValue > 0 && point.income > 0
                        ? Math.max(6, Math.round((point.income / monthlyHistory.maxBarValue) * 100))
                        : 0;
                    const expenseHeight =
                      monthlyHistory.maxBarValue > 0 && point.expenses > 0
                        ? Math.max(
                            6,
                            Math.round((point.expenses / monthlyHistory.maxBarValue) * 100),
                          )
                        : 0;

                    return (
                      <button
                        key={point.month}
                        type="button"
                        onClick={() => onActiveMonthChange(point.month)}
                        title={`${point.shortLabel}: Entradas ${formatEur(point.income)} · Saídas ${formatEur(point.expenses)} · Saldo ${formatEur(point.balance)}`}
                        aria-label={`Ver ${point.shortLabel}`}
                        className={`flex flex-col items-center gap-1 rounded-xl px-0.5 py-1 transition ${
                          isSelected ? 'bg-teal-50/90 ring-1 ring-teal-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex h-24 w-full items-end justify-center gap-0.5 px-0.5">
                          <div
                            className="w-2.5 rounded-t bg-emerald-500/85 transition-all sm:w-3"
                            style={{ height: `${incomeHeight}%` }}
                          />
                          <div
                            className="w-2.5 rounded-t bg-rose-400/90 transition-all sm:w-3"
                            style={{ height: `${expenseHeight}%` }}
                          />
                        </div>
                        <span
                          className={`text-[10px] font-semibold ${
                            isSelected ? 'text-teal-800' : 'text-slate-500'
                          }`}
                        >
                          {point.monthOnlyLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Legenda + Médias do período */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Entradas
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-400" />
                      Saídas
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Toca num mês para consultar
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-center sm:text-left">
                  <div>
                    <p className="text-[10px] font-medium text-slate-500">Média entradas</p>
                    <p className="mt-0.5 text-xs font-bold tabular-nums text-emerald-700">
                      {formatEur(monthlyHistory.avgIncome)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-500">Média saídas</p>
                    <p className="mt-0.5 text-xs font-bold tabular-nums text-rose-700">
                      {formatEur(monthlyHistory.avgExpenses)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-500">Poupança ({historyMonths}m)</p>
                    <p
                      className={`mt-0.5 text-xs font-bold tabular-nums ${
                        monthlyHistory.totalBalance >= 0 ? 'text-teal-800' : 'text-rose-700'
                      }`}
                    >
                      {formatEur(monthlyHistory.totalBalance)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Despesas por categoria */}
          <section className="rounded-2xl border border-slate-200 bg-white p-3.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Despesas por categoria
            </h2>

            {monthSummary.expenseByCategory.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">
                Sem despesas registadas em {formatMonthLabelPt(activeMonth)}.
              </p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {monthSummary.expenseByCategory.map((item) => {
                  const visual = getFinanceCategoryVisual(item.category);
                  const colorStyle = getSectionColorStyle(item.category?.colorToken ?? 'slate');
                  return (
                    <button
                      key={item.categoryId}
                      type="button"
                      onClick={() => {
                        setCategoryFilter(item.categoryId);
                        setKindFilter('all');
                        setSubTab('transactions');
                      }}
                      className="block w-full text-left transition hover:opacity-85"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <TypeIconBadge visual={visual} size="sm" />
                          <span className="truncate font-semibold text-slate-800">{item.name}</span>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            ({item.sharePercent}%)
                          </span>
                        </div>
                        <span className="shrink-0 font-bold tabular-nums text-slate-900">
                          {formatEur(item.total)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${colorStyle.swatchClass}`}
                          style={{ width: `${Math.max(4, item.sharePercent)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Receitas por categoria */}
          {monthSummary.incomeByCategory.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-3.5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Receitas por categoria
              </h2>
              <div className="mt-2.5 space-y-2">
                {monthSummary.incomeByCategory.map((item) => {
                  const visual = getFinanceCategoryVisual(item.category);
                  return (
                    <div
                      key={item.categoryId}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <TypeIconBadge visual={visual} size="sm" />
                        <span className="truncate font-semibold text-slate-800">{item.name}</span>
                      </div>
                      <span className="shrink-0 font-bold tabular-nums text-emerald-700">
                        +{formatEur(item.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ================= SUB-ABA: GARANTIAS ================= */}
      {subTab === 'warranties' && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <SearchInput
              value={warrantySearch}
              onChange={setWarrantySearch}
              placeholder="Pesquisar produto, loja ou nota..."
            />
          </div>

          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                { id: 'all', label: `Todas (${allWarranties.length})` },
                {
                  id: 'active',
                  label: `Válidas (${allWarranties.filter((w) => w.info.status === 'active').length})`,
                },
                {
                  id: 'expiring_soon',
                  label: `A expirar (${allWarranties.filter((w) => w.info.status === 'expiring_soon').length})`,
                },
                {
                  id: 'expired',
                  label: `Expiradas (${allWarranties.filter((w) => w.info.status === 'expired').length})`,
                },
              ] as const
            ).map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setWarrantyFilter(pill.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  warrantyFilter === pill.id
                    ? 'bg-teal-700 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {filteredWarranties.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-teal-600/70" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {allWarranties.length === 0
                  ? 'Ainda sem garantias guardadas.'
                  : 'Nenhuma garantia encontrada.'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Fotografa faturas e talões de eletrodomésticos, tecnologia ou mobiliário para teres
                sempre as garantias à mão e sincronizadas no Drive.
              </p>
              {allWarranties.length === 0 && (
                <button
                  type="button"
                  onClick={() => openNewTransaction('variable', true)}
                  className="mt-3 inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Guardar primeira garantia
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredWarranties.map(({ tx, info }) => {
                const cat = categoriesById.get(tx.categoryId);
                const visual = getFinanceCategoryVisual(cat);
                const badgeClass =
                  info.status === 'expired'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : info.status === 'expiring_soon'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : info.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200';

                return (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => openEditTransaction(tx)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-xs transition hover:border-teal-300"
                  >
                    {tx.photoAttachmentId ? (
                      <AttachmentImage
                        attachmentId={tx.photoAttachmentId}
                        alt={tx.title}
                        className="h-12 w-12 shrink-0 rounded-xl border border-slate-200"
                      />
                    ) : (
                      <TypeIconBadge visual={visual} size="lg" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold text-slate-900">
                          {tx.title}
                        </span>
                        {tx.amount > 0 && (
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600">
                            {formatEur(tx.amount)}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {tx.warrantyStore ? `${tx.warrantyStore} · ` : ''}
                        Compra: {formatDatePt(tx.date)}
                        {tx.warrantyExpiresAt ? ` · Até ${formatDatePt(tx.warrantyExpiresAt)}` : ''}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          {info.label}
                        </span>
                        {tx.photoAttachmentId && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            <Paperclip className="h-2.5 w-2.5" />
                            Fatura
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      <FinanceTransactionModal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        editingTransaction={editingTx}
        activeMonth={activeMonth}
        categories={categories}
        members={members}
        deviceId={deviceId}
        initialKind={txInitialKind}
        initialWarrantyMode={txWarrantyMode}
        initialPhotoAttachmentId={txInitialPhotoId}
        onSaved={showToast}
      />

      <FinanceRecurringModal
        open={recurringModalOpen}
        onClose={() => setRecurringModalOpen(false)}
        editingRule={editingRule}
        activeMonth={activeMonth}
        categories={categories}
        members={members}
        deviceId={deviceId}
        initialKind={recurringInitialKind}
        onSaved={showToast}
      />

      <FinanceBudgetsModal
        open={budgetsModalOpen}
        onClose={() => setBudgetsModalOpen(false)}
        categories={categories}
        deviceId={deviceId}
        onSaved={showToast}
      />
    </div>
  );
}
