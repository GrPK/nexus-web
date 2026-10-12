import { useCallback, useRef, useState } from 'react';
import { fetchPins, setPins, type Pin } from '../../../../api/lighting';
import { withPins, type Pins } from '../pins';

/**
 * The service's pins plus the optimistic edits made here. A pin write flips the
 * cards at once and puts the old pins back if the service refuses it. Ids with
 * a write in flight keep their local value through a refetch, so a lighting
 * frame that predates the write cannot flip a card back and forth.
 */
export function usePins(): {
  pins: Pins;
  pinsRef: { readonly current: Pins };
  refresh: () => Promise<void>;
  /** Pins `ids` to `pin`, or unpins them for null. `record` false leaves the local copy to the caller. */
  applyPins: (ids: readonly string[], pin: Pin | null, record?: boolean) => Promise<boolean>;
  /** Records locally without telling the service (a drag preview whose write is queued elsewhere). */
  recordPins: (ids: readonly string[], pin: Pin | null) => void;
} {
  const [pins, setLocal] = useState<Pins>({});
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const pendingRef = useRef(new Map<string, number>());

  const refresh = useCallback(async () => {
    const fetched = await fetchPins();
    if (!fetched) return;
    setLocal(prev => {
      const next: Record<string, Pin> = { ...fetched };
      for (const id of pendingRef.current.keys()) {
        if (id in prev) next[id] = prev[id]; else delete next[id];
      }
      const keys = Object.keys(next);
      // Same pins: hand back the old object so a lighting frame during a slider
      // drag does not re-render the page.
      return keys.length === Object.keys(prev).length && keys.every(k => JSON.stringify(prev[k]) === JSON.stringify(next[k]))
        ? prev
        : next;
    });
  }, []);

  const recordPins = useCallback((ids: readonly string[], pin: Pin | null) => {
    setLocal(prev => withPins(prev, ids, pin));
  }, []);

  const applyPins = useCallback(async (ids: readonly string[], pin: Pin | null, record = true): Promise<boolean> => {
    if (ids.length === 0) return true;
    const before = ids.map(id => [id, pinsRef.current[id] ?? null] as const);
    if (record) setLocal(prev => withPins(prev, ids, pin));
    for (const id of ids) pendingRef.current.set(id, (pendingRef.current.get(id) ?? 0) + 1);
    let ok = false;
    try {
      ok = await setPins([...ids], pin);
    } catch {
      ok = false;
    }
    for (const id of ids) {
      const left = (pendingRef.current.get(id) ?? 1) - 1;
      if (left > 0) pendingRef.current.set(id, left); else pendingRef.current.delete(id);
    }
    if (!ok && record) {
      setLocal(prev => {
        let next = prev;
        for (const [id, was] of before) next = withPins(next, [id], was);
        return next;
      });
    }
    return ok;
  }, []);

  return { pins, pinsRef, refresh, applyPins, recordPins };
}
