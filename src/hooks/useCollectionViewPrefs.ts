import { useEffect, useRef, useState } from 'react';
import type { CollectionViewPreferences, UiDensityMode } from '../utils/viewPrefs';

/**
 * Manages persisted collection preferences for the active device and synchronizes
 * preset defaults when the user explicitly toggles global UI density (clean vs complete).
 */
export function useCollectionViewPrefs<TSort extends string>(
  uiDensity: UiDensityMode,
  loadPrefs: (density: UiDensityMode) => CollectionViewPreferences<TSort>,
  savePrefs: (prefs: CollectionViewPreferences<TSort>) => void,
  onDensityChanged?: (nextDensity: UiDensityMode) => void,
): [CollectionViewPreferences<TSort>, (patch: Partial<CollectionViewPreferences<TSort>>) => void] {
  const [prefs, setPrefs] = useState<CollectionViewPreferences<TSort>>(() => loadPrefs(uiDensity));
  const prevDensityRef = useRef<UiDensityMode>(uiDensity);
  const loadRef = useRef(loadPrefs);
  const onChangeRef = useRef(onDensityChanged);
  loadRef.current = loadPrefs;
  onChangeRef.current = onDensityChanged;

  useEffect(() => {
    if (prevDensityRef.current === uiDensity) return;
    prevDensityRef.current = uiDensity;
    setPrefs(loadRef.current(uiDensity));
    onChangeRef.current?.(uiDensity);
  }, [uiDensity]);

  const updatePrefs = (patch: Partial<CollectionViewPreferences<TSort>>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  };

  return [prefs, updatePrefs];
}
