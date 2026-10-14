import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLatestWriter } from './useLatestWriter';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('useLatestWriter', () => {
  it('sends the first value at once, coalesces the drag to the newest, and flushes on release', async () => {
    const send = vi.fn(() => Promise.resolve(null));
    const { result } = renderHook(() => useLatestWriter(send, 100));
    await act(async () => { result.current(10); });
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => { result.current(20); result.current(30); });
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(120); });
    expect(send).toHaveBeenLastCalledWith(30);
    expect(send).toHaveBeenCalledTimes(2);
    await act(async () => { result.current(40, true); });
    expect(send).toHaveBeenLastCalledWith(40);
  });
});

describe('useLatestWriter unmount', () => {
  it('does not start another write from an in-flight request that settles after unmount', async () => {
    let settle: () => void = () => {};
    const send = vi.fn(() => new Promise<null>(r => { settle = () => r(null); }));
    const { result, unmount } = renderHook(() => useLatestWriter(send, 100));
    await act(async () => { result.current(1); });
    await act(async () => { result.current(2); });
    unmount();
    await act(async () => { settle(); vi.advanceTimersByTime(500); });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
