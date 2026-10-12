import { describe, expect, it } from 'vitest';
import { sharedValue } from './screenSelection';

describe('sharedValue', () => {
  it('reports the common value when every target agrees', () => {
    const r = sharedValue([{ b: 40 }, { b: 40 }], s => s.b);
    expect(r).toMatchObject({ value: 40, mixed: false });
  });

  it('reports mixed with every held value when targets differ', () => {
    const r = sharedValue([{ b: 40 }, { b: 80 }, { b: 40 }], s => s.b);
    expect(r.mixed).toBe(true);
    expect(r.value).toBeUndefined();
    expect([...r.held].sort()).toEqual([40, 80]);
  });

  it('is neither shared nor mixed with no targets', () => {
    const r = sharedValue([], (s: { b: number }) => s.b);
    expect(r).toMatchObject({ value: undefined, mixed: false });
  });
});
