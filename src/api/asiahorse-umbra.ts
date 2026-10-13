import { fetchService, postService, putService } from './service';

export type UmbraSource = 'nexus' | 'firmware' | 'argbInput';
export type UmbraGroup = 'sync' | 'async' | 'merge';
export type UmbraDirection = 'forward' | 'reverse';
export type UmbraBootMode = 'memory' | 'fixed';

export interface UmbraEffectSettings {
  effect: string;
  /** 0..5, 20 % steps. */
  speed: number;
  /** 1..5, 20 % steps. */
  brightness: number;
  direction: UmbraDirection;
  colors: string[];
}

export interface UmbraAsyncSettings extends UmbraEffectSettings {
  /** 0-based port index. */
  port: number;
}

export interface UmbraLighting {
  source: UmbraSource;
  lightOn: boolean;
  group: UmbraGroup;
  sync: UmbraEffectSettings;
  merge: UmbraEffectSettings;
  async: UmbraAsyncSettings[];
}

export interface UmbraPort {
  /** 0-based. */
  index: number;
  ledCount: number;
  direction: UmbraDirection;
  /** 1..10. */
  order: number;
}

export interface UmbraEffectSpec {
  key: string;
  /** How many color slots the effect reads. */
  colors: number;
  speed: boolean;
  direction: boolean;
  /** Playable in Merge mode. */
  merge: boolean;
}

export interface UmbraState {
  isConnected: boolean;
  deviceId?: string;
  firmware?: string;
  lighting: UmbraLighting;
  fan: { syncMb: boolean; duty: number };
  boot: { mode: UmbraBootMode; selfCheck: boolean };
  ports: UmbraPort[];
  effects: UmbraEffectSpec[];
}

export type UmbraEffectPatch = Partial<UmbraEffectSettings>;

export interface UmbraLightingPatch {
  source?: UmbraSource;
  lightOn?: boolean;
  group?: UmbraGroup;
  sync?: UmbraEffectPatch;
  merge?: UmbraEffectPatch;
  async?: UmbraEffectPatch & { port: number };
}

export type UmbraPortPatch = Partial<Pick<UmbraPort, 'ledCount' | 'direction' | 'order'>>;
export type UmbraBootPatch = Partial<UmbraState['boot']>;

const BASE = '/devices/asiahorse-umbra';

// A failed call answers with the { error, msg } envelope and no payload, so a
// body without the lighting block is a failure, not a state.
function asState(body: UmbraState | null): UmbraState | null {
  return body && Array.isArray(body.ports) && body.lighting ? body : null;
}

export async function getUmbraState(): Promise<UmbraState | null> {
  return asState(await fetchService<UmbraState>(BASE));
}

export async function setUmbraLighting(patch: UmbraLightingPatch): Promise<UmbraState | null> {
  return asState(await putService<UmbraState>(`${BASE}/lighting`, patch));
}

export async function setUmbraFan(syncMb: boolean): Promise<UmbraState | null> {
  return asState(await putService<UmbraState>(`${BASE}/fan`, { syncMb }));
}

export async function setUmbraPort(index: number, patch: UmbraPortPatch): Promise<UmbraState | null> {
  return asState(await putService<UmbraState>(`${BASE}/ports/${index}`, patch));
}

/** Restarts the controller and re-reads the LED counts; resolves once it reconnects. */
export async function autoDetectUmbra(): Promise<UmbraState | null> {
  return asState(await postService<UmbraState>(`${BASE}/auto-detect`, {}));
}

export async function setUmbraBoot(patch: UmbraBootPatch): Promise<UmbraState | null> {
  return asState(await putService<UmbraState>(`${BASE}/boot`, patch));
}
