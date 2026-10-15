import { describe, expect, it } from 'vitest';
import { absoluteColor, barGradient, fahrenheitToCelsius } from './weatherTempColors';

function hexHue(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe('absolute scale', () => {
  it('is sky blue when freezing', () => {
    const h = hexHue(absoluteColor(fahrenheitToCelsius(30)));
    expect(h).toBeGreaterThan(200);
    expect(h).toBeLessThan(220);
  });

  it('reads yellow to amber at pleasant temperatures, never red', () => {
    for (let f = 68; f <= 80; f += 1) {
      const hue = hexHue(absoluteColor(fahrenheitToCelsius(f)));
      expect(hue).toBeGreaterThan(35);
      expect(hue).toBeLessThan(60);
    }
  });

  it('only reaches red well above 90 F', () => {
    expect(hexHue(absoluteColor(fahrenheitToCelsius(92)))).toBeGreaterThan(18);
    expect(absoluteColor(100)).toBe(absoluteColor(fahrenheitToCelsius(104)));
  });

  it('clamps below the first stop', () => {
    expect(absoluteColor(-40)).toBe(absoluteColor(fahrenheitToCelsius(10)));
  });

  it('converts Fahrenheit to Celsius', () => {
    expect(fahrenheitToCelsius(32)).toBeCloseTo(0);
    expect(fahrenheitToCelsius(212)).toBeCloseTo(100);
  });
});

describe('barGradient', () => {
  it('samples the span with the span end colors', () => {
    const g = barGradient(10, 25);
    expect(g).toContain(absoluteColor(10));
    expect(g).toContain(absoluteColor(25));
  });
});
