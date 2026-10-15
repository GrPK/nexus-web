// A cancelled touch must still close the drag bookkeeping: the widget only
// clears its dragging flag and queues the final write from the slider's commit.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { DisplayListResponse } from '../../../api/displays';
import type { PanelWidget } from '../../types';
import { DisplaysWidget } from './DisplaysWidget';

const setDisplayBrightness = vi.fn(() => Promise.resolve(null));
// What the monitor reports; the test changes it behind the widget's back.
let serverCurrent = 20;

vi.mock('../../../api/displays', () => ({
  fetchDisplays: () => Promise.resolve({
    error: false,
    msg: '',
    hint: '',
    displays: [{
      id: 'd-0', name: 'Monitor 0', manufacturer: 'Acme', model: 'M0', isInternal: false, isDdcCapable: true,
      brightnessControl: { supported: true, current: serverCurrent, writeMode: 'ddc', controlPath: '', unsupportedReason: '' },
    }],
  } as unknown as DisplayListResponse),
  fetchDisplayBrightness: () => Promise.resolve(null),
  setDisplayBrightness: (...a: unknown[]) => (setDisplayBrightness as (...x: unknown[]) => unknown)(...a),
}));

beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});
beforeEach(() => { vi.clearAllMocks(); serverCurrent = 20; vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('DisplaysWidget slider cancel', () => {
  it('releases the drag, so a later refresh takes the monitor value again', async () => {
    const widget: PanelWidget = { id: 'd1', type: 'displays', size: '4x2', col: 0, row: 0, config: {} };
    render(<DisplaysWidget widget={widget} surface="y70" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    const track = screen.getByRole('slider');
    track.getBoundingClientRect = () => ({ x: 0, y: 100, top: 100, left: 0, right: 40, bottom: 200, width: 40, height: 100, toJSON: () => {} });
    const hitbox = track.parentElement as HTMLElement;
    fireEvent.pointerDown(hitbox, { clientY: 150, pointerId: 1 });
    fireEvent.pointerCancel(hitbox, { clientY: 0, pointerId: 1 });
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '50');
    // The monitor settles elsewhere; past the optimistic window the next
    // refresh must show it. A stranded drag flag would keep skipping the display.
    serverCurrent = 80;
    await act(async () => { await vi.advanceTimersByTimeAsync(7000); });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '80');
  });
});
