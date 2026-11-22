import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../db/database';
import type { AppSettings } from '../types/domain';
import {
  getCachedGoogleTokenExpiresAt,
  GoogleAuthRequiredError,
  hasPersistentGoogleSession,
  hasValidCachedGoogleToken,
  preloadGoogleScripts,
} from './googleDriveSync';
import {
  type SyncExecutionResult,
  isAutoSyncSuppressed,
  runGoogleDriveSync,
} from './syncService';

export type AutoSyncPhase = 'idle' | 'syncing' | 'ok' | 'needs_auth' | 'error';

const LINKED_FLAG_KEY = 'gf_google_sync_ever_linked';
const MIN_VISIBILITY_SYNC_INTERVAL_MS = 30_000;
const EDIT_DEBOUNCE_MS = 3_500;

export function markGoogleSyncLinked(): void {
  try {
    localStorage.setItem(LINKED_FLAG_KEY, '1');
  } catch {
    // Ignore
  }
}

export function clearGoogleSyncLinked(): void {
  try {
    localStorage.removeItem(LINKED_FLAG_KEY);
  } catch {
    // Ignore
  }
}

export function formatSyncSummary(res: SyncExecutionResult): string {
  const parts: string[] = [];
  if (res.addedFromRemote > 0) parts.push(`+${res.addedFromRemote} recebido(s)`);
  if (res.updatedFromRemote > 0) parts.push(`${res.updatedFromRemote} atualizado(s)`);
  if (res.localChangesPushed > 0) parts.push(`${res.localChangesPushed} enviado(s)`);
  if (res.uploadedAttachments > 0) parts.push(`${res.uploadedAttachments} anexo(s) enviado(s)`);
  if (res.downloadedAttachments > 0) {
    parts.push(`${res.downloadedAttachments} anexo(s) recebido(s)`);
  }
  return parts.length > 0 ? `Sincronizado: ${parts.join(', ')}` : 'Sincronizado (tudo atualizado)';
}

export function useAutoSync(settings: AppSettings | undefined) {
  const [phase, setPhase] = useState<AutoSyncPhase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [hasPendingLocalEdits, setHasPendingLocalEdits] = useState(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lastAutoAttemptRef = useRef(0);
  const debounceTimerRef = useRef<number | null>(null);
  const editRevisionRef = useRef(0);
  const isSyncingRef = useRef(false);

  const isConfigured = Boolean(
    settings?.googleClientId?.trim() && settings?.googleDriveFolderId,
  );

  // Preload Google GIS script in background as soon as Client ID exists
  useEffect(() => {
    if (settings?.googleClientId?.trim()) {
      preloadGoogleScripts();
    }
  }, [settings?.googleClientId]);

  const executeBackgroundSync = useCallback(async () => {
    const current = settingsRef.current;
    if (!current?.googleClientId?.trim() || !current.googleDriveFolderId) return;
    if (!navigator.onLine) return;
    if (isSyncingRef.current) return;

    const everLinked =
      Boolean(current.lastSyncAt) ||
      localStorage.getItem(LINKED_FLAG_KEY) === '1' ||
      hasValidCachedGoogleToken() ||
      hasPersistentGoogleSession(current.googleClientId);
    if (!everLinked) {
      setPhase('needs_auth');
      return;
    }
    if (current.lastSyncAt) {
      markGoogleSyncLinked();
    }

    const startRevision = editRevisionRef.current;
    isSyncingRef.current = true;
    lastAutoAttemptRef.current = Date.now();
    setPhase('syncing');

    try {
      const res = await runGoogleDriveSync(false, {
        googleClientId: current.googleClientId,
        googleDriveFolderId: current.googleDriveFolderId,
      });
      markGoogleSyncLinked();
      if (editRevisionRef.current === startRevision) {
        setHasPendingLocalEdits(false);
        setPhase('ok');
      } else {
        // New local edits happened while this sync was in flight — schedule a follow-up sync
        setHasPendingLocalEdits(true);
        if (debounceTimerRef.current !== null) {
          window.clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = window.setTimeout(() => {
          debounceTimerRef.current = null;
          void executeBackgroundSync();
        }, EDIT_DEBOUNCE_MS);
      }
      if (
        res.addedFromRemote > 0 ||
        res.updatedFromRemote > 0 ||
        res.localChangesPushed > 0
      ) {
        setMessage(formatSyncSummary(res));
      }
    } catch (err) {
      if (err instanceof GoogleAuthRequiredError) {
        setPhase('needs_auth');
        setMessage('Sessão Google expirada — toca para sincronizar.');
      } else {
        setPhase('error');
        setMessage(err instanceof Error ? err.message : 'Erro ao sincronizar.');
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // Listen to Dexie writes across synced tables and debounce auto-sync
  useEffect(() => {
    const syncedTables = [
      db.locations,
      db.supermarketSections,
      db.catalogItems,
      db.stockLots,
      db.recipes,
      db.mealPlan,
      db.shoppingItems,
      db.members,
      db.financeCategories,
      db.financeRecurring,
      db.financeTransactions,
      db.attachments,
    ];

    const scheduleEditSync = () => {
      if (isAutoSyncSuppressed()) return;
      const current = settingsRef.current;
      if (!current?.initialized) return;

      editRevisionRef.current += 1;
      setHasPendingLocalEdits(true);
      if (!current.googleClientId?.trim() || !current.googleDriveFolderId) return;

      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        void executeBackgroundSync();
      }, EDIT_DEBOUNCE_MS);
    };

    const unsubscribers: Array<() => void> = [];
    for (const table of syncedTables) {
      const onCreating = () => scheduleEditSync();
      const onUpdating = () => scheduleEditSync();
      const onDeleting = () => scheduleEditSync();
      table.hook('creating', onCreating);
      table.hook('updating', onUpdating);
      table.hook('deleting', onDeleting);
      unsubscribers.push(() => {
        table.hook('creating').unsubscribe(onCreating);
        table.hook('updating').unsubscribe(onUpdating);
        table.hook('deleting').unsubscribe(onDeleting);
      });
    }

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      for (const unsub of unsubscribers) {
        unsub();
      }
    };
  }, [executeBackgroundSync]);

  // Auto-sync on startup (once configured), when returning online, or when app returns to foreground
  useEffect(() => {
    if (!isConfigured) return;

    void executeBackgroundSync();

    const handleOnline = () => {
      void executeBackgroundSync();
    };

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastAutoAttemptRef.current < MIN_VISIBILITY_SYNC_INTERVAL_MS) return;
      void executeBackgroundSync();
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isConfigured, executeBackgroundSync]);

  // Proactively refresh token ~4 min before 1h expiry while app stays open & visible
  useEffect(() => {
    if (!isConfigured || phase !== 'ok') return;
    const expiresAt = getCachedGoogleTokenExpiresAt();
    if (!expiresAt) return;

    const refreshDelayMs = Math.max(60_000, expiresAt - Date.now() - 4 * 60_000);
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void executeBackgroundSync();
      }
    }, refreshDelayMs);

    return () => window.clearTimeout(timer);
  }, [isConfigured, phase, executeBackgroundSync]);

  const triggerManualSync = useCallback(async (): Promise<string> => {
    const current = settingsRef.current;
    if (!current) {
      throw new Error('Base de dados não inicializada.');
    }

    const startRevision = editRevisionRef.current;
    setPhase('syncing');
    setMessage(null);
    try {
      const res = await runGoogleDriveSync(true, {
        googleClientId: current.googleClientId,
        googleDriveFolderId: current.googleDriveFolderId,
      });
      markGoogleSyncLinked();
      if (editRevisionRef.current === startRevision) {
        setHasPendingLocalEdits(false);
      } else {
        setHasPendingLocalEdits(true);
      }
      const summary = formatSyncSummary(res);
      setPhase('ok');
      setMessage(summary);
      return summary;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Erro desconhecido ao sincronizar.';
      setPhase(err instanceof GoogleAuthRequiredError ? 'needs_auth' : 'error');
      setMessage(errMsg);
      throw err;
    }
  }, []);

  return {
    isConfigured,
    phase,
    message,
    hasPendingLocalEdits,
    triggerManualSync,
    clearMessage: () => setMessage(null),
  };
}
