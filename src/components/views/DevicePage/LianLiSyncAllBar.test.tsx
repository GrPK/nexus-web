import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LianLiSyncAllBar, syncEffectOptions } from './LianLiSyncAllBar';
import type { LianLiSyncAll, LianLiSyncEffect } from '../../../api/lianli-sync';
import en from '../../../locales/en.json';

/**
 * Every effect key GET /devices/lianli/sync can send: the six each device plays
 * (service LianLiSync.Effects) and L-Connect's 19 merged ones (LianLiMerge.Effects).
 */
const SERVICE_EFFECT_KEYS = [
  'rainbow', 'rainbowMorph', 'static', 'breathing', 'meteor', 'runway',
  'mergeRainbow', 'mergeRainbowMorph', 'mergeStatic', 'mergeBreathing', 'mergeMeteor', 'mergeRunway',
  'mergeStack', 'mergeTwinkle', 'mergeColorCycle', 'mergeCoverCycle', 'mergeWave', 'mergeMeteorShower',
  'mergeDisco', 'mergeBlowUp', 'mergeHeartBeat', 'mergeWarning', 'mergeSeaFlow', 'mergeRipple', 'mergeEcho',
];

const mergeEffect = (key: string): LianLiSyncEffect => ({
  key, merge: true, hasSpeed: true, hasDirection: true, colorsMax: 0, defaultSpeed: 3, defaultColors: [],
  speed: 3, brightness: 4, direction: 0, colors: [],
});

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

  it('names a TL chain as the Lighting tab does; the Curve and the 8.8 keep their names', async () => {
    get.mockResolvedValue(sync);
    const chainNames = new Map([['7880ae72ab3c', 'TL LCD Wireless Fans (3 screens)'], ['hydroShift2Curve', 'Other']]);
    await act(async () => {
      render(<LianLiSyncAllBar api={api} chainNames={chainNames} />);
    });
    expect(screen.getByText('TL LCD Wireless Fans (3 screens)')).toBeInTheDocument();
    expect(screen.queryByText('Lian Li Wireless TL')).not.toBeInTheDocument();
    expect(screen.getByText('HydroShift II OLED Curved')).toBeInTheDocument();
    expect(screen.getByText('Universal Screen 8.8')).toBeInTheDocument();
  });

  it('moves a device in the merge order at once, sends the whole order and reads it back', async () => {
    let state = sync;
    set.mockImplementation((patch: { devices?: { id: string }[] }) => {
      state = { ...state, devices: patch.devices!.map(o => state.devices.find(d => d.id === o.id)!) };
      return Promise.resolve(true);
    });
    get.mockImplementation(() => Promise.resolve(state));
    const onWritten = vi.fn();
    await act(async () => {
      render(<LianLiSyncAllBar api={api} onWritten={onWritten} />);
    });
    const ups = screen.getAllByRole('button', { name: 'devices.lianli-wireless.orderMoveUp' });
    const downs = screen.getAllByRole('button', { name: 'devices.lianli-wireless.orderMoveDown' });
    expect(ups.map(b => (b as HTMLButtonElement).disabled)).toEqual([true, false, false]);
    expect(downs.map(b => (b as HTMLButtonElement).disabled)).toEqual([false, false, true]);
    await act(async () => {
      fireEvent.click(ups[2]);
    });
    expect(set).toHaveBeenCalledWith({
      devices: [{ id: '7880AE72AB3C' }, { id: 'universalScreen88' }, { id: 'hydroShift2Curve' }],
    });
    expect(get).toHaveBeenCalledTimes(2);
    // The order changes no device's own look.
    expect(onWritten).not.toHaveBeenCalled();
    const labels = ['Lian Li Wireless TL', 'Universal Screen 8.8', 'HydroShift II OLED Curved'].map(name => screen.getByText(name));
    expect(labels[0].compareDocumentPosition(labels[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(labels[1].compareDocumentPosition(labels[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the new order before the service answers and the stored one after a refusal', async () => {
    let answer!: (ok: boolean) => void;
    set.mockImplementation(() => new Promise<boolean>(resolve => { answer = resolve; }));
    await renderBar();
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'devices.lianli-wireless.orderMoveDown' })[0]);
    });
    const curve = screen.getByText('HydroShift II OLED Curved');
    expect(curve.compareDocumentPosition(screen.getByText('Lian Li Wireless TL')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await act(async () => {
      answer(false);
    });
    const tl = screen.getByText('Lian Li Wireless TL');
    expect(tl.compareDocumentPosition(screen.getByText('HydroShift II OLED Curved')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it('every effect key the service can send has an English label', () => {
    const labels = en as Record<string, string>;
    expect(SERVICE_EFFECT_KEYS.filter(k => !labels[`devices.lianliEffect.${k}`])).toEqual([]);
  });

  it('lists L-Connect\'s merged effects under their own heading, after the ones each device plays', async () => {
    const effects = [...sync.effects, mergeEffect('mergeRainbow'), mergeEffect('mergeEcho')];
    expect(syncEffectOptions((k: string) => k, effects).map(o => (o.header ? `# ${o.label}` : o.value))).toEqual([
      '# devices.lianli-hub.syncEachDevice', 'rainbow', 'meteor', 'static',
      '# devices.lianli-hub.syncMerged', 'mergeRainbow', 'mergeEcho',
    ]);
    await renderBar({ ...sync, enabled: true, effects });
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    const options = await screen.findAllByRole('option');
    expect(options.map(o => o.textContent)).toEqual([
      'devices.lianliEffect.rainbow', 'devices.lianliEffect.meteor', 'devices.lianliEffect.static',
      'devices.lianliEffect.mergeRainbow', 'devices.lianliEffect.mergeEcho',
    ]);
    expect(screen.getByText('devices.lianli-hub.syncMerged')).toBeInTheDocument();
  });

  it('picking a merged effect sends its key', async () => {
    await renderBar({ ...sync, enabled: true, effects: [...sync.effects, mergeEffect('mergeWave')] });
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    await act(async () => {
      fireEvent.click(await screen.findByRole('option', { name: 'devices.lianliEffect.mergeWave' }));
    });
    expect(set).toHaveBeenCalledWith({ effect: 'mergeWave' });
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
