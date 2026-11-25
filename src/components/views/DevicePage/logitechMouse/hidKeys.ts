// Keyboard keys as HID usages (Keyboard/Keypad page 0x07), keyed by the browser's KeyboardEvent.code, so a
// macro recorded in the page stores the same key the mouse will send. Labels are the key caps' own markings.

/** HID usage of the left Ctrl; the eight modifier keys run from here to the right Win (0xE7). */
export const MODIFIER_FIRST = 0xE0;
export const MODIFIER_LAST = 0xE7;

const LETTER_A = 0x04;
const DIGIT_1 = 0x1E;
const F1 = 0x3A;
const F13 = 0x68;
const NUMPAD_1 = 0x59;

const BY_CODE: Record<string, number> = {
  Enter: 0x28, Escape: 0x29, Backspace: 0x2A, Tab: 0x2B, Space: 0x2C, Minus: 0x2D, Equal: 0x2E,
  BracketLeft: 0x2F, BracketRight: 0x30, Backslash: 0x31, Semicolon: 0x33, Quote: 0x34, Backquote: 0x35,
  Comma: 0x36, Period: 0x37, Slash: 0x38, CapsLock: 0x39, PrintScreen: 0x46, ScrollLock: 0x47, Pause: 0x48,
  Insert: 0x49, Home: 0x4A, PageUp: 0x4B, Delete: 0x4C, End: 0x4D, PageDown: 0x4E,
  ArrowRight: 0x4F, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52, NumLock: 0x53,
  NumpadDivide: 0x54, NumpadMultiply: 0x55, NumpadSubtract: 0x56, NumpadAdd: 0x57, NumpadEnter: 0x58,
  Numpad0: 0x62, NumpadDecimal: 0x63, IntlBackslash: 0x64, ContextMenu: 0x65,
  ControlLeft: 0xE0, ShiftLeft: 0xE1, AltLeft: 0xE2, MetaLeft: 0xE3,
  ControlRight: 0xE4, ShiftRight: 0xE5, AltRight: 0xE6, MetaRight: 0xE7,
};
for (let i = 0; i < 26; i++) BY_CODE['Key' + String.fromCharCode(0x41 + i)] = LETTER_A + i;
for (let i = 1; i <= 9; i++) BY_CODE['Digit' + String(i)] = DIGIT_1 + i - 1;
BY_CODE.Digit0 = DIGIT_1 + 9;
for (let i = 1; i <= 12; i++) BY_CODE['F' + String(i)] = F1 + i - 1;
for (let i = 13; i <= 24; i++) BY_CODE['F' + String(i)] = F13 + i - 13;
for (let i = 1; i <= 9; i++) BY_CODE['Numpad' + String(i)] = NUMPAD_1 + i - 1;

/** The HID usage of a KeyboardEvent.code, or undefined for a key the mouse cannot send. */
export const usageOfCode = (code: string): number | undefined => BY_CODE[code];

export const isModifier = (usage: number) => usage >= MODIFIER_FIRST && usage <= MODIFIER_LAST;

const CAPS: Record<number, string> = {
  0x2D: '-', 0x2E: '=', 0x2F: '[', 0x30: ']', 0x31: '\\', 0x33: ';', 0x34: "'", 0x35: '`', 0x36: ',', 0x37: '.', 0x38: '/',
  0x39: 'Caps Lock', 0x46: 'PrtSc', 0x47: 'Scroll Lock', 0x48: 'Pause', 0x49: 'Ins', 0x4A: 'Home', 0x4B: 'PgUp',
  0x4D: 'End', 0x4E: 'PgDn', 0x4F: '→', 0x50: '←', 0x51: '↓', 0x52: '↑', 0x53: 'Num Lock',
  0x54: 'Num /', 0x55: 'Num *', 0x56: 'Num -', 0x57: 'Num +', 0x58: 'Num Enter', 0x62: 'Num 0', 0x63: 'Num .',
  0x64: '\\', 0x65: 'Menu',
  0xE0: 'Ctrl', 0xE1: 'Shift', 0xE2: 'Alt', 0xE3: 'Win', 0xE4: 'Right Ctrl', 0xE5: 'Right Shift', 0xE6: 'Right Alt', 0xE7: 'Right Win',
};

/** What the key cap says for a usage (letters, digits, F-keys, symbols, arrows, keypad, modifiers), or null. */
export function keyCap(usage: number): string | null {
  if (usage >= LETTER_A && usage < LETTER_A + 26) return String.fromCharCode(0x41 + usage - LETTER_A);
  if (usage >= DIGIT_1 && usage < DIGIT_1 + 10) return String((usage - DIGIT_1 + 1) % 10);
  if (usage >= F1 && usage < F1 + 12) return 'F' + String(usage - F1 + 1);
  if (usage >= F13 && usage < F13 + 12) return 'F' + String(usage - F13 + 13);
  if (usage >= NUMPAD_1 && usage < NUMPAD_1 + 9) return 'Num ' + String(usage - NUMPAD_1 + 1);
  return CAPS[usage] ?? null;
}
