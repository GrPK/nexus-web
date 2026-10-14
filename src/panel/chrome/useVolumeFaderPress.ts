import { useCallback, useEffect, useRef } from 'react';
import { LONG_PRESS_MOVE_THRESHOLD } from '../engine/useLongPress';

interface PressPoint {
  pointerType: string;
  clientX: number;
  clientY: number;
  target: EventTarget | null;
}

interface Options {
  // Level shown right now.
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
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const press = useRef({ down: false, moved: false, fired: false, aborted: false, x: 0, y: 0, level: 0 });
  const opts = useRef({ level, onPreview, onLive, onCommit, onLongPress });
  useEffect(() => { opts.current = { level, onPreview, onLive, onCommit, onLongPress }; });

  const clearHold = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);
  const resetPress = useCallback(() => {
    press.current = { ...press.current, down: false, moved: false, fired: false, aborted: false };
  }, []);
  // Drops the hold and the press state: for a sheet that closes under a held finger.
  const reset = useCallback(() => {
    clearHold();
    if (endTimer.current) { clearTimeout(endTimer.current); endTimer.current = null; }
    resetPress();
  }, [clearHold, resetPress]);
  useEffect(() => reset, [reset]);

  const onDown = useCallback((e: PressPoint) => {
    // A second finger joins the press in progress; it must not re-capture the level.
    if (press.current.down) return;
    clearHold();
    // A press on the mute button is a tap on the button, not the fader.
    if (e.target instanceof Element && e.target.closest('button')) return;
    const hold = e.pointerType !== 'mouse' || mouseAsTouch;
    press.current = { down: true, moved: !hold, fired: false, aborted: false, x: e.clientX, y: e.clientY, level: opts.current.level };
    if (!hold) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      opts.current.onPreview(press.current.level);
      // The mixer replaces the fader, so no release will ever reach it.
      resetPress();
      opts.current.onLongPress();
    }, holdMs);
  }, [clearHold, holdMs, mouseAsTouch, resetPress]);

  const onMove = useCallback((e: PressPoint) => {
    const p = press.current;
    if (!p.down || p.moved) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (dx * dx + dy * dy > LONG_PRESS_MOVE_THRESHOLD * LONG_PRESS_MOVE_THRESHOLD) { p.moved = true; clearHold(); }
  }, [clearHold]);

  // The fader's own release handler runs after this capture one in the same
  // event, so the press state is cleared on the next task. That covers a press
  // the fader never commits (the label area).
  const scheduleReset = useCallback(() => {
    if (endTimer.current) clearTimeout(endTimer.current);
    endTimer.current = setTimeout(() => { endTimer.current = null; resetPress(); }, 0);
  }, [resetPress]);

  const onEnd = useCallback(() => { clearHold(); scheduleReset(); }, [clearHold, scheduleReset]);

  // A cancelled touch reports no usable position, and the fader still commits
  // from it: abort the press, show the original level, write nothing.
  const onCancel = useCallback(() => {
    const p = press.current;
    clearHold();
    if (p.down) { p.aborted = true; opts.current.onPreview(p.level); }
    scheduleReset();
  }, [clearHold, scheduleReset]);

  // The fader's change and commit callbacks.
  const change = useCallback((v: number) => {
    const p = press.current;
    if (p.aborted) return;
    if (p.down && !p.moved) opts.current.onPreview(v);
    else opts.current.onLive(v);
  }, []);
  const commit = useCallback((v: number) => {
    const p = press.current;
    if (p.aborted) return;
    p.down = false;
    opts.current.onCommit(v);
  }, []);

  return {
    captureProps: {
      onPointerDownCapture: onDown,
      onPointerMoveCapture: onMove,
      onPointerUpCapture: onEnd,
      onPointerCancelCapture: onCancel,
    },
    change,
    commit,
    reset,
  };
}
