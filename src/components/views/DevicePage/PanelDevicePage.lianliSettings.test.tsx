import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Lian Li screens' Settings tab holds only the screen's own options: their LEDs are
// on the Lian Li page's Lighting tab and the Curve's pump option on its Cooling tab.

const fetchPanelDevicesMock = vi.fn();

vi.mock('../../../api/service', () => ({
  fetchService: vi.fn().mockResolvedValue(null),
  postService: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../api/displays', () => ({
  demoteDisplayPanel: vi.fn().mockResolvedValue(null),
  fetchDisplays: vi.fn().mockResolvedValue({ displays: [] }),
  fetchDisplayTopology: vi.fn().mockResolvedValue({
    hostingSupported: true,
    rotationSupported: false,
    reserveSupported: false,
    positionsAvailable: true,
    revision: 1,
    displays: [],
    hint: '',
  }),
  rotateDisplay: vi.fn().mockResolvedValue(null),
  setDisplayBrightness: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../api/profiles', () => ({
  fetchPreferences: vi.fn().mockResolvedValue({ panel: { autoLaunch: false, reserveMonitor: true } }),
  savePreferences: vi.fn().mockResolvedValue(null),
}));
vi.mock('./PanelPresetToolbar', () => ({ PanelPresetToolbar: () => null }));
vi.mock('../../../api/panel', () => ({
  fetchPanelDeviceWithStatus: vi.fn().mockResolvedValue({ found: false, status: 404 }),
  allocatePanelDevice: vi.fn().mockResolvedValue({ id: 'dev1' }),
  fetchPanelDevice: vi.fn().mockResolvedValue(null),
  fetchPanelDevices: (...a: unknown[]) => fetchPanelDevicesMock(...a),
  patchPanelDevice: vi.fn().mockResolvedValue({ ok: true }),
  resetPanelDevice: vi.fn().mockResolvedValue({ ok: true }),
  resetPanelDeviceHardware: vi.fn().mockResolvedValue({ id: 'rec1' }),
}));
vi.mock('../../../hooks/useMultiplexSocket', () => ({
  useTopicCallback: () => {},
}));
vi.mock('../../../panel/engine/panelSync', () => ({
  broadcastLayoutChanged: vi.fn(),
}));
vi.mock('../../../panel/theme/panelTheme', () => ({
  usePanelTheme: () => ({
    theme: { themeSyncWithDesktop: false, themeMode: 'dark', appThemeMode: 'dark', appResolvedThemeMode: 'dark', gaugeGradient: [] },
    commitThemeSync: vi.fn(), commitThemeMode: vi.fn(), commitAccentSync: vi.fn(),
    previewAccent: vi.fn(), commitAccent: vi.fn(), previewBackground: vi.fn(),
    commitBackground: vi.fn(), commitBackgroundMode: vi.fn(), commitBackgroundEffect: vi.fn(),
    commitBackgroundTemplate: vi.fn(), previewBackgroundEffectState: vi.fn(), commitBackgroundEffectState: vi.fn(),
    previewBackgroundOpacity: vi.fn(), commitBackgroundOpacity: vi.fn(), previewWidgetOpacity: vi.fn(),
    commitWidgetOpacity: vi.fn(), commitWidgetLabels: vi.fn(), commitBackgroundFrost: vi.fn(),
  }),
  buildPanelThemeVars: () => ({}),
  panelAccentColor: () => '#2563eb',
  useResolvedPanelThemeMode: () => 'dark',
}));
vi.mock('../../../panel/editor/PanelWidgetCatalog', () => ({
  PanelWidgetCatalog: () => <div data-testid="catalog" />,
}));
vi.mock('../../../panel/editor/PanelThemeSettings', () => ({
  PanelThemeSettings: () => <div data-testid="theme" />,
}));
vi.mock('../../../panel/widgets/registry', () => ({
  lookupApp: (type: string) => ({
    meta: { type, i18nKey: 'k', sizes: ['2x2'], defaultSize: '2x2', icon: () => null },
    Widget: () => <div data-testid="widget-preview" />,
    Settings: undefined,
  }),
  sizesForSurface: () => ['2x2'],
  appAvailableForSurface: () => true,
}));
vi.mock('./PanelEmbedFrame', () => ({
  PanelEmbedFrame: () => <div data-testid="embed" />,
}));
vi.mock('../../../panel/widgets/monitoring/picker/SensorPicker', () => ({
  useSensorLookup: () => ({ resolve: () => undefined }),
  SensorPicker: () => <div data-testid="sensor-picker" />,
}));
vi.mock('../../common/Toast/Toast', () => ({
  useToast: () => ({ push: vi.fn() }),
  useToastSafe: () => ({ push: vi.fn() }),
}));

// The device sections, as markers.
vi.mock('./HydroShift2RingSettings', () => ({ HydroShift2RingSettings: () => <div data-testid="led-card" /> }));
vi.mock('./HydroShift2CurveHeadSettings', () => ({ HydroShift2CurveHeadSettings: () => <div data-testid="curve-head" /> }));
vi.mock('./HydroShift2CurveSettings', () => ({
  HydroShift2CurveSettings: () => <div data-testid="curve-screen" />,
  HydroShift2CurvePumpSettings: () => <div data-testid="curve-pump" />,
}));
vi.mock('./useHydroShift2CurveScreen', () => ({
  useHydroShift2CurveScreen: () => ({ settings: null, write: vi.fn(), playingClip: null }),
}));
vi.mock('./LianLiScreen88Settings', () => ({ LianLiScreen88Settings: () => <div data-testid="screen88-screen" /> }));
vi.mock('./useLianLiScreen88Screen', () => ({
  useLianLiScreen88Screen: () => ({ settings: null, loaded: true, write: vi.fn(), playingClip: null }),
}));

import { PanelDevicePage } from './PanelDevicePage';
import type { PanelDevice } from '../../../panel/device/panelDevices';

const DEVICE: PanelDevice = {
  id: 'display:rec1',
  name: 'Lian Li screen',
  connectionKind: 'attached-monitor',
  surfaceProfileKey: 'monitor-rec1',
  runtimeSurface: 'monitor',
  displayId: 'disp1',
  panelRecordId: 'rec1',
  capabilities: {
    layout: true, theme: true, displayControls: false, launchClose: false,
    pairing: false, presence: false, touch: false,
  },
} as PanelDevice;

function recordOfFamily(family: string) {
  fetchPanelDevicesMock.mockResolvedValue({
    devices: [{ id: 'rec1', displayId: 'disp1', capabilities: { surface: 'monitor', family } }],
  });
}

async function openSettings() {
  render(<PanelDevicePage device={DEVICE} />);
  fireEvent.click(await screen.findByRole('tab', { name: 'devices.y70.tab.settings' }));
}

beforeEach(() => {
  fetchPanelDevicesMock.mockReset();
});

describe('PanelDevicePage Settings tab of the Lian Li screens', () => {
  it('the OLED Curved keeps its head and screen, without its edge LEDs or the pump option', async () => {
    recordOfFamily('lianli-hydroshift2-curve');
    await openSettings();
    expect(await screen.findByTestId('curve-screen')).toBeInTheDocument();
    expect(screen.getByTestId('curve-head')).toBeInTheDocument();
    expect(screen.queryByTestId('led-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('curve-pump')).not.toBeInTheDocument();
  });

  it('the Universal Screen 8.8 shows its screen section, without its bezel LEDs', async () => {
    recordOfFamily('lianli-screen88');
    await openSettings();
    expect(await screen.findByTestId('screen88-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('led-card')).not.toBeInTheDocument();
  });

  it('the HydroShift II LCD keeps its pump ring card', async () => {
    recordOfFamily('lianli-hydroshift2');
    await openSettings();
    expect(await screen.findByTestId('led-card')).toBeInTheDocument();
  });
});
