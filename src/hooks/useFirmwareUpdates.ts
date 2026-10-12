import { useEffect, useSyncExternalStore } from 'react';
import { useTopicCallback } from './useMultiplexSocket';
import {
  getFirmwareStatusSnapshot,
  requestFirmwareStatus,
  retainFirmwareStatus,
  subscribeFirmwareStatus,
} from './firmwareStatusStore';

const POLL_MS = 5 * 60_000;
const EMPTY: ReadonlySet<string> = new Set();
// The set keeps its identity while unchanged, so a refresh re-renders no row.
const getUpdateIds = () => getFirmwareStatusSnapshot().updateIds;

/** Device ids with an installable update, for the update glyph on device rows. */
export function useFirmwareUpdates(enabled: boolean): ReadonlySet<string> {
  const updateIds = useSyncExternalStore(subscribeFirmwareStatus, getUpdateIds);

  useEffect(() => {
    if (!enabled) return;
    const release = retainFirmwareStatus();
    requestFirmwareStatus();
    const intervalId = window.setInterval(requestFirmwareStatus, POLL_MS);
    return () => {
      window.clearInterval(intervalId);
      release();
    };
  }, [enabled]);

  useTopicCallback('devices', enabled, requestFirmwareStatus);

  return enabled ? updateIds : EMPTY;
}
