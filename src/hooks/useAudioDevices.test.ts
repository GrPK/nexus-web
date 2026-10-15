// A drag rewrites the saved order of the visible devices only; ids of devices
// that are unplugged must survive the write.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { AudioDeviceList } from '../api/mixer';
import { useAudioDevices } from './useAudioDevices';

const fetchAudioDevices = vi.fn<() => Promise<AudioDeviceList | null>>();
const setAudioDeviceOrder = vi.fn<(direction: string, ids: string[]) => Promise<null>>(() => Promise.resolve(null));

vi.mock('../api/mixer', () => ({
  fetchAudioDevices: () => fetchAudioDevices(),
  setAudioDeviceOrder: (direction: string, ids: string[]) => setAudioDeviceOrder(direction, ids),
  setDefaultOutput: vi.fn(),
  setDefaultInput: vi.fn(),
  setSpatialSound: vi.fn(),
}));

const dev = (id: string, direction: string) => ({ id, name: id, isDefault: false, direction });

beforeEach(() => {
  vi.clearAllMocks();
  fetchAudioDevices.mockResolvedValue({
    error: false,
    msg: '',
    outputs: [dev('a', 'output'), dev('b', 'output')],
    inputs: [],
    outputOrder: ['a', 'gone', 'b'],
  });
});

describe('useAudioDevices reorderDevices', () => {
  it('saves the dragged order with the unplugged id kept in its slot', async () => {
    const { result } = renderHook(() => useAudioDevices(true));
    await waitFor(() => expect(result.current.outputs).toHaveLength(2));

    act(() => result.current.reorderDevices('output', ['b', 'a']));

    expect(setAudioDeviceOrder).toHaveBeenCalledWith('output', ['b', 'gone', 'a']);
    expect(result.current.outputs.map(d => d.id)).toEqual(['b', 'a']);
    await waitFor(() => expect(fetchAudioDevices).toHaveBeenCalledTimes(2));
  });
});
