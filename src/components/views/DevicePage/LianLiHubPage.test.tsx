import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LianLiHubPage, chainGroup, chainScreens } from './LianLiHubPage';
import type { UnifiedDevice } from '../../../hooks/useUnifiedDevices';
import { HYDROSHIFT2_CURVE_LIGHTING_API } from '../../../api/hydroshift2Curve';
import { LIANLI_SCREEN88_LIGHTING_API } from '../../../api/lianliScreen88';

/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));

// The page composes the device pages' own sections; each is replaced by a marker
// that shows what it was given.
vi.mock('../../../panel/widgets/devices/DevicesPage', () => ({
  DeviceCard: ({ device, onClick, onToggleControl }: any) => (
    <div data-testid="device-card">
      {device.navigable
        ? <button data-testid="card-name" onClick={onClick}>{device.shortName}</button>
        : <span data-testid="card-name">{device.shortName}</span>}
      {onToggleControl && <button onClick={() => onToggleControl(!device.nexusControlEnabled)}>{`toggle ${device.shortName}`}</button>}
    </div>
  ),
}));
const { unitCalls, lightCards } = vi.hoisted(() => ({
  unitCalls: [] as { flex: boolean; enabled?: boolean; lightingActive: boolean }[],
  lightCards: [] as { title?: string; api?: unknown }[],
}));
vi.mock('./LianLiWirelessDevicePage', () => ({
  useLianLiUnit: (opts: any) => {
    unitCalls.push(opts);
    return { flex: opts.flex, boundMacs: [], hasScreen: true };
  },
  LianLiUnitTabBody: ({ unit, tab, embedded }: any) => (
    <div data-testid={`${unit.flex ? 'flex' : 'wireless'}-${tab}`} data-embedded={String(embedded)} />
  ),
}));
vi.mock('./lianliFanScreens', async importOriginal => ({
  ...(await importOriginal<typeof import('./lianliFanScreens')>()),
  useLianLiFanScreenCount: () => null,
}));
vi.mock('./LianLiSyncAllBar', () => ({ LianLiSyncAllBar: () => <div data-testid="sync-all" /> }));
vi.mock('./HydroShift2RingSettings', () => ({
  HydroShift2RingSettings: ({ title, api }: any) => {
    lightCards.push({ title, api });
    return <div data-testid="light-card">{title}</div>;
  },
}));
vi.mock('./HydroShift2CurveSettings', () => ({
  HydroShift2CurveSettings: () => <div data-testid="curve-screen" />,
  HydroShift2CurvePumpSettings: () => <div data-testid="curve-pump" />,
}));
vi.mock('./HydroShift2CurveHeadSettings', () => ({ HydroShift2CurveHeadSettings: () => <div data-testid="curve-head" /> }));
vi.mock('./useHydroShift2CurveScreen', () => ({ useHydroShift2CurveScreen: () => ({ settings: null, write: vi.fn() }) }));
// What the 8.8's settings route answers, and when the page reads it.
const { screen88Route } = vi.hoisted(() => ({
  screen88Route: { settings: null as null | { connected: boolean; inWindowsDisplay: boolean }, reads: [] as boolean[] },
}));
vi.mock('./useLianLiScreen88Screen', () => ({
  useLianLiScreen88Screen: (enabled: boolean) => {
    screen88Route.reads.push(enabled);
    const s = enabled ? screen88Route.settings : null;
    const view = !s ? 'none' : !s.connected && s.inWindowsDisplay ? 'windows' : s.connected ? 'panel' : 'none';
    return { settings: s, loaded: enabled, view, pendingMode: null, write: vi.fn() };
  },
}));
vi.mock('./LianLiScreen88Settings', () => ({
  LianLiScreen88Settings: ({ title }: any) => <div data-testid="screen88-screen">{title}</div>,
}));
const mockRequestEnable = vi.fn();
vi.mock('../../../hooks/useConflictGuardedEnable', () => ({
  useConflictGuardedEnable: () => ({
    requestEnable: (...a: any[]) => mockRequestEnable(...a),
    experimental: null, confirmExperimental: vi.fn(), cancelExperimental: vi.fn(),
    pending: null, confirm: vi.fn(), cancel: vi.fn(),
  }),
}));
vi.mock('../../common/ExperimentalEnableModal/ExperimentalEnableModal', () => ({ ExperimentalEnableModal: () => null }));
vi.mock('../../common/NexusControlConflictModal/NexusControlConflictModal', () => ({ NexusControlConflictModal: () => null }));

function device(key: string, curatedId: string, extra: Partial<UnifiedDevice> = {}): UnifiedDevice {
  return {
    key, shortName: key, name: `${key} name`, subtitle: '', category: 'cooler', iconSrc: '', connected: true,
    kind: 'curated', curatedId, navigable: true, nexusControlEnabled: true, supportsNexusControl: true,
    experimental: false, requiresBeta: false, groupKey: 'lianli', ...extra,
  };
}

const wireless = device('L-Wireless', 'lianli-wireless');
const flexHub = device('LCD Flex', 'lianli-flex');
const tl = device('Uni Fan TL', 'lianli-tl');
const curve = device('HydroShift II Curved', 'lianli-hydroshift2-curve', { kind: 'panel', supportsNexusControl: false });
const screen88 = device('Universal Screen 8.8', 'lianli-screen88', { kind: 'panel', supportsNexusControl: false });
// The 8.8's one row without a panel: listed while the glass is a Windows display or only its LED board is there.
const screen88Row = device('Lian Li Universal Screen 8.8', 'lianli-screen88');

const nav = vi.fn();
const controlDevice = vi.fn();

async function renderHub(members: UnifiedDevice[]) {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<LianLiHubPage members={members} controlDevice={controlDevice} onSectionNavigate={nav} />);
  });
  return view;
}

async function openTab(label: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('tab', { name: label }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '');
  unitCalls.length = 0;
  lightCards.length = 0;
  screen88Route.settings = null;
  screen88Route.reads.length = 0;
  controlDevice.mockResolvedValue(undefined);
});

/** The endpoints the last rendered light card with this title was given. */
const apiOfCard = (title: string) => lightCards.filter(c => c.title === title).slice(-1)[0]?.api;

describe('LianLiHubPage', () => {
  it('lists every Lian Li device by name; one whose controls live elsewhere opens its own page', async () => {
    await renderHub([wireless, curve, tl, screen88]);
    expect(screen.getAllByTestId('card-name').map(c => c.textContent)).toEqual([
      'HydroShift II Curved', 'L-Wireless', 'Uni Fan TL', 'Universal Screen 8.8',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Uni Fan TL' }));
    expect(nav).toHaveBeenCalledWith('device', { deviceKey: 'Uni Fan TL' });
    fireEvent.click(screen.getByRole('button', { name: 'Universal Screen 8.8' }));
    expect(nav).toHaveBeenCalledWith('device', { deviceKey: 'Universal Screen 8.8' });
  });

  it('the L-Wireless and Flex cards open their own page (which then keeps only the connection and wireless devices)', async () => {
    await renderHub([wireless, flexHub, tl]);
    fireEvent.click(screen.getByRole('button', { name: 'L-Wireless' }));
    expect(nav).toHaveBeenCalledWith('device', { deviceKey: 'L-Wireless' });
    fireEvent.click(screen.getByRole('button', { name: 'LCD Flex' }));
    expect(nav).toHaveBeenCalledWith('device', { deviceKey: 'LCD Flex' });
    fireEvent.click(screen.getByRole('button', { name: 'toggle L-Wireless' }));
    expect(controlDevice).toHaveBeenCalledWith('lianli-wireless', false);
  });

  it('Devices holds the cards only: the wireless device list stays on the controller page', async () => {
    await renderHub([wireless, flexHub]);
    expect(screen.queryByTestId('wireless-fans')).not.toBeInTheDocument();
    expect(screen.queryByTestId('flex-fans')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('device-card')).toHaveLength(2);
  });

  it('reads only the units that are present', async () => {
    await renderHub([wireless, curve]);
    expect(unitCalls.filter(c => !c.flex).every(c => c.enabled === true)).toBe(true);
    expect(unitCalls.filter(c => c.flex).every(c => c.enabled === false)).toBe(true);
  });

  it('a card switches Nexus Control: off at once, on through the conflict check', async () => {
    await renderHub([wireless, tl]);
    fireEvent.click(screen.getByRole('button', { name: 'toggle Uni Fan TL' }));
    expect(controlDevice).toHaveBeenCalledWith('lianli-tl', false);
    await renderHub([{ ...tl, key: 'tl-off', shortName: 'TL off', nexusControlEnabled: false }, wireless]);
    fireEvent.click(screen.getByRole('button', { name: 'toggle TL off' }));
    expect(mockRequestEnable).toHaveBeenCalledWith(expect.objectContaining({ key: 'tl-off' }), expect.any(Function));
  });

  it('shows all four tabs with the L-Wireless controller', async () => {
    await renderHub([wireless, curve]);
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([
      'devices.lianli-wireless.tab.devices', 'lighting.title', 'devices.lianli-wireless.tab.screen', 'cooling.title',
    ]);
  });

  it('without a controller, Flex hub or Curve there is no Cooling tab', async () => {
    await renderHub([screen88, tl]);
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([
      'devices.lianli-wireless.tab.devices', 'lighting.title', 'devices.lianli-wireless.tab.screen',
    ]);
  });

  it('the Curve\'s head position is on neither tab (only its own page); only the pump option goes under Cooling', async () => {
    await renderHub([curve, screen88]);
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toContain('cooling.title');
    await openTab('devices.lianli-wireless.tab.screen');
    expect(screen.queryByTestId('curve-head')).not.toBeInTheDocument();
    expect(screen.queryByTestId('curve-screen')).not.toBeInTheDocument();
    expect(screen.queryByTestId('curve-pump')).not.toBeInTheDocument();
    await openTab('cooling.title');
    expect(screen.getByTestId('curve-pump')).toBeInTheDocument();
    expect(screen.queryByTestId('curve-head')).not.toBeInTheDocument();
    expect(screen.queryByTestId('curve-screen')).not.toBeInTheDocument();
  });

  it('Lighting holds Sync all and every light: the units\' chains, the Curve edge and the 8.8 bezel on their own endpoints, a page link for the rest', async () => {
    await renderHub([wireless, curve, tl, screen88]);
    await openTab('lighting.title');
    expect(screen.getByTestId('sync-all')).toBeInTheDocument();
    // One body per group (Strimers, fans, fans with screens) for the controller, none for an absent Flex hub.
    expect(screen.getAllByTestId('wireless-lighting')).toHaveLength(3);
    expect(screen.queryByTestId('flex-lighting')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('light-card').map(c => c.textContent)).toEqual(['HydroShift II Curved', 'Universal Screen 8.8']);
    expect(apiOfCard('HydroShift II Curved')).toBe(HYDROSHIFT2_CURVE_LIGHTING_API);
    expect(apiOfCard('Universal Screen 8.8')).toBe(LIANLI_SCREEN88_LIGHTING_API);
    expect(unitCalls.slice(-2).every(c => c.lightingActive)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'lighting.devices.menuOpenDevicePage' }));
    expect(nav).toHaveBeenCalledWith('device', { deviceKey: 'Uni Fan TL' });
  });

  it('the HydroShift II pump ring keeps its default endpoints', async () => {
    await renderHub([wireless, device('HydroShift II', 'lianli-hydroshift2', { kind: 'panel' })]);
    await openTab('lighting.title');
    expect(screen.getByTestId('light-card')).toHaveTextContent('HydroShift II');
    expect(apiOfCard('HydroShift II')).toBeUndefined();
  });

  it('Screens holds one named card per screen and none of their settings', async () => {
    await renderHub([wireless, curve, screen88]);
    await openTab('devices.lianli-wireless.tab.screen');
    expect(screen.getAllByTestId('card-name').map(c => c.textContent)).toEqual([
      'devices.lianli-hub.fanScreens:{"name":"Lian Li Wireless"}', 'devices.lianli-hub.screenTitle:{"name":"HydroShift II Curved"}', 'Universal Screen 8.8',
    ]);
    for (const id of ['wireless-screen', 'curve-screen', 'screen88-screen', 'curve-head']) {
      expect(screen.queryByTestId(id)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'devices.lianli-wireless.openPanel' })).not.toBeInTheDocument();
  });

  it('a screen card opens that screen\'s own page; a fan screens card opens the unit\'s fan screens page, not the unit\'s', async () => {
    await renderHub([wireless, flexHub, curve, screen88]);
    await openTab('devices.lianli-wireless.tab.screen');
    fireEvent.click(screen.getByRole('button', { name: 'Universal Screen 8.8' }));
    expect(nav).toHaveBeenLastCalledWith('device', { deviceKey: 'Universal Screen 8.8' });
    fireEvent.click(screen.getByRole('button', { name: 'devices.lianli-hub.screenTitle:{"name":"HydroShift II Curved"}' }));
    expect(nav).toHaveBeenLastCalledWith('device', { deviceKey: 'HydroShift II Curved' });
    fireEvent.click(screen.getByRole('button', { name: 'devices.lianli-hub.fanScreens:{"name":"Lian Li Flex"}' }));
    expect(nav).toHaveBeenLastCalledWith('device', { deviceKey: 'lianli-fan-screens:flex' });
    fireEvent.click(screen.getByRole('button', { name: 'devices.lianli-hub.fanScreens:{"name":"Lian Li Wireless"}' }));
    expect(nav).toHaveBeenLastCalledWith('device', { deviceKey: 'lianli-fan-screens:wireless' });
  });

  it('the 8.8 as a panel needs no settings read: its card is there, the route is not polled', async () => {
    await renderHub([wireless, screen88]);
    await openTab('devices.lianli-wireless.tab.screen');
    expect(screen88Route.reads.every(r => r === false)).toBe(true);
    expect(screen.getByRole('button', { name: 'Universal Screen 8.8' })).toBeInTheDocument();
  });

  it("with the glass a Windows display, the 8.8's row without a panel brings it to Screens and Lighting", async () => {
    screen88Route.settings = { connected: false, inWindowsDisplay: true };
    await renderHub([tl, screen88Row]);
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([
      'devices.lianli-wireless.tab.devices', 'lighting.title', 'devices.lianli-wireless.tab.screen',
    ]);
    await openTab('devices.lianli-wireless.tab.screen');
    expect(screen.queryByTestId('screen88-screen')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lian Li Universal Screen 8.8' }));
    // Its own page offers the switch back (LianLiScreen88PageGate).
    expect(nav).toHaveBeenLastCalledWith('device', { deviceKey: 'Lian Li Universal Screen 8.8' });
    await openTab('lighting.title');
    expect(apiOfCard('Lian Li Universal Screen 8.8')).toBe(LIANLI_SCREEN88_LIGHTING_API);
    // The 8.8's lights are on this card: only the TL gets an "Open device page" row.
    expect(screen.getAllByRole('button', { name: 'lighting.devices.menuOpenDevicePage' })).toHaveLength(1);
  });

  it("the 8.8's row without a panel or a Windows display adds no Screens tab", async () => {
    screen88Route.settings = { connected: false, inWindowsDisplay: false };
    await renderHub([tl, screen88Row]);
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([
      'devices.lianli-wireless.tab.devices', 'lighting.title',
    ]);
  });

  it('Back from a page it opened returns to the tab it was left on, once', async () => {
    window.history.replaceState({ idx: 3 }, '');
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<LianLiHubPage members={[wireless, curve]} controlDevice={controlDevice} onSectionNavigate={nav} />);
    });
    await openTab('devices.lianli-wireless.tab.screen');
    fireEvent.click(screen.getByRole('button', { name: 'devices.lianli-hub.screenTitle:{"name":"HydroShift II Curved"}' }));
    // The tab is kept on the hub's own history entry, next to the router's index.
    expect(window.history.state).toEqual({ idx: 3, lianliHubTab: 'screens' });
    view.unmount();
    // Back: the same entry, so the page opens on the tab it was left on.
    view = await renderHub([wireless, curve]);
    expect(screen.getByRole('tab', { name: 'devices.lianli-wireless.tab.screen' })).toHaveAttribute('aria-selected', 'true');
    expect(window.history.state).toEqual({ idx: 3 });
    view.unmount();
    // Used once: the same entry again opens on Devices.
    await renderHub([wireless, curve]);
    expect(screen.getByRole('tab', { name: 'devices.lianli-wireless.tab.devices' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens on Devices on a fresh visit, whatever tab another visit left', async () => {
    window.history.replaceState({ idx: 3 }, '');
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<LianLiHubPage members={[wireless, curve]} controlDevice={controlDevice} onSectionNavigate={nav} />);
    });
    await openTab('devices.lianli-wireless.tab.screen');
    fireEvent.click(screen.getByRole('button', { name: 'devices.lianli-hub.screenTitle:{"name":"HydroShift II Curved"}' }));
    view.unmount();
    // The sidebar pushes a new entry, which carries only the router's index.
    window.history.pushState({ idx: 5 }, '');
    await renderHub([wireless, curve]);
    expect(screen.getByRole('tab', { name: 'devices.lianli-wireless.tab.devices' })).toHaveAttribute('aria-selected', 'true');
  });

  it('groups the Lighting chains: Strimers, fans without screens, fans with screens (most screens first)', () => {
    const unit = { state: { fans: [{ mac: 'FLEX1', screenSerial: 'S1' }, { mac: 'FLEX2', screenSerial: '' }] } } as any;
    const chain = (mac: string, kind: 'strimer' | 'fans', fanType = 0, fanCount = 1) => ({ mac, kind, fanType, fanCount }) as any;
    expect(chainGroup(unit, chain('S', 'strimer'))).toBe('strimers');
    expect(chainGroup(unit, chain('TL', 'fans', 28, 3))).toBe('fans');
    expect(chainGroup(unit, chain('FLEX2', 'fans', 51))).toBe('fans');
    expect(chainGroup(unit, chain('FLEX1', 'fans', 51))).toBe('screens');
    expect(chainScreens(unit, chain('LCD3', 'fans', 24, 3))).toBe(3);
    expect(chainScreens(unit, chain('TLLCD', 'fans', 27, 2))).toBe(2);
    expect(chainScreens(unit, chain('FLEX1', 'fans', 51))).toBe(1);
  });

  it('Cooling holds the fans and pump of the controller and the Flex hub', async () => {
    await renderHub([wireless, flexHub]);
    await openTab('cooling.title');
    expect(screen.getByTestId('wireless-cooling')).toBeInTheDocument();
    expect(screen.getByTestId('flex-cooling')).toBeInTheDocument();
  });
});
