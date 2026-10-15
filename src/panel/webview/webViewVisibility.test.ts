import { describe, expect, it } from 'vitest';
import { computeVisible, isTopmost, probePoints } from './webViewVisibility';

const rect = { x: 100, y: 200, w: 400, h: 300 };

function setup() {
  const el = document.createElement('div');
  const child = document.createElement('span');
  el.appendChild(child);
  const other = document.createElement('div');
  return { el, child, other };
}

describe('probePoints', () => {
  it('returns the center and four corners inside the rect', () => {
    const pts = probePoints(rect);
    expect(pts).toHaveLength(5);
    expect(pts[0]).toEqual([300, 350]);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(rect.x);
      expect(x).toBeLessThanOrEqual(rect.x + rect.w);
      expect(y).toBeGreaterThanOrEqual(rect.y);
      expect(y).toBeLessThanOrEqual(rect.y + rect.h);
    }
  });

  it('keeps corners distinct on a tiny rect', () => {
    const pts = probePoints({ x: 0, y: 0, w: 10, h: 10 });
    expect(new Set(pts.map(p => p.join(','))).size).toBe(5);
  });
});

describe('isTopmost', () => {
  it('accepts the element and its descendants at every point', () => {
    const { el, child } = setup();
    let n = 0;
    expect(isTopmost(el, rect, () => (n++ % 2 ? child : el))).toBe(true);
  });

  it('fails when anything else covers a single probe point', () => {
    const { el, other } = setup();
    let n = 0;
    expect(isTopmost(el, rect, () => (++n === 3 ? other : el))).toBe(false);
  });

  it('fails when a point is outside the document', () => {
    const { el } = setup();
    expect(isTopmost(el, rect, () => null)).toBe(false);
  });

  it('fails on an empty rect', () => {
    const { el } = setup();
    expect(isTopmost(el, { x: 0, y: 0, w: 0, h: 10 }, () => el)).toBe(false);
  });
});

describe('computeVisible', () => {
  const base = () => {
    const { el } = setup();
    return { supported: true, documentVisible: true, suppressed: false, connected: true, loadFailed: false, rect, el, hit: () => el };
  };

  it('is true when every condition holds', () => {
    expect(computeVisible(base())).toBe(true);
  });

  it.each([
    ['unsupported host', { supported: false }],
    ['hidden document', { documentVisible: false }],
    ['edit or drag mode', { suppressed: true }],
    ['detached element', { connected: false }],
    ['failed load', { loadFailed: true }],
  ])('is false for %s', (_name, patch) => {
    expect(computeVisible({ ...base(), ...patch })).toBe(false);
  });

  it('is false when covered', () => {
    const i = base();
    const { other } = setup();
    expect(computeVisible({ ...i, hit: () => other })).toBe(false);
  });
});
