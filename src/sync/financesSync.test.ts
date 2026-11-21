import { describe, expect, it } from 'vitest';
import { buildStarterFinanceCategories } from '../data/starterCatalog';
import type { FinanceRecurringRule, FinanceTransaction } from '../types/domain';
import { type FamilySyncSnapshot, mergeFamilySnapshots } from './mergeEngine';

function baseSnapshot(deviceId: string): FamilySyncSnapshot {
  return {
    schemaVersion: 1,
    exportedAt: '2026-11-21T10:00:00.000Z',
    exportedByDevice: deviceId,
    locations: [],
    supermarketSections: [],
    catalogItems: [],
    stockLots: [],
    recipes: [],
    mealPlan: [],
    shoppingItems: [],
    members: [],
    attachmentManifest: [],
  };
}

describe('mergeFamilySnapshots (finances)', () => {
  it('funde categorias, regras recorrentes e movimentos financeiros via LWW mantendo compatibilidade', () => {
    const localCat = buildStarterFinanceCategories('dev-a')[0];
    const remoteCat = {
      ...localCat,
      name: 'Ordenado Mensal',
      updatedAt: '2026-11-21T12:00:00.000Z',
      lastModifiedBy: 'dev-b',
    };

    const localRule: FinanceRecurringRule = {
      id: 'rule-1',
      title: 'Renda',
      kind: 'fixed',
      categoryId: 'fin-cat-housing',
      amount: 750,
      frequency: 'monthly',
      dayOfMonth: 1,
      startMonth: '2026-01',
      isActive: true,
      memberId: null,
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-11-21T09:00:00.000Z',
      deletedAt: null,
      lastModifiedBy: 'dev-a',
    };

    const remoteTx: FinanceTransaction = {
      id: 'fin-rec-rule-1-2026-11',
      title: 'Renda',
      kind: 'fixed',
      categoryId: 'fin-cat-housing',
      amount: 750,
      date: '2026-11-01',
      month: '2026-11',
      status: 'paid',
      recurringRuleId: 'rule-1',
      memberId: null,
      notes: '',
      photoAttachmentId: null,
      isWarranty: false,
      warrantyExpiresAt: null,
      warrantyStore: '',
      excludeFromTotals: false,
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-21T11:00:00.000Z',
      deletedAt: null,
      lastModifiedBy: 'dev-b',
    };

    const local: FamilySyncSnapshot = {
      ...baseSnapshot('dev-a'),
      financeCategories: [localCat],
      financeRecurring: [localRule],
      financeTransactions: [],
    };
    const remote: FamilySyncSnapshot = {
      ...baseSnapshot('dev-b'),
      financeCategories: [remoteCat],
      financeRecurring: [],
      financeTransactions: [remoteTx],
    };

    const outcome = mergeFamilySnapshots(local, remote, [], 'dev-a');
    expect(outcome.mergedSnapshot.financeCategories?.[0].name).toBe('Ordenado Mensal');
    expect(outcome.mergedSnapshot.financeRecurring).toHaveLength(1);
    expect(outcome.mergedSnapshot.financeTransactions).toHaveLength(1);
    expect(outcome.mergedSnapshot.financeTransactions?.[0].status).toBe('paid');
    expect(outcome.stats.updatedFromRemote).toBe(1);
    expect(outcome.stats.addedFromRemote).toBe(1);
    expect(outcome.stats.localChangesToPush).toBe(1);
  });

  it('suporta snapshots legados sem coleções financeiras', () => {
    const local = baseSnapshot('dev-a');
    const remote = baseSnapshot('dev-b');
    const outcome = mergeFamilySnapshots(local, remote, [], 'dev-a');
    expect(outcome.mergedSnapshot.financeCategories).toEqual([]);
    expect(outcome.mergedSnapshot.financeRecurring).toEqual([]);
    expect(outcome.mergedSnapshot.financeTransactions).toEqual([]);
  });
});
