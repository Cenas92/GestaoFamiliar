import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildStarterFinanceCategories } from '../../data/starterCatalog';
import { FamilyDatabase } from '../../db/database';
import type {
  FinanceAccount,
  FinanceRecurringRule,
  FinanceTransaction,
  HouseholdMember,
} from '../../types/domain';
import {
  addYearsToDateString,
  buildCategoryBudgetProgress,
  buildMonthlyFinanceHistory,
  buildRecurringInstanceId,
  calculateJointAccountSettlement,
  clampDayToMonth,
  computeAccountAccumulatedBalance,
  deleteFinanceRecurringRule,
  deleteFinanceTransaction,
  ensureRecurringTransactionsForMonth,
  getNextDueMonthForRule,
  getUpcomingFixedBills,
  getWarrantyStatus,
  isRecurringRuleDueInMonth,
  saveFinanceRecurringRule,
  saveFinanceTransaction,
  shiftMonth,
  summarizeMonthFinances,
  toggleFinanceTransactionPaid,
} from './financeService';

describe('financeService', () => {
  let testDb: FamilyDatabase;

  beforeEach(async () => {
    testDb = new FamilyDatabase(`test-finance-${Date.now()}-${Math.random()}`);
    await testDb.open();
    await testDb.financeCategories.bulkPut(buildStarterFinanceCategories('dev-1'));
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('calcula meses, dias limite e validade em anos corretamente', () => {
    expect(shiftMonth('2026-11', 2)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(clampDayToMonth('2026-02', 31)).toBe('2026-02-28');
    expect(clampDayToMonth('2028-02', 31)).toBe('2028-02-29');
    expect(addYearsToDateString('2026-11-21', 3)).toBe('2029-11-21');
    expect(addYearsToDateString('2024-02-29', 3)).toBe('2027-02-28');
  });

  it('avalia periodicidade mensal, trimestral, semestral e anual corretamente', () => {
    const baseRule: FinanceRecurringRule = {
      id: 'r1',
      title: 'Seguro Carro',
      kind: 'fixed',
      categoryId: 'fin-cat-insurance',
      amount: 320,
      frequency: 'annual',
      dayOfMonth: 15,
      startMonth: '2026-03',
      isActive: true,
      memberId: null,
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
      lastModifiedBy: 'dev-1',
    };

    expect(isRecurringRuleDueInMonth(baseRule, '2026-02')).toBe(false);
    expect(isRecurringRuleDueInMonth(baseRule, '2026-03')).toBe(true);
    expect(isRecurringRuleDueInMonth(baseRule, '2026-09')).toBe(false);
    expect(isRecurringRuleDueInMonth(baseRule, '2027-03')).toBe(true);
    expect(getNextDueMonthForRule(baseRule, '2026-05')).toBe('2027-03');

    const quarterly: FinanceRecurringRule = { ...baseRule, frequency: 'quarterly' };
    expect(isRecurringRuleDueInMonth(quarterly, '2026-06')).toBe(true);
    expect(isRecurringRuleDueInMonth(quarterly, '2026-07')).toBe(false);
    expect(getNextDueMonthForRule(quarterly, '2026-07')).toBe('2026-09');

    const semiannual: FinanceRecurringRule = { ...baseRule, frequency: 'semiannual' };
    expect(isRecurringRuleDueInMonth(semiannual, '2026-09')).toBe(true);
    expect(isRecurringRuleDueInMonth(semiannual, '2026-10')).toBe(false);
  });

  it('projeta regras recorrentes com ID determinístico e não recria instâncias apagadas', async () => {
    const rule = await saveFinanceRecurringRule(
      {
        title: 'Prestação Casa',
        kind: 'fixed',
        categoryId: 'fin-cat-housing',
        amount: 650,
        frequency: 'monthly',
        dayOfMonth: 2,
        startMonth: '2026-10',
        isActive: true,
      },
      'dev-1',
      '2026-11',
      testDb,
    );

    const instanceId = buildRecurringInstanceId(rule.id, '2026-11');
    const createdTx = await testDb.financeTransactions.get(instanceId);
    expect(createdTx).toBeDefined();
    expect(createdTx?.amount).toBe(650);
    expect(createdTx?.status).toBe('planned');
    expect(createdTx?.date).toBe('2026-11-02');

    // Second projection is idempotent
    const addedAgain = await ensureRecurringTransactionsForMonth('2026-11', 'dev-1', testDb);
    expect(addedAgain).toBe(0);

    // Editing rule updates planned instance in current month
    await saveFinanceRecurringRule(
      {
        id: rule.id,
        title: 'Prestação Casa Atualizada',
        kind: 'fixed',
        categoryId: 'fin-cat-housing',
        amount: 675,
        frequency: 'monthly',
        dayOfMonth: 5,
        startMonth: '2026-10',
        isActive: true,
      },
      'dev-1',
      '2026-11',
      testDb,
    );
    const updatedTx = await testDb.financeTransactions.get(instanceId);
    expect(updatedTx?.amount).toBe(675);
    expect(updatedTx?.date).toBe('2026-11-05');

    // Once marked paid, editing rule preserves paid historical value
    await toggleFinanceTransactionPaid(updatedTx!, 'dev-1', testDb);
    await saveFinanceRecurringRule(
      {
        id: rule.id,
        title: 'Prestação Casa Nova',
        kind: 'fixed',
        categoryId: 'fin-cat-housing',
        amount: 700,
        frequency: 'monthly',
        dayOfMonth: 5,
        startMonth: '2026-10',
        isActive: true,
      },
      'dev-1',
      '2026-11',
      testDb,
    );
    const paidTx = await testDb.financeTransactions.get(instanceId);
    expect(paidTx?.status).toBe('paid');
    expect(paidTx?.amount).toBe(675);

    // Soft-deleted instance in December must NOT be re-created on next ensure
    await ensureRecurringTransactionsForMonth('2026-12', 'dev-1', testDb);
    const decInstance = await testDb.financeTransactions.get(
      buildRecurringInstanceId(rule.id, '2026-12'),
    );
    expect(decInstance).toBeDefined();
    await deleteFinanceTransaction(decInstance!, 'dev-1', testDb);

    const recreated = await ensureRecurringTransactionsForMonth('2026-12', 'dev-1', testDb);
    expect(recreated).toBe(0);

    // Deleting recurring rule removes remaining planned instances
    await ensureRecurringTransactionsForMonth('2027-01', 'dev-1', testDb);
    await deleteFinanceRecurringRule(rule, 'dev-1', true, testDb);
    const janAfterDelete = await testDb.financeTransactions.get(
      buildRecurringInstanceId(rule.id, '2027-01'),
    );
    expect(janAfterDelete?.deletedAt).not.toBeNull();
  });

  it('resume receitas, fixas, variáveis, saldo e exclui garantias antigas dos totais', async () => {
    const categories = buildStarterFinanceCategories('dev-1');
    const txs: FinanceTransaction[] = [
      await saveFinanceTransaction(
        {
          title: 'Ordenado',
          kind: 'income',
          categoryId: 'fin-cat-salary',
          amount: 2000,
          date: '2026-11-25',
          status: 'paid',
        },
        'dev-1',
        testDb,
      ),
      await saveFinanceTransaction(
        {
          title: 'Renda',
          kind: 'fixed',
          categoryId: 'fin-cat-housing',
          amount: 700,
          date: '2026-11-01',
          status: 'paid',
        },
        'dev-1',
        testDb,
      ),
      await saveFinanceTransaction(
        {
          title: 'Luz',
          kind: 'fixed',
          categoryId: 'fin-cat-utilities',
          amount: 100,
          date: '2026-11-28',
          status: 'planned',
        },
        'dev-1',
        testDb,
      ),
      await saveFinanceTransaction(
        {
          title: 'Continente',
          kind: 'variable',
          categoryId: 'fin-cat-groceries',
          amount: 200,
          date: '2026-11-12',
          status: 'paid',
        },
        'dev-1',
        testDb,
      ),
      await saveFinanceTransaction(
        {
          title: 'Frigorífico (garantia antiga)',
          kind: 'variable',
          categoryId: 'fin-cat-home-tech',
          amount: 550,
          date: '2026-11-10',
          status: 'paid',
          isWarranty: true,
          warrantyExpiresAt: '2029-11-10',
          warrantyStore: 'Worten',
          excludeFromTotals: true,
        },
        'dev-1',
        testDb,
      ),
    ];

    const summary = summarizeMonthFinances('2026-11', txs, categories);
    expect(summary.incomeTotal).toBe(2000);
    expect(summary.fixedTotal).toBe(800);
    expect(summary.fixedPaid).toBe(700);
    expect(summary.fixedPlanned).toBe(100);
    expect(summary.variableTotal).toBe(200);
    expect(summary.expensesTotal).toBe(1000);
    expect(summary.balanceTotal).toBe(1000);
    expect(summary.savingsRate).toBe(50);
    expect(summary.transactionCount).toBe(4);
    expect(summary.expenseByCategory[0].categoryId).toBe('fin-cat-housing');
    expect(summary.expenseByCategory[0].sharePercent).toBe(70);
  });

  it('classifica corretamente o estado das garantias', () => {
    expect(getWarrantyStatus(null, '2026-11-21').status).toBe('no_expiry');
    expect(getWarrantyStatus('2026-11-01', '2026-11-21').status).toBe('expired');
    expect(getWarrantyStatus('2026-12-10', '2026-11-21').status).toBe('expiring_soon');
    expect(getWarrantyStatus('2029-11-21', '2026-11-21').status).toBe('active');
  });

  it('calcula progresso de orçamentos, histórico multi-mês e alertas de fixas a vencer', async () => {
    const categories = buildStarterFinanceCategories('dev-1').map((c) => {
      if (c.id === 'fin-cat-groceries') return { ...c, monthlyBudget: 400 };
      if (c.id === 'fin-cat-dining') return { ...c, monthlyBudget: 100 };
      if (c.id === 'fin-cat-fuel') return { ...c, monthlyBudget: 200 };
      return c;
    });

    const txs: FinanceTransaction[] = [
      await saveFinanceTransaction(
        {
          title: 'Ordenado Out',
          kind: 'income',
          categoryId: 'fin-cat-salary',
          amount: 2000,
          date: '2026-10-25',
          status: 'paid',
        },
        'dev-1',
        testDb,
      ),
      await saveFinanceTransaction(
        {
          title: 'Renda Out',
          kind: 'fixed',
          categoryId: 'fin-cat-housing',
          amount: 700,
          date: '2026-10-01',
          status: 'paid',
        },
        'dev-1',
        testDb,
      ),
      await saveFinanceTransaction(
        {
          title: 'Ordenado Nov',
          kind: 'income',
          categoryId: 'fin-cat-salary',
          amount: 2200,
          date: '2026-11-25',
          status: 'paid',
        },
        'dev-1',
        testDb,
      ),
      await saveFinanceTransaction(
        {
          title: 'Continente Nov',
          kind: 'variable',
          categoryId: 'fin-cat-groceries',
          amount: 340,
          date: '2026-11-10',
          status: 'paid',
        },
        'dev-1',
        testDb,
      ),
      await saveFinanceTransaction(
        {
          title: 'Jantar fora',
          kind: 'variable',
          categoryId: 'fin-cat-dining',
          amount: 120,
          date: '2026-11-15',
          status: 'paid',
        },
        'dev-1',
        testDb,
      ),
      await saveFinanceTransaction(
        {
          title: 'Luz (em breve)',
          kind: 'fixed',
          categoryId: 'fin-cat-utilities',
          amount: 85,
          date: '2026-11-24',
          status: 'planned',
        },
        'dev-1',
        testDb,
      ),
      await saveFinanceTransaction(
        {
          title: 'Água (em atraso)',
          kind: 'fixed',
          categoryId: 'fin-cat-utilities',
          amount: 35,
          date: '2026-11-19',
          status: 'planned',
        },
        'dev-1',
        testDb,
      ),
      await saveFinanceTransaction(
        {
          title: 'Seguro (longe)',
          kind: 'fixed',
          categoryId: 'fin-cat-insurance',
          amount: 150,
          date: '2026-12-15',
          status: 'planned',
        },
        'dev-1',
        testDb,
      ),
    ];

    // Budget progress
    const budgets = buildCategoryBudgetProgress('2026-11', txs, categories);
    expect(budgets).toHaveLength(3);
    expect(budgets[0].category.id).toBe('fin-cat-dining');
    expect(budgets[0].status).toBe('exceeded');
    expect(budgets[0].remaining).toBe(-20);
    expect(budgets[1].category.id).toBe('fin-cat-groceries');
    expect(budgets[1].status).toBe('warning');
    expect(budgets[1].percent).toBe(85);
    expect(budgets[2].category.id).toBe('fin-cat-fuel');
    expect(budgets[2].status).toBe('ok');

    // Multi-month history
    const history = buildMonthlyFinanceHistory('2026-11', 6, txs);
    expect(history.points).toHaveLength(6);
    expect(history.activeMonthsCount).toBe(2);
    expect(history.avgIncome).toBe(2100);
    expect(history.points[4].month).toBe('2026-10');
    expect(history.points[4].balance).toBe(1300);
    expect(history.points[5].month).toBe('2026-11');
    expect(history.points[5].expenses).toBe(580);

    // Upcoming fixed bills within 7 days of 2026-11-21
    const upcoming = getUpcomingFixedBills(txs, '2026-11-21', 7);
    expect(upcoming.map((u) => u.tx.title)).toEqual(['Água (em atraso)', 'Luz (em breve)']);
    expect(upcoming[0].isOverdue).toBe(true);
    expect(upcoming[1].daysUntil).toBe(3);
  });

  it('calcula acerto da conta conjunta (50/50, proporcional e quota fixa) e isola transferências dos totais globais', async () => {
    const categories = buildStarterFinanceCategories('dev-1');
    const now = '2026-11-22T10:00:00.000Z';
    const members: HouseholdMember[] = [
      {
        id: 'mem-a',
        name: 'André',
        role: 'adult',
        dietaryNotes: '',
        allergies: [],
        defaultServingsWeight: 1,
        avatarColor: '#0f766e',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        lastModifiedBy: 'dev-1',
      },
      {
        id: 'mem-b',
        name: 'Inês',
        role: 'adult',
        dietaryNotes: '',
        allergies: [],
        defaultServingsWeight: 1,
        avatarColor: '#6366f1',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        lastModifiedBy: 'dev-1',
      },
    ];

    const jointAcc: FinanceAccount = {
      id: 'fin-acc-joint',
      name: 'Conta Conjunta',
      accountType: 'joint',
      memberId: null,
      colorToken: 'teal',
      initialBalance: 1000,
      splitMode: 'equal',
      fixedQuota: null,
      sortOrder: 1,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      lastModifiedBy: 'dev-1',
    };
    const accA: FinanceAccount = {
      ...jointAcc,
      id: 'acc-a',
      name: 'Conta André',
      accountType: 'personal',
      memberId: 'mem-a',
      initialBalance: 500,
      splitMode: undefined,
      fixedQuota: 750,
      sortOrder: 2,
    };
    const accB: FinanceAccount = {
      ...jointAcc,
      id: 'acc-b',
      name: 'Conta Inês',
      accountType: 'personal',
      memberId: 'mem-b',
      initialBalance: 800,
      splitMode: undefined,
      fixedQuota: 650,
      sortOrder: 3,
    };
    const accounts = [jointAcc, accA, accB];

    // Ordenado André cai na Conjunta (1600€), Ordenado Inês cai na Conta Inês (1400€), Despesas comuns na Conjunta (1200€)
    const txs: FinanceTransaction[] = [
      await saveFinanceTransaction(
        {
          title: 'Ordenado André',
          kind: 'income',
          categoryId: 'fin-cat-salary',
          accountId: 'fin-acc-joint',
          memberId: 'mem-a',
          amount: 1600,
          date: '2026-11-25',
          status: 'paid',
        },
        'dev-1',
        testDb,
      ),
      await saveFinanceTransaction(
        {
          title: 'Ordenado Inês',
          kind: 'income',
          categoryId: 'fin-cat-salary',
          accountId: 'acc-b',
          memberId: 'mem-b',
          amount: 1400,
          date: '2026-11-25',
          status: 'paid',
        },
        'dev-1',
        testDb,
      ),
      await saveFinanceTransaction(
        {
          title: 'Crédito + Despesas Comuns',
          kind: 'fixed',
          categoryId: 'fin-cat-housing',
          accountId: 'fin-acc-joint',
          amount: 1200,
          date: '2026-11-02',
          status: 'paid',
        },
        'dev-1',
        testDb,
      ),
    ];

    // 1) Modo 50/50
    const equalSettle = calculateJointAccountSettlement('2026-11', jointAcc, accounts, txs, members)!;
    expect(equalSettle.jointExpensesTotal).toBe(1200);
    const equalA = equalSettle.participants.find((p) => p.account.id === 'acc-a')!;
    const equalB = equalSettle.participants.find((p) => p.account.id === 'acc-b')!;
    expect(equalA.targetShare).toBe(600);
    expect(equalA.direction).toBe('from_joint');
    expect(equalA.amountToTransfer).toBe(1000); // 1600 - 600
    expect(equalB.targetShare).toBe(600);
    expect(equalB.direction).toBe('to_joint');
    expect(equalB.amountToTransfer).toBe(600);

    // 2) Modo Proporcional (1600/3000 = 53.33% -> 640€, 1400/3000 = 46.67% -> 560€)
    const propSettle = calculateJointAccountSettlement(
      '2026-11',
      { ...jointAcc, splitMode: 'proportional' },
      accounts,
      txs,
      members,
    )!;
    const propA = propSettle.participants.find((p) => p.account.id === 'acc-a')!;
    const propB = propSettle.participants.find((p) => p.account.id === 'acc-b')!;
    expect(propA.targetShare).toBe(640);
    expect(propA.amountToTransfer).toBe(960);
    expect(propB.targetShare).toBe(560);
    expect(propB.amountToTransfer).toBe(560);

    // 3) Modo Quota fixa (750€ e 650€)
    const fixedSettle = calculateJointAccountSettlement(
      '2026-11',
      { ...jointAcc, splitMode: 'fixed' },
      accounts,
      txs,
      members,
    )!;
    expect(fixedSettle.participants.find((p) => p.account.id === 'acc-a')?.amountToTransfer).toBe(850);
    expect(fixedSettle.participants.find((p) => p.account.id === 'acc-b')?.amountToTransfer).toBe(650);

    // Registar as 2 transferências do modo 50/50 -> ambos ficam Acertados e os totais globais não mudam!
    const txsWithTransfers = [
      ...txs,
      await saveFinanceTransaction(
        {
          title: 'Acerto André',
          kind: 'transfer',
          categoryId: '',
          accountId: 'fin-acc-joint',
          toAccountId: 'acc-a',
          amount: 1000,
          date: '2026-11-26',
          status: 'paid',
        },
        'dev-1',
        testDb,
      ),
      await saveFinanceTransaction(
        {
          title: 'Acerto Inês',
          kind: 'transfer',
          categoryId: '',
          accountId: 'acc-b',
          toAccountId: 'fin-acc-joint',
          amount: 600,
          date: '2026-11-26',
          status: 'paid',
        },
        'dev-1',
        testDb,
      ),
    ];

    const afterSettle = calculateJointAccountSettlement(
      '2026-11',
      jointAcc,
      accounts,
      txsWithTransfers,
      members,
    )!;
    expect(afterSettle.participants.every((p) => p.direction === 'settled')).toBe(true);

    // Global summary ignores internal transfers
    const globalSummary = summarizeMonthFinances('2026-11', txsWithTransfers, categories, 'all');
    expect(globalSummary.incomeTotal).toBe(3000);
    expect(globalSummary.expensesTotal).toBe(1200);
    expect(globalSummary.balanceTotal).toBe(1800);

    // Per-account summary & accumulated balance include transfers accurately
    const summaryA = summarizeMonthFinances('2026-11', txsWithTransfers, categories, 'acc-a');
    expect(summaryA.transfersIn).toBe(1000);
    expect(summaryA.balanceTotal).toBe(1000);
    expect(computeAccountAccumulatedBalance(accA, txsWithTransfers)).toBe(1500); // 500 + 1000
    expect(computeAccountAccumulatedBalance(accB, txsWithTransfers)).toBe(1600); // 800 + 1400 - 600
    expect(computeAccountAccumulatedBalance(jointAcc, txsWithTransfers)).toBe(1000); // 1000 + 1600 - 1200 - 1000 + 600
  });
});
