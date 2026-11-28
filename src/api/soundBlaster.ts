import { deleteService, fetchService, postService, putService } from './service';

export type SoundBlasterOutput = 'speakers' | 'headphones';

/** A Creative Sound Blaster (G8, G6) as Creative App controls it. */
export interface SoundBlasterState {
  present: boolean;
  /** "Creative Sound Blaster G8". */
  name?: string;
  model?: string;
  firmware?: string;
  serial?: string;
  error?: string;
  /** The SBX processing (the effects and the EQ) is on. */
  sbx: boolean;
  /** Scout Mode; SBX is off while it is on. */
  scout: boolean;
  voiceClarity: boolean;
  /** DSP parameters by "family:id" in hex, e.g. "96:07" (Crystalizer on). Only the ones the device answered. */
  values: Record<string, number>;
  output?: SoundBlasterOutput;
  outputs: SoundBlasterOutput[];
  dacFilter?: number;
  dacFilters: number[];
  /** dB: 0, 10, 20 or 30. */
  micBoost?: number;
  /** The device features it has, on or off. */
  features: Partial<Record<SoundBlasterFeature, boolean>>;
  /** The Voice Morph character / mic EQ preset the device's values match; absent when none does. */
  voiceMorph?: string | null;
  micEq?: string | null;
  voicePresets: SoundBlasterPreset[];
  micEqPresets: SoundBlasterPreset[];
  micEqBandHz: number[];
  /** Windows' volume of the card's own endpoints, playback first. */
  mixer: SoundBlasterMixerChannel[];
  /** Modes saved in Nexus, and the one the device matches now. */
  modes: string[];
  activeMode?: string | null;
}

export type SoundBlasterFeature = 'directMode' | 'spdifDirect' | 'speakerVirtualization' | 'logoLed' | 'energySaving' | 'volumeSync';

export interface SoundBlasterPreset {
  id: string;
  name: string;
  /** A mic EQ preset's band gains (dB). */
  values?: number[] | null;
}

export interface SoundBlasterMixerChannel {
  id: string;
  /** "Speakers", "Microphone", "Line", "SPDIF Interface", "Digital Audio Interface". */
  name: string;
  direction: 'playback' | 'recording';
  /** 0 to 1. */
  volume: number;
  muted: boolean;
}

/** Parameter families: playback (SBX and EQ), recording (mic), decoder. */
export const PLAYBACK = 0x96;
export const RECORDING = 0x95;
export const DECODER = 0x97;

/** The key a parameter has in `values`. */
export const paramKey = (family: number, id: number) =>
  `${family.toString(16).padStart(2, '0')}:${id.toString(16).padStart(2, '0')}`;

const BASE = '/devices/soundblaster';

export const fetchSoundBlaster = (signal?: AbortSignal) => fetchService<SoundBlasterState>(BASE, signal);

// Every change answers with the state after it, or null when the device did not take it.
export const setSoundBlasterParameter = (family: number, id: number, value: number) =>
  putService<SoundBlasterState>(`${BASE}/parameter`, { family, id, value });

export const setSoundBlasterSbx = (enabled: boolean) => postService<SoundBlasterState>(`${BASE}/sbx`, { enabled });

export const setSoundBlasterScout = (enabled: boolean) => postService<SoundBlasterState>(`${BASE}/scout`, { enabled });

export const setSoundBlasterOutput = (output: SoundBlasterOutput) => postService<SoundBlasterState>(`${BASE}/output`, { output });

export const setSoundBlasterFilter = (value: number) => postService<SoundBlasterState>(`${BASE}/filter`, { value });

export const setSoundBlasterMicBoost = (value: number) => postService<SoundBlasterState>(`${BASE}/mic-boost`, { value });

export const setSoundBlasterFeature = (name: SoundBlasterFeature, enabled: boolean) =>
  postService<SoundBlasterState>(`${BASE}/feature`, { name, enabled });

export const setSoundBlasterVoiceMorph = (preset: string) => postService<SoundBlasterState>(`${BASE}/voice-morph`, { preset });

export const setSoundBlasterMicEq = (preset: string) => postService<SoundBlasterState>(`${BASE}/mic-eq`, { preset });

export const setSoundBlasterMixer = (id: string, patch: { volume?: number; muted?: boolean }) =>
  postService<SoundBlasterState>(`${BASE}/mixer`, { id, ...patch });

/** Keeps the current playback settings under a name; the same name replaces it. */
export const saveSoundBlasterMode = (name: string) => postService<SoundBlasterState>(`${BASE}/modes`, { name });

export const applySoundBlasterMode = (name: string) => postService<SoundBlasterState>(`${BASE}/modes/apply`, { name });

export const renameSoundBlasterMode = (name: string, to: string) => postService<SoundBlasterState>(`${BASE}/modes/rename`, { name, to });

export const deleteSoundBlasterMode = (name: string) => deleteService<SoundBlasterState>(`${BASE}/modes/${encodeURIComponent(name)}`);
