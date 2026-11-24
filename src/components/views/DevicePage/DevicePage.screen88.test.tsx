import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedDevice } from '../../../hooks/useUnifiedDevices';
import type { PanelDevice } from '../../../panel/device/panelDevices';

/* eslint-disable @typescript-eslint/no-explicit-any */

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
const mockSetSettings = vi.fn();
vi.mock('../../../api/lianliScreen88', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../api/lianliScreen88')>()),
  getLianLiScreen88Settings: (...a: unknown[]) => mockGetSettings(...a),
  setLianLiScreen88Settings: (...a: unknown[]) => mockSetSettings(...a),
}));

import { DevicePage } from './DevicePage';
import { resetScreen88PendingMode } from './useLianLiScreen88Screen';
import { MultiplexContext } from '../../../hooks/useMultiplexSocket';

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

const route = (connected: boolean, inWindowsDisplay: boolean, windowsDisplay?: boolean) => ({
  connected, inWindowsDisplay, windowsDisplay, screenMode: 'nexus', screenSaverMinutes: 0, screenSaverBrightness: 50,
});

/** The 8.8's panel row, which claims the curated key while the glass is a panel. */
function panelRow(): UnifiedDevice {
  return {
    key: 'panel-stream-rec88',
    shortName: 'Lian Li Universal Screen 8.8',
    name: 'Lian Li Universal Screen 8.8',
    subtitle: 'Online',
    category: 'display',
    iconSrc: '',
    connected: true,
    kind: 'panel',
    panelDevice: { id: 'stream-rec88', panelRecordId: 'rec88', sourceId: 'lianli-screen88' } as PanelDevice,
    curatedId: 'lianli-screen88',
    navigable: true,
    nexusControlEnabled: true,
    supportsNexusControl: true,
    experimental: false,
    requiresBeta: false,
  };
}

const page = () => <DevicePage deviceKey="curated-lianli-screen88" serviceOnline />;

// The service's push channel: the 8.8's page reads its settings again on these frames, never on a timer.
const topicListeners = new Map<string, Set<(data: unknown) => void>>();
const mux = {
  subscribe: (topic: string, listener: (data: unknown) => void) => {
    if (!topicListeners.has(topic)) topicListeners.set(topic, new Set());
    topicListeners.get(topic)!.add(listener);
  },
  unsubscribe: (topic: string, listener: (data: unknown) => void) => { topicListeners.get(topic)?.delete(listener); },
  connected: true,
} as any;
const Mux = ({ children }: { children: React.ReactNode }) => (
  <MultiplexContext.Provider value={mux}>{children}</MultiplexContext.Provider>
);
async function push(topic = 'devices') {
  await act(async () => { topicListeners.get(topic)?.forEach(listener => listener({})); });
}

async function renderPage(deviceKey: string) {
  await act(async () => {
    render(<DevicePage deviceKey={deviceKey} serviceOnline />, { wrapper: Mux });
  });
}

beforeEach(() => {
  mockUnified = [];
  resetScreen88PendingMode();
  mockGetSettings.mockReset();
  mockSetSettings.mockReset().mockResolvedValue(true);
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

  it('follows a round trip panel, Windows display, panel: at once on a press, then from the service, not from the list', async () => {
    // A Windows display: the 8.8's row without a panel.
    mockUnified = [curatedRow('lianli-screen88')];
    mockGetSettings.mockResolvedValue(route(false, true, true));
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(page(), { wrapper: Mux }); });
    expect(screen.getByText('devices.lianliScreen88.windowsDisplayActive')).toBeInTheDocument();

    // Turned off: at once the switch alone, restarting; then the panel row claims the page.
    fireEvent.click(screen.getByRole('switch', { name: 'devices.lianliScreen88.windowsDisplay' }));
    fireEvent.click(await screen.findByRole('button', { name: 'devices.lianliScreen88.restartScreen' }));
    expect(screen.queryByText('devices.lianliScreen88.windowsDisplayActive')).not.toBeInTheDocument();
    expect(screen.getByText('devices.lianliScreen88.restarting')).toBeInTheDocument();
    expect(screen.queryByText('devices.page.notConnected')).not.toBeInTheDocument();
    await waitFor(() => expect(mockSetSettings).toHaveBeenCalledWith({ windowsDisplay: false }));
    mockGetSettings.mockResolvedValue(route(true, false, false));
    mockUnified = [panelRow()];
    await act(async () => { view.rerender(page()); });
    expect(await screen.findByTestId('panel-device-page')).toBeInTheDocument();

    // Back to a Windows display: the service's push brings the view while the list still shows the panel row.
    mockGetSettings.mockResolvedValue(route(false, true, true));
    await push('devices');
    expect(screen.queryByTestId('panel-device-page')).not.toBeInTheDocument();
    expect(screen.getByText('devices.lianliScreen88.windowsDisplayActive')).toBeInTheDocument();
    expect(screen.queryByText('devices.page.notConnected')).not.toBeInTheDocument();

    // The panel row then goes, or is left offline: still the Windows display view.
    mockUnified = [{ ...panelRow(), connected: false }];
    await act(async () => { view.rerender(page()); });
    expect(screen.getByText('devices.lianliScreen88.windowsDisplayActive')).toBeInTheDocument();
    mockUnified = [curatedRow('lianli-screen88')];
    await act(async () => { view.rerender(page()); });
    expect(screen.getByText('devices.lianliScreen88.windowsDisplayActive')).toBeInTheDocument();

    // And back to a panel.
    mockGetSettings.mockResolvedValue(route(true, false, false));
    mockUnified = [panelRow()];
    await act(async () => { view.rerender(page()); });
    expect(await screen.findByTestId('panel-device-page')).toBeInTheDocument();
  });

  it("keeps the Windows display view on the panel page's own key once its row has gone", async () => {
    mockUnified = [panelRow()];
    mockGetSettings.mockResolvedValue(route(true, false));
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<DevicePage deviceKey="panel-stream-rec88" serviceOnline />, { wrapper: Mux }); });
    expect(screen.getByTestId('panel-device-page')).toBeInTheDocument();
    mockGetSettings.mockResolvedValue(route(false, true, true));
    mockUnified = [];
    await act(async () => { view.rerender(<DevicePage deviceKey="panel-stream-rec88" serviceOnline />); });
    expect(screen.getByText('devices.lianliScreen88.windowsDisplayActive')).toBeInTheDocument();
  });
});
