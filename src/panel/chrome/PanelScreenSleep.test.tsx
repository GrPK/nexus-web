import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PanelScreenSleep } from './PanelScreenSleep';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('PanelScreenSleep', () => {
  it('renders nothing while awake', () => {
    const { container } = render(<PanelScreenSleep asleep={false} onWake={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('wakes on any touch, keeps swallowing the follow-up events, then releases', () => {
    const onWake = vi.fn();
    const underneath = vi.fn();
    render(
      <div onClick={underneath} onPointerUp={underneath}>
        <PanelScreenSleep asleep onWake={onWake} />
      </div>,
    );
    const layer = screen.getByRole('button');
    fireEvent.pointerDown(layer);
    expect(layer).toHaveAttribute('data-waking', 'true');
    expect(onWake).not.toHaveBeenCalled();
    fireEvent.pointerUp(layer);
    fireEvent.click(layer);
    expect(underneath).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(450); });
    expect(onWake).toHaveBeenCalledTimes(1);
  });
});
