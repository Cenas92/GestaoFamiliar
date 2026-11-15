import { FileText, LayoutGrid, LayoutList, List, type LucideIcon } from 'lucide-react';

export type CollectionViewMode = 'detailed' | 'medium' | 'line' | 'grid';

export interface CollectionViewPreferences<TSort extends string> {
  viewMode: CollectionViewMode;
  sortMode: TSort;
  groupEnabled: boolean;
}

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

export function loadCollectionPreferences<TSort extends string>(
  storageKey: string,
  validSortModes: readonly TSort[],
  defaults: CollectionViewPreferences<TSort>,
  legacyMap?: (raw: Record<string, unknown>) => Partial<CollectionViewPreferences<TSort>>,
): CollectionViewPreferences<TSort> {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mapped = legacyMap ? { ...parsed, ...legacyMap(parsed) } : parsed;

    return {
      viewMode: VALID_VIEW_MODES.includes(mapped.viewMode as CollectionViewMode)
        ? (mapped.viewMode as CollectionViewMode)
        : defaults.viewMode,
      sortMode: validSortModes.includes(mapped.sortMode as TSort)
        ? (mapped.sortMode as TSort)
        : defaults.sortMode,
      groupEnabled:
        typeof mapped.groupEnabled === 'boolean' ? mapped.groupEnabled : defaults.groupEnabled,
    };
  } catch {
    return defaults;
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
