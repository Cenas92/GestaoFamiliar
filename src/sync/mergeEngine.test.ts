import { describe, expect, it } from 'vitest';
import type { ShoppingItem } from '../types/domain';
import { mergeSyncCollections } from './mergeEngine';

describe('mergeEngine', () => {
  const baseItem = (id: string, label: string, updatedAt: string, deletedAt: string | null = null): ShoppingItem => ({
    id,
    catalogItemId: null,
    label,
    quantity: 1,
    unit: 'un',
    section: 'pantry',
    checked: false,
    targetLocationId: null,
    source: 'manual',
    notes: '',
    createdAt: '2026-11-15T10:00:00.000Z',
    updatedAt,
    deletedAt,
    lastModifiedBy: 'dev-a',
  });

  it('merges distinct offline edits without losing either item', () => {
    const local = [baseItem('1', 'Leite', '2026-11-15T10:05:00.000Z')];
    const remote = [baseItem('2', 'Ovos', '2026-11-15T10:06:00.000Z')];

    const result = mergeSyncCollections(local, remote);
    expect(result.merged).toHaveLength(2);
    expect(result.addedFromRemote).toBe(1);
    expect(result.newerOnLocal).toBe(1);
  });

  it('resolves same-item conflict with LWW timestamp and preserves newer tombstone delete', () => {
    const localEdited = baseItem('1', 'Leite Meio-Gordo', '2026-11-15T10:05:00.000Z');
    const remoteDeleted = baseItem(
      '1',
      'Leite',
      '2026-11-15T10:10:00.000Z',
      '2026-11-15T10:10:00.000Z',
    );

    const result = mergeSyncCollections([localEdited], [remoteDeleted]);
    expect(result.merged).toHaveLength(1);
    expect(result.merged[0].deletedAt).toBe('2026-11-15T10:10:00.000Z');
    expect(result.updatedFromRemote).toBe(1);
  });
});
