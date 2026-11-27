import { fetchService, postService, putService } from './service';

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
