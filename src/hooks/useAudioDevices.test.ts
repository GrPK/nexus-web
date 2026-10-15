// A drag rewrites the saved order of the visible devices only; ids of devices
// that are unplugged must survive the write.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  describe('write hold', () => {
    const fresh = () => ({
      error: false, msg: '', outputs: [dev('a', 'output'), dev('b', 'output')], inputs: [], outputOrder: ['a', 'b'],
    });
    const deferred = () => {
      let resolve: (v: null) => void = () => {};
      let reject: (e: unknown) => void = () => {};
      const promise = new Promise<null>((res, rej) => { resolve = res; reject = rej; });
      return { promise, resolve, reject };
    };

    afterEach(() => { vi.useRealTimers(); });

    it('re-reads once, after the last of two overlapping writes settles', async () => {
      fetchAudioDevices.mockReset();
      fetchAudioDevices.mockResolvedValue(fresh());
      const first = deferred();
      const second = deferred();
      setAudioDeviceOrder.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const { result } = renderHook(() => useAudioDevices(true));
      await waitFor(() => expect(result.current.outputs).toHaveLength(2));
      fetchAudioDevices.mockClear();

      act(() => result.current.reorderDevices('output', ['b', 'a']));
      act(() => result.current.reorderDevices('output', ['a', 'b']));
      await act(async () => { first.resolve(null); });
      expect(fetchAudioDevices).not.toHaveBeenCalled();

      await act(async () => { second.resolve(null); });
      await waitFor(() => expect(fetchAudioDevices).toHaveBeenCalledTimes(1));
    });

    it('releases the hold when the write rejects', async () => {
      fetchAudioDevices.mockReset();
      fetchAudioDevices.mockResolvedValue(fresh());
      const write = deferred();
      setAudioDeviceOrder.mockReturnValueOnce(write.promise);
      const { result } = renderHook(() => useAudioDevices(true));
      await waitFor(() => expect(result.current.outputs).toHaveLength(2));
      fetchAudioDevices.mockClear();

      act(() => result.current.reorderDevices('output', ['b', 'a']));
      await act(async () => { write.reject(new Error('down')); });

      await waitFor(() => expect(fetchAudioDevices).toHaveBeenCalledTimes(1));
    });

    it('lifts the hold on timeout, then corrects a stale landing once the write settles', async () => {
      fetchAudioDevices.mockReset();
      fetchAudioDevices.mockResolvedValue(fresh());
      const write = deferred();
      setAudioDeviceOrder.mockReturnValueOnce(write.promise);
      const { result } = renderHook(() => useAudioDevices(true));
      await waitFor(() => expect(result.current.outputs).toHaveLength(2));
      vi.useFakeTimers();

      act(() => result.current.reorderDevices('output', ['b', 'a']));
      await act(async () => { await vi.advanceTimersByTimeAsync(4100); });
      await act(async () => { result.current.refresh(); });
      expect(result.current.outputs.map(d => d.id)).toEqual(['a', 'b']);

      fetchAudioDevices.mockResolvedValue({ ...fresh(), outputs: [dev('b', 'output'), dev('a', 'output')], outputOrder: ['b', 'a'] });
      await act(async () => { write.resolve(null); });
      expect(result.current.outputs.map(d => d.id)).toEqual(['b', 'a']);
    });

    it('clears hold timers and skips the re-read after unmount', async () => {
      fetchAudioDevices.mockReset();
      fetchAudioDevices.mockResolvedValue(fresh());
      const write = deferred();
      setAudioDeviceOrder.mockReturnValueOnce(write.promise);
      const { result, unmount } = renderHook(() => useAudioDevices(true));
      await waitFor(() => expect(result.current.outputs).toHaveLength(2));
      vi.useFakeTimers();

      act(() => result.current.reorderDevices('output', ['b', 'a']));
      fetchAudioDevices.mockClear();
      unmount();
      await act(async () => { await vi.advanceTimersByTimeAsync(4100); write.resolve(null); });

      expect(fetchAudioDevices).not.toHaveBeenCalled();
    });

    it('keeps holding for a later write when a pre-disable write settles after re-enable', async () => {
      fetchAudioDevices.mockReset();
      fetchAudioDevices.mockResolvedValue(fresh());
      const early = deferred();
      const later = deferred();
      setAudioDeviceOrder.mockReturnValueOnce(early.promise).mockReturnValueOnce(later.promise);
      const { result, rerender } = renderHook(({ on }) => useAudioDevices(on), { initialProps: { on: true } });
      await waitFor(() => expect(result.current.outputs).toHaveLength(2));

      act(() => result.current.reorderDevices('output', ['b', 'a']));
      rerender({ on: false });
      rerender({ on: true });
      await waitFor(() => expect(result.current.outputs).toHaveLength(2));
      act(() => result.current.reorderDevices('output', ['b', 'a']));
      fetchAudioDevices.mockClear();

      await act(async () => { early.resolve(null); });
      expect(fetchAudioDevices).not.toHaveBeenCalled();
      // The later write still holds polls, so an old-order read must not land.
      await act(async () => { result.current.refresh(); });
      expect(result.current.outputs.map(d => d.id)).toEqual(['b', 'a']);

      fetchAudioDevices.mockResolvedValue({ ...fresh(), outputs: [dev('b', 'output'), dev('a', 'output')], outputOrder: ['b', 'a'] });
      await act(async () => { later.resolve(null); });
      expect(result.current.outputs.map(d => d.id)).toEqual(['b', 'a']);
      expect(fetchAudioDevices).toHaveBeenCalledTimes(2);
    });

    it('fetches again as soon as it is re-enabled', async () => {
      fetchAudioDevices.mockReset();
      fetchAudioDevices.mockResolvedValue(fresh());
      const { result, rerender } = renderHook(({ on }) => useAudioDevices(on), { initialProps: { on: false } });
      expect(fetchAudioDevices).not.toHaveBeenCalled();

      rerender({ on: true });

      await waitFor(() => expect(result.current.outputs).toHaveLength(2));
      expect(fetchAudioDevices).toHaveBeenCalledTimes(1);
    });
  });
});
