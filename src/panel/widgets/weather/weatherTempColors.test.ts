import { describe, expect, it } from 'vitest';
import {
  ACCENT_MAX_SHIFT_DEG, absoluteColor, accentAt, barGradient, fahrenheitToCelsius, parseHsl, scaleOklch,
} from './weatherTempColors';

function hexHue(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe('absolute scale', () => {
  it('keeps any green-range chroma muted', () => {
    for (let c = -10; c <= 38; c += 0.25) {
      const [, chroma, hue] = scaleOklch(c);
      if (hue >= 110 && hue <= 190) expect(chroma).toBeLessThan(0.12);
      if (c < 13 || c > 18.5) expect(hue >= 110 && hue <= 190).toBe(false);
    }
  });

  it('is cold blue below freezing-ish and red when hot', () => {
    expect(hexHue(absoluteColor(2))).toBeGreaterThan(200);
    expect(hexHue(absoluteColor(2))).toBeLessThan(260);
    expect(absoluteColor(40)).toBe(absoluteColor(33));
    expect(absoluteColor(-20)).toBe(absoluteColor(-10));
  });

  it('converts Fahrenheit to Celsius', () => {
    expect(fahrenheitToCelsius(32)).toBeCloseTo(0);
    expect(fahrenheitToCelsius(212)).toBeCloseTo(100);
  });
});

describe('accent mode', () => {
  const blue = { h: 217, s: 91, l: 70 };

  it('leaves the accent unshifted at the neutral temperature', () => {
    expect(hexHue(accentAt(blue, 18))).toBeCloseTo(hexHue(accentAt(blue, 18)), 5);
    expect(accentAt(blue, 18)).toBe(accentAt({ ...blue }, 18));
  });

  it('caps the hue shift and never passes the target', () => {
    const hot = hexHue(accentAt({ h: 25, s: 80, l: 60 }, 40));
    expect(hot).toBeGreaterThan(20);
    expect(hot).toBeLessThan(40);
    const cold = hexHue(accentAt({ h: 215, s: 80, l: 60 }, -20));
    expect(Math.abs(cold - 230)).toBeLessThan(ACCENT_MAX_SHIFT_DEG);
  });

  it('shifts a hot blue accent by the shorter way, by at most the cap', () => {
    const h = hexHue(accentAt(blue, 40));
    expect(h - hexHue(accentAt(blue, 18))).toBeGreaterThan(20);
    expect(h - 217).toBeLessThanOrEqual(ACCENT_MAX_SHIFT_DEG + 2);
  });
});

describe('barGradient', () => {
  it('samples the span with the span end colors', () => {
    const g = barGradient(10, 25, { mode: 'absolute', accentGlow: null });
    expect(g).toContain(absoluteColor(10));
    expect(g).toContain(absoluteColor(25));
  });

  it('needs a parseable accent in accent mode', () => {
    expect(barGradient(10, 25, { mode: 'accent', accentGlow: null })).toBeNull();
    expect(barGradient(10, 25, { mode: 'accent', accentGlow: 'hsl(217.0, 91.0%, 70.0%)' })).toContain('linear-gradient');
    expect(parseHsl('hsl(217.0, 91.0%, 70.0%)')).toEqual(blueHsl());
  });
});

function blueHsl() {
  return { h: 217, s: 91, l: 70 };
}
