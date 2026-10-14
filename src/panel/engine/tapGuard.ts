// A touch's pointerup can switch the view under the finger, and the browser
// then sends that touch's compatibility mouse events and click a few
// milliseconds later, onto whatever is now there. This swallows them, in the
// capture phase, until the click arrives, a new press begins, or the timeout
// passes (the click may never come when the pressed node was removed).
//
// It arms only for an activation that follows a pointer release: a keyboard or
// programmatic click has no pointerup before it and must not eat the next one.
const EVENTS = ['mousedown', 'mouseup', 'click'] as const;

export const TAP_GUARD_MS = 350;
// How recent a pointerup must be for the activation to count as pointer-made.
const POINTER_RECENT_MS = 60;

let lastPointerUpAt = -Infinity;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerup', () => { lastPointerUpAt = performance.now(); }, true);
}

export function swallowTapFollowUps(timeoutMs: number = TAP_GUARD_MS): void {
  if (typeof window === 'undefined') return;
  if (performance.now() - lastPointerUpAt > POINTER_RECENT_MS) return;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stop = (e: Event) => {
    e.stopImmediatePropagation();
    e.preventDefault();
    if (e.type === 'click') release();
  };
  const newPress = () => release();
  function release() {
    for (const type of EVENTS) window.removeEventListener(type, stop, true);
    window.removeEventListener('pointerdown', newPress, true);
    if (timer) clearTimeout(timer);
  }
  for (const type of EVENTS) window.addEventListener(type, stop, true);
  window.addEventListener('pointerdown', newPress, true);
  timer = setTimeout(release, timeoutMs);
}
