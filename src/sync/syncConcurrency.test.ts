import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/database';
import type { ShoppingItem } from '../types/domain';
import { type FamilySyncSnapshot } from './mergeEngine';
import { applySnapshotToLocalDb } from './syncService';

function makeShoppingItem(id: string, label: string, updatedAt: string, deletedAt: string | null): ShoppingItem {
  return {
    id,
    catalogItemId: null,
    label,
    quantity: 1,
    unit: 'un',
    section: 'pantry',
    checked: false,
    targetLocationId: null,
    source: 'manual',
    notes: '',
    photoAttachmentId: null,
    createdAt: '2026-11-22T10:00:00.000Z',
    updatedAt,
    deletedAt,
    lastModifiedBy: 'dev-phone',
  };
}

function emptySnapshot(shoppingItems: ShoppingItem[]): FamilySyncSnapshot {
  return {
    schemaVersion: 1,
    exportedAt: '2026-11-22T10:00:05.000Z',
    exportedByDevice: 'dev-phone',
    locations: [],
    supermarketSections: [],
    catalogItems: [],
    stockLots: [],
    recipes: [],
    mealPlan: [],
    shoppingItems,
    members: [],
    financeCategories: [],
    financeRecurring: [],
    financeTransactions: [],
    attachmentManifest: [],
  };
}

describe('applySnapshotToLocalDb LWW concurrency protection', () => {
  beforeEach(async () => {
    await db.shoppingItems.clear();
  });

  afterEach(async () => {
    await db.shoppingItems.clear();
  });

  it('não reverte nem ressuscita itens removidos rapidamente do carrinho durante um sync em curso', async () => {
    // T1: utilizador removeu item-1; item-2 e item-3 ainda estavam ativos no snapshot antigo do sync
    const staleSyncSnapshot = emptySnapshot([
      makeShoppingItem('shop-1', 'Leite', '2026-11-22T10:00:01.000Z', '2026-11-22T10:00:01.000Z'),
      makeShoppingItem('shop-2', 'Ovos', '2026-11-22T10:00:00.000Z', null),
      makeShoppingItem('shop-3', 'Pão', '2026-11-22T10:00:00.000Z', null),
      // Um item novo vindo de outro dispositivo deve ser inserido normalmente
      makeShoppingItem('shop-4', 'Maçã (outro telemóvel)', '2026-11-22T10:00:02.000Z', null),
    ]);

    // T2 (enquanto o sync de T1 estava na rede): utilizador removeu rapidamente item-2 e item-3 no IndexedDB
    await db.shoppingItems.bulkPut([
      makeShoppingItem('shop-1', 'Leite', '2026-11-22T10:00:01.000Z', '2026-11-22T10:00:01.000Z'),
      makeShoppingItem('shop-2', 'Ovos', '2026-11-22T10:00:03.000Z', '2026-11-22T10:00:03.000Z'),
      makeShoppingItem('shop-3', 'Pão', '2026-11-22T10:00:04.000Z', '2026-11-22T10:00:04.000Z'),
    ]);

    // T3: o sync de T1 termina e aplica o snapshot localmente
    await applySnapshotToLocalDb(staleSyncSnapshot);

    const shop1 = await db.shoppingItems.get('shop-1');
    const shop2 = await db.shoppingItems.get('shop-2');
    const shop3 = await db.shoppingItems.get('shop-3');
    const shop4 = await db.shoppingItems.get('shop-4');

    // Todos os 3 itens removidos devem continuar removidos (deletedAt !== null)
    expect(shop1?.deletedAt).toBe('2026-11-22T10:00:01.000Z');
    expect(shop2?.deletedAt).toBe('2026-11-22T10:00:03.000Z');
    expect(shop3?.deletedAt).toBe('2026-11-22T10:00:04.000Z');
    // E o item novo do outro dispositivo foi adicionado
    expect(shop4?.label).toBe('Maçã (outro telemóvel)');
    expect(shop4?.deletedAt).toBeNull();
  });
});
