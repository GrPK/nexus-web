import { useCallback, useEffect, useRef } from 'react';
import { LONG_PRESS_MOVE_THRESHOLD } from '../engine/useLongPress';

interface PressPoint {
  pointerType: string;
  clientX: number;
  clientY: number;
  target: EventTarget | null;
}

interface Options {
  // Level shown right now, 0-1.
  level: number;
  // A mouse counts as a finger only under the touch-via-pointer flag.
  mouseAsTouch: boolean;
  holdMs: number;
  // Moves the fader without writing.
  onPreview: (level: number) => void;
  // Live drag write, coalesced by the caller.
  onLive: (level: number) => void;
  // Release write.
  onCommit: (level: number) => void;
  onLongPress: () => void;
}

/**
 * Press handling for the volume fader. The fader jumps to the touch point on
 * press, and a press can still become a hold, so a press only previews: a
 * hold that opens the mixer writes nothing. Once the finger moves past the
 * hold tolerance the hold can no longer fire and the drag writes live; a tap
 * released without moving commits the tapped level.
 */
export function useVolumeFaderPress({ level, mouseAsTouch, holdMs, onPreview, onLive, onCommit, onLongPress }: Options) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const press = useRef({ down: false, moved: false, fired: false, x: 0, y: 0, level: 0 });
  const opts = useRef({ level, onPreview, onLive, onCommit, onLongPress });
  useEffect(() => { opts.current = { level, onPreview, onLive, onCommit, onLongPress }; });

  const clearHold = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);
  useEffect(() => clearHold, [clearHold]);

  const onDown = useCallback((e: PressPoint) => {
    clearHold();
    // A press on the mute button is a tap on the button, not the fader.
    if (e.target instanceof Element && e.target.closest('button')) { press.current.down = false; return; }
    const hold = e.pointerType !== 'mouse' || mouseAsTouch;
    press.current = { down: true, moved: !hold, fired: false, x: e.clientX, y: e.clientY, level: opts.current.level };
    if (!hold) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      press.current.fired = true;
      opts.current.onPreview(press.current.level);
      opts.current.onLongPress();
    }, holdMs);
  }, [clearHold, holdMs, mouseAsTouch]);

  const onMove = useCallback((e: PressPoint) => {
    const p = press.current;
    if (!p.down || p.moved) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (dx * dx + dy * dy > LONG_PRESS_MOVE_THRESHOLD * LONG_PRESS_MOVE_THRESHOLD) { p.moved = true; clearHold(); }
  }, [clearHold]);

  const onEnd = useCallback(() => { clearHold(); }, [clearHold]);

  // The fader's change and commit callbacks.
  const change = useCallback((v: number) => {
    const p = press.current;
    if (p.fired) return;
    if (p.down && !p.moved) opts.current.onPreview(v);
    else opts.current.onLive(v);
  }, []);
  const commit = useCallback((v: number) => {
    const p = press.current;
    if (p.fired) return;
    p.down = false;
    opts.current.onCommit(v);
  }, []);

  return {
    captureProps: {
      onPointerDownCapture: onDown,
      onPointerMoveCapture: onMove,
      onPointerUpCapture: onEnd,
      onPointerCancelCapture: onEnd,
    },
    change,
    commit,
  };
}
