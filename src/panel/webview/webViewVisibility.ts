import type { WebViewRect } from './webViewProtocol';

type HitTest = (x: number, y: number) => Element | null;

// The hit points stay clear of rounded corners and edge antialiasing, which
// would otherwise fail the check on a tile that is plainly uncovered.
const MIN_INSET = 4;
const MAX_INSET = 24;
const INSET_FRACTION = 0.12;

/** The five probe points: center plus four inset corners. */
export function probePoints(rect: WebViewRect): Array<[number, number]> {
  const inset = Math.min(MAX_INSET, Math.max(MIN_INSET, Math.min(rect.w, rect.h) * INSET_FRACTION));
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  return [
    [cx, cy],
    [rect.x + inset, rect.y + inset],
    [rect.x + rect.w - inset, rect.y + inset],
    [rect.x + inset, rect.y + rect.h - inset],
    [rect.x + rect.w - inset, rect.y + rect.h - inset],
  ];
}

/**
 * True only when `el` is what the user would see at every probe point: a menu,
 * sheet, toast or control center above it makes the hit land elsewhere, which
 * hides the native view without enumerating those layers.
 */
export function isTopmost(el: Element, rect: WebViewRect, hit: HitTest): boolean {
  if (rect.w <= 0 || rect.h <= 0) return false;
  return probePoints(rect).every(([x, y]) => {
    const found = hit(x, y);
    return found !== null && (found === el || el.contains(found));
  });
}

export interface VisibilityInput {
  supported: boolean;
  documentVisible: boolean;
  suppressed: boolean;
  connected: boolean;
  loadFailed: boolean;
  rect: WebViewRect;
  el: Element;
  hit: HitTest;
}

export function computeVisible(i: VisibilityInput): boolean {
  if (!i.supported || !i.documentVisible || i.suppressed || !i.connected || i.loadFailed) return false;
  return isTopmost(i.el, i.rect, i.hit);
}
