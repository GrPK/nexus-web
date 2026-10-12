import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPins, setPins, type Pin } from '../../../../api/lighting';
import { usePins } from './usePins';

vi.mock('../../../../api/lighting', () => ({
  fetchPins: vi.fn(),
  setPins: vi.fn(),
}));

const plasma: Pin = { kind: 'animate', effect: 'plasma' };
const aurora: Pin = { kind: 'animate', effect: 'aurora' };

// A promise the test settles by hand.
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.mocked(fetchPins).mockReset();
  vi.mocked(setPins).mockReset();
});

describe('usePins refresh ordering', () => {
  it('drops an answer older than the latest refetch', async () => {
    const slow = deferred<Record<string, Pin> | null>();
    vi.mocked(fetchPins).mockReturnValueOnce(slow.promise).mockResolvedValueOnce({ a: aurora });
    const { result } = renderHook(() => usePins());

    let first!: Promise<void>;
    act(() => { first = result.current.refresh(); });
    await act(async () => { await result.current.refresh(); });
    expect(result.current.pins).toEqual({ a: aurora });

    await act(async () => { slow.resolve({ a: plasma }); await first; });
    expect(result.current.pins).toEqual({ a: aurora });
  });

  it('drops an answer that a write overtook while it was in flight', async () => {
    const stale = deferred<Record<string, Pin> | null>();
    vi.mocked(fetchPins).mockReturnValueOnce(stale.promise);
    vi.mocked(setPins).mockResolvedValue(true);
    const { result } = renderHook(() => usePins());

    let refreshing!: Promise<void>;
    act(() => { refreshing = result.current.refresh(); });
    await act(async () => { await result.current.applyPins(['a'], aurora); });
    // The read began before the write landed, so it still says "no pin".
    await act(async () => { stale.resolve({}); await refreshing; });
    expect(result.current.pins).toEqual({ a: aurora });
  });

  it('keeps a pending write through a refetch that began after it', async () => {
    const write = deferred<boolean>();
    vi.mocked(setPins).mockReturnValue(write.promise);
    vi.mocked(fetchPins).mockResolvedValue({});
    const { result } = renderHook(() => usePins());

    let writing!: Promise<boolean>;
    act(() => { writing = result.current.applyPins(['a'], plasma); });
    await act(async () => { await result.current.refresh(); });
    expect(result.current.pins).toEqual({ a: plasma });

    await act(async () => { write.resolve(true); await writing; });
    expect(result.current.pins).toEqual({ a: plasma });
  });
});

describe('usePins rollback', () => {
  it('puts back what the service last confirmed when the only write fails', async () => {
    vi.mocked(fetchPins).mockResolvedValue({ a: plasma });
    vi.mocked(setPins).mockResolvedValue(false);
    const { result } = renderHook(() => usePins());
    await act(async () => { await result.current.refresh(); });

    await act(async () => { await result.current.applyPins(['a'], aurora); });
    expect(result.current.pins).toEqual({ a: plasma });
  });

  it('does not roll back over a newer write that is still in flight', async () => {
    const first = deferred<boolean>();
    const second = deferred<boolean>();
    vi.mocked(setPins).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => usePins());

    let a!: Promise<boolean>;
    let b!: Promise<boolean>;
    act(() => { a = result.current.applyPins(['x'], plasma); });
    act(() => { b = result.current.applyPins(['x'], aurora); });
    await act(async () => { first.resolve(false); await a; });
    // The older write failed, but the newer one owns the card.
    expect(result.current.pins).toEqual({ x: aurora });

    await act(async () => { second.resolve(true); await b; });
    expect(result.current.pins).toEqual({ x: aurora });
  });

  it('a failing newer write restores what was confirmed, not the older write\'s optimistic value', async () => {
    const first = deferred<boolean>();
    const second = deferred<boolean>();
    vi.mocked(setPins).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => usePins());

    let a!: Promise<boolean>;
    let b!: Promise<boolean>;
    act(() => { a = result.current.applyPins(['x'], plasma); });
    act(() => { b = result.current.applyPins(['x'], aurora); });
    await act(async () => { first.resolve(true); await a; });
    await act(async () => { second.resolve(false); await b; });
    expect(result.current.pins).toEqual({ x: plasma });
  });

  it('only rolls back the ids it is the newest write for', async () => {
    const first = deferred<boolean>();
    vi.mocked(setPins).mockReturnValueOnce(first.promise).mockResolvedValueOnce(true);
    const { result } = renderHook(() => usePins());

    let a!: Promise<boolean>;
    act(() => { a = result.current.applyPins(['x', 'y'], plasma); });
    await act(async () => { await result.current.applyPins(['y'], aurora); });
    await act(async () => { first.resolve(false); await a; });
    expect(result.current.pins).toEqual({ y: aurora });
  });
});
