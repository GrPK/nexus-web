import { describe, expect, it, vi } from 'vitest';
import {
  isStaleChunkMessage,
  recoverFromStaleChunk,
  STALE_CHUNK_RELOAD_LOCK_MS,
  type RecoverDeps,
} from './staleChunkRecovery';

function makeDeps(over: Partial<RecoverDeps> & { stamp?: number } = {}): RecoverDeps & { writeStamp: ReturnType<typeof vi.fn>; reload: ReturnType<typeof vi.fn> } {
  const { stamp = 0, ...rest } = over;
  return {
    now: 1_000_000,
    oneShotToken: false,
    readStamp: () => stamp,
    writeStamp: vi.fn(),
    reload: vi.fn(),
    ...rest,
  } as RecoverDeps & { writeStamp: ReturnType<typeof vi.fn>; reload: ReturnType<typeof vi.fn> };
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
  it('reloads and stamps on the first failure', () => {
    const deps = makeDeps();
    expect(recoverFromStaleChunk(deps)).toBe(true);
    expect(deps.writeStamp).toHaveBeenCalledWith(1_000_000);
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload again inside the lock window', () => {
    const deps = makeDeps({ stamp: 1_000_000 - (STALE_CHUNK_RELOAD_LOCK_MS - 1) });
    expect(recoverFromStaleChunk(deps)).toBe(false);
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('reloads again once the window has passed', () => {
    const deps = makeDeps({ stamp: 1_000_000 - STALE_CHUNK_RELOAD_LOCK_MS });
    expect(recoverFromStaleChunk(deps)).toBe(true);
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });

  it('never reloads while a one-shot URL token is present', () => {
    const deps = makeDeps({ oneShotToken: true });
    expect(recoverFromStaleChunk(deps)).toBe(false);
    expect(deps.reload).not.toHaveBeenCalled();
  });
});
