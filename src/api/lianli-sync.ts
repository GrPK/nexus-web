import { fetchService, putService } from './service';

/**
 * One effect across every Lian Li light (L-Connect's Merge), shown as the Sync all
 * bar on the Lian Li page: GET/PUT /devices/lianli/sync.
 */

/** One effect the synced lights can play together, with its own saved look. */
export interface LianLiSyncEffect {
  key: string;
  hasSpeed: boolean;
  hasDirection: boolean;
  /** The effect takes exactly this many colours. */
  colorsMax: number;
  /** 0 slowest .. maxLevel fastest, L-Connect's default for the effect. */
  defaultSpeed: number;
  defaultColors: string[];
  /** The effect's saved look. */
  speed: number;
  brightness: number;
  direction: number;
  colors: string[];
}

/** A light the sync drives while it is on. */
export interface LianLiSyncDevice {
  kind: string;
  id: string;
  name: string;
  /** TL chains only. */
  fanCount?: number;
  mode?: string;
}

export interface LianLiSyncAll {
  enabled: boolean;
  /** Key of the effect the synced lights play. */
  effect: string;
  /** Top of the speed and brightness levels. */
  maxLevel: number;
  /** In display order; the service adds L-Connect's merge effects to this list. */
  effects: LianLiSyncEffect[];
  devices: LianLiSyncDevice[];
}

/**
 * The look fields land on `effect` when it is sent, otherwise on the current effect.
 * `colors` must hold exactly that effect's colorsMax entries, as #RRGGBB.
 */
export interface LianLiSyncAllPatch {
  enabled?: boolean;
  effect?: string;
  speed?: number;
  brightness?: number;
  direction?: number;
  colors?: string[];
}

export interface LianLiSyncAllApi {
  /** Null when the service has no sync route or does not answer (the bar is then hidden). */
  get: () => Promise<LianLiSyncAll | null>;
  set: (patch: LianLiSyncAllPatch) => Promise<boolean>;
}

const SYNC = '/devices/lianli/sync';

interface OkResponse {
  error?: boolean;
  msg?: string;
}

export function getLianLiSyncAll(): Promise<LianLiSyncAll | null> {
  return fetchService<LianLiSyncAll>(SYNC);
}

/** False when the service refuses the patch ("unknown effect", "<effect> takes N colors", "invalid color") or does not answer. */
export async function setLianLiSyncAll(patch: LianLiSyncAllPatch): Promise<boolean> {
  const res = await putService<OkResponse>(SYNC, patch);
  return !!res && res.error !== true;
}

export const LIANLI_SYNC_ALL_API: LianLiSyncAllApi = {
  get: () => getLianLiSyncAll(),
  set: patch => setLianLiSyncAll(patch),
};
