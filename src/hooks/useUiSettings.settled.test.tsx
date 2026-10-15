import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UiSettingsProvider, useUiSettingsHydrated, useUiSettingsSettled } from './useUiSettings';

const i18n = vi.hoisted(() => ({ t: (k: string) => k, setLanguage: () => {} }));
vi.mock('../lib/i18n', () => ({ useTranslation: () => i18n }));
vi.mock('../api/profiles', async (orig) => ({
  ...(await orig<typeof import('../api/profiles')>()),
  fetchPreferences: vi.fn(),
  savePreferences: vi.fn(),
}));
vi.mock('./useMultiplexSocket', () => ({ useTopicCallback: () => {} }));

const { fetchPreferences } = await import('../api/profiles');

const seen = { settled: false, hydrated: false };
function Probe() {
  seen.settled = useUiSettingsSettled();
  seen.hydrated = useUiSettingsHydrated();
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
    expect(seen).toEqual({ settled: true, hydrated: true });
  });

  it('is settled but not hydrated after a failed read', async () => {
    vi.mocked(fetchPreferences).mockResolvedValue(null as never);
    await act(async () => { mount(true); });
    expect(seen).toEqual({ settled: true, hydrated: false });
  });

  it('is settled but not hydrated when the read rejects', async () => {
    vi.mocked(fetchPreferences).mockRejectedValue(new Error('x'));
    await act(async () => { mount(true); });
    expect(seen).toEqual({ settled: true, hydrated: false });
  });
});
