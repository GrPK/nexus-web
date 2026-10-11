import { useSyncExternalStore } from 'react';
import { studioBlock } from './studioBlocks';
import { STUDIO_MOD_SOURCES, stageCount, type StudioBlock, type StudioRecipe } from './studioCompiler';

// Prototype storage: browser-local until the service owns custom effects.
const SAVED_KEY = 'nexus.studio.saved';

export interface SavedEffect {
  id: string;
  name: string;
  recipe: StudioRecipe;
  /** JPEG data URL rendered at save time. */
  thumb?: string;
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
  return stageCount(r, 'pattern') >= 1 && stageCount(r, 'color') === 1;
}

function isSaved(s: unknown): s is SavedEffect {
  return isObj(s) && typeof s.id === 'string' && typeof s.name === 'string' && isRecipe(s.recipe)
    && (s.thumb === undefined || typeof s.thumb === 'string');
}

function load(): SavedEffect[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter(isSaved) : [];
  } catch {
    return [];
  }
}

let snapshot: SavedEffect[] | null = null;
// False after a write storage refused: the snapshot then holds the only copy and must not be re-read.
let storageInSync = true;
const listeners = new Set<() => void>();

export function getSavedEffects(): SavedEffect[] {
  snapshot ??= load();
  return snapshot;
}

function commit(next: SavedEffect[]): void {
  snapshot = next;
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    storageInSync = true;
  } catch {
    storageInSync = false;
  }
  listeners.forEach(l => l());
}

/** Inserts, or replaces the entry with the same id in place. */
export function putSavedEffect(effect: SavedEffect): void {
  const list = getSavedEffects();
  const i = list.findIndex(e => e.id === effect.id);
  commit(i < 0 ? [...list, effect] : list.map(e => (e.id === effect.id ? effect : e)));
}

export function deleteSavedEffect(id: string): void {
  commit(getSavedEffects().filter(e => e.id !== id));
}

// Another window of this origin wrote the list (or cleared storage, key null): reload it
// rather than overwrite it later.
function onStorage(e: StorageEvent): void {
  if (e.key !== null && e.key !== SAVED_KEY) return;
  snapshot = null;
  storageInSync = true;
  listeners.forEach(l => l());
}

// The storage listener only runs while subscribed, so the first subscriber re-reads to
// pick up writes made by other windows in between.
function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    if (storageInSync) snapshot = null;
    window.addEventListener('storage', onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

export function useSavedEffects(): SavedEffect[] {
  return useSyncExternalStore(subscribe, getSavedEffects);
}
