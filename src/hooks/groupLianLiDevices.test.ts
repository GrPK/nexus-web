import { describe, expect, it } from 'vitest';
import {
  LIANLI_GROUP, LIANLI_HUB_KEY, groupLianLiDevices, groupMembers, isLianLiMemberId, type UnifiedDevice,
} from './useUnifiedDevices';

function device(key: string, curatedId: string | undefined, extra: Partial<UnifiedDevice> = {}): UnifiedDevice {
  return {
    key, shortName: key, name: key, subtitle: '', category: 'cooler', iconSrc: '', connected: true,
    kind: 'curated', curatedId, navigable: true, nexusControlEnabled: true, supportsNexusControl: true,
    experimental: false, requiresBeta: false, ...extra,
  };
}

const wireless = device('curated-lianli-wireless', 'lianli-wireless');
const curve = device('panel-curve', 'lianli-hydroshift2-curve', { kind: 'panel' });
const kraken = device('curated-nzxt-kraken', 'nzxt-kraken');

describe('isLianLiMemberId', () => {
  it('takes every lianli handler and panel source, and the Strimer', () => {
    for (const id of ['lianli', 'lianli2', 'lianli-tl', 'lianli-aio', 'lianli-wireless', 'lianli-flex', 'lianli-hydroshift2', 'lianli-screen88', 'strimer']) {
      expect(isLianLiMemberId(id)).toBe(true);
    }
    expect(isLianLiMemberId('nzxt-kraken')).toBe(false);
    expect(isLianLiMemberId(undefined)).toBe(false);
  });
});

describe('groupLianLiDevices', () => {
  it('leaves a single Lian Li device on its own row', () => {
    const list = groupLianLiDevices([wireless, kraken]);
    expect(list.map(d => d.key)).toEqual(['curated-lianli-wireless', 'curated-nzxt-kraken']);
    expect(list.every(d => d.groupKey === undefined)).toBe(true);
  });

  it('with two or more, marks them and adds one Lian Li entry that opens a page and has no Nexus Control of its own', () => {
    const list = groupLianLiDevices([wireless, kraken, curve]);
    expect(list.filter(d => d.groupKey === LIANLI_GROUP).map(d => d.key)).toEqual(['curated-lianli-wireless', 'panel-curve']);
    expect(list.find(d => d.key === 'curated-nzxt-kraken')?.groupKey).toBeUndefined();
    const hub = list.find(d => d.key === LIANLI_HUB_KEY);
    expect(hub).toMatchObject({ shortName: 'Lian Li', connected: true, navigable: true, supportsNexusControl: false });
    expect(hub?.groupKey).toBeUndefined();
  });

  it('keeps the members in the list so their own pages still open', () => {
    const list = groupLianLiDevices([wireless, curve]);
    expect(groupMembers(list, LIANLI_GROUP).map(d => d.key)).toEqual(['curated-lianli-wireless', 'panel-curve']);
  });

  it('counts neither a disconnected nor a simulated device', () => {
    expect(groupLianLiDevices([wireless, { ...curve, connected: false }]).some(d => d.key === LIANLI_HUB_KEY)).toBe(false);
    expect(groupLianLiDevices([wireless, { ...curve, simulated: true }]).some(d => d.key === LIANLI_HUB_KEY)).toBe(false);
  });

  it('shows a member warning on the entry', () => {
    const list = groupLianLiDevices([wireless, { ...curve, warning: 'usb-disconnected' }]);
    expect(list.find(d => d.key === LIANLI_HUB_KEY)?.warning).toBe('usb-disconnected');
  });
});
