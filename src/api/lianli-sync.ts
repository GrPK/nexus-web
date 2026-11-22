import type { LianLiWirelessLightingEffect } from './lianli-wireless';

/**
 * One effect across every Lian Li light (L-Connect's Merge), shown as the Sync all
 * bar on the Lian Li page.
 *
 * TODO(lianli-sync): the service route is being written (L-Connect's Merge is still
 * being worked out). Until it lands, LIANLI_SYNC_ALL_API answers null and the bar
 * stays hidden. Once the route and its shape are known, point `get`/`set` at it and
 * adjust these types; the bar and its tests only depend on this interface.
 */
export interface LianLiSyncAll {
  enabled: boolean;
  mode: string;
  /** 0 slowest .. 4 fastest */
  speed: number;
  direction: number;
  /** 0 off .. 4 full */
  brightness: number;
  colors: string[];
  /** Effects every member can play together, in display order. */
  modes: LianLiWirelessLightingEffect[];
}

export type LianLiSyncAllPatch = Partial<Omit<LianLiSyncAll, 'modes'>>;

export interface LianLiSyncAllApi {
  /** Null when the service has no sync route (the bar is then hidden). */
  get: () => Promise<LianLiSyncAll | null>;
  set: (patch: LianLiSyncAllPatch) => Promise<boolean>;
}

/** No service route yet: the bar reads null and never writes. */
export const LIANLI_SYNC_ALL_API: LianLiSyncAllApi = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve(false),
};
