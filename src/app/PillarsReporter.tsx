import { useEffect } from 'react';
import { useFeatureFlags, useUiSettingsHydrated, useUiSettingsSettled, type FeatureFlags } from '../hooks/useUiSettings';

/**
 * Hands the pillar values to Dashboard, which renders the settings provider
 * and cannot read them itself. Reports once the preferences read has an
 * outcome; after a failed read the values are the local cache.
 */
export function PillarsReporter({ onPillars }: { onPillars: (flags: FeatureFlags, hydrated: boolean) => void }) {
  const { lighting, cooling, monitoring, diagnostics } = useFeatureFlags();
  const settled = useUiSettingsSettled();
  const hydrated = useUiSettingsHydrated();
  useEffect(() => {
    if (settled) onPillars({ lighting, cooling, monitoring, diagnostics }, hydrated);
  }, [settled, hydrated, lighting, cooling, monitoring, diagnostics, onPillars]);
  return null;
}
