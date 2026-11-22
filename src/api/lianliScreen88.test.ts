import { describe, expect, it, vi } from 'vitest';

vi.mock('./service', () => ({
  fetchService: vi.fn(),
  putService: vi.fn(),
}));

import { LIANLI_SCREEN88_LIGHTING_API, getLianLiScreen88Lighting } from './lianliScreen88';
import { fetchService, putService } from './service';

describe('Universal Screen 8.8 bezel lighting', () => {
  it('reads and writes the bezel lighting at its own path', async () => {
    await getLianLiScreen88Lighting();
    expect(fetchService).toHaveBeenCalledWith('/devices/lianli-screen88/lighting');
    await LIANLI_SCREEN88_LIGHTING_API.set({ mode: 'meteor', colors: ['#112233'] });
    expect(putService).toHaveBeenCalledWith('/devices/lianli-screen88/lighting', { mode: 'meteor', colors: ['#112233'] });
  });
});
