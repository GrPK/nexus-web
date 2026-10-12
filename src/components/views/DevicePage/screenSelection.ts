export interface SharedValue<T> {
  /** The common value, or undefined when there is no target or the targets differ. */
  value: T | undefined;
  mixed: boolean;
  /** Every distinct value a target holds. */
  held: Set<T>;
}

/** Reduces what a group of selected screens hold for one field to one value or "mixed". */
export function sharedValue<S, T>(targets: readonly S[], pick: (s: S) => T): SharedValue<T> {
  const held = new Set(targets.map(pick));
  const mixed = held.size > 1;
  return { value: held.size === 1 ? [...held][0] : undefined, mixed, held };
}
