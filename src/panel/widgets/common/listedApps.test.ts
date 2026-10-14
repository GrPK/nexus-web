import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../api/service', () => ({ fetchService: vi.fn() }));

import { fetchService } from '../../../api/service';
import { ensureListedAppIds, getListedAppIds, resetListedAppIdsForTest } from './listedApps';

describe('listedApps cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetListedAppIdsForTest();
    vi.mocked(fetchService).mockReset().mockResolvedValue({ shortcuts: [{ id: 'a' }] });
  });
  afterEach(() => vi.useRealTimers());

  it('loads once, then refetches after the TTL while serving the stale set meanwhile', async () => {
    await ensureListedAppIds();
    await ensureListedAppIds();
    expect(fetchService).toHaveBeenCalledTimes(1);
    expect(getListedAppIds()?.has('a')).toBe(true);
    vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);
    expect(getListedAppIds()?.has('a')).toBe(true);
    await ensureListedAppIds();
    expect(fetchService).toHaveBeenCalledTimes(2);
  });

  it('stays null when the load fails', async () => {
    vi.mocked(fetchService).mockResolvedValue(null);
    await ensureListedAppIds();
    expect(getListedAppIds()).toBeNull();
  });
});
