import { useEffect, useRef } from 'react';
import { dismissNexus2Welcome } from '../api/migration';
import { dismissFanControlImport } from '../api/fancontrol';

export interface ConsumeSkippedOffersInput {
  /** The onboarding run is over: every gate is closed. */
  runOver: boolean;
  /** The pillar values came from a successful server read, not the local cache. */
  decidedFromServer: boolean;
  coolingOn: boolean;
  fanControlPending: boolean;
  nexus2Pending: boolean;
  /** Whether Nexus 2 holds anything besides fan curves; null while unknown. */
  nexus2NonCooling: boolean | null;
}

/**
 * An import offer that the run skipped because its pillar is off is dismissed
 * once, so it is never asked again: FanControl, and a Nexus 2 offer whose only
 * content is fan curves. Cooling imports both on demand afterwards.
 */
export function useConsumeSkippedOffers(input: ConsumeSkippedOffersInput): void {
  const { runOver, decidedFromServer, coolingOn, fanControlPending, nexus2Pending, nexus2NonCooling } = input;
  const fanControlDone = useRef(false);
  const nexus2Done = useRef(false);
  useEffect(() => {
    if (!runOver || !decidedFromServer || coolingOn) return;
    if (fanControlPending && !fanControlDone.current) {
      fanControlDone.current = true;
      void dismissFanControlImport().catch(() => null);
    }
    if (nexus2Pending && nexus2NonCooling === false && !nexus2Done.current) {
      nexus2Done.current = true;
      void dismissNexus2Welcome().catch(() => null);
    }
  }, [runOver, decidedFromServer, coolingOn, fanControlPending, nexus2Pending, nexus2NonCooling]);
}
