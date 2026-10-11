import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBlock, type StudioRecipe } from './studioCompiler';

const recipe = (): StudioRecipe => ({
  v: 1, blocks: [makeBlock('plasma'), makeBlock('palette')], speed: 50, hue: 0, saturation: 1, contrast: 1,
});

// The module caches its snapshot, so each test loads a fresh copy over fresh storage.
async function freshLibrary() {
  vi.resetModules();
  return import('./studioLibrary');
}

describe('studioLibrary', () => {
  beforeEach(() => localStorage.clear());

  it('inserts, replaces in place by id, and deletes', async () => {
    const lib = await freshLibrary();
    lib.putSavedEffect({ id: 'a', name: 'one', recipe: recipe() });
    lib.putSavedEffect({ id: 'b', name: 'two', recipe: recipe() });
    lib.putSavedEffect({ id: 'a', name: 'one renamed', recipe: recipe() });
    expect(lib.getSavedEffects().map(e => [e.id, e.name])).toEqual([['a', 'one renamed'], ['b', 'two']]);
    lib.deleteSavedEffect('a');
    expect(lib.getSavedEffects().map(e => e.id)).toEqual(['b']);
    expect(JSON.parse(localStorage.getItem('nexus.studio.saved')!)).toHaveLength(1);
  });

  it('drops malformed entries on load instead of compiling them', async () => {
    const bad = recipe();
    bad.blocks[0].mods = { scale: { source: 'nope' as never, amount: 0.5 } };
    const noColor = { ...recipe(), blocks: [makeBlock('plasma')] };
    localStorage.setItem('nexus.studio.saved', JSON.stringify([
      { id: 'ok', name: 'ok', recipe: recipe() },
      { id: 'bad-mod', name: 'x', recipe: bad },
      { id: 'no-color', name: 'y', recipe: noColor },
      { id: 'nan', name: 'z', recipe: { ...recipe(), speed: 'fast' } },
    ]));
    const lib = await freshLibrary();
    expect(lib.getSavedEffects().map(e => e.id)).toEqual(['ok']);
  });
});

describe('studioLibrary across windows', () => {
  beforeEach(() => localStorage.clear());

  it('re-reads storage when the first subscriber attaches', async () => {
    const lib = await freshLibrary();
    lib.putSavedEffect({ id: 'a', name: 'mine', recipe: recipe() });
    // Another window appends while nothing here is subscribed.
    const other = JSON.parse(localStorage.getItem('nexus.studio.saved')!);
    other.push({ id: 'b', name: 'theirs', recipe: recipe() });
    localStorage.setItem('nexus.studio.saved', JSON.stringify(other));
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => lib.useSavedEffects());
    expect(result.current.map(e => e.id)).toEqual(['a', 'b']);
  });
});

describe('studioLibrary when storage refuses a write', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the in-memory list instead of re-reading storage', async () => {
    const lib = await freshLibrary();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    lib.putSavedEffect({ id: 'a', name: 'unsaved to disk', recipe: recipe() });
    setItem.mockRestore();
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => lib.useSavedEffects());
    expect(result.current.map(e => e.id)).toEqual(['a']);
  });
});
