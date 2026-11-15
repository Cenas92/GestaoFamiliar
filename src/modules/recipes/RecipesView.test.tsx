import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  CatalogItem,
  HouseholdMember,
  Recipe,
  StockLot,
  StorageLocation,
} from '../../types/domain';
import { RecipesView } from './RecipesView';
import { RECIPE_PREFS_STORAGE_KEY } from './recipeVisuals';

const LOCATIONS: StorageLocation[] = [
  {
    id: 'loc-fridge',
    name: 'Frigorífico',
    locationType: 'fridge',
    colorToken: 'cyan',
    icon: 'thermometer',
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
];

const CATALOG: CatalogItem[] = [
  {
    id: 'cat-potato',
    name: 'Batata',
    aliases: [],
    category: 'food',
    trackingMode: 'exact',
    defaultUnit: 'g',
    defaultLocationId: 'loc-fridge',
    minStockQty: null,
    supermarketSection: 'produce',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
  {
    id: 'cat-fish',
    name: 'Pescada',
    aliases: [],
    category: 'food',
    trackingMode: 'exact',
    defaultUnit: 'g',
    defaultLocationId: 'loc-fridge',
    minStockQty: null,
    supermarketSection: 'meat_fish',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
];

const LOTS: StockLot[] = [
  {
    id: 'lot-potato',
    catalogItemId: 'cat-potato',
    productLabel: 'Batata Branca',
    locationId: 'loc-fridge',
    quantity: 1000,
    unit: 'g',
    qualitativeLevel: null,
    expiresAt: null,
    frozenOrCookedAt: null,
    isLeftover: false,
    sourceRecipeId: null,
    notes: '',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
];

const MEMBERS: HouseholdMember[] = [
  {
    id: 'mem-1',
    name: 'André',
    role: 'adult',
    dietaryNotes: '',
    allergies: [],
    defaultServingsWeight: 1,
    avatarColor: '#0f766e',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
];

const RECIPES: Recipe[] = [
  {
    id: 'rec-soup',
    title: 'Creme de Batata',
    prepMinutes: 10,
    cookMinutes: 10,
    baseServings: 4,
    category: 'soup',
    tags: ['rápida'],
    containsAllergens: [],
    favoriteMemberIds: ['mem-1'],
    kidFriendly: true,
    notes: 'Triturar até ficar cremoso.',
    photoAttachmentId: null,
    docAttachmentId: null,
    timesCooked: 3,
    lastCookedAt: '2026-11-10',
    ingredients: [
      {
        id: 'ing-1',
        catalogItemId: 'cat-potato',
        customLabel: '',
        quantity: 400,
        unit: 'g',
        toTaste: false,
        isOptional: false,
        substituteCatalogIds: [],
      },
    ],
    steps: [
      {
        id: 'step-1',
        order: 1,
        instruction: 'Cozer e triturar.',
        robotTime: '',
        robotTemp: '',
        robotSpeed: '',
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
  {
    id: 'rec-fish',
    title: 'Pescada no Forno',
    prepMinutes: 15,
    cookMinutes: 35,
    baseServings: 4,
    category: 'fish',
    tags: [],
    containsAllergens: [],
    favoriteMemberIds: [],
    kidFriendly: false,
    notes: '',
    photoAttachmentId: null,
    docAttachmentId: null,
    timesCooked: 0,
    lastCookedAt: null,
    ingredients: [
      {
        id: 'ing-2',
        catalogItemId: 'cat-fish',
        customLabel: '',
        quantity: 600,
        unit: 'g',
        toTaste: false,
        isOptional: false,
        substituteCatalogIds: [],
      },
    ],
    steps: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
];

describe('RecipesView compact filters, view modes, icons and grouping', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('defaults to Cartões padrão, expands Cartões detalhados and persists viewMode in localStorage', () => {
    render(
      <RecipesView
        recipes={RECIPES}
        stockLots={LOTS}
        catalogItems={CATALOG}
        locations={LOCATIONS}
        members={MEMBERS}
        shoppingItems={[]}
        expiryWarningDays={5}
        deviceId="dev-1"
      />,
    );

    const mediumBtn = screen.getByRole('button', { name: 'Cartões padrão' });
    const detailedBtn = screen.getByRole('button', { name: 'Cartões detalhados' });
    expect(mediumBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Triturar até ficar cremoso.')).not.toBeInTheDocument();

    fireEvent.click(detailedBtn);
    expect(detailedBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Triturar até ficar cremoso.')).toBeInTheDocument();
    expect(screen.getByText('#rápida')).toBeInTheDocument();
    expect(screen.getByText(/Cozinhada 3x · Última vez: 10\/11\/2026/)).toBeInTheDocument();
    expect(screen.getByText('✓ Batata')).toBeInTheDocument();

    const stored = JSON.parse(window.localStorage.getItem(RECIPE_PREFS_STORAGE_KEY) || '{}');
    expect(stored.viewMode).toBe('detailed');

    cleanup();
    render(
      <RecipesView
        recipes={RECIPES}
        stockLots={LOTS}
        catalogItems={CATALOG}
        locations={LOCATIONS}
        members={MEMBERS}
        shoppingItems={[]}
        expiryWarningDays={5}
        deviceId="dev-1"
      />,
    );
    expect(screen.getByRole('button', { name: 'Cartões detalhados' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('supports Grelha em quadrados, Lista em linha and opening RecipeDetailModal on click', () => {
    render(
      <RecipesView
        recipes={RECIPES}
        stockLots={LOTS}
        catalogItems={CATALOG}
        locations={LOCATIONS}
        members={MEMBERS}
        shoppingItems={[]}
        expiryWarningDays={5}
        deviceId="dev-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Grelha em quadrados' }));
    expect(screen.getByLabelText('Sopas')).toBeInTheDocument();
    expect(screen.getByLabelText('Peixe')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Creme de Batata, Pronta 100%, 20 minutos/ }));
    expect(screen.getByRole('dialog', { name: 'Creme de Batata' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    fireEvent.click(screen.getByRole('button', { name: 'Lista compacta em linha' }));
    fireEvent.click(screen.getByRole('button', { name: /Pescada no Forno/ }));
    expect(screen.getByRole('dialog', { name: 'Pescada no Forno' })).toBeInTheDocument();
  });

  it('supports collapsible category grouping and mobile collapsible filters with quick-clear chips', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 375,
    });

    try {
      render(
        <RecipesView
          recipes={RECIPES}
          stockLots={LOTS}
          catalogItems={CATALOG}
          locations={LOCATIONS}
          members={MEMBERS}
          shoppingItems={[]}
          expiryWarningDays={5}
          deviceId="dev-1"
        />,
      );

      // Collapsed on mobile (< 640px)
      const filtersBtn = screen.getByRole('button', { name: /Filtros/i });
      expect(filtersBtn).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByLabelText('Filtrar por categoria')).not.toBeInTheDocument();

      fireEvent.click(filtersBtn);
      fireEvent.change(screen.getByLabelText('Filtrar por categoria'), {
        target: { value: 'soup' },
      });
      fireEvent.click(filtersBtn);

      expect(screen.getByText('Creme de Batata')).toBeInTheDocument();
      expect(screen.queryByText('Pescada no Forno')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Remover filtro Sopas' }));
      expect(screen.getByText('Pescada no Forno')).toBeInTheDocument();

      // Collapsible category grouping
      fireEvent.click(screen.getByRole('button', { name: /Agrupar/i }));
      const fishHeader = screen
        .getAllByRole('button', { name: /Peixe/i })
        .find((b) => b.hasAttribute('aria-expanded'));
      expect(fishHeader).toBeDefined();
      expect(fishHeader).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(fishHeader!);
      expect(fishHeader).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('Pescada no Forno')).not.toBeInTheDocument();
      expect(screen.getByText('Creme de Batata')).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: originalWidth,
      });
    }
  });
});
