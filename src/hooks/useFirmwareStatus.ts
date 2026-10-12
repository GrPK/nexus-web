import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTopicCallback } from './useMultiplexSocket';
import {
  getFirmwareStatusSnapshot,
  refreshFirmwareStatus,
  retainFirmwareStatus,
  subscribeFirmwareStatus,
} from './firmwareStatusStore';

export interface FlashableImage {
  firmwareType: string;   // catalog key for this image (pass to the flash endpoint)
  version: string;
}

export interface FirmwareStatusItem {
  deviceType: string;       // handler id - identity + icon key
  firmwareType: string;     // catalog key (connected variant) - pass to the flash endpoint
  name: string;
  category: string;
  currentVersion: string;
  availableVersion: string;
  updateAvailable: boolean;
  // True when the available version could not be determined at all (the remote
  // manifest fetch failed). Distinct from updateAvailable=false, which means
  // "checked, nothing newer". Optional because a web-only deploy can run against
  // an older service that does not send it; absent reads as "checked".
  availableUnknown?: boolean;
  availableVersions: string[];  // connected variant's bundled versions
  devImages: FlashableImage[];  // all images the device can flash (incl. sibling variants) - dev picker
  // Optional: an older service omits both; absent reads as a normal row.
  needsRecovery?: boolean;
  recoveryState?: RecoveryState;
}

export type RecoveryState = 'ready' | 'identifying' | 'unsupported' | '';

// Backs the Firmware Updates page. Reports, per connected supported device,
// the version it's running vs the newest version bundled in this build. Seeds
// over REST then refreshes on the `devices` topic (same diff signal that drives
// the device list), so plugging/unplugging a device updates the table.
export function useFirmwareStatus(enabled: boolean) {
  const { items } = useSyncExternalStore(subscribeFirmwareStatus, getFirmwareStatusSnapshot);
  // Flips true once this consumer's first fetch settles, so it can tell "still
  // loading" from "loaded, no matching item" (the Q-series install gate).
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const release = retainFirmwareStatus();
    void refreshFirmwareStatus().then(() => { if (active) setLoaded(true); });
    // The devices topic only fires on bus changes, so a transiently failed
    // fetch (or a server-side shell hiccup that omitted an item) would
    // otherwise render a wrong state until the next hotplug. Slow
    // reconciliation re-poll while a consumer is mounted.
    const intervalId = window.setInterval(() => { void refreshFirmwareStatus(); }, 30_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      release();
    };
  }, [enabled]);

  useTopicCallback('devices', enabled, () => { void refreshFirmwareStatus(); });

  return { items, loaded, refresh: refreshFirmwareStatus };
}
