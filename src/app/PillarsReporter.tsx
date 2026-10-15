import { useEffect } from 'react';
import { useFeatureFlags, useUiSettingsHydrated, type FeatureFlags } from '../hooks/useUiSettings';

/**
 * Hands the hydrated pillar values to Dashboard, which renders the settings
 * provider and cannot read them itself. Reports nothing until preferences are
 * read, so a gate that depends on them never flashes on the local cache.
 */
export function PillarsReporter({ onPillars }: { onPillars: (flags: FeatureFlags) => void }) {
  const flags = useFeatureFlags();
  const hydrated = useUiSettingsHydrated();
  const { lighting, cooling, monitoring, diagnostics } = flags;
  useEffect(() => {
    if (hydrated) onPillars({ lighting, cooling, monitoring, diagnostics });
  }, [hydrated, lighting, cooling, monitoring, diagnostics, onPillars]);
  return null;
}
