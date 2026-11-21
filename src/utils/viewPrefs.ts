import { FileText, LayoutGrid, LayoutList, List, type LucideIcon } from 'lucide-react';

export type UiDensityMode = 'clean' | 'complete';

export type CollectionViewMode = 'detailed' | 'medium' | 'line' | 'grid';

export interface CollectionViewPreferences<TSort extends string> {
  viewMode: CollectionViewMode;
  sortMode: TSort;
  groupEnabled: boolean;
}

export const UI_DENSITY_STORAGE_KEY = 'gestao_familiar_ui_density_mode';

export const STOCK_PREFS_STORAGE_KEY = 'gestao_familiar_stock_view_prefs';
export const RECIPE_PREFS_STORAGE_KEY = 'gestao_familiar_recipe_view_prefs';
export const SHOPPING_PREFS_STORAGE_KEY = 'gestao_familiar_shopping_view_prefs';
export const FINANCE_PREFS_STORAGE_KEY = 'gestao_familiar_finance_view_prefs';

const COLLECTION_VIEW_PRESET_TARGETS: {
  storageKey: string;
  defaultSortMode: string;
  defaultGroupEnabled: boolean;
}[] = [
  { storageKey: STOCK_PREFS_STORAGE_KEY, defaultSortMode: 'expiry', defaultGroupEnabled: false },
  {
    storageKey: RECIPE_PREFS_STORAGE_KEY,
    defaultSortMode: 'compatibility',
    defaultGroupEnabled: false,
  },
  { storageKey: SHOPPING_PREFS_STORAGE_KEY, defaultSortMode: 'section', defaultGroupEnabled: true },
  { storageKey: FINANCE_PREFS_STORAGE_KEY, defaultSortMode: 'date_desc', defaultGroupEnabled: false },
];

const VALID_VIEW_MODES: readonly CollectionViewMode[] = ['detailed', 'medium', 'line', 'grid'];

export const COLLECTION_VIEW_MODE_OPTIONS: {
  id: CollectionViewMode;
  label: string;
  shortLabel: string;
  Icon: LucideIcon;
}[] = [
  { id: 'line', label: 'Lista compacta em linha', shortLabel: 'Em linha', Icon: List },
  { id: 'medium', label: 'Cartões padrão', shortLabel: 'Padrão', Icon: LayoutList },
  { id: 'detailed', label: 'Cartões detalhados', shortLabel: 'Detalhada', Icon: FileText },
  { id: 'grid', label: 'Grelha em quadrados', shortLabel: 'Quadrados', Icon: LayoutGrid },
];

export function getDefaultCollectionViewMode(uiDensity: UiDensityMode): CollectionViewMode {
  return uiDensity === 'complete' ? 'medium' : 'line';
}

export function shouldExpandPanelsByDefault(uiDensity: UiDensityMode): boolean {
  if (uiDensity === 'complete') return true;
  return typeof window !== 'undefined' ? window.innerWidth >= 640 : true;
}

export function loadUiDensityMode(): UiDensityMode {
  if (typeof window === 'undefined') return 'clean';
  try {
    return window.localStorage.getItem(UI_DENSITY_STORAGE_KEY) === 'complete'
      ? 'complete'
      : 'clean';
  } catch {
    return 'clean';
  }
}

export function saveUiDensityMode(mode: UiDensityMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UI_DENSITY_STORAGE_KEY, mode);
  } catch {
    // Ignore storage quota or private browsing restrictions
  }
}

/**
 * Switches device UI density mode and aligns collection viewMode presets
 * (Clean -> 'line', Complete -> 'medium') while preserving user sort/grouping settings.
 */
export function switchUiDensityMode(mode: UiDensityMode): void {
  saveUiDensityMode(mode);
  if (typeof window === 'undefined') return;

  const presetViewMode = getDefaultCollectionViewMode(mode);
  for (const target of COLLECTION_VIEW_PRESET_TARGETS) {
    try {
      const raw = window.localStorage.getItem(target.storageKey);
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const next = {
        sortMode:
          typeof parsed.sortMode === 'string' ? parsed.sortMode : target.defaultSortMode,
        groupEnabled:
          typeof parsed.groupEnabled === 'boolean'
            ? parsed.groupEnabled
            : typeof parsed.groupByLocation === 'boolean'
              ? parsed.groupByLocation
              : target.defaultGroupEnabled,
        viewMode: presetViewMode,
      };
      window.localStorage.setItem(target.storageKey, JSON.stringify(next));
    } catch {
      // Ignore storage quota or private browsing restrictions
    }
  }
}

export function loadCollectionPreferences<TSort extends string>(
  storageKey: string,
  validSortModes: readonly TSort[],
  defaults: CollectionViewPreferences<TSort>,
  legacyMap?: (raw: Record<string, unknown>) => Partial<CollectionViewPreferences<TSort>>,
  uiDensity: UiDensityMode = 'clean',
): CollectionViewPreferences<TSort> {
  const effectiveDefaults: CollectionViewPreferences<TSort> = {
    ...defaults,
    viewMode: getDefaultCollectionViewMode(uiDensity),
  };
  if (typeof window === 'undefined') return effectiveDefaults;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return effectiveDefaults;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mapped = legacyMap ? { ...parsed, ...legacyMap(parsed) } : parsed;

    return {
      viewMode: VALID_VIEW_MODES.includes(mapped.viewMode as CollectionViewMode)
        ? (mapped.viewMode as CollectionViewMode)
        : effectiveDefaults.viewMode,
      sortMode: validSortModes.includes(mapped.sortMode as TSort)
        ? (mapped.sortMode as TSort)
        : effectiveDefaults.sortMode,
      groupEnabled:
        typeof mapped.groupEnabled === 'boolean'
          ? mapped.groupEnabled
          : effectiveDefaults.groupEnabled,
    };
  } catch {
    return effectiveDefaults;
  }
}

export function saveCollectionPreferences<TSort extends string>(
  storageKey: string,
  prefs: CollectionViewPreferences<TSort>,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota or private browsing restrictions
  }
}
