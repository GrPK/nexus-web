// The G502 X PLUS as the mouse page draws it: our own hand-made drawings (g502xArt.tsx, no vendor
// images), with every button's outline and marker in the drawing's units. The top view stands
// front up; the side view is drawn front left and turned to stand on its nose, like the vendor
// app's.

export type MouseView = 'top' | 'side';

export interface MouseHotspot {
  /** The button's name, as printed on the mouse ("G1" ...). */
  g: number;
  /** Button slot in the onboard profile. */
  slot: number;
  view: MouseView;
  /** Where its marker sits, in the drawing's units. */
  x: number;
  y: number;
  /** Which side of the view its callout sits on, and at what height (in the view's units). */
  side: 'left' | 'right';
  labelY: number;
  /** Outline of the button in the drawing's units, lit when it is hovered or selected. */
  region: string;
}

export interface MouseArtView {
  /** The drawing's box in the view's units (after `transform`). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Turns the drawing's units into the view's; none for the top view. */
  transform?: string;
  /** The same turn for a single point. */
  place: (x: number, y: number) => [number, number];
}

// The side view turns a quarter clockwise around the drawing's box (100 300 920 400): front up,
// the top of the mouse to the right.
const SIDE_RIGHT = 700;
const SIDE_LEFT = 100;

export const ART: Record<MouseView, MouseArtView> = {
  top: { x: -25, y: -18, width: 395, height: 625, place: (x, y) => [x, y] },
  side: {
    x: 0,
    y: 0,
    width: 400,
    height: 920,
    transform: `matrix(0 1 -1 0 ${SIDE_RIGHT} ${-SIDE_LEFT})`,
    place: (x, y) => [SIDE_RIGHT - y, x - SIDE_LEFT],
  },
};

export const HOTSPOTS: readonly MouseHotspot[] = [
  { g: 1, slot: 0, view: 'top', x: 128, y: 82, side: 'left', labelY: 20,
    region: 'M98 36 C120 29 145 22 164 17 L168 287 C140 296 100 308 70 318 C72 260 76 200 82 140 C86 100 90 64 98 36 Z' },
  { g: 2, slot: 1, view: 'top', x: 284, y: 130, side: 'right', labelY: 20,
    region: 'M227 6 C250 16 271 28 286 40 C299 50 309 66 315 88 C325 126 331 176 333 232 C300 242 262 254 233 262 Z' },
  { g: 3, slot: 2, view: 'top', x: 197.5, y: 144, side: 'right', labelY: 100,
    region: 'M181 108 Q181 100 189 100 L206 100 Q214 100 214 108 L214 180 Q214 188 206 188 L189 188 Q181 188 181 180 Z' },
  // Wheel tilt left and right.
  { g: 10, slot: 6, view: 'top', x: 155, y: 146, side: 'left', labelY: 175,
    region: 'M163 131 L145 146 L163 161 Z' },
  { g: 11, slot: 7, view: 'top', x: 241, y: 145, side: 'right', labelY: 175,
    region: 'M233 130 L251 145 L233 160 Z' },
  // Profile switch, behind the wheel.
  { g: 9, slot: 8, view: 'top', x: 198.5, y: 267, side: 'right', labelY: 255,
    region: 'M187 255 Q187 251 191 251 L206 251 Q210 251 210 255 L210 279 Q210 283 206 283 L191 283 Q187 283 187 279 Z' },
  // DPI up (front) and down, on the left wing.
  { g: 8, slot: 9, view: 'top', x: 74, y: 117, side: 'left', labelY: 100,
    region: 'M68 96 L90 94 L87 135 L56 140 C57 124 61 108 68 96 Z' },
  { g: 7, slot: 10, view: 'top', x: 64, y: 205, side: 'left', labelY: 250,
    region: 'M53 147 L85 143 L77 268 C72 272 66 270 62 262 C54 246 46 226 44 204 C44 182 47 162 53 147 Z' },
  // Side buttons and the sniper button, in the side drawing (front left).
  { g: 6, slot: 4, view: 'side', x: 463, y: 582, side: 'left', labelY: 345,
    region: 'M396 555 L485 542 L530 610 L440 621 Z' },
  { g: 5, slot: 5, view: 'side', x: 541, y: 490, side: 'left', labelY: 448,
    region: 'M486 483 L596 466 L598 497 L489 513 Z' },
  { g: 4, slot: 3, view: 'side', x: 683, y: 463, side: 'left', labelY: 585,
    region: 'M622 462 L742 443 L744 465 L624 482 Z' },
];

/** Factory bindings per slot, for "Reset to default". */
export const FACTORY: Record<number, { kind: 'mouse' | 'special'; code: number }> = {
  0: { kind: 'mouse', code: 0x01 },
  1: { kind: 'mouse', code: 0x02 },
  2: { kind: 'mouse', code: 0x04 },
  3: { kind: 'mouse', code: 0x08 },
  4: { kind: 'special', code: 7 },
  5: { kind: 'mouse', code: 0x10 },
  6: { kind: 'special', code: 1 },
  7: { kind: 'special', code: 2 },
  8: { kind: 'special', code: 10 },
  9: { kind: 'special', code: 3 },
  10: { kind: 'special', code: 4 },
};

/** The button's printed name. */
export const gName = (g: number) => 'G' + String(g);
