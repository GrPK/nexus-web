import { useEffect, useState } from 'react';
import { lianLiFlexScreenApi } from '../../../api/lianli-flex';
import { getLianLiWirelessScreens } from '../../../api/lianli-wireless';
import type { useTranslation } from '../../../lib/i18n';

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

type Translate = ReturnType<typeof useTranslation>['t'];

// The units as their screens are named: brand and range, never "controller".
const WIRELESS_UNIT = 'Lian Li Wireless';
const FLEX_UNIT = 'Lian Li Flex';
const P28_UNIT = 'Lian Li P28 V2';

/**
 * "Lian Li Wireless Fan Screens", "Lian Li Flex Fan Screen": the title of a unit's fan screens,
 * on the Lian Li page's card and on the page it opens. One screen reads singular; an unknown count plural.
 */
export function lianLiFanScreensTitle(t: Translate, flex: boolean, p28Only: boolean, count: number | null): string {
  const name = flex ? (p28Only ? P28_UNIT : FLEX_UNIT) : WIRELESS_UNIT;
  return t(count === 1 ? 'devices.lianli-hub.fanScreen' : 'devices.lianli-hub.fanScreens', { name });
}

// A name that already ends in a screen ("Universal Screen 8.8", "HydroShift II LCD-S") is kept as it is.
const ENDS_IN_SCREEN = /\b(screen|lcd)(-\w+)?(\s+[\d.]+)?$/i;

/** "Lian Li HydroShift II OLED Curved Screen": a Lian Li screen's title, on its card and its page. */
export function lianLiScreenTitle(t: Translate, name: string): string {
  return ENDS_IN_SCREEN.test(name.trim()) ? name : t('devices.lianli-hub.screenTitle', { name });
}

/** How many fan screens a unit has, read once from its screen list; null until known. */
export function useLianLiFanScreenCount(flex: boolean, enabled: boolean): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const read = flex ? lianLiFlexScreenApi.getScreens() : getLianLiWirelessScreens();
    void read.catch(() => null).then(screens => {
      if (!cancelled && screens) setCount(screens.length);
    });
    return () => { cancelled = true; };
  }, [flex, enabled]);
  return count;
}
