import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PanelScreenSleep } from './PanelScreenSleep';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('PanelScreenSleep', () => {
  it('renders nothing while awake', () => {
    const { container } = render(<PanelScreenSleep asleep={false} onSleepFaded={vi.fn()} onWakeStart={vi.fn()} onWake={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('wakes on release, not on press', () => {
    const onWakeStart = vi.fn();
    render(<PanelScreenSleep asleep onSleepFaded={vi.fn()} onWakeStart={onWakeStart} onWake={vi.fn()} />);
    const layer = screen.getByRole('button');
    fireEvent.pointerDown(layer);
    expect(onWakeStart).not.toHaveBeenCalled();
    fireEvent.pointerUp(layer);
    expect(onWakeStart).toHaveBeenCalledTimes(1);
  });

  it('swallows a long hold: its context menu, release and click never reach what is under', () => {
    const onWake = vi.fn();
    const underneath = vi.fn();
    render(
      <div onClick={underneath} onContextMenu={underneath} onPointerUp={underneath}>
        <PanelScreenSleep asleep onSleepFaded={vi.fn()} onWakeStart={vi.fn()} onWake={onWake} />
      </div>,
    );
    const layer = screen.getByRole('button');
    fireEvent.pointerDown(layer);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(onWake).not.toHaveBeenCalled();
    expect(fireEvent.contextMenu(layer)).toBe(false);
    fireEvent.pointerUp(layer);
    // The click lands well after release; the layer is still up to take it.
    act(() => { vi.advanceTimersByTime(300); });
    expect(onWake).not.toHaveBeenCalled();
    fireEvent.click(layer);
    expect(underneath).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(onWake).toHaveBeenCalledTimes(1);
  });

  it('fades in to black, then reports the fade finished exactly once on transitionend', () => {
    const onSleepFaded = vi.fn();
    render(<PanelScreenSleep asleep onSleepFaded={onSleepFaded} onWakeStart={vi.fn()} onWake={vi.fn()} />);
    const layer = screen.getByRole('button');
    // Mounted transparent, so the first frame has something to fade from.
    expect(layer).not.toHaveAttribute('data-entered');
    act(() => { vi.advanceTimersByTime(50); });
    expect(layer).toHaveAttribute('data-entered', 'true');
    expect(onSleepFaded).not.toHaveBeenCalled();
    fireEvent.transitionEnd(layer);
    expect(onSleepFaded).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onSleepFaded).toHaveBeenCalledTimes(1);
  });

  it('falls back to a timer when no transition end arrives, so the panel is never left half-faded', () => {
    const onSleepFaded = vi.fn();
    render(<PanelScreenSleep asleep onSleepFaded={onSleepFaded} onWakeStart={vi.fn()} onWake={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(300); });
    expect(onSleepFaded).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(400); });
    expect(onSleepFaded).toHaveBeenCalledTimes(1);
  });

  it('a touch released during the fade-in wakes, swallows the click, and never hides the panel', () => {
    const onSleepFaded = vi.fn();
    const onWakeStart = vi.fn();
    const underneath = vi.fn();
    render(
      <div onClick={underneath}>
        <PanelScreenSleep asleep onSleepFaded={onSleepFaded} onWakeStart={onWakeStart} onWake={vi.fn()} />
      </div>,
    );
    const layer = screen.getByRole('button');
    act(() => { vi.advanceTimersByTime(40); });
    fireEvent.pointerDown(layer);
    fireEvent.pointerUp(layer);
    fireEvent.click(layer);
    expect(onWakeStart).toHaveBeenCalledTimes(1);
    expect(underneath).not.toHaveBeenCalled();
    fireEvent.transitionEnd(layer);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onSleepFaded).not.toHaveBeenCalled();
  });
});
