import { useCallback, useRef, useState } from 'react';
import type { FeatureFlags } from '../hooks/useUiSettings';

/** null: the preferences read has no outcome yet. flags null inside: it failed, so the values are unknown. */
export type PillarsState = { flags: FeatureFlags | null } | null;

/**
 * The pillar values the onboarding gates decide on. They follow the user's
 * choice while the welcome and features steps are open, then freeze for the
 * rest of the sequence: a switch flipped later in Settings must never open a
 * gate. A new onboarding read (generation) starts a fresh decision.
 */
export function usePillarsLatch(generation: number, earlyGateOpen: boolean) {
  const [pillars, setPillars] = useState<PillarsState>(null);
  const latchedGeneration = useRef<number | null>(null);
  const live = useRef({ generation, earlyGateOpen });
  live.current = { generation, earlyGateOpen };

  const report = useCallback((flags: FeatureFlags | null) => {
    const { generation: g, earlyGateOpen: early } = live.current;
    // Before the first onboarding read the sequence has not started.
    if (g === 0) return;
    if (latchedGeneration.current === g && !early) return;
    latchedGeneration.current = g;
    setPillars({ flags });
  }, []);

  return { pillars, report };
}
