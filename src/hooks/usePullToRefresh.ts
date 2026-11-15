import { useEffect, useRef, useState } from 'react';

const ACTIVATION_OFFSET_PX = 12;
const DAMPED_THRESHOLD_PX = 56;
const MAX_DAMPED_DISTANCE_PX = 88;

function isInteractiveOrScrolledElement(target: EventTarget | null): boolean {
  let current = target instanceof HTMLElement ? target : null;
  while (current && current !== document.body && current !== document.documentElement) {
    const tag = current.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || current.isContentEditable) {
      return true;
    }
    if (current.scrollTop > 0) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

export interface PullToRefreshState {
  pullDistance: number;
  isReadyToRelease: boolean;
  isRefreshing: boolean;
}

/**
 * Enables thumb pull-to-refresh at the top of the viewport for mobile PWAs
 * without interfering with nested scrollable containers or form inputs.
 */
export function usePullToRefresh(onRefresh: () => Promise<void>): PullToRefreshState {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const isRefreshingRef = useRef(isRefreshing);
  isRefreshingRef.current = isRefreshing;
  const pullDistanceRef = useRef(0);

  useEffect(() => {
    let tracking = false;
    let engaged = false;
    let startX = 0;
    let startY = 0;

    const resetPull = () => {
      tracking = false;
      engaged = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current) return;
      if (e.touches.length !== 1) return;
      if (window.scrollY > 2) return;
      if (isInteractiveOrScrolledElement(e.target)) return;

      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
      engaged = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!tracking || isRefreshingRef.current) return;
      if (e.touches.length !== 1) {
        resetPull();
        return;
      }

      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!engaged) {
        if (dy < -6 || (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8)) {
          tracking = false;
          return;
        }
        if (dy > ACTIVATION_OFFSET_PX && dy > Math.abs(dx) * 1.5 && window.scrollY <= 2) {
          engaged = true;
        } else {
          return;
        }
      }

      const damped = Math.min(
        MAX_DAMPED_DISTANCE_PX,
        Math.max(0, (dy - ACTIVATION_OFFSET_PX) * 0.48),
      );
      pullDistanceRef.current = damped;
      setPullDistance(damped);
    };

    const handleTouchEnd = () => {
      if (!tracking) return;
      const shouldRefresh = engaged && pullDistanceRef.current >= DAMPED_THRESHOLD_PX;
      resetPull();

      if (shouldRefresh && !isRefreshingRef.current) {
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        void Promise.resolve(onRefreshRef.current()).finally(() => {
          isRefreshingRef.current = false;
          setIsRefreshing(false);
        });
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', resetPull, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', resetPull);
    };
  }, []);

  return {
    pullDistance,
    isReadyToRelease: pullDistance >= DAMPED_THRESHOLD_PX,
    isRefreshing,
  };
}
