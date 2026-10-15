import { fetchService } from '../../../api/service';

// Matches the service-side cache of the same list.
const TTL_MS = 5 * 60 * 1000;

let listed: ReadonlySet<string> | null = null;
let loadedAt = 0;
let inflight: Promise<void> | null = null;

export function setListedAppIds(ids: Iterable<string>): void {
  listed = new Set(ids);
  loadedAt = Date.now();
}

/** The last loaded set, possibly stale; null until a load succeeds. */
export function getListedAppIds(): ReadonlySet<string> | null {
  return listed;
}

/** Loads or refreshes the /shortcuts ids when missing or older than the TTL.
 *  A failed load leaves the previous value, so callers fail closed. */
export function ensureListedAppIds(): Promise<void> {
  if (listed && Date.now() - loadedAt < TTL_MS) return Promise.resolve();
  inflight ??= fetchService<{ shortcuts: { id: string }[] }>('/shortcuts')
    .then(res => { if (res?.shortcuts) setListedAppIds(res.shortcuts.map(s => s.id)); })
    .catch(() => undefined)
    .finally(() => { inflight = null; });
  return inflight;
}

export function resetListedAppIdsForTest(): void {
  listed = null;
  loadedAt = 0;
  inflight = null;
}
