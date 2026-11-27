import type { ReactNode } from 'react';
import { capText } from './keyNames';
import type { KeyShape, KeyboardLayout } from './g915x';

// What the keyboard drawing and the keyboard picture share: what a key shows, and how text fits a key.

/** What a key does on the layer shown, worded for its cap. */
export interface KeyFace {
  /** The assignment, short; null when the key does what it does by default. */
  label: string | null;
  /** A smaller line above the label (the modifiers of a shortcut). */
  sub?: string;
  /** "own": assigned on this layer. "inherited": the Base assignment showing through on G-Shift. */
  source: 'own' | 'inherited' | null;
  /** Colour family of the assignment. */
  tone?: 'gshift' | 'disabled';
  /** Drawn above the label, or alone when there is no label (media controls, mouse buttons). */
  icon?: ReactNode;
}

export interface KeyboardIllustrationProps {
  layout: KeyboardLayout;
  /** Key number of a control id, or undefined when this keyboard has no such control. */
  keyOf: (cid: number) => number | undefined;
  face: (key: number) => KeyFace;
  selectedKey: number | null;
  /** The key whose assignment just changed; it pops and ripples. */
  flashKey: number | null;
  /** Changes with the layer shown, so the keys sweep in again. */
  layerKey: string;
  ariaLabel: string;
  /** Accessible name of a key, from its legend. */
  keyAria: (key: number, legend: string) => string;
  onSelect: (key: number) => void;
  onDropAction: (key: number, value: string) => void;
}

// Text sizes in drawing units; the drawing shows at about half size, so 16 is the smallest that reads.
const MIN_FONT = 16;
const CHAR_WIDTH = 0.58;
const TEXT_MARGIN = 14;

/** A key's own legend: its cap text, or its G number. */
export function legendOf(k: KeyShape): string {
  if (k.g) return `G${k.g}`;
  if (k.usage !== undefined) return capText(k.usage);
  return '';
}

/** The largest font that fits `text` on a key `width` wide, from 30 for one character down to 16. */
export function fontFor(text: string, width: number): number {
  const n = [...text].length;
  const size = n <= 1 ? 30 : n <= 2 ? 26 : n <= 3 ? 22 : n <= 4 ? 19 : 17;
  const fits = Math.floor((width - TEXT_MARGIN) / (Math.max(n, 1) * CHAR_WIDTH));
  return Math.max(MIN_FONT, Math.min(size, fits));
}

/** `text` cut short with an ellipsis to fit a key `width` wide at `font`. */
export function fit(text: string, width: number, font = MIN_FONT): string {
  const max = Math.max(3, Math.floor((width - TEXT_MARGIN + 2) / (font * CHAR_WIDTH)));
  return [...text].length > max ? [...text].slice(0, max - 1).join('') + '…' : text;
}
