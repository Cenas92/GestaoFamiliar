import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { buildStarterFinanceCategories } from '../../data/starterCatalog';
import type { FinanceRecurringRule, FinanceTransaction } from '../../types/domain';
import { FinancesView } from './FinancesView';

describe('FinancesView', () => {
  const categories = buildStarterFinanceCategories('dev-1');
  const now = '2026-11-21T10:00:00.000Z';

  const sampleTransactions: FinanceTransaction[] = [
    {
      id: 'tx-salary',
      title: 'Ordenado André',
      kind: 'income',
      categoryId: 'fin-cat-salary',
      amount: 1800,
      date: '2026-11-25',
      month: '2026-11',
      status: 'paid',
      recurringRuleId: 'rule-salary',
      memberId: null,
      notes: '',
      photoAttachmentId: null,
      isWarranty: false,
      warrantyExpiresAt: null,
      warrantyStore: '',
      excludeFromTotals: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      lastModifiedBy: 'dev-1',
    },
    {
      id: 'tx-groceries',
      title: 'Supermercado Continente',
      kind: 'variable',
      categoryId: 'fin-cat-groceries',
      amount: 120,
      date: '2026-11-18',
      month: '2026-11',
      status: 'paid',
      recurringRuleId: null,
      memberId: null,
      notes: '',
      photoAttachmentId: null,
      isWarranty: false,
      warrantyExpiresAt: null,
      warrantyStore: '',
      excludeFromTotals: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      lastModifiedBy: 'dev-1',
    },
    {
      id: 'tx-warranty',
      title: 'Máquina de Café Delonghi',
      kind: 'variable',
      categoryId: 'fin-cat-home-tech',
      amount: 350,
      date: '2025-06-10',
      month: '2025-06',
      status: 'paid',
      recurringRuleId: null,
      memberId: null,
      notes: 'Caixa guardada na arrecadação',
      photoAttachmentId: null,
      isWarranty: true,
      warrantyExpiresAt: '2028-06-10',
      warrantyStore: 'Worten',
      excludeFromTotals: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      lastModifiedBy: 'dev-1',
    },
  ];

  const sampleRules: FinanceRecurringRule[] = [
    {
      id: 'rule-salary',
      title: 'Ordenado André',
      kind: 'income',
      categoryId: 'fin-cat-salary',
      amount: 1800,
      frequency: 'monthly',
      dayOfMonth: 25,
      startMonth: '2026-01',
      isActive: true,
      memberId: null,
      notes: '',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      lastModifiedBy: 'dev-1',
    },
  ];

  it('mostra resumo mensal, movimentos, fixas e garantias em sub-abas', () => {
    const onMonthChange = vi.fn();
    render(
      <FinancesView
        categories={categories}
        recurringRules={sampleRules}
        transactions={sampleTransactions}
        members={[]}
        deviceId="dev-1"
        uiDensity="clean"
        activeMonth="2026-11"
        onActiveMonthChange={onMonthChange}
      />,
    );

    expect(screen.getByText('Novembro 2026')).toBeInTheDocument();
    expect(screen.getByText('Ordenado André')).toBeInTheDocument();
    expect(screen.getByText('Supermercado Continente')).toBeInTheDocument();
    // Warranty from another month should not appear in November transactions
    expect(screen.queryByText('Máquina de Café Delonghi')).not.toBeInTheDocument();

    // Switch to Garantias sub-tab
    fireEvent.click(screen.getByRole('button', { name: /Garantias \(1\)/i }));
    expect(screen.getByText('Máquina de Café Delonghi')).toBeInTheDocument();
    expect(screen.getByText(/Worten/i)).toBeInTheDocument();

    // Switch to Resumo sub-tab
    fireEvent.click(screen.getByRole('button', { name: /^Resumo$/i }));
    expect(screen.getByText('Despesas por categoria')).toBeInTheDocument();
    expect(screen.getByText('Supermercado')).toBeInTheDocument();
    expect(screen.getByText('Orçamentos mensais')).toBeInTheDocument();
    expect(screen.getByText('Evolução mensal')).toBeInTheDocument();

    // Toggle 12 months history & click previous month bar
    fireEvent.click(screen.getByRole('button', { name: '12 meses' }));
    expect(screen.getByRole('button', { name: '12 meses' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Ver Out 2026' }));
    expect(onMonthChange).toHaveBeenCalledWith('2026-10');

    // Switch month
    fireEvent.click(screen.getByRole('button', { name: 'Mês seguinte' }));
    expect(onMonthChange).toHaveBeenCalledWith('2026-12');
  });

  it('mostra progresso e alertas de orçamentos mensais quando limites estão definidos', () => {
    const categoriesWithBudget = categories.map((c) =>
      c.id === 'fin-cat-groceries' ? { ...c, monthlyBudget: 100 } : c,
    );

    render(
      <FinancesView
        categories={categoriesWithBudget}
        recurringRules={sampleRules}
        transactions={sampleTransactions}
        members={[]}
        deviceId="dev-1"
        uiDensity="complete"
        activeMonth="2026-11"
        onActiveMonthChange={vi.fn()}
      />,
    );

    // Complete mode shows budget alert pill on top summary card
    expect(screen.getByText(/1 orçamento em alerta este mês/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/1 orçamento em alerta este mês/i));
    expect(screen.getByText(/Ultrapassado em/i)).toBeInTheDocument();
    expect(screen.getByText('120%')).toBeInTheDocument();
  });
});
