import { fetchService, postService, putService, resolveHttp, tokenParam } from './service';

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

/** A picture of the mouse the user gave Nexus, with each button's spot on it (in its pixels). */
export interface MousePicture {
  width: number;
  height: number;
  spots: { slot: number; x: number; y: number; side?: 'left' | 'right' | null }[];
}

export interface MouseState {
  present: boolean;
  name?: string;
  model?: string;
  /** "onboard": the mouse runs its stored profile; "host": software drives it. */
  mode?: 'onboard' | 'host';
  /** Nexus puts the mouse back on its onboard memory when another app switches it to host mode (not while G HUB runs). */
  keepOnboard?: boolean;
  /** A picture of the mouse kept in its Nexus folder; null when there is none. */
  picture?: MousePicture | null;
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

/** URL of the picture of the mouse kept in its Nexus folder. */
export function mousePictureUrl(): string {
  const base = resolveHttp(`${BASE}/picture`);
  const tok = tokenParam();
  return tok ? `${base}?${tok}` : base;
}

// Every change answers with the state after it, or null when the mouse did not take it.
export const updateMouseProfile = (profile: number, patch: MouseProfilePatch) =>
  putService<MouseState>(`${BASE}/profiles/${profile}`, patch);

/** Writes back the profile as Nexus first read it from this mouse. */
export const restoreMouseProfile = (profile: number) => postService<MouseState>(`${BASE}/profiles/${profile}/restore`, {});

/** Switches profiles; one out of the cycle is put in it first (the mouse only switches to those). */
export const setMouseActiveProfile = (profile: number) => postService<MouseState>(`${BASE}/active`, { profile });

/** Puts a profile in the cycle the profile button steps through, or takes it out. */
export const setMouseProfileCycle = (profile: number, enabled: boolean) =>
  postService<MouseState>(`${BASE}/profiles/${profile}/cycle`, { enabled });

export const setMouseMode = (mode: 'onboard' | 'host') => postService<MouseState>(`${BASE}/mode`, { mode });

export const setMouseKeepOnboard = (enabled: boolean) => postService<MouseState>(`${BASE}/keep-onboard`, { enabled });
