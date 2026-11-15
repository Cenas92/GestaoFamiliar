import { describe, expect, it } from 'vitest';
import type { CatalogItem, StockLot, StorageLocation } from '../../types/domain';
import {
  applyLotDeductions,
  buildNewStockLot,
  getLotExpiryInfo,
  planLotDeduction,
  summarizeCatalogStock,
} from './stockService';

const fridge: StorageLocation = {
  id: 'loc-fridge',
  name: 'Frigorífico',
  locationType: 'fridge',
  colorToken: 'cyan',
  icon: 'refrigerator',
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

const freezer: StorageLocation = {
  id: 'loc-freezer',
  name: 'Congelador',
  locationType: 'freezer',
  colorToken: 'blue',
  icon: 'snowflake',
  sortOrder: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

const locationsMap = new Map<string, StorageLocation>([
  [fridge.id, fridge],
  [freezer.id, freezer],
]);

const flourCatalog: CatalogItem = {
  id: 'cat-flour',
  name: 'Farinha',
  aliases: [],
  category: 'food',
  trackingMode: 'exact',
  defaultUnit: 'g',
  defaultLocationId: fridge.id,
  minStockQty: 500,
  supermarketSection: 'pantry',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

const oliveOilCatalog: CatalogItem = {
  id: 'cat-oil',
  name: 'Azeite',
  aliases: [],
  category: 'food',
  trackingMode: 'qualitative',
  defaultUnit: 'ml',
  defaultLocationId: fridge.id,
  minStockQty: 1,
  supermarketSection: 'pantry',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

describe('stockService', () => {
  it('detects expired, expiring soon and ok dates', () => {
    const baseLot = buildNewStockLot(
      {
        catalogItemId: flourCatalog.id,
        productLabel: 'Farinha T55',
        locationId: fridge.id,
        quantity: 1,
        unit: 'kg',
        qualitativeLevel: null,
        expiresAt: '2026-11-18',
      },
      'dev-1',
    );

    expect(getLotExpiryInfo(baseLot, 5, '2026-11-15')).toEqual({
      status: 'expiring_soon',
      daysRemaining: 3,
    });
    expect(getLotExpiryInfo(baseLot, 5, '2026-11-20')).toEqual({
      status: 'expired',
      daysRemaining: -2,
    });
    expect(getLotExpiryInfo(baseLot, 2, '2026-11-15')).toEqual({
      status: 'ok',
      daysRemaining: 3,
    });
  });

  it('aggregates exact quantities across compatible units and checks minimum stock', () => {
    const lot1: StockLot = {
      ...buildNewStockLot(
        {
          catalogItemId: flourCatalog.id,
          productLabel: 'Farinha Aberta',
          locationId: fridge.id,
          quantity: 300,
          unit: 'g',
          qualitativeLevel: null,
        },
        'dev-1',
      ),
    };
    const lot2: StockLot = {
      ...buildNewStockLot(
        {
          catalogItemId: flourCatalog.id,
          productLabel: 'Farinha Fechada',
          locationId: fridge.id,
          quantity: 1,
          unit: 'kg',
          qualitativeLevel: null,
        },
        'dev-1',
      ),
    };

    const fullSummary = summarizeCatalogStock(flourCatalog, [lot1, lot2], 5, '2026-11-15');
    expect(fullSummary.totalExactInDefaultUnit).toBe(1300);
    expect(fullSummary.isLowStock).toBe(false);
    expect(fullSummary.isOutOfStock).toBe(false);

    const lowSummary = summarizeCatalogStock(flourCatalog, [lot1], 5, '2026-11-15');
    expect(lowSummary.totalExactInDefaultUnit).toBe(300);
    expect(lowSummary.isLowStock).toBe(true);
  });

  it('summarizes qualitative items properly', () => {
    const lowOil = buildNewStockLot(
      {
        catalogItemId: oliveOilCatalog.id,
        productLabel: 'Azeite Virgem Extra',
        locationId: fridge.id,
        quantity: null,
        unit: null,
        qualitativeLevel: 'low',
      },
      'dev-1',
    );

    const summary = summarizeCatalogStock(oliveOilCatalog, [lowOil], 5, '2026-11-15');
    expect(summary.bestQualitativeLevel).toBe('low');
    expect(summary.isLowStock).toBe(true);
    expect(summary.isOutOfStock).toBe(false);
  });

  it('plans FEFO deduction preferring earliest expiry and non-freezer before freezer', () => {
    const lotFreezer = buildNewStockLot(
      {
        catalogItemId: flourCatalog.id,
        productLabel: 'Lote Congelador',
        locationId: freezer.id,
        quantity: 1,
        unit: 'kg',
        qualitativeLevel: null,
        expiresAt: null,
      },
      'dev-1',
    );
    const lotSoon = buildNewStockLot(
      {
        catalogItemId: flourCatalog.id,
        productLabel: 'Lote Frigorífico Curto',
        locationId: fridge.id,
        quantity: 400,
        unit: 'g',
        qualitativeLevel: null,
        expiresAt: '2026-11-17',
      },
      'dev-1',
    );
    const lotLater = buildNewStockLot(
      {
        catalogItemId: flourCatalog.id,
        productLabel: 'Lote Frigorífico Longo',
        locationId: fridge.id,
        quantity: 500,
        unit: 'g',
        qualitativeLevel: null,
        expiresAt: '2026-12-01',
      },
      'dev-1',
    );

    const { plan, unfulfilledInTargetUnit } = planLotDeduction(
      [lotFreezer, lotLater, lotSoon],
      locationsMap,
      600,
      'g',
    );

    expect(unfulfilledInTargetUnit).toBe(0);
    expect(plan).toHaveLength(2);
    expect(plan[0].lotId).toBe(lotSoon.id);
    expect(plan[0].remainingInLotUnit).toBe(0);
    expect(plan[1].lotId).toBe(lotLater.id);
    expect(plan[1].deductInLotUnit).toBe(200);
    expect(plan[1].remainingInLotUnit).toBe(300);

    const updatedLots = applyLotDeductions([lotFreezer, lotLater, lotSoon], plan, 'dev-1');
    const depleted = updatedLots.find((l) => l.id === lotSoon.id);
    const partial = updatedLots.find((l) => l.id === lotLater.id);
    expect(depleted?.deletedAt).not.toBeNull();
    expect(partial?.deletedAt).toBeNull();
    expect(partial?.quantity).toBe(300);
  });
});
