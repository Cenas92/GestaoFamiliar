import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/database';
import type { CatalogItem, ShoppingItem, StorageLocation } from '../../types/domain';
import { ShoppingView } from './ShoppingView';
import { SHOPPING_PREFS_STORAGE_KEY } from './shoppingVisuals';

const LOCATIONS: StorageLocation[] = [
  {
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
  },
];

const CATALOG_ITEMS: CatalogItem[] = [
  {
    id: 'cat-apple',
    name: 'Maçã Royal Gala',
    aliases: [],
    category: 'food',
    trackingMode: 'exact',
    defaultUnit: 'kg',
    defaultLocationId: 'loc-pantry',
    minStockQty: null,
    supermarketSection: 'produce',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
];

const SHOPPING_ITEMS: ShoppingItem[] = [
  {
    id: 'shop-1',
    catalogItemId: 'cat-apple',
    label: 'Maçã Royal Gala',
    quantity: 1.5,
    unit: 'kg',
    section: 'produce',
    checked: false,
    targetLocationId: 'loc-pantry',
    source: 'recipe',
    notes: 'Escolher médias',
    createdAt: '2026-11-10T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
  {
    id: 'shop-2',
    catalogItemId: null,
    label: 'Azeite Virgem',
    quantity: 1,
    unit: 'L',
    section: 'pantry',
    checked: false,
    targetLocationId: 'loc-pantry',
    source: 'manual',
    notes: '',
    createdAt: '2026-11-10T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
];

describe('ShoppingView compact layout, 4 view modes, quick edit modal and collapsible sections', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('switches to Cartões detalhados showing source/location and persists viewMode in localStorage', () => {
    render(
      <ShoppingView
        shoppingItems={SHOPPING_ITEMS}
        catalogItems={CATALOG_ITEMS}
        stockLots={[]}
        locations={LOCATIONS}
        expiryWarningDays={5}
        deviceId="dev-1"
      />,
    );

    const mediumBtn = screen.getByRole('button', { name: 'Cartões padrão' });
    const detailedBtn = screen.getByRole('button', { name: 'Cartões detalhados' });
    expect(mediumBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Origem: Receita')).not.toBeInTheDocument();

    fireEvent.click(detailedBtn);
    expect(detailedBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Origem: Receita')).toBeInTheDocument();
    expect(screen.getAllByText('Arrumar: Despensa').length).toBeGreaterThan(0);

    const stored = JSON.parse(window.localStorage.getItem(SHOPPING_PREFS_STORAGE_KEY) || '{}');
    expect(stored.viewMode).toBe('detailed');

    cleanup();
    render(
      <ShoppingView
        shoppingItems={SHOPPING_ITEMS}
        catalogItems={CATALOG_ITEMS}
        stockLots={[]}
        locations={LOCATIONS}
        expiryWarningDays={5}
        deviceId="dev-1"
      />,
    );
    expect(screen.getByRole('button', { name: 'Cartões detalhados' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('toggles checked in 1 tap on Grelha em quadrados and edits notes via ShoppingQuickModal', async () => {
    const putSpy = vi.spyOn(db.shoppingItems, 'put').mockResolvedValue('shop-1');

    render(
      <ShoppingView
        shoppingItems={SHOPPING_ITEMS}
        catalogItems={CATALOG_ITEMS}
        stockLots={[]}
        locations={LOCATIONS}
        expiryWarningDays={5}
        deviceId="dev-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Grelha em quadrados' }));
    expect(screen.getAllByLabelText('Fruta e Legumes').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Mercearia').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Marcar Maçã Royal Gala, 1.5 kg/ }));
    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'shop-1',
          checked: true,
        }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Opções de Maçã Royal Gala' }));
    const dialog = screen.getByRole('dialog', { name: 'Maçã Royal Gala' });
    fireEvent.change(within(dialog).getByLabelText(/Notas/i), {
      target: { value: 'Saco de 1.5 kg maduras' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'shop-1',
          notes: 'Saco de 1.5 kg maduras',
        }),
      );
    });
  });

  it('collapses quick add and filters on mobile (< 640px), omits empty cart pill and collapses aisle groups', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 375,
    });

    try {
      render(
        <ShoppingView
          shoppingItems={SHOPPING_ITEMS}
          catalogItems={CATALOG_ITEMS}
          stockLots={[]}
          locations={LOCATIONS}
          expiryWarningDays={5}
          deviceId="dev-1"
        />,
      );

      // No checked items -> "No carrinho" pill omitted
      expect(screen.queryByRole('button', { name: /No carrinho/i })).not.toBeInTheDocument();

      // Quick add form starts collapsed on mobile
      const addToggle = screen.getByRole('button', { name: 'Adicionar' });
      expect(addToggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('Adicionar à lista')).not.toBeInTheDocument();

      // Filters start collapsed on mobile
      const filtersBtn = screen.getByRole('button', { name: /Filtros/i });
      expect(filtersBtn).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(filtersBtn);
      fireEvent.change(screen.getByLabelText('Filtrar por secção'), {
        target: { value: 'produce' },
      });
      fireEvent.click(filtersBtn);

      expect(screen.getByText('Maçã Royal Gala')).toBeInTheDocument();
      expect(screen.queryByText('Azeite Virgem')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Remover filtro Fruta e Legumes' }));
      expect(screen.getByText('Azeite Virgem')).toBeInTheDocument();

      // Collapsible supermarket aisle section header
      const pantryHeader = screen
        .getAllByRole('button', { name: /Mercearia/i })
        .find((b) => b.hasAttribute('aria-expanded'));
      expect(pantryHeader).toBeDefined();
      expect(pantryHeader).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(pantryHeader!);
      expect(pantryHeader).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('Azeite Virgem')).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: originalWidth,
      });
    }
  });
});
