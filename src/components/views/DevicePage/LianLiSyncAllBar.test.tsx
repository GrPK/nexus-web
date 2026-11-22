import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LianLiSyncAllBar } from './LianLiSyncAllBar';
import { LIANLI_SYNC_ALL_API, type LianLiSyncAll } from '../../../api/lianli-sync';

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));

const sync: LianLiSyncAll = {
  enabled: false,
  mode: 'rainbow',
  speed: 2,
  direction: 0,
  brightness: 4,
  colors: [],
  modes: [
    { key: 'rainbow', hasSpeed: true, hasDirection: true, colorsMin: 0, colorsMax: 0 },
    { key: 'static', hasSpeed: false, hasDirection: false, colorsMin: 1, colorsMax: 1 },
  ],
};

const get = vi.fn();
const set = vi.fn();
const api = { get, set };

async function renderBar(data: LianLiSyncAll | null = sync, onWritten = vi.fn()) {
  get.mockResolvedValue(data);
  await act(async () => {
    render(<LianLiSyncAllBar api={api} onWritten={onWritten} />);
  });
  return onWritten;
}

beforeEach(() => {
  vi.clearAllMocks();
  set.mockResolvedValue(true);
});

describe('LianLiSyncAllBar', () => {
  it('stays hidden while the service has no sync route', async () => {
    await renderBar(null);
    expect(screen.queryByRole('switch', { name: 'devices.lianli-hub.syncAll' })).not.toBeInTheDocument();
  });

  it('the built-in adapter has no route yet, so it reads nothing and writes nothing', async () => {
    await expect(LIANLI_SYNC_ALL_API.get()).resolves.toBeNull();
    await expect(LIANLI_SYNC_ALL_API.set({ enabled: true })).resolves.toBe(false);
  });

  it('shows the switch and keeps the effect locked while sync is off', async () => {
    await renderBar();
    expect(screen.getByRole('switch', { name: 'devices.lianli-hub.syncAll' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: 'devices.lianli.lightingMode' })).toBeDisabled();
  });

  it('turning it on saves it and re-reads the lights below', async () => {
    const onWritten = await renderBar();
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'devices.lianli-hub.syncAll' }));
    });
    expect(set).toHaveBeenCalledWith({ enabled: true });
    expect(onWritten).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('a refused write does not re-read the lights', async () => {
    set.mockResolvedValue(false);
    const onWritten = await renderBar();
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'devices.lianli-hub.syncAll' }));
    });
    expect(onWritten).not.toHaveBeenCalled();
  });

  it('picks the shared effect while sync is on', async () => {
    await renderBar({ ...sync, enabled: true });
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    await act(async () => {
      fireEvent.click(await screen.findByRole('option', { name: 'devices.lianliEffect.static' }));
    });
    expect(set).toHaveBeenCalledWith({ mode: 'static' });
  });
});
