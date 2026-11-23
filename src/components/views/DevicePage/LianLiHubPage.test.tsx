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
vi.mock('./HydroShift2CurveSettings', () => ({ HydroShift2CurveSettings: () => <div data-testid="curve-screen" /> }));
vi.mock('./useHydroShift2CurveScreen', () => ({ useHydroShift2CurveScreen: () => ({ settings: null, write: vi.fn() }) }));
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

  it('the L-Wireless controller and the Flex hub live on this page: their cards open nothing but keep Nexus Control', async () => {
    await renderHub([wireless, flexHub, tl]);
    expect(screen.queryByRole('button', { name: 'L-Wireless' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'LCD Flex' })).not.toBeInTheDocument();
    expect(screen.getByText('L-Wireless')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'toggle L-Wireless' }));
    expect(controlDevice).toHaveBeenCalledWith('lianli-wireless', false);
    expect(nav).not.toHaveBeenCalled();
  });

  it('Devices holds both units\' fan chains and binding, without links to their own pages', async () => {
    await renderHub([wireless, flexHub]);
    expect(screen.getByTestId('wireless-fans')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByTestId('flex-fans')).toHaveAttribute('data-embedded', 'true');
  });

  it('reads only the units that are present', async () => {
    await renderHub([wireless, curve]);
    expect(unitCalls.filter(c => !c.flex).every(c => c.enabled === true)).toBe(true);
    expect(unitCalls.filter(c => c.flex).every(c => c.enabled === false)).toBe(true);
    expect(screen.queryByTestId('flex-fans')).not.toBeInTheDocument();
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

  it('without the controller or Flex hub there is no Cooling tab', async () => {
    await renderHub([curve, screen88]);
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([
      'devices.lianli-wireless.tab.devices', 'lighting.title', 'devices.lianli-wireless.tab.screen',
    ]);
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

  it('Cooling holds the fans and pump of the controller and the Flex hub', async () => {
    await renderHub([wireless, flexHub]);
    await openTab('cooling.title');
    expect(screen.getByTestId('wireless-cooling')).toBeInTheDocument();
    expect(screen.getByTestId('flex-cooling')).toBeInTheDocument();
  });
});
