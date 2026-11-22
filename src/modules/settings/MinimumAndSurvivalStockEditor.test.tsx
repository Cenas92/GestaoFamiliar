import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/database';
import type { CatalogItem, StockLot, StorageLocation } from '../../types/domain';
import { MinimumAndSurvivalStockEditor } from './MinimumAndSurvivalStockEditor';

const PANTRY: StorageLocation = {
  id: 'starter-loc-pantry',
  name: 'Despensa',
  locationType: 'pantry',
  colorToken: 'amber',
  icon: 'archive',
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

const TUNA_ITEM: CatalogItem = {
  id: 'starter-cat-atum-lata',
  name: 'Atum em conserva',
  aliases: ['atum'],
  category: 'food',
  trackingMode: 'exact',
  defaultUnit: 'un',
  defaultLocationId: 'starter-loc-pantry',
  minStockQty: 2,
  survivalTargetQty: null,
  supermarketSection: 'pantry',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

const TUNA_LOT: StockLot = {
  id: 'lot-tuna',
  catalogItemId: 'starter-cat-atum-lata',
  productLabel: 'Atum em conserva',
  locationId: 'starter-loc-pantry',
  quantity: 3,
  unit: 'un',
  packageSize: 85,
  packageUnit: 'g',
  qualitativeLevel: null,
  expiresAt: '2028-01-01',
  frozenOrCookedAt: null,
  isLeftover: false,
  sourceRecipeId: null,
  notes: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

describe('MinimumAndSurvivalStockEditor', () => {
  beforeEach(async () => {
    await db.catalogItems.clear();
    await db.shoppingItems.clear();
    await db.catalogItems.put(TUNA_ITEM);
  });

  afterEach(async () => {
    await db.catalogItems.clear();
    await db.shoppingItems.clear();
  });

  it('permite editar mínimo diário inline diretamente na linha', async () => {
    render(
      <MinimumAndSurvivalStockEditor
        catalogItems={[TUNA_ITEM]}
        stockLots={[TUNA_LOT]}
        locations={[PANTRY]}
        shoppingItems={[]}
        expiryWarningDays={5}
        deviceId="dev-1"
      />,
    );

    const minInput = screen.getByLabelText('Stock mínimo de Atum em conserva') as HTMLInputElement;
    expect(minInput.value).toBe('2');

    fireEvent.change(minInput, { target: { value: '6' } });
    fireEvent.blur(minInput);

    await waitFor(async () => {
      const updated = await db.catalogItems.get(TUNA_ITEM.id);
      expect(updated?.minStockQty).toBe(6);
    });
  });

  it('cria stock de sobrevivência via sugestão rápida e envia em falta para a Lista de Compras', async () => {
    const tunaWithSurvival: CatalogItem = { ...TUNA_ITEM, survivalTargetQty: 8 };
    await db.catalogItems.put(tunaWithSurvival);

    render(
      <MinimumAndSurvivalStockEditor
        catalogItems={[tunaWithSurvival]}
        stockLots={[TUNA_LOT]}
        locations={[PANTRY]}
        shoppingItems={[]}
        expiryWarningDays={5}
        deviceId="dev-1"
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Sobrevivência/i }));

    // 3 / 8 = 38% readiness
    expect(screen.getByText('38%')).toBeInTheDocument();
    expect(screen.getByText(/Falta:/i)).toBeInTheDocument();

    // Add Água engarrafada via 1-tap preset
    fireEvent.click(screen.getByRole('button', { name: /Água engarrafada/i }));
    await waitFor(async () => {
      const all = await db.catalogItems.toArray();
      const water = all.find((c) => c.name === 'Água engarrafada');
      expect(water?.survivalTargetQty).toBe(18);
      expect(water?.defaultUnit).toBe('L');
    });

    // Send missing survival item (5 un of Atum) to shopping list
    fireEvent.click(screen.getByRole('button', { name: /Enviar em falta \(1\)/i }));
    await waitFor(async () => {
      const shopping = await db.shoppingItems.toArray();
      expect(shopping).toHaveLength(1);
      expect(shopping[0].label).toBe('Atum em conserva');
      expect(shopping[0].quantity).toBe(5);
    });
  });
});
