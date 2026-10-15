import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePillarsLatch } from './usePillarsLatch';

const ON = { lighting: true, cooling: true, monitoring: true, diagnostics: true };
const COOLING_OFF = { ...ON, cooling: false };

describe('usePillarsLatch', () => {
  it('is unknown until the first report', () => {
    const { result } = renderHook(() => usePillarsLatch(true));
    expect(result.current.pillars).toBeNull();
  });

  it('follows the choice while the welcome or features step is open', () => {
    const { result } = renderHook(() => usePillarsLatch(true));
    act(() => result.current.report(ON));
    act(() => result.current.report(COOLING_OFF));
    expect(result.current.pillars?.cooling).toBe(false);
  });

  it('freezes once those steps are past, so Cooling turned on later opens nothing', () => {
    const { result, rerender } = renderHook(({ early }) => usePillarsLatch(early), { initialProps: { early: true } });
    act(() => result.current.report(COOLING_OFF));
    rerender({ early: false });
    act(() => result.current.report(ON));
    expect(result.current.pillars?.cooling).toBe(false);
  });

  it('decides once across a reconnect: a later report with Cooling on changes nothing', () => {
    const { result } = renderHook(() => usePillarsLatch(false));
    act(() => result.current.report(COOLING_OFF));
    act(() => result.current.report(ON));
    expect(result.current.pillars?.cooling).toBe(false);
  });
});
