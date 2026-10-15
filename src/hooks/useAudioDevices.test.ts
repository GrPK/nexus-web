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

  it('ignores a read that left before the drop and returns after it', async () => {
    const fresh = {
      error: false, msg: '', outputs: [dev('a', 'output'), dev('b', 'output')], inputs: [], outputOrder: ['a', 'b'],
    };
    let releaseStale: (list: AudioDeviceList) => void = () => {};
    fetchAudioDevices.mockReset();
    fetchAudioDevices.mockResolvedValueOnce(fresh);
    const { result } = renderHook(() => useAudioDevices(true));
    await waitFor(() => expect(result.current.outputs).toHaveLength(2));

    fetchAudioDevices.mockReturnValueOnce(new Promise(resolve => { releaseStale = resolve; }));
    act(() => result.current.refresh());
    fetchAudioDevices.mockResolvedValue({ ...fresh, outputs: [dev('b', 'output'), dev('a', 'output')], outputOrder: ['b', 'a'] });
    act(() => result.current.reorderDevices('output', ['b', 'a']));
    await waitFor(() => expect(fetchAudioDevices).toHaveBeenCalledTimes(3));

    await act(async () => { releaseStale(fresh); });

    expect(result.current.outputs.map(d => d.id)).toEqual(['b', 'a']);
  });

  it('ignores a poll that lands while the order write is still pending', async () => {
    const fresh = {
      error: false, msg: '', outputs: [dev('a', 'output'), dev('b', 'output')], inputs: [], outputOrder: ['a', 'b'],
    };
    fetchAudioDevices.mockReset();
    fetchAudioDevices.mockResolvedValue(fresh);
    let finishWrite: () => void = () => {};
    setAudioDeviceOrder.mockReturnValueOnce(new Promise<null>(resolve => { finishWrite = () => resolve(null); }));
    const { result } = renderHook(() => useAudioDevices(true));
    await waitFor(() => expect(result.current.outputs).toHaveLength(2));

    act(() => result.current.reorderDevices('output', ['b', 'a']));
    // The service has not processed the write yet, so this read still has the old order.
    await act(async () => { result.current.refresh(); });
    expect(result.current.outputs.map(d => d.id)).toEqual(['b', 'a']);

    fetchAudioDevices.mockResolvedValue({ ...fresh, outputs: [dev('b', 'output'), dev('a', 'output')], outputOrder: ['b', 'a'] });
    await act(async () => { finishWrite(); });
    await waitFor(() => expect(fetchAudioDevices).toHaveBeenCalledTimes(3));
    expect(result.current.outputs.map(d => d.id)).toEqual(['b', 'a']);
  });

  it('does not read the list while disabled', async () => {
    const { result } = renderHook(() => useAudioDevices(false));
    act(() => result.current.refresh());
    expect(fetchAudioDevices).not.toHaveBeenCalled();
  });
});
