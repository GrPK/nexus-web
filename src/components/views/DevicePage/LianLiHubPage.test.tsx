import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LianLiHubPage } from './LianLiHubPage';
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
    return { settings: enabled ? screen88Route.settings : null, loaded: enabled, write: vi.fn() };
  },
  isScreen88InWindowsDisplay: (s: { connected: boolean; inWindowsDisplay: boolean } | null) => !!s && !s.connected && s.inWindowsDisplay,
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
// The bezel LED board, listed on its own switch with no page of its own.
const screen88Led = device('Universal Screen 8.8 LEDs', 'lianli-screen88-led', { navigable: false });

const nav = vi.fn();
const controlDevice = vi.fn();

async function renderHub(members: UnifiedDevice[]) {
  await act(async () => {
    render(<LianLiHubPage members={members} controlDevice={controlDevice} onSectionNavigate={nav} />);
  });
}

async function openTab(label: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('tab', { name: label }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
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

  it('the Curve\'s head position stays with its screen under Screens; only the pump option goes under Cooling', async () => {
    await renderHub([curve, screen88]);
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toContain('cooling.title');
    await openTab('devices.lianli-wireless.tab.screen');
    expect(screen.getByTestId('curve-head')).toBeInTheDocument();
    expect(screen.getByTestId('curve-screen')).toBeInTheDocument();
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
    expect(screen.getByTestId('wireless-lighting')).toBeInTheDocument();
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

  it('Screens holds the units\' LCDs, the Curve screen and a panel link for every Lian Li screen', async () => {
    await renderHub([wireless, curve, screen88]);
    await openTab('devices.lianli-wireless.tab.screen');
    expect(screen.getByTestId('wireless-screen')).toBeInTheDocument();
    expect(screen.getByTestId('curve-screen')).toBeInTheDocument();
    const opens = screen.getAllByRole('button', { name: 'devices.lianli-wireless.openPanel' });
    expect(opens).toHaveLength(2);
    fireEvent.click(opens[1]);
    expect(nav).toHaveBeenCalledWith('device', { deviceKey: 'Universal Screen 8.8' });
  });

  it('Screens holds the 8.8 screen under its name, read only while Screens is open', async () => {
    screen88Route.settings = { connected: true, inWindowsDisplay: false };
    await renderHub([wireless, screen88]);
    expect(screen88Route.reads.every(r => r === false)).toBe(true);
    expect(screen.queryByTestId('screen88-screen')).not.toBeInTheDocument();
    await openTab('devices.lianli-wireless.tab.screen');
    expect(screen88Route.reads.slice(-1)[0]).toBe(true);
    expect(screen.getByTestId('screen88-screen')).toHaveTextContent('Universal Screen 8.8');
    expect(screen.getAllByRole('button', { name: 'devices.lianli-wireless.openPanel' })).toHaveLength(1);
  });

  it('with the glass a Windows display, its LED board alone brings the 8.8 to Screens and Lighting', async () => {
    screen88Route.settings = { connected: false, inWindowsDisplay: true };
    await renderHub([tl, screen88Led]);
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([
      'devices.lianli-wireless.tab.devices', 'lighting.title', 'devices.lianli-wireless.tab.screen',
    ]);
    await openTab('devices.lianli-wireless.tab.screen');
    expect(screen.getByTestId('screen88-screen')).toHaveTextContent('Lian Li Universal Screen 8.8');
    await openTab('lighting.title');
    expect(apiOfCard('Lian Li Universal Screen 8.8')).toBe(LIANLI_SCREEN88_LIGHTING_API);
    // The LED board has no page: only the TL gets an "Open device page" row.
    expect(screen.getAllByRole('button', { name: 'lighting.devices.menuOpenDevicePage' })).toHaveLength(1);
  });

  it('the LED board without a Windows display adds no Screens tab', async () => {
    screen88Route.settings = { connected: false, inWindowsDisplay: false };
    await renderHub([tl, screen88Led]);
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([
      'devices.lianli-wireless.tab.devices', 'lighting.title',
    ]);
  });

  it('Cooling holds the fans and pump of the controller and the Flex hub', async () => {
    await renderHub([wireless, flexHub]);
    await openTab('cooling.title');
    expect(screen.getByTestId('wireless-cooling')).toBeInTheDocument();
    expect(screen.getByTestId('flex-cooling')).toBeInTheDocument();
  });
});
