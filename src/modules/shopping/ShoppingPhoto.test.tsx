import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/database';
import type { ShoppingItem, StorageLocation } from '../../types/domain';
import * as imageCompression from '../../utils/imageCompression';
import { ShoppingView } from './ShoppingView';

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

function LiveShoppingHarness() {
  const items = useLiveQuery(
    async () => (await db.shoppingItems.toArray()).filter((i) => !i.deletedAt),
    [],
    [] as ShoppingItem[],
  );

  return (
    <ShoppingView
      shoppingItems={items}
      catalogItems={[]}
      stockLots={[]}
      locations={LOCATIONS}
      expiryWarningDays={5}
      deviceId="dev-1"
    />
  );
}

describe('ShoppingView direct camera capture, discreet indicators and attachment sync cleanup', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await db.shoppingItems.clear();
    await db.attachments.clear();

    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    }

    vi.spyOn(imageCompression, 'prepareAttachmentBlob').mockImplementation(async (file) => ({
      blob: file,
      mimeType: file.type || 'image/webp',
      fileName: file.name,
    }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('captures photo directly from top Câmara button, opens modal, keeps list indicator discreet and deletes attachment cleanly', async () => {
    render(<LiveShoppingHarness />);

    const quickCameraInput = screen.getByLabelText('Foto rápida para compras') as HTMLInputElement;
    expect(quickCameraInput).toHaveAttribute('accept', 'image/*');
    expect(quickCameraInput).toHaveAttribute('capture', 'environment');

    const file = new File(['mock-bytes'], 'detergente.jpg', { type: 'image/jpeg' });
    fireEvent.change(quickCameraInput, { target: { files: [file] } });

    // Item + attachment persisted and quick edit modal opens immediately with photo controls
    await screen.findByText('Foto do produto');
    const storedItems = await db.shoppingItems.toArray();
    expect(storedItems).toHaveLength(1);
    const createdItem = storedItems[0];
    expect(createdItem.label).toBe('Artigo com foto');
    expect(createdItem.photoAttachmentId).toBeTruthy();

    const attachment = await db.attachments.get(createdItem.photoAttachmentId!);
    expect(attachment).toBeDefined();
    expect(attachment?.deletedAt).toBeNull();

    // Modal shows photo (with zoom toggle) plus Câmara and Galeria options
    const modal = screen.getByRole('dialog');
    await within(modal).findByAltText('Artigo com foto');
    const modalCameraInput = within(modal).getByLabelText('Tirar nova foto com câmara');
    expect(modalCameraInput).toHaveAttribute('capture', 'environment');
    const galleryInput = within(modal).getByLabelText('Escolher foto da galeria');
    expect(galleryInput).toHaveAttribute('accept', 'image/*');
    expect(galleryInput).not.toHaveAttribute('capture');

    // Toggle enlarge inside modal
    fireEvent.click(within(modal).getByRole('button', { name: 'Ampliar foto do produto' }));
    expect(
      within(modal).getByRole('button', { name: 'Reduzir foto do produto' }),
    ).toBeInTheDocument();

    // Close modal -> list shows discreet camera button, NOT the photo thumbnail inline
    fireEvent.click(within(modal).getByRole('button', { name: 'Fechar' }));
    expect(document.querySelector('img')).not.toBeInTheDocument();

    const indicatorBtn = screen.getByRole('button', { name: 'Ver foto de Artigo com foto' });
    expect(indicatorBtn).toBeInTheDocument();

    // Tapping discreet indicator reopens modal with photo visible
    fireEvent.click(indicatorBtn);
    await screen.findByText('Foto do produto');

    // Removing the item tombstones both the shopping item and its attachment
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remover' }));

    await waitFor(async () => {
      const deletedItem = await db.shoppingItems.get(createdItem.id);
      const deletedAttachment = await db.attachments.get(createdItem.photoAttachmentId!);
      expect(deletedItem?.deletedAt).not.toBeNull();
      expect(deletedAttachment?.deletedAt).not.toBeNull();
    });
  });

  it('supports attaching a photo via Câmara or Galeria inside the quick-add form', async () => {
    render(<LiveShoppingHarness />);

    const addBtn = screen.getByRole('button', { name: 'Adicionar' });
    if (addBtn.getAttribute('aria-expanded') === 'false') {
      fireEvent.click(addBtn);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Escrever texto livre' }));
    fireEvent.change(screen.getByPlaceholderText('Ex: Pilhas AA, Guardanapos...'), {
      target: { value: 'Champô bebé' },
    });

    const addFormCamera = screen.getByLabelText('Tirar foto com câmara');
    expect(addFormCamera).toHaveAttribute('capture', 'environment');

    const file = new File(['img'], 'champo.jpg', { type: 'image/jpeg' });
    fireEvent.change(addFormCamera, { target: { files: [file] } });

    await screen.findByRole('button', { name: 'Remover foto' });
    fireEvent.click(screen.getByRole('button', { name: /Guardar na lista/i }));

    await waitFor(async () => {
      const items = await db.shoppingItems.toArray();
      expect(items).toHaveLength(1);
      expect(items[0].label).toBe('Champô bebé');
      expect(items[0].photoAttachmentId).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: 'Ver foto de Champô bebé' })).toBeInTheDocument();
  });
});
