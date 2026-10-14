import { fetchService } from '../../../api/service';

let listed: ReadonlySet<string> | null = null;
let inflight: Promise<void> | null = null;

export function setListedAppIds(ids: Iterable<string>): void {
  listed = new Set(ids);
}

export function getListedAppIds(): ReadonlySet<string> | null {
  return listed;
}

/** Loads the /shortcuts ids once; a failed load leaves the cache null so
 *  callers fail closed. */
export function ensureListedAppIds(): Promise<void> {
  if (listed) return Promise.resolve();
  inflight ??= fetchService<{ shortcuts: { id: string }[] }>('/shortcuts')
    .then(res => { if (res?.shortcuts) setListedAppIds(res.shortcuts.map(s => s.id)); })
    .catch(() => undefined)
    .finally(() => { inflight = null; });
  return inflight;
}

export function resetListedAppIdsForTest(): void {
  listed = null;
  inflight = null;
}
