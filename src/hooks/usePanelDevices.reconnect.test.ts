import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelDevices } from './usePanelDevices';
import type { PanelDeviceRecord } from '../api/panel';

const fetchDevicesMock = vi.fn<() => Promise<{ devices: PanelDeviceRecord[] } | null>>();
vi.mock('../api/panel', () => ({
  fetchPanelDevices: () => fetchDevicesMock(),
  fetchPanelStatus: () => Promise.resolve(null),
  fetchPanelPhoneSessions: () => Promise.resolve({ sessions: [] }),
}));
vi.mock('../api/corsair', () => ({ getCorsairState: () => Promise.resolve(null) }));
vi.mock('./useDevices', () => ({ useDevices: () => ({ devices: [] }) }));

let mockConnected = true;
vi.mock('./useMultiplexSocket', () => ({
  useTopicCallback: () => {},
  useMultiplex: () => ({ connected: mockConnected }),
}));

const STREAMED: PanelDeviceRecord = {
  id: 'rec-ryujin',
  displayName: 'ASUS Ryujin LCD',
  firstSeenAt: 0,
  lastSeenAt: 1,
  streamed: true,
  capabilities: { surface: 'lcd-square', family: 'asus-ryujin-lcd', touch: false, cssWidth: 320, cssHeight: 240, dpr: 1 },
};

const flush = () => act(async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
});

beforeEach(() => {
  fetchDevicesMock.mockReset();
  fetchDevicesMock.mockResolvedValue({ devices: [] });
  mockConnected = true;
});

describe('usePanelDevices reconnect', () => {
  it('re-seeds on reconnect, picking up a stream that started while the socket was down', async () => {
    const { result, rerender } = renderHook(() => usePanelDevices(true));
    await flush();
    expect(result.current.devices.some(d => d.panelRecordId === STREAMED.id)).toBe(false);

    fetchDevicesMock.mockResolvedValue({ devices: [STREAMED] });
    mockConnected = false;
    rerender();
    mockConnected = true;
    rerender();
    await flush();

    expect(fetchDevicesMock).toHaveBeenCalledTimes(2);
    expect(result.current.devices.some(d => d.panelRecordId === STREAMED.id)).toBe(true);
  });

  it('does not refetch on a steady connection', async () => {
    const { rerender } = renderHook(() => usePanelDevices(true));
    await flush();
    rerender();
    await flush();

    expect(fetchDevicesMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the newest refresh when an older one resolves last', async () => {
    let resolveSeed: (v: { devices: PanelDeviceRecord[] }) => void = () => {};
    fetchDevicesMock.mockReturnValueOnce(new Promise(r => { resolveSeed = r; }));
    fetchDevicesMock.mockResolvedValueOnce({ devices: [STREAMED] });
    const { result, rerender } = renderHook(() => usePanelDevices(true));

    mockConnected = false;
    rerender();
    mockConnected = true;
    rerender();
    await flush();
    resolveSeed({ devices: [] });
    await flush();

    expect(result.current.devices.some(d => d.panelRecordId === STREAMED.id)).toBe(true);
  });
});
