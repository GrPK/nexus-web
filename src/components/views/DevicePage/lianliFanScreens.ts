// The fan screens of the L-Wireless controller or the LCD Flex hub as a page of their own,
// opened from the Lian Li page's Screens tab. The device route names no tab, so the view has
// its own key next to the unit's.

const PREFIX = 'lianli-fan-screens:';

/** The device-route key of a unit's fan screens page. */
export function lianLiFanScreensKey(flex: boolean): string {
  return `${PREFIX}${flex ? 'flex' : 'wireless'}`;
}

/** Whether a device-route key is a fan screens page: true for the Flex hub's, false for the controller's, null for any other key. */
export function lianLiFanScreensOf(deviceKey: string): boolean | null {
  if (deviceKey === `${PREFIX}flex`) return true;
  if (deviceKey === `${PREFIX}wireless`) return false;
  return null;
}
