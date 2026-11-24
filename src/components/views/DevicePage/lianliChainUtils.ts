// Pure helpers for the Lighting tab's chain list, free of React so they are unit-testable.

import type { LianLiWirelessChainLighting, LianLiWirelessChainPatch, LianLiWirelessHalfLook } from '../../../api/lianli-wireless';

const LOOK_KEYS = ['mode', 'speed', 'direction', 'brightness', 'colors'] as const;

/** The look a wireless TL half starts from: the chain's own, or the effect it returns to off the Lighting page. */
export function chainLookOf(chain: LianLiWirelessChainLighting): LianLiWirelessHalfLook {
  const mode = chain.mode === 'custom' || chain.mode === 'perLane' ? chain.effectMode ?? 'rainbow' : chain.mode;
  return { mode, speed: chain.speed, direction: chain.direction, brightness: chain.brightness, colors: chain.colors };
}

/** A wireless TL chain whose halves play looks of their own (L-Connect's Up / Down scope). */
export function hasOwnHalves(chain: LianLiWirelessChainLighting): boolean {
  return chain.supportsScope === true && (chain.up != null || chain.down != null);
}

/**
 * Applies a patch to a chain locally, as the service does: a zone patch merges into the zone with the
 * same id; a wireless TL patch with a scope sets that half only, and a whole-fan look drops both halves.
 */
export function applyChainPatch(chain: LianLiWirelessChainLighting, patch: LianLiWirelessChainPatch): LianLiWirelessChainLighting {
  const { zones, scope, ...rest } = patch;
  if (scope && chain.supportsScope) {
    const { mode, speed, direction, brightness, colors, ...other } = rest;
    // The effect a chain returns to off the Lighting page is the whole fan's, so a half's look never sets it.
    delete other.effectMode;
    const base = chain[scope] ?? chainLookOf(chain);
    const half: LianLiWirelessHalfLook = {
      mode: mode ?? base.mode,
      speed: speed ?? base.speed,
      direction: direction ?? base.direction,
      brightness: brightness ?? base.brightness,
      colors: colors ?? base.colors,
    };
    const next: LianLiWirelessChainLighting = { ...chain, ...other, lastScope: scope };
    if (scope === 'up') next.up = half;
    else next.down = half;
    return next;
  }
  const next = { ...chain, ...rest };
  const wholeLook = (rest.mode !== undefined && rest.mode !== 'custom')
    || LOOK_KEYS.some(key => key !== 'mode' && rest[key] !== undefined);
  if (chain.supportsScope && wholeLook) {
    next.up = null;
    next.down = null;
    next.lastScope = null;
  }
  if (zones && chain.zones) {
    next.zones = chain.zones.map(z => {
      const change = zones.find(p => p.id === z.id);
      return change ? { ...z, ...change } : z;
    });
  }
  return next;
}

/** Chains in light-sequence order; equal sequence numbers fall back to the MAC, as the service orders them. */
export function sortBySequence(chains: readonly LianLiWirelessChainLighting[]): LianLiWirelessChainLighting[] {
  return chains
    .map((chain, index) => ({ chain, index }))
    .sort((a, b) => (a.chain.sortIndex ?? 0) - (b.chain.sortIndex ?? 0)
      || (a.chain.mac < b.chain.mac ? -1 : a.chain.mac > b.chain.mac ? 1 : 0)
      || a.index - b.index)
    .map(x => x.chain);
}

const NON_EFFECT_MODES = ['custom', 'perZone', 'perLane'];

/** The chain plays an effect that has a merged variant, so its Merge switch can take effect. */
export function canMerge(chain: LianLiWirelessChainLighting): boolean {
  // Halves with looks of their own play per half, like a wired fan's per-zone mode.
  if (NON_EFFECT_MODES.includes(chain.mode) || hasOwnHalves(chain)) return false;
  return chain.modes.some(e => e.key === chain.mode && e.mergeable === true);
}

/**
 * MAC of the unit that sets the look of a merged group: the first unit in sequence order with
 * merge on and an effect that can merge. Null when no unit qualifies.
 */
export function mergeLeaderMac(chains: readonly LianLiWirelessChainLighting[]): string | null {
  return sortBySequence(chains).find(c => c.merge === true && canMerge(c))?.mac ?? null;
}

/**
 * Moves one chain a step along the light sequence. Returns the sort index each
 * changed chain must be saved with; every chain is renumbered by position, so
 * units that all start at the same index still end up distinct.
 */
export function moveInSequence(
  chains: readonly LianLiWirelessChainLighting[],
  mac: string,
  delta: -1 | 1,
): { mac: string; sortIndex: number }[] {
  const ordered = sortBySequence(chains);
  const from = ordered.findIndex(c => c.mac === mac);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ordered.length) return [];
  const next = [...ordered];
  [next[from], next[to]] = [next[to], next[from]];
  return next
    .map((c, sortIndex) => ({ mac: c.mac, sortIndex, changed: c.sortIndex !== sortIndex }))
    .filter(x => x.changed)
    .map(({ mac: m, sortIndex }) => ({ mac: m, sortIndex }));
}

/** A patch that can change which unit leads a merged group, so a leader named by an earlier read may be stale. */
export function patchAffectsLeader(patch: LianLiWirelessChainPatch): boolean {
  return patch.merge !== undefined || patch.mode !== undefined || patch.sortIndex !== undefined;
}

/** Numbers repeated titles in order ("TL Flex", "TL Flex 2"); a title used once is unchanged. */
export function numberDuplicateTitles(titles: readonly string[]): string[] {
  const total = new Map<string, number>();
  for (const title of titles) total.set(title, (total.get(title) ?? 0) + 1);
  const seen = new Map<string, number>();
  return titles.map(title => {
    const n = (seen.get(title) ?? 0) + 1;
    seen.set(title, n);
    return (total.get(title) ?? 0) > 1 && n > 1 ? `${title} ${n}` : title;
  });
}
