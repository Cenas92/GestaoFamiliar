import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureDatabaseSeeded } from '../db/database';
import type {
  AppSettings,
  AttachmentRecord,
  CatalogItem,
  HouseholdMember,
  MealPlanEntry,
  Recipe,
  ShoppingItem,
  StockLot,
  StorageLocation,
  SupermarketSectionConfig,
} from '../types/domain';

export interface FamilyDataState {
  ready: boolean;
  settings: AppSettings | undefined;
  locations: StorageLocation[];
  supermarketSections: SupermarketSectionConfig[];
  catalogItems: CatalogItem[];
  stockLots: StockLot[];
  recipes: Recipe[];
  mealPlan: MealPlanEntry[];
  shoppingItems: ShoppingItem[];
  members: HouseholdMember[];
  attachments: AttachmentRecord[];
}

export function useFamilyData(): FamilyDataState {
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    let active = true;
    ensureDatabaseSeeded().then(() => {
      if (active) setSeeded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const settings = useLiveQuery(() => db.settings.get('singleton'), []);

  const locations = useLiveQuery(
    async () => {
      const all = await db.locations.toArray();
      return all.filter((l) => !l.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder);
    },
    [],
    [] as StorageLocation[],
  );

  const supermarketSections = useLiveQuery(
    async () => {
      const all = await db.supermarketSections.toArray();
      return all
        .filter((s) => !s.deletedAt)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-PT'));
    },
    [],
    [] as SupermarketSectionConfig[],
  );

  const catalogItems = useLiveQuery(
    async () => {
      const all = await db.catalogItems.toArray();
      return all
        .filter((c) => !c.deletedAt)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-PT'));
    },
    [],
    [] as CatalogItem[],
  );

  const stockLots = useLiveQuery(
    async () => {
      const all = await db.stockLots.toArray();
      return all.filter((l) => !l.deletedAt);
    },
    [],
    [] as StockLot[],
  );

  const recipes = useLiveQuery(
    async () => {
      const all = await db.recipes.toArray();
      return all
        .filter((r) => !r.deletedAt)
        .sort((a, b) => a.title.localeCompare(b.title, 'pt-PT'));
    },
    [],
    [] as Recipe[],
  );

  const mealPlan = useLiveQuery(
    async () => {
      const all = await db.mealPlan.toArray();
      return all.filter((m) => !m.deletedAt);
    },
    [],
    [] as MealPlanEntry[],
  );

  const shoppingItems = useLiveQuery(
    async () => {
      const all = await db.shoppingItems.toArray();
      return all.filter((s) => !s.deletedAt);
    },
    [],
    [] as ShoppingItem[],
  );

  const members = useLiveQuery(
    async () => {
      const all = await db.members.toArray();
      return all
        .filter((m) => !m.deletedAt)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    [],
    [] as HouseholdMember[],
  );

  const attachments = useLiveQuery(
    async () => {
      const all = await db.attachments.toArray();
      return all.filter((a) => !a.deletedAt);
    },
    [],
    [] as AttachmentRecord[],
  );

  return {
    ready: seeded && settings !== undefined,
    settings,
    locations,
    supermarketSections,
    catalogItems,
    stockLots,
    recipes,
    mealPlan,
    shoppingItems,
    members,
    attachments,
  };
}
