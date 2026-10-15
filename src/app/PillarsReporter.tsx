import { useEffect } from 'react';
import { useFeatureFlags, useUiSettingsHydrated, useUiSettingsSettled, type FeatureFlags } from '../hooks/useUiSettings';

/**
 * Hands the pillar values to Dashboard, which renders the settings provider
 * and cannot read them itself. Reports nothing until the preferences read has
 * an outcome; a failed read reports null (values unknown), so a gate waiting
 * on it is never stuck. `generation` re-reports on every new onboarding read.
 */
export function PillarsReporter({ onPillars, generation }: { onPillars: (flags: FeatureFlags | null) => void; generation: number }) {
  const flags = useFeatureFlags();
  const hydrated = useUiSettingsHydrated();
  const settled = useUiSettingsSettled();
  const { lighting, cooling, monitoring, diagnostics } = flags;
  useEffect(() => {
    if (!settled) return;
    onPillars(hydrated ? { lighting, cooling, monitoring, diagnostics } : null);
  }, [settled, hydrated, lighting, cooling, monitoring, diagnostics, generation, onPillars]);
  return null;
}
