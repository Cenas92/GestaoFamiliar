import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem, StorageLocation } from '../../types/domain';
import { CatalogManagerModal } from './CatalogManagerModal';
import { StockLotModal } from './StockLotModal';

const LOCATIONS: StorageLocation[] = [
  {
    id: 'loc-fridge',
    name: 'Frigorífico',
    locationType: 'fridge',
    colorToken: 'cyan',
    icon: 'snowflake',
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
  {
    id: 'loc-freezer',
    name: 'Congelador',
    locationType: 'freezer',
    colorToken: 'blue',
    icon: 'snowflake',
    sortOrder: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
];

const CATALOG: CatalogItem[] = [
  {
    id: 'cat-1',
    name: 'Abóbora',
    aliases: [],
    category: 'food',
    trackingMode: 'exact',
    defaultUnit: 'un',
    defaultLocationId: 'loc-fridge',
    minStockQty: null,
    supermarketSection: 'produce',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
  {
    id: 'cat-2',
    name: 'Tomate',
    aliases: [],
    category: 'food',
    trackingMode: 'exact',
    defaultUnit: 'kg',
    defaultLocationId: 'loc-fridge',
    minStockQty: null,
    supermarketSection: 'produce',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-1',
  },
];

describe('StockLotModal leftover date visibility', () => {
  it('hides Data de preparação / sobras until Marcar como sobra is checked', () => {
    render(
      <StockLotModal
        open={true}
        onClose={vi.fn()}
        editingLot={null}
        catalogItems={CATALOG}
        locations={LOCATIONS}
        deviceId="dev-1"
        initialLocationId="loc-fridge"
      />,
    );

    expect(screen.queryByLabelText('Data de preparação / sobras')).not.toBeInTheDocument();

    const leftoverCheckbox = screen.getByRole('checkbox', {
      name: /Marcar como sobra \/ refeição caseira/i,
    });
    fireEvent.click(leftoverCheckbox);

    const prepDateInput = screen.getByLabelText('Data de preparação / sobras') as HTMLInputElement;
    expect(prepDateInput).toBeInTheDocument();
    expect(prepDateInput.value).not.toBe('');

    // Unchecking clears and hides it again for non-freezer locations
    fireEvent.click(leftoverCheckbox);
    expect(screen.queryByLabelText('Data de preparação / sobras')).not.toBeInTheDocument();
  });

  it('shows Data em que foi congelado when freezer location is selected', () => {
    render(
      <StockLotModal
        open={true}
        onClose={vi.fn()}
        editingLot={null}
        catalogItems={CATALOG}
        locations={LOCATIONS}
        deviceId="dev-1"
        initialLocationId="loc-fridge"
      />,
    );

    const locationSelect = screen.getByDisplayValue('Frigorífico');
    fireEvent.change(locationSelect, { target: { value: 'loc-freezer' } });

    expect(screen.getByLabelText('Data em que foi congelado')).toBeInTheDocument();
    expect(screen.queryByLabelText('Data de preparação / sobras')).not.toBeInTheDocument();
  });

  it('clears catalog search with Limpar pesquisa button, refocuses input and updates selection', () => {
    render(
      <StockLotModal
        open={true}
        onClose={vi.fn()}
        editingLot={null}
        catalogItems={CATALOG}
        locations={LOCATIONS}
        deviceId="dev-1"
        initialLocationId="loc-fridge"
      />,
    );

    const pickerInput = screen.getByPlaceholderText(
      'Procurar ingrediente ou produto...',
    ) as HTMLInputElement;
    expect(screen.queryByRole('button', { name: 'Limpar pesquisa' })).not.toBeInTheDocument();

    fireEvent.focus(pickerInput);
    fireEvent.click(screen.getByRole('button', { name: /Abóbora/i }));
    expect(pickerInput.value).toBe('Abóbora');

    const clearBtn = screen.getByRole('button', { name: 'Limpar pesquisa' });
    fireEvent.click(clearBtn);

    expect(pickerInput.value).toBe('');
    expect(document.activeElement).toBe(pickerInput);
    expect(screen.queryByRole('button', { name: 'Limpar pesquisa' })).not.toBeInTheDocument();

    // Selecting another item updates default label when user did not customize it
    fireEvent.change(pickerInput, { target: { value: 'Tom' } });
    fireEvent.click(screen.getByRole('button', { name: /Tomate/i }));
    expect(pickerInput.value).toBe('Tomate');
    expect(screen.getAllByDisplayValue('Tomate')).toHaveLength(2);
  });

  it('clears search inside CatalogManagerModal with Limpar pesquisa button', () => {
    render(
      <CatalogManagerModal
        open={true}
        onClose={vi.fn()}
        catalogItems={CATALOG}
        locations={LOCATIONS}
        deviceId="dev-1"
      />,
    );

    const catalogSearch = screen.getByPlaceholderText(
      'Pesquisar no catálogo...',
    ) as HTMLInputElement;
    fireEvent.change(catalogSearch, { target: { value: 'Tomate' } });
    expect(screen.queryByText('Abóbora')).not.toBeInTheDocument();
    expect(screen.getByText('Tomate')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar pesquisa' }));
    expect(catalogSearch.value).toBe('');
    expect(document.activeElement).toBe(catalogSearch);
    expect(screen.getByText('Abóbora')).toBeInTheDocument();
  });
});
