import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePillarsLatch } from './usePillarsLatch';

const ON = { lighting: true, cooling: true, monitoring: true, diagnostics: true };
const COOLING_OFF = { ...ON, cooling: false };

describe('usePillarsLatch', () => {
  it('ignores reports before the first onboarding read', () => {
    const { result } = renderHook(() => usePillarsLatch(0, true));
    act(() => result.current.report(ON));
    expect(result.current.pillars).toBeNull();
  });

  it('follows the choice while the welcome or features step is open', () => {
    const { result } = renderHook(() => usePillarsLatch(1, true));
    act(() => result.current.report(ON));
    act(() => result.current.report(COOLING_OFF));
    expect(result.current.pillars?.flags?.cooling).toBe(false);
  });

  it('freezes once those steps are past, so Cooling turned on later opens nothing', () => {
    const { result, rerender } = renderHook(({ early }) => usePillarsLatch(1, early), { initialProps: { early: true } });
    act(() => result.current.report(COOLING_OFF));
    rerender({ early: false });
    act(() => result.current.report(ON));
    expect(result.current.pillars?.flags?.cooling).toBe(false);
  });

  it('latches the first outcome even when no early step is open', () => {
    const { result } = renderHook(() => usePillarsLatch(1, false));
    act(() => result.current.report(COOLING_OFF));
    expect(result.current.pillars?.flags?.cooling).toBe(false);
  });

  it('decides afresh on a new onboarding read', () => {
    const { result, rerender } = renderHook(({ g }) => usePillarsLatch(g, false), { initialProps: { g: 1 } });
    act(() => result.current.report(COOLING_OFF));
    rerender({ g: 2 });
    act(() => result.current.report(ON));
    expect(result.current.pillars?.flags?.cooling).toBe(true);
  });

  it('records a failed preferences read as settled with unknown values', () => {
    const { result } = renderHook(() => usePillarsLatch(1, false));
    act(() => result.current.report(null));
    expect(result.current.pillars).toEqual({ flags: null });
  });
});
