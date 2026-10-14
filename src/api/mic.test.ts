// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchService = vi.fn();
const postService = vi.fn();
vi.mock('./service', () => ({
  fetchService: (...a: unknown[]) => fetchService(...a),
  postService: (...a: unknown[]) => postService(...a),
}));

import { fetchSystemMic, setSystemMicMuted, setSystemMicVolume } from './mic';

beforeEach(() => {
  fetchService.mockReset();
  postService.mockReset();
  postService.mockResolvedValue({});
});

describe('mic client', () => {
  it('reads the volume-shaped state from GET /system/mic', async () => {
    fetchService.mockResolvedValue({ supported: true, volume: 0.4, muted: false });
    expect(await fetchSystemMic()).toEqual({ supported: true, volume: 0.4, muted: false });
    expect(fetchService).toHaveBeenCalledWith('/system/mic');
  });

  it('posts the level to /system/mic', async () => {
    await setSystemMicVolume(0.25);
    expect(postService).toHaveBeenCalledWith('/system/mic', { volume: 0.25 });
  });

  it('posts mute to /system/mic/mute', async () => {
    await setSystemMicMuted(true);
    expect(postService).toHaveBeenCalledWith('/system/mic/mute', { muted: true });
  });
});
