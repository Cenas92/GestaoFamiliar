import { describe, expect, it } from 'vitest';
import type {
  CatalogItem,
  HouseholdMember,
  Recipe,
  StorageLocation,
} from '../../types/domain';
import { buildNewStockLot } from '../stock/stockService';
import { evaluateRecipeMatch } from './matchingEngine';

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

const chickenCat: CatalogItem = {
  id: 'cat-chicken',
  name: 'Frango',
  aliases: [],
  category: 'food',
  trackingMode: 'exact',
  defaultUnit: 'g',
  defaultLocationId: freezer.id,
  minStockQty: null,
  supermarketSection: 'meat_fish',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

const creamCat: CatalogItem = {
  id: 'cat-cream',
  name: 'Natas',
  aliases: [],
  category: 'food',
  trackingMode: 'exact',
  defaultUnit: 'ml',
  defaultLocationId: fridge.id,
  minStockQty: null,
  supermarketSection: 'dairy',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

const yogurtCat: CatalogItem = {
  id: 'cat-yogurt',
  name: 'Iogurte natural',
  aliases: [],
  category: 'food',
  trackingMode: 'exact',
  defaultUnit: 'ml',
  defaultLocationId: fridge.id,
  minStockQty: null,
  supermarketSection: 'dairy',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

const saltCat: CatalogItem = {
  id: 'cat-salt',
  name: 'Sal',
  aliases: [],
  category: 'food',
  trackingMode: 'qualitative',
  defaultUnit: 'g',
  defaultLocationId: fridge.id,
  minStockQty: null,
  supermarketSection: 'pantry',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

const sampleRecipe: Recipe = {
  id: 'rec-1',
  title: 'Frango com Natas',
  prepMinutes: 10,
  cookMinutes: 20,
  baseServings: 4,
  category: 'meat',
  tags: ['Rápida'],
  containsAllergens: ['Lactose'],
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
      id: 'ing-1',
      catalogItemId: chickenCat.id,
      customLabel: '',
      quantity: 600,
      unit: 'g',
      toTaste: false,
      isOptional: false,
      substituteCatalogIds: [],
    },
    {
      id: 'ing-2',
      catalogItemId: creamCat.id,
      customLabel: '',
      quantity: 200,
      unit: 'ml',
      toTaste: false,
      isOptional: false,
      substituteCatalogIds: [yogurtCat.id],
    },
    {
      id: 'ing-3',
      catalogItemId: saltCat.id,
      customLabel: '',
      quantity: null,
      unit: null,
      toTaste: true,
      isOptional: false,
      substituteCatalogIds: [],
    },
  ],
  steps: [],
};

const childMember: HouseholdMember = {
  id: 'mem-1',
  name: 'Filho',
  role: 'child',
  dietaryNotes: '',
  allergies: ['Lactose'],
  defaultServingsWeight: 0.5,
  avatarColor: '#0f766e',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

describe('matchingEngine', () => {
  it('matches recipe using substitute, scales portions, detects freezer defrost and allergen conflicts', () => {
    const frozenChicken = buildNewStockLot(
      {
        catalogItemId: chickenCat.id,
        productLabel: 'Peito de frango',
        locationId: freezer.id,
        quantity: 0.5,
        unit: 'kg', // 500g -> enough for 2 servings (300g), not enough for 4 servings (600g)!
        qualitativeLevel: null,
      },
      'dev-1',
    );
    const yogurt = buildNewStockLot(
      {
        catalogItemId: yogurtCat.id,
        productLabel: 'Iogurte grego natural',
        locationId: fridge.id,
        quantity: 250,
        unit: 'ml',
        qualitativeLevel: null,
        expiresAt: '2026-11-17',
      },
      'dev-1',
    );
    const salt = buildNewStockLot(
      {
        catalogItemId: saltCat.id,
        productLabel: 'Sal fino',
        locationId: fridge.id,
        quantity: null,
        unit: null,
        qualitativeLevel: 'full',
      },
      'dev-1',
    );

    const matchFor2 = evaluateRecipeMatch(
      sampleRecipe,
      2,
      [frozenChicken, yogurt, salt],
      [chickenCat, creamCat, yogurtCat, saltCat],
      [fridge, freezer],
      [childMember],
      5,
      '2026-11-15',
    );

    expect(matchFor2.status).toBe('ready');
    expect(matchFor2.needsDefrost).toBe(true);
    expect(matchFor2.defrostIngredientNames).toEqual(['Frango']);
    expect(matchFor2.usedSubstitutes).toEqual(['Natas → Iogurte natural']);
    expect(matchFor2.expiringSoonCount).toBe(1);
    expect(matchFor2.allergenConflicts).toEqual(['Filho (Lactose)']);

    const matchFor4 = evaluateRecipeMatch(
      sampleRecipe,
      4,
      [frozenChicken, yogurt, salt],
      [chickenCat, creamCat, yogurtCat, saltCat],
      [fridge, freezer],
      [],
      5,
      '2026-11-15',
    );

    expect(matchFor4.status).toBe('almost');
    expect(matchFor4.missingMandatoryCount).toBe(1);
    expect(matchFor4.missingIngredients[0].missingQuantity).toBe(100);
  });

  it('does not trigger defrost warning when enough stock exists in fridge', () => {
    const freshChicken = buildNewStockLot(
      {
        catalogItemId: chickenCat.id,
        productLabel: 'Frango fresco',
        locationId: fridge.id,
        quantity: 800,
        unit: 'g',
        qualitativeLevel: null,
      },
      'dev-1',
    );
    const frozenChicken = buildNewStockLot(
      {
        catalogItemId: chickenCat.id,
        productLabel: 'Frango congelado',
        locationId: freezer.id,
        quantity: 1,
        unit: 'kg',
        qualitativeLevel: null,
      },
      'dev-1',
    );
    const cream = buildNewStockLot(
      {
        catalogItemId: creamCat.id,
        productLabel: 'Natas',
        locationId: fridge.id,
        quantity: 400,
        unit: 'ml',
        qualitativeLevel: null,
      },
      'dev-1',
    );
    const salt = buildNewStockLot(
      {
        catalogItemId: saltCat.id,
        productLabel: 'Sal',
        locationId: fridge.id,
        quantity: null,
        unit: null,
        qualitativeLevel: 'full',
      },
      'dev-1',
    );

    const res = evaluateRecipeMatch(
      sampleRecipe,
      4,
      [freshChicken, frozenChicken, cream, salt],
      [chickenCat, creamCat, saltCat],
      [fridge, freezer],
      [],
      5,
      '2026-11-15',
    );

    expect(res.status).toBe('ready');
    expect(res.needsDefrost).toBe(false);
  });

  it('evaluates recipe requirements in grams against stock tracked as un × packageSize', () => {
    const tunaCat: CatalogItem = {
      ...chickenCat,
      id: 'cat-tuna',
      name: 'Atum',
      defaultUnit: 'un',
      defaultPackageSize: 85,
      defaultPackageUnit: 'g',
      defaultLocationId: fridge.id,
    };

    const tunaRecipe: Recipe = {
      ...sampleRecipe,
      id: 'rec-tuna',
      title: 'Salada de Atum',
      baseServings: 2,
      containsAllergens: [],
      ingredients: [
        {
          id: 'ing-tuna',
          catalogItemId: tunaCat.id,
          customLabel: '',
          quantity: 200,
          unit: 'g',
          toTaste: false,
          isOptional: false,
          substituteCatalogIds: [],
        },
      ],
    };

    const threeCans = buildNewStockLot(
      {
        catalogItemId: tunaCat.id,
        productLabel: 'Atum Azeite',
        locationId: fridge.id,
        quantity: 3,
        unit: 'un',
        packageSize: 85,
        packageUnit: 'g',
        qualitativeLevel: null,
      },
      'dev-1',
    );

    const readyRes = evaluateRecipeMatch(
      tunaRecipe,
      2,
      [threeCans],
      [tunaCat],
      [fridge],
      [],
      5,
      '2026-11-15',
    );
    expect(readyRes.status).toBe('ready');
    expect(readyRes.ingredientDetails[0].availableQuantity).toBe(255);
    expect(readyRes.ingredientDetails[0].missingQuantity).toBe(0);

    // Scaling to 4 servings requires 400 g -> 145 g missing
    const scaledRes = evaluateRecipeMatch(
      tunaRecipe,
      4,
      [threeCans],
      [tunaCat],
      [fridge],
      [],
      5,
      '2026-11-15',
    );
    expect(scaledRes.status).toBe('almost');
    expect(scaledRes.ingredientDetails[0].missingQuantity).toBe(145);
  });
});
