import type { PanelSurface } from '../types';
import { surfaceSupportsTouch } from '../types';

// Control center: a sheet pulled down from the very top edge of the panel.
// Thresholds are physical finger travel, converted per surface with cssPxPerMm
// (see gestureThresholds for why).

// Height of the band a touch must start in. A finger sliding in from the bezel
// is first reported a few px below the top, so the band is generous.
export const CONTROL_CENTER_BAND_MM = 5;
export const CONTROL_CENTER_ENGAGE_MM = 3;
export const CONTROL_CENTER_COMMIT_MM = 18;
export const CONTROL_CENTER_FLICK_MM_PER_MS = 0.16;
// Swiping up on the open sheet.
export const CONTROL_CENTER_DISMISS_MM = 12;

export function controlCenterBandPx(pxPerMm: number, safeAreaTopPx: number): number {
  return CONTROL_CENTER_BAND_MM * pxPerMm + Math.max(0, safeAreaTopPx);
}

export function inControlCenterBand(clientY: number, bandPx: number): boolean {
  return clientY >= 0 && clientY <= bandPx;
}

export interface ControlCenterGateInput {
  surface: PanelSurface;
  deviceTouch?: boolean;
  kioskBehavior: boolean;
  immersiveOpen: boolean;
  sheetOpen: boolean;
  trayOpen: boolean;
  offline: boolean;
  rearranging: boolean;
  dragArmed: boolean;
  asleep: boolean;
}

// The surfaces are the actions tray's kiosk touch gate minus the paired phone,
// whose OS owns the top-edge swipe.
export function controlCenterGestureEnabled(i: ControlCenterGateInput): boolean {
  return i.kioskBehavior
    && i.surface !== 'phone'
    && surfaceSupportsTouch(i.surface, i.deviceTouch)
    && !i.immersiveOpen
    && !i.sheetOpen
    && !i.trayOpen
    && !i.offline
    && !i.rearranging
    && !i.dragArmed
    && !i.asleep;
}

export function resolveSwipeRelease(
  offset: number,
  velocity: number,
  commitPx: number,
  flickPxPerMs: number,
): 'commit' | 'cancel' {
  return offset > commitPx || velocity > flickPxPerMs ? 'commit' : 'cancel';
}

// Tapping the theme tile sets the explicit opposite of what is showing, even
// when the panel currently follows the desktop or the system.
export function oppositeThemeMode(resolved: 'dark' | 'light'): 'dark' | 'light' {
  return resolved === 'dark' ? 'light' : 'dark';
}

// CSS px of safe-area inset at the top, measured with a probe element.
export function readSafeAreaTopPx(): number {
  if (typeof document === 'undefined' || !document.body) return 0;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top)';
  document.body.appendChild(probe);
  const px = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  document.body.removeChild(probe);
  return px;
}

function closestMatch(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

// A widget's own scroller (the fader's whole hit box included) keeps its drag,
// as for the actions tray.
export function overScrollable(target: EventTarget | null): boolean {
  return closestMatch(target, '[data-panel-scrollable="true"]');
}

// The open swipe yields outside the band and over a scroller.
export function openSwipeYields(clientY: number, bandPx: number, target: EventTarget | null): boolean {
  return !inControlCenterBand(clientY, bandPx) || overScrollable(target);
}

// The dismiss swipe yields over a fader or horizontal control or a scroller.
export function dismissSwipeYields(target: EventTarget | null): boolean {
  return overScrollable(target)
    || closestMatch(target, 'input, [role="slider"], [data-panel-horizontal-control="true"]');
}
