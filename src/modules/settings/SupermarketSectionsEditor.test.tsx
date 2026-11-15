import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildStarterLocations, buildStarterSupermarketSections } from '../../data/starterCatalog';
import { db } from '../../db/database';
import type {
  AppSettings,
  CatalogItem,
  ShoppingItem,
  SupermarketSectionConfig,
} from '../../types/domain';
import { SettingsView } from './SettingsView';

const SETTINGS: AppSettings = {
  id: 'singleton',
  expiryWarningDays: 5,
  deviceId: 'dev-test',
  googleClientId: '',
  googleDriveFolderId: null,
  googleDriveFolderName: null,
  lastSyncAt: null,
  lastSyncStatus: 'idle',
  lastSyncError: null,
  initialized: true,
};

describe('SettingsView Corredores do Supermercado customization', () => {
  let sections: SupermarketSectionConfig[];
  const locations = buildStarterLocations('dev-test');

  beforeEach(async () => {
    await db.supermarketSections.clear();
    await db.catalogItems.clear();
    await db.shoppingItems.clear();
    sections = buildStarterSupermarketSections('dev-test');
    await db.supermarketSections.bulkPut(sections);
  });

  afterEach(() => {
    cleanup();
  });

  it('creates a custom aisle and edits name, color and icon in Dexie', async () => {
    render(
      <SettingsView
        settings={SETTINGS}
        members={[]}
        locations={locations}
        supermarketSections={sections}
        onSyncNow={async () => 'ok'}
      />,
    );

    fireEvent.click(screen.getByText('Corredores do Supermercado'));

    // Create a custom aisle
    fireEvent.change(screen.getByLabelText('Nome do novo corredor'), {
      target: { value: 'Garrafeira' },
    });
    fireEvent.click(screen.getAllByTitle('Azul').at(-1)!);
    fireEvent.click(screen.getAllByTitle('Café/Chá').at(-1)!);
    fireEvent.click(screen.getByText('Adicionar corredor'));

    await screen.findByText(/Corredor "Garrafeira" adicionado\./i);

    const allAfterCreate = await db.supermarketSections.toArray();
    const created = allAfterCreate.find((s) => s.name === 'Garrafeira' && !s.deletedAt);
    expect(created).toBeDefined();
    expect(created?.colorToken).toBe('blue');
    expect(created?.icon).toBe('coffee');
    expect(created?.sortOrder).toBe(13);

    // Edit 'Fruta e Legumes' -> rename and change color/icon
    fireEvent.click(screen.getAllByTitle('Editar corredor')[0]);
    fireEvent.change(screen.getByLabelText('Nome do corredor'), {
      target: { value: 'Hortícolas e Fruta' },
    });
    fireEvent.click(screen.getAllByTitle('Violeta')[0]);
    fireEvent.click(screen.getAllByTitle('Legumes')[0]);
    fireEvent.click(screen.getByText('Guardar alterações'));

    await screen.findByText(/Corredor "Hortícolas e Fruta" atualizado\./i);

    const produce = await db.supermarketSections.get('produce');
    expect(produce?.name).toBe('Hortícolas e Fruta');
    expect(produce?.colorToken).toBe('violet');
    expect(produce?.icon).toBe('carrot');
  });

  it('reorders supermarket sections via move up button', async () => {
    render(
      <SettingsView
        settings={SETTINGS}
        members={[]}
        locations={locations}
        supermarketSections={sections}
        onSyncNow={async () => 'ok'}
      />,
    );

    fireEvent.click(screen.getByText('Corredores do Supermercado'));
    const moveUpButtons = screen.getAllByTitle('Mover para cima');
    fireEvent.click(moveUpButtons[1]); // Padaria e Pastelaria -> 1st position

    await waitFor(async () => {
      const bakery = await db.supermarketSections.get('bakery');
      const produce = await db.supermarketSections.get('produce');
      expect(bakery?.sortOrder).toBe(1);
      expect(produce?.sortOrder).toBe(2);
    });
  });

  it('safely reassigns catalogItems and shoppingItems when deleting a supermarket section', async () => {
    const catalogItem: CatalogItem = {
      id: 'cat-bread',
      name: 'Pão de forma',
      aliases: [],
      category: 'food',
      trackingMode: 'exact',
      defaultUnit: 'un',
      defaultLocationId: locations[0].id,
      minStockQty: null,
      supermarketSection: 'bakery',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
      lastModifiedBy: 'dev-test',
    };
    const shoppingItem: ShoppingItem = {
      id: 'shop-bread',
      catalogItemId: 'cat-bread',
      label: 'Pão de forma',
      quantity: 1,
      unit: 'un',
      section: 'bakery',
      checked: false,
      targetLocationId: locations[0].id,
      source: 'manual',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
      lastModifiedBy: 'dev-test',
    };

    await db.catalogItems.put(catalogItem);
    await db.shoppingItems.put(shoppingItem);

    render(
      <SettingsView
        settings={SETTINGS}
        members={[]}
        locations={locations}
        supermarketSections={sections}
        catalogItems={[catalogItem]}
        shoppingItems={[shoppingItem]}
        onSyncNow={async () => 'ok'}
      />,
    );

    fireEvent.click(screen.getByText('Corredores do Supermercado'));
    fireEvent.click(screen.getAllByTitle('Remover corredor')[1]); // bakery is index 1

    expect(
      screen.getByText(/1 produto\(s\) no catálogo e 1 item\(ns\) nas compras/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Mover tudo para:'), {
      target: { value: 'pantry' },
    });
    fireEvent.click(screen.getByText('Confirmar remoção'));

    await screen.findByText(/Corredor "Padaria e Pastelaria" removido/i);

    const deletedSection = await db.supermarketSections.get('bakery');
    const movedCatalog = await db.catalogItems.get('cat-bread');
    const movedShopping = await db.shoppingItems.get('shop-bread');
    expect(deletedSection?.deletedAt).not.toBeNull();
    expect(movedCatalog?.supermarketSection).toBe('pantry');
    expect(movedShopping?.section).toBe('pantry');
  });
});
