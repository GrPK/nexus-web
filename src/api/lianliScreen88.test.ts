import { beforeEach, describe, expect, it, vi } from 'vitest';

const postForm = vi.fn();
vi.mock('./service', () => ({
  resolveHttp: (p: string) => `http://svc${p}`,
  fetchService: vi.fn(),
  postService: vi.fn(),
  putService: vi.fn(),
  postServiceForm: (...a: unknown[]) => postForm(...a),
}));

import {
  LIANLI_SCREEN88_LIGHTING_API,
  deleteLianLiScreen88Media,
  getLianLiScreen88LConnectVideos,
  getLianLiScreen88Lighting,
  getLianLiScreen88Media,
  getLianLiScreen88Settings,
  importLianLiScreen88LConnectVideos,
  lianLiScreen88MediaPreviewUrl,
  setLianLiScreen88Settings,
  uploadLianLiScreen88Media,
} from './lianliScreen88';
import { fetchService, postService, putService } from './service';

beforeEach(() => {
  vi.clearAllMocks();
  postForm.mockReset();
});

describe('Universal Screen 8.8 bezel lighting', () => {
  it('reads and writes the bezel lighting at its own path', async () => {
    await getLianLiScreen88Lighting();
    expect(fetchService).toHaveBeenCalledWith('/devices/lianli-screen88/lighting');
    await LIANLI_SCREEN88_LIGHTING_API.set({ mode: 'meteor', colors: ['#112233'] });
    expect(putService).toHaveBeenCalledWith('/devices/lianli-screen88/lighting', { mode: 'meteor', colors: ['#112233'] });
  });
});

describe('Universal Screen 8.8 screen settings', () => {
  it('reads and writes the settings at the screen route', async () => {
    await getLianLiScreen88Settings();
    expect(fetchService).toHaveBeenCalledWith('/devices/lianli-screen88/settings');
    vi.mocked(putService).mockResolvedValue({ error: false });
    expect(await setLianLiScreen88Settings({ windowsDisplay: false })).toBe(true);
    expect(putService).toHaveBeenCalledWith('/devices/lianli-screen88/settings', { windowsDisplay: false });
  });

  it('a refused or unanswered write reads as not saved', async () => {
    vi.mocked(putService).mockResolvedValue({ error: true, msg: 'no such video' });
    expect(await setLianLiScreen88Settings({ video: 'x' })).toBe(false);
    vi.mocked(putService).mockResolvedValue(null);
    expect(await setLianLiScreen88Settings({ video: 'x' })).toBe(false);
  });
});

describe('Universal Screen 8.8 media library', () => {
  it('lists, deletes and previews at the 8.8 media routes', async () => {
    vi.mocked(fetchService).mockResolvedValue({ media: [{ name: 'a', label: 'A', ready: true }] });
    expect(await getLianLiScreen88Media()).toEqual([{ name: 'a', label: 'A', ready: true }]);
    expect(fetchService).toHaveBeenCalledWith('/devices/lianli-screen88/media');
    vi.mocked(postService).mockResolvedValue({ error: false });
    expect(await deleteLianLiScreen88Media('a')).toBe(true);
    expect(postService).toHaveBeenCalledWith('/devices/lianli-screen88/media/delete', { name: 'a' });
    expect(lianLiScreen88MediaPreviewUrl('a b.mp4')).toContain('/devices/lianli-screen88/media/a%20b.mp4/preview');
  });

  it('uploads the file and the serialized crop as multipart', async () => {
    postForm.mockResolvedValue({ error: false, msg: null, name: 'x' });
    const file = new File(['x'], 'clip.mp4');
    expect(await uploadLianLiScreen88Media(file, { x: 0.1, y: 0.2, w: 0.5, h: 0.4 })).toEqual({ name: 'x' });
    const [path, form] = postForm.mock.calls[0] as [string, FormData];
    expect(path).toBe('/devices/lianli-screen88/media');
    expect((form.get('file') as File).name).toBe('clip.mp4');
    expect(form.get('crop')).toBe('0.100000,0.200000,0.500000,0.400000');
    postForm.mockResolvedValue({ error: true, msg: 'bad' });
    expect(await uploadLianLiScreen88Media(file, { x: 0, y: 0, w: 1, h: 1 })).toBeNull();
  });

  it("sends a portrait mount's crop as portraitCrop", async () => {
    postForm.mockResolvedValue({ error: false, name: 'p' });
    await uploadLianLiScreen88Media(new File(['x'], 'tall.mp4'), { x: 0.2, y: 0, w: 0.25, h: 1 }, true);
    const [, form] = postForm.mock.calls[0] as [string, FormData];
    expect(form.get('portraitCrop')).toBe('0.200000,0.000000,0.250000,1.000000');
    expect(form.get('crop')).toBeNull();
  });

  it('the preview can ask for one orientation', () => {
    expect(lianLiScreen88MediaPreviewUrl('a.mp4', true)).toContain('/devices/lianli-screen88/media/a.mp4/preview?portrait=true');
    expect(lianLiScreen88MediaPreviewUrl('a.mp4')).not.toContain('portrait=');
  });
});

describe('L-Connect videos', () => {
  it('lists them and imports the picked files by name', async () => {
    await getLianLiScreen88LConnectVideos();
    expect(fetchService).toHaveBeenCalledWith('/devices/lianli-screen88/lconnect-videos');
    vi.mocked(postService).mockResolvedValue({ names: ['n1', 'n2'] });
    expect(await importLianLiScreen88LConnectVideos(['88001.mp4', '88002.mp4'])).toEqual(['n1', 'n2']);
    expect(postService).toHaveBeenCalledWith('/devices/lianli-screen88/lconnect-videos/import', { files: ['88001.mp4', '88002.mp4'] });
  });

  it('a refused or unanswered import is null', async () => {
    vi.mocked(postService).mockResolvedValue(null);
    expect(await importLianLiScreen88LConnectVideos(['nope.mp4'])).toBeNull();
    vi.mocked(postService).mockResolvedValue({ error: true });
    expect(await importLianLiScreen88LConnectVideos(['nope.mp4'])).toBeNull();
  });
});
