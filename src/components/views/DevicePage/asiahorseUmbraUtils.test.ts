import { describe, expect, it } from 'vitest';
import type { UmbraEffectSettings, UmbraEffectSpec, UmbraPort, UmbraState } from '../../../api/asiahorse-umbra';
import {
  activeSettings,
  effectsForGroup,
  levelToPercent,
  percentToLevel,
  populatedPorts,
  previewEffect,
  totalLeds,
  withColor,
} from './asiahorseUmbraUtils';

const fx = (effect: string, speed = 3): UmbraEffectSettings => ({
  effect, speed, brightness: 3, direction: 'forward', colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'],
});

const specs: UmbraEffectSpec[] = [
  { key: 'static', colors: 1, speed: false, direction: false, merge: false },
  { key: 'rainbow', colors: 0, speed: true, direction: true, merge: true },
];

function stateOf(group: 'sync' | 'async' | 'merge', asyncSettings: UmbraState['lighting']['async'] = []): UmbraState {
  return {
    isConnected: true,
    lighting: { source: 'firmware', lightOn: true, group, sync: fx('rainbow'), merge: fx('runway', 2), async: asyncSettings },
    fan: { syncMb: false, duty: 20 },
    boot: { mode: 'memory', selfCheck: true },
    ports: [],
    effects: specs,
  };
}

describe('level conversion', () => {
  it('maps 20 % steps both ways and clamps', () => {
    expect(levelToPercent(3)).toBe(60);
    expect(percentToLevel(60, 1)).toBe(3);
    expect(percentToLevel(0, 1)).toBe(1);
    expect(percentToLevel(0, 0)).toBe(0);
    expect(percentToLevel(130, 0)).toBe(5);
    expect(percentToLevel(50, 0)).toBe(3);
  });
});

describe('ports', () => {
  const ports: UmbraPort[] = [
    { index: 0, ledCount: 0, direction: 'forward', order: 1 },
    { index: 9, ledCount: 6, direction: 'forward', order: 10 },
  ];
  it('keeps only ports with LEDs and totals them', () => {
    expect(populatedPorts(ports).map(p => p.index)).toEqual([9]);
    expect(totalLeds(ports)).toBe(6);
  });
});

describe('effects', () => {
  it('offers merge only the effects that allow it', () => {
    expect(effectsForGroup(specs, 'sync').map(e => e.key)).toEqual(['static', 'rainbow']);
    expect(effectsForGroup(specs, 'merge').map(e => e.key)).toEqual(['rainbow']);
  });

  it('picks the settings block of the active mode', () => {
    expect(activeSettings(stateOf('sync'), 0).effect).toBe('rainbow');
    expect(activeSettings(stateOf('merge'), 0).effect).toBe('runway');
    const asyncState = stateOf('async', [{ ...fx('scan'), port: 9 }]);
    expect(activeSettings(asyncState, 9).effect).toBe('scan');
    expect(activeSettings(asyncState, 3)).toMatchObject({ effect: 'rainbow', port: 3 });
  });

  it('previews an edit into the right block', () => {
    expect(previewEffect(stateOf('sync'), 0, { speed: 5 }).lighting.sync.speed).toBe(5);
    expect(previewEffect(stateOf('merge'), 0, { speed: 5 }).lighting.merge.speed).toBe(5);
    const next = previewEffect(stateOf('async', [{ ...fx('scan'), port: 9 }]), 3, { effect: 'tile' });
    expect(next.lighting.async.map(a => [a.port, a.effect])).toEqual([[3, 'tile'], [9, 'scan']]);
  });
});

describe('withColor', () => {
  it('replaces one slot and pads to four', () => {
    expect(withColor(['#111111'], 2, '#abcdef', '#ff0000')).toEqual(['#111111', '#ff0000', '#abcdef', '#ff0000']);
  });
});
