import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { fetchPanelDevice, patchPanelDevice } from '../api/panel';
import { usePanelDeviceId } from '../panel/widgets/common/PanelDeviceIdContext';
import { usePersistentIdSet } from './usePersistentState';

/** The panel record fields that hold a remembered selection. */
export type PanelSelectionField = 'lightingSelection' | 'coolingSelection';

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every(id => b.has(id));

/**
 * usePersistentIdSet that, inside a real panel, is keyed by the panel's device id and mirrored to
 * that panel's service record. The record wins once fetched, unless the user changed the selection
 * first. `validIds` (once non-empty) drops remembered ids that are gone, after the record landed.
 */
export function usePanelIdSet(
  desktopKey: string,
  field: PanelSelectionField,
  validIds?: ReadonlySet<string> | null,
): [Set<string>, Dispatch<SetStateAction<Set<string>>>] {
  const panelId = usePanelDeviceId();
  const [value, setLocal] = usePersistentIdSet(panelId ? `${desktopKey}.${panelId}` : desktopKey);
  const latest = useRef(value);
  latest.current = value;
  const touched = useRef(false);
  const [hydrated, setHydrated] = useState(!panelId);
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  const write = useCallback((next: Set<string>) => {
    if (!panelId) return;
    writes.current = writes.current
      .then(() => patchPanelDevice(panelId, { [field]: [...next] }))
      .catch(() => {});
  }, [panelId, field]);

  useEffect(() => {
    if (!panelId) return;
    let live = true;
    void fetchPanelDevice(panelId).then(record => {
      const remote = record?.[field];
      if (!live || touched.current || !Array.isArray(remote)) return;
      const next = new Set(remote);
      if (sameSet(next, latest.current)) return;
      latest.current = next;
      setLocal(next);
    }).catch(() => { /* the local copy stands */ }).finally(() => { if (live) setHydrated(true); });
    return () => { live = false; };
  }, [panelId, field, setLocal]);

  useEffect(() => {
    if (!hydrated || !validIds || validIds.size === 0) return;
    const kept = new Set([...latest.current].filter(id => validIds.has(id)));
    if (sameSet(kept, latest.current)) return;
    latest.current = kept;
    setLocal(kept);
    write(kept);
  }, [hydrated, validIds, setLocal, write]);

  const setValue = useCallback<Dispatch<SetStateAction<Set<string>>>>(next => {
    const resolved = typeof next === 'function' ? next(latest.current) : next;
    if (sameSet(resolved, latest.current)) return;
    touched.current = true;
    latest.current = resolved;
    setLocal(resolved);
    write(resolved);
  }, [setLocal, write]);

  return [value, setValue];
}
