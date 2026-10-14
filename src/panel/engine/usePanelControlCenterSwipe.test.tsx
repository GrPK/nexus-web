import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePanelControlCenterSwipe } from './usePanelControlCenterSwipe';
import { inControlCenterBand } from './controlCenterGesture';
import { claimGestureAxis, resetGestureAxis } from './gestureAxisLock';
import { TouchViaPointerContext } from './touchViaPointer';

const BAND = 30;
const onCommit = vi.fn();

function Harness({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const swipe = usePanelControlCenterSwipe({
    enabled,
    surfaceRef: ref,
    direction: 'down',
    engagePx: 10,
    commitPx: 80,
    flickPxPerMs: 5,
    shouldYield: c => !inControlCenterBand(c.clientY, BAND),
    onCommit,
  });
  return <div ref={ref} data-testid="surface" data-state={swipe.state} data-offset={swipe.offset} />;
}

// Each event advances the clock 100 ms, so a short drag is slow, not a flick.
let clock = 0;

function touch(target: Element, type: string, x: number, y: number) {
  const point = { identifier: 1, target, clientX: x, clientY: y };
  const event = new Event(type, { bubbles: true, cancelable: true });
  clock += 100;
  Object.defineProperties(event, {
    touches: { value: type === 'touchend' ? [] : [point] },
    timeStamp: { value: clock },
  });
  target.dispatchEvent(event);
}

function pointer(target: Element, type: string, x: number, y: number, buttons: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, buttons, button: 0 });
  clock += 100;
  Object.defineProperties(event, {
    pointerType: { value: 'mouse' },
    isPrimary: { value: true },
    pointerId: { value: 1 },
    timeStamp: { value: clock },
  });
  target.dispatchEvent(event);
}

afterEach(() => {
  onCommit.mockReset();
  resetGestureAxis();
});

describe('usePanelControlCenterSwipe (open)', () => {
  it('follows a vertical drag that starts in the band and commits on distance', () => {
    render(<Harness />);
    const el = screen.getByTestId('surface');
    act(() => { touch(el, 'touchstart', 100, 6); touch(el, 'touchmove', 100, 60); });
    expect(el).toHaveAttribute('data-state', 'dragging');
    expect(Number(el.getAttribute('data-offset'))).toBe(60 - 6 - 10);
    act(() => { touch(el, 'touchmove', 100, 140); touch(el, 'touchend', 100, 140); });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('springs back when released short of the commit distance', () => {
    render(<Harness />);
    const el = screen.getByTestId('surface');
    act(() => { touch(el, 'touchstart', 100, 6); touch(el, 'touchmove', 100, 50); touch(el, 'touchend', 100, 50); });
    expect(onCommit).not.toHaveBeenCalled();
    expect(el).toHaveAttribute('data-offset', '0');
  });

  it('ignores a touch that starts below the band', () => {
    render(<Harness />);
    const el = screen.getByTestId('surface');
    act(() => { touch(el, 'touchstart', 100, BAND + 40); touch(el, 'touchmove', 100, BAND + 200); touch(el, 'touchend', 100, BAND + 200); });
    expect(el).toHaveAttribute('data-state', 'idle');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('ignores a mostly horizontal drag', () => {
    render(<Harness />);
    const el = screen.getByTestId('surface');
    act(() => { touch(el, 'touchstart', 100, 6); touch(el, 'touchmove', 220, 60); touch(el, 'touchend', 220, 60); });
    expect(el).toHaveAttribute('data-state', 'idle');
  });

  it('yields when the pager already owns the horizontal axis', () => {
    render(<Harness />);
    const el = screen.getByTestId('surface');
    act(() => { touch(el, 'touchstart', 100, 6); });
    claimGestureAxis('horizontal');
    act(() => { touch(el, 'touchmove', 100, 80); touch(el, 'touchend', 100, 80); });
    expect(el).toHaveAttribute('data-state', 'idle');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('claims the vertical axis so the pager yields', () => {
    render(<Harness />);
    const el = screen.getByTestId('surface');
    act(() => { touch(el, 'touchstart', 100, 6); touch(el, 'touchmove', 100, 60); });
    expect(claimGestureAxis('horizontal')).toBe(false);
  });

  it('does nothing while disabled', () => {
    render(<Harness enabled={false} />);
    const el = screen.getByTestId('surface');
    act(() => { touch(el, 'touchstart', 100, 6); touch(el, 'touchmove', 100, 120); touch(el, 'touchend', 100, 120); });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('takes a mouse drag only under the touch-via-pointer flag', () => {
    const { unmount } = render(<Harness />);
    let el = screen.getByTestId('surface');
    act(() => { pointer(el, 'pointerdown', 100, 6, 1); pointer(el, 'pointermove', 100, 120, 1); pointer(el, 'pointerup', 100, 120, 0); });
    expect(onCommit).not.toHaveBeenCalled();
    unmount();

    render(<TouchViaPointerContext.Provider value={true}><Harness /></TouchViaPointerContext.Provider>);
    el = screen.getByTestId('surface');
    act(() => { pointer(el, 'pointerdown', 100, 6, 1); pointer(el, 'pointermove', 100, 120, 1); pointer(el, 'pointerup', 100, 120, 0); });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
