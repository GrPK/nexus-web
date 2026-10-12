// Block library for the Shader Studio. A block type is immutable once shipped:
// saved and shared recipes reference it by `type`, so a visual change ships as
// a new type and the old one stays.

export type StudioStage = 'space' | 'pattern' | 'tone' | 'color' | 'finish';

export const STUDIO_STAGES: readonly StudioStage[] = ['space', 'pattern', 'tone', 'color', 'finish'];

export interface StudioParam {
  key: string;
  min: number;
  max: number;
  step: number;
  def: number;
  /** i18n keys of an enum param's options; the value is the option index. */
  options?: readonly string[];
  /** A count the shader reads as an integer; audio modulation rounds it. */
  whole?: boolean;
}

export interface StudioColor {
  key: string;
  def: readonly [number, number, number];
}

export type StudioHelper = 'rot' | 'hash21' | 'vnoise' | 'fbm' | 'blendV' | 'presetPal' | 'grad3';

export interface StudioBlockDef {
  type: string;
  stage: StudioStage;
  /** Relative per-pixel cost; the recipe total is capped by STUDIO_COST_BUDGET. */
  cost: number;
  params: readonly StudioParam[];
  colors?: readonly StudioColor[];
  helpers?: readonly StudioHelper[];
  /**
   * GLSL statements. `$key` reads a param (or a color as vec3). Space blocks
   * rewrite `vec2 p`, pattern blocks assign `float f`, tone blocks rewrite
   * `float v`, color blocks assign `vec3 col` from `v`, finish blocks rewrite
   * `col`. `p0` is the untransformed centered coordinate, `t` scaled time.
   */
  code: string;
}

export const STUDIO_COST_BUDGET = 12;
export const STUDIO_STAGE_LIMIT: Record<StudioStage, number> = { space: 4, pattern: 3, tone: 3, color: 1, finish: 4 };

const BLEND_OPTIONS = [
  'lighting.studio.blend.add', 'lighting.studio.blend.multiply', 'lighting.studio.blend.lighten',
  'lighting.studio.blend.darken', 'lighting.studio.blend.difference', 'lighting.studio.blend.screen',
] as const;

/** Implicit params every pattern block after the first gets: how it combines with the field so far. */
export const PATTERN_BLEND_PARAMS: readonly StudioParam[] = [
  { key: 'blend', min: 0, max: 5, step: 1, def: 0, options: BLEND_OPTIONS },
  { key: 'mix', min: 0, max: 1, step: 0.01, def: 1 },
];

export const PALETTE_OPTIONS = [
  'lighting.studio.palette.rainbow', 'lighting.studio.palette.sunset', 'lighting.studio.palette.ocean',
  'lighting.studio.palette.neon', 'lighting.studio.palette.fire', 'lighting.studio.palette.toxic',
  'lighting.studio.palette.candy', 'lighting.studio.palette.ice', 'lighting.studio.palette.mono',
] as const;

export const STUDIO_BLOCKS: readonly StudioBlockDef[] = [
  // ---- space ----
  {
    type: 'zoom', stage: 'space', cost: 1,
    params: [
      { key: 'scale', min: 0.25, max: 4, step: 0.01, def: 1 },
      { key: 'drift', min: 0, max: 1, step: 0.01, def: 0 },
      { key: 'speed', min: 0, max: 2, step: 0.01, def: 0.3 },
    ],
    code: 'p /= $scale; p += $drift * 1.5 * vec2(sin(t * $speed * 0.37), cos(t * $speed * 0.29));',
  },
  {
    type: 'spin', stage: 'space', cost: 1, helpers: ['rot'],
    params: [
      { key: 'angle', min: 0, max: 360, step: 1, def: 0 },
      { key: 'speed', min: -2, max: 2, step: 0.01, def: 0.2 },
    ],
    code: 'p = rot(radians($angle) + t * $speed) * p;',
  },
  {
    type: 'mirror', stage: 'space', cost: 1,
    params: [
      { key: 'axis', min: 0, max: 2, step: 1, def: 2, options: ['lighting.studio.axis.x', 'lighting.studio.axis.y', 'lighting.studio.axis.both'] },
    ],
    code: 'float m = $axis; if (m < 0.5 || m > 1.5) p.x = abs(p.x); if (m > 0.5) p.y = abs(p.y);',
  },
  {
    type: 'kaleidoscope', stage: 'space', cost: 1,
    params: [
      { key: 'sides', min: 2, max: 16, step: 1, def: 6, whole: true },
      { key: 'spin', min: -1, max: 1, step: 0.01, def: 0.1 },
    ],
    code: [
      'float r = length(p); float a = atan(p.y, p.x) + t * $spin;',
      'float sec = 6.2831853 / $sides; a = mod(a, sec); a = abs(a - sec * 0.5);',
      'p = vec2(cos(a), sin(a)) * r;',
    ].join('\n'),
  },
  {
    type: 'tile', stage: 'space', cost: 1,
    params: [{ key: 'count', min: 1, max: 10, step: 0.1, def: 3 }],
    code: 'p = abs(fract(p * $count * 0.25) * 2.0 - 1.0) * 2.0 - 1.0;',
  },
  {
    type: 'swirl', stage: 'space', cost: 1, helpers: ['rot'],
    params: [
      { key: 'amount', min: -8, max: 8, step: 0.1, def: 3 },
      { key: 'size', min: 0.2, max: 3, step: 0.01, def: 1 },
    ],
    code: 'float r = length(p); p = rot($amount * exp(-r * r / ($size * $size)) * (0.75 + 0.25 * sin(t * 0.7))) * p;',
  },
  {
    type: 'warp', stage: 'space', cost: 4, helpers: ['fbm'],
    params: [
      { key: 'amount', min: 0, max: 1.5, step: 0.01, def: 0.5 },
      { key: 'scale', min: 0.3, max: 5, step: 0.01, def: 1.5 },
      { key: 'speed', min: 0, max: 2, step: 0.01, def: 0.4 },
    ],
    code: [
      'vec2 q = p * $scale; float tt = t * $speed * 0.3;',
      'vec2 w = vec2(fbm(q + vec2(tt, 0.0)), fbm(q + vec2(5.2, 1.3) - vec2(0.0, tt)));',
      'p += (w - 0.5) * 2.0 * $amount;',
    ].join('\n'),
  },
  {
    type: 'ripple', stage: 'space', cost: 1,
    params: [
      { key: 'amount', min: 0, max: 0.4, step: 0.005, def: 0.08 },
      { key: 'frequency', min: 1, max: 40, step: 0.1, def: 12 },
      { key: 'speed', min: -4, max: 4, step: 0.01, def: 1.5 },
    ],
    code: 'float r = length(p); p += p / max(r, 0.001) * sin(r * $frequency - t * $speed * 3.0) * $amount;',
  },
  {
    type: 'bend', stage: 'space', cost: 1,
    params: [
      { key: 'amount', min: 0, max: 1, step: 0.01, def: 0.25 },
      { key: 'frequency', min: 0.5, max: 12, step: 0.1, def: 3 },
      { key: 'speed', min: -3, max: 3, step: 0.01, def: 1 },
    ],
    code: 'p.x += sin(p.y * $frequency + t * $speed) * $amount; p.y += sin(p.x * $frequency * 0.8 - t * $speed * 0.9) * $amount;',
  },
  {
    // abs() on the angle mirrors the tunnel so the atan wrap leaves no seam.
    type: 'tunnel', stage: 'space', cost: 1,
    params: [
      { key: 'depth', min: 0.1, max: 2, step: 0.01, def: 0.5 },
      { key: 'speed', min: -3, max: 3, step: 0.01, def: 1 },
      { key: 'twist', min: -3, max: 3, step: 0.01, def: 0 },
    ],
    code: [
      'float r = max(length(p), 0.03); float a = abs(atan(p.y, p.x)) / PI;',
      'p = vec2(a * 2.0 + $twist * $depth / r * 0.25, $depth / r + mod(t * $speed, 500.0));',
    ].join('\n'),
  },
  {
    type: 'pixelate', stage: 'space', cost: 1,
    params: [{ key: 'size', min: 3, max: 64, step: 1, def: 20, whole: true }],
    code: 'p = (floor(p * $size * 0.5) + 0.5) / ($size * 0.5);',
  },
  // ---- pattern ----
  {
    type: 'solid', stage: 'pattern', cost: 1,
    params: [{ key: 'level', min: 0, max: 1, step: 0.01, def: 1 }],
    code: 'f = $level;',
  },
  {
    // A hard edge sweeps across and the two sides swap each pass, so it wipes
    // A over B, then B over A. x is the normalized position along the wipe.
    type: 'wipe', stage: 'pattern', cost: 1,
    params: [
      { key: 'shape', min: 0, max: 2, step: 1, def: 0, options: ['lighting.studio.shape.linear', 'lighting.studio.shape.radial', 'lighting.studio.shape.clock'] },
      { key: 'angle', min: 0, max: 360, step: 1, def: 0 },
      { key: 'speed', min: -4, max: 4, step: 0.01, def: 1 },
      { key: 'softness', min: 0.002, max: 0.5, step: 0.002, def: 0.02 },
    ],
    code: [
      'float ar = u_resolution.x / u_resolution.y; float x;',
      'if ($shape < 0.5) { float a = radians($angle); vec2 dir = vec2(cos(a), sin(a)); x = dot(p, dir) / (2.0 * (abs(dir.x) * ar + abs(dir.y))) + 0.5; }',
      'else if ($shape < 1.5) { x = length(p) / length(vec2(ar, 1.0)); }',
      'else { x = fract(atan(p.y, p.x) / 6.2831853 + 0.25); }',
      'float ph = t * $speed * 0.25; float e = fract(ph); float a0 = mod(floor(ph), 2.0);',
      'f = mix(a0, 1.0 - a0, 1.0 - smoothstep(e - $softness, e, x));',
    ].join('\n'),
  },
  {
    // A rotating conic ramp with a bright head and a fading tail (radar, comets, spinners).
    type: 'sweep', stage: 'pattern', cost: 1,
    params: [
      { key: 'count', min: 1, max: 8, step: 1, def: 1, whole: true },
      { key: 'speed', min: -4, max: 4, step: 0.01, def: 1 },
      { key: 'tail', min: 1, max: 12, step: 0.1, def: 3 },
    ],
    code: 'float a = fract(atan(p.y, p.x) / 6.2831853 + 0.25); f = pow(fract(a * $count - t * $speed * 0.25), $tail);',
  },
  {
    type: 'gradient', stage: 'pattern', cost: 1,
    params: [
      { key: 'angle', min: 0, max: 360, step: 1, def: 90 },
      { key: 'spread', min: 0.1, max: 3, step: 0.01, def: 1 },
      { key: 'speed', min: 0, max: 3, step: 0.01, def: 0.5 },
    ],
    code: 'float a = radians($angle); f = clamp(dot(p, vec2(cos(a), sin(a))) * 0.5 * $spread + 0.5 + 0.25 * sin(t * $speed), 0.0, 1.0);',
  },
  {
    type: 'rings', stage: 'pattern', cost: 1,
    params: [
      { key: 'count', min: 1, max: 40, step: 0.1, def: 8 },
      { key: 'speed', min: -4, max: 4, step: 0.01, def: 1 },
    ],
    code: 'f = 0.5 + 0.5 * sin(length(p) * $count * PI - t * $speed * 2.0);',
  },
  {
    type: 'stripes', stage: 'pattern', cost: 1,
    params: [
      { key: 'count', min: 1, max: 40, step: 0.1, def: 6 },
      { key: 'angle', min: 0, max: 180, step: 1, def: 45 },
      { key: 'speed', min: -4, max: 4, step: 0.01, def: 1 },
    ],
    code: 'float a = radians($angle); f = 0.5 + 0.5 * sin(dot(p, vec2(cos(a), sin(a))) * $count * PI - t * $speed * 2.0);',
  },
  {
    type: 'plasma', stage: 'pattern', cost: 1,
    params: [
      { key: 'scale', min: 0.3, max: 6, step: 0.01, def: 2 },
      { key: 'speed', min: 0, max: 3, step: 0.01, def: 1 },
    ],
    code: [
      'vec2 q = p * $scale; float tt = t * $speed;',
      'float s = sin(q.x + tt) + sin(q.y * 1.3 - tt * 0.8) + sin((q.x + q.y) * 0.7 + tt * 1.2)',
      '  + sin(length(q + 2.0 * vec2(sin(tt * 0.3), cos(tt * 0.4))) * 1.5 - tt);',
      'f = 0.5 + 0.125 * s;',
    ].join('\n'),
  },
  {
    type: 'clouds', stage: 'pattern', cost: 2, helpers: ['fbm'],
    params: [
      { key: 'scale', min: 0.3, max: 8, step: 0.01, def: 2 },
      { key: 'speed', min: 0, max: 2, step: 0.01, def: 0.3 },
    ],
    code: 'f = clamp((fbm(p * $scale + vec2(t * $speed * 0.2, -t * $speed * 0.15)) - 0.5) * 1.8 + 0.5, 0.0, 1.0);',
  },
  {
    type: 'cells', stage: 'pattern', cost: 3, helpers: ['hash21'],
    params: [
      { key: 'scale', min: 1, max: 12, step: 0.1, def: 4 },
      { key: 'speed', min: 0, max: 2, step: 0.01, def: 0.5 },
      { key: 'style', min: 0, max: 1, step: 1, def: 0, options: ['lighting.studio.cellStyle.cells', 'lighting.studio.cellStyle.edges'] },
    ],
    code: [
      'vec2 q = p * $scale * 0.5; vec2 id = floor(q); vec2 fq = fract(q); float d1 = 8.0; float d2 = 8.0;',
      'for (int j = -1; j <= 1; j++) {',
      '  for (int i = -1; i <= 1; i++) {',
      '    vec2 g = vec2(float(i), float(j));',
      '    vec2 h = vec2(hash21(id + g), hash21(id + g + 17.3));',
      '    float d = length(g + 0.5 + 0.4 * sin(t * $speed + 6.2831853 * h) - fq);',
      '    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }',
      '  }',
      '}',
      'f = $style < 0.5 ? clamp(d1, 0.0, 1.0) : clamp((d2 - d1) * 2.0, 0.0, 1.0);',
    ].join('\n'),
  },
  {
    type: 'spiral', stage: 'pattern', cost: 1,
    params: [
      { key: 'arms', min: 1, max: 12, step: 1, def: 3, whole: true },
      { key: 'twist', min: 0, max: 20, step: 0.1, def: 5 },
      { key: 'speed', min: -4, max: 4, step: 0.01, def: 1 },
    ],
    code: 'f = 0.5 + 0.5 * sin(atan(p.y, p.x) * $arms + length(p) * $twist - t * $speed * 2.0);',
  },
  {
    type: 'dots', stage: 'pattern', cost: 1, helpers: ['hash21'],
    params: [
      { key: 'count', min: 2, max: 30, step: 0.1, def: 8 },
      { key: 'size', min: 0.05, max: 0.5, step: 0.01, def: 0.3 },
      { key: 'speed', min: 0, max: 4, step: 0.01, def: 1 },
    ],
    code: [
      'vec2 q = p * $count * 0.5; vec2 id = floor(q); vec2 g = fract(q) - 0.5;',
      'float s = $size * (0.75 + 0.25 * sin(t * $speed * 2.0 + hash21(id) * 6.2831853));',
      'f = 1.0 - smoothstep(s * 0.7, s, length(g));',
    ].join('\n'),
  },
  {
    // Fewer sides than a triangle draws a circle.
    type: 'shape', stage: 'pattern', cost: 1,
    params: [
      { key: 'sides', min: 2, max: 12, step: 1, def: 6, whole: true },
      { key: 'size', min: 0.1, max: 1.5, step: 0.01, def: 0.6 },
      { key: 'glow', min: 2, max: 60, step: 0.1, def: 10 },
    ],
    code: [
      'float d = length(p);',
      'if ($sides >= 3.0) { float n = floor($sides); float a = atan(p.x, p.y) + PI; float r = 6.2831853 / n; d = cos(floor(0.5 + a / r) * r - a) * length(p); }',
      'f = exp(-abs(d - $size) * $glow);',
    ].join('\n'),
  },
  {
    type: 'lines', stage: 'pattern', cost: 1,
    params: [
      { key: 'count', min: 1, max: 20, step: 0.1, def: 6 },
      { key: 'wobble', min: 0, max: 1, step: 0.01, def: 0.3 },
      { key: 'glow', min: 2, max: 60, step: 0.1, def: 12 },
      { key: 'speed', min: -3, max: 3, step: 0.01, def: 1 },
    ],
    code: [
      'float y = p.y * $count * 0.5 + sin(p.x * 2.5 + t * $speed) * $wobble;',
      'f = exp(-abs(fract(y) - 0.5) * $glow);',
    ].join('\n'),
  },
  {
    type: 'checker', stage: 'pattern', cost: 1,
    params: [{ key: 'count', min: 1, max: 20, step: 0.1, def: 6 }],
    code: 'vec2 q = floor(p * $count * 0.5); f = mod(q.x + q.y, 2.0);',
  },
  {
    type: 'sparkle', stage: 'pattern', cost: 1, helpers: ['hash21'],
    params: [
      { key: 'density', min: 4, max: 40, step: 0.1, def: 14 },
      { key: 'amount', min: 0, max: 1, step: 0.01, def: 0.5 },
      { key: 'speed', min: 0, max: 4, step: 0.01, def: 1 },
    ],
    code: [
      'vec2 q = p * $density * 0.5; vec2 id = floor(q); vec2 g = fract(q) - 0.5;',
      'float h = hash21(id); vec2 o = (vec2(hash21(id + 3.1), hash21(id + 7.7)) - 0.5) * 0.6;',
      'f = step(1.0 - $amount, h) * exp(-length(g - o) * 18.0) * (0.5 + 0.5 * sin(t * $speed * 3.0 + h * 6.2831853));',
    ].join('\n'),
  },
  {
    // A Larson scanner: one bar bouncing end to end, trailing a fading tail.
    type: 'scanner', stage: 'pattern', cost: 1,
    params: [
      { key: 'shape', min: 0, max: 2, step: 1, def: 0, options: ['lighting.studio.shape.linear', 'lighting.studio.shape.radial', 'lighting.studio.shape.clock'] },
      { key: 'angle', min: 0, max: 360, step: 1, def: 0 },
      { key: 'speed', min: 0, max: 4, step: 0.01, def: 1 },
      { key: 'size', min: 0.02, max: 0.5, step: 0.01, def: 0.1 },
      { key: 'tail', min: 0, max: 1, step: 0.01, def: 0.4 },
    ],
    code: [
      'float ar = u_resolution.x / u_resolution.y; float x;',
      'if ($shape < 0.5) { float a = radians($angle); vec2 dir = vec2(cos(a), sin(a)); x = dot(p, dir) / (2.0 * (abs(dir.x) * ar + abs(dir.y))) + 0.5; }',
      'else if ($shape < 1.5) { x = length(p) / length(vec2(ar, 1.0)); }',
      'else { x = fract(atan(p.y, p.x) / 6.2831853 + 0.25); }',
      'float u = fract(t * $speed * 0.25); float at = 1.0 - abs(u * 2.0 - 1.0); float dx = abs(x - at);',
      'if ($shape > 1.5) dx = min(dx, 1.0 - dx);',
      'float head = 1.0 - smoothstep($size * 0.5, $size, dx);',
      // The trail fades with the time since the bar last passed, so it shrinks into each end on the bounce.
      'float since = min(fract(u - x * 0.5), fract(u - 1.0 + x * 0.5));',
      'float trail = exp(-since / max($tail * 0.25, 0.001)) * step(0.001, $tail);',
      'f = max(head, trail * 0.8);',
    ].join('\n'),
  },
  {
    // A theater chase: evenly spaced lit segments marching along, like marquee bulbs.
    type: 'chase', stage: 'pattern', cost: 1,
    params: [
      { key: 'shape', min: 0, max: 2, step: 1, def: 0, options: ['lighting.studio.shape.linear', 'lighting.studio.shape.radial', 'lighting.studio.shape.clock'] },
      { key: 'angle', min: 0, max: 360, step: 1, def: 0 },
      { key: 'count', min: 2, max: 40, step: 1, def: 12, whole: true },
      { key: 'size', min: 0.1, max: 0.9, step: 0.01, def: 0.4 },
      { key: 'speed', min: -4, max: 4, step: 0.01, def: 1 },
    ],
    code: [
      'float ar = u_resolution.x / u_resolution.y; float x;',
      'if ($shape < 0.5) { float a = radians($angle); vec2 dir = vec2(cos(a), sin(a)); x = dot(p, dir) / (2.0 * (abs(dir.x) * ar + abs(dir.y))) + 0.5; }',
      'else if ($shape < 1.5) { x = length(p) / length(vec2(ar, 1.0)); }',
      'else { x = fract(atan(p.y, p.x) / 6.2831853 + 0.25); }',
      'float c = fract(x * $count - t * $speed * 0.5);',
      'f = smoothstep(0.0, 0.03, c) * (1.0 - smoothstep($size - 0.03, $size, c));',
    ].join('\n'),
  },
  {
    // Flames rising from the bottom edge (p.y grows downward); size is how high they reach.
    type: 'flame', stage: 'pattern', cost: 2, helpers: ['fbm'],
    params: [
      { key: 'scale', min: 0.5, max: 6, step: 0.01, def: 2.5 },
      { key: 'speed', min: 0, max: 3, step: 0.01, def: 1 },
      { key: 'size', min: 0, max: 1, step: 0.01, def: 0.5 },
    ],
    code: [
      'float h = clamp((1.0 - p.y) * 0.5, 0.0, 1.0);',
      'float n = fbm(vec2(p.x * $scale, h * 2.0 * $scale - t * $speed * 1.5));',
      'f = clamp(n * 1.6 - h * (2.2 - $size * 1.6), 0.0, 1.0);',
    ].join('\n'),
  },
  // ---- tone ----
  {
    type: 'bands', stage: 'tone', cost: 1,
    params: [{ key: 'steps', min: 2, max: 16, step: 1, def: 5, whole: true }],
    code: 'v = min(floor(v * $steps), $steps - 1.0) / ($steps - 1.0);',
  },
  {
    type: 'sharpen', stage: 'tone', cost: 1,
    params: [{ key: 'power', min: 0.2, max: 6, step: 0.01, def: 2 }],
    code: 'v = pow(clamp(v, 0.0, 1.0), $power);',
  },
  {
    type: 'contour', stage: 'tone', cost: 1,
    params: [
      { key: 'count', min: 2, max: 30, step: 0.1, def: 10 },
      { key: 'glow', min: 4, max: 80, step: 0.1, def: 24 },
    ],
    code: 'float c = fract(v * $count); v = exp(-min(c, 1.0 - c) * $glow);',
  },
  {
    type: 'invert', stage: 'tone', cost: 1,
    params: [{ key: 'amount', min: 0, max: 1, step: 0.01, def: 1 }],
    code: 'v = mix(v, 1.0 - v, $amount);',
  },
  {
    type: 'threshold', stage: 'tone', cost: 1,
    params: [
      { key: 'level', min: 0, max: 1, step: 0.01, def: 0.5 },
      { key: 'softness', min: 0.005, max: 0.5, step: 0.005, def: 0.08 },
    ],
    code: 'v = smoothstep($level - $softness, $level + $softness, v);',
  },
  // ---- color ----
  {
    type: 'palette', stage: 'color', cost: 1, helpers: ['presetPal'],
    params: [
      { key: 'palette', min: 0, max: PALETTE_OPTIONS.length - 1, step: 1, def: 3, options: PALETTE_OPTIONS },
      { key: 'spread', min: 0, max: 3, step: 0.01, def: 1 },
      { key: 'offset', min: 0, max: 1, step: 0.01, def: 0 },
      { key: 'cycle', min: -2, max: 2, step: 0.01, def: 0 },
      { key: 'shade', min: 0, max: 1, step: 0.01, def: 0.6 },
    ],
    code: 'col = presetPal(v * $spread + $offset + hue + t * $cycle * 0.1, $palette) * mix(1.0, v, $shade);',
  },
  {
    type: 'colors', stage: 'color', cost: 1, helpers: ['grad3'],
    params: [
      { key: 'spread', min: 0, max: 3, step: 0.01, def: 1 },
      { key: 'cycle', min: -2, max: 2, step: 0.01, def: 0 },
      { key: 'shade', min: 0, max: 1, step: 0.01, def: 0.6 },
    ],
    colors: [
      { key: 'c1', def: [1, 0.16, 0.55] },
      { key: 'c2', def: [0.2, 0.35, 1] },
      { key: 'c3', def: [0, 0.9, 0.8] },
    ],
    code: 'col = grad3(v * $spread + hue + t * $cycle * 0.1, $c1, $c2, $c3) * mix(1.0, v, $shade);',
  },
  // ---- finish ----
  {
    type: 'glow', stage: 'finish', cost: 1,
    params: [{ key: 'amount', min: 0, max: 2, step: 0.01, def: 0.6 }],
    code: 'col *= 1.0 + $amount * v * v;',
  },
  {
    type: 'pulse', stage: 'finish', cost: 1,
    params: [
      { key: 'rate', min: 0, max: 4, step: 0.01, def: 1 },
      { key: 'depth', min: 0, max: 1, step: 0.01, def: 0.4 },
    ],
    code: 'col *= 1.0 - $depth * (0.5 + 0.5 * sin(t * $rate * 3.0));',
  },
  {
    type: 'vignette', stage: 'finish', cost: 1,
    params: [{ key: 'amount', min: 0, max: 1.5, step: 0.01, def: 0.5 }],
    code: 'col *= 1.0 - $amount * smoothstep(0.3, 1.5, length(p0));',
  },
  {
    type: 'scanlines', stage: 'finish', cost: 1,
    params: [
      { key: 'count', min: 20, max: 300, step: 1, def: 100 },
      { key: 'amount', min: 0, max: 1, step: 0.01, def: 0.35 },
    ],
    code: 'col *= 1.0 - $amount * (0.5 + 0.5 * sin(p0.y * $count * PI));',
  },
  {
    type: 'grain', stage: 'finish', cost: 1, helpers: ['hash21'],
    params: [{ key: 'amount', min: 0, max: 0.3, step: 0.005, def: 0.06 }],
    code: 'col += $amount * (hash21(gl_FragCoord.xy + fract(t * 7.0) * 113.0) - 0.5);',
  },
];

const BY_TYPE = new Map(STUDIO_BLOCKS.map(b => [b.type, b]));

export function studioBlock(type: string): StudioBlockDef | undefined {
  return BY_TYPE.get(type);
}

export function blocksForStage(stage: StudioStage): StudioBlockDef[] {
  return STUDIO_BLOCKS.filter(b => b.stage === stage);
}
