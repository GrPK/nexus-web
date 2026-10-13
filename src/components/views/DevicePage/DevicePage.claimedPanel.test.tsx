import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedDevice } from '../../../hooks/useUnifiedDevices';
import type { PanelDevice } from '../../../panel/device/panelDevices';

// A cooler LCD opened from its curated row (Nexus Control off) is replaced by
// its streamed panel row once the hub connects; the page shows it in place.

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

import { DevicePage } from './DevicePage';

const HANDLER = 'lianli-hydroshift2';

function curatedRow(overrides: Partial<UnifiedDevice> = {}): UnifiedDevice {
  return {
    key: `curated-${HANDLER}`,
    shortName: 'Lian Li HydroShift II',
    name: 'Lian Li HydroShift II',
    subtitle: 'cooler',
    category: 'cooler',
    iconSrc: '',
    connected: true,
    kind: 'curated',
    curatedId: HANDLER,
    navigable: true,
    nexusControlEnabled: false,
    supportsNexusControl: true,
    // Experimental devices confirm through a modal first.
    experimental: false,
    ...overrides,
  };
}

function panelRow(): UnifiedDevice {
  return {
    key: 'panel-stream-rec1',
    shortName: 'Lian Li HydroShift II LCD-S',
    name: 'Lian Li HydroShift II LCD-S',
    subtitle: 'Online',
    category: 'display',
    iconSrc: '',
    connected: true,
    kind: 'panel',
    panelDevice: { id: 'stream-rec1', panelRecordId: 'rec1', sourceId: HANDLER } as PanelDevice,
    curatedId: HANDLER,
    navigable: true,
    nexusControlEnabled: true,
    supportsNexusControl: true,
    experimental: true,
  };
}

beforeEach(() => {
  mockUnified = [];
});

describe('DevicePage curated row claimed by its panel', () => {
  it('shows the Nexus Control off gate while the curated row stands alone', () => {
    mockUnified = [curatedRow()];
    const navigate = vi.fn();
    render(<DevicePage deviceKey={`curated-${HANDLER}`} serviceOnline onSectionNavigate={navigate} />);

    expect(screen.getByRole('switch', { name: 'devices.nexusControl' })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows the panel page in place once the panel row claims the curated key', () => {
    mockUnified = [panelRow()];
    const navigate = vi.fn();
    render(<DevicePage deviceKey={`curated-${HANDLER}`} serviceOnline onSectionNavigate={navigate} />);

    expect(screen.getByTestId('panel-device-page')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('holds the detecting screen after enable until the panel arrives', () => {
    mockUnified = [curatedRow()];
    const view = render(<DevicePage deviceKey={`curated-${HANDLER}`} serviceOnline />);
    fireEvent.click(screen.getByRole('switch', { name: 'devices.nexusControl' }));

    mockUnified = [curatedRow({ nexusControlEnabled: true })];
    view.rerender(<DevicePage deviceKey={`curated-${HANDLER}`} serviceOnline />);
    expect(screen.getByText('devices.nexusControlOff.detecting')).toBeInTheDocument();

    mockUnified = [panelRow()];
    view.rerender(<DevicePage deviceKey={`curated-${HANDLER}`} serviceOnline />);
    expect(screen.queryByText('devices.nexusControlOff.detecting')).not.toBeInTheDocument();
    expect(screen.getByTestId('panel-device-page').parentElement?.className).toMatch(/bodyShown/);
  });

  it('shows not connected while control is on and no panel has come', () => {
    mockUnified = [curatedRow({ nexusControlEnabled: true })];
    render(<DevicePage deviceKey={`curated-${HANDLER}`} serviceOnline />);

    expect(screen.getByText('devices.page.notConnected')).toBeInTheDocument();
  });
});
