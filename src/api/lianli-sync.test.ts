import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./service', () => ({
  fetchService: vi.fn(),
  putService: vi.fn(),
}));

import { LIANLI_SYNC_ALL_API, getLianLiSyncAll, setLianLiSyncAll } from './lianli-sync';
import { fetchService, putService } from './service';

beforeEach(() => vi.clearAllMocks());

describe('Lian Li sync route', () => {
  it('reads and writes /devices/lianli/sync', async () => {
    await getLianLiSyncAll();
    expect(fetchService).toHaveBeenCalledWith('/devices/lianli/sync');
    vi.mocked(putService).mockResolvedValue({ error: false });
    await expect(LIANLI_SYNC_ALL_API.set({ enabled: true, effect: 'meteor' })).resolves.toBe(true);
    expect(putService).toHaveBeenCalledWith('/devices/lianli/sync', { enabled: true, effect: 'meteor' });
  });

  it('sends a new merge order as `devices`', async () => {
    vi.mocked(putService).mockResolvedValue({ error: false });
    await expect(setLianLiSyncAll({ devices: [{ id: 'universalScreen88' }, { id: '7880AE72AB3C', direction: 1 }] })).resolves.toBe(true);
    expect(putService).toHaveBeenCalledWith('/devices/lianli/sync', {
      devices: [{ id: 'universalScreen88' }, { id: '7880AE72AB3C', direction: 1 }],
    });
  });

  it('reports a refused patch or no answer as not saved', async () => {
    vi.mocked(putService).mockResolvedValue({ error: true, msg: 'meteor takes 4 colors' });
    await expect(setLianLiSyncAll({ colors: ['#ffffff'] })).resolves.toBe(false);
    vi.mocked(putService).mockResolvedValue(null);
    await expect(setLianLiSyncAll({ speed: 2 })).resolves.toBe(false);
  });
});
