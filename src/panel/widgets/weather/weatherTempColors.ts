// Range-bar colors for the weather widget, computed in JS: the Chromium 83
// floor has no oklch() or color-mix(), so every output is a hex string.

export type WeatherBarColors = 'current' | 'absolute' | 'accent';

type Oklch = [number, number, number];

const GRADIENT_SAMPLES = 12;
const ACCENT_NEUTRAL_C = 18;
const ACCENT_COLD_C = -10;
const ACCENT_HOT_C = 35;
const ACCENT_COLD_HUE = 230;
const ACCENT_HOT_HUE = 30;
export const ACCENT_MAX_SHIFT_DEG = 45;
const ACCENT_COLD_LIGHTNESS = 4;
const ACCENT_HOT_LIGHTNESS = -2;

function toLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(c: number) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function hexToOklch(hex: string): Oklch {
  const n = parseInt(hex.slice(1), 16);
  const r = toLinear(((n >> 16) & 255) / 255);
  const g = toLinear(((n >> 8) & 255) / 255);
  const b = toLinear((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(a, bb), ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360];
}

function oklchToHex([L, C, H]: Oklch): string {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channel = (v: number) => Math.round(255 * Math.min(1, Math.max(0, fromLinear(v))));
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(channel);
  return `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function mixOklch(a: Oklch, b: Oklch, t: number): Oklch {
  let dh = b[2] - a[2];
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (a[2] + dh * t + 360) % 360];
}

const CHROMA_SCALE = 0.7;

const soft = ([L, C, H]: Oklch): Oklch => [L, C * CHROMA_SCALE, H];

// The 16.5 degree stop is a muted sage that keeps the blue-to-yellow handoff
// narrow and low in chroma.
const SCALE: ReadonlyArray<readonly [number, Oklch]> = ([
  [-10, '#4b3fa8'],
  [0, '#3b6fe0'],
  [8, '#5b9bf0'],
  [13, '#8fc3f2'],
  [19, '#f2d230'],
  [23, '#f2d230'],
  [27, '#f3b043'],
  [30, '#f2922a'],
  [37, '#e8432e'],
] as ReadonlyArray<readonly [number, string]>)
  .flatMap(([c, hex]) => (c === 19 ? [[16.5, [0.87, 0.045, 130] as Oklch] as const] : []).concat([[c, hexToOklch(hex)] as const]))
  .map(([c, ok]) => [c, soft(ok)] as const);

export function scaleOklch(celsius: number): Oklch {
  const first = SCALE[0];
  const last = SCALE[SCALE.length - 1];
  if (celsius <= first[0]) return first[1];
  if (celsius >= last[0]) return last[1];
  for (let i = 1; i < SCALE.length; i++) {
    if (celsius <= SCALE[i][0]) {
      const [c0, a] = SCALE[i - 1];
      const [c1, b] = SCALE[i];
      return mixOklch(a, b, (celsius - c0) / (c1 - c0));
    }
  }
  return last[1];
}

export function absoluteColor(celsius: number): string {
  return oklchToHex(scaleOklch(celsius));
}

export function fahrenheitToCelsius(f: number) {
  return ((f - 32) * 5) / 9;
}

interface Hsl { h: number; s: number; l: number }

// Parses the hsl(h, s%, l%) the panel's --panel-accent-glow resolves to.
export function parseHsl(css: string): Hsl | null {
  const m = /hsla?\(\s*([\d.]+)[ ,]+([\d.]+)%[ ,]+([\d.]+)%/.exec(css);
  return m ? { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) } : null;
}

function hslToHex({ h, s, l }: Hsl): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
}

// Hue moves toward blue when cold and orange when hot by the shorter way
// round the wheel, and stops at the target.
export function accentAt(base: Hsl, celsius: number): string {
  const cold = celsius < ACCENT_NEUTRAL_C;
  const k = cold
    ? Math.min(1, (ACCENT_NEUTRAL_C - celsius) / (ACCENT_NEUTRAL_C - ACCENT_COLD_C))
    : Math.min(1, Math.max(0, (celsius - ACCENT_NEUTRAL_C) / (ACCENT_HOT_C - ACCENT_NEUTRAL_C)));
  const target = cold ? ACCENT_COLD_HUE : ACCENT_HOT_HUE;
  const diff = ((target - base.h + 540) % 360) - 180;
  const step = Math.min(Math.abs(diff), ACCENT_MAX_SHIFT_DEG * k);
  const lightness = base.l + (cold ? ACCENT_COLD_LIGHTNESS : ACCENT_HOT_LIGHTNESS) * k;
  return hslToHex({ h: (base.h + Math.sign(diff) * step + 360) % 360, s: base.s, l: Math.min(100, Math.max(0, lightness)) });
}

export interface BarGradientOptions {
  mode: Exclude<WeatherBarColors, 'current'>;
  accentGlow: string | null;
}

// Gradient over one day's low..high (Celsius), sampled along the span.
export function barGradient(lowC: number, highC: number, { mode, accentGlow }: BarGradientOptions): string | null {
  const base = mode === 'accent' && accentGlow ? parseHsl(accentGlow) : null;
  if (mode === 'accent' && !base) return null;
  const stops: string[] = [];
  for (let i = 0; i <= GRADIENT_SAMPLES; i++) {
    const c = lowC + ((highC - lowC) * i) / GRADIENT_SAMPLES;
    const color = base ? accentAt(base, c) : absoluteColor(c);
    stops.push(`${color} ${((i / GRADIENT_SAMPLES) * 100).toFixed(1)}%`);
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}
