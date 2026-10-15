import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePillarsLatch } from './usePillarsLatch';

const ON = { lighting: true, cooling: true, monitoring: true, diagnostics: true };
const COOLING_OFF = { ...ON, cooling: false };

describe('usePillarsLatch', () => {
  it('is unknown until the first report', () => {
    const { result } = renderHook(() => usePillarsLatch(true, false));
    expect(result.current.pillars).toBeNull();
  });

  it('follows the choice while the welcome or features step is open', () => {
    const { result } = renderHook(() => usePillarsLatch(true, false));
    act(() => result.current.report(ON, true));
    act(() => result.current.report(COOLING_OFF, true));
    expect(result.current.pillars?.cooling).toBe(false);
  });

  it('freezes once those steps are past, so Cooling turned on later opens nothing', () => {
    const { result, rerender } = renderHook(({ early }) => usePillarsLatch(early, false), { initialProps: { early: true } });
    act(() => result.current.report(COOLING_OFF, true));
    rerender({ early: false });
    act(() => result.current.report(ON, true));
    expect(result.current.pillars?.cooling).toBe(false);
  });

  it('decides once across a reconnect: a later report with Cooling on changes nothing', () => {
    const { result } = renderHook(() => usePillarsLatch(false, false));
    act(() => result.current.report(COOLING_OFF, true));
    act(() => result.current.report(ON, true));
    expect(result.current.pillars?.cooling).toBe(false);
  });

  it('records whether the decided values came from the server', () => {
    const { result } = renderHook(() => usePillarsLatch(false, false));
    act(() => result.current.report(COOLING_OFF, false));
    expect(result.current.hydrated).toBe(false);
  });

  it('stays ready once the service was seen down, even after it comes back before values arrive', () => {
    const { result, rerender } = renderHook(({ down }) => usePillarsLatch(true, down), { initialProps: { down: true } });
    expect(result.current.ready).toBe(true);
    rerender({ down: false });
    expect(result.current.pillars).toBeNull();
    expect(result.current.ready).toBe(true);
  });

  it('is not ready before values or a down service', () => {
    const { result } = renderHook(() => usePillarsLatch(true, false));
    expect(result.current.ready).toBe(false);
  });
});
