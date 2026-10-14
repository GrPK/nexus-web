import { describe, expect, it } from 'vitest';
import { conflictsWithControlledDevice } from './useConflictOverlap';
import type { DetectedConflict } from '../api/conflicts';
import type { DeviceListItem } from './useDevices';
import type { LightingDevice } from '../api/lighting';

function app(id: string, over: Partial<DetectedConflict> = {}): DetectedConflict {
  return { id, displayName: id, category: 'lighting', processName: id, pid: 1, deviceOverlapKnown: true, ...over };
}

function curated(over: Partial<DeviceListItem>): DeviceListItem {
  return { id: 'streamdeck', name: 'Stream Deck', category: 'peripheral', connected: true, firmwareVersion: '', supportsNexusControl: true, nexusControlEnabled: true, conflictAppId: 'elgato-stream-deck', ...over };
}

function card(over: Partial<LightingDevice>): LightingDevice {
  return { id: 'c', name: 'c', ledsOn: true, ledCount: 1, canvasX: 0, canvasY: 0, canvasW: 0, canvasH: 0, canvasRotation: 0, ...over };
}

describe('conflictsWithControlledDevice', () => {
  it('overlaps a connected curated device with Nexus Control on', () => {
    expect(conflictsWithControlledDevice(app('elgato-stream-deck'), [curated({})], [])).toBe(true);
  });

  it('does not overlap when the curated device has Nexus Control off or is unplugged', () => {
    expect(conflictsWithControlledDevice(app('elgato-stream-deck'), [curated({ nexusControlEnabled: false })], [])).toBe(false);
    expect(conflictsWithControlledDevice(app('elgato-stream-deck'), [curated({ connected: false })], [])).toBe(false);
  });

  it('does not overlap a mapped app when no device of its vendor is present (Armoury Crate without ASUS hardware)', () => {
    const other = card({ id: 'ram', controlled: true, conflictAppIds: ['icue', 'signalrgb'] });
    expect(conflictsWithControlledDevice(app('armoury-crate'), [], [other])).toBe(false);
  });

  it('overlaps a vendor card under Nexus Control, and not one the user handed back', () => {
    const on = card({ id: 'mb', controlled: true, conflictAppIds: ['armoury-crate'] });
    const off = card({ id: 'mb', controlled: false, conflictAppIds: ['armoury-crate'] });
    expect(conflictsWithControlledDevice(app('armoury-crate'), [], [on])).toBe(true);
    expect(conflictsWithControlledDevice(app('armoury-crate'), [], [off])).toBe(false);
  });

  it('treats a partly controlled device as overlapping', () => {
    const cards = [
      card({ id: 'mb-0', deviceId: 'mb', controlled: true, conflictAppIds: ['armoury-crate'] }),
      card({ id: 'mb-1', deviceId: 'mb', controlled: false, conflictAppIds: ['armoury-crate'] }),
    ];
    expect(conflictsWithControlledDevice(app('armoury-crate'), [], cards)).toBe(true);
  });

  it('overlaps a universal RGB app once any lighting card is under Nexus Control, curated hub cards included', () => {
    const hub = [card({ id: 'hub-0', controlHandlerId: 'lianli', controlled: true })];
    const signal = app('signalrgb', { claimsAllRgb: true });
    expect(conflictsWithControlledDevice(signal, [], hub)).toBe(true);
    expect(conflictsWithControlledDevice(signal, [], [card({ id: 'x', controlled: false })])).toBe(false);
    expect(conflictsWithControlledDevice(signal, [], [])).toBe(false);
  });

  it('keeps alerting for an app the service cannot map to devices', () => {
    expect(conflictsWithControlledDevice(app('msi-afterburner', { deviceOverlapKnown: false }), [], [])).toBe(true);
    expect(conflictsWithControlledDevice(app('msi-afterburner', { deviceOverlapKnown: undefined }), [], [])).toBe(true);
  });

  it('always alerts for Nexus 2', () => {
    expect(conflictsWithControlledDevice(app('hyte-nexus-2'), [], [])).toBe(true);
  });
});
