import { useCallback, useEffect, useRef, useState } from "react";

export type UseIntervalRefreshOptions = {
  /** When false, no interval is scheduled (manual refresh still works). */
  readonly enabled?: boolean;
};

export type UseIntervalRefreshResult = {
  readonly prefersReducedMotion: boolean;
  readonly refreshNow: () => void;
};

/**
 * Runs `callback` on an interval while the document is visible.
 * Pauses when the tab is hidden; refreshes once when it becomes visible again.
 * Data refresh continues under prefers-reduced-motion; consumers may skip animations.
 */
export function useIntervalRefresh(
  callback: () => void | Promise<void>,
  intervalMs: number,
  options?: UseIntervalRefreshOptions,
): UseIntervalRefreshResult {
  const callbackRef = useRef(callback);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setPrefersReducedMotion(media.matches);
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
    };
  }, []);

  const refreshNow = useCallback(() => {
    void callbackRef.current();
  }, []);

  useEffect(() => {
    if (options?.enabled === false || intervalMs <= 0) {
      return;
    }

    let timerId: ReturnType<typeof setInterval> | undefined;

    function clearTimer() {
      if (timerId !== undefined) {
        clearInterval(timerId);
        timerId = undefined;
      }
    }

    function startTimer() {
      clearTimer();
      if (document.hidden) {
        return;
      }
      timerId = setInterval(() => {
        if (!document.hidden) {
          void callbackRef.current();
        }
      }, intervalMs);
    }

    function onVisibilityChange() {
      if (document.hidden) {
        clearTimer();
        return;
      }
      void callbackRef.current();
      startTimer();
    }

    startTimer();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, options?.enabled]);

  return { prefersReducedMotion, refreshNow };
}
