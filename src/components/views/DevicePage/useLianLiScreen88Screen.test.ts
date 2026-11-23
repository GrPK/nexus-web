import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isScreen88InWindowsDisplay, useLianLiScreen88Screen } from './useLianLiScreen88Screen';

const mockGet = vi.fn();

vi.mock('../../../api/lianliScreen88', () => ({
  getLianLiScreen88Settings: (...a: unknown[]) => mockGet(...a),
  setLianLiScreen88Settings: vi.fn().mockResolvedValue(true),
}));

const base = {
  connected: true,
  inWindowsDisplay: false,
  screenMode: 'nexus',
  screenSaverMinutes: 0,
  screenSaverBrightness: 50,
};

async function read(settings: Record<string, unknown> | null, enabled = true) {
  mockGet.mockResolvedValue(settings && { ...base, ...settings });
  const { result } = renderHook(() => useLianLiScreen88Screen(enabled));
  await act(async () => {});
  return result.current;
}

beforeEach(() => mockGet.mockReset());

describe('useLianLiScreen88Screen', () => {
  it('playingClip is the selected video in video mode, or the clip on the glass', async () => {
    expect((await read({ screenMode: 'video', video: 'a.mp4' })).playingClip).toBe('a.mp4');
    expect((await read({ screenMode: 'nexus', playing: 'saver.mp4' })).playingClip).toBe('saver.mp4');
    expect((await read({ screenMode: 'nexus', video: 'a.mp4' })).playingClip).toBeNull();
  });

  it('plays nothing while the glass is a Windows display', async () => {
    const s = await read({ connected: false, inWindowsDisplay: true, screenMode: 'video', video: 'a.mp4' });
    expect(s.playingClip).toBeNull();
    expect(isScreen88InWindowsDisplay(s.settings)).toBe(true);
  });

  it('is loaded once the first read is back, even without an answer', async () => {
    const s = await read(null);
    expect(s.loaded).toBe(true);
    expect(s.settings).toBeNull();
    expect(isScreen88InWindowsDisplay(s.settings)).toBe(false);
  });

  it('a connected panel is not a Windows display even with the HID identity listed', async () => {
    const s = await read({ connected: true, inWindowsDisplay: true });
    expect(isScreen88InWindowsDisplay(s.settings)).toBe(false);
  });

  it('does not poll while disabled', async () => {
    const s = await read({ screenMode: 'video', video: 'a.mp4' }, false);
    expect(s.playingClip).toBeNull();
    expect(s.loaded).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
