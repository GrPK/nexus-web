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

  it('counts a fan chain\'s screens after its name and reports the names', async () => {
    const one = { ...fanChain, mac: 'ONE', fanCount: 1 };
    const bare = { ...fanChain, mac: 'BARE', fanType: 28 };
    const screens: Record<string, number> = { [fanChain.mac]: 3, ONE: 1 };
    const onNames = vi.fn();
    mockGetStrimers.mockResolvedValue({ ...catalog, chains: [strimer, fanChain, one, bare] });
    await act(async () => {
      render(<LianLiWirelessLightingTab screensOf={c => screens[c.mac] ?? 0} onNames={onNames} />);
    });
    const three = 'devices.lianli-hub.chainScreens:{"name":"devices.lianli-wireless.fanTypeSlv3Lcd","count":3}';
    const single = 'devices.lianli-hub.chainOneScreen:{"name":"devices.lianli-wireless.fanTypeSlv3Lcd 2"}';
    expect(screen.getByText('Strimer 24-Pin')).toBeInTheDocument();
    expect(screen.getByText(three)).toBeInTheDocument();
    expect(screen.getByText(single)).toBeInTheDocument();
    expect(screen.getByText('devices.lianli-wireless.fanTypeTlv2')).toBeInTheDocument();
    expect(onNames).toHaveBeenCalledTimes(1);
    expect([...onNames.mock.calls[0][0]]).toEqual([
      [strimer.mac, 'Strimer 24-Pin'],
      [fanChain.mac, three],
      ['BARE', 'devices.lianli-wireless.fanTypeTlv2'],
      ['ONE', single],
    ]);
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

  it('offers Per zone ahead of the effects and shows no halves while the whole fan plays one look', async () => {
    await renderTl();
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    const options = (await screen.findAllByRole('option')).map(o => o.textContent);
    expect(options).toEqual(['devices.lianli-flex.modePerZone', 'devices.lianliEffect.rainbow', 'devices.lianliEffect.static', 'devices.lianliEffect.meteor']);
    expect(screen.queryByText('devices.lianli-flex.zoneUp')).not.toBeInTheDocument();
  });

  it('picking Per zone gives the up half its own look and shows both halves', async () => {
    await renderTl();
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    await act(async () => {
      fireEvent.click(await screen.findByRole('option', { name: 'devices.lianli-flex.modePerZone' }));
    });
    expect(mockSetStrimer).toHaveBeenCalledWith('7880AE72AB3C', { scope: 'up', effectMode: undefined });
    expect(screen.getByText('devices.lianli-flex.zoneUp')).toBeInTheDocument();
    expect(screen.getByText('devices.lianli-flex.zoneDown')).toBeInTheDocument();
  });

  it('shows each half with its own look and saves a change to that half only', async () => {
    await renderTl(ownHalves);
    const [chainMode, upMode, downMode] = screen.getAllByRole('button', { name: 'devices.lianli.lightingMode' });
    expect(chainMode).toHaveTextContent('devices.lianli-flex.modePerZone');
    expect(upMode).toHaveTextContent('devices.lianliEffect.static');
    expect(downMode).toHaveTextContent('devices.lianliEffect.meteor');
    // Up's one colour, then Down's four.
    const inputs = screen.getAllByLabelText('common.hexColor') as HTMLInputElement[];
    expect(inputs.map(i => i.value)).toEqual(['#222222', '#333333', '#444444', '#555555', '#666666']);
    fireEvent.change(inputs[2], { target: { value: '#abcdef' } });
    expect(mockSetStrimer).toHaveBeenLastCalledWith('7880AE72AB3C', {
      scope: 'down',
      colors: ['#333333', '#abcdef', '#555555', '#666666'],
      effectMode: undefined,
    });
  });

  it('a half without a look of its own shows the whole fan look', async () => {
    await renderTl({ up: ownHalves.up, lastScope: 'up' });
    const [, upMode, downMode] = screen.getAllByRole('button', { name: 'devices.lianli.lightingMode' });
    expect(upMode).toHaveTextContent('devices.lianliEffect.static');
    expect(downMode).toHaveTextContent('devices.lianliEffect.meteor');
  });

  it('picking an effect for one half starts it from its own colours', async () => {
    await renderTl(ownHalves);
    fireEvent.click(screen.getAllByLabelText('devices.lianli.lightingMode')[1]);
    await act(async () => {
      fireEvent.click(await screen.findByRole('option', { name: 'devices.lianliEffect.meteor' }));
    });
    expect(mockSetStrimer).toHaveBeenCalledWith('7880AE72AB3C', { scope: 'up', mode: 'meteor', colors: [], effectMode: undefined });
  });

  it('picking an effect for the whole fan starts it from its own colours and drops both halves', async () => {
    await renderTl(ownHalves);
    fireEvent.click(screen.getAllByLabelText('devices.lianli.lightingMode')[0]);
    await act(async () => {
      fireEvent.click(await screen.findByRole('option', { name: 'devices.lianliEffect.static' }));
    });
    expect(mockSetStrimer).toHaveBeenCalledWith('7880AE72AB3C', { mode: 'static', colors: [], effectMode: undefined });
    expect(screen.queryByText('devices.lianli-flex.zoneUp')).not.toBeInTheDocument();
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

  it('shows the up and down swap and saves it', async () => {
    await renderTl();
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'devices.lianli-flex.upDownSwap' }));
    });
    expect(mockSetStrimer).toHaveBeenCalledWith('7880AE72AB3C', { upDownSwap: true, effectMode: undefined });
  });

  it('an older service without scope keeps the plain effect list and no swap', async () => {
    await renderTl({ supportsScope: undefined, up: undefined, down: undefined, lastScope: undefined, upDownSwap: undefined });
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    expect((await screen.findAllByRole('option')).map(o => o.textContent)).not.toContain('devices.lianli-flex.modePerZone');
    expect(screen.queryByRole('switch', { name: 'devices.lianli-flex.upDownSwap' })).not.toBeInTheDocument();
  });
});
