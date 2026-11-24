import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedDevice } from '../../../hooks/useUnifiedDevices';

/* eslint-disable @typescript-eslint/no-explicit-any */

// The Lian Li page's "<unit> fan screens" card opens a page of its own: the unit's screen
// settings alone, under its own title, standing on the unit's row.

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
vi.mock('./LianLiWirelessDevicePage', () => ({
  LianLiWirelessDevicePage: ({ flex, devicesOnly }: any) => (
    <div data-testid="unit-page" data-flex={String(!!flex)} data-devices-only={String(!!devicesOnly)} />
  ),
  LianLiFanScreensPage: ({ flex }: any) => <div data-testid="fan-screens-page" data-flex={String(!!flex)} />,
  LianLiUnitTabBody: () => null,
  useLianLiUnit: () => ({ flex: false, boundMacs: [], hasScreen: true }),
}));

vi.mock('./lianliFanScreens', async importOriginal => ({
  ...(await importOriginal<typeof import('./lianliFanScreens')>()),
  useLianLiFanScreenCount: () => null,
}));

let mockUnified: UnifiedDevice[] = [];
vi.mock('../../../hooks/useUnifiedDevices', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../hooks/useUnifiedDevices')>()),
  useUnifiedDevices: () => ({ unified: mockUnified, controlDevice: vi.fn() }),
}));

import { DevicePage } from './DevicePage';

function unitRow(curatedId: string, shortName: string): UnifiedDevice {
  return {
    key: `curated-${curatedId}`,
    shortName,
    name: shortName,
    subtitle: 'controller',
    category: 'controller',
    iconSrc: '',
    connected: true,
    kind: 'curated',
    curatedId,
    navigable: true,
    nexusControlEnabled: true,
    supportsNexusControl: true,
    experimental: false,
    requiresBeta: false,
    groupKey: 'lianli',
  };
}

const onTitleChange = vi.fn();

async function renderPage(deviceKey: string) {
  await act(async () => {
    render(<DevicePage deviceKey={deviceKey} serviceOnline onTitleChange={onTitleChange} />);
  });
}

beforeEach(() => {
  mockUnified = [unitRow('lianli-wireless', 'Lian Li L-Wireless Controller'), unitRow('lianli-flex', 'Lian Li LCD Flex')];
  onTitleChange.mockReset();
});

describe('DevicePage fan screens pages', () => {
  it('opens the controller\'s fan screens page under its own title', async () => {
    await renderPage('lianli-fan-screens:wireless');
    expect(screen.getByTestId('fan-screens-page')).toHaveAttribute('data-flex', 'false');
    expect(screen.queryByTestId('unit-page')).not.toBeInTheDocument();
    expect(onTitleChange).toHaveBeenLastCalledWith(
      'lianli-fan-screens:wireless', 'devices.lianli-hub.fanScreens:{"name":"Lian Li Wireless"}');
  });

  it('opens the Flex hub\'s fan screens page', async () => {
    await renderPage('lianli-fan-screens:flex');
    expect(screen.getByTestId('fan-screens-page')).toHaveAttribute('data-flex', 'true');
  });

  it('the grouped unit\'s own page keeps only its connection and wireless devices', async () => {
    await renderPage('curated-lianli-wireless');
    expect(screen.getByTestId('unit-page')).toHaveAttribute('data-devices-only', 'true');
    expect(screen.queryByTestId('fan-screens-page')).not.toBeInTheDocument();
  });

  it('says not connected when the unit is gone', async () => {
    mockUnified = [];
    await renderPage('lianli-fan-screens:wireless');
    expect(screen.queryByTestId('fan-screens-page')).not.toBeInTheDocument();
  });
});
