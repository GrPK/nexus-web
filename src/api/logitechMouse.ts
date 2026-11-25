import { fetchService, postService, putService } from './service';

/** One button binding of an onboard profile. */
export interface MouseButton {
  slot: number;
  /** "mouse" (code = button mask), "key" (HID usage + modifiers), "consumer" (media usage), "special" (built-in function), "raw" (kept as is). */
  kind: 'mouse' | 'key' | 'consumer' | 'special' | 'raw';
  code: number;
  modifiers: number;
  /** Hex bytes of a raw binding (macros and other encodings). */
  raw?: string;
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
