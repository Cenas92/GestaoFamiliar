import { APP_INFO } from './appInfo';

const MIN_UPDATE_CHECK_INTERVAL_MS = 60_000;
const PERIODIC_UPDATE_CHECK_MS = 30 * 60_000;

let activeRegistration: ServiceWorkerRegistration | null = null;
let lastCheckAt = 0;
let controllerListenerAttached = false;
let isReloadingForUpdate = false;

function scheduleReloadForUpdate(): void {
  if (isReloadingForUpdate) return;
  isReloadingForUpdate = true;
  window.setTimeout(() => {
    window.location.reload();
  }, 450);
}

function attachControllerChangeListener(): void {
  if (controllerListenerAttached || !('serviceWorker' in navigator)) return;
  controllerListenerAttached = true;

  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    scheduleReloadForUpdate();
  });
}

async function fetchRemoteAppVersion(): Promise<string | null> {
  try {
    const base = import.meta.env.BASE_URL || '/';
    const url = `${base}version.json?t=${Date.now()}`;
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { version?: unknown };
    return typeof data.version === 'string' ? data.version.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Attaches visibility, online, and periodic checks so installed PWAs discover
 * new deployments promptly on both desktop and mobile.
 */
export function attachPwaRegistration(registration: ServiceWorkerRegistration): void {
  activeRegistration = registration;
  lastCheckAt = Date.now();
  attachControllerChangeListener();

  const maybeUpdate = () => {
    if (!navigator.onLine) return;
    if (Date.now() - lastCheckAt < MIN_UPDATE_CHECK_INTERVAL_MS) return;
    lastCheckAt = Date.now();
    void registration.update().catch(() => {});
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      maybeUpdate();
    }
  });
  window.addEventListener('online', maybeUpdate);
  window.setInterval(maybeUpdate, PERIODIC_UPDATE_CHECK_MS);
}

export type PwaUpdateCheckResult = 'updated' | 'up-to-date' | 'unsupported' | 'offline';

/**
 * Forces a Service Worker update check and verifies the live version.json (no-store)
 * so an already-activated SW or GitHub Pages HTTP cache never falsely reports "up-to-date".
 */
export async function checkForPwaUpdate(): Promise<PwaUpdateCheckResult> {
  if (!navigator.onLine) return 'offline';
  if (!('serviceWorker' in navigator)) return 'unsupported';

  attachControllerChangeListener();

  const reg = activeRegistration ?? (await navigator.serviceWorker.getRegistration());
  if (!reg) return 'unsupported';

  activeRegistration = reg;
  lastCheckAt = Date.now();

  const [, remoteVersion] = await Promise.all([
    reg.update().catch(() => undefined),
    fetchRemoteAppVersion(),
  ]);

  if (reg.waiting) {
    try {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch {
      // Ignore
    }
    scheduleReloadForUpdate();
    return 'updated';
  }

  if (reg.installing) {
    return 'updated';
  }

  if (remoteVersion && remoteVersion !== APP_INFO.version) {
    // New version is live on server (e.g. SW already activated in background while old JS bundle stayed open)
    scheduleReloadForUpdate();
    return 'updated';
  }

  return 'up-to-date';
}
