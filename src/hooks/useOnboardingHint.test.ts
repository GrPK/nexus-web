import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { resetOnboardingHintSession, useOnboardingHint } from './useOnboardingHint';

type Status = { completed: boolean; dismissedHints?: string[] } | null;
let status: Status = null;
type Dismissal = { status: number; body: Status };
let dismissImpl: (id: string) => Promise<Dismissal> = async () => ({ status: 200, body: status });
let statusImpl: () => Promise<Status> = async () => status;

vi.mock('../api/onboarding', () => ({
  fetchOnboardingStatus: vi.fn(() => statusImpl()),
  dismissOnboardingHint: vi.fn((id: string) => dismissImpl(id)),
}));

import { dismissOnboardingHint, fetchOnboardingStatus } from '../api/onboarding';

const PENDING = 'nexus.onboarding.pendingHints';
const REFUSED = 'nexus.onboarding.refusedHints';
// Forgets the in-memory session only, as a new launch would, keeping storage.
const resetSessionOnly = () => {
  const keep = { p: localStorage.getItem(PENDING), r: localStorage.getItem(REFUSED) };
  resetOnboardingHintSession();
  if (keep.p) localStorage.setItem(PENDING, keep.p);
  if (keep.r) localStorage.setItem(REFUSED, keep.r);
};
const stored = () => JSON.parse(localStorage.getItem(PENDING) ?? '[]') as string[];
/** Lets the hook's GET settle without a timer. */
const settled = () => act(async () => { await vi.mocked(fetchOnboardingStatus).mock.results.at(-1)?.value; });

describe('useOnboardingHint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOnboardingHintSession();
    status = { completed: true, dismissedHints: [] };
    dismissImpl = async () => ({ status: 200, body: status });
    statusImpl = async () => status;
  });
  afterEach(() => vi.restoreAllMocks());

  it('is unknown until the service answers, then reads the id from dismissedHints', async () => {
    const { result } = renderHook(() => useOnboardingHint('a-hint'));
    expect(result.current.dismissed).toBeNull();
    await waitFor(() => expect(result.current.dismissed).toBe(false));
  });

  it('reads a listed id as dismissed', async () => {
    status = { completed: true, dismissedHints: ['a-hint', 'other'] };
    const { result } = renderHook(() => useOnboardingHint('a-hint'));
    await waitFor(() => expect(result.current.dismissed).toBe(true));
  });

  it('never shows on a service without the hints list', async () => {
    status = { completed: true };
    const { result } = renderHook(() => useOnboardingHint('a-hint'));
    await waitFor(() => expect(result.current.dismissed).toBe(true));
  });

  it('stays unknown when the service is unreachable', async () => {
    status = null;
    const { result } = renderHook(() => useOnboardingHint('a-hint'));
    await settled();
    expect(result.current.dismissed).toBeNull();
  });

  it('dismisses optimistically, before the POST settles', async () => {
    let finish: (v: Dismissal) => void = () => {};
    dismissImpl = () => new Promise(r => { finish = r; });
    const { result } = renderHook(() => useOnboardingHint('a-hint'));
    await waitFor(() => expect(result.current.dismissed).toBe(false));
    act(() => result.current.dismiss());
    expect(result.current.dismissed).toBe(true);
    expect(dismissOnboardingHint).toHaveBeenCalledWith('a-hint');
    await act(async () => { finish({ status: 200, body: { completed: true, dismissedHints: ['a-hint'] } }); await Promise.resolve(); });
    expect(result.current.dismissed).toBe(true);
    await waitFor(() => expect(stored()).toEqual([]));
  });

  it.each([
    ['an unreachable service', async () => ({ status: 0, body: null })],
    ['a server error', async () => ({ status: 500, body: null })],
    ['a rejected POST', async () => { throw new Error('offline'); }],
    ['an answer that does not list the id', async () => ({ status: 200, body: { completed: true, dismissedHints: [] } })],
  ])('keeps the hint hidden and queued after %s', async (_name, impl) => {
    dismissImpl = impl;
    const { result } = renderHook(() => useOnboardingHint('a-hint'));
    await waitFor(() => expect(result.current.dismissed).toBe(false));
    act(() => result.current.dismiss());
    await waitFor(() => expect(dismissOnboardingHint).toHaveBeenCalledTimes(1));
    expect(result.current.dismissed).toBe(true);
    expect(stored()).toEqual(['a-hint']);
    // A remount in the same session does not bring it back.
    const again = renderHook(() => useOnboardingHint('a-hint'));
    expect(again.result.current.dismissed).toBe(true);
  });

  it('retries a queued dismissal on a later launch until the service confirms', async () => {
    localStorage.setItem(PENDING, JSON.stringify(['a-hint']));
    dismissImpl = async () => ({ status: 200, body: { completed: true, dismissedHints: ['a-hint'] } });
    const { result } = renderHook(() => useOnboardingHint('a-hint'));
    // The service never stored it, yet the hint stays closed and the POST is retried.
    await waitFor(() => expect(result.current.dismissed).toBe(true));
    await waitFor(() => expect(dismissOnboardingHint).toHaveBeenCalledWith('a-hint'));
    await waitFor(() => expect(stored()).toEqual([]));
  });

  it('drops a queued id the service already lists, without re-sending it', async () => {
    localStorage.setItem(PENDING, JSON.stringify(['a-hint']));
    status = { completed: true, dismissedHints: ['a-hint'] };
    renderHook(() => useOnboardingHint('a-hint'));
    await waitFor(() => expect(stored()).toEqual([]));
    expect(dismissOnboardingHint).not.toHaveBeenCalled();
  });

  it('keeps a queued id while the retry is still refused', async () => {
    localStorage.setItem(PENDING, JSON.stringify(['a-hint']));
    dismissImpl = async () => ({ status: 0, body: null });
    renderHook(() => useOnboardingHint('a-hint'));
    await waitFor(() => expect(dismissOnboardingHint).toHaveBeenCalledTimes(1));
    expect(stored()).toEqual(['a-hint']);
  });

  it('survives storage that throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const { result } = renderHook(() => useOnboardingHint('a-hint'));
    await waitFor(() => expect(result.current.dismissed).toBe(false));
    act(() => result.current.dismiss());
    expect(result.current.dismissed).toBe(true);
  });

  it.each([400, 409])('stops retrying an id refused with %i but keeps it hidden from then on', async code => {
    dismissImpl = async () => ({ status: code, body: null });
    const first = renderHook(() => useOnboardingHint('a-hint'));
    await waitFor(() => expect(first.result.current.dismissed).toBe(false));
    act(() => first.result.current.dismiss());
    await waitFor(() => expect(JSON.parse(localStorage.getItem(REFUSED) ?? '[]')).toEqual(['a-hint']));
    expect(stored()).toEqual([]);
    first.unmount();
    // A later launch: the service still does not list it, and nothing is re-sent.
    resetSessionOnly();
    vi.mocked(dismissOnboardingHint).mockClear();
    const next = renderHook(() => useOnboardingHint('a-hint'));
    await waitFor(() => expect(next.result.current.dismissed).toBe(true));
    expect(dismissOnboardingHint).not.toHaveBeenCalled();
  });

  it('does not re-send a pending id that is already refused', async () => {
    localStorage.setItem(PENDING, JSON.stringify(['a-hint']));
    localStorage.setItem(REFUSED, JSON.stringify(['a-hint']));
    renderHook(() => useOnboardingHint('a-hint'));
    await settled();
    expect(dismissOnboardingHint).not.toHaveBeenCalled();
  });

  it('absorbs a rejected status read', async () => {
    statusImpl = async () => { throw new Error('bad json'); };
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const { result } = renderHook(() => useOnboardingHint('a-hint'));
    await act(async () => { await new Promise(r => setImmediate(r)); });
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(result.current.dismissed).toBeNull();
  });
});
