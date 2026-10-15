import { useEffect, useState } from 'react';
import { previewNexus2Import } from '../api/migration';
import { groupHasAvailable, IMPORT_GROUPS } from '../components/common/Nexus2WelcomeScreen/nexus2WelcomeUtils';

// A local read; this only bounds a service that accepted the request and never answers.
const PREVIEW_TIMEOUT_MS = 8000;

/**
 * Whether Nexus 2 holds anything to import besides the Cooling pillar's fan
 * curves. Asked only while Cooling is off and the offer is pending; null while
 * the answer is in flight. A failed, rejected or timed-out (aborted) read
 * answers true: the step then behaves as it did before pillars existed.
 */
export function useNexus2NonCoolingContent(ask: boolean): boolean | null {
  const [result, setResult] = useState<boolean | null>(null);
  useEffect(() => {
    if (!ask) return;
    setResult(null);
    let cancelled = false;
    const abort = new AbortController();
    // Network I/O bound by AbortSignal, not a synchronization delay.
    const bound = setTimeout(() => abort.abort(), PREVIEW_TIMEOUT_MS);
    void previewNexus2Import(abort.signal).then(preview => {
      if (cancelled) return;
      setResult(preview === null ? true : IMPORT_GROUPS.some(g => g.id !== 'fanCurves' && groupHasAvailable(preview, g)));
    }).catch(() => { if (!cancelled) setResult(true); }).finally(() => clearTimeout(bound));
    return () => { cancelled = true; clearTimeout(bound); abort.abort(); };
  }, [ask]);
  return ask ? result : true;
}
