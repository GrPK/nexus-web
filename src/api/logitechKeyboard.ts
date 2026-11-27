import { fetchService, postService, putService, resolveHttp, tokenParam } from './service';

/**
 * What one key does on a layer: "keyboard" (code = HID usage, modifiers = Ctrl 1, Shift 2, Alt 4,
 * Win 8, right-hand ones shifted by 4), "mouse" (code = button mask), "consumer" (code = media
 * usage), "gshift" (holds the G-Shift layer), "disabled" (sends nothing).
 */
export interface KeyAssignment {
  /** Key number: the key's position in `KeyboardState.controls`. */
  key: number;
  kind: 'keyboard' | 'mouse' | 'consumer' | 'gshift' | 'disabled';
  code: number;
  modifiers: number;
}

/** Assignments per layer; a key that is not listed does what it does by default. */
export interface KeyboardLayers {
  base: KeyAssignment[];
  /** While Fn is held. */
  fn: KeyAssignment[];
  /** While the G-Shift key is held; keys not listed keep their Base assignment. */
  gShift: KeyAssignment[];
}

export interface KeyboardState {
  present: boolean;
  name?: string;
  model?: string;
  error?: string;
  layoutCode?: number;
  /** Shape of Enter and the keys around it: the user's choice, else the one known for the keyboard. */
  layout?: 'ansi' | 'iso' | null;
  /** The user's choice of layout; null to follow the keyboard. */
  layoutChoice?: 'ansi' | 'iso' | null;
  /** The layout known for the keyboard's layout code; null when unknown. */
  layoutDetected?: 'ansi' | 'iso' | null;
  /** Whether G HUB's picture of this keyboard (for `layout`) is on this PC. */
  photo?: boolean;
  /** Logitech control id of each key number; 0 for an empty slot. */
  controls: number[];
  /** Whether the keyboard applies the assignments now (Fn+F1 switches it too). */
  enabled?: boolean | null;
  /** Whether Nexus has written its layers to this keyboard yet. */
  written: boolean;
  /** When the user last saved a copy of the assignments in Nexus (ISO time); null when there is none. */
  savedAt?: string | null;
  layers: KeyboardLayers;
}

const BASE = '/devices/logitech-keyboard';

export const fetchKeyboard = (signal?: AbortSignal) => fetchService<KeyboardState>(BASE, signal);

/** URL of G HUB's picture of the keyboard for a layout (from the user's G HUB install; not shipped with Nexus). */
export function keyboardPhotoUrl(layout: 'ansi' | 'iso'): string {
  const base = resolveHttp(`${BASE}/image?layout=${layout}`);
  const tok = tokenParam();
  return tok ? `${base}&${tok}` : base;
}

// Every change answers with the state after it, or null when the keyboard did not take it.
export const setKeyboardLayers = (layers: KeyboardLayers) => putService<KeyboardState>(`${BASE}/layers`, layers);

/** Writes the kept layers again, after another app changed the keyboard. */
export const rewriteKeyboard = () => postService<KeyboardState>(`${BASE}/rewrite`, {});

/** Saves a copy of the current assignments in Nexus. */
export const saveKeyboardCopy = () => postService<KeyboardState>(`${BASE}/copy/save`, {});

/** Makes the saved copy current again and writes it to the keyboard. */
export const restoreKeyboardCopy = () => postService<KeyboardState>(`${BASE}/copy/restore`, {});

export const setKeyboardEnabled = (enabled: boolean) => postService<KeyboardState>(`${BASE}/enabled`, { enabled });

/** "ansi", "iso", or null to follow the keyboard. */
export const setKeyboardLayout = (layout: 'ansi' | 'iso' | null) => postService<KeyboardState>(`${BASE}/layout`, { layout });
