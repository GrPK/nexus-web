import { useEffect, useState } from 'react';
import { fetchServiceBlob } from '../api/service';
import { effectThumbnailPath } from '../api/lighting';

// Presets are universal, so a thumbnail is identified by (effect, slot) plus a
// version token. Surfaces pass different tokens for the same slot (a tile its
// save time, the preset strip its look's hash), so every fetched version keeps
// its own object URL while any surface shows it or waits for it: revoking a URL
// an <img> still holds breaks that image. A version nothing holds is freed
// unless it is the slot's newest (by request order), kept for the next mount.
interface Entry { url: string; refs: number }
const entries = new Map<string, Entry>();
// Callers whose fetch of a version is in flight or not yet claimed; they hold it like a ref.
const waiting = new Map<string, number>();
const requestSeq = new Map<string, number>();
const newest = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();
let seq = 0;

// Static mode renders the same effect at speed 0, which is a different image
// than the animate tile, so the two must not share a cache entry.
const cacheKey = (effect: string, slot: number, frozen: boolean) =>
  `${effect}:${slot}${frozen ? ':f' : ''}`;
const entryId = (key: string, version: string) => `${key}@${version}`;
const newestId = (key: string) => {
  const v = newest.get(key);
  return v === undefined ? null : entryId(key, v);
};

function dropIfUnused(id: string, key: string) {
  const e = entries.get(id);
  if (!e || e.refs > 0 || (waiting.get(id) ?? 0) > 0 || id === newestId(key)) return;
  URL.revokeObjectURL(e.url);
  entries.delete(id);
  requestSeq.delete(id);
}

function unwait(id: string) {
  const n = (waiting.get(id) ?? 0) - 1;
  if (n > 0) waiting.set(id, n); else waiting.delete(id);
}

/** Fetches a version the caller already waits on; resolves its entry id, or null when the fetch failed. */
function load(effect: string, slot: number, version: string, frozen: boolean): Promise<string | null> {
  const key = cacheKey(effect, slot, frozen);
  const id = entryId(key, version);
  if (entries.has(id)) return Promise.resolve(id);
  let p = pending.get(id);
  if (!p) {
    p = (async () => {
      const blob = await fetchServiceBlob(effectThumbnailPath(effect, slot, version, frozen));
      if (!blob) return null;
      if (!entries.has(id)) entries.set(id, { url: URL.createObjectURL(blob), refs: 0 });
      // A late answer to an older request never displaces a newer one.
      const previous = newestId(key);
      if (!previous || !entries.has(previous) || (requestSeq.get(id) ?? 0) >= (requestSeq.get(previous) ?? 0)) {
        newest.set(key, version);
        if (previous && previous !== id) dropIfUnused(previous, key);
      }
      return id;
    })();
    pending.set(id, p);
    void p.finally(() => pending.delete(id));
  }
  return p;
}

/**
 * Resolve a preset slot's thumbnail blob URL (null while loading or skipped).
 * Pass skip=true to suppress the fetch when thumbnails cannot be generated
 * (e.g. GPU unavailable on the host).
 */
export function useEffectThumbnail(effect: string, slot: number, version: string, skip?: boolean, frozen = false): string | null {
  // Only the slot's newest is read before the effect claims it: a release never frees the newest.
  const [url, setUrl] = useState<string | null>(() => {
    if (skip) return null;
    const key = cacheKey(effect, slot, frozen);
    const id = entryId(key, version);
    return id === newestId(key) ? entries.get(id)?.url ?? null : null;
  });
  useEffect(() => {
    if (skip) {
      setUrl(null);
      return;
    }
    const key = cacheKey(effect, slot, frozen);
    const id = entryId(key, version);
    let cancelled = false;
    let held: string | null = null;
    const take = (target: string | null) => {
      const e = target ? entries.get(target) : undefined;
      if (!e || !target) return;
      e.refs += 1;
      held = target;
      setUrl(e.url);
    };
    if (entries.has(id)) take(id);
    else {
      setUrl(null);
      waiting.set(id, (waiting.get(id) ?? 0) + 1);
      requestSeq.set(id, ++seq);
      void load(effect, slot, version, frozen).then(got => {
        unwait(id);
        if (!entries.has(id) && !waiting.has(id)) requestSeq.delete(id);
        // A failed fetch shows the slot's newest instead, as the last good image.
        if (!cancelled) take(got ?? newestId(key));
        dropIfUnused(id, key);
      });
    }
    return () => {
      cancelled = true;
      if (!held) return;
      const e = entries.get(held);
      if (e) e.refs -= 1;
      dropIfUnused(held, key);
    };
  }, [effect, slot, version, skip, frozen]);
  return url;
}
