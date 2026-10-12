import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenControls } from './ModeControls';
import { fetchScreenEffect, fetchScreenMonitors, setScreenEffect, startScreenMirror } from '../../../../api/lighting';

vi.mock('../../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
}));
vi.mock('../../../../api/lighting', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../../api/lighting')>()),
  fetchScreenMonitors: vi.fn(),
  fetchScreenEffect: vi.fn(() => Promise.resolve({ hue: 0, colorize: 0, saturation: 1, contrast: 1 })),
  setScreenEffect: vi.fn(() => Promise.resolve(null)),
  startScreenMirror: vi.fn(() => Promise.resolve(null)),
  reselectScreen: vi.fn(() => Promise.resolve(null)),
}));

const pp = { hue: 0, colorize: 0, saturation: 1, contrast: 1 };
const monitors = [{ id: 'm1', name: 'Main (1920x1080)' }, { id: 'm2', name: 'Side (2560x1440)' }];

describe('ScreenControls monitor', () => {
  beforeEach(() => {
    vi.mocked(startScreenMirror).mockClear();
    vi.mocked(setScreenEffect).mockClear();
    vi.mocked(fetchScreenEffect).mockResolvedValue(pp);
  });

  const renderControls = () => render(<ScreenControls screenPP={pp} onScreenPPChange={() => {}} />);
  const monitorButton = (name: string) => screen.findByRole('button', { name });

  it('marks the persisted screen the service reports', async () => {
    vi.mocked(fetchScreenMonitors).mockResolvedValue({ effects: [], monitors, selectedMonitor: 'm2' });
    renderControls();
    expect((await monitorButton('Side (2560x1440)')).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Main (1920x1080)' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the first screen for the default selection', async () => {
    vi.mocked(fetchScreenMonitors).mockResolvedValue({ effects: [], monitors, selectedMonitor: '' });
    renderControls();
    expect((await monitorButton('Main (1920x1080)')).getAttribute('aria-pressed')).toBe('true');
  });

  it('sends a monitor only once the user picks one', async () => {
    vi.mocked(fetchScreenMonitors).mockResolvedValue({ effects: [], monitors, selectedMonitor: 'm2' });
    renderControls();
    await monitorButton('Side (2560x1440)');

    // A filter change is not a screen choice: no monitor key, the persisted one stays.
    fireEvent.click(screen.getByRole('button', { name: 'lighting.filter.reactive' }));
    await waitFor(() => expect(startScreenMirror).toHaveBeenCalledTimes(1));
    expect(vi.mocked(startScreenMirror).mock.calls[0][2]).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: 'Main (1920x1080)' }));
    await waitFor(() => expect(startScreenMirror).toHaveBeenCalledTimes(2));
    expect(vi.mocked(startScreenMirror).mock.calls[1][2]).toBe('m1');

    // From then on the chosen screen rides along.
    fireEvent.click(screen.getByRole('button', { name: 'lighting.filter.passthrough' }));
    await waitFor(() => expect(startScreenMirror).toHaveBeenCalledTimes(3));
    expect(vi.mocked(startScreenMirror).mock.calls[2][2]).toBe('m1');
  });
});
