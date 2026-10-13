import type {
  UmbraAsyncSettings,
  UmbraEffectSettings,
  UmbraEffectSpec,
  UmbraGroup,
  UmbraPort,
  UmbraState,
} from '../../../api/asiahorse-umbra';

export const PERCENT_PER_LEVEL = 20;
export const MAX_LEVEL = 5;
export const MIN_BRIGHTNESS_LEVEL = 1;
export const MAX_LED_COUNT = 120;
export const COLOR_SLOTS = 4;
export const DEFAULT_COLOR = '#ff0000';

export function levelToPercent(level: number): number {
  return level * PERCENT_PER_LEVEL;
}

export function percentToLevel(percent: number, min: number): number {
  return Math.min(MAX_LEVEL, Math.max(min, Math.round(percent / PERCENT_PER_LEVEL)));
}

/** Ports the controller reports LEDs on, the only ones Async can address. */
export function populatedPorts(ports: readonly UmbraPort[]): UmbraPort[] {
  return ports.filter(p => p.ledCount > 0);
}

/** The effects the chosen mode can play; Merge plays a subset. */
export function effectsForGroup(effects: readonly UmbraEffectSpec[], group: UmbraGroup): UmbraEffectSpec[] {
  return group === 'merge' ? effects.filter(e => e.merge) : [...effects];
}

/** The settings the page edits for a mode; Async edits one port at a time. */
export function activeSettings(state: UmbraState, port: number): (UmbraEffectSettings & { port?: number }) {
  const { lighting } = state;
  if (lighting.group === 'merge') return lighting.merge;
  if (lighting.group === 'async') {
    return lighting.async.find(a => a.port === port) ?? { ...lighting.sync, port };
  }
  return lighting.sync;
}

/** A color list padded to the four slots the controller stores, with one slot replaced. */
export function withColor(colors: readonly string[], slot: number, hex: string, fill: string): string[] {
  const next = Array.from({ length: Math.max(COLOR_SLOTS, slot + 1) }, (_, i) => colors[i] ?? fill);
  next[slot] = hex;
  return next;
}

/** Applies a patch to the cached state so a control moves before the service answers. */
export function previewEffect(
  state: UmbraState,
  port: number,
  patch: Partial<UmbraEffectSettings>,
): UmbraState {
  const { lighting } = state;
  if (lighting.group === 'sync') return { ...state, lighting: { ...lighting, sync: { ...lighting.sync, ...patch } } };
  if (lighting.group === 'merge') return { ...state, lighting: { ...lighting, merge: { ...lighting.merge, ...patch } } };
  const current: UmbraAsyncSettings = lighting.async.find(a => a.port === port) ?? { ...lighting.sync, port };
  const next = { ...current, ...patch, port };
  const others = lighting.async.filter(a => a.port !== port);
  return { ...state, lighting: { ...lighting, async: [...others, next].sort((a, b) => a.port - b.port) } };
}

export function totalLeds(ports: readonly UmbraPort[]): number {
  return ports.reduce((sum, p) => sum + p.ledCount, 0);
}
