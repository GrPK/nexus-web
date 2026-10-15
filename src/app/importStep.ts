/**
 * Whether the onboarding import step has anything to offer. FanControl is a
 * cooling import, so with Cooling off only Nexus 2 can keep the step open; it
 * is skipped entirely when neither source remains.
 */
export function importStepOffered(nexus2Pending: boolean, fanControlPending: boolean, coolingOn: boolean): boolean {
  return nexus2Pending || (fanControlPending && coolingOn);
}
