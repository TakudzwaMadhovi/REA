import { useEffect, useState } from 'react';

/** iPhone/iPad. iPadOS 13+ reports itself as a Mac, so touch points tell them apart. */
export function isIOS(ua = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints ?? 0) {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

/** Running from the Home Screen (iOS sets navigator.standalone; others use the display-mode query). */
export function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** Pure rule, unit-tested: show the Add to Home Screen guide only on iOS, in the browser, not dismissed. */
export function shouldShowInstallGuide(ios: boolean, standalone: boolean, dismissed: boolean) {
  return ios && !standalone && !dismissed;
}

/** Ask the browser not to evict our data. Home Screen apps on iOS are already exempt from the 7-day rule. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist?.();
  } catch {
    /* not supported: nothing to do */
  }
}

/** Keep the screen on while `active`. Silently does nothing where Wake Lock is unsupported. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) lock.release();
      } catch {
        /* denied, low battery or unsupported in this context */
      }
    };
    acquire();
    // the lock is dropped whenever the page is hidden; take it again on return
    const onVis = () => document.visibilityState === 'visible' && acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

/** True while the on-screen keyboard covers part of the layout viewport (iOS shrinks visualViewport). */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const on = () => setOpen(window.innerHeight - vv.height > 150);
    vv.addEventListener('resize', on);
    return () => vv.removeEventListener('resize', on);
  }, []);
  return open;
}

/** Pixels hidden under the keyboard, for lifting a bottom sheet above it. */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const on = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener('resize', on);
    vv.addEventListener('scroll', on);
    return () => {
      vv.removeEventListener('resize', on);
      vv.removeEventListener('scroll', on);
    };
  }, []);
  return inset;
}

/** Matches the CSS breakpoint for the phone layout. */
export function useIsPhone() {
  const q = '(max-width: 1023px)';
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}
