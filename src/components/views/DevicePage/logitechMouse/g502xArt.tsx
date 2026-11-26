import { gName } from './g502x';
import styles from './MouseIllustration.module.scss';

// The G502 X PLUS, drawn by hand for Nexus (no vendor images): matte black shell, the
// knurled wheel, glossy DPI and side buttons, ribbed rubber grip and the light strip. Generated
// from the reviewed drawings; edit the drawings, not this file, then regenerate.

/** Per-instance names for the drawing's gradients, filters and shapes. */
export interface ArtIds {
  id: (name: string) => string;
  url: (name: string) => string;
  link: (name: string) => string;
}

/** Top view, in its own units: the box is -25 -18 395 625, front at the top. */
export function TopArt({ id, url, link }: ArtIds) {
  return (
    <g className={styles.art}>
      <defs>
        <linearGradient id={id('shell')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0a0a0c"/><stop offset="0.25" stopColor="#1d1e22"/><stop offset="0.55" stopColor="#26272c"/>
          <stop offset="0.85" stopColor="#1a1b1f"/><stop offset="1" stopColor="#0c0c0e"/>
        </linearGradient>
        <linearGradient id={id('fall')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.06"/><stop offset="0.5" stopColor="#fff" stopOpacity="0"/><stop offset="1" stopColor="#000" stopOpacity="0.45"/>
        </linearGradient>
        <linearGradient id={id('lb')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b3d43"/><stop offset="0.45" stopColor="#26272c"/><stop offset="1" stopColor="#16171a"/>
        </linearGradient>
        <linearGradient id={id('rb')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f3136"/><stop offset="0.55" stopColor="#232428"/><stop offset="0.85" stopColor="#2e3035"/><stop offset="1" stopColor="#121214"/>
        </linearGradient>
        <linearGradient id={id('center')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4b4d54"/><stop offset="0.07" stopColor="#2b2c31"/><stop offset="1" stopColor="#1b1c20"/>
        </linearGradient>
        <linearGradient id={id('palm')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#26272b"/><stop offset="0.6" stopColor="#1b1c1f"/><stop offset="1" stopColor="#141417"/>
        </linearGradient>
        <linearGradient id={id('back')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e1f23"/><stop offset="0.5" stopColor="#2a2b30"/><stop offset="1" stopColor="#121214"/>
        </linearGradient>
        <linearGradient id={id('thumb')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0b0b0d"/><stop offset="1" stopColor="#1e1f23"/>
        </linearGradient>
        <linearGradient id={id('wing')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0d0d0f"/><stop offset="1" stopColor="#202125"/>
        </linearGradient>
        <linearGradient id={id('dpiKey')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2e3035"/><stop offset="0.45" stopColor="#4a4d55"/><stop offset="1" stopColor="#25272b"/>
        </linearGradient>
        <linearGradient id={id('smallKey')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5d6068"/><stop offset="1" stopColor="#34363c"/>
        </linearGradient>
        <linearGradient id={id('tire')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#060606"/><stop offset="0.3" stopColor="#2c2d31"/><stop offset="0.5" stopColor="#3e4046"/>
          <stop offset="0.72" stopColor="#232428"/><stop offset="1" stopColor="#060606"/>
        </linearGradient>
        <linearGradient id={id('rgbMain')} gradientUnits="userSpaceOnUse" x1="80" y1="400" x2="282" y2="446">
          <stop offset="0" stopColor="#9b3cff"/><stop offset="0.28" stopColor="#ff5fd2"/><stop offset="0.55" stopColor="#ffd3f0"/>
          <stop offset="0.78" stopColor="#a9e6ff"/><stop offset="1" stopColor="#63c4ff"/>
        </linearGradient>
        <linearGradient id={id('rgbUp')} gradientUnits="userSpaceOnUse" x1="278" y1="444" x2="322" y2="300">
          <stop offset="0" stopColor="#63c4ff"/><stop offset="1" stopColor="#2f5dff"/>
        </linearGradient>
        <linearGradient id={id('rgbDown')} gradientUnits="userSpaceOnUse" x1="278" y1="444" x2="296" y2="518">
          <stop offset="0" stopColor="#63c4ff"/><stop offset="1" stopColor="#2f4cff"/>
        </linearGradient>
        <filter id={id('grain')} x="0" y="0" width="1" height="1">
          <feTurbulence type="fractalNoise" baseFrequency="2.4" numOctaves="2" seed="5"/>
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .3 -.1"/>
        </filter>
        <filter id={id('b1')}><feGaussianBlur stdDeviation="1"/></filter>
        <filter id={id('b3')}><feGaussianBlur stdDeviation="3"/></filter>
        <filter id={id('b6')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
        <filter id={id('b10')} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="10"/></filter>
        <path id={id('outline')} d="M93 36 C120 28 145 21 166 15 L222 4 C246 14 268 27 284 38 C297 47 307 62 314 84 C324 118 331 160 334 210
          C337 262 336 322 335 380 C334 430 332 466 324 488 L303 508 C294 538 272 566 232 579 C192 590 140 589 110 577
          C88 567 75 549 64 522 C53 494 40 464 22 432 C10 411 4 393 5 370 C6 340 10 302 16 279 C20 263 26 253 36 246
          C37 220 40 190 46 160 C52 121 60 85 71 59 C77 47 85 39 93 36 Z"/>
        <clipPath id={id('clip')}><use href={link('outline')}/></clipPath>
      </defs>
      {/* Shadow on the desk. */}
      <ellipse cx="172" cy="560" rx="160" ry="34" fill="#000" opacity="0.75" filter={url('b10')}/>
      <use href={link('outline')} fill="#000" opacity="0.55" transform="translate(4 10)" filter={url('b10')}/>
      <use href={link('outline')} fill={url('shell')}/>
      <g clipPath={url('clip')}>
        {/* Thumb rest, ribbed. */}
        <path d="M36 246 L58 322 L82 400 C90 430 96 470 100 520 L100 600 L-20 600 L-20 240 Z" fill={url('thumb')}/>
        <g stroke="#2a2b30" strokeWidth="1.1" strokeLinecap="round" opacity="0.8">
          <line x1="8" y1="282" x2="40" y2="330"/><line x1="7" y1="296" x2="46" y2="352"/><line x1="6" y1="310" x2="52" y2="374"/>
          <line x1="6" y1="324" x2="58" y2="396"/><line x1="6" y1="338" x2="64" y2="418"/><line x1="7" y1="352" x2="70" y2="440"/>
          <line x1="8" y1="366" x2="76" y2="462"/><line x1="11" y1="382" x2="81" y2="484"/><line x1="16" y1="398" x2="85" y2="506"/>
          <line x1="22" y1="414" x2="88" y2="528"/><line x1="16" y1="270" x2="34" y2="300"/><line x1="30" y1="440" x2="90" y2="548"/>
          <line x1="40" y1="462" x2="92" y2="566"/>
        </g>
        <g stroke="#000" strokeWidth="0.8" opacity="0.6" transform="translate(1.4 0)">
          <line x1="8" y1="282" x2="40" y2="330"/><line x1="7" y1="296" x2="46" y2="352"/><line x1="6" y1="310" x2="52" y2="374"/>
          <line x1="6" y1="324" x2="58" y2="396"/><line x1="6" y1="338" x2="64" y2="418"/><line x1="7" y1="352" x2="70" y2="440"/>
          <line x1="8" y1="366" x2="76" y2="462"/><line x1="11" y1="382" x2="81" y2="484"/><line x1="16" y1="398" x2="85" y2="506"/>
          <line x1="22" y1="414" x2="88" y2="528"/>
        </g>
        {/* Back shell below the strip, with its own soft highlight. */}
        <path d="M82 400 C95 420 115 432 140 438 C175 446 215 449 250 448 C262 447 270 446 278 444 C292 430 304 400 313 365 C318 345 321 325 322 300
          L360 300 L360 600 L80 600 Z" fill={url('back')}/>
        <ellipse cx="190" cy="510" rx="70" ry="30" fill="#fff" opacity="0.05" filter={url('b10')}/>
        {/* Palm between the buttons and the strip. */}
        <path d="M58 322 L70 318 C100 308 140 296 168 288 L175 320 C190 316 212 310 230 302 L232 262 C260 255 300 243 322 236
          C328 260 326 284 322 300 C321 325 318 345 313 365 C304 400 292 430 278 444 C270 446 262 447 250 448 C215 449 175 446 140 438
          C115 432 95 420 82 400 Z" fill={url('palm')}/>
        <path d="M58 322 L82 400" fill="none" stroke="#020203" strokeWidth="2.6"/>
        <path d="M60.5 321 L84.5 399" fill="none" stroke="#fff" strokeOpacity="0.07" strokeWidth="0.9"/>
        {/* DPI wing on the left: G8 and G7 in their rim. */}
        <path d="M93 36 C85 39 77 47 71 59 C60 85 52 121 46 160 C40 190 37 220 36 246 L46 252 C60 260 68 280 70 318
          L76 230 L84 150 L92 80 Z" fill={url('wing')}/>
        <path d="M68 96 L90 94 L87 135 L56 140 C57 124 61 108 68 96 Z" fill={url('dpiKey')}/>
        <path d="M53 147 L85 143 L77 268 C72 272 66 270 62 262 C54 246 46 226 44 204 C44 182 47 162 53 147 Z" fill={url('dpiKey')}/>
        <path d="M68 96 L90 94 M53 147 L85 143" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.9"/>
        <path d="M56 140 L87 135 M52 143.5 L86 139" stroke="#030304" strokeWidth="2.4"/>
        <text x="73" y="125" fontSize="9" fill="#9a9da5" className={styles.printedMid}>{gName(8)}</text>
        <text x="69" y="166" fontSize="9" fill="#9a9da5" className={styles.printedMid}>{gName(7)}</text>
        {/* Left button. */}
        <path d="M98 36 C120 29 145 22 164 17 L168 287 C140 296 100 308 70 318 C72 260 76 200 82 140 C86 100 90 64 98 36 Z" fill={url('lb')}/>
        {/* Right button. */}
        <path d="M227 6 C250 16 271 28 286 40 C299 50 309 66 315 88 C325 126 331 176 333 232 C300 242 262 254 233 262 Z" fill={url('rb')}/>
        {/* Seams around the buttons. */}
        <path d="M98 36 C90 64 86 100 82 140 C76 200 72 260 70 318 L168 287 M233 262 C262 254 300 242 333 232" fill="none" stroke="#020203" strokeWidth="2.6" strokeLinejoin="round"/>
        <path d="M71 320.5 L168 289.5 M233 264.5 C262 256.5 300 244.5 333 234.5" fill="none" stroke="#fff" strokeOpacity="0.08" strokeWidth="0.9"/>
        {/* Centre strip: the LED, the wheel and the two small buttons. */}
        <path d="M164 16 L223 4 C226 4 228 6 228 9 L233 296 C233 302 229 306 223 308 L176 321 C171 322 168 318 168 314 L161 20 C161 18 162 17 164 16 Z" fill="#050506"/>
        <path d="M166 18 L222 7 C224 7 225 8 225 10 L230 294 C230 299 227 302 222 303 L177 316 C173 317 171 314 171 311 L164 21 Z" fill={url('center')}/>
        <rect x="181" y="56" width="30" height="10" rx="5" fill="#2bff72" opacity="0.8" filter={url('b3')}/>
        <rect x="183" y="58" width="26" height="6" rx="3" fill="#a6ffc8"/>
        <rect x="175" y="95" width="45" height="98" rx="10" fill="#020202"/>
        <rect x="181" y="100" width="33" height="88" rx="7" fill={url('tire')}/>
        <g stroke="#000" strokeWidth="1.6" opacity="0.85">
          <path d="M182 108 L213 113 M182 114 L213 119 M182 120 L213 125 M182 126 L213 131 M182 132 L213 137 M182 138 L213 143
                   M182 144 L213 149 M182 150 L213 155 M182 156 L213 161 M182 162 L213 167 M182 168 L213 173 M182 174 L213 179 M182 180 L213 185"/>
        </g>
        <rect x="182" y="102" width="3" height="84" rx="1.5" fill="#c9ced6" opacity="0.55"/>
        <rect x="210" y="102" width="3" height="84" rx="1.5" fill="#c9ced6" opacity="0.35"/>
        <rect x="188" y="102" width="8" height="84" rx="4" fill="#fff" opacity="0.1" filter={url('b1')}/>
        <path d="M157 140 L151 146 L157 152 M238 139 L244 145 L238 151" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="1.2" strokeLinecap="round"/>
        <rect x="184" y="203" width="29" height="89" rx="7" fill="#020202"/>
        <rect x="187" y="207" width="23" height="32" rx="4" fill={url('smallKey')}/>
        <circle cx="198.5" cy="222" r="6" fill="none" stroke="#a8abb3" strokeWidth="1.4"/>
        <rect x="187" y="251" width="23" height="32" rx="4" fill={url('smallKey')}/>
        <text x="198.5" y="271" fontSize="9" fill="#a8abb3" className={styles.printedMid}>{gName(9)}</text>
        {/* The light strip: bloom, tube, hot core; a Y on the right, one arm up to the edge, one down the back. */}
        <g fill="none" strokeLinecap="round">
          <path d="M82 400 C95 420 115 432 140 438 C175 446 215 449 250 448 C262 447 270 446 278 444" stroke={url('rgbMain')} strokeWidth="26" opacity="0.45" className={styles.bloom} filter={url('b10')}/>
          <path d="M278 444 C292 430 304 400 313 365 C318 345 321 325 322 300" stroke={url('rgbUp')} strokeWidth="22" opacity="0.45" className={styles.bloom} filter={url('b10')}/>
          <path d="M278 444 C286 460 292 480 296 516" stroke={url('rgbDown')} strokeWidth="20" opacity="0.4" className={styles.bloom} filter={url('b10')}/>
          <path d="M82 400 C95 420 115 432 140 438 C175 446 215 449 250 448 C262 447 270 446 278 444" stroke={url('rgbMain')} strokeWidth="12" opacity="0.55" filter={url('b1')}/>
          <path d="M278 444 C292 430 304 400 313 365 C318 345 321 325 322 300" stroke={url('rgbUp')} strokeWidth="11" opacity="0.55" filter={url('b1')}/>
          <path d="M278 444 C286 460 292 480 296 516" stroke={url('rgbDown')} strokeWidth="10" opacity="0.5" filter={url('b1')}/>
          <path d="M82 400 C95 420 115 432 140 438 C175 446 215 449 250 448 C262 447 270 446 278 444" stroke={url('rgbMain')} strokeWidth="8"/>
          <path d="M278 444 C292 430 304 400 313 365 C318 345 321 325 322 300" stroke={url('rgbUp')} strokeWidth="7"/>
          <path d="M278 444 C286 460 292 480 296 516" stroke={url('rgbDown')} strokeWidth="6.5"/>
          <path d="M90 410 C105 426 120 434 140 438 C175 446 215 449 250 448" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.4" filter={url('b1')}/>
        </g>
        {/* Glow of the strip on the palm. */}
        <path d="M90 408 C120 430 200 446 270 440" fill="none" stroke={url('rgbMain')} strokeWidth="40" opacity="0.10" className={styles.bloom} filter={url('b10')} transform="translate(0 -18)"/>
        {/* Studio highlights. */}
        <path d="M104 44 C125 36 145 29 160 25" stroke="#fff" strokeOpacity="0.3" strokeWidth="2.4" strokeLinecap="round" fill="none" filter={url('b1')}/>
        <path d="M232 14 C252 22 270 32 282 42" stroke="#fff" strokeOpacity="0.22" strokeWidth="2.4" strokeLinecap="round" fill="none" filter={url('b1')}/>
        <path d="M100 70 C96 120 92 180 88 240" stroke="#fff" strokeOpacity="0.09" strokeWidth="16" strokeLinecap="round" fill="none" filter={url('b6')}/>
        <path d="M300 80 C312 130 318 180 320 225" stroke="#fff" strokeOpacity="0.1" strokeWidth="10" strokeLinecap="round" fill="none" filter={url('b6')}/>
        <path d="M80 330 C140 312 230 296 310 268" stroke="#fff" strokeOpacity="0.06" strokeWidth="14" strokeLinecap="round" fill="none" filter={url('b6')}/>
        <use href={link('outline')} fill={url('fall')}/>
        <rect x="-25" y="-18" width="395" height="625" filter={url('grain')} opacity="0.45"/>
      </g>
      {/* Rim light: a thin edge, cool on the right where the strip lights it. */}
      <use href={link('outline')} fill="none" stroke="#fff" strokeOpacity="0.12" strokeWidth="1.1"/>
      <path d="M326 140 C331 180 334 210 334 240 C336 290 336 330 335 380 C334 430 332 466 324 488" fill="none" stroke="#5aa8ff" strokeOpacity="0.55" strokeWidth="2.4" filter={url('b1')}/>
    </g>
  );
}

/** Left side, in its own units: the box is 100 300 920 400, front on the left. */
export function SideArt({ id, url, link }: ArtIds) {
  return (
    <g className={styles.art}>
      <defs>
        <linearGradient id={id('mat')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3c3e44"/><stop offset="0.45" stopColor="#28292e"/><stop offset="1" stopColor="#18191c"/>
        </linearGradient>
        <linearGradient id={id('gpanel')} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#3a3c42"/><stop offset="0.6" stopColor="#26272c"/><stop offset="1" stopColor="#1b1c20"/>
        </linearGradient>
        <linearGradient id={id('rear')} x1="0" y1="0" x2="1" y2="0.9">
          <stop offset="0" stopColor="#36383e"/><stop offset="0.35" stopColor="#25262b"/><stop offset="0.75" stopColor="#151619"/><stop offset="1" stopColor="#0a0a0c"/>
        </linearGradient>
        <linearGradient id={id('under')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a1b1e"/><stop offset="1" stopColor="#060607"/>
        </linearGradient>
        <linearGradient id={id('lower')} x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#34363b"/><stop offset="0.45" stopColor="#202125"/><stop offset="1" stopColor="#0c0c0e"/>
        </linearGradient>
        <linearGradient id={id('band')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c2e33"/><stop offset="0.25" stopColor="#0d0d0f"/><stop offset="1" stopColor="#040405"/>
        </linearGradient>
        <linearGradient id={id('bevel')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4d54"/><stop offset="0.4" stopColor="#26272c"/><stop offset="1" stopColor="#141517"/>
        </linearGradient>
        <linearGradient id={id('key')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f3136"/><stop offset="0.5" stopColor="#18191c"/><stop offset="1" stopColor="#0e0e10"/>
        </linearGradient>
        <linearGradient id={id('snFace')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#43464d"/><stop offset="0.5" stopColor="#2a2b30"/><stop offset="1" stopColor="#16171a"/>
        </linearGradient>
        <linearGradient id={id('ribShade')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.65"/><stop offset="0.5" stopColor="#000" stopOpacity="0.05"/><stop offset="1" stopColor="#000" stopOpacity="0.45"/>
        </linearGradient>
        <linearGradient id={id('railHi')} gradientUnits="userSpaceOnUse" x1="345" y1="0" x2="607" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.15"/><stop offset="0.55" stopColor="#fff" stopOpacity="0.7"/><stop offset="0.9" stopColor="#fff" stopOpacity="0.85"/><stop offset="1" stopColor="#fff" stopOpacity="0.3"/>
        </linearGradient>
        <radialGradient id={id('disc')} cx="0.42" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#6b6f78"/><stop offset="0.45" stopColor="#3a3c42"/><stop offset="1" stopColor="#141517"/>
        </radialGradient>
        <pattern id={id('ribs')} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-27)">
          <rect width="6" height="6" fill="#18191c"/>
          <rect x="0" width="1.8" height="6" fill="#2d2f34"/>
          <rect x="1.8" width="1.1" height="6" fill="#08080a"/>
        </pattern>
        <filter id={id('grain')} x="0" y="0" width="1" height="1">
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="11"/>
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .28 -.1"/>
        </filter>
        <filter id={id('b1')}><feGaussianBlur stdDeviation="0.8"/></filter>
        <filter id={id('b3')}><feGaussianBlur stdDeviation="3"/></filter>
        <filter id={id('b6')} x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="6"/></filter>
        <filter id={id('b14')} x="-40%" y="-200%" width="180%" height="500%"><feGaussianBlur stdDeviation="12"/></filter>
        <path id={id('side')} d="M122 517 L190 467 C222 446 252 430 280 418 C288 392 312 362 350 357 C376 354 398 359 410 366
          L438 340 L444 327 L505 322 L507 323 L548 320 L552 327 C620 323 700 328 760 340 C775 343 784 347 788 353 L800 359
          C840 368 880 390 912 422 C950 460 982 505 996 542 C1000 556 994 566 978 574 C962 588 935 598 905 606
          C870 616 840 632 812 652 C800 660 785 666 765 669 L505 669 C440 660 380 640 330 620 C290 605 250 588 215 570
          C195 560 175 550 152 538 L168 527 L124 520 Z"/>
        <clipPath id={id('clip')}><use href={link('side')}/></clipPath>
      </defs>
      <use href={link('side')} fill="#000" opacity="0.6" filter={url('b14')}/>
      <use href={link('side')} fill="#0b0b0d"/>
      <g clipPath={url('clip')}>
        {/* Wheel: knurled tire and the metal disc on its side. */}
        <circle cx="367" cy="447" r="92" fill="#08080a"/>
        <circle cx="367" cy="447" r="87" fill="none" stroke="#2b2c31" strokeWidth="9" strokeDasharray="2.2 2.4"/>
        <circle cx="367" cy="447" r="78" fill={url('disc')}/>
        <path d="M312 392 C330 374 356 366 382 368" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" fill="none" strokeLinecap="round"/>
        {/* Left button, seen from the side. */}
        <path d="M122 517 L190 467 C222 446 252 430 280 418 L410 366 L438 340 L444 327 L505 322 L507 323 L548 320 L552 327
          C575 350 595 378 610 404 L400 416 C360 420 330 426 300 436 C240 456 180 486 128 512 Z" fill={url('mat')}/>
        {/* Palm top panel. */}
        <path d="M552 327 C620 323 700 328 760 340 C775 343 784 347 788 353 C790 366 790 378 786 388 L610 404 C595 378 575 350 552 327 Z" fill={url('gpanel')}/>
        <path d="M552 327 C575 350 595 378 610 404" stroke="#030304" strokeWidth="2.6" fill="none"/>
        <path d="M555 326 C578 349 598 377 613 403" stroke="#fff" strokeOpacity="0.12" strokeWidth="1" fill="none"/>
        {/* Rear shell and its underside. */}
        <path d="M800 359 C840 368 880 390 912 422 C950 460 982 505 996 542 C1000 556 994 566 978 574 C940 584 880 582 840 578
          C826 577 814 574 808 570 C809 530 809 490 805 455 C802 420 800 390 800 359 Z" fill={url('rear')}/>
        <path d="M808 570 C814 574 826 577 840 578 C880 582 940 584 978 574 C962 588 935 598 905 606 C870 616 840 632 812 652
          L792 662 C802 645 808 625 808 600 Z" fill={url('under')}/>
        <path d="M818 573 C860 580 930 583 976 573" stroke="#fff" strokeOpacity="0.22" strokeWidth="1.6" fill="none" filter={url('b1')}/>
        <path d="M822 374 C880 400 940 452 978 512" stroke="#fff" strokeOpacity="0.12" strokeWidth="9" strokeLinecap="round" fill="none" filter={url('b3')}/>
        {/* Glossy black band along the left button, nose to palm. */}
        <path d="M128 512 C180 486 240 456 300 436 C330 426 360 420 400 416 L610 404 L785 389 C790 388 793 390 794 394
          C797 415 797 440 792 456 C780 466 766 470 756 466 L748 440 L745 421 C600 432 450 448 340 465 C270 478 200 500 140 523 Z" fill={url('band')}/>
        {/* Its highlights: the blade at the nose, the long rail, the slot edge. */}
        <path d="M182 505 C228 483 280 466 330 452" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.2" strokeLinecap="round" fill="none" filter={url('b1')}/>
        <path d="M345 437 C430 425 520 412 607 404 L606 407.5 C520 416 430 429 346 441 Z" fill={url('railHi')}/>
        <path d="M360 446 C440 435 520 424 600 416" stroke="#fff" strokeOpacity="0.08" strokeWidth="12" strokeLinecap="round" fill="none" filter={url('b3')}/><path d="M300 438 C380 424 480 414 600 406" stroke="#fff" strokeOpacity="0.05" strokeWidth="16" strokeLinecap="round" fill="none" filter={url('b6')}/>
        <path d="M336 437 L342 464" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.2"/>
        <path d="M612 404 L784 390" stroke="#fff" strokeOpacity="0.14" strokeWidth="1.2"/>
        {/* Lower front panel under the nose, with its chamfers. */}
        <path d="M140 523 C200 500 270 478 340 465 L405 520 L396 555 L440 621 L470 664 L505 669 C440 660 380 640 330 620
          C290 605 250 588 215 570 C195 560 175 550 152 538 L168 527 Z" fill={url('lower')}/>
        <path d="M206 526 C250 512 300 498 350 490" stroke="#fff" strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round" fill="none" filter={url('b1')}/>
        <path d="M166 542 C200 566 250 595 296 616" stroke="#000" strokeOpacity="0.7" strokeWidth="2" fill="none"/>
        <path d="M168 539 C202 563 252 592 298 613" stroke="#fff" strokeOpacity="0.08" strokeWidth="1" fill="none"/>
        {/* Recess for the side buttons, and the bevel under it. */}
        <path d="M340 465 C450 448 600 432 745 421 C750 428 750 440 746 450 L740 470 L486 517 L455 520 L405 520 Z" fill="#030304"/>
        <path d="M345 465 C450 451 600 434 745 421" stroke="#c9cdd5" strokeOpacity="0.5" strokeWidth="1.2" fill="none"/>
        <path d="M486 517 L740 470 C750 468 760 462 766 456 L796 458 C790 474 778 486 760 490 C680 500 560 516 486 527 Z" fill={url('bevel')}/>
        {/* Ribbed thumb rest. */}
        <path d="M486 527 C560 516 680 500 760 490 C778 486 790 474 796 458 C803 500 808 560 808 600 C808 625 802 645 792 660
          L765 669 L505 669 L470 664 L440 621 L530 610 L485 542 Z" fill={url('ribs')}/>
        <path d="M486 527 C560 516 680 500 760 490 C778 486 790 474 796 458 C803 500 808 560 808 600 C808 625 802 645 792 660
          L765 669 L505 669 L470 664 L440 621 L530 610 L485 542 Z" fill={url('ribShade')}/>
        <path d="M488 528 C560 518 680 502 760 492" stroke="#fff" strokeOpacity="0.12" strokeWidth="1" fill="none"/>
        {/* Foot along the bottom. */}
        <path d="M512 664 L752 664" stroke="#3a3c42" strokeWidth="2.2" strokeLinecap="round"/>
        {/* Green onboard LED at the nose. */}
        <ellipse cx="214" cy="458" rx="16" ry="5" fill="#2bff72" opacity="0.8" filter={url('b3')} transform="rotate(-32 214 458)"/>
        <ellipse cx="214" cy="458" rx="8" ry="1.8" fill="#c4ffd9" transform="rotate(-32 214 458)"/>
        {/* Highlights on the top edge. */}
        <path d="M132 511 C180 478 230 448 280 420" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.6" fill="none" filter={url('b1')}/>
        <path d="M560 328 C640 325 720 331 778 346" stroke="#fff" strokeOpacity="0.22" strokeWidth="3" strokeLinecap="round" fill="none" filter={url('b1')}/>
        <path d="M420 372 C470 356 520 346 560 340" stroke="#fff" strokeOpacity="0.1" strokeWidth="12" strokeLinecap="round" fill="none" filter={url('b3')}/>
        <rect x="100" y="300" width="920" height="400" filter={url('grain')} opacity="0.4"/>
      </g>
      {/* Scroll mode and G9 buttons on the top strip, seen side-on. */}
      <path d="M437 343 L444 327 L503 322 L506 335 Z" fill="#141518" stroke="#000" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M445 328 L502 323" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.2"/>
      <path d="M508 334 L509 323 L547 320 L550 330 Z" fill="#141518" stroke="#000" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M510 323.5 L546 321" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.2"/>
      {/* G5 (forward) and G4 (back). */}
      <path d="M486 483 L596 466 L598 497 L489 513 Z" fill={url('key')} stroke="#000" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M487 483 L595 466" stroke="#b9bdc5" strokeOpacity="0.75" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M490 512 L597 496" stroke="#fff" strokeOpacity="0.12" strokeWidth="1"/>
      <path d="M622 462 L742 443 L744 465 L624 482 Z" fill={url('key')} stroke="#000" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M623 462 L741 443" stroke="#b9bdc5" strokeOpacity="0.75" strokeWidth="1.3" strokeLinecap="round"/>
      <text x="566" y="490" fontSize="10" fill="#8a8d95" transform="rotate(-9 566 490)" className={styles.printed}>{gName(5)}</text>
      <text x="632" y="476" fontSize="10" fill="#8a8d95" transform="rotate(-9 632 476)" className={styles.printed}>{gName(4)}</text>
      {/* G6, the sniper button. */}
      <path d="M400 517 L455 520 L490 512 L485 542 L396 555 Z" fill="#0a0a0c"/>
      <path d="M396 555 L485 542 L530 610 L440 621 Z" fill="#000" opacity="0.6" transform="translate(3 5)" filter={url('b3')}/>
      <path d="M396 555 L485 542 L530 610 L440 621 Z" fill={url('snFace')} stroke="#050506" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M398 555 L484 543" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.3"/>
      <g transform="translate(447 585)" fill="none" stroke="#8a8d95" strokeWidth="1.8" strokeLinecap="round">
        <circle r="7.5"/><path d="M0 -12 V-4 M0 4 V12 M-12 0 H-4 M4 0 H12"/>
      </g>
      {/* Rim light around the whole mouse. */}
      <use href={link('side')} fill="none" stroke="#fff" strokeOpacity="0.12" strokeWidth="1.2"/>
    </g>
  );
}
