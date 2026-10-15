import { useCallback, useRef, useState } from 'react';
import type { FeatureFlags } from '../hooks/useUiSettings';

/**
 * The pillar values the onboarding gates decide on, decided once per page
 * load: the first outcome is taken, then later reports count only while the
 * welcome or features step is open (the user is still choosing). After that
 * the values are frozen, so a switch flipped in Settings or a reconnect never
 * opens a gate.
 */
export function usePillarsLatch(earlyGateOpen: boolean) {
  const [pillars, setPillars] = useState<FeatureFlags | null>(null);
  const decided = useRef(false);
  const early = useRef(earlyGateOpen);
  early.current = earlyGateOpen;

  const report = useCallback((flags: FeatureFlags) => {
    if (decided.current && !early.current) return;
    decided.current = true;
    setPillars(flags);
  }, []);

  return { pillars, report };
}
