import { fetchService, postService, putService } from './service';

/**
 * One step of a macro the mouse plays from its own memory: "keyDown"/"keyUp" (code = HID usage,
 * 0xE0-0xE7 for the modifier keys), "delay" (code = ms), "mouseDown"/"mouseUp" (code = button mask),
 * "consumerDown"/"consumerUp" (code = media usage), "wheel"/"hwheel" (code = signed clicks).
 */
export interface MacroStep {
  type: 'keyDown' | 'keyUp' | 'delay' | 'mouseDown' | 'mouseUp' | 'consumerDown' | 'consumerUp' | 'wheel' | 'hwheel';
  code: number;
  modifiers?: number;
}

/** One button binding of an onboard profile. */
export interface MouseButton {
  slot: number;
  /**
   * "mouse" (code = button mask), "key" (HID usage + modifiers), "consumer" (media usage), "special" (built-in function),
   * "macro" (code = sector, modifiers = address; steps in macro), "raw" (kept as is).
   */
  kind: 'mouse' | 'key' | 'consumer' | 'special' | 'macro' | 'raw';
  code: number;
  modifiers: number;
  /** Hex bytes of a raw binding (other encodings). */
  raw?: string;
  /** A macro's steps; sent with kind "macro" to store a new one. Absent for a macro that uses commands Nexus does not edit. */
  macro?: MacroStep[] | null;
  /** For "macro": false when the macro was made elsewhere with commands Nexus keeps but does not edit. */
  macroEditable?: boolean | null;
}

/** A profile stored in the mouse's own memory. */
export interface MouseProfile {
  number: number;
  sector: number;
  enabled: boolean;
  name: string;
  reportRateHz: number;
  /** Five levels; 0 marks an unused one. */
  dpi: number[];
  defaultDpiIndex: number;
  shiftDpiIndex: number;
  buttons: MouseButton[];
  gShiftButtons: MouseButton[];
  crcValid: boolean;
  /** A backup of the profile as Nexus first read it exists. */
  canRestore: boolean;
}

export interface MouseState {
  present: boolean;
  name?: string;
  model?: string;
  /** "onboard": the mouse runs its stored profile; "host": software drives it. */
  mode?: 'onboard' | 'host';
  activeProfile?: number;
  buttonCount: number;
  buttonLabels: string[];
  specials: { code: number; name: string }[];
  reportRatesHz: number[];
  profiles: MouseProfile[];
  error?: string;
  /** Onboard memory sectors for macros, and how many hold no macro in use. */
  macroSectors?: number;
  macroSectorsFree?: number;
}

/** Fields to change in a profile; omitted ones keep their value. */
export interface MouseProfilePatch {
  name?: string;
  reportRateHz?: number;
  dpi?: number[];
  defaultDpiIndex?: number;
  shiftDpiIndex?: number;
  buttons?: MouseButton[];
  gShiftButtons?: MouseButton[];
}

const BASE = '/devices/logitech-mouse';

export const fetchMouse = (signal?: AbortSignal) => fetchService<MouseState>(BASE, signal);

// Every change answers with the state after it, or null when the mouse did not take it.
export const updateMouseProfile = (profile: number, patch: MouseProfilePatch) =>
  putService<MouseState>(`${BASE}/profiles/${profile}`, patch);

/** Writes back the profile as Nexus first read it from this mouse. */
export const restoreMouseProfile = (profile: number) => postService<MouseState>(`${BASE}/profiles/${profile}/restore`, {});

export const setMouseActiveProfile = (profile: number) => postService<MouseState>(`${BASE}/active`, { profile });

export const setMouseMode = (mode: 'onboard' | 'host') => postService<MouseState>(`${BASE}/mode`, { mode });
