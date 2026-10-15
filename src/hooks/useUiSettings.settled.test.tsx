import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UiSettingsProvider, useUiSettings, useUiSettingsHydrated, useUiSettingsSettled } from './useUiSettings';

const i18n = vi.hoisted(() => ({ t: (k: string) => k, setLanguage: () => {} }));
vi.mock('../lib/i18n', () => ({ useTranslation: () => i18n }));
vi.mock('../api/profiles', async (orig) => ({
  ...(await orig<typeof import('../api/profiles')>()),
  fetchPreferences: vi.fn(),
  savePreferences: vi.fn(),
}));
vi.mock('./useMultiplexSocket', () => ({ useTopicCallback: (name: string, _e: boolean, cb: () => void) => { if (name === 'prefs') topic.cb = cb; } }));

const topic = vi.hoisted(() => ({ cb: null as null | (() => void) }));
const { fetchPreferences } = await import('../api/profiles');

const seen = { settled: false, hydrated: false, themeMode: '' };
function Probe() {
  seen.settled = useUiSettingsSettled();
  seen.hydrated = useUiSettingsHydrated();
  seen.themeMode = useUiSettings().settings.themeMode;
  return null;
}
const mount = (serviceOnline: boolean) => render(<UiSettingsProvider serviceOnline={serviceOnline} manageDom={false}><Probe /></UiSettingsProvider>);

describe('settings provider settled semantics', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it('is not settled while the service is not online yet (the connection is still being checked)', async () => {
    await act(async () => { mount(false); });
    expect(seen.settled).toBe(false);
    expect(fetchPreferences).not.toHaveBeenCalled();
  });

  it('is settled and hydrated after a successful read', async () => {
    vi.mocked(fetchPreferences).mockResolvedValue({ theme: { themeMode: 'dark', accentColor: '#2563eb', language: 'en' } } as never);
    await act(async () => { mount(true); });
    expect(seen).toMatchObject({ settled: true, hydrated: true });
  });

  it('is settled but not hydrated after a failed read', async () => {
    vi.mocked(fetchPreferences).mockResolvedValue(null as never);
    await act(async () => { mount(true); });
    expect(seen).toMatchObject({ settled: true, hydrated: false });
  });

  it('is settled but not hydrated when the read rejects', async () => {
    vi.mocked(fetchPreferences).mockRejectedValue(new Error('x'));
    await act(async () => { mount(true); });
    expect(seen).toMatchObject({ settled: true, hydrated: false });
  });

  it('counts a read the service never answers as failed once the bound aborts it', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(fetchPreferences).mockImplementation(((signal?: AbortSignal) => new Promise((_, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as never);
      await act(async () => { mount(true); });
      expect(seen.settled).toBe(false);
      await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
      expect(seen).toMatchObject({ settled: true, hydrated: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries after an aborted read and hydrates when the retry succeeds', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(fetchPreferences)
        .mockImplementationOnce(((signal?: AbortSignal) => new Promise((_, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })) as never)
        .mockResolvedValue({ theme: { themeMode: 'dark', accentColor: '#2563eb', language: 'en' } } as never);
      await act(async () => { mount(true); });
      await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
      expect(seen).toMatchObject({ settled: true, hydrated: false });
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(fetchPreferences).toHaveBeenCalledTimes(2);
      expect(seen).toMatchObject({ settled: true, hydrated: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it('schedules no retry timer once the service goes offline', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(fetchPreferences).mockReset().mockResolvedValue(null as never);
      const view = mount(true);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      view.rerender(<UiSettingsProvider serviceOnline={false} manageDom={false}><Probe /></UiSettingsProvider>);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears a pending retry timer on unmount', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(fetchPreferences).mockReset().mockResolvedValue(null as never);
      const view = mount(true);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      view.unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still retries and hydrates when a slow read was overtaken by a read that failed fast', async () => {
    vi.useFakeTimers();
    try {
      const answers: Array<(v: unknown) => void> = [];
      vi.mocked(fetchPreferences).mockReset().mockImplementationOnce((() => new Promise(r => { answers.push(r); })) as never);
      await act(async () => { mount(true); });
      vi.mocked(fetchPreferences).mockResolvedValueOnce(null as never);
      await act(async () => { topic.cb?.(); });
      expect(seen).toMatchObject({ settled: true, hydrated: false });
      vi.mocked(fetchPreferences).mockResolvedValue({ theme: { themeMode: 'dark', accentColor: '#2563eb', language: 'en' } } as never);
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(seen).toMatchObject({ settled: true, hydrated: true });
      await act(async () => { answers[0](null); });
      expect(seen.hydrated).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores an older read that resolves after a newer one', async () => {
    const answers: Array<(v: unknown) => void> = [];
    vi.mocked(fetchPreferences).mockReset().mockImplementation((() => new Promise(r => { answers.push(r); })) as never);
    await act(async () => { mount(true); });
    act(() => topic.cb?.());
    expect(answers).toHaveLength(2);
    const prefs = (themeMode: string) => ({ theme: { themeMode, accentColor: '#2563eb', language: 'en' } });
    await act(async () => { answers[1](prefs('light')); });
    expect(seen.themeMode).toBe('light');
    await act(async () => { answers[0](prefs('dark')); });
    expect(seen.themeMode).toBe('light');
  });
});
