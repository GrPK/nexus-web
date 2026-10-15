import { useCallback, useRef, useState, type RefObject } from 'react';
import type { FeatureFlags } from '../hooks/useUiSettings';

/**
 * The pillar values the onboarding gates decide on, decided once per page
 * load: the first outcome is taken, then later reports count only while the
 * welcome or features step is open (the user is still choosing). After that
 * the values are frozen, so a switch flipped in Settings or a reconnect never
 * opens a gate. `hydrated` says whether the decided values came from a
 * successful server read (a failed read reports the local cache).
 *
 * One exception: values that were only the cache are replaced by the first
 * server-read values, as long as no gate has opened yet (`gateOpened`).
 *
 * `ready` is sticky for the page load: once values exist, or the service was
 * seen down for good, the app never goes back to waiting.
 */
export function usePillarsLatch(earlyGateOpen: boolean, serviceDown: boolean, gateOpened: RefObject<boolean>) {
  const [state, setState] = useState<{ flags: FeatureFlags; hydrated: boolean } | null>(null);
  const decided = useRef(false);
  const decidedHydrated = useRef(false);
  const early = useRef(earlyGateOpen);
  early.current = earlyGateOpen;
  const ready = useRef(false);
  if (state !== null || serviceDown) ready.current = true;

  const report = useCallback((flags: FeatureFlags, hydrated: boolean) => {
    if (decided.current && !early.current) {
      const correcting = hydrated && !decidedHydrated.current && !gateOpened.current;
      if (!correcting) return;
    }
    decided.current = true;
    decidedHydrated.current = hydrated;
    setState({ flags, hydrated });
  }, [gateOpened]);

  return { pillars: state?.flags ?? null, hydrated: state?.hydrated ?? false, ready: ready.current, report };
}
