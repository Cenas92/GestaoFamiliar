import { describe, expect, it } from 'vitest';
import { FamilyDatabase, ensureDatabaseSeeded } from './database';

describe('database seeding', () => {
  it('seeds starter locations and PT-PT catalog idempotently with zero stock', async () => {
    const testDb = new FamilyDatabase(`test-db-${Date.now()}`);
    const settings1 = await ensureDatabaseSeeded(testDb);

    expect(settings1.initialized).toBe(true);
    expect(settings1.expiryWarningDays).toBe(5);

    const locations = await testDb.locations.toArray();
    const catalog = await testDb.catalogItems.toArray();
    const stock = await testDb.stockLots.toArray();

    expect(locations.length).toBeGreaterThanOrEqual(6);
    expect(catalog.length).toBeGreaterThanOrEqual(100);
    expect(stock.length).toBe(0);

    // Second call must not duplicate starter records
    await ensureDatabaseSeeded(testDb);
    expect(await testDb.locations.count()).toBe(locations.length);
    expect(await testDb.catalogItems.count()).toBe(catalog.length);

    await testDb.delete();
  });
});
