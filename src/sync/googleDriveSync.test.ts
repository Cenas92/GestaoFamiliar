import { describe, expect, it } from 'vitest';
import { sanitizeGoogleClientId } from './googleDriveSync';
import type { FamilySyncSnapshot } from './mergeEngine';
import { combineRemoteSnapshots, isAutoSyncSuppressed, withSuppressedAutoSync } from './syncService';

function makeEmptySnapshot(deviceId: string): FamilySyncSnapshot {
  return {
    schemaVersion: 1,
    exportedAt: '2026-11-15T16:00:00.000Z',
    exportedByDevice: deviceId,
    locations: [],
    catalogItems: [],
    stockLots: [],
    recipes: [],
    mealPlan: [],
    shoppingItems: [],
    members: [],
    attachmentManifest: [],
  };
}

describe('sanitizeGoogleClientId', () => {
  it('removes accidental https/http prefixes and whitespace', () => {
    expect(
      sanitizeGoogleClientId('  https://593950790669-test.apps.googleusercontent.com \n'),
    ).toBe('593950790669-test.apps.googleusercontent.com');

    expect(
      sanitizeGoogleClientId('http:// 593950790669-test .apps.googleusercontent.com'),
    ).toBe('593950790669-test.apps.googleusercontent.com');
  });
});

describe('withSuppressedAutoSync', () => {
  it('suppresses auto-sync only while the wrapped callback runs', async () => {
    expect(isAutoSyncSuppressed()).toBe(false);
    let insideState = false;

    await withSuppressedAutoSync(async () => {
      insideState = isAutoSyncSuppressed();
    });

    expect(insideState).toBe(true);
    expect(isAutoSyncSuppressed()).toBe(false);
  });
});

describe('combineRemoteSnapshots', () => {
  it('merges duplicate family_state.json snapshots without losing items from either', () => {
    const snapA = makeEmptySnapshot('dev-a');
    snapA.stockLots.push({
      id: 'lot-abobora',
      createdAt: '2026-11-15T15:00:00.000Z',
      updatedAt: '2026-11-15T15:00:00.000Z',
      deletedAt: null,
      lastModifiedBy: 'dev-a',
      catalogItemId: 'starter-cat-abobora',
      productLabel: 'Abóbora',
      locationId: 'loc-pantry',
      quantity: 1,
      unit: 'un',
      qualitativeLevel: null,
      expiresAt: null,
      frozenOrCookedAt: null,
      isLeftover: false,
      sourceRecipeId: null,
      notes: '',
    });

    const snapB = makeEmptySnapshot('dev-b');
    snapB.stockLots.push({
      id: 'lot-arroz',
      createdAt: '2026-11-15T16:50:00.000Z',
      updatedAt: '2026-11-15T16:50:00.000Z',
      deletedAt: null,
      lastModifiedBy: 'dev-b',
      catalogItemId: 'starter-cat-arroz',
      productLabel: 'Arroz',
      locationId: 'loc-pantry',
      quantity: 2,
      unit: 'kg',
      qualitativeLevel: null,
      expiresAt: null,
      frozenOrCookedAt: null,
      isLeftover: false,
      sourceRecipeId: null,
      notes: '',
    });

    const combined = combineRemoteSnapshots([snapA, snapB], 'dev-b');
    expect(combined).not.toBeNull();
    expect(combined?.stockLots.map((l) => l.id).sort()).toEqual(['lot-abobora', 'lot-arroz']);
  });
});
