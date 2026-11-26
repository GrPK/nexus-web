import { keyCap } from '../logitechMouse/hidKeys';

// Words for keys and the actions a key can take, shared by the keyboard drawing and the action list.

/** Legends printed on keys that hidKeys does not word (it names keys for macro steps). */
const CAP_EXTRA: Record<number, string> = {
  0x28: 'Enter', 0x29: 'Esc', 0x2A: '⌫', 0x2B: 'Tab', 0x2C: '', 0x32: '\\', 0x39: 'Caps', 0x46: 'PrtSc',
  0x47: 'ScrLk', 0x4C: 'Del', 0x49: 'Ins', 0x65: '☰', 0x53: 'Num', 0x58: '↵',
  0xE0: 'Ctrl', 0xE1: 'Shift', 0xE2: 'Alt', 0xE3: '⊞', 0xE4: 'Ctrl', 0xE5: 'Shift', 0xE6: 'Alt Gr', 0xE7: '⊞',
};
const NUMPAD_FIRST = 0x59;
const NUMPAD_ZERO = 0x62;

/** The short legend drawn on a key cap. */
export function capText(usage: number): string {
  if (usage in CAP_EXTRA) return CAP_EXTRA[usage];
  if (usage >= NUMPAD_FIRST && usage < NUMPAD_FIRST + 9) return String(usage - NUMPAD_FIRST + 1);
  if (usage === NUMPAD_ZERO) return '0';
  if (usage === 0x54) return '/';
  if (usage === 0x55) return '*';
  if (usage === 0x56) return '−';
  if (usage === 0x57) return '+';
  if (usage === 0x63) return '.';
  return keyCap(usage) ?? '';
}

/** Translation suffixes (devices.logitechMouse.key.*) for keys with a word for a name. */
export const NAMED_KEYS: Readonly<Record<number, string>> = {
  0x28: 'enter', 0x29: 'escape', 0x2A: 'backspace', 0x2B: 'tab', 0x2C: 'space', 0x4C: 'delete',
};

/** A key's name in lists: a translated word, the key cap, or its usage in hex. */
export function keyName(usage: number, t: (k: string) => string): string {
  const named = NAMED_KEYS[usage];
  if (named) return t(`devices.logitechMouse.key.${named}`);
  if (usage === 0x58) return 'Num Enter';
  return keyCap(usage) ?? '0x' + usage.toString(16).toUpperCase();
}

/** Modifier bits of a key action: left-hand in the low nibble, right-hand in the high one. */
export const MODIFIERS: readonly [number, string][] = [
  [0x01, 'Ctrl'], [0x02, 'Shift'], [0x04, 'Alt'], [0x08, 'Win'],
  [0x10, 'Right Ctrl'], [0x20, 'Right Shift'], [0x40, 'Right Alt'], [0x80, 'Right Win'],
];

/** Modifiers as they fit on a key cap: "Ctrl ⇧", right-hand ones marked with an R. */
export function modifierCaps(modifiers: number): string {
  const caps: [number, string][] = [[0x01, 'Ctrl'], [0x02, '⇧'], [0x04, 'Alt'], [0x08, '⊞']];
  const parts: string[] = [];
  for (const [bit, cap] of caps) {
    if ((modifiers & bit) !== 0) parts.push(cap);
    if ((modifiers & (bit << 4)) !== 0) parts.push('R' + cap);
  }
  return parts.join(' ');
}

/** "Ctrl+Shift+Esc" for a key with modifiers. */
export function shortcutText(usage: number, modifiers: number, t: (k: string) => string): string {
  const mods = MODIFIERS.filter(([bit]) => (modifiers & bit) !== 0).map(([, name]) => name);
  return [...mods, keyName(usage, t)].join('+');
}

/** Mouse buttons by their bit in a button mask. */
export const MOUSE_BUTTONS: readonly { mask: number; key: string; short: string }[] = [
  { mask: 0x01, key: 'left', short: 'L' }, { mask: 0x02, key: 'right', short: 'R' }, { mask: 0x04, key: 'middle', short: 'M' },
  { mask: 0x08, key: 'back', short: '←' }, { mask: 0x10, key: 'forward', short: '→' },
];

/** Media controls by HID consumer usage. */
export const MEDIA: readonly { usage: number; key: string }[] = [
  { usage: 0xCD, key: 'playPause' }, { usage: 0xB5, key: 'nextTrack' }, { usage: 0xB6, key: 'previousTrack' },
  { usage: 0xB7, key: 'stop' }, { usage: 0xE9, key: 'volumeUp' }, { usage: 0xEA, key: 'volumeDown' }, { usage: 0xE2, key: 'mute' },
];
