// The G502 X PLUS as the mouse page draws it: our own outline art (no vendor images), with every
// button where the vendor app marks it. Coordinates are in each view's art space (top view
// 1391 x 2700, side view 936 x 2700, front of the mouse at the top).

export type MouseView = 'top' | 'side';

export interface MouseHotspot {
  /** The button's name on the mouse ("G1" ...). */
  g: number;
  /** Button slot in the onboard profile. */
  slot: number;
  view: MouseView;
  x: number;
  y: number;
  /** Which side of the drawing its callout sits on, and at what height. */
  side: 'left' | 'right';
  labelY: number;
  /** Outline of the button, lit when it is selected. */
  region: string;
}

export interface MouseArtView {
  /** Art size; the canvas adds room for the callouts around it. */
  width: number;
  height: number;
  body: string;
  /** Seams and details drawn over the body. */
  details: string[];
}

export const ART: Record<MouseView, MouseArtView> = {
  top: {
    width: 1391,
    height: 2700,
    body:
      'M360 230 C470 150 640 130 800 140 C960 150 1130 190 1210 300 C1290 420 1300 700 1290 1000 ' +
      'C1280 1350 1300 1700 1260 2050 C1220 2400 1060 2610 800 2630 C560 2645 330 2520 250 2250 ' +
      'C190 2050 120 1850 110 1600 C100 1400 150 1250 210 1150 C170 1000 160 800 200 620 C230 450 270 320 360 230 Z',
    details: [
      // seam between the main buttons and the palm
      'M240 1030 C480 980 700 960 800 960 C930 960 1100 975 1290 1010',
      // palm ridge and light strip
      'M420 1500 C560 1440 1040 1440 1180 1520',
      'M600 1980 C700 1940 900 1940 1000 1980',
      // thumb rest edge
      'M210 1150 C260 1400 270 1800 300 2150',
    ],
  },
  side: {
    width: 936,
    height: 2700,
    body:
      'M180 220 C300 150 470 160 560 240 C690 360 760 700 800 1050 C840 1400 860 1750 820 2050 ' +
      'C780 2350 640 2560 420 2590 C280 2610 170 2560 130 2400 C100 2000 110 1400 120 900 C125 600 130 350 180 220 Z',
    details: [
      'M130 2380 L820 2380',
      'M150 820 C320 860 520 860 700 820',
    ],
  },
};

export const HOTSPOTS: readonly MouseHotspot[] = [
  { g: 1, slot: 0, view: 'top', x: 480, y: 450, side: 'left', labelY: 10,
    region: 'M360 230 C470 150 640 130 760 140 L760 940 C600 960 420 985 250 1010 C190 800 220 480 360 230 Z' },
  { g: 2, slot: 1, view: 'top', x: 1110, y: 450, side: 'right', labelY: 345,
    region: 'M840 142 C980 152 1130 190 1210 300 C1290 420 1300 660 1292 990 C1120 965 960 950 840 945 Z' },
  { g: 3, slot: 2, view: 'top', x: 800, y: 680, side: 'right', labelY: 10,
    region: 'M755 425 C755 400 845 400 845 425 L845 860 C845 885 755 885 755 860 Z' },
  { g: 7, slot: 6, view: 'top', x: 700, y: 680, side: 'left', labelY: 680,
    region: 'M735 600 L690 680 L735 760 Z' },
  { g: 8, slot: 7, view: 'top', x: 900, y: 680, side: 'right', labelY: 680,
    region: 'M865 600 L910 680 L865 760 Z' },
  { g: 9, slot: 8, view: 'top', x: 800, y: 1250, side: 'right', labelY: 1350,
    region: 'M740 1185 C740 1170 860 1170 860 1185 L860 1315 C860 1330 740 1330 740 1315 Z' },
  { g: 10, slot: 9, view: 'top', x: 300, y: 500, side: 'left', labelY: 345,
    region: 'M262 400 C290 385 330 395 335 420 L330 600 C325 625 285 630 262 612 Z' },
  { g: 11, slot: 10, view: 'top', x: 250, y: 950, side: 'left', labelY: 1015,
    region: 'M215 860 C240 845 280 855 285 880 L282 1035 C278 1060 238 1065 215 1048 Z' },
  { g: 5, slot: 5, view: 'side', x: 260, y: 1000, side: 'left', labelY: 1000,
    region: 'M205 900 C220 880 300 880 315 900 L320 1100 C305 1125 220 1125 205 1100 Z' },
  { g: 6, slot: 4, view: 'side', x: 500, y: 1400, side: 'left', labelY: 1400,
    region: 'M440 1320 C470 1300 540 1305 560 1330 L560 1470 C540 1500 470 1500 440 1475 Z' },
  { g: 4, slot: 3, view: 'side', x: 580, y: 1800, side: 'left', labelY: 1800,
    region: 'M500 1690 C540 1670 630 1675 655 1700 L655 1900 C630 1930 540 1930 500 1905 Z' },
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
