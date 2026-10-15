import { useEffect } from 'react';
import { useFeatureFlags, useUiSettingsHydrated } from '../hooks/useUiSettings';

/**
 * Reports Lighting already off when the features step is not shown, so the
 * lighting device-selection step is skipped. It lives apart because Dashboard
 * renders the settings provider and cannot read the flags itself. It only ever
 * reports off: the features step's own Continue is what turns the skip on or
 * off when it runs.
 */
export function LightingFeatureSeed({ active, onLightingOff }: { active: boolean; onLightingOff: () => void }) {
  const { lighting } = useFeatureFlags();
  const hydrated = useUiSettingsHydrated();
  useEffect(() => {
    if (active && hydrated && !lighting) onLightingOff();
  }, [active, hydrated, lighting, onLightingOff]);
  return null;
}
