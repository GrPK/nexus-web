import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PanelScreenSleep } from './PanelScreenSleep';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('PanelScreenSleep', () => {
  it('renders nothing while awake', () => {
    const { container } = render(<PanelScreenSleep asleep={false} onWakeStart={vi.fn()} onWake={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('wakes on release, not on press', () => {
    const onWakeStart = vi.fn();
    render(<PanelScreenSleep asleep onWakeStart={onWakeStart} onWake={vi.fn()} />);
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
        <PanelScreenSleep asleep onWakeStart={vi.fn()} onWake={onWake} />
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
});
