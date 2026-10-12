import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGlobalColor } from './useGlobalColor';

// A promise the test settles by hand.
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}

describe('useGlobalColor', () => {
  it('lands a reply when nothing happened since it was asked', () => {
    const { result } = renderHook(() => useGlobalColor());
    const land = result.current[2]();
    act(() => land('#112233'));
    expect(result.current[0]).toBe('#112233');
  });

  it('drops a reply asked before a local change', () => {
    const { result } = renderHook(() => useGlobalColor());
    const land = result.current[2]();
    act(() => result.current[1]('#abcdef'));
    act(() => land('#112233'));
    expect(result.current[0]).toBe('#abcdef');
  });

  it('drops an older reply that resolves after a newer one landed', () => {
    const { result } = renderHook(() => useGlobalColor());
    const older = result.current[2]();
    const newer = result.current[2]();
    act(() => newer('#222222'));
    act(() => older('#111111'));
    expect(result.current[0]).toBe('#222222');
  });

  it('lands an earlier reply when a later fetch never answers', () => {
    const { result } = renderHook(() => useGlobalColor());
    const earlier = result.current[2]();
    result.current[2]();
    act(() => earlier('#111111'));
    expect(result.current[0]).toBe('#111111');
  });

  it('drops a reply asked while a local write is in flight, and lands one asked after it settles', async () => {
    const { result } = renderHook(() => useGlobalColor());
    const write = deferred();
    act(() => result.current[1]('#abcdef', write.promise));
    const during = result.current[2]();
    act(() => during('#112233'));
    expect(result.current[0]).toBe('#abcdef');
    await act(async () => { write.resolve(); await write.promise; });
    const after = result.current[2]();
    act(() => after('#abcdef'));
    expect(result.current[0]).toBe('#abcdef');
    const next = result.current[2]();
    act(() => next('#000000'));
    expect(result.current[0]).toBe('#000000');
  });
});
