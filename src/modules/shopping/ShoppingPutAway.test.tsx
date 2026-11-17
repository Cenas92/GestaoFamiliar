import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/database';
import type { CatalogItem, ShoppingItem, StockLot, StorageLocation } from '../../types/domain';
import { ShoppingView } from './ShoppingView';

const PANTRY: StorageLocation = {
  id: 'loc-pantry',
  name: 'Despensa',
  locationType: 'pantry',
  colorToken: 'amber',
  icon: 'package',
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

const TUNA_CATALOG: CatalogItem = {
  id: 'cat-tuna',
  name: 'Atum Azeite',
  aliases: [],
  category: 'food',
  trackingMode: 'exact',
  defaultUnit: 'un',
  defaultPackageSize: 85,
  defaultPackageUnit: 'g',
  defaultLocationId: PANTRY.id,
  minStockQty: null,
  supermarketSection: 'pantry',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

describe('ShoppingView PutAway with package sizes, lot merging and free-text creation', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await db.stockLots.clear();
    await db.shoppingItems.clear();
    await db.catalogItems.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('merges identical packaged lots, preserves distinct package sizes, and imports free-text items to stock', async () => {
    const existingLot: StockLot = {
      id: 'lot-existing-tuna',
      catalogItemId: TUNA_CATALOG.id,
      productLabel: 'Atum Azeite',
      locationId: PANTRY.id,
      quantity: 3,
      unit: 'un',
      packageSize: 85,
      packageUnit: 'g',
      qualitativeLevel: null,
      expiresAt: null,
      frozenOrCookedAt: null,
      isLeftover: false,
      sourceRecipeId: null,
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
      lastModifiedBy: 'dev-1',
    };

    const checkedShopping: ShoppingItem[] = [
      {
        id: 'shop-tuna-buy',
        catalogItemId: TUNA_CATALOG.id,
        label: 'Atum Azeite',
        quantity: 2,
        unit: 'un',
        packageSize: 85,
        packageUnit: 'g',
        section: 'pantry',
        checked: true,
        targetLocationId: PANTRY.id,
        source: 'manual',
        notes: '',
        createdAt: '2026-11-17T10:00:00.000Z',
        updatedAt: '2026-11-17T10:00:00.000Z',
        deletedAt: null,
        lastModifiedBy: 'dev-1',
      },
      {
        id: 'shop-corn-free',
        catalogItemId: null,
        label: 'Milho Doce',
        quantity: 4,
        unit: 'un',
        packageSize: 70,
        packageUnit: 'g',
        section: 'pantry',
        checked: true,
        targetLocationId: PANTRY.id,
        source: 'manual',
        notes: '',
        createdAt: '2026-11-17T10:00:00.000Z',
        updatedAt: '2026-11-17T10:00:00.000Z',
        deletedAt: null,
        lastModifiedBy: 'dev-1',
      },
    ];

    await db.catalogItems.put(TUNA_CATALOG);
    await db.stockLots.put(existingLot);
    await db.shoppingItems.bulkPut(checkedShopping);

    render(
      <ShoppingView
        shoppingItems={checkedShopping}
        catalogItems={[TUNA_CATALOG]}
        stockLots={[existingLot]}
        locations={[PANTRY]}
        expiryWarningDays={5}
        deviceId="dev-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Arrumar \(2\)/i }));

    expect(screen.getByText(/Somar ao lote existente \(3 un \+ 2\)/i)).toBeInTheDocument();
    expect(screen.getByText('Novo no catálogo')).toBeInTheDocument();
    expect(
      (screen.getByLabelText('Tamanho embalagem de Atum Azeite') as HTMLInputElement).value,
    ).toBe('85');
    expect(
      (screen.getByLabelText('Tamanho embalagem de Milho Doce') as HTMLInputElement).value,
    ).toBe('70');

    fireEvent.click(screen.getByRole('button', { name: /Confirmar arrumação/i }));

    await waitFor(async () => {
      const mergedTuna = await db.stockLots.get(existingLot.id);
      expect(mergedTuna?.quantity).toBe(5);
      expect(mergedTuna?.packageSize).toBe(85);

      const allLots = await db.stockLots.toArray();
      const cornLot = allLots.find((l) => l.productLabel === 'Milho Doce');
      expect(cornLot).toBeDefined();
      expect(cornLot?.quantity).toBe(4);
      expect(cornLot?.unit).toBe('un');
      expect(cornLot?.packageSize).toBe(70);
      expect(cornLot?.packageUnit).toBe('g');

      const allCats = await db.catalogItems.toArray();
      const cornCat = allCats.find((c) => c.name === 'Milho Doce');
      expect(cornCat).toBeDefined();
      expect(cornCat?.defaultPackageSize).toBe(70);
    });
  });
});
