import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { GESTURE_AXIS_DOMINANCE } from './gestureThresholds';
import { claimGestureAxis, resetGestureAxis } from './gestureAxisLock';
import { bindGestureContacts, useTouchViaPointer, type GestureContact } from './touchViaPointer';
import { resolveSwipeRelease } from './controlCenterGesture';
import { triggerHaptic } from '../device/panelNativeBridge';

export type ControlCenterSwipeState = 'idle' | 'dragging' | 'settling';

interface SwipeOptions {
  enabled: boolean;
  surfaceRef: RefObject<HTMLElement | null>;
  // 'down' pulls the sheet open from the top edge; 'up' dismisses it.
  direction: 'down' | 'up';
  engagePx: number;
  commitPx: number;
  flickPxPerMs: number;
  // True when the touch must not arm: outside the top band, or on a control
  // that owns its own drag. Evaluated once at touch start.
  shouldYield: (contact: GestureContact) => boolean;
  onCommit: () => void;
  onCancel?: () => void;
}

interface SwipeResult {
  // Pixels pulled past the engage dead zone along `direction`. 0 when idle.
  offset: number;
  state: ControlCenterSwipeState;
  reset: () => void;
}

const SETTLE_MS = 240;

/**
 * Single-finger vertical swipe shared by the control center's open (down) and
 * dismiss (up) gestures. Same contract as usePanelTraySwipe: arms at touch
 * start only, engages on a clearly vertical drag, claims the vertical axis so
 * the pager and widgets yield, and reports a live offset so the sheet follows
 * the finger.
 */
export function usePanelControlCenterSwipe({
  enabled,
  surfaceRef,
  direction,
  engagePx,
  commitPx,
  flickPxPerMs,
  shouldYield,
  onCommit,
  onCancel,
}: SwipeOptions): SwipeResult {
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<ControlCenterSwipeState>('idle');
  const touchViaPointer = useTouchViaPointer();
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cfg = useRef({ direction, engagePx, commitPx, flickPxPerMs, shouldYield, onCommit, onCancel });
  useEffect(() => {
    cfg.current = { direction, engagePx, commitPx, flickPxPerMs, shouldYield, onCommit, onCancel };
  }, [direction, engagePx, commitPx, flickPxPerMs, shouldYield, onCommit, onCancel]);

  const clearSettle = useCallback(() => {
    if (settleTimer.current) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearSettle();
    setOffset(0);
    setState('idle');
  }, [clearSettle]);

  useEffect(() => () => clearSettle(), [clearSettle]);

  useEffect(() => {
    if (!enabled) return;
    const el = surfaceRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;
    let lastOffset = 0;
    let isDragging = false;
    let yielded = false;
    let committedHaptic = false;

    const sign = () => (cfg.current.direction === 'down' ? 1 : -1);

    const onStart = (t: GestureContact) => {
      yielded = cfg.current.shouldYield(t);
      startX = t.clientX;
      startY = t.clientY;
      lastY = t.clientY;
      lastTime = t.timeStamp;
      velocity = 0;
      lastOffset = 0;
      isDragging = false;
      committedHaptic = false;
      resetGestureAxis();
      clearSettle();
    };

    const onMove = (t: GestureContact) => {
      if (yielded) return;
      const delta = (t.clientY - startY) * sign();
      const deltaX = t.clientX - startX;
      const { engagePx: engage, commitPx: commit } = cfg.current;

      if (!isDragging) {
        if (delta <= engage) return;
        if (delta <= Math.abs(deltaX) * GESTURE_AXIS_DOMINANCE) return;
        if (!claimGestureAxis('vertical')) { yielded = true; return; }
        isDragging = true;
        setState('dragging');
      }

      t.preventDefault();
      const dt = t.timeStamp - lastTime;
      if (dt > 0) velocity = ((t.clientY - lastY) * sign()) / dt;
      lastY = t.clientY;
      lastTime = t.timeStamp;
      const pulled = Math.max(0, delta - engage);
      lastOffset = pulled;
      setOffset(pulled);
      if (pulled > commit) {
        if (!committedHaptic) { committedHaptic = true; triggerHaptic('medium'); }
      } else {
        committedHaptic = false;
      }
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      const { commitPx: commit, flickPxPerMs: flick } = cfg.current;
      const outcome = resolveSwipeRelease(lastOffset, velocity, commit, flick);
      setState('settling');
      clearSettle();
      setOffset(0);
      if (outcome === 'commit') cfg.current.onCommit();
      else cfg.current.onCancel?.();
      settleTimer.current = setTimeout(() => { settleTimer.current = null; setState('idle'); }, SETTLE_MS);
    };

    return bindGestureContacts(el, touchViaPointer, { start: onStart, move: onMove, end: onEnd });
  }, [enabled, surfaceRef, clearSettle, touchViaPointer]);

  return { offset, state, reset };
}
