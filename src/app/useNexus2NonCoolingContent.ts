import { useEffect, useState } from 'react';
import { previewNexus2Import } from '../api/migration';
import { groupHasAvailable, IMPORT_GROUPS } from '../components/common/Nexus2WelcomeScreen/nexus2WelcomeUtils';

/**
 * Whether Nexus 2 holds anything to import besides the Cooling pillar's fan
 * curves. Only asked while Cooling is off and the offer is pending; null while
 * the answer is in flight. A failed read answers true: the step then behaves as
 * it did before pillars existed.
 */
export function useNexus2NonCoolingContent(ask: boolean): boolean | null {
  const [result, setResult] = useState<boolean | null>(null);
  useEffect(() => {
    if (!ask) return;
    let cancelled = false;
    void previewNexus2Import().then(preview => {
      if (cancelled) return;
      setResult(preview === null ? true : IMPORT_GROUPS.some(g => g.id !== 'fanCurves' && groupHasAvailable(preview, g)));
    }).catch(() => { if (!cancelled) setResult(true); });
    return () => { cancelled = true; };
  }, [ask]);
  return ask ? result : true;
}
