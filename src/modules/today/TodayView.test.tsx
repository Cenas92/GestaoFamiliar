import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AppSettings,
  CatalogItem,
  HouseholdMember,
  MealPlanEntry,
  Recipe,
  StockLot,
  StorageLocation,
} from '../../types/domain';
import { addDaysToDateString, todayDateString } from '../../utils/units';
import { TodayView } from './TodayView';

const SETTINGS: AppSettings = {
  id: 'singleton',
  expiryWarningDays: 5,
  googleClientId: '',
  googleDriveFolderId: null,
  googleDriveFolderName: null,
  lastSyncAt: null,
  lastSyncStatus: 'idle',
  lastSyncError: null,
  initialized: true,
  deviceId: 'dev-1',
};

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
    id: 'cat-eggs',
    name: 'Ovos',
    aliases: [],
    category: 'food',
    trackingMode: 'exact',
    defaultUnit: 'un',
    defaultLocationId: 'loc-fridge',
    minStockQty: 6,
    supermarketSection: 'dairy',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
  {
    id: 'cat-milk',
    name: 'Leite',
    aliases: [],
    category: 'beverages',
    trackingMode: 'exact',
    defaultUnit: 'L',
    defaultLocationId: 'loc-fridge',
    minStockQty: 4,
    supermarketSection: 'dairy',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
];

const MEMBERS: HouseholdMember[] = [];

function makeRecipe(id: string, title: string, catalogItemId: string): Recipe {
  return {
    id,
    title,
    prepMinutes: 10,
    cookMinutes: 10,
    baseServings: 2,
    category: 'other',
    tags: [],
    containsAllergens: [],
    favoriteMemberIds: [],
    kidFriendly: true,
    notes: '',
    photoAttachmentId: null,
    docAttachmentId: null,
    timesCooked: 0,
    lastCookedAt: null,
    ingredients: [
      {
        id: `ing-${id}`,
        catalogItemId,
        customLabel: '',
        quantity: 1,
        unit: 'un',
        toTaste: false,
        isOptional: false,
        substituteCatalogIds: [],
      },
    ],
    steps: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  };
}

describe('TodayView calm summary', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows only calm daily essentials without duplicate shortcuts, sync buttons or low-stock pill walls', () => {
    const today = todayDateString();
    const tomorrow = addDaysToDateString(today, 1);
    const onNavigate = vi.fn();

    const stockLots: StockLot[] = [
      {
        id: 'lot-eggs',
        catalogItemId: 'cat-eggs',
        productLabel: 'Ovos Caseiros',
        locationId: 'loc-fridge',
        quantity: 6,
        unit: 'un',
        qualitativeLevel: null,
        expiresAt: tomorrow,
        frozenOrCookedAt: null,
        isLeftover: false,
        sourceRecipeId: null,
        notes: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        lastModifiedBy: 'dev-1',
      },
    ];

    const recipes: Recipe[] = [
      makeRecipe('r1', 'Omelete Simples', 'cat-eggs'),
      makeRecipe('r2', 'Ovos Mexidos', 'cat-eggs'),
      makeRecipe('r3', 'Tortilha', 'cat-eggs'),
      makeRecipe('r4', 'Pudim de Ovos', 'cat-eggs'),
    ];

    const mealPlan: MealPlanEntry[] = [
      {
        id: 'mp-1',
        date: today,
        slot: 'dinner',
        recipeId: null,
        plannedServings: 2,
        customLabel: 'Sopa Caseira',
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        lastModifiedBy: 'dev-1',
      },
    ];

    render(
      <TodayView
        settings={SETTINGS}
        locations={LOCATIONS}
        catalogItems={CATALOG}
        stockLots={stockLots}
        recipes={recipes}
        mealPlan={mealPlan}
        members={MEMBERS}
        onNavigate={onNavigate}
      />,
    );

    expect(screen.getByText('Hoje em Casa')).toBeInTheDocument();
    expect(screen.getByText('Validades a verificar (1)')).toBeInTheDocument();
    expect(screen.getByText('Ovos Caseiros')).toBeInTheDocument();
    expect(screen.getByText('Ementa de Hoje')).toBeInTheDocument();
    expect(screen.getByText('Sopa Caseira')).toBeInTheDocument();
    expect(screen.getByText('O que cozinhar agora')).toBeInTheDocument();

    // No duplicate Drive sync, duplicate bottom-bar shortcuts, or low-stock alert wall
    expect(screen.queryByText(/Sincronizar Drive/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Modo Local/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerir Stock/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nova Receita/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Alertas Prioritários/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leite' })).not.toBeInTheDocument();

    // Caps cookable recipe suggestions to max 3
    expect(screen.getByText('Omelete Simples')).toBeInTheDocument();
    expect(screen.getByText('Ovos Mexidos')).toBeInTheDocument();
    expect(screen.getByText('Tortilha')).toBeInTheDocument();
    expect(screen.queryByText('Pudim de Ovos')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver semana' }));
    expect(onNavigate).toHaveBeenCalledWith('planner');
  });
});
