import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LianLiTlDevicePage } from './LianLiTlDevicePage';

/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
  }),
}));

const mockState = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockScreens = vi.fn();
const mockScreenContent = vi.fn();

vi.mock('../../../api/lianli-wireless', () => ({
  getLianLiWirelessMedia: () => Promise.resolve([]),
  setLianLiWirelessScreenSettings: () => Promise.resolve(true),
  setLianLiWirelessScreenContent: () => Promise.resolve(true),
  setLianLiWirelessScreenOrder: () => Promise.resolve(true),
  getLianLiWirelessScreens: () => Promise.resolve([]),
  importLianLiWirelessMedia: () => Promise.resolve(null),
  deleteLianLiWirelessMedia: () => Promise.resolve(true),
  getLianLiAioScreen: () => Promise.resolve(null),
  setLianLiAioScreen: () => Promise.resolve(true),
}));

vi.mock('../../../api/lianli-tl', () => ({
  lianLiTlScreenApi: {
    getScreens: (...args: any[]) => mockScreens(...args),
    setSettings: () => Promise.resolve(true),
    setOrder: () => Promise.resolve(true),
    setContent: (...args: any[]) => mockScreenContent(...args),
  },
  getLianLiTlState: (...args: any[]) => mockState(...args),
  getLianLiTlLighting: (...args: any[]) => mockGet(...args),
  setLianLiTlLighting: (...args: any[]) => mockSet(...args),
}));

const lighting = {
  mode: 'rainbow',
  speed: 2,
  direction: 0,
  brightness: 4,
  scope: 'all',
  colors: [],
  modes: [{ key: 'rainbow', label: 'Rainbow' }],
  maxColors: 4,
  argbSync: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockState.mockResolvedValue({ isConnected: true, fans: [] });
  mockGet.mockResolvedValue(lighting);
  mockSet.mockResolvedValue({ success: true });
  mockScreens.mockResolvedValue([]);
  mockScreenContent.mockResolvedValue(true);
});

describe('LianLiTlDevicePage motherboard ARGB', () => {
  it('turning it on saves the choice and locks the effect controls', async () => {
    await act(async () => {
      render(<LianLiTlDevicePage />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'devices.motherboardArgb.label' }));
    });

    expect(mockSet).toHaveBeenCalledWith({ argbSync: true });
    expect(screen.getByRole('button', { name: 'devices.lianli-tl.lightingMode' })).toBeDisabled();
  });
});

describe('LianLiTlDevicePage screens tab', () => {
  const fans = [{ port: 1, fanIndex: 1, rpm: 900, duty: 40 }];
  const tlScreen = {
    serial: 'T1', position: 0, width: 400, height: 400, rotation: 0, label: '#1.2',
    contentType: 'off', nexusPanel: true, panelDeviceId: 'rec-9',
  };

  it('puts Screens last, after Lighting and Cooling', async () => {
    mockState.mockResolvedValue({ isConnected: true, fans });
    mockScreens.mockResolvedValue([tlScreen]);
    await act(async () => { render(<LianLiTlDevicePage />); });

    const names = screen.getAllByRole('tab').map(x => x.textContent);
    expect(names).toEqual(['lighting.title', 'cooling.title', 'devices.lianli-wireless.tab.screen']);
  });

  it('hides the Screens tab when the list is empty', async () => {
    mockState.mockResolvedValue({ isConnected: true, fans });
    await act(async () => { render(<LianLiTlDevicePage />); });

    expect(screen.queryByRole('tab', { name: 'devices.lianli-wireless.tab.screen' })).not.toBeInTheDocument();
  });

  it('lists TL screens without brightness or sleep, and opens the panel entry', async () => {
    const onSectionNavigate = vi.fn();
    mockState.mockResolvedValue({ isConnected: true, fans });
    mockScreens.mockResolvedValue([tlScreen]);
    await act(async () => { render(<LianLiTlDevicePage onSectionNavigate={onSectionNavigate} />); });
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'devices.lianli-wireless.tab.screen' }));
    });

    const group = screen.getByRole('group', { name: 'devices.lianli-wireless.screensAria' });
    expect(within(group).getByRole('button', { name: '#1.2' })).toBeInTheDocument();
    expect(screen.getByText('devices.lianli-wireless.rotationLabel')).toBeInTheDocument();
    expect(screen.queryByText('devices.lianli-wireless.brightness')).not.toBeInTheDocument();
    expect(screen.queryByText('devices.lcd.sleepWhenLocked')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'devices.lianli-wireless.openPanel' }));
    expect(onSectionNavigate).toHaveBeenCalledWith('device', { deviceKey: expect.stringContaining('rec-9') });
  });
});
