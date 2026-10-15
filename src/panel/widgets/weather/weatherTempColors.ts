// Range-bar colors for the weather widget, computed in JS: the Chromium 83
// floor has no oklch() or color-mix(), so every output is a hex string.

type Oklch = [number, number, number];

const GRADIENT_SAMPLES = 12;

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

// Stops sampled from the iOS Weather range bars, in Fahrenheit.
const SCALE_F: ReadonlyArray<readonly [number, string]> = [
  [10, '#5a8fe6'],
  [33, '#64b5f6'],
  [45, '#7bcdd7'],
  [52, '#7dced1'],
  [57, '#aed1a8'],
  [62, '#b6d2a1'],
  [66, '#d6d17a'],
  [69, '#eacf55'],
  [72, '#f6c938'],
  [76, '#f5b52f'],
  [80, '#f4a52b'],
  [84, '#f39a2a'],
  [87, '#ef8735'],
  [91, '#ed7439'],
  [104, '#e0453a'],
];

const SCALE: ReadonlyArray<readonly [number, Oklch]> = SCALE_F.map(
  ([f, hex]) => [((f - 32) * 5) / 9, hexToOklch(hex)] as const,
);

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

// Gradient over one day's low..high (Celsius), sampled along the span.
export function barGradient(lowC: number, highC: number): string {
  const stops: string[] = [];
  for (let i = 0; i <= GRADIENT_SAMPLES; i++) {
    const c = lowC + ((highC - lowC) * i) / GRADIENT_SAMPLES;
    stops.push(`${absoluteColor(c)} ${((i / GRADIENT_SAMPLES) * 100).toFixed(1)}%`);
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}
