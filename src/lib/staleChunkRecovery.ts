import { checkOnce, liveDeps, loadedEntry, type CheckResult } from './buildReloadWatcher';

// A service update swaps the hashed assets under an already-open page, so the
// next lazy import or stylesheet preload of a removed chunk fails. Reloading
// picks up the new entry, but only once the build watcher's check confirms a
// different entry is served and every asset it references is fetchable: a
// stopped service or a deploy caught mid-copy must not turn into a blind
// reload. At most one reload happens per window, and none when the loop-guard
// stamp cannot be stored.
const STAMP_KEY = 'nexus_stale_chunk_reload_at';
export const STALE_CHUNK_RELOAD_LOCK_MS = 60_000;
// A stalled service or tunnel never settles the check's fetches; give up so the
// caller reports the error instead of dropping it.
export const STALE_CHUNK_CHECK_TIMEOUT_MS = 10_000;

const STALE_CHUNK_RE = /Failed to fetch dynamically imported module|Unable to preload CSS|error loading dynamically imported module|Importing a module script failed/i;

export function isStaleChunkMessage(message: string): boolean {
  return STALE_CHUNK_RE.test(message);
}

export interface RecoverDeps {
  now: number;
  // The build watcher's pass without its own reload: resolves 'reload' only
  // when a new build is served and all its assets are present.
  check: () => Promise<CheckResult>;
  readStamp: () => number;
  // False when the stamp could not be stored.
  writeStamp: (at: number) => boolean;
  reload: () => void;
}

// True when a reload was triggered, so the caller can swallow the error; false
// when it was not and the error should surface as a real failure.
export async function recoverFromStaleChunk(deps: RecoverDeps): Promise<boolean> {
  const last = deps.readStamp();
  if (last > 0 && deps.now >= last && deps.now - last < STALE_CHUNK_RELOAD_LOCK_MS) return false;
  let result: CheckResult;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    result = await Promise.race([
      deps.check(),
      new Promise<CheckResult>((resolve) => { timer = setTimeout(() => resolve('noop'), STALE_CHUNK_CHECK_TIMEOUT_MS); }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
  if (result !== 'reload') return false;
  if (!deps.writeStamp(deps.now)) return false;
  deps.reload();
  return true;
}

export function liveRecoverDeps(): RecoverDeps {
  const loaded = loadedEntry();
  return {
    now: Date.now(),
    check: () => (loaded ? checkOnce({ ...liveDeps(loaded), reload: () => {} }) : Promise.resolve('noop')),
    readStamp: () => {
      try { return Number(sessionStorage.getItem(STAMP_KEY) ?? 0) || 0; } catch { return 0; }
    },
    writeStamp: (at) => {
      try { sessionStorage.setItem(STAMP_KEY, String(at)); return true; } catch { return false; }
    },
    reload: () => window.location.reload(),
  };
}

// One recovery at a time: a burst of chunk errors (several lazy pages, the
// dashboard prefetches) shares a single index.html fetch and asset sweep.
let inFlight: Promise<boolean> | null = null;

export function recoverFromStaleChunkNow(): Promise<boolean> {
  if (!inFlight) {
    inFlight = recoverFromStaleChunk(liveRecoverDeps()).finally(() => { inFlight = null; });
  }
  return inFlight;
}
