import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HYTE_NEXUS2_CONFLICT_ID, type DetectedConflict } from '../api/conflicts';
import { fetchLightingDevices, type LightingDevice } from '../api/lighting';
import { deriveConflictDevices } from './useConflictDevices';
import { useDevices, type DeviceListItem } from './useDevices';

const LIGHTING_POLL_MS = 3000;

/** Nexus 2 is ended by the service whatever it shares, and an app the service cannot map to devices has nothing to compare. */
export function alwaysAlerts(conflict: DetectedConflict): boolean {
  return conflict.id === HYTE_NEXUS2_CONFLICT_ID || !conflict.deviceOverlapKnown;
}

/**
 * Whether a running app competes for a device Nexus currently controls: a
 * connected device mapped to the app whose Nexus Control is on. A universal RGB
 * app competes for every lighting card under Nexus Control, curated hubs'
 * cards included. Apps in {@link alwaysAlerts} count as overlapping.
 */
export function conflictsWithControlledDevice(
  conflict: DetectedConflict,
  curated: readonly DeviceListItem[],
  lighting: readonly LightingDevice[],
): boolean {
  if (alwaysAlerts(conflict)) return true;
  if (conflict.claimsAllRgb) return lighting.some(c => c.controlled !== false);
  const groups = deriveConflictDevices([conflict], curated, lighting).get(conflict.id) ?? [];
  return groups.some(g => g.owner !== 'app');
}

/**
 * Live per-app overlap test for the top-bar badge. Mapped apps stay hidden
 * while the first device read is in flight, so a non-overlapping app never
 * flashes the badge, and alert as before if the lighting read fails. Curated
 * devices ride the `devices` topic; lighting cards have no push topic and poll
 * while `enabled`. Both snapshots reset when disabled, so a stale one never
 * decides a later conflict.
 */
export function useConflictOverlap(enabled: boolean): (conflict: DetectedConflict) => boolean {
  const { devices: curated, loaded: curatedLoaded } = useDevices(enabled);
  // undefined: not read yet. null: the read failed.
  const [lighting, setLighting] = useState<LightingDevice[] | null | undefined>(undefined);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refreshLighting = useCallback(async () => {
    const res = await fetchLightingDevices().catch(() => null);
    if (mountedRef.current) setLighting(res ? res.devices : null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLighting(undefined);
      return;
    }
    void refreshLighting();
    const timer = window.setInterval(() => { void refreshLighting(); }, LIGHTING_POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, refreshLighting]);

  return useMemo(
    () => (conflict: DetectedConflict) => {
      if (alwaysAlerts(conflict) || lighting === null) return true;
      if (lighting === undefined || !curatedLoaded) return false;
      return conflictsWithControlledDevice(conflict, curated, lighting);
    },
    [curatedLoaded, curated, lighting],
  );
}
