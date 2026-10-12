import { hasOneShotToken } from './buildReloadWatcher';

// A service update swaps the hashed assets under an already-open page, so the
// next lazy import or stylesheet preload of a removed chunk fails. Reloading
// picks up the new entry. One reload per window bounds a persistent failure
// (a truly missing chunk) to a single extra load instead of a loop.
const STAMP_KEY = 'nexus_stale_chunk_reload_at';
export const STALE_CHUNK_RELOAD_LOCK_MS = 60_000;

const STALE_CHUNK_RE = /Failed to fetch dynamically imported module|Unable to preload CSS|error loading dynamically imported module|Importing a module script failed/i;

export function isStaleChunkMessage(message: string): boolean {
  return STALE_CHUNK_RE.test(message);
}

export interface RecoverDeps {
  now: number;
  oneShotToken: boolean;
  readStamp: () => number;
  writeStamp: (at: number) => void;
  reload: () => void;
}

// True when a reload was triggered, so the caller can swallow the error; false
// when the guard blocked it and the error should surface as a real failure.
export function recoverFromStaleChunk(deps: RecoverDeps): boolean {
  if (deps.oneShotToken) return false;
  const last = deps.readStamp();
  if (last > 0 && deps.now >= last && deps.now - last < STALE_CHUNK_RELOAD_LOCK_MS) return false;
  deps.writeStamp(deps.now);
  deps.reload();
  return true;
}

export function liveRecoverDeps(): RecoverDeps {
  return {
    now: Date.now(),
    oneShotToken: hasOneShotToken(window.location.search),
    readStamp: () => {
      try { return Number(sessionStorage.getItem(STAMP_KEY) ?? 0) || 0; } catch { return 0; }
    },
    writeStamp: (at) => {
      try { sessionStorage.setItem(STAMP_KEY, String(at)); } catch { /* storage blocked: the reload still happens, only the loop guard is lost */ }
    },
    reload: () => window.location.reload(),
  };
}

export function recoverFromStaleChunkNow(): boolean {
  return recoverFromStaleChunk(liveRecoverDeps());
}

// Vite fires this when its preload helper fails (a CSS or JS dependency of a
// dynamic import). Calling preventDefault stops it rethrowing as a rejection.
export function installStaleChunkRecovery(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('vite:preloadError', (event) => {
    if (recoverFromStaleChunkNow()) event.preventDefault();
  });
}
