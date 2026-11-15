import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/database';
import type { CatalogItem, Recipe, StockLot, StorageLocation } from '../../types/domain';
import { StockView } from './StockView';
import { STOCK_PREFS_STORAGE_KEY } from './stockVisuals';

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
  {
    id: 'loc-pantry',
    name: 'Despensa',
    locationType: 'pantry',
    colorToken: 'amber',
    icon: 'package',
    sortOrder: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
];

const CATALOG_ITEMS: CatalogItem[] = [
  {
    id: 'cat-milk',
    name: 'Leite Meio-Gordo',
    aliases: [],
    category: 'beverages',
    trackingMode: 'exact',
    defaultUnit: 'L',
    defaultLocationId: 'loc-fridge',
    minStockQty: 2,
    supermarketSection: 'dairy',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
  {
    id: 'cat-rice',
    name: 'Arroz Carolino',
    aliases: [],
    category: 'food',
    trackingMode: 'exact',
    defaultUnit: 'kg',
    defaultLocationId: 'loc-pantry',
    minStockQty: null,
    supermarketSection: 'pantry',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
];

const RECIPES: Recipe[] = [
  {
    id: 'rec-duck',
    title: 'Arroz de Pato',
    prepMinutes: 20,
    cookMinutes: 40,
    baseServings: 4,
    category: 'meat',
    tags: [],
    containsAllergens: [],
    favoriteMemberIds: [],
    kidFriendly: true,
    notes: '',
    photoAttachmentId: null,
    docAttachmentId: null,
    timesCooked: 1,
    lastCookedAt: '2026-11-10',
    ingredients: [],
    steps: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
];

const STOCK_LOTS: StockLot[] = [
  {
    id: 'lot-milk',
    catalogItemId: 'cat-milk',
    productLabel: 'Leite Mimosa 1L',
    locationId: 'loc-fridge',
    quantity: 3,
    unit: 'L',
    qualitativeLevel: null,
    expiresAt: '2099-12-31',
    frozenOrCookedAt: null,
    isLeftover: false,
    sourceRecipeId: null,
    notes: 'Sem lactose para pequeno almoço',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-14T10:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
  {
    id: 'lot-leftover',
    catalogItemId: 'cat-rice',
    productLabel: 'Tupperware Arroz de Pato',
    locationId: 'loc-fridge',
    quantity: 2,
    unit: 'un',
    qualitativeLevel: null,
    expiresAt: null,
    frozenOrCookedAt: '2026-11-14',
    isLeftover: true,
    sourceRecipeId: 'rec-duck',
    notes: 'Pronto a aquecer',
    createdAt: '2026-11-14T12:00:00.000Z',
    updatedAt: '2026-11-14T12:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
  {
    id: 'lot-rice',
    catalogItemId: 'cat-rice',
    productLabel: 'Arroz Cigala',
    locationId: 'loc-pantry',
    quantity: 1,
    unit: 'kg',
    qualitativeLevel: null,
    expiresAt: null,
    frozenOrCookedAt: null,
    isLeftover: false,
    sourceRecipeId: null,
    notes: '',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
];

describe('StockView view modes, symbols, sorting and grouping', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('defaults to Lista compacta em linha, switches to Cartões detalhados and persists view mode in localStorage', () => {
    render(
      <StockView
        locations={LOCATIONS}
        catalogItems={CATALOG_ITEMS}
        stockLots={STOCK_LOTS}
        shoppingItems={[]}
        recipes={RECIPES}
        expiryWarningDays={5}
        deviceId="dev-1"
      />,
    );

    expect(screen.getByText('Todos (3)')).toBeInTheDocument();
    expect(screen.queryByText('Stock da Casa')).not.toBeInTheDocument();
    expect(screen.queryByText(/abaixo do mín\./i)).not.toBeInTheDocument();

    const lineBtn = screen.getByRole('button', { name: 'Lista compacta em linha' });
    const detailedBtn = screen.getByRole('button', { name: 'Cartões detalhados' });
    expect(lineBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Genérico: Leite Meio-Gordo')).not.toBeInTheDocument();
    expect(screen.queryByText('Receita: Arroz de Pato')).not.toBeInTheDocument();

    fireEvent.click(detailedBtn);

    expect(detailedBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Genérico: Leite Meio-Gordo')).toBeInTheDocument();
    expect(screen.getByText('Receita: Arroz de Pato')).toBeInTheDocument();
    expect(screen.getByText('Mín. catálogo: 2 L')).toBeInTheDocument();
    expect(
      screen.getByText(/Atualizado em 14\/11\/2026 · Criado em 01\/11\/2026/),
    ).toBeInTheDocument();

    const stored = JSON.parse(window.localStorage.getItem(STOCK_PREFS_STORAGE_KEY) || '{}');
    expect(stored.viewMode).toBe('detailed');

    cleanup();
    render(
      <StockView
        locations={LOCATIONS}
        catalogItems={CATALOG_ITEMS}
        stockLots={STOCK_LOTS}
        shoppingItems={[]}
        recipes={RECIPES}
        expiryWarningDays={5}
        deviceId="dev-1"
      />,
    );

    expect(screen.getByRole('button', { name: 'Cartões detalhados' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('renders Grelha em quadrados with generic typology icons and opens StockQuickModal on tile click', async () => {
    const putSpy = vi.spyOn(db.stockLots, 'put').mockResolvedValue('lot-milk');

    render(
      <StockView
        locations={LOCATIONS}
        catalogItems={CATALOG_ITEMS}
        stockLots={STOCK_LOTS}
        shoppingItems={[]}
        recipes={RECIPES}
        expiryWarningDays={5}
        deviceId="dev-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Grelha em quadrados' }));

    expect(screen.getByLabelText('Lacticínios e Ovos')).toBeInTheDocument();
    expect(screen.getByLabelText('Sobra / Refeição caseira')).toBeInTheDocument();
    expect(screen.getByLabelText('Mercearia')).toBeInTheDocument();

    const milkTile = screen.getByRole('button', { name: /Leite Mimosa 1L, 3 L, Frigorífico/ });
    fireEvent.click(milkTile);

    const dialog = screen.getByRole('dialog', { name: 'Leite Mimosa 1L' });
    expect(within(dialog).getByText('Sem lactose para pequeno almoço')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Aumentar Leite Mimosa 1L' }));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'lot-milk',
          quantity: 3.5,
        }),
      );
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('dialog', { name: 'Editar item em stock' })).toBeInTheDocument();
  });

  it('supports compact line view inline adjustment and collapsible location grouping', async () => {
    const putSpy = vi.spyOn(db.stockLots, 'put').mockResolvedValue('lot-rice');

    render(
      <StockView
        locations={LOCATIONS}
        catalogItems={CATALOG_ITEMS}
        stockLots={STOCK_LOTS}
        shoppingItems={[]}
        recipes={RECIPES}
        expiryWarningDays={5}
        deviceId="dev-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lista compacta em linha' }));

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar Arroz Cigala' }));
    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'lot-rice',
          quantity: 1.5,
        }),
      );
    });

    const groupBtn = screen.getByRole('button', { name: /Agrupar/i });
    fireEvent.click(groupBtn);
    expect(groupBtn).toHaveAttribute('aria-pressed', 'true');

    const pantryHeader = screen
      .getAllByRole('button', { name: /Despensa/i })
      .find((btn) => btn.hasAttribute('aria-expanded'));
    expect(pantryHeader).toBeDefined();
    expect(pantryHeader).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Arroz Cigala')).toBeInTheDocument();

    fireEvent.click(pantryHeader!);
    expect(pantryHeader).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Arroz Cigala')).not.toBeInTheDocument();
    expect(screen.getByText('Leite Mimosa 1L')).toBeInTheDocument();
  });

  it('hides empty locations and collapses filters on mobile with active filter quick-clear chips', () => {
    const emptyFreezer: StorageLocation = {
      id: 'loc-freezer-empty',
      name: 'Congelador',
      locationType: 'freezer',
      colorToken: 'blue',
      icon: 'snowflake',
      sortOrder: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
      lastModifiedBy: 'dev-1',
    };

    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 375,
    });

    try {
      render(
        <StockView
          locations={[...LOCATIONS, emptyFreezer]}
          catalogItems={CATALOG_ITEMS}
          stockLots={STOCK_LOTS}
          shoppingItems={[]}
          recipes={RECIPES}
          expiryWarningDays={5}
          deviceId="dev-1"
        />,
      );

      // Empty location (0 items) should be hidden from the strip
      expect(screen.queryByRole('button', { name: /Congelador/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Frigorífico \(2\)/i })).toBeInTheDocument();

      // Filters and view controls start collapsed on mobile (< 640px)
      const filtersBtn = screen.getByRole('button', { name: /Filtros e vista/i });
      expect(filtersBtn).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByLabelText('Filtrar por categoria')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Lista compacta em linha' })).not.toBeInTheDocument();

      // Overflow menu exposes Catálogo without cluttering main header
      fireEvent.click(screen.getByRole('button', { name: 'Mais opções do stock' }));
      fireEvent.click(screen.getByRole('button', { name: /Catálogo de produtos/i }));
      expect(screen.getByRole('dialog', { name: /Catálogo/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

      // Expand filters, select a category, then collapse and clear via chip
      fireEvent.click(filtersBtn);
      expect(filtersBtn).toHaveAttribute('aria-expanded', 'true');
      fireEvent.change(screen.getByLabelText('Filtrar por categoria'), {
        target: { value: 'beverages' },
      });
      fireEvent.click(filtersBtn);

      expect(filtersBtn).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByText('Leite Mimosa 1L')).toBeInTheDocument();
      expect(screen.queryByText('Arroz Cigala')).not.toBeInTheDocument();

      const clearChip = screen.getByRole('button', { name: 'Remover filtro Bebidas' });
      fireEvent.click(clearChip);

      expect(screen.getByText('Arroz Cigala')).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: originalWidth,
      });
    }
  });
});
