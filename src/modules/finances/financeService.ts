import { db, type FamilyDatabase } from '../../db/database';
import type {
  FinanceCategoryConfig,
  FinanceKind,
  FinanceRecurringFrequency,
  FinanceRecurringRule,
  FinanceTransaction,
  FinanceTransactionStatus,
} from '../../types/domain';
import { softDeleteAttachmentIfUnused } from '../../utils/attachmentStorage';
import { createSyncMetadata, nowIso } from '../../utils/id';
import { addDaysToDateString, daysBetweenDateStrings, todayDateString } from '../../utils/units';

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const MONTH_SHORT_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export function currentMonthString(today: string = todayDateString()): string {
  return today.slice(0, 7);
}

export function parseMonthString(month: string): { year: number; monthIndex: number } {
  const [yStr, mStr] = month.split('-');
  const year = Number(yStr) || new Date().getFullYear();
  const m = Number(mStr) || 1;
  return { year, monthIndex: Math.max(0, Math.min(11, m - 1)) };
}

export function formatMonthString(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, deltaMonths: number): string {
  const { year, monthIndex } = parseMonthString(month);
  const total = year * 12 + monthIndex + deltaMonths;
  const nextYear = Math.floor(total / 12);
  const nextIndex = ((total % 12) + 12) % 12;
  return formatMonthString(nextYear, nextIndex);
}

export function monthsBetween(startMonth: string, targetMonth: string): number {
  const a = parseMonthString(startMonth);
  const b = parseMonthString(targetMonth);
  return (b.year - a.year) * 12 + (b.monthIndex - a.monthIndex);
}

export function formatMonthLabelPt(month: string): string {
  const { year, monthIndex } = parseMonthString(month);
  return `${MONTH_NAMES_PT[monthIndex] ?? ''} ${year}`.trim();
}

export function formatMonthShortPt(month: string): string {
  const { year, monthIndex } = parseMonthString(month);
  return `${MONTH_SHORT_PT[monthIndex] ?? ''} ${year}`.trim();
}

export function clampDayToMonth(month: string, dayOfMonth: number): string {
  const { year, monthIndex } = parseMonthString(month);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const clamped = Math.max(1, Math.min(lastDay, Math.round(dayOfMonth) || 1));
  return `${month}-${String(clamped).padStart(2, '0')}`;
}

export function addYearsToDateString(dateStr: string, years: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const targetYear = y + years;
  const lastDay = new Date(targetYear, m, 0).getDate();
  const clampedDay = Math.min(d, lastDay);
  return `${targetYear}-${String(m).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function frequencyStepMonths(frequency: FinanceRecurringFrequency): number {
  switch (frequency) {
    case 'monthly':
      return 1;
    case 'quarterly':
      return 3;
    case 'semiannual':
      return 6;
    case 'annual':
      return 12;
  }
}

export function isRecurringRuleDueInMonth(rule: FinanceRecurringRule, month: string): boolean {
  if (!rule.isActive || rule.deletedAt) return false;
  const diff = monthsBetween(rule.startMonth, month);
  if (diff < 0) return false;
  return diff % frequencyStepMonths(rule.frequency) === 0;
}

export function getNextDueMonthForRule(
  rule: FinanceRecurringRule,
  afterMonth: string,
): string | null {
  if (!rule.isActive || rule.deletedAt) return null;
  const diff = monthsBetween(rule.startMonth, afterMonth);
  if (diff < 0) return rule.startMonth;
  const step = frequencyStepMonths(rule.frequency);
  const remainder = diff % step;
  const offset = remainder === 0 ? step : step - remainder;
  return shiftMonth(afterMonth, offset);
}

/**
 * Deterministic ID prevents duplicate recurring entries when two devices open the same month offline
 * and later merge through Google Drive sync.
 */
export function buildRecurringInstanceId(ruleId: string, month: string): string {
  return `fin-rec-${ruleId}-${month}`;
}

export async function ensureRecurringTransactionsForMonth(
  month: string,
  deviceId: string,
  database: FamilyDatabase = db,
): Promise<number> {
  const [rules, allTransactions] = await Promise.all([
    database.financeRecurring.toArray(),
    database.financeTransactions.toArray(),
  ]);

  const existingIds = new Set(allTransactions.map((t) => t.id));
  const toCreate: FinanceTransaction[] = [];
  const now = nowIso();

  for (const rule of rules) {
    if (!isRecurringRuleDueInMonth(rule, month)) continue;
    const instanceId = buildRecurringInstanceId(rule.id, month);
    if (existingIds.has(instanceId)) continue;

    toCreate.push({
      id: instanceId,
      title: rule.title,
      kind: rule.kind,
      categoryId: rule.categoryId,
      amount: rule.amount,
      date: clampDayToMonth(month, rule.dayOfMonth),
      month,
      status: 'planned',
      recurringRuleId: rule.id,
      memberId: rule.memberId,
      notes: rule.notes,
      photoAttachmentId: null,
      isWarranty: false,
      warrantyExpiresAt: null,
      warrantyStore: '',
      excludeFromTotals: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      lastModifiedBy: deviceId,
    });
  }

  if (toCreate.length > 0) {
    await database.financeTransactions.bulkPut(toCreate);
  }
  return toCreate.length;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  category: FinanceCategoryConfig | null;
  name: string;
  kind: FinanceKind;
  total: number;
  paid: number;
  planned: number;
  count: number;
  sharePercent: number;
}

export interface MonthFinanceSummary {
  month: string;
  incomeTotal: number;
  incomePaid: number;
  incomePlanned: number;
  fixedTotal: number;
  fixedPaid: number;
  fixedPlanned: number;
  variableTotal: number;
  variablePaid: number;
  variablePlanned: number;
  expensesTotal: number;
  expensesPaid: number;
  expensesPlanned: number;
  balanceTotal: number;
  balancePaid: number;
  savingsRate: number | null;
  transactionCount: number;
  expenseByCategory: CategoryBreakdownItem[];
  incomeByCategory: CategoryBreakdownItem[];
}

export function summarizeMonthFinances(
  month: string,
  transactions: FinanceTransaction[],
  categories: FinanceCategoryConfig[],
): MonthFinanceSummary {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const active = transactions.filter(
    (t) => !t.deletedAt && !t.excludeFromTotals && t.month === month,
  );

  let incomeTotal = 0;
  let incomePaid = 0;
  let incomePlanned = 0;
  let fixedTotal = 0;
  let fixedPaid = 0;
  let fixedPlanned = 0;
  let variableTotal = 0;
  let variablePaid = 0;
  let variablePlanned = 0;

  const expenseMap = new Map<string, Omit<CategoryBreakdownItem, 'sharePercent'>>();
  const incomeMap = new Map<string, Omit<CategoryBreakdownItem, 'sharePercent'>>();

  for (const tx of active) {
    const val = Math.max(0, Number(tx.amount) || 0);
    const isPaid = tx.status === 'paid';

    if (tx.kind === 'income') {
      incomeTotal += val;
      if (isPaid) incomePaid += val;
      else incomePlanned += val;
    } else if (tx.kind === 'fixed') {
      fixedTotal += val;
      if (isPaid) fixedPaid += val;
      else fixedPlanned += val;
    } else {
      variableTotal += val;
      if (isPaid) variablePaid += val;
      else variablePlanned += val;
    }

    const bucket = tx.kind === 'income' ? incomeMap : expenseMap;
    const existing = bucket.get(tx.categoryId);
    const cat = catById.get(tx.categoryId) ?? null;
    if (existing) {
      existing.total += val;
      if (isPaid) existing.paid += val;
      else existing.planned += val;
      existing.count += 1;
    } else {
      bucket.set(tx.categoryId, {
        categoryId: tx.categoryId,
        category: cat,
        name: cat?.name ?? 'Sem categoria',
        kind: tx.kind,
        total: val,
        paid: isPaid ? val : 0,
        planned: isPaid ? 0 : val,
        count: 1,
      });
    }
  }

  const expensesTotal = fixedTotal + variableTotal;
  const expensesPaid = fixedPaid + variablePaid;
  const expensesPlanned = fixedPlanned + variablePlanned;
  const balanceTotal = incomeTotal - expensesTotal;
  const balancePaid = incomePaid - expensesPaid;
  const savingsRate = incomeTotal > 0 ? Math.round((balanceTotal / incomeTotal) * 100) : null;

  const expenseByCategory: CategoryBreakdownItem[] = Array.from(expenseMap.values())
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-PT'))
    .map((item) => ({
      ...item,
      sharePercent: expensesTotal > 0 ? Math.round((item.total / expensesTotal) * 100) : 0,
    }));

  const incomeByCategory: CategoryBreakdownItem[] = Array.from(incomeMap.values())
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-PT'))
    .map((item) => ({
      ...item,
      sharePercent: incomeTotal > 0 ? Math.round((item.total / incomeTotal) * 100) : 0,
    }));

  return {
    month,
    incomeTotal,
    incomePaid,
    incomePlanned,
    fixedTotal,
    fixedPaid,
    fixedPlanned,
    variableTotal,
    variablePaid,
    variablePlanned,
    expensesTotal,
    expensesPaid,
    expensesPlanned,
    balanceTotal,
    balancePaid,
    savingsRate,
    transactionCount: active.length,
    expenseByCategory,
    incomeByCategory,
  };
}

export type BudgetHealthStatus = 'ok' | 'warning' | 'exceeded';

export interface CategoryBudgetProgress {
  category: FinanceCategoryConfig;
  budget: number;
  spent: number;
  remaining: number;
  percent: number;
  status: BudgetHealthStatus;
}

export function buildCategoryBudgetProgress(
  month: string,
  transactions: FinanceTransaction[],
  categories: FinanceCategoryConfig[],
): CategoryBudgetProgress[] {
  const spentByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.deletedAt || tx.excludeFromTotals || tx.month !== month || tx.kind === 'income') {
      continue;
    }
    const val = Math.max(0, Number(tx.amount) || 0);
    spentByCategory.set(tx.categoryId, (spentByCategory.get(tx.categoryId) ?? 0) + val);
  }

  return categories
    .filter(
      (cat) =>
        !cat.deletedAt &&
        cat.kind !== 'income' &&
        cat.monthlyBudget !== null &&
        cat.monthlyBudget > 0,
    )
    .map((cat) => {
      const budget = cat.monthlyBudget as number;
      const spent = Math.round((spentByCategory.get(cat.id) ?? 0) * 100) / 100;
      const remaining = Math.round((budget - spent) * 100) / 100;
      const percent = Math.round((spent / budget) * 100);
      const status: BudgetHealthStatus =
        spent > budget ? 'exceeded' : percent >= 80 ? 'warning' : 'ok';
      return {
        category: cat,
        budget,
        spent,
        remaining,
        percent,
        status,
      };
    })
    .sort((a, b) => b.percent - a.percent || b.spent - a.spent);
}

export interface MonthlyHistoryPoint {
  month: string;
  shortLabel: string;
  monthOnlyLabel: string;
  income: number;
  expenses: number;
  fixed: number;
  variable: number;
  balance: number;
  hasActivity: boolean;
}

export interface MonthlyHistorySummary {
  points: MonthlyHistoryPoint[];
  maxBarValue: number;
  activeMonthsCount: number;
  avgIncome: number;
  avgExpenses: number;
  avgBalance: number;
  totalBalance: number;
}

export function buildMonthlyFinanceHistory(
  endMonth: string,
  monthCount: number,
  transactions: FinanceTransaction[],
): MonthlyHistorySummary {
  const count = Math.max(1, monthCount);
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    months.push(shiftMonth(endMonth, -i));
  }

  const monthSet = new Set(months);
  const totalsByMonth = new Map<
    string,
    { income: number; fixed: number; variable: number; count: number }
  >();
  for (const m of months) {
    totalsByMonth.set(m, { income: 0, fixed: 0, variable: 0, count: 0 });
  }

  for (const tx of transactions) {
    if (tx.deletedAt || tx.excludeFromTotals || !monthSet.has(tx.month)) continue;
    const bucket = totalsByMonth.get(tx.month);
    if (!bucket) continue;
    const val = Math.max(0, Number(tx.amount) || 0);
    if (tx.kind === 'income') bucket.income += val;
    else if (tx.kind === 'fixed') bucket.fixed += val;
    else bucket.variable += val;
    bucket.count += 1;
  }

  let maxBarValue = 0;
  let activeMonthsCount = 0;
  let sumIncome = 0;
  let sumExpenses = 0;
  let sumBalance = 0;

  const points: MonthlyHistoryPoint[] = months.map((m) => {
    const b = totalsByMonth.get(m)!;
    const expenses = Math.round((b.fixed + b.variable) * 100) / 100;
    const income = Math.round(b.income * 100) / 100;
    const balance = Math.round((income - expenses) * 100) / 100;
    const hasActivity = b.count > 0;

    if (income > maxBarValue) maxBarValue = income;
    if (expenses > maxBarValue) maxBarValue = expenses;
    if (hasActivity) {
      activeMonthsCount += 1;
      sumIncome += income;
      sumExpenses += expenses;
      sumBalance += balance;
    }

    const { monthIndex } = parseMonthString(m);
    return {
      month: m,
      shortLabel: formatMonthShortPt(m),
      monthOnlyLabel: MONTH_SHORT_PT[monthIndex] ?? m.slice(5),
      income,
      expenses,
      fixed: Math.round(b.fixed * 100) / 100,
      variable: Math.round(b.variable * 100) / 100,
      balance,
      hasActivity,
    };
  });

  const denom = activeMonthsCount || 1;
  return {
    points,
    maxBarValue,
    activeMonthsCount,
    avgIncome: activeMonthsCount > 0 ? Math.round((sumIncome / denom) * 100) / 100 : 0,
    avgExpenses: activeMonthsCount > 0 ? Math.round((sumExpenses / denom) * 100) / 100 : 0,
    avgBalance: activeMonthsCount > 0 ? Math.round((sumBalance / denom) * 100) / 100 : 0,
    totalBalance: Math.round(sumBalance * 100) / 100,
  };
}

export interface UpcomingFixedBill {
  tx: FinanceTransaction;
  daysUntil: number;
  isOverdue: boolean;
}

export function getUpcomingFixedBills(
  transactions: FinanceTransaction[],
  today: string = todayDateString(),
  windowDays = 7,
): UpcomingFixedBill[] {
  const cutoff = addDaysToDateString(today, windowDays);
  const currentMonth = currentMonthString(today);

  return transactions
    .filter(
      (tx) =>
        !tx.deletedAt &&
        !tx.excludeFromTotals &&
        tx.kind === 'fixed' &&
        tx.status === 'planned' &&
        tx.date <= cutoff &&
        (tx.month === currentMonth || daysBetweenDateStrings(today, tx.date) >= -31),
    )
    .map((tx) => {
      const daysUntil = daysBetweenDateStrings(today, tx.date);
      return {
        tx,
        daysUntil,
        isOverdue: daysUntil < 0,
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil || b.tx.amount - a.tx.amount);
}

export type WarrantyStatus = 'active' | 'expiring_soon' | 'expired' | 'no_expiry';

export interface WarrantyStatusInfo {
  status: WarrantyStatus;
  daysRemaining: number | null;
  label: string;
}

export function getWarrantyStatus(
  warrantyExpiresAt: string | null | undefined,
  today: string = todayDateString(),
): WarrantyStatusInfo {
  if (!warrantyExpiresAt) {
    return { status: 'no_expiry', daysRemaining: null, label: 'Sem validade definida' };
  }
  const days = daysBetweenDateStrings(today, warrantyExpiresAt);
  if (days < 0) {
    const abs = Math.abs(days);
    return {
      status: 'expired',
      daysRemaining: days,
      label: abs === 1 ? 'Expirou ontem' : `Expirada há ${abs} dias`,
    };
  }
  if (days === 0) {
    return { status: 'expiring_soon', daysRemaining: 0, label: 'Expira hoje' };
  }
  if (days <= 60) {
    return {
      status: 'expiring_soon',
      daysRemaining: days,
      label: days === 1 ? 'Expira amanhã' : `Expira em ${days} dias`,
    };
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return {
      status: 'active',
      daysRemaining: days,
      label: `Válida · ${months} ${months === 1 ? 'mês' : 'meses'}`,
    };
  }
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const yearPart = `${years} ${years === 1 ? 'ano' : 'anos'}`;
  const monthPart = remMonths > 0 ? ` e ${remMonths} ${remMonths === 1 ? 'mês' : 'meses'}` : '';
  return {
    status: 'active',
    daysRemaining: days,
    label: `Válida · ${yearPart}${monthPart}`,
  };
}

export interface SaveTransactionInput {
  id?: string;
  title: string;
  kind: FinanceKind;
  categoryId: string;
  amount: number;
  date: string;
  status: FinanceTransactionStatus;
  recurringRuleId?: string | null;
  memberId?: string | null;
  notes?: string;
  photoAttachmentId?: string | null;
  isWarranty?: boolean;
  warrantyExpiresAt?: string | null;
  warrantyStore?: string;
  excludeFromTotals?: boolean;
}

export async function saveFinanceTransaction(
  input: SaveTransactionInput,
  deviceId: string,
  database: FamilyDatabase = db,
): Promise<FinanceTransaction> {
  const existing = input.id ? await database.financeTransactions.get(input.id) : undefined;
  const now = nowIso();
  const cleanDate = input.date || todayDateString();
  const month = cleanDate.slice(0, 7);

  const record: FinanceTransaction = existing
    ? {
        ...existing,
        title: input.title.trim(),
        kind: input.kind,
        categoryId: input.categoryId,
        amount: Math.max(0, Math.round(input.amount * 100) / 100),
        date: cleanDate,
        month,
        status: input.status,
        recurringRuleId:
          input.recurringRuleId !== undefined ? input.recurringRuleId : existing.recurringRuleId,
        memberId: input.memberId ?? null,
        notes: (input.notes ?? '').trim(),
        photoAttachmentId: input.photoAttachmentId ?? null,
        isWarranty: Boolean(input.isWarranty),
        warrantyExpiresAt: input.isWarranty ? (input.warrantyExpiresAt || null) : null,
        warrantyStore: input.isWarranty ? (input.warrantyStore ?? '').trim() : '',
        excludeFromTotals: Boolean(input.excludeFromTotals),
        deletedAt: null,
        updatedAt: now,
        lastModifiedBy: deviceId,
      }
    : {
        ...createSyncMetadata(deviceId, input.id),
        title: input.title.trim(),
        kind: input.kind,
        categoryId: input.categoryId,
        amount: Math.max(0, Math.round(input.amount * 100) / 100),
        date: cleanDate,
        month,
        status: input.status,
        recurringRuleId: input.recurringRuleId ?? null,
        memberId: input.memberId ?? null,
        notes: (input.notes ?? '').trim(),
        photoAttachmentId: input.photoAttachmentId ?? null,
        isWarranty: Boolean(input.isWarranty),
        warrantyExpiresAt: input.isWarranty ? (input.warrantyExpiresAt || null) : null,
        warrantyStore: input.isWarranty ? (input.warrantyStore ?? '').trim() : '',
        excludeFromTotals: Boolean(input.excludeFromTotals),
      };

  const previousPhotoId = existing?.photoAttachmentId;
  await database.financeTransactions.put(record);

  if (previousPhotoId && previousPhotoId !== record.photoAttachmentId && database === db) {
    await softDeleteAttachmentIfUnused(previousPhotoId, {
      excludeFinanceTransactionId: record.id,
    });
  }

  return record;
}

export async function toggleFinanceTransactionPaid(
  tx: FinanceTransaction,
  deviceId: string,
  database: FamilyDatabase = db,
): Promise<FinanceTransaction> {
  const nextStatus: FinanceTransactionStatus = tx.status === 'paid' ? 'planned' : 'paid';
  const updated: FinanceTransaction = {
    ...tx,
    status: nextStatus,
    updatedAt: nowIso(),
    lastModifiedBy: deviceId,
  };
  await database.financeTransactions.put(updated);
  return updated;
}

export async function deleteFinanceTransaction(
  tx: FinanceTransaction,
  deviceId: string,
  database: FamilyDatabase = db,
): Promise<void> {
  const now = nowIso();
  await database.financeTransactions.put({
    ...tx,
    deletedAt: now,
    updatedAt: now,
    lastModifiedBy: deviceId,
  });
  if (tx.photoAttachmentId && database === db) {
    await softDeleteAttachmentIfUnused(tx.photoAttachmentId, {
      excludeFinanceTransactionId: tx.id,
    });
  }
}

export interface SaveRecurringRuleInput {
  id?: string;
  title: string;
  kind: 'income' | 'fixed';
  categoryId: string;
  amount: number;
  frequency: FinanceRecurringFrequency;
  dayOfMonth: number;
  startMonth: string;
  isActive: boolean;
  memberId?: string | null;
  notes?: string;
}

export async function saveFinanceRecurringRule(
  input: SaveRecurringRuleInput,
  deviceId: string,
  activeMonth?: string,
  database: FamilyDatabase = db,
): Promise<FinanceRecurringRule> {
  const existing = input.id ? await database.financeRecurring.get(input.id) : undefined;
  const now = nowIso();

  const rule: FinanceRecurringRule = existing
    ? {
        ...existing,
        title: input.title.trim(),
        kind: input.kind,
        categoryId: input.categoryId,
        amount: Math.max(0, Math.round(input.amount * 100) / 100),
        frequency: input.frequency,
        dayOfMonth: Math.max(1, Math.min(31, Math.round(input.dayOfMonth) || 1)),
        startMonth: input.startMonth || currentMonthString(),
        isActive: input.isActive,
        memberId: input.memberId ?? null,
        notes: (input.notes ?? '').trim(),
        deletedAt: null,
        updatedAt: now,
        lastModifiedBy: deviceId,
      }
    : {
        ...createSyncMetadata(deviceId, input.id),
        title: input.title.trim(),
        kind: input.kind,
        categoryId: input.categoryId,
        amount: Math.max(0, Math.round(input.amount * 100) / 100),
        frequency: input.frequency,
        dayOfMonth: Math.max(1, Math.min(31, Math.round(input.dayOfMonth) || 1)),
        startMonth: input.startMonth || currentMonthString(),
        isActive: input.isActive,
        memberId: input.memberId ?? null,
        notes: (input.notes ?? '').trim(),
      };

  await database.financeRecurring.put(rule);

  if (activeMonth) {
    const instanceId = buildRecurringInstanceId(rule.id, activeMonth);
    const existingTx = await database.financeTransactions.get(instanceId);
    const dueNow = isRecurringRuleDueInMonth(rule, activeMonth);

    if (dueNow && existingTx && !existingTx.deletedAt && existingTx.status === 'planned') {
      await database.financeTransactions.put({
        ...existingTx,
        title: rule.title,
        kind: rule.kind,
        categoryId: rule.categoryId,
        amount: rule.amount,
        date: clampDayToMonth(activeMonth, rule.dayOfMonth),
        memberId: rule.memberId,
        notes: rule.notes,
        updatedAt: nowIso(),
        lastModifiedBy: deviceId,
      });
    } else if (dueNow && !existingTx) {
      await ensureRecurringTransactionsForMonth(activeMonth, deviceId, database);
    }
  }

  return rule;
}

export async function deleteFinanceRecurringRule(
  rule: FinanceRecurringRule,
  deviceId: string,
  removePlannedInstances = true,
  database: FamilyDatabase = db,
): Promise<void> {
  const now = nowIso();
  await database.financeRecurring.put({
    ...rule,
    isActive: false,
    deletedAt: now,
    updatedAt: now,
    lastModifiedBy: deviceId,
  });

  if (removePlannedInstances) {
    const allTx = await database.financeTransactions.toArray();
    const plannedToRemove = allTx.filter(
      (t) => !t.deletedAt && t.recurringRuleId === rule.id && t.status === 'planned',
    );
    if (plannedToRemove.length > 0) {
      await database.financeTransactions.bulkPut(
        plannedToRemove.map((t) => ({
          ...t,
          deletedAt: now,
          updatedAt: now,
          lastModifiedBy: deviceId,
        })),
      );
    }
  }
}
