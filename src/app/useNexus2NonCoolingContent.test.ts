import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNexus2NonCoolingContent } from './useNexus2NonCoolingContent';
import { previewNexus2Import } from '../api/migration';

vi.mock('../api/migration', () => ({ previewNexus2Import: vi.fn() }));

const FAN = { id: 'fanCurves' as const, available: true, count: 1, otherProfiles: 0, fanCurves: [] };
const APPEARANCE = { id: 'appearance' as const, available: true, accentColor: '#fff', background: null };

describe('useNexus2NonCoolingContent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('answers true without asking while not needed', () => {
    const { result } = renderHook(() => useNexus2NonCoolingContent(false));
    expect(result.current).toBe(true);
    expect(previewNexus2Import).not.toHaveBeenCalled();
  });

  it('is false when only fan curves are importable', async () => {
    vi.mocked(previewNexus2Import).mockResolvedValue({ available: true, profileName: null, categories: [FAN] });
    const { result } = renderHook(() => useNexus2NonCoolingContent(true));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('is true when other groups are importable too', async () => {
    vi.mocked(previewNexus2Import).mockResolvedValue({ available: true, profileName: null, categories: [FAN, APPEARANCE] });
    const { result } = renderHook(() => useNexus2NonCoolingContent(true));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('is true when the preview cannot be read', async () => {
    vi.mocked(previewNexus2Import).mockResolvedValue(null);
    const { result } = renderHook(() => useNexus2NonCoolingContent(true));
    await waitFor(() => expect(result.current).toBe(true));
  });
});
