import { useMemo } from 'react';
import { invalidateShaderSource } from '../../../../api/lighting';
import {
  customEffectKey, deleteCustomEffect, getCustomEffects, putCustomEffect, refreshCustomEffects, useCustomEffects,
  type CustomEffectEntry,
} from '../../../../api/customEffects';
import { studioBlock } from './studioBlocks';
import { STUDIO_MOD_SOURCES, compileStudio, stageCount, type StudioBlock, type StudioRecipe } from './studioCompiler';

// Where the prototype kept effects before the service stored them; migrated once, then removed.
const LEGACY_KEY = 'nexus.studio.saved';

export interface SavedEffect {
  id: string;
  name: string;
  recipe: StudioRecipe;
  updatedAt: number;
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isObj = (o: unknown): o is Record<string, unknown> => !!o && typeof o === 'object' && !Array.isArray(o);

function isBlock(b: StudioBlock | null | undefined): boolean {
  if (!b || typeof b.uid !== 'string' || !studioBlock(b.type) || !isObj(b.params)) return false;
  if (!Object.values(b.params).every(isNum)) return false;
  if (b.mods !== undefined && !(isObj(b.mods) && Object.values(b.mods).every(m => isObj(m) && STUDIO_MOD_SOURCES.includes(m.source) && isNum(m.amount)))) return false;
  return b.colors === undefined || (isObj(b.colors) && Object.values(b.colors).every(c => Array.isArray(c) && c.length === 3 && c.every(isNum)));
}

export function isRecipe(x: unknown): x is StudioRecipe {
  if (!isObj(x)) return false;
  const r = x as unknown as StudioRecipe;
  if (r.v !== 1 || !Array.isArray(r.blocks) || !r.blocks.every(isBlock)) return false;
  if (![r.speed, r.hue, r.saturation, r.contrast].every(isNum)) return false;
  if (r.knobs !== undefined && !(Array.isArray(r.knobs) && r.knobs.every(k => isObj(k) && typeof k.uid === 'string' && typeof k.key === 'string'))) return false;
  return stageCount(r, 'pattern') >= 1 && stageCount(r, 'color') === 1;
}

// Parsed per entry object, so an unchanged entry keeps its SavedEffect identity.
const parsed = new WeakMap<CustomEffectEntry, SavedEffect | null>();

function toSaved(entry: CustomEffectEntry): SavedEffect | null {
  if (parsed.has(entry)) return parsed.get(entry)!;
  let recipe: unknown = null;
  try {
    recipe = JSON.parse(entry.recipe);
  } catch {
    /* unreadable: skipped */
  }
  const saved = isRecipe(recipe) ? { id: entry.id, name: entry.name, recipe, updatedAt: entry.updatedAt } : null;
  parsed.set(entry, saved);
  return saved;
}

const parseAll = (list: CustomEffectEntry[]) => list.map(toSaved).filter((s): s is SavedEffect => !!s);

export function getSavedEffects(): SavedEffect[] {
  return parseAll(getCustomEffects());
}

export function useSavedEffects(): SavedEffect[] {
  const list = useCustomEffects();
  return useMemo(() => parseAll(list), [list]);
}

export const newEffectId = () => `fx${Date.now().toString(36)}`;

/** Stores the recipe with its baked shader; resolves to the service's error text when it rejects the shader. */
export async function saveEffect(id: string, name: string, recipe: StudioRecipe): Promise<string | null> {
  const frag = compileStudio(recipe, { bake: true }).frag;
  const result = await putCustomEffect(id, { name, recipe: JSON.stringify(recipe), frag });
  if ('error' in result) return result.error;
  invalidateShaderSource(customEffectKey(id));
  return null;
}

export async function deleteEffect(id: string): Promise<boolean> {
  const ok = await deleteCustomEffect(id);
  if (ok) invalidateShaderSource(customEffectKey(id));
  return ok;
}

let migrated = false;

/** Moves effects saved in browser storage by the earlier prototype into the service, once per page load. */
export async function migrateLegacyEffects(): Promise<void> {
  if (migrated) return;
  migrated = true;
  let legacy: unknown;
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null');
  } catch {
    return;
  }
  if (!Array.isArray(legacy) || legacy.length === 0) return;
  await refreshCustomEffects();
  const existing = new Set(getCustomEffects().map(e => e.id));
  // Only failed items stay behind, so an effect deleted after it migrated never comes back.
  const failed: unknown[] = [];
  for (const item of legacy) {
    if (!isObj(item) || typeof item.id !== 'string' || typeof item.name !== 'string' || !isRecipe(item.recipe)) continue;
    if (existing.has(item.id)) continue;
    if (await saveEffect(item.id, item.name, item.recipe)) failed.push(item);
  }
  try {
    if (failed.length) localStorage.setItem(LEGACY_KEY, JSON.stringify(failed));
    else localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* storage unavailable */
  }
}
