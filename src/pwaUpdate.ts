const MIN_UPDATE_CHECK_INTERVAL_MS = 60_000;
const PERIODIC_UPDATE_CHECK_MS = 30 * 60_000;

let activeRegistration: ServiceWorkerRegistration | null = null;
let lastCheckAt = 0;

/**
 * Attaches visibility, online, and periodic checks so installed PWAs discover
 * new deployments promptly on both desktop and mobile.
 */
export function attachPwaRegistration(registration: ServiceWorkerRegistration): void {
  activeRegistration = registration;
  lastCheckAt = Date.now();

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
 * Forces a Service Worker update check and reports whether a newer build is
 * already installing/waiting to take over.
 */
export async function checkForPwaUpdate(): Promise<PwaUpdateCheckResult> {
  if (!navigator.onLine) return 'offline';
  if (!('serviceWorker' in navigator)) return 'unsupported';

  const reg = activeRegistration ?? (await navigator.serviceWorker.getRegistration());
  if (!reg) return 'unsupported';

  activeRegistration = reg;
  lastCheckAt = Date.now();

  try {
    await reg.update();
  } catch {
    // Ignore transient network errors during SW fetch
  }

  if (reg.installing || reg.waiting) {
    return 'updated';
  }
  return 'up-to-date';
}
