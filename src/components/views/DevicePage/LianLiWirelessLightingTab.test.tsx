import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LianLiWirelessLightingTab } from './LianLiWirelessLightingTab';
import { applyChainPatch } from './lianliChainUtils';
import type { LianLiWirelessChainLighting, LianLiWirelessChainPatch, LianLiWirelessLighting } from '../../../api/lianli-wireless';

/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));

const mockGetStrimers = vi.fn();
const mockSetStrimer = vi.fn();

vi.mock('../../../api/lianli-wireless', () => ({
  getLianLiWirelessLighting: (...args: any[]) => mockGetStrimers(...args),
  setLianLiWirelessChainLighting: (...args: any[]) => mockSetStrimer(...args),
}));

const effects = [
  { key: 'rainbow', hasSpeed: true, hasDirection: true, colorsMin: 0, colorsMax: 0 },
  { key: 'static', hasSpeed: false, hasDirection: false, colorsMin: 1, colorsMax: 1 },
  { key: 'meteor', hasSpeed: true, hasDirection: true, colorsMin: 1, colorsMax: 3 },
];

const strimer: LianLiWirelessChainLighting = {
  mac: '64F271E566E1',
  kind: 'strimer',
  devType: 2,
  model: 'Strimer 24-Pin',
  fanType: 0,
  fanCount: 0,
  lanes: 6,
  ledsPerLane: 22,
  modes: effects,
  supportsPerLane: true,
  mode: 'meteor',
  speed: 2,
  direction: 0,
  brightness: 4,
  colors: [],
  laneSettings: [],
};

const fanChain: LianLiWirelessChainLighting = {
  ...strimer,
  mac: '998D1DE566E1',
  kind: 'fans',
  devType: 0,
  model: '',
  fanType: 24,
  fanCount: 3,
  lanes: 0,
  ledsPerLane: 0,
  modes: [effects[0], effects[1]],
  supportsPerLane: false,
  mode: 'rainbow',
};

const catalog: LianLiWirelessLighting = {
  laneModes: ['rainbow', 'static'],
  chains: [strimer],
};

function withStrimer(patch: Partial<LianLiWirelessChainLighting>): LianLiWirelessLighting {
  return { ...catalog, chains: [{ ...strimer, ...patch }] };
}

async function renderTab(data: LianLiWirelessLighting = catalog, onSectionNavigate?: (s: string) => void) {
  mockGetStrimers.mockResolvedValue(data);
  await act(async () => {
    render(<LianLiWirelessLightingTab onSectionNavigate={onSectionNavigate} />);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSetStrimer.mockResolvedValue(true);
});

describe('LianLiWirelessLightingTab', () => {
  it('renders one section per chain, a Strimer by model and a fan chain by product line', async () => {
    await renderTab({ ...catalog, chains: [strimer, fanChain] });
    expect(screen.getByText('Strimer 24-Pin')).toBeInTheDocument();
    expect(screen.getByText('devices.lianli-wireless.fanTypeSlv3Lcd')).toBeInTheDocument();
  });

  it('counts a chain\'s screens, or a fan chain\'s fans, after its name and reports the names', async () => {
    const one = { ...fanChain, mac: 'ONE', fanCount: 1 };
    const bare = { ...fanChain, mac: 'BARE', fanType: 28, fanCount: 1 };
    const fans = { ...fanChain, mac: 'FANS', fanType: 28, fanCount: 3 };
    const screens: Record<string, number> = { [fanChain.mac]: 3, ONE: 1 };
    const onNames = vi.fn();
    mockGetStrimers.mockResolvedValue({ ...catalog, chains: [strimer, fanChain, one, bare, fans] });
    await act(async () => {
      render(<LianLiWirelessLightingTab screensOf={c => screens[c.mac] ?? 0} onNames={onNames} />);
    });
    const three = 'devices.lianli-hub.chainScreens:{"name":"devices.lianli-wireless.fanTypeSlv3Lcd","count":3}';
    const single = 'devices.lianli-hub.chainOneScreen:{"name":"devices.lianli-wireless.fanTypeSlv3Lcd 2"}';
    const oneFan = 'devices.lianli-hub.chainOneFan:{"name":"devices.lianli-wireless.fanTypeTlv2"}';
    const threeFans = 'devices.lianli-hub.chainFans:{"name":"devices.lianli-wireless.fanTypeTlv2 2","count":3}';
    expect(screen.getByText('Strimer 24-Pin')).toBeInTheDocument();
    expect(screen.getByText(three)).toBeInTheDocument();
    expect(screen.getByText(single)).toBeInTheDocument();
    expect(screen.getByText(oneFan)).toBeInTheDocument();
    expect(screen.getByText(threeFans)).toBeInTheDocument();
    expect(onNames).toHaveBeenCalledTimes(1);
    expect([...onNames.mock.calls[0][0]]).toEqual([
      [strimer.mac, 'Strimer 24-Pin'],
      [fanChain.mac, three],
      ['BARE', oneFan],
      ['FANS', threeFans],
      ['ONE', single],
    ]);
  });

  it('counts nothing in the names when no screens are counted', async () => {
    await renderTab({ ...catalog, chains: [strimer, fanChain] });
    expect(screen.getByText('devices.lianli-wireless.fanTypeSlv3Lcd')).toBeInTheDocument();
    expect(screen.queryByText(/chainFans|chainScreens/)).not.toBeInTheDocument();
  });

  it('offers a fan chain its own catalog and no per-lane mode', async () => {
    await renderTab({ ...catalog, chains: [fanChain] });
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    const options = await screen.findAllByRole('option');
    expect(options.map(o => o.textContent)).toEqual(['devices.lianliEffect.rainbow', 'devices.lianliEffect.static']);
  });

  it('an effect with colours shows speed, direction and the default palette up to its maximum', async () => {
    await renderTab();
    const section = screen.getByText('Strimer 24-Pin').closest('section')!;
    expect(within(section).getByText('devices.lianli.lightingSpeed')).toBeInTheDocument();
    expect(within(section).getByText('devices.lianli.lightingDirection')).toBeInTheDocument();
    expect(within(section).getAllByLabelText('common.hexColor')).toHaveLength(3);
    expect(within(section).queryByText('devices.lianli.addColor')).not.toBeInTheDocument();
  });

  it('editing one colour keeps the rest of the stored palette', async () => {
    await renderTab(withStrimer({ colors: ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666'] }));
    const inputs = screen.getAllByLabelText('common.hexColor');
    expect(inputs.map(i => (i as HTMLInputElement).value)).toEqual(['#111111', '#222222', '#333333']);
    fireEvent.change(inputs[1], { target: { value: '#abcdef' } });
    expect(mockSetStrimer).toHaveBeenLastCalledWith('64F271E566E1', {
      colors: ['#111111', '#abcdef', '#333333', '#444444', '#555555', '#666666'],
      effectMode: undefined,
    });
  });

  it('re-reads the cable when the service rejects a change', async () => {
    mockSetStrimer.mockResolvedValue(false);
    await renderTab();
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    await act(async () => {
      fireEvent.click(await screen.findByRole('option', { name: 'devices.lianliEffect.rainbow' }));
    });
    expect(mockGetStrimers).toHaveBeenCalledTimes(2);
  });

  it('an effect without speed or direction hides both', async () => {
    await renderTab(withStrimer({ mode: 'static' }));
    expect(screen.queryByText('devices.lianli.lightingSpeed')).not.toBeInTheDocument();
    expect(screen.queryByText('devices.lianli.lightingDirection')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('common.hexColor')).toHaveLength(1);
  });

  it('Lighting page mode greys out the animation the cable returns to', async () => {
    const nav = vi.fn();
    await renderTab(withStrimer({ mode: 'custom', effectMode: 'static' }), nav);
    expect(screen.getByRole('switch', { name: 'devices.lightingPage.use' })).toHaveAttribute('aria-checked', 'true');
    const modeSelect = screen.getByRole('button', { name: 'devices.lianli.lightingMode' });
    expect(modeSelect).toHaveTextContent('devices.lianliEffect.static');
    expect(modeSelect).toBeDisabled();
    expect(screen.getByRole('slider', { name: 'devices.lianli.lightingBrightnessAria' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'smartLights.colorOnLightingPage' }));
    expect(nav).toHaveBeenCalledWith('lighting');
  });

  it('turning the switch off plays the last animation again', async () => {
    await renderTab(withStrimer({ mode: 'custom', effectMode: 'static' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'devices.lightingPage.use' }));
    });
    expect(mockSetStrimer).toHaveBeenCalledWith('64F271E566E1', { mode: 'static', effectMode: undefined });
  });

  it('per-lane mode shows one row per lane', async () => {
    await renderTab(withStrimer({ mode: 'perLane' }));
    for (let n = 1; n <= 6; n++) {
      expect(screen.getByText(`devices.lianli-wireless.strimerLaneN:{"n":${n}}`)).toBeInTheDocument();
    }
    expect(screen.getAllByLabelText('common.hexColor')).toHaveLength(6);
  });

  it('offers Merge only for a mergeable fan effect and sends the toggle', async () => {
    const runway = { key: 'runway', hasSpeed: true, hasDirection: false, colorsMin: 0, colorsMax: 1, mergeable: true };
    await renderTab({ ...catalog, chains: [{ ...fanChain, modes: [...fanChain.modes, runway] }] });
    expect(screen.queryByRole('switch', { name: 'devices.lianli-wireless.merge' })).not.toBeInTheDocument();

    await renderTab({ ...catalog, chains: [{ ...fanChain, modes: [...fanChain.modes, runway], mode: 'runway', merge: false }] });
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'devices.lianli-wireless.merge' }));
    });
    expect(mockSetStrimer).toHaveBeenCalledWith('998D1DE566E1', { merge: true });
  });

  it('picking a mode sends it for that cable', async () => {
    await renderTab();
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    fireEvent.click(await screen.findByRole('option', { name: 'devices.lianliEffect.rainbow' }));
    expect(mockSetStrimer).toHaveBeenCalledWith('64F271E566E1', { mode: 'rainbow', effectMode: undefined });
  });

  it('lists the effect catalog with per-lane last', async () => {
    await renderTab();
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    const options = await screen.findAllByRole('option');
    expect(options.map(o => o.textContent)).toEqual([
      'devices.lianliEffect.rainbow',
      'devices.lianliEffect.static',
      'devices.lianliEffect.meteor',
      'devices.lianli-wireless.strimerModePerLane',
    ]);
  });
});

describe('motherboard ARGB', () => {
  it('keeps every control on an RF chain that reports fan type 63', async () => {
    await renderTab({ ...catalog, chains: [{ ...fanChain, fanType: 63, argbCableConnected: true }] });
    expect(screen.getByRole('switch', { name: 'devices.motherboardArgb.label' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'devices.lightingPage.use' })).toBeInTheDocument();
  });

  it('is offered only on a chain with its sync cable plugged in', async () => {
    await renderTab({ ...catalog, chains: [{ ...fanChain, argbCableConnected: false }] });
    expect(screen.queryByRole('switch', { name: 'devices.motherboardArgb.label' })).not.toBeInTheDocument();
  });

  it('with no saved choice shows what the chain reports', async () => {
    await renderTab({ ...catalog, chains: [{ ...fanChain, argbCableConnected: true, motherboardArgb: null, playingMotherboardArgb: true }] });
    expect(screen.getByRole('switch', { name: 'devices.motherboardArgb.label' })).toHaveAttribute('aria-checked', 'true');
  });

  it('turning it on saves the choice and locks the effect controls', async () => {
    let chains = [{ ...fanChain, argbCableConnected: true }];
    mockSetStrimer.mockImplementation((_mac: string, patch: object) => {
      chains = chains.map(c => ({ ...c, ...patch }));
      return Promise.resolve(true);
    });
    await renderTab({ ...catalog, chains });
    mockGetStrimers.mockImplementation(() => Promise.resolve({ ...catalog, chains }));

    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'devices.motherboardArgb.label' }));
    });

    expect(mockSetStrimer).toHaveBeenCalledWith('998D1DE566E1', expect.objectContaining({ motherboardArgb: true }));
    expect(screen.getByRole('button', { name: 'devices.lianli.lightingMode' })).toBeDisabled();
  });
});

describe('Sync all on the Lian Li page', () => {
  const tl: LianLiWirelessChainLighting = { ...fanChain, mac: '7880ae72ab3c', fanType: 28, supportsScope: true, argbCableConnected: true };

  it('locks a chain Sync all drives and says it follows Sync all', async () => {
    mockGetStrimers.mockResolvedValue({ ...catalog, chains: [tl] });
    await act(async () => {
      render(<LianLiWirelessLightingTab syncAllMacs={new Set(['7880AE72AB3C'])} />);
    });
    expect(screen.getByText('devices.lianli-hub.followsSyncAll')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'devices.lightingPage.use' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'devices.motherboardArgb.label' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'devices.lianli-wireless.separateHalves' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'devices.lianli.lightingMode' })).toBeDisabled();
  });

  it('lets a synced chain leave the Lighting page', async () => {
    mockGetStrimers.mockResolvedValue({ ...catalog, chains: [{ ...tl, mode: 'custom', effectMode: 'rainbow' }] });
    await act(async () => {
      render(<LianLiWirelessLightingTab syncAllMacs={new Set(['7880AE72AB3C'])} />);
    });
    const lightingPage = screen.getByRole('switch', { name: 'devices.lightingPage.use' });
    expect(lightingPage).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(lightingPage);
    });
    expect(mockSetStrimer).toHaveBeenCalledWith('7880ae72ab3c', { mode: 'rainbow', effectMode: undefined });
  });

  it('anchors each chain\'s section, for the Sync all notice to scroll to', async () => {
    mockGetStrimers.mockResolvedValue({ ...catalog, chains: [tl, strimer] });
    await act(async () => {
      render(<LianLiWirelessLightingTab />);
    });
    expect(document.querySelector('section[data-search-anchor="lianli-sync-member:7880AE72AB3C"]')).toHaveTextContent('devices.lianli-wireless.fanTypeTlv2');
    expect(document.querySelector('section[data-search-anchor="lianli-sync-member:64F271E566E1"]')).toHaveTextContent('Strimer 24-Pin');
  });

  it('leaves a chain Sync all does not drive as it is', async () => {
    mockGetStrimers.mockResolvedValue({ ...catalog, chains: [tl] });
    await act(async () => {
      render(<LianLiWirelessLightingTab syncAllMacs={new Set(['OTHER'])} />);
    });
    expect(screen.queryByText('devices.lianli-hub.followsSyncAll')).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'devices.lightingPage.use' })).not.toBeDisabled();
  });

  it('reports the TL chains and Strimers the Lighting page or their motherboard input drive', async () => {
    const onLocks = vi.fn();
    mockGetStrimers.mockResolvedValue({
      ...catalog,
      chains: [
        { ...tl, mode: 'custom', effectMode: 'rainbow' },
        { ...tl, mac: 'aa', motherboardArgb: true },
        // No saved choice: what the chain reports counts, as in the service.
        { ...tl, mac: 'bb', motherboardArgb: null, playingMotherboardArgb: true },
        { ...tl, mac: 'cc' },
        // A saved choice wins over what the chain still reports.
        { ...tl, mac: 'dd', motherboardArgb: false, playingMotherboardArgb: true },
        { ...strimer, mac: 'ee', mode: 'custom', effectMode: 'meteor' },
        { ...strimer, mac: 'ff', playingMotherboardArgb: true },
        // Not a TL chain: Sync all does not drive it.
        { ...fanChain, mac: 'gg', mode: 'custom', effectMode: 'rainbow' },
      ],
    });
    await act(async () => {
      render(<LianLiWirelessLightingTab onLocks={onLocks} />);
    });
    expect(onLocks).toHaveBeenCalledTimes(1);
    expect(Object.fromEntries(onLocks.mock.calls[0][0])).toEqual({
      '7880AE72AB3C': 'lightingPage',
      AA: 'motherboardArgb',
      BB: 'motherboardArgb',
      EE: 'lightingPage',
      FF: 'motherboardArgb',
    });
  });

  it('locks a Strimer Sync all drives, its lanes too', async () => {
    mockGetStrimers.mockResolvedValue({ ...catalog, chains: [{ ...strimer, mode: 'perLane', argbCableConnected: true }] });
    await act(async () => {
      render(<LianLiWirelessLightingTab syncAllMacs={new Set(['64F271E566E1'])} />);
    });
    expect(screen.getByText('devices.lianli-hub.followsSyncAll')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'devices.lightingPage.use' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'devices.motherboardArgb.label' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'devices.lianli.lightingMode' })).toBeDisabled();
    for (let n = 1; n <= 6; n++) {
      expect(screen.getByRole('button', { name: `devices.lianli-wireless.strimerLaneN:{"n":${n}}` })).toBeDisabled();
    }
    expect(screen.getAllByRole('button', { name: 'devices.lianli.lightingDirection' }).every(b => (b as HTMLButtonElement).disabled)).toBe(true);
  });

  it('lets a synced Strimer leave the Lighting page, not join it', async () => {
    mockGetStrimers.mockResolvedValue({ ...catalog, chains: [{ ...strimer, mode: 'custom', effectMode: 'meteor' }] });
    await act(async () => {
      render(<LianLiWirelessLightingTab syncAllMacs={new Set(['64F271E566E1'])} />);
    });
    const lightingPage = screen.getByRole('switch', { name: 'devices.lightingPage.use' });
    expect(lightingPage).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(lightingPage);
    });
    expect(mockSetStrimer).toHaveBeenCalledWith('64F271E566E1', { mode: 'meteor', effectMode: undefined });
  });
});

describe('wireless TL up and down', () => {
  const tlEffects = [
    { key: 'rainbow', hasSpeed: true, hasDirection: true, colorsMin: 0, colorsMax: 0, mergeable: true },
    { key: 'static', hasSpeed: false, hasDirection: false, colorsMin: 1, colorsMax: 1, defaultColors: ['#ff0000'] },
    { key: 'meteor', hasSpeed: true, hasDirection: true, colorsMin: 1, colorsMax: 4, defaultColors: ['#ff0000', '#00ff00', '#0000ff', '#ffffff'] },
  ];
  const tl: LianLiWirelessChainLighting = {
    ...fanChain,
    mac: '7880AE72AB3C',
    modes: tlEffects,
    mode: 'meteor',
    colors: ['#111111'],
    supportsScope: true,
    up: null,
    down: null,
    lastScope: null,
    upDownSwap: false,
  };
  const ownHalves: Partial<LianLiWirelessChainLighting> = {
    up: { mode: 'static', speed: 0, direction: 0, brightness: 4, colors: ['#222222'] },
    down: { mode: 'meteor', speed: 3, direction: 1, brightness: 3, colors: ['#333333', '#444444', '#555555', '#666666'] },
    lastScope: 'down',
  };

  // The service keeps what it is sent, so the read after a write shows the change.
  async function renderTl(patch: Partial<LianLiWirelessChainLighting> = {}) {
    let chains = [{ ...tl, ...patch }];
    mockSetStrimer.mockImplementation((_mac: string, p: LianLiWirelessChainPatch) => {
      chains = chains.map(c => applyChainPatch(c, p));
      return Promise.resolve(true);
    });
    await renderTab({ ...catalog, chains });
    mockGetStrimers.mockImplementation(() => Promise.resolve({ ...catalog, chains }));
  }

  it('lists only the effects, with Separate halves off and no halves while the whole fan plays one look', async () => {
    await renderTl();
    expect(screen.getByRole('switch', { name: 'devices.lianli-wireless.separateHalves' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    const options = (await screen.findAllByRole('option')).map(o => o.textContent);
    expect(options).toEqual(['devices.lianliEffect.rainbow', 'devices.lianliEffect.static', 'devices.lianliEffect.meteor']);
    expect(screen.queryByText('devices.lianli-wireless.halfRight')).not.toBeInTheDocument();
  });

  it('Separate halves on gives the up half its own look and shows only the two halves', async () => {
    await renderTl();
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'devices.lianli-wireless.separateHalves' }));
    });
    expect(mockSetStrimer).toHaveBeenCalledWith('7880AE72AB3C', { scope: 'up', effectMode: undefined });
    expect(screen.getByRole('switch', { name: 'devices.lianli-wireless.separateHalves' })).toHaveAttribute('aria-checked', 'true');
    // Left half ("down") first, then right half ("up").
    const left = screen.getByText('devices.lianli-wireless.halfLeft');
    expect(left.compareDocumentPosition(screen.getByText('devices.lianli-wireless.halfRight')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The whole fan's picker is gone: one picker per half.
    expect(screen.getAllByRole('button', { name: 'devices.lianli.lightingMode' })).toHaveLength(2);
  });

  it('Separate halves off plays the whole fan look again and drops both halves', async () => {
    await renderTl(ownHalves);
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'devices.lianli-wireless.separateHalves' }));
    });
    expect(mockSetStrimer).toHaveBeenCalledWith('7880AE72AB3C', { mode: 'meteor', effectMode: undefined });
    expect(screen.queryByText('devices.lianli-wireless.halfRight')).not.toBeInTheDocument();
    const [chainMode] = screen.getAllByRole('button', { name: 'devices.lianli.lightingMode' });
    expect(screen.getAllByRole('button', { name: 'devices.lianli.lightingMode' })).toHaveLength(1);
    expect(chainMode).toHaveTextContent('devices.lianliEffect.meteor');
  });

  it('shows each half with its own look and saves a change to that half only', async () => {
    await renderTl(ownHalves);
    expect(screen.getByRole('switch', { name: 'devices.lianli-wireless.separateHalves' })).toHaveAttribute('aria-checked', 'true');
    const [downMode, upMode] = screen.getAllByRole('button', { name: 'devices.lianli.lightingMode' });
    expect(upMode).toHaveTextContent('devices.lianliEffect.static');
    expect(downMode).toHaveTextContent('devices.lianliEffect.meteor');
    // The left half's ("down") four colours, then the right half's ("up") one.
    const inputs = screen.getAllByLabelText('common.hexColor') as HTMLInputElement[];
    expect(inputs.map(i => i.value)).toEqual(['#333333', '#444444', '#555555', '#666666', '#222222']);
    fireEvent.change(inputs[1], { target: { value: '#abcdef' } });
    expect(mockSetStrimer).toHaveBeenLastCalledWith('7880AE72AB3C', {
      scope: 'down',
      colors: ['#333333', '#abcdef', '#555555', '#666666'],
      effectMode: undefined,
    });
  });

  it('a half without a look of its own shows the whole fan look', async () => {
    await renderTl({ up: ownHalves.up, lastScope: 'up' });
    const [downMode, upMode] = screen.getAllByRole('button', { name: 'devices.lianli.lightingMode' });
    expect(upMode).toHaveTextContent('devices.lianliEffect.static');
    expect(downMode).toHaveTextContent('devices.lianliEffect.meteor');
  });

  it('picking an effect for one half starts it from its own colours', async () => {
    await renderTl(ownHalves);
    // The right half ("up") is the second picker.
    fireEvent.click(screen.getAllByLabelText('devices.lianli.lightingMode')[1]);
    await act(async () => {
      fireEvent.click(await screen.findByRole('option', { name: 'devices.lianliEffect.meteor' }));
    });
    expect(mockSetStrimer).toHaveBeenCalledWith('7880AE72AB3C', { scope: 'up', mode: 'meteor', colors: [], effectMode: undefined });
  });

  it('picking an effect for the whole fan starts it from its own colours', async () => {
    await renderTl();
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    await act(async () => {
      fireEvent.click(await screen.findByRole('option', { name: 'devices.lianliEffect.static' }));
    });
    expect(mockSetStrimer).toHaveBeenCalledWith('7880AE72AB3C', { mode: 'static', colors: [], effectMode: undefined });
    expect(screen.queryByText('devices.lianli-wireless.halfRight')).not.toBeInTheDocument();
    // The cleared palette shows the effect's own colour.
    expect((screen.getByLabelText('common.hexColor') as HTMLInputElement).value.toLowerCase()).toBe('#ff0000');
  });

  it('has no Merge while the halves play looks of their own', async () => {
    await renderTl({ mode: 'rainbow', merge: false, ...ownHalves });
    expect(screen.queryByRole('switch', { name: 'devices.lianli-wireless.merge' })).not.toBeInTheDocument();
  });

  it('keeps Merge for a mergeable whole-fan effect', async () => {
    await renderTl({ mode: 'rainbow', merge: false });
    expect(screen.getByRole('switch', { name: 'devices.lianli-wireless.merge' })).toBeInTheDocument();
  });

  it('shows the left and right swap and saves it', async () => {
    await renderTl();
    expect(screen.queryByRole('switch', { name: 'devices.lianli-flex.upDownSwap' })).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'devices.lianli-wireless.leftRightSwap' }));
    });
    expect(mockSetStrimer).toHaveBeenCalledWith('7880AE72AB3C', { upDownSwap: true, effectMode: undefined });
  });

  it('an older service without scope keeps the plain effect list, no halves switch and no swap', async () => {
    await renderTl({ supportsScope: undefined, up: undefined, down: undefined, lastScope: undefined, upDownSwap: undefined });
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    expect((await screen.findAllByRole('option')).map(o => o.textContent)).not.toContain('devices.lianli-flex.modePerZone');
    expect(screen.queryByRole('switch', { name: 'devices.lianli-wireless.separateHalves' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'devices.lianli-wireless.leftRightSwap' })).not.toBeInTheDocument();
  });

  it('Separate halves follows the motherboard and Lighting page locks', async () => {
    await renderTl({ mode: 'custom', effectMode: 'meteor' });
    expect(screen.getByRole('switch', { name: 'devices.lianli-wireless.separateHalves' })).toBeDisabled();
  });

  it('a fan with zones keeps Per zone in its mode list and has no halves switch', async () => {
    await renderTab({ ...catalog, chains: [{ ...fanChain, supportsZones: true, zones: [] }] });
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    expect((await screen.findAllByRole('option')).map(o => o.textContent)[0]).toBe('devices.lianli-flex.modePerZone');
    expect(screen.queryByRole('switch', { name: 'devices.lianli-wireless.separateHalves' })).not.toBeInTheDocument();
  });
});
