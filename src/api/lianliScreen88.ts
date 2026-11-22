import { fetchService, putService } from './service';
import type { HydroShift2Lighting, HydroShift2LightingApi, HydroShift2LightingPatch } from './hydroshift2';

const LIGHTING = '/devices/lianli-screen88/lighting';

/**
 * The Universal Screen 8.8's bezel LEDs, driven by the service itself: follow the
 * Lighting page ('canvas'), or play one of L-Connect's bezel effects. Same shape as
 * the HydroShift II lights, so the same card shows it.
 */
export function getLianLiScreen88Lighting(): Promise<HydroShift2Lighting | null> {
  return fetchService<HydroShift2Lighting>(LIGHTING);
}

export function setLianLiScreen88Lighting(patch: HydroShift2LightingPatch): Promise<unknown | null> {
  return putService(LIGHTING, patch);
}

export const LIANLI_SCREEN88_LIGHTING_API: HydroShift2LightingApi = {
  get: () => getLianLiScreen88Lighting(),
  set: patch => setLianLiScreen88Lighting(patch),
};
