import { describe, it, expect } from 'vitest';
import { DECK_PREVIEW_CONFIG, ESSENTIALS_PREVIEW_OPS } from './deckPreviewData';
import { autoIconName, categoryColor, deckCategory } from './deckIcons';
import type { DeckAction } from './types';

describe('DECK_PREVIEW_CONFIG', () => {
  it('pins the op list to nexus-service DeckDefaultPresetsTests (Essentials keys, same order)', () => {
    expect(ESSENTIALS_PREVIEW_OPS).toEqual(['volumeDown', 'volumeUp', 'screenshot', 'taskManager']);
  });

  it('shows each Essentials key with the icon and color a real key resolves to, then empty slots', () => {
    const slots = DECK_PREVIEW_CONFIG.pages[0].slots;
    ESSENTIALS_PREVIEW_OPS.forEach((op, i) => {
      const action: DeckAction = { type: 'system', action: { op } };
      expect(slots[i].icon).toEqual({ kind: 'lucide', value: autoIconName(action) });
      expect(slots[i].color).toBe(categoryColor(deckCategory(action)));
      expect(slots[i].action).toBeUndefined();
    });
    expect(slots).toHaveLength(8);
    slots.slice(ESSENTIALS_PREVIEW_OPS.length).forEach(s => expect(s).toEqual({}));
  });
});
