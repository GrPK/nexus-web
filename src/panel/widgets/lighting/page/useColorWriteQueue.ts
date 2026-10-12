import { useCallback, useRef } from 'react';
import type { Pin } from '../../../../api/lighting';

/**
 * Paces the pin writes a pointer drag produces: one request in flight, newest
 * wins. Paced by the write landing rather than a timer, so a slow write drops
 * the frames it outran instead of queueing them behind the pointer. The queued
 * entry carries its own target ids - the selection can change before the chain
 * drains.
 */
export function useColorWriteQueue(
  write: (ids: string[], pin: Pin) => Promise<unknown>,
): (pin: Pin, ids: string[]) => void {
  const state = useRef<{ inFlight: boolean; queued: { pin: Pin; ids: string[] } | null }>(
    { inFlight: false, queued: null },
  );
  const writeRef = useRef(write);
  writeRef.current = write;
  // Ref-held so the .finally re-entry keeps one stable identity.
  const pumpRef = useRef<() => void>(() => {});
  const pump = useCallback(() => {
    const w = state.current;
    if (w.inFlight || !w.queued) return;
    const { pin, ids } = w.queued;
    w.queued = null;
    w.inFlight = true;
    writeRef.current(ids, pin).finally(() => {
      w.inFlight = false;
      pumpRef.current();
    });
  }, []);
  pumpRef.current = pump;

  return useCallback((pin: Pin, ids: string[]) => {
    state.current.queued = { pin, ids };
    pump();
  }, [pump]);
}
