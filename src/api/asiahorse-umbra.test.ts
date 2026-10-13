// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  autoDetectUmbra,
  getUmbraState,
  setUmbraBoot,
  setUmbraFan,
  setUmbraLighting,
  setUmbraPort,
  type UmbraState,
} from './asiahorse-umbra';
import { fetchService, postService, putService } from './service';

vi.mock('./service', () => ({
  fetchService: vi.fn(),
  postService: vi.fn(),
  putService: vi.fn(),
}));

const mockFetch = vi.mocked(fetchService);
const mockPost = vi.mocked(postService);
const mockPut = vi.mocked(putService);

const effect = { effect: 'rainbow', speed: 3, brightness: 3, direction: 'forward' as const, colors: ['#ff0000'] };
const state: UmbraState = {
  isConnected: true,
  deviceId: 'CDAB2F9648BC44FE',
  firmware: '1.0.6',
  lighting: { source: 'nexus', lightOn: true, group: 'sync', sync: effect, merge: effect, async: [] },
  fan: { syncMb: false, duty: 20 },
  boot: { mode: 'memory', selfCheck: true },
  ports: [{ index: 0, ledCount: 6, direction: 'forward', order: 1 }],
  effects: [],
};

beforeEach(() => { vi.clearAllMocks(); });

describe('asiahorse umbra api', () => {
  it('reads the state from the device route', async () => {
    mockFetch.mockResolvedValue(state);
    expect(await getUmbraState()).toEqual(state);
    expect(mockFetch).toHaveBeenCalledWith('/devices/asiahorse-umbra');
  });

  it('treats the error envelope as a failure', async () => {
    mockFetch.mockResolvedValue({ error: true, msg: 'not connected' } as never);
    expect(await getUmbraState()).toBeNull();
    mockPut.mockResolvedValue({ error: true, msg: 'not connected' } as never);
    expect(await setUmbraFan(true)).toBeNull();
  });

  it('puts a partial lighting patch and returns the canonical state', async () => {
    mockPut.mockResolvedValue(state);
    const patch = { async: { port: 9, effect: 'runway' } };
    expect(await setUmbraLighting(patch)).toEqual(state);
    expect(mockPut).toHaveBeenCalledWith('/devices/asiahorse-umbra/lighting', patch);
  });

  it('targets the fan, port and boot routes', async () => {
    mockPut.mockResolvedValue(state);
    await setUmbraFan(true);
    await setUmbraPort(9, { ledCount: 12, order: 2 });
    await setUmbraBoot({ mode: 'fixed' });
    expect(mockPut.mock.calls).toEqual([
      ['/devices/asiahorse-umbra/fan', { syncMb: true }],
      ['/devices/asiahorse-umbra/ports/9', { ledCount: 12, order: 2 }],
      ['/devices/asiahorse-umbra/boot', { mode: 'fixed' }],
    ]);
  });

  it('posts auto-detect and returns null when the device never comes back', async () => {
    mockPost.mockResolvedValueOnce(state);
    expect(await autoDetectUmbra()).toEqual(state);
    expect(mockPost).toHaveBeenCalledWith('/devices/asiahorse-umbra/auto-detect', {});
    mockPost.mockResolvedValueOnce({ error: true, msg: 'timeout' } as never);
    expect(await autoDetectUmbra()).toBeNull();
  });
});
