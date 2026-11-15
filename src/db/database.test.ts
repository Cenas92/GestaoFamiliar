import { describe, expect, it } from 'vitest';
import { FamilyDatabase, ensureDatabaseSeeded } from './database';

describe('database seeding', () => {
  it('seeds starter locations and PT-PT catalog idempotently with zero stock', async () => {
    const testDb = new FamilyDatabase(`test-db-${Date.now()}`);
    const settings1 = await ensureDatabaseSeeded(testDb);

    expect(settings1.initialized).toBe(true);
    expect(settings1.expiryWarningDays).toBe(5);

    const locations = await testDb.locations.toArray();
    const sections = await testDb.supermarketSections.toArray();
    const catalog = await testDb.catalogItems.toArray();
    const stock = await testDb.stockLots.toArray();

    expect(locations.length).toBeGreaterThanOrEqual(6);
    expect(sections.length).toBe(12);
    expect(catalog.length).toBeGreaterThanOrEqual(100);
    expect(stock.length).toBe(0);

    // Second call must not duplicate starter records
    await ensureDatabaseSeeded(testDb);
    expect(await testDb.locations.count()).toBe(locations.length);
    expect(await testDb.supermarketSections.count()).toBe(12);
    expect(await testDb.catalogItems.count()).toBe(catalog.length);

    await testDb.delete();
  });

  it('seeds default supermarket sections when upgrading an already-initialized database', async () => {
    const testDb = new FamilyDatabase(`test-db-upgrade-${Date.now()}`);
    await testDb.settings.put({
      id: 'singleton',
      expiryWarningDays: 5,
      deviceId: 'dev-legacy',
      googleClientId: '',
      googleDriveFolderId: null,
      googleDriveFolderName: null,
      lastSyncAt: null,
      lastSyncStatus: 'idle',
      lastSyncError: null,
      initialized: true,
    });

    await ensureDatabaseSeeded(testDb);
    const sections = await testDb.supermarketSections.toArray();
    expect(sections).toHaveLength(12);
    expect(sections[0]?.lastModifiedBy).toBe('dev-legacy');

    await testDb.delete();
  });
});
