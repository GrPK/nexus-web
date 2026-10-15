// Catalog preview fixture - untranslated by design. ONE size-independent
// config showing what a newly added deck widget spawns: the seeded Essentials
// keys (nexus-service src/Deck/DeckDefaultPresets.cs) first, then empty slots.
// 2x2 truncates to the first 4 slots, 4x4 pads to 16 (padSlots). Slots carry
// the icon and color the real keys resolve to and NO action: icon-only slots
// render as populated, onCell no-ops, no app-icon fetches.
// deckPreviewData.test.ts pins these against the system ops below.
import type { DeckConfig, DeckSlot, DeckSystemOp } from './types';

/** The seeded Essentials system ops, in order. Mirrors DeckDefaultPresets.EssentialsKeys. */
export const ESSENTIALS_PREVIEW_OPS: readonly DeckSystemOp[] = ['volumeDown', 'volumeUp', 'screenshot', 'taskManager'];

const slot = (value: string, color: string): DeckSlot =>
  ({ icon: { kind: 'lucide', value }, color });

export const DECK_PREVIEW_CONFIG: DeckConfig = {
  pages: [{
    slots: [
      slot('Volume1', '#06b6d4'),
      slot('Volume2', '#06b6d4'),
      slot('Camera', '#64748b'),
      slot('Activity', '#64748b'),
      {}, {}, {}, {},
    ],
  }],
};
