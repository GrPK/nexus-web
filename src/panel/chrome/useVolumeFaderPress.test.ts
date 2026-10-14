import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVolumeFaderPress } from './useVolumeFaderPress';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function setup(mouseAsTouch = true) {
  const cb = { onPreview: vi.fn(), onLive: vi.fn(), onCommit: vi.fn(), onLongPress: vi.fn() };
  const hook = renderHook(() => useVolumeFaderPress({ level: 0.3, mouseAsTouch, holdMs: 600, ...cb }));
  const touch = { pointerType: 'touch', clientX: 100, clientY: 100, target: document.body };
  return { cb, hook, touch };
}

describe('useVolumeFaderPress', () => {
  it('writes nothing during a held press, and a long-press that opens the mixer writes nothing', () => {
    const { cb, hook, touch } = setup();
    act(() => { hook.result.current.captureProps.onPointerDownCapture(touch); });
    // The fader jumps to the touch point on press.
    act(() => { hook.result.current.change(0.95); });
    act(() => { vi.advanceTimersByTime(300); });
    expect(cb.onLive).not.toHaveBeenCalled();
    expect(cb.onCommit).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(400); });
    expect(cb.onLongPress).toHaveBeenCalledTimes(1);
    // The shown level is put back; still no write.
    expect(cb.onPreview).toHaveBeenLastCalledWith(0.3);
    act(() => { hook.result.current.captureProps.onPointerUpCapture(); hook.result.current.commit(0.95); });
    expect(cb.onLive).not.toHaveBeenCalled();
    expect(cb.onCommit).not.toHaveBeenCalled();
  });

  it('commits a tap released without moving, and only on release', () => {
    const { cb, hook, touch } = setup();
    act(() => { hook.result.current.captureProps.onPointerDownCapture(touch); hook.result.current.change(0.5); });
    expect(cb.onCommit).not.toHaveBeenCalled();
    act(() => { hook.result.current.captureProps.onPointerUpCapture(); hook.result.current.commit(0.5); });
    expect(cb.onCommit).toHaveBeenCalledWith(0.5);
    expect(cb.onLive).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(cb.onLongPress).not.toHaveBeenCalled();
  });

  it('writes live once the finger moves past the hold tolerance', () => {
    const { cb, hook, touch } = setup();
    act(() => { hook.result.current.captureProps.onPointerDownCapture(touch); });
    act(() => { hook.result.current.captureProps.onPointerMoveCapture({ ...touch, clientY: 160 }); hook.result.current.change(0.7); });
    expect(cb.onLive).toHaveBeenCalledWith(0.7);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(cb.onLongPress).not.toHaveBeenCalled();
  });

  it('writes live right away for a mouse that is not a finger', () => {
    const { cb, hook } = setup(false);
    act(() => {
      hook.result.current.captureProps.onPointerDownCapture({ pointerType: 'mouse', clientX: 1, clientY: 1, target: document.body });
      hook.result.current.change(0.6);
    });
    expect(cb.onLive).toHaveBeenCalledWith(0.6);
  });

  it('writes live for keyboard changes with no press', () => {
    const { cb, hook } = setup();
    act(() => { hook.result.current.change(0.4); });
    expect(cb.onLive).toHaveBeenCalledWith(0.4);
  });
});
