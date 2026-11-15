import { describe, expect, it } from 'vitest';
import { sanitizeGoogleClientId } from './googleDriveSync';
import { isAutoSyncSuppressed, withSuppressedAutoSync } from './syncService';

describe('sanitizeGoogleClientId', () => {
  it('removes accidental https/http prefixes and whitespace', () => {
    expect(
      sanitizeGoogleClientId('  https://593950790669-test.apps.googleusercontent.com \n')
    ).toBe('593950790669-test.apps.googleusercontent.com');

    expect(
      sanitizeGoogleClientId('http:// 593950790669-test .apps.googleusercontent.com')
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
