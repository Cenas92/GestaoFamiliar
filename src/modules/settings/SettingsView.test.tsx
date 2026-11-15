import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, ensureDatabaseSeeded } from '../../db/database';
import type { HouseholdMember } from '../../types/domain';
import { SettingsView } from './SettingsView';

function makeMember(overrides?: Partial<HouseholdMember>): HouseholdMember {
  return {
    id: 'mem-1',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    deletedAt: null,
    lastModifiedBy: 'dev-test',
    name: 'André',
    role: 'adult',
    dietaryNotes: 'Sem coentros',
    allergies: ['Lactose'],
    defaultServingsWeight: 1,
    avatarColor: '#0f766e',
    ...overrides,
  };
}

describe('SettingsView household member editing', () => {
  beforeEach(async () => {
    await db.members.clear();
    await db.settings.clear();
  });

  it('allows editing an existing household member inline and persists updates', async () => {
    const settings = await ensureDatabaseSeeded();
    const initialMember = makeMember();
    await db.members.put(initialMember);

    render(
      <SettingsView
        settings={settings}
        members={[initialMember]}
        locations={[]}
        onSyncNow={vi.fn(async () => 'ok')}
      />,
    );

    expect(screen.getByText('André')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editar André' }));

    const editForm = screen.getByRole('button', { name: 'Guardar alterações' }).closest('form');
    expect(editForm).not.toBeNull();

    const scope = within(editForm!);
    fireEvent.change(scope.getByLabelText('Nome do membro'), {
      target: { value: 'André Silva' },
    });
    fireEvent.change(scope.getByLabelText('Papel no agregado'), {
      target: { value: 'child' },
    });
    fireEvent.change(scope.getByLabelText('Preferências ou notas'), {
      target: { value: 'Gosta de massa' },
    });
    // Toggle off Lactose and toggle on Glúten
    fireEvent.click(scope.getByRole('button', { name: 'Lactose' }));
    fireEvent.click(scope.getByRole('button', { name: 'Glúten' }));

    fireEvent.click(scope.getByRole('button', { name: 'Guardar alterações' }));

    await waitFor(async () => {
      const saved = await db.members.get('mem-1');
      expect(saved).toBeDefined();
      expect(saved?.name).toBe('André Silva');
      expect(saved?.role).toBe('child');
      expect(saved?.defaultServingsWeight).toBe(0.5);
      expect(saved?.dietaryNotes).toBe('Gosta de massa');
      expect(saved?.allergies).toEqual(['Glúten']);
      expect(saved?.updatedAt).not.toBe(initialMember.updatedAt);
      expect(saved?.lastModifiedBy).toBe(settings.deviceId);
    });
  });

  it('clears allergies and sets weight to 0 when changing a member to pet', async () => {
    const settings = await ensureDatabaseSeeded();
    const initialMember = makeMember();
    await db.members.put(initialMember);

    render(
      <SettingsView
        settings={settings}
        members={[initialMember]}
        locations={[]}
        onSyncNow={vi.fn(async () => 'ok')}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editar André' }));

    const editForm = screen.getByRole('button', { name: 'Guardar alterações' }).closest('form')!;
    const scope = within(editForm);

    fireEvent.change(scope.getByLabelText('Papel no agregado'), {
      target: { value: 'pet' },
    });
    fireEvent.change(scope.getByLabelText('Nome do membro'), {
      target: { value: 'Max' },
    });

    fireEvent.click(scope.getByRole('button', { name: 'Guardar alterações' }));

    await waitFor(async () => {
      const saved = await db.members.get('mem-1');
      expect(saved?.name).toBe('Max');
      expect(saved?.role).toBe('pet');
      expect(saved?.defaultServingsWeight).toBe(0);
      expect(saved?.allergies).toEqual([]);
    });
  });

  it('collapses previous section and expands the clicked accordion section', async () => {
    const settings = await ensureDatabaseSeeded();
    const initialMember = makeMember();

    render(
      <SettingsView
        settings={settings}
        members={[initialMember]}
        locations={[]}
        onSyncNow={vi.fn(async () => 'ok')}
      />,
    );

    const membersToggle = screen.getByRole('button', { name: /Agregado Familiar/i });
    const aboutToggle = screen.getByRole('button', { name: /Acerca/i });

    expect(membersToggle).toHaveAttribute('aria-expanded', 'true');
    expect(aboutToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('AI-Cenas92')).not.toBeInTheDocument();

    fireEvent.click(aboutToggle);

    expect(membersToggle).toHaveAttribute('aria-expanded', 'false');
    expect(aboutToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('AI-Cenas92')).toBeInTheDocument();

    // Clicking the expanded section collapses all sections
    fireEvent.click(aboutToggle);
    expect(aboutToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('AI-Cenas92')).not.toBeInTheDocument();

    // Catalog section opens CatalogManagerModal
    fireEvent.click(screen.getByRole('button', { name: /Catálogo de Produtos Base/i }));
    fireEvent.click(screen.getByRole('button', { name: /Gerir catálogo de produtos/i }));
    expect(screen.getByRole('dialog', { name: /Catálogo/i })).toBeInTheDocument();
  });
});
