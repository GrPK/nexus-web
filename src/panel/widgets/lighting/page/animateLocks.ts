/** Device id to the Animate effect key it is locked onto. */
export type AnimateLocks = Readonly<Record<string, string>>;

/** `locks` with one device's entry set, or removed for a null effect. */
export function withAnimateLock(locks: AnimateLocks, id: string, effect: string | null): AnimateLocks {
  if (effect === null) {
    if (!(id in locks)) return locks;
    const next = { ...locks };
    delete next[id];
    return next;
  }
  return locks[id] === effect ? locks : { ...locks, [id]: effect };
}

/** Device ids per locked effect, in the order the locks were given. */
export function lockedIdsByEffect(locks: AnimateLocks): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [id, effect] of Object.entries(locks)) {
    const ids = out.get(effect);
    if (ids) ids.push(id); else out.set(effect, [id]);
  }
  return out;
}

/** The ids of `ids` that are locked onto an effect. */
export function animateLockedAmong(locks: AnimateLocks, ids: readonly string[]): string[] {
  return ids.filter(id => id in locks);
}

/**
 * The one effect every id is locked onto, or null when any id is unlocked or
 * they disagree. A selection like that is what the grid and drawer show the
 * locked animation for.
 */
export function sharedAnimateLock(locks: AnimateLocks, ids: readonly string[]): string | null {
  if (ids.length === 0) return null;
  const first = locks[ids[0]];
  if (!first) return null;
  return ids.every(id => locks[id] === first) ? first : null;
}

/** Device names per locked effect, for the thumbnail badge. Ids with no known
 *  device (unplugged, hidden) are left out, and the count follows the names. */
export function lockedNamesByEffect(
  locks: AnimateLocks,
  nameOf: (id: string) => string | undefined,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [effect, ids] of lockedIdsByEffect(locks)) {
    const names = ids.map(nameOf).filter((n): n is string => !!n);
    if (names.length > 0) out.set(effect, names);
  }
  return out;
}
