import { describe, expect, it } from 'vitest';
import type { FamilySyncSnapshot } from './mergeEngine';
import { mergeFamilySnapshots } from './mergeEngine';

function makeBaseSnapshot(overrides: Partial<FamilySyncSnapshot> = {}): FamilySyncSnapshot {
  return {
    schemaVersion: 1,
    exportedAt: '2026-11-15T10:00:00.000Z',
    exportedByDevice: 'dev-a',
    locations: [],
    supermarketSections: [],
    catalogItems: [],
    stockLots: [],
    recipes: [],
    mealPlan: [],
    shoppingItems: [],
    members: [],
    attachmentManifest: [],
    ...overrides,
  };
}

describe('mergeFamilySnapshots supermarketSections sync', () => {
  it('merges supermarketSections via LWW and handles legacy snapshots without supermarketSections', () => {
    const local = makeBaseSnapshot({
      exportedByDevice: 'dev-a',
      supermarketSections: [
        {
          id: 'pantry',
          name: 'Mercearia Bio',
          colorToken: 'emerald',
          icon: 'wheat',
          sortOrder: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-11-15T12:00:00.000Z',
          deletedAt: null,
          lastModifiedBy: 'dev-a',
        },
        {
          id: 'produce',
          name: 'Fruta e Legumes',
          colorToken: 'emerald',
          icon: 'apple',
          sortOrder: 2,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          deletedAt: null,
          lastModifiedBy: 'dev-a',
        },
      ],
    });

    const remote = makeBaseSnapshot({
      exportedByDevice: 'dev-b',
      supermarketSections: [
        {
          id: 'produce',
          name: 'Fruta Fresca',
          colorToken: 'green',
          icon: 'carrot',
          sortOrder: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-11-15T14:00:00.000Z',
          deletedAt: null,
          lastModifiedBy: 'dev-b',
        },
        {
          id: 'wine',
          name: 'Garrafeira',
          colorToken: 'violet',
          icon: 'coffee',
          sortOrder: 3,
          createdAt: '2026-11-15T14:00:00.000Z',
          updatedAt: '2026-11-15T14:00:00.000Z',
          deletedAt: null,
          lastModifiedBy: 'dev-b',
        },
      ],
    });

    const outcome = mergeFamilySnapshots(local, remote, [], 'dev-a');
    expect(outcome.mergedSnapshot.supermarketSections).toHaveLength(3);
    expect(outcome.mergedSnapshot.supermarketSections?.find((s) => s.id === 'pantry')?.name).toBe(
      'Mercearia Bio',
    );
    expect(outcome.mergedSnapshot.supermarketSections?.find((s) => s.id === 'produce')?.name).toBe(
      'Fruta Fresca',
    );
    expect(outcome.mergedSnapshot.supermarketSections?.find((s) => s.id === 'wine')?.name).toBe(
      'Garrafeira',
    );

    // Legacy snapshot missing supermarketSections entirely should not fail
    const legacyRemote = makeBaseSnapshot();
    delete legacyRemote.supermarketSections;
    const legacyMerge = mergeFamilySnapshots(local, legacyRemote, [], 'dev-a');
    expect(legacyMerge.mergedSnapshot.supermarketSections).toHaveLength(2);
  });
});
