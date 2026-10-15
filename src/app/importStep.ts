/**
 * Whether the onboarding import step has anything to offer. FanControl and
 * Nexus 2's fan curves belong to the Cooling pillar: with Cooling off, only
 * Nexus 2 content outside them keeps the step open, and it is skipped
 * entirely when nothing remains.
 */
export function importStepOffered(nexus2Pending: boolean, nexus2HasNonCooling: boolean, fanControlPending: boolean, coolingOn: boolean): boolean {
  return (nexus2Pending && (coolingOn || nexus2HasNonCooling)) || (fanControlPending && coolingOn);
}
