import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LianLiSyncAllBar } from './LianLiSyncAllBar';
import type { LianLiSyncAll } from '../../../api/lianli-sync';

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));

// The route's answer, as GET /devices/lianli/sync sends it (two of its effects).
const sync: LianLiSyncAll = {
  enabled: false,
  effect: 'rainbow',
  maxLevel: 4,
  effects: [
    {
      key: 'rainbow', hasSpeed: true, hasDirection: true, colorsMax: 0, defaultSpeed: 3, defaultColors: [],
      speed: 3, brightness: 4, direction: 0, colors: [],
    },
    {
      key: 'meteor', hasSpeed: true, hasDirection: true, colorsMax: 4, defaultSpeed: 3,
      defaultColors: ['#ff0000', '#00ff00', '#0000ff', '#ffffff'],
      speed: 1, brightness: 2, direction: 1, colors: ['#111111', '#222222', '#333333', '#444444'],
    },
    {
      key: 'static', hasSpeed: false, hasDirection: false, colorsMax: 1, defaultSpeed: 0, defaultColors: ['#ff0000'],
      speed: 0, brightness: 4, direction: 0, colors: [],
    },
  ],
  devices: [
    { kind: 'tlChain', id: '7880AE72AB3C', name: 'Lian Li Wireless TL', fanCount: 3, mode: 'rainbow' },
    { kind: 'hydroShift2Curve', id: 'hydroShift2Curve', name: 'HydroShift II OLED Curved', mode: 'rainbow' },
    { kind: 'universalScreen88', id: 'universalScreen88', name: 'Universal Screen 8.8', mode: 'rainbow' },
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
  it('stays hidden when the service has no sync route', async () => {
    await renderBar(null);
    expect(screen.queryByRole('switch', { name: 'devices.lianli-hub.syncAll' })).not.toBeInTheDocument();
  });

  it('lists the effects from the service, in its order, and the devices sync drives', async () => {
    await renderBar({ ...sync, enabled: true });
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    const options = await screen.findAllByRole('option');
    expect(options.map(o => o.textContent)).toEqual([
      'devices.lianliEffect.rainbow', 'devices.lianliEffect.meteor', 'devices.lianliEffect.static',
    ]);
    expect(screen.getByText('Lian Li Wireless TL')).toBeInTheDocument();
    expect(screen.getByText('devices.lianli.fanCount3')).toBeInTheDocument();
    expect(screen.getByText('HydroShift II OLED Curved')).toBeInTheDocument();
    expect(screen.getByText('Universal Screen 8.8')).toBeInTheDocument();
  });

  it('keeps the effect locked while sync is off', async () => {
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

  it('picking an effect sends it as `effect` and shows that effect’s own saved look', async () => {
    let state = { ...sync, enabled: true };
    set.mockImplementation((patch: { effect?: string }) => {
      if (patch.effect) state = { ...state, effect: patch.effect };
      return Promise.resolve(true);
    });
    await renderBar(state);
    get.mockImplementation(() => Promise.resolve(state));
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    await act(async () => {
      fireEvent.click(await screen.findByRole('option', { name: 'devices.lianliEffect.meteor' }));
    });
    expect(set).toHaveBeenCalledWith({ effect: 'meteor' });
    const inputs = screen.getAllByLabelText('common.hexColor') as HTMLInputElement[];
    expect(inputs.map(i => i.value.toLowerCase())).toEqual(['#111111', '#222222', '#333333', '#444444']);
    expect((screen.getByRole('slider', { name: 'devices.lianli.lightingSpeedAria' }) as HTMLInputElement).value).toBe('25');
  });

  it('a colour change sends exactly the effect’s colour count', async () => {
    await renderBar({ ...sync, enabled: true, effect: 'meteor' });
    fireEvent.change(screen.getAllByLabelText('common.hexColor')[1], { target: { value: '#abcdef' } });
    expect(set).toHaveBeenLastCalledWith({ colors: ['#111111', '#abcdef', '#333333', '#444444'] });
  });

  it('an effect with no colours set yet starts from its defaults, still exactly its count', async () => {
    await renderBar({ ...sync, enabled: true, effect: 'static' });
    const inputs = screen.getAllByLabelText('common.hexColor') as HTMLInputElement[];
    expect(inputs.map(i => i.value.toLowerCase())).toEqual(['#ff0000']);
    fireEvent.change(inputs[0], { target: { value: '#00ffaa' } });
    expect(set).toHaveBeenLastCalledWith({ colors: ['#00ffaa'] });
  });

  it('speed, brightness and direction go to the current effect', async () => {
    await renderBar({ ...sync, enabled: true, effect: 'meteor' });
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingDirection'));
    await act(async () => {
      fireEvent.click(await screen.findByRole('option', { name: 'devices.lianli.directionLtr' }));
    });
    expect(set).toHaveBeenLastCalledWith({ direction: 0 });
  });
});
