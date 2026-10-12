import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FirmwareStatusItem } from './useFirmwareStatus';

const fetchService = vi.fn();
vi.mock('../api/service', () => ({ fetchService: (...args: unknown[]) => fetchService(...args) }));

type Store = typeof import('./firmwareStatusStore');
let store: Store;

beforeEach(async () => {
  fetchService.mockReset();
  vi.resetModules();
  store = await import('./firmwareStatusStore');
});

function item(overrides: Partial<FirmwareStatusItem>): FirmwareStatusItem {
  return {
    deviceType: 'np50', firmwareType: 'np50', name: 'HYTE NP50', category: 'hub',
    currentVersion: '2.0.5.1', availableVersion: '2.0.5.2', updateAvailable: true,
    availableVersions: [], devImages: [],
    ...overrides,
  };
}

const panelApp = (current: string, update: boolean) =>
  item({ deviceType: 'qseries-app', firmwareType: 'qseries-app', currentVersion: current, updateAvailable: update });

describe('firmwareUpdateIds', () => {
  it('flags a device whose installed firmware has a newer image', () => {
    expect([...store.firmwareUpdateIds([item({})])]).toEqual(['np50']);
  });

  it('puts a panel-app update on the Q-series device row', () => {
    expect([...store.firmwareUpdateIds([panelApp('0.1.4', true)])]).toEqual(['qseries']);
  });

  it('ignores up-to-date devices, a never-installed panel app and a device stuck in recovery', () => {
    expect(store.firmwareUpdateIds([
      item({ updateAvailable: false }),
      panelApp('', true),
      item({ deviceType: 'cnvs', needsRecovery: true }),
    ]).size).toBe(0);
  });
});

describe('refreshFirmwareStatus', () => {
  it('drops an older response that lands after a newer one', async () => {
    let answerOld!: (v: FirmwareStatusItem[]) => void;
    fetchService
      .mockImplementationOnce(() => new Promise(resolve => { answerOld = resolve; }))
      .mockResolvedValueOnce([panelApp('0.1.5', false)]);

    const older = store.refreshFirmwareStatus();
    await store.refreshFirmwareStatus();
    answerOld([panelApp('0.1.4', true)]);
    await older;

    expect(store.getFirmwareStatusSnapshot().items[0].currentVersion).toBe('0.1.5');
    expect(store.getFirmwareStatusSnapshot().updateIds.size).toBe(0);
  });

  it('drops an older response that lands after a newer request failed', async () => {
    let answerOld!: (v: FirmwareStatusItem[]) => void;
    fetchService
      .mockImplementationOnce(() => new Promise(resolve => { answerOld = resolve; }))
      .mockResolvedValueOnce(null);

    const older = store.refreshFirmwareStatus();
    await store.refreshFirmwareStatus();
    answerOld([panelApp('0.1.4', true)]);
    await older;

    expect(store.getFirmwareStatusSnapshot().updateIds.size).toBe(0);
  });

  it('keeps the last good result when a fetch fails', async () => {
    fetchService.mockResolvedValueOnce([item({})]).mockResolvedValueOnce(null);
    await store.refreshFirmwareStatus();
    await store.refreshFirmwareStatus();
    expect([...store.getFirmwareStatusSnapshot().updateIds]).toEqual(['np50']);
  });
});

describe('requestFirmwareStatus', () => {
  it('coalesces background requests and drops the trailing one with the last consumer', async () => {
    vi.useFakeTimers();
    try {
      fetchService.mockResolvedValue([]);
      const release = store.retainFirmwareStatus();
      store.requestFirmwareStatus();
      store.requestFirmwareStatus();
      store.requestFirmwareStatus();
      expect(fetchService).toHaveBeenCalledTimes(1);

      release();
      await vi.advanceTimersByTimeAsync(120_000);
      expect(fetchService).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
