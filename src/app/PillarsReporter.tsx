import { useEffect } from 'react';
import { useFeatureFlags, useUiSettingsSettled, type FeatureFlags } from '../hooks/useUiSettings';

/**
 * Hands the pillar values to Dashboard, which renders the settings provider
 * and cannot read them itself. Reports once the preferences read has an
 * outcome; after a failed read the values are the local cache.
 */
export function PillarsReporter({ onPillars }: { onPillars: (flags: FeatureFlags) => void }) {
  const { lighting, cooling, monitoring, diagnostics } = useFeatureFlags();
  const settled = useUiSettingsSettled();
  useEffect(() => {
    if (settled) onPillars({ lighting, cooling, monitoring, diagnostics });
  }, [settled, lighting, cooling, monitoring, diagnostics, onPillars]);
  return null;
}
