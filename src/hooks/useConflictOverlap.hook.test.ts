import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConflictOverlap } from './useConflictOverlap';
import type { DetectedConflict } from '../api/conflicts';
import type { DeviceListItem } from './useDevices';

let mockCurated: DeviceListItem[] = [];
let mockLoaded = true;
vi.mock('./useDevices', () => ({
  useDevices: () => ({ devices: mockCurated, loaded: mockLoaded, controlDevice: vi.fn() }),
}));

let mockLightingResult: { devices: unknown[] } | null = { devices: [] };
vi.mock('../api/lighting', () => ({
  fetchLightingDevices: () => Promise.resolve(mockLightingResult),
}));

const crate: DetectedConflict = { id: 'armoury-crate', displayName: 'Armoury Crate', category: 'lighting', processName: 'a', pid: 1, deviceOverlapKnown: true };

describe('useConflictOverlap', () => {
  beforeEach(() => {
    mockCurated = [];
    mockLoaded = true;
    mockLightingResult = { devices: [] };
  });

  it('hides a mapped app while the first read is in flight, then reports no overlap', async () => {
    const { result } = renderHook(() => useConflictOverlap(true));
    expect(result.current(crate)).toBe(false);
    await waitFor(() => expect(result.current(crate)).toBe(false));
  });

  it('alerts once the lighting read has loaded with a controlled card', async () => {
    mockLightingResult = { devices: [{ id: 'mb', controlled: true, conflictAppIds: ['armoury-crate'] }] };
    const { result } = renderHook(() => useConflictOverlap(true));
    await waitFor(() => expect(result.current(crate)).toBe(true));
  });

  it('alerts when the lighting read fails', async () => {
    mockLightingResult = null;
    const { result } = renderHook(() => useConflictOverlap(true));
    await waitFor(() => expect(result.current(crate)).toBe(true));
  });

  it('keeps an unmapped app alerting before any read', () => {
    const { result } = renderHook(() => useConflictOverlap(true));
    expect(result.current({ ...crate, deviceOverlapKnown: false })).toBe(true);
  });
});
