import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem, StorageLocation } from '../../types/domain';
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
});
