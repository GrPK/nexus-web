import { fetchService } from '../api/service';
import type { FirmwareStatusItem } from './useFirmwareStatus';

// The panel app ships to the Q-series display but belongs to the Q-series device row.
const OWNER_DEVICE: Record<string, string> = { 'qseries-app': 'qseries' };

// The status route shells into the Q-series panel over adb, so background
// refreshes are coalesced rather than each one refetching.
const MIN_BACKGROUND_REFETCH_MS = 60_000;

export interface FirmwareStatusSnapshot {
  items: FirmwareStatusItem[];
  /** Device ids (a unified device's `curatedId`) with an installable update. */
  updateIds: ReadonlySet<string>;
}

let snapshot: FirmwareStatusSnapshot = { items: [], updateIds: new Set() };
const listeners = new Set<() => void>();
let requestSeq = 0;
let answeredSeq = 0;
let lastRequestAt = 0;
let trailingTimer: ReturnType<typeof setTimeout> | undefined;
let consumers = 0;

/**
 * A not-yet-installed panel app is the device page's install gate, not an
 * update, and a device stuck in DFU is a recovery.
 */
export function firmwareUpdateIds(items: readonly FirmwareStatusItem[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.updateAvailable || !item.currentVersion || item.needsRecovery) continue;
    ids.add(OWNER_DEVICE[item.deviceType] ?? item.deviceType);
  }
  return ids;
}

export function subscribeFirmwareStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getFirmwareStatusSnapshot(): FirmwareStatusSnapshot {
  return snapshot;
}

/** Fetches now. Resolves once this request is answered, published or not. */
export async function refreshFirmwareStatus(): Promise<void> {
  clearTrailing();
  const seq = ++requestSeq;
  lastRequestAt = Date.now();
  const items = await fetchService<FirmwareStatusItem[]>('/devices/firmware/status');
  // An older request answered late (one that read the panel mid-install) must
  // not overwrite a newer answer, even a failed one.
  if (seq < answeredSeq) return;
  answeredSeq = seq;
  if (!items) return;
  const next = firmwareUpdateIds(items);
  const sameIds = next.size === snapshot.updateIds.size && [...next].every(id => snapshot.updateIds.has(id));
  snapshot = { items, updateIds: sameIds ? snapshot.updateIds : next };
  listeners.forEach(notify => notify());
}

/** At most one request per window; anything inside it is deferred to one trailing request. */
export function requestFirmwareStatus(): void {
  const wait = lastRequestAt + MIN_BACKGROUND_REFETCH_MS - Date.now();
  if (wait <= 0) {
    void refreshFirmwareStatus();
    return;
  }
  trailingTimer ??= setTimeout(() => {
    trailingTimer = undefined;
    void refreshFirmwareStatus();
  }, wait);
}

/** Held by each enabled consumer; the last release drops a pending trailing request. */
export function retainFirmwareStatus(): () => void {
  consumers += 1;
  return () => {
    consumers -= 1;
    if (consumers === 0) clearTrailing();
  };
}

function clearTrailing(): void {
  if (trailingTimer === undefined) return;
  clearTimeout(trailingTimer);
  trailingTimer = undefined;
}
