import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useApp } from './AppContext';

/**
 * Registers the offline service worker. When a new version is published the
 * top bar shows "Update ready" until it is applied, so it can't be missed. It
 * also applies itself while the app sits in the background with no dialog open,
 * so it never reloads mid-edit.
 */

const CHECK_EVERY = 30 * 60_000;
const IDLE_BEFORE_APPLY = 60_000;

let ready = false;
let apply: ((reload?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | undefined;
const listeners = new Set<() => void>();

function setReady() {
  ready = true;
  listeners.forEach((l) => l());
}

export function usePwaUpdateReady(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => ready,
  );
}

export function applyUpdate(): void {
  void apply?.(true);
}

/** Asks the server for a newer version now. Resolves true when one is waiting. */
export async function checkForUpdate(): Promise<boolean> {
  await registration?.update().catch(() => undefined);
  return ready;
}

export function usePwaUpdates() {
  const app = useApp();
  const toast = useRef(app.toast);
  toast.current = app.toast;

  useEffect(() => {
    // Dev builds, and client links (a client signing a contract doesn't install the studio app).
    if (import.meta.env.DEV || window.location.hash.startsWith('#/c?') || window.location.hash === '#/c') return;
    let cancelled = false;
    let timer: number | undefined;
    let idle: number | undefined;
    const check = () => void registration?.update().catch(() => undefined);
    const onVisible = () => {
      window.clearTimeout(idle);
      if (document.visibilityState === 'visible') return check();
      if (!ready) return;
      idle = window.setTimeout(() => {
        if (document.visibilityState === 'hidden' && !document.querySelector('[role="dialog"]')) applyUpdate();
      }, IDLE_BEFORE_APPLY);
    };
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (cancelled) return;
        apply = registerSW({
          onRegisteredSW(_url, reg) {
            registration = reg;
            timer = window.setInterval(check, CHECK_EVERY);
          },
          onNeedRefresh() {
            setReady();
            toast.current('A new version of the app is ready.', { action: { label: 'Reload', onClick: applyUpdate }, ms: 15_000 });
          },
          onOfflineReady() {
            toast.current('Ready to work offline on this device.', { tone: 'good' });
          },
        });
      })
      .catch(() => {
        /* service workers unavailable (http or private mode): the app still runs online */
      });
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(idle);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}
