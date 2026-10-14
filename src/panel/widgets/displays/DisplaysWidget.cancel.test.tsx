// A cancelled touch must still close the drag bookkeeping: the widget only
// clears its dragging flag and queues the final write from the slider's commit.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DisplayListResponse } from '../../../api/displays';
import type { PanelWidget } from '../../types';
import { DisplaysWidget } from './DisplaysWidget';

const setDisplayBrightness = vi.fn(() => Promise.resolve(null));

vi.mock('../../../api/displays', () => ({
  fetchDisplays: () => Promise.resolve({
    error: false,
    msg: '',
    hint: '',
    displays: [{
      id: 'd-0', name: 'Monitor 0', manufacturer: 'Acme', model: 'M0', isInternal: false, isDdcCapable: true,
      brightnessControl: { supported: true, current: 20, writeMode: 'ddc', controlPath: '', unsupportedReason: '' },
    }],
  } as unknown as DisplayListResponse),
  fetchDisplayBrightness: () => Promise.resolve(null),
  setDisplayBrightness: (...a: unknown[]) => (setDisplayBrightness as (...x: unknown[]) => unknown)(...a),
}));

beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});
beforeEach(() => vi.clearAllMocks());

describe('DisplaysWidget slider cancel', () => {
  it('writes the level the press set and releases the drag, instead of stranding the display', async () => {
    const widget: PanelWidget = { id: 'd1', type: 'displays', size: '4x2', col: 0, row: 0, config: {} };
    render(<DisplaysWidget widget={widget} surface="y70" />);
    const track = await screen.findByRole('slider');
    track.getBoundingClientRect = () => ({ x: 0, y: 100, top: 100, left: 0, right: 40, bottom: 200, width: 40, height: 100, toJSON: () => {} });
    const hitbox = track.parentElement as HTMLElement;
    fireEvent.pointerDown(hitbox, { clientY: 150, pointerId: 1 });
    fireEvent.pointerCancel(hitbox, { clientY: 0, pointerId: 1 });
    await waitFor(() => expect(setDisplayBrightness).toHaveBeenCalled());
    const calls = setDisplayBrightness.mock.calls as unknown as Array<[string, number]>;
    expect(calls.every(c => c[1] === 50)).toBe(true);
  });
});
