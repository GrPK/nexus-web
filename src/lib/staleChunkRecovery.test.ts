import { describe, expect, it, vi } from 'vitest';
import {
  isStaleChunkMessage,
  recoverFromStaleChunk,
  STALE_CHUNK_RELOAD_LOCK_MS,
  type RecoverDeps,
} from './staleChunkRecovery';

function makeDeps(over: Partial<RecoverDeps> & { stamp?: number } = {}) {
  const { stamp = 0, ...rest } = over;
  const deps = {
    now: 1_000_000,
    check: vi.fn(async () => 'reload' as const),
    readStamp: () => stamp,
    writeStamp: vi.fn(() => true),
    reload: vi.fn(),
    ...rest,
  };
  return deps as typeof deps & RecoverDeps;
}

describe('isStaleChunkMessage', () => {
  it('matches the dynamic import and CSS preload failures', () => {
    expect(isStaleChunkMessage('Failed to fetch dynamically imported module: http://localhost:9400/assets/DevicesPage-Bc.js')).toBe(true);
    expect(isStaleChunkMessage('Unable to preload CSS for /assets/MonitoringPage-Dy.css')).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isStaleChunkMessage('Cannot read properties of undefined')).toBe(false);
  });
});

describe('recoverFromStaleChunk', () => {
  it('reloads and stamps when the watcher check confirms a new build', async () => {
    const deps = makeDeps();
    expect(await recoverFromStaleChunk(deps)).toBe(true);
    expect(deps.writeStamp).toHaveBeenCalledWith(1_000_000);
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });

  it.each(['noop', 'same', 'locked', 'unverified'] as const)('does not reload when the watcher check says %s', async (result) => {
    const deps = makeDeps({ check: vi.fn(async () => result) });
    expect(await recoverFromStaleChunk(deps)).toBe(false);
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('does not reload when the watcher check throws', async () => {
    const deps = makeDeps({ check: vi.fn(async () => { throw new Error('offline'); }) });
    expect(await recoverFromStaleChunk(deps)).toBe(false);
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('does not reload when the loop-guard stamp cannot be stored', async () => {
    const deps = makeDeps({ writeStamp: vi.fn(() => false) });
    expect(await recoverFromStaleChunk(deps)).toBe(false);
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('does not check or reload again inside the lock window', async () => {
    const deps = makeDeps({ stamp: 1_000_000 - (STALE_CHUNK_RELOAD_LOCK_MS - 1) });
    expect(await recoverFromStaleChunk(deps)).toBe(false);
    expect(deps.check).not.toHaveBeenCalled();
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('reloads again once the window has passed', async () => {
    const deps = makeDeps({ stamp: 1_000_000 - STALE_CHUNK_RELOAD_LOCK_MS });
    expect(await recoverFromStaleChunk(deps)).toBe(true);
  });
});
