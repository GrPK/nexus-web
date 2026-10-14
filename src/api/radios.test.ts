// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchService = vi.fn();
const postService = vi.fn();
vi.mock('./service', () => ({
  fetchService: (...a: unknown[]) => fetchService(...a),
  postService: (...a: unknown[]) => postService(...a),
}));

import { fetchRadios, normalizeRadios, setRadio } from './radios';

beforeEach(() => {
  fetchService.mockReset();
  postService.mockReset();
});

describe('radios client', () => {
  it('reads GET /system/radios and keeps null for a radio the host cannot report', async () => {
    fetchService.mockResolvedValue({ wifi: { on: true }, bluetooth: null, airplane: { on: false } });
    expect(await fetchRadios()).toEqual({ wifi: { on: true }, bluetooth: null, airplane: { on: false } });
    expect(fetchService).toHaveBeenCalledWith('/system/radios');
  });

  it('treats an absent or malformed radio as null, never as off', () => {
    expect(normalizeRadios({ wifi: { on: 'yes' }, airplane: {} })).toEqual({ wifi: null, bluetooth: null, airplane: null });
    expect(normalizeRadios(null)).toEqual({ wifi: null, bluetooth: null, airplane: null });
  });

  it('posts {kind, on} and returns the settled state', async () => {
    postService.mockResolvedValue({ wifi: { on: false }, bluetooth: { on: true }, airplane: null });
    const state = await setRadio('wifi', false);
    expect(postService).toHaveBeenCalledWith('/system/radios', { kind: 'wifi', on: false });
    expect(state).toEqual({ wifi: { on: false }, bluetooth: { on: true }, airplane: null });
  });

  it('resolves null on an error envelope instead of hiding every toggle', async () => {
    postService.mockResolvedValue({ error: true, msg: 'unknown kind' });
    expect(await setRadio('wifi', true)).toBeNull();
  });

  it('resolves null when the service is unreachable', async () => {
    fetchService.mockResolvedValue(null);
    postService.mockResolvedValue(null);
    expect(await fetchRadios()).toBeNull();
    expect(await setRadio('airplane', true)).toBeNull();
  });
});
