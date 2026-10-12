import { setPins, type Pin } from '../../../api/lighting';
import { hexToHsv, hsvToHex } from '../../../lib/settings';
import { nearestPaletteId, paletteKey, type PaletteColor } from '../../../types/lightingPalette';
import type { EffectState } from '../../../types/lighting';

/** Device id to the pin it wears. Absent means following the global mode. */
export type Pins = Readonly<Record<string, Pin>>;

/**
 * The selection the lighting page and the immersive editor share. An empty
 * selection means "all devices": a pick then applies globally and pins nothing.
 * Browser-local, and keyed apart from the old per-device-pick selection, which
 * was seeded with every device.
 */
export const SELECTED_DEVICES_STORAGE_KEY = 'nexus.lighting.pinSelection';

/** The selection's anchor device, read by the page's scoped editor. */
export const PRIMARY_DEVICE_STORAGE_KEY = 'nexus.lighting.primaryDevice';

/** `pins` with every id set to `pin`, or removed for a null pin. */
export function withPins(prev: Pins, ids: readonly string[], pin: Pin | null): Pins {
  let next: Record<string, Pin> | null = null;
  for (const id of ids) {
    if (pin === null) {
      if (!(id in prev)) continue;
      next ??= { ...prev };
      delete next[id];
    } else if (prev[id] !== pin) {
      next ??= { ...prev };
      next[id] = pin;
    }
  }
  return next ?? prev;
}

/** The static pin for a pattern picked from the grid. The whole look travels, so
 *  the service renders THIS effect for the device, not the swatch colour. */
export function staticLookPin(key: string, slot: number, state: EffectState): Pin {
  return {
    kind: 'static',
    effect: key,
    intensity: state.intensity,
    hue: Math.min(1, Math.max(0, state.hue)),
    colorize: state.colorize,
    saturation: Math.min(1, Math.max(0, state.saturation)),
    contrast: state.contrast,
    params: state.params,
    slot,
  };
}

/** The static pin for a plain colour (palette swatch or picker): a flat fill. */
export function colorPin(hex: string): Pin {
  const { h, s } = hexToHsv(hex);
  return {
    kind: 'static', effect: 'flat', color: hex,
    intensity: 1, hue: h / 360, colorize: 0, saturation: s / 100, contrast: 1, params: {}, slot: 0,
  };
}

/** The static pin for a palette swatch. */
export const paletteColorPin = (color: PaletteColor): Pin => ({
  ...colorPin(color.hex), hue: color.h, saturation: color.s,
});

export const animatePin = (effect: string): Pin => ({ kind: 'animate', effect });

export const MIRROR_PIN: Pin = { kind: 'mirror' };

/** Stable identity of a pin's target, for "do these devices share one pin". */
export function pinSignature(pin: Pin): string {
  return JSON.stringify([
    pin.kind, pin.effect ?? '', pin.color ?? '', pin.slot ?? 0,
    pin.intensity ?? 1, pin.hue ?? 0, pin.colorize ?? 0, pin.saturation ?? 1, pin.contrast ?? 1,
    pin.params ? Object.entries(pin.params).sort(([a], [b]) => a.localeCompare(b)) : [],
  ]);
}

/**
 * What a selection wears. `none`: nothing selected, or every selected device
 * follows the global mode. `pin`: they all wear one pin. `mixed`: they differ.
 */
export type SelectionPin =
  | { kind: 'none' }
  | { kind: 'pin'; pin: Pin }
  | { kind: 'mixed' };

export function selectionPin(pins: Pins, ids: readonly string[]): SelectionPin {
  if (ids.length === 0) return { kind: 'none' };
  let first: Pin | null | undefined;
  let sig = '';
  for (const id of ids) {
    const pin = pins[id] ?? null;
    const s = pin ? pinSignature(pin) : '';
    if (first === undefined) { first = pin; sig = s; } else if (s !== sig) return { kind: 'mixed' };
  }
  return first ? { kind: 'pin', pin: first } : { kind: 'none' };
}

/** The effect-grid key a static or animate pin lights: a flat colour resolves to its palette swatch. */
export function pinGridKey(pin: Pin): string {
  if (pin.kind === 'static' && pin.effect === 'flat' && pin.color) return paletteKey(nearestPaletteId(pin.color));
  return pin.effect ?? '';
}

/** The colour a static pin shows on a card strip or marker. */
export function pinHex(pin: Pin): string {
  if (pin.color) return pin.color;
  return hsvToHex((pin.hue ?? 0) * 360, (pin.saturation ?? 1) * 100, 100);
}

/** What a card strip falls back to painting when the frame carries no bytes for a pinned device. */
export function pinStripPick(pin: Pin): { key: string; slot: number; hex: string } | null {
  if (pin.kind === 'mirror' || !pin.effect) return null;
  return { key: pinGridKey(pin), slot: pin.slot ?? 0, hex: pinHex(pin) };
}

/** Ids of `ids` that wear a pin. */
export const pinnedAmong = (pins: Pins, ids: readonly string[]): string[] => ids.filter(id => id in pins);

/**
 * Device names per target effect, for the thumbnail badge: animate pins
 * (`kind` 'animate') or static pattern pins (`kind` 'static'). Ids with no
 * known device are left out, and the count follows the names.
 */
export function pinnedNamesByEffect(
  pins: Pins,
  kind: 'animate' | 'static',
  nameOf: (id: string) => string | undefined,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [id, pin] of Object.entries(pins)) {
    if (pin.kind !== kind || !pin.effect || (kind === 'static' && pin.effect === 'flat')) continue;
    const name = nameOf(id);
    if (!name) continue;
    const names = out.get(pin.effect);
    if (names) names.push(name); else out.set(pin.effect, [name]);
  }
  return out;
}

/** Pins every id to `pin`. Fire-and-forget callers use {@link setPins} directly. */
export const pushPins = (ids: string[], pin: Pin | null): Promise<boolean> =>
  ids.length === 0 ? Promise.resolve(true) : setPins(ids, pin).catch(() => false);

/**
 * The solid fill nearest a colour, hue first. Static has no global solid-colour
 * source beyond these shaders, so a colour picked with nothing selected runs
 * the closest of them; a colour picked WITH a selection is a pin and keeps its
 * exact value. The reference colours are the fills' nominal ones.
 */
const FILL_REFERENCE: ReadonlyArray<readonly [key: string, hex: string]> = [
  ['simplewhite', '#ffffff'], ['simplesoftpink', '#ffb6c8'], ['simplepink', '#ff69b4'],
  ['simplered', '#ff0000'], ['simpleorange', '#ff8000'], ['simpleyellow', '#ffff00'],
  ['simplegreen', '#00ff00'], ['simpledarkgreen', '#008040'], ['simplecyan', '#00ffff'],
  ['simpleblue', '#0000ff'], ['simpleviolet', '#8000ff'],
];

export function nearestFillKey(hex: string): string {
  const parse = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = parse(hex.length === 7 ? hex : '#ffffff');
  let best = FILL_REFERENCE[0][0];
  let bestD = Infinity;
  for (const [key, ref] of FILL_REFERENCE) {
    const [rr, gg, bb] = parse(ref);
    const d = (r - rr) ** 2 + (g - gg) ** 2 + (b - bb) ** 2;
    if (d < bestD) { bestD = d; best = key; }
  }
  return best;
}
