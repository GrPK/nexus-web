import { describe, expect, it } from 'vitest';
import { standingFor } from './standing';

describe('standingFor', () => {
  it('keeps the top 100 as ranks', () => {
    expect(standingFor(1, 1281)).toEqual({ rank: 1 });
    expect(standingFor(100, 1281)).toEqual({ rank: 100 });
  });

  it('puts a lower place in the smallest Top % bucket it fits', () => {
    expect(standingFor(101, 10000)).toEqual({ topPercent: 5 });
    expect(standingFor(500, 10000)).toEqual({ topPercent: 5 });
    expect(standingFor(501, 10000)).toEqual({ topPercent: 10 });
    expect(standingFor(101, 1281)).toEqual({ topPercent: 10 });
    expect(standingFor(640, 1281)).toEqual({ topPercent: 50 });
  });

  it('shows nothing below the top half or without a total', () => {
    expect(standingFor(641, 1281)).toBeNull();
    expect(standingFor(1245, 1281)).toBeNull();
    expect(standingFor(1245, undefined)).toBeNull();
  });
});
