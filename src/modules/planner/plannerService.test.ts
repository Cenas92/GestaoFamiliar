import { describe, expect, it } from 'vitest';
import type {
  CatalogItem,
  MealPlanEntry,
  Recipe,
  ShoppingItem,
  StorageLocation,
} from '../../types/domain';
import { buildNewStockLot } from '../stock/stockService';
import {
  buildShoppingItem,
  computeMealPlanMissingNeeds,
  getTomorrowDefrostReminders,
} from './plannerService';

const freezer: StorageLocation = {
  id: 'loc-freezer',
  name: 'Congelador',
  locationType: 'freezer',
  colorToken: 'blue',
  icon: 'snowflake',
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

const riceCat: CatalogItem = {
  id: 'cat-rice',
  name: 'Arroz',
  aliases: [],
  category: 'food',
  trackingMode: 'exact',
  defaultUnit: 'g',
  defaultLocationId: freezer.id,
  minStockQty: null,
  supermarketSection: 'pantry',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

const fishCat: CatalogItem = {
  id: 'cat-fish',
  name: 'Pescada',
  aliases: [],
  category: 'food',
  trackingMode: 'exact',
  defaultUnit: 'g',
  defaultLocationId: freezer.id,
  minStockQty: null,
  supermarketSection: 'frozen',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

const recipe: Recipe = {
  id: 'rec-fish',
  title: 'Pescada com Arroz',
  prepMinutes: 10,
  cookMinutes: 25,
  baseServings: 2,
  category: 'fish',
  tags: [],
  containsAllergens: [],
  favoriteMemberIds: [],
  kidFriendly: true,
  notes: '',
  photoAttachmentId: null,
  docAttachmentId: null,
  timesCooked: 0,
  lastCookedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
  ingredients: [
    {
      id: 'i1',
      catalogItemId: fishCat.id,
      customLabel: '',
      quantity: 400,
      unit: 'g',
      toTaste: false,
      isOptional: false,
      substituteCatalogIds: [],
    },
    {
      id: 'i2',
      catalogItemId: riceCat.id,
      customLabel: '',
      quantity: 300,
      unit: 'g',
      toTaste: false,
      isOptional: false,
      substituteCatalogIds: [],
    },
  ],
  steps: [],
};

describe('plannerService', () => {
  it('computes net missing quantities across planned meals minus stock and active shopping list', () => {
    const entries: MealPlanEntry[] = [
      {
        id: 'mp-1',
        date: '2026-11-16',
        slot: 'dinner',
        recipeId: recipe.id,
        plannedServings: 4, // needs 800g fish, 600g rice
        customLabel: '',
        completed: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        deletedAt: null,
        lastModifiedBy: 'dev-1',
      },
    ];

    const stockFish = buildNewStockLot(
      {
        catalogItemId: fishCat.id,
        productLabel: 'Pescada',
        locationId: freezer.id,
        quantity: 500,
        unit: 'g',
        qualitativeLevel: null,
      },
      'dev-1',
    );

    const queuedRice: ShoppingItem = buildShoppingItem(
      {
        catalogItemId: riceCat.id,
        label: 'Arroz',
        quantity: 200,
        unit: 'g',
        section: 'pantry',
        targetLocationId: freezer.id,
        source: 'manual',
      },
      'dev-1',
    );

    const needs = computeMealPlanMissingNeeds(
      entries,
      [recipe],
      [riceCat, fishCat],
      [stockFish],
      [queuedRice],
    );

    const fishNeed = needs.find((n) => n.catalogItemId === fishCat.id);
    const riceNeed = needs.find((n) => n.catalogItemId === riceCat.id);
    expect(fishNeed?.missingQuantity).toBe(300);
    expect(riceNeed?.missingQuantity).toBe(400);
  });

  it('produces defrost reminders for tomorrow meals when ingredients are in freezer', () => {
    const entries: MealPlanEntry[] = [
      {
        id: 'mp-tomorrow',
        date: '2026-11-16',
        slot: 'lunch',
        recipeId: recipe.id,
        plannedServings: 2,
        customLabel: '',
        completed: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        deletedAt: null,
        lastModifiedBy: 'dev-1',
      },
    ];

    const stockFish = buildNewStockLot(
      {
        catalogItemId: fishCat.id,
        productLabel: 'Pescada',
        locationId: freezer.id,
        quantity: 1,
        unit: 'kg',
        qualitativeLevel: null,
      },
      'dev-1',
    );

    const reminders = getTomorrowDefrostReminders(
      entries,
      [recipe],
      [stockFish],
      [fishCat, riceCat],
      [freezer],
      5,
      '2026-11-15',
    );

    expect(reminders).toHaveLength(1);
    expect(reminders[0].recipeTitle).toBe('Pescada com Arroz');
    expect(reminders[0].ingredientNames).toEqual(['Pescada']);
  });
});
