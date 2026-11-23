import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedDevice } from '../../../hooks/useUnifiedDevices';

// The Universal Screen 8.8 in its own Windows display mode lists no panel (its glass
// re-enumerates as a USB monitor), so its page must explain that instead of "not connected".

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
  }),
}));
vi.mock('../../common/Toast/Toast', () => ({
  useToast: () => ({ push: vi.fn() }),
}));
vi.mock('../../../hooks/useConflictApps', () => ({
  useConflictApps: () => ({ conflicts: [], ready: true }),
}));
vi.mock('./PanelDevicePage', () => ({
  PanelDevicePage: () => <div data-testid="panel-device-page" />,
}));

let mockUnified: UnifiedDevice[] = [];
vi.mock('../../../hooks/useUnifiedDevices', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../hooks/useUnifiedDevices')>()),
  useUnifiedDevices: () => ({ unified: mockUnified, controlDevice: vi.fn() }),
}));

const mockGetSettings = vi.fn();
vi.mock('../../../api/lianliScreen88', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../api/lianliScreen88')>()),
  getLianLiScreen88Settings: (...a: unknown[]) => mockGetSettings(...a),
  setLianLiScreen88Settings: vi.fn().mockResolvedValue(true),
}));

import { DevicePage } from './DevicePage';

function curatedRow(curatedId: string, overrides: Partial<UnifiedDevice> = {}): UnifiedDevice {
  return {
    key: `curated-${curatedId}`,
    shortName: 'Lian Li Universal Screen 8.8',
    name: 'Lian Li Universal Screen 8.8',
    subtitle: 'display',
    category: 'display',
    iconSrc: '',
    connected: true,
    kind: 'curated',
    curatedId,
    navigable: true,
    nexusControlEnabled: true,
    supportsNexusControl: true,
    experimental: false,
    requiresBeta: false,
    ...overrides,
  };
}

const route = (connected: boolean, inWindowsDisplay: boolean) => ({
  connected, inWindowsDisplay, screenMode: 'nexus', screenSaverMinutes: 0, screenSaverBrightness: 50,
});

async function renderPage(deviceKey: string) {
  await act(async () => {
    render(<DevicePage deviceKey={deviceKey} serviceOnline />);
  });
}

beforeEach(() => {
  mockUnified = [];
  mockGetSettings.mockReset();
});

describe('DevicePage for the Universal Screen 8.8 without a panel', () => {
  it('shows the Windows display view and the switch back, not "not connected"', async () => {
    mockUnified = [curatedRow('lianli-screen88')];
    mockGetSettings.mockResolvedValue(route(false, true));
    await renderPage('curated-lianli-screen88');
    expect(screen.getByText('devices.lianliScreen88.windowsDisplayActive')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'devices.lianliScreen88.windowsDisplay' })).toBeChecked();
    expect(screen.queryByText('devices.page.notConnected')).not.toBeInTheDocument();
  });

  it('still says not connected when the glass is not a Windows display either', async () => {
    mockUnified = [curatedRow('lianli-screen88')];
    mockGetSettings.mockResolvedValue(route(false, false));
    await renderPage('curated-lianli-screen88');
    expect(screen.getByText('devices.page.notConnected')).toBeInTheDocument();
    expect(screen.queryByText('devices.lianliScreen88.windowsDisplayActive')).not.toBeInTheDocument();
  });

  it('shows the Windows display view for a page whose row has left the list', async () => {
    mockGetSettings.mockResolvedValue(route(false, true));
    await renderPage('curated-lianli-screen88');
    expect(screen.getByText('Lian Li Universal Screen 8.8')).toBeInTheDocument();
    expect(screen.getByText('devices.lianliScreen88.windowsDisplayActive')).toBeInTheDocument();
  });

  it('leaves other screens alone: no 8.8 read for them', async () => {
    mockUnified = [curatedRow('lianli-hydroshift2', { shortName: 'Lian Li HydroShift II' })];
    await renderPage('curated-lianli-hydroshift2');
    expect(screen.getByText('devices.page.notConnected')).toBeInTheDocument();
    expect(mockGetSettings).not.toHaveBeenCalled();
  });
});
