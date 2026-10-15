import { useEffect, useRef } from 'react';
import { completeLightingOnboarding } from '../api/onboarding';
import { useFeatureFlags, useUiSettingsHydrated } from '../hooks/useUiSettings';

/**
 * Reports Lighting already off when the features step is not shown, so the
 * lighting device-selection step is skipped. It lives apart because Dashboard
 * renders the settings provider and cannot read the flags itself. It only ever
 * reports off: the features step's own Continue is what turns the skip on or
 * off when it runs.
 */
export function LightingFeatureSeed({ active, lightingPending, onLightingOff }: { active: boolean; lightingPending: boolean; onLightingOff: () => void }) {
  const { lighting } = useFeatureFlags();
  const hydrated = useUiSettingsHydrated();
  const completed = useRef(false);
  useEffect(() => {
    if (!active || !hydrated || lighting) return;
    onLightingOff();
    // The service holds notifications until the lighting step completes, so a skipped step is completed too.
    if (lightingPending && !completed.current) {
      completed.current = true;
      completeLightingOnboarding().catch(() => { /* best-effort */ });
    }
  }, [active, hydrated, lighting, lightingPending, onLightingOff]);
  return null;
}
