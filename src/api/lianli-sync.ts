import { fetchService, putService } from './service';

/**
 * One effect across every Lian Li light (L-Connect's Merge), shown as the Sync all
 * bar on the Lian Li page: GET/PUT /devices/lianli/sync.
 */

/** One effect the synced lights can play together, with its own saved look. */
export interface LianLiSyncEffect {
  key: string;
  /**
   * One of L-Connect's merged ("wireless", "(W*)" there) Quick Sync effects: drawn once across every
   * device in `devices` order. False or absent for the ones each device plays on its own.
   */
  merge?: boolean;
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

/**
 * A light the sync drives while it is on, in the merge order: a merged effect is drawn across them in this order.
 * A TL chain or Strimer on its motherboard ARGB input is left out while it is (it keeps its stored place).
 */
export interface LianLiSyncDevice {
  /** "tlChain", "strimer", "hydroShift2Curve" or "universalScreen88". */
  kind: string;
  /** The MAC for a TL chain or a Strimer; the kind for the single USB devices. */
  id: string;
  /** A Strimer's is its cable model ("Strimer MB 24-Pin"). */
  name: string;
  /** TL chains only. */
  fanCount?: number;
  mode?: string;
  /** Its stretch of a merged effect's line: 13 per TL fan, a Strimer's LEDs per lane, 14 for the OLED Curved, 31 for the 8.8 bezel. */
  dots?: number;
  /** The direction it reads its stretch of a merged effect in: 0 as drawn, 1 reversed. */
  direction?: number;
}

/**
 * What keeps a Sync all member from following it: the Lighting page drives it, or (a TL chain) it plays its
 * motherboard ARGB input. Sync all cannot be turned on while a member has one.
 */
export type LianLiSyncLock = 'lightingPage' | 'motherboardArgb';

/** The Sync all member ids of the single USB devices (a TL chain's is its MAC). */
export const LIANLI_SYNC_CURVE_ID = 'hydroShift2Curve';
export const LIANLI_SYNC_SCREEN88_ID = 'universalScreen88';

/** Member ids compare without case (a MAC's case differs between routes). */
export const lianLiSyncKey = (id: string): string => id.toUpperCase();

/** One device of a new merge order; a direction left out keeps the stored one. */
export interface LianLiSyncDeviceOrder {
  id: string;
  direction?: number;
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
  /** A new merge order: these devices first, in this order, then the others in their stored order. */
  devices?: LianLiSyncDeviceOrder[];
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

/**
 * False when the service refuses the patch ("unknown effect", "<effect> takes N colors", "invalid color",
 * "each device once", "unknown device <id>") or does not answer.
 */
export async function setLianLiSyncAll(patch: LianLiSyncAllPatch): Promise<boolean> {
  const res = await putService<OkResponse>(SYNC, patch);
  return !!res && res.error !== true;
}

export const LIANLI_SYNC_ALL_API: LianLiSyncAllApi = {
  get: () => getLianLiSyncAll(),
  set: patch => setLianLiSyncAll(patch),
};
