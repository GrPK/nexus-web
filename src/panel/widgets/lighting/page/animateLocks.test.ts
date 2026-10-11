import { describe, expect, it } from 'vitest';
import {
  animateLockedAmong, lockedIdsByEffect, lockedNamesByEffect, sharedAnimateLock, withAnimateLock,
} from './animateLocks';

describe('withAnimateLock', () => {
  it('sets and clears one device without touching the others', () => {
    const a = withAnimateLock({ x: 'plasma' }, 'y', 'aurora');
    expect(a).toEqual({ x: 'plasma', y: 'aurora' });
    expect(withAnimateLock(a, 'x', null)).toEqual({ y: 'aurora' });
  });

  it('returns the same object when nothing changes', () => {
    const locks = { x: 'plasma' };
    expect(withAnimateLock(locks, 'x', 'plasma')).toBe(locks);
    expect(withAnimateLock(locks, 'z', null)).toBe(locks);
  });
});

describe('lockedIdsByEffect', () => {
  it('groups device ids by effect', () => {
    const m = lockedIdsByEffect({ a: 'plasma', b: 'aurora', c: 'plasma' });
    expect(m.get('plasma')).toEqual(['a', 'c']);
    expect(m.get('aurora')).toEqual(['b']);
  });
});

describe('animateLockedAmong', () => {
  it('keeps only the locked ids', () => {
    expect(animateLockedAmong({ a: 'plasma' }, ['a', 'b'])).toEqual(['a']);
  });
});

describe('sharedAnimateLock', () => {
  it('names the effect when every id is locked onto it', () => {
    expect(sharedAnimateLock({ a: 'plasma', b: 'plasma' }, ['a', 'b'])).toBe('plasma');
  });

  it('is null for an empty, mixed or partly unlocked selection', () => {
    expect(sharedAnimateLock({ a: 'plasma' }, [])).toBeNull();
    expect(sharedAnimateLock({ a: 'plasma', b: 'aurora' }, ['a', 'b'])).toBeNull();
    expect(sharedAnimateLock({ a: 'plasma' }, ['a', 'b'])).toBeNull();
    expect(sharedAnimateLock({ b: 'plasma' }, ['a', 'b'])).toBeNull();
  });
});

describe('lockedNamesByEffect', () => {
  it('lists device names and drops ids with no known device', () => {
    const names: Record<string, string> = { a: 'Fan 1', b: 'Strip' };
    const m = lockedNamesByEffect({ a: 'plasma', b: 'plasma', ghost: 'plasma', c: 'aurora' }, id => names[id]);
    expect(m.get('plasma')).toEqual(['Fan 1', 'Strip']);
    expect(m.has('aurora')).toBe(false);
  });
});
