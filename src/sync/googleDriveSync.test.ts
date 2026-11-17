import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCachedGoogleToken,
  ensureGoogleAccessToken,
  getConnectedGoogleAccount,
  getStoredGoogleClientSecret,
  hasPersistentGoogleSession,
  hasValidCachedGoogleToken,
  sanitizeGoogleClientId,
  setStoredGoogleClientSecret,
} from './googleDriveSync';
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

describe('persistent Google OAuth refresh flow and login_hint', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCachedGoogleToken();
    setStoredGoogleClientSecret('');
  });

  afterEach(() => {
    clearCachedGoogleToken();
    setStoredGoogleClientSecret('');
    delete (window as { google?: unknown }).google;
    vi.restoreAllMocks();
  });

  it('acquires refresh_token via initCodeClient, caches email hint and silently renews expired access_token', async () => {
    const clientId = '123456-test.apps.googleusercontent.com';
    setStoredGoogleClientSecret('GOCSPX-secret-123');
    expect(getStoredGoogleClientSecret()).toBe('GOCSPX-secret-123');

    const initCodeClientMock = vi.fn((config: { callback: (resp: { code: string }) => void }) => ({
      requestCode: () => {
        config.callback({ code: 'auth-code-xyz' });
      },
    }));

    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn(),
          initCodeClient: initCodeClientMock as unknown as NonNullable<
            NonNullable<Window['google']>['accounts']
          >['oauth2'] extends infer O
            ? O extends { initCodeClient?: infer C }
              ? C
              : never
            : never,
        },
      },
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'access-1',
            refresh_token: 'refresh-perm-1',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { emailAddress: 'familia@gmail.com', displayName: 'André' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'access-2',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const token1 = await ensureGoogleAccessToken(clientId, true);
    expect(token1).toBe('access-1');
    expect(hasPersistentGoogleSession(clientId)).toBe(true);
    expect(hasValidCachedGoogleToken()).toBe(true);
    expect(getConnectedGoogleAccount()).toEqual({
      email: 'familia@gmail.com',
      displayName: 'André',
    });

    // Simulate 1-hour access token expiring in storage while refresh_token stays valid
    const rawCache = JSON.parse(localStorage.getItem('gf_google_token_cache_v2') ?? '{}') as {
      token?: string;
      expiresAt?: number;
      scope?: string;
    };
    localStorage.setItem(
      'gf_google_token_cache_v2',
      JSON.stringify({ ...rawCache, expiresAt: Date.now() - 10_000 }),
    );
    // Clear in-memory variable by forcing 401 expiry via expired cache wouldn't clear in-memory `cachedAccessToken`,
    // so simulate full app restart using `initCodeClient` absent & deleting window.google completely:
    delete (window as { google?: unknown }).google;

    // Wait: simulate restart / expired memory cache by setting short TTL via vi.useFakeTimers
    vi.useFakeTimers();
    vi.advanceTimersByTime(3_700_000);

    try {
      const token2 = await ensureGoogleAccessToken(clientId, false);
      expect(token2).toBe('access-2');
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      const thirdCallBody = fetchSpy.mock.calls[2][1]?.body?.toString() ?? '';
      expect(thirdCallBody).toContain('grant_type=refresh_token');
      expect(thirdCallBody).toContain('refresh_token=refresh-perm-1');
    } finally {
      vi.useRealTimers();
    }
  });
});
