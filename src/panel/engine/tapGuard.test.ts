import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { swallowTapFollowUps } from './tapGuard';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

// A pointer release just before the activation, as in a real tap.
function pointerRelease() {
  window.dispatchEvent(new Event('pointerup'));
}

function fire(type: string): { reached: boolean } {
  const target = document.createElement('button');
  document.body.appendChild(target);
  const seen = { reached: false };
  target.addEventListener(type, () => { seen.reached = true; });
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
  target.remove();
  return seen;
}

describe('swallowTapFollowUps', () => {
  it('swallows the compat mousedown, mouseup and click of the activating touch, then lets go', () => {
    pointerRelease();
    swallowTapFollowUps();
    expect(fire('mousedown').reached).toBe(false);
    expect(fire('mouseup').reached).toBe(false);
    expect(fire('click').reached).toBe(false);
    // The click ends the guard: the next real click goes through.
    expect(fire('click').reached).toBe(true);
  });

  it('lets go after the timeout when no click ever arrives', () => {
    pointerRelease();
    swallowTapFollowUps(300);
    expect(fire('mousedown').reached).toBe(false);
    vi.advanceTimersByTime(350);
    expect(fire('mousedown').reached).toBe(true);
  });

  it('lets go as soon as a new press begins', () => {
    pointerRelease();
    swallowTapFollowUps();
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(fire('click').reached).toBe(true);
  });

  it('does not arm for a keyboard or programmatic activation with no pointer release before it', () => {
    vi.advanceTimersByTime(1000);
    swallowTapFollowUps();
    expect(fire('click').reached).toBe(true);
  });
});
