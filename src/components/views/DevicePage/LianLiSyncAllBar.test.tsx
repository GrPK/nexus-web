import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

const mockScroll = vi.fn();
vi.mock('../../../search/scroll', () => ({
  requestSearchScroll: (...args: unknown[]) => mockScroll(...args),
}));

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

// The user's lights as the route lists them with Strimers (one TL chain on its motherboard input is left out).
const withStrimers: LianLiSyncAll = {
  ...sync,
  devices: [
    { kind: 'strimer', id: '64F271E566E1', name: 'Strimer MB 24-Pin', fanCount: 0, dots: 22, direction: 0 },
    { kind: 'strimer', id: '5A0B1C72AB01', name: 'Strimer CPU 2x8', fanCount: 0, dots: 29, direction: 0 },
    { kind: 'tlChain', id: '7880AE72AB3C', name: 'Lian Li Wireless TL', fanCount: 3, dots: 39, direction: 0 },
    { kind: 'tlChain', id: '9828EC72ABE1', name: 'Lian Li Wireless TL', fanCount: 1, dots: 13, direction: 0 },
    { kind: 'hydroShift2Curve', id: 'hydroShift2Curve', name: 'HydroShift II OLED Curved', dots: 14, direction: 0 },
  ],
};
// Each chain's name on the Lighting tab, as the hub hands them on.
const lightingNames = new Map([
  ['64F271E566E1', 'Strimer MB 24-Pin'],
  ['5a0b1c72ab01', 'Strimer CPU 2x8'],
  ['7880AE72AB3C', 'TL Wireless Fans (3 fans)'],
  ['91D3EC72ABE1', 'TL LCD Wireless Fans (3 screens)'],
  ['9828EC72ABE1', 'TL LCD Wireless Fans 2 (1 screen)'],
]);

// Sync all on with a merged effect picked: the merge order shows.
const merged: LianLiSyncAll = {
  ...sync,
  enabled: true,
  effect: 'mergeMeteor',
  effects: [...sync.effects, mergeEffect('mergeMeteor')],
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

  it('lists the effects from the service, in its order', async () => {
    await renderBar({ ...sync, enabled: true });
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    const options = await screen.findAllByRole('option');
    expect(options.map(o => o.textContent)).toEqual([
      'devices.lianliEffect.rainbow', 'devices.lianliEffect.meteor', 'devices.lianliEffect.static',
    ]);
  });

  it('shows the merge order while a merged effect plays, under the picker hint, the devices by name only', async () => {
    await renderBar(merged);
    const heading = screen.getByText('devices.lianli-hub.mergeOrder');
    // The hint under the picker says what a merged effect does; the list below shows the order, with no hint of its own.
    expect(screen.getByText('devices.lianli-hub.syncMergedHint').compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('devices.lianli-hub.mergeOrderHint')).not.toBeInTheDocument();
    expect(screen.getByText('Lian Li Wireless TL')).toBeInTheDocument();
    expect(screen.getByText('HydroShift II OLED Curved')).toBeInTheDocument();
    expect(screen.getByText('Universal Screen 8.8')).toBeInTheDocument();
    expect(screen.queryByText(/devices\.lianli\.fanCount/)).not.toBeInTheDocument();
    expect(screen.queryByText('devices.lianli-wireless.tab.devices')).not.toBeInTheDocument();
  });

  it('hides the merge order with an effect each device plays, or with Sync all off', async () => {
    await renderBar({ ...merged, effect: 'rainbow' });
    expect(screen.queryByText('devices.lianli-hub.mergeOrder')).not.toBeInTheDocument();
    expect(screen.queryByText('Lian Li Wireless TL')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'devices.lianli-wireless.orderMoveUp' })).not.toBeInTheDocument();
    cleanup();
    await renderBar({ ...merged, enabled: false });
    expect(screen.queryByText('devices.lianli-hub.mergeOrder')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'devices.lianli-wireless.orderMoveDown' })).not.toBeInTheDocument();
  });

  it('names a TL chain as the Lighting tab does; the Curve and the 8.8 keep their names', async () => {
    get.mockResolvedValue(merged);
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
    let state = merged;
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
    await renderBar(merged);
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

  it('cannot turn on while members are on the Lighting page, and names them as the Lighting tab does', async () => {
    get.mockResolvedValue(withStrimers);
    // The user's lights: both Strimers and the one-screen TL chain on the Lighting page.
    const memberLocks = new Map([
      ['64F271E566E1', 'lightingPage' as const],
      ['5A0B1C72AB01', 'lightingPage' as const],
      ['9828EC72ABE1', 'lightingPage' as const],
      // Not in the list (not a member): it holds nothing back.
      ['ABCDEF000000', 'lightingPage' as const],
    ]);
    await act(async () => {
      render(<LianLiSyncAllBar api={api} chainNames={lightingNames} memberLocks={memberLocks} />);
    });
    expect(screen.getByRole('switch', { name: 'devices.lianli-hub.syncAll' })).toBeDisabled();
    const notice = screen.getByRole('status');
    expect(notice).toHaveAttribute('data-tone', 'info');
    expect(notice).toHaveTextContent(
      'devices.lianli-hub.syncBlockedLightingPage:{"devices":"Strimer MB 24-Pin, Strimer CPU 2x8, TL LCD Wireless Fans 2 (1 screen)"}',
    );
    expect(notice).not.toHaveTextContent('syncBlockedArgb');
  });

  it('makes each held name with a section on the page a button that scrolls to it; the rest stay text', async () => {
    get.mockResolvedValue(withStrimers);
    const memberLocks = new Map([
      ['64F271E566E1', 'lightingPage' as const],
      ['9828EC72ABE1', 'lightingPage' as const],
      ['91D3EC72ABE1', 'motherboardArgb' as const],
    ]);
    // The one-screen TL chain has no section here.
    const sectionIds = new Set(['64F271E566E1', '91D3EC72ABE1', 'HYDROSHIFT2CURVE']);
    await act(async () => {
      render(<LianLiSyncAllBar api={api} chainNames={lightingNames} memberLocks={memberLocks} sectionIds={sectionIds} />);
    });
    const notice = screen.getByRole('status');
    // The wording is unchanged; only the names became buttons.
    expect(notice).toHaveTextContent(
      'devices.lianli-hub.syncBlockedLightingPage:{"devices":"Strimer MB 24-Pin, TL LCD Wireless Fans 2 (1 screen)"}',
    );
    expect(notice).toHaveTextContent('devices.lianli-hub.syncBlockedArgb:{"devices":"TL LCD Wireless Fans (3 screens)"}');
    expect(screen.queryByRole('button', { name: 'TL LCD Wireless Fans 2 (1 screen)' })).not.toBeInTheDocument();
    const strimer = screen.getByRole('button', { name: 'Strimer MB 24-Pin' });
    expect(strimer).toHaveAttribute('type', 'button');
    fireEvent.click(strimer);
    expect(mockScroll).toHaveBeenLastCalledWith('lianli-sync-member:64F271E566E1');
    fireEvent.click(screen.getByRole('button', { name: 'TL LCD Wireless Fans (3 screens)' }));
    expect(mockScroll).toHaveBeenLastCalledWith('lianli-sync-member:91D3EC72ABE1');
  });

  it('counts a chain on its motherboard input although the route leaves it off the list', async () => {
    get.mockResolvedValue(withStrimers);
    const memberLocks = new Map([
      ['91D3EC72ABE1', 'motherboardArgb' as const],
      ['64F271E566E1', 'lightingPage' as const],
      // A chain the page has no name for yet reads as its MAC.
      ['0000AAAA0000', 'motherboardArgb' as const],
    ]);
    await act(async () => {
      render(<LianLiSyncAllBar api={api} chainNames={lightingNames} memberLocks={memberLocks} />);
    });
    expect(screen.getByRole('switch', { name: 'devices.lianli-hub.syncAll' })).toBeDisabled();
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('devices.lianli-hub.syncBlockedLightingPage:{"devices":"Strimer MB 24-Pin"}');
    expect(notice).toHaveTextContent('devices.lianli-hub.syncBlockedArgb:{"devices":"TL LCD Wireless Fans (3 screens), 0000AAAA0000"}');
  });

  it('lists the Strimers in the merge order by their Lighting tab names, without a count', async () => {
    get.mockResolvedValue({ ...withStrimers, enabled: true, effect: 'mergeMeteor', effects: merged.effects });
    await act(async () => {
      render(<LianLiSyncAllBar api={api} chainNames={lightingNames} />);
    });
    const rows = ['Strimer MB 24-Pin', 'Strimer CPU 2x8', 'TL Wireless Fans (3 fans)', 'TL LCD Wireless Fans 2 (1 screen)', 'HydroShift II OLED Curved']
      .map(name => screen.getByText(name));
    rows.slice(1).forEach((row, i) => {
      expect(rows[i].compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'devices.lianli-wireless.orderMoveDown' })[0]);
    });
    // A Strimer moves like a TL chain.
    expect(set).toHaveBeenCalledWith({
      devices: [{ id: '5A0B1C72AB01' }, { id: '64F271E566E1' }, { id: '7880AE72AB3C' }, { id: '9828EC72ABE1' }, { id: 'hydroShift2Curve' }],
    });
  });

  it('reads the list again when what holds the members changes', async () => {
    get.mockResolvedValue(withStrimers);
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<LianLiSyncAllBar api={api} memberLocks={new Map([['91D3EC72ABE1', 'motherboardArgb' as const]])} />);
    });
    expect(get).toHaveBeenCalledTimes(1);
    // The chain left its motherboard input, so the route lists it again.
    await act(async () => {
      view.rerender(<LianLiSyncAllBar api={api} memberLocks={new Map()} />);
    });
    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('turns on with no member held back, and shows no notice', async () => {
    get.mockResolvedValue(sync);
    await act(async () => {
      render(<LianLiSyncAllBar api={api} memberLocks={new Map([['64F271E566E1', 'lightingPage' as const]])} />);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'devices.lianli-hub.syncAll' }));
    });
    expect(set).toHaveBeenCalledWith({ enabled: true });
  });

  it('can always be turned off, even with a member on the Lighting page', async () => {
    get.mockResolvedValue({ ...sync, enabled: true });
    await act(async () => {
      render(<LianLiSyncAllBar api={api} memberLocks={new Map([['HYDROSHIFT2CURVE', 'lightingPage' as const]])} />);
    });
    const toggle = screen.getByRole('switch', { name: 'devices.lianli-hub.syncAll' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(set).toHaveBeenCalledWith({ enabled: false });
  });

  it('reports the members it drives while on, none while off, at once on a press', async () => {
    const onSynced = vi.fn();
    let state = sync;
    get.mockImplementation(() => Promise.resolve(state));
    set.mockImplementation((patch: { enabled?: boolean }) => {
      state = { ...state, enabled: patch.enabled ?? state.enabled };
      return Promise.resolve(true);
    });
    await act(async () => {
      render(<LianLiSyncAllBar api={api} onSynced={onSynced} />);
    });
    expect([...onSynced.mock.lastCall![0]]).toEqual([]);
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'devices.lianli-hub.syncAll' }));
    });
    expect([...onSynced.mock.lastCall![0]]).toEqual(['7880AE72AB3C', 'HYDROSHIFT2CURVE', 'UNIVERSALSCREEN88']);
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

  it('every effect key the service can send has an English label, the merged ones saying so in plain words', () => {
    const labels = en as Record<string, string>;
    expect(SERVICE_EFFECT_KEYS.filter(k => !labels[`devices.lianliEffect.${k}`])).toEqual([]);
    expect(labels['devices.lianliEffect.mergeRainbow']).toBe('Rainbow (merged)');
    expect(labels['devices.lianli-hub.syncMerged']).toBe('Merged across devices');
    expect(labels['devices.lianli-hub.syncMergedHint']).toBe('One continuous animation across every device');
    expect(labels['devices.lianli-hub.syncActive']).toBe('Sync mode on');
    expect(Object.entries(labels).filter(([, v]) => v.includes('W*'))).toEqual([]);
  });

  it('says how a merged effect runs, under the picker, only while one is on', async () => {
    await renderBar(merged);
    const picker = screen.getByLabelText('devices.lianli.lightingMode');
    const hint = screen.getByText('devices.lianli-hub.syncMergedHint');
    expect(picker.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hint.compareDocumentPosition(screen.getByText('devices.lianli-hub.mergeOrder')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    cleanup();
    await renderBar({ ...merged, effect: 'rainbow' });
    expect(screen.queryByText('devices.lianli-hub.syncMergedHint')).not.toBeInTheDocument();
    cleanup();
    await renderBar({ ...merged, enabled: false });
    expect(screen.queryByText('devices.lianli-hub.syncMergedHint')).not.toBeInTheDocument();
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
