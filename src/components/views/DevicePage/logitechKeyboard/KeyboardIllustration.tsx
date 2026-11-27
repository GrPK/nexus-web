import { useId, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Joystick, Sun } from 'lucide-react';
import { ACTION_MIME } from '../logitechMouse/MouseIllustration';
import { ART, CASE, KEYS, type KeyboardLayout } from './g915x';
import { fit, fontFor, legendOf, type KeyboardIllustrationProps } from './keyCaps';
import styles from './KeyboardIllustration.module.scss';

export { legendOf, type KeyFace } from './keyCaps';

// The media keys' own legends, drawn in the keys' lighting, by consumer usage.
const MEDIA_LEGEND: Record<number, (cx: number, cy: number) => ReactNode> = {
  0xB6: (cx, cy) => <path d={`M${cx - 11} ${cy - 7}V${cy + 7}M${cx - 8} ${cy}L${cx} ${cy - 7}V${cy + 7}ZM${cx} ${cy}L${cx + 8} ${cy - 7}V${cy + 7}Z`} />,
  0xCD: (cx, cy) => <path d={`M${cx - 10} ${cy - 7}L${cx - 1} ${cy}L${cx - 10} ${cy + 7}ZM${cx + 3} ${cy - 7}V${cy + 7}M${cx + 8} ${cy - 7}V${cy + 7}`} />,
  0xB5: (cx, cy) => <path d={`M${cx - 8} ${cy - 7}L${cx} ${cy}L${cx - 8} ${cy + 7}ZM${cx} ${cy - 7}L${cx + 8} ${cy}L${cx} ${cy + 7}ZM${cx + 11} ${cy - 7}V${cy + 7}`} />,
  0xE2: (cx, cy) => <path d={`M${cx - 11} ${cy - 4}H${cx - 6}L${cx} ${cy - 9}V${cy + 9}L${cx - 6} ${cy + 4}H${cx - 11}ZM${cx + 4} ${cy - 5}L${cx + 12} ${cy + 5}M${cx + 12} ${cy - 5}L${cx + 4} ${cy + 5}`} />,
};
// The shifted symbol printed beside a number or a symbol, by HID usage (US caps).
const SHIFTED: Record<number, string> = {
  0x1E: '!', 0x1F: '@', 0x20: '#', 0x21: '$', 0x22: '%', 0x23: '^', 0x24: '&', 0x25: '*', 0x26: '(', 0x27: ')',
  0x2D: '_', 0x2E: '+', 0x2F: '{', 0x30: '}', 0x31: '|', 0x32: '~', 0x33: ':', 0x34: '"', 0x35: '~', 0x36: '<', 0x37: '>', 0x38: '?',
};
// Where the ISO (UK) caps print another shifted symbol.
const SHIFTED_ISO: Record<number, string> = { 0x1F: '"', 0x20: '£', 0x34: '@', 0x35: '¬' };
// The navigation legend under a number-pad digit.
const NUMPAD_SUB: Record<number, string> = {
  0x59: 'End', 0x5A: '↓', 0x5B: 'PgDn', 0x5C: '←', 0x5E: '→', 0x5F: 'Home', 0x60: '↑', 0x61: 'PgUp', 0x62: 'Ins', 0x63: 'Del',
};
// The markings above the lock lights, as printed on the case.
const CAPS_LOCK = 'CAPS LOCK';
const NUM_LOCK = 'NUM LOCK';
const LOCK_LIGHTS: readonly { x: number; text: string }[] = [{ x: 1166, text: CAPS_LOCK }, { x: 1247, text: NUM_LOCK }];
// The plate: drawn a little shorter than the case box, the case's front edge under it.
const PLATE_H = 640;
const PLATE_R = 12;
// Room around the case, in drawing units.
const PAD = 16;
const CAP_RADIUS = 9;
const FACE_INSET = 3;
// The top face sits higher than the cap's bottom edge, so the cap reads as raised.
const FACE_LIP = 10;
// Keys taller than this (Enter, the number pad's + and Enter) get a shading made for their height.
const TALL = 120;
// The sweep across the keys when a layer opens, in ms per drawing unit from the left.
const SWEEP_MS_PER_UNIT = 0.18;
// The knurl on the volume roller, in drawing units.
const KNURL_STEP = 5;
const SUB_FONT = 15;

const shiftedOf = (usage: number | undefined, layout: KeyboardLayout) =>
  usage === undefined ? undefined : (layout === 'iso' ? SHIFTED_ISO[usage] : undefined) ?? SHIFTED[usage];

/**
 * The keyboard, drawn by hand for Nexus after the G915 X: a carbon brushed-aluminium plate with a
 * chamfered edge, low-profile black caps whose legends glow in a rainbow like the keyboard's own
 * lighting (and spill it round the keys), round G and media keys, the game-mode and brightness
 * buttons, the lock lights and the knurled metal volume roller. A key lifts on hover; the selected
 * key rings and breathes; an assigned key fills with the accent colour and shows its new action,
 * its own legend in the corner; a changed key pops with a ripple; opening a layer sweeps the keys
 * in. Actions from the library drop onto keys.
 */
export function KeyboardIllustration(props: KeyboardIllustrationProps & { inactive?: boolean }) {
  const { layout, keyOf, face, selectedKey, flashKey, layerKey, ariaLabel, keyAria, onSelect, onDropAction, inactive = false } = props;
  const [hover, setHover] = useState<number | null>(null);
  const [dropOver, setDropOver] = useState<number | null>(null);
  const uid = useId().replace(/:/g, '');
  const id = (name: string) => `kb-${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;
  const shapes = KEYS.filter(k => (!k.layout || k.layout === layout) && keyOf(k.cid) !== undefined);
  const top = CASE.body.y - PAD;
  const width = ART.width + 2 * PAD;
  const height = ART.height - CASE.body.y + 2 * PAD + 20;
  const B = CASE.body;
  const R = CASE.roller;
  const G = CASE.gameMode;

  const dragProps = (key: number) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(ACTION_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDropOver(key);
    },
    onDragLeave: () => setDropOver(prev => (prev === key ? null : prev)),
    onDrop: (e: DragEvent) => {
      const value = e.dataTransfer.getData(ACTION_MIME);
      setDropOver(null);
      if (!value) return;
      e.preventDefault();
      onDropAction(key, value);
    },
  });

  return (
    <div className={`${styles.canvas} ${inactive ? styles.inactive : ''}`} style={{ aspectRatio: `${width} / ${height}` }} role="group" aria-label={ariaLabel} aria-disabled={inactive || undefined}>
      <svg className={styles.svg} viewBox={`${-PAD} ${top} ${width} ${height}`}>
        <defs>
          <linearGradient id={id('plate')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#43464c" /><stop offset="0.12" stopColor="#383b40" />
            <stop offset="0.6" stopColor="#303237" /><stop offset="1" stopColor="#28292d" />
          </linearGradient>
          <linearGradient id={id('sheen')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="0.3" stopColor="#fff" stopOpacity="0.05" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0.11" /><stop offset="0.8" stopColor="#fff" stopOpacity="0.03" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={id('face')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a2b30" /><stop offset="0.35" stopColor="#1c1d21" /><stop offset="1" stopColor="#141518" />
          </linearGradient>
          <linearGradient id={id('faceTall')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a2b30" /><stop offset="0.2" stopColor="#1e1f23" /><stop offset="1" stopColor="#18191c" />
          </linearGradient>
          <linearGradient id={id('skirt')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0d0d10" /><stop offset="1" stopColor="#030304" />
          </linearGradient>
          <radialGradient id={id('round')} cx="0.4" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#2c2d32" /><stop offset="0.6" stopColor="#16171a" /><stop offset="1" stopColor="#060607" />
          </radialGradient>
          <linearGradient id={id('rgb')} gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="2010" y2="0">
            <stop offset="0" stopColor="#2f8cff" /><stop offset="0.1" stopColor="#38c6ff" /><stop offset="0.22" stopColor="#2fe08a" />
            <stop offset="0.36" stopColor="#b6f03c" /><stop offset="0.47" stopColor="#ffd23c" /><stop offset="0.56" stopColor="#ff9b3d" />
            <stop offset="0.64" stopColor="#ff5f8a" /><stop offset="0.72" stopColor="#ff3fd2" /><stop offset="0.84" stopColor="#c44dff" />
            <stop offset="1" stopColor="#6a6bff" />
          </linearGradient>
          <linearGradient id={id('chrome')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5d6269" /><stop offset="0.28" stopColor="#e9edf2" /><stop offset="0.5" stopColor="#a7adb5" />
            <stop offset="0.75" stopColor="#4c5057" /><stop offset="1" stopColor="#1f2125" />
          </linearGradient>
          <filter id={id('brushed')} x="0" y="0" width="1" height="1">
            <feTurbulence type="fractalNoise" baseFrequency="0.0012 0.9" numOctaves="2" seed="4" />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 -0.2" />
          </filter>
          <filter id={id('soft')} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id={id('shadow')} x="-10%" y="-10%" width="120%" height="130%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id={id('under')} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id={id('glow')} x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={id('capShadow')} x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="5" stdDeviation="3.5" floodColor="#000" floodOpacity="0.7" />
          </filter>
          <clipPath id={id('plateClip')}>
            <rect x={B.x} y={B.y} width={B.w} height={PLATE_H} rx={PLATE_R} />
          </clipPath>
        </defs>

        {/* The case: shadow on the desk, front edge, the brushed plate with its chamfer. */}
        <rect x={B.x + 22} y={B.y + 62} width={B.w - 44} height={PLATE_H - 40} rx={20} fill="#000" opacity={0.75} filter={url('shadow')} transform="translate(0 14)" />
        <rect x={B.x} y={B.y + 8} width={B.w} height={B.h - 6} rx={PLATE_R} fill="#17181b" />
        <rect x={B.x} y={B.y + PLATE_H + 2} width={B.w} height={10} rx={5} fill="#0c0c0e" />
        <rect x={B.x} y={B.y} width={B.w} height={PLATE_H} rx={PLATE_R} fill={url('plate')} />
        <g clipPath={url('plateClip')} pointerEvents="none">
          <rect x={B.x} y={B.y} width={B.w} height={PLATE_H} filter={url('brushed')} opacity={0.28} />
          <rect x={B.x} y={B.y} width={B.w} height={PLATE_H} fill={url('sheen')} />
          <rect x={B.x} y={B.y} width={B.w} height={PLATE_H} rx={PLATE_R} className={styles.chamfer} filter={url('soft')} />
          <path className={styles.catchLight} d={`M${B.x + 12} ${B.y + 2.5}H${B.x + B.w - 12}`} />
        </g>
        <rect x={B.x} y={B.y} width={B.w} height={PLATE_H} rx={PLATE_R} className={styles.outline} />

        {/* Game mode and brightness, the lock lights, the volume roller. */}
        {[{ cx: G.cx + 7, icon: <Joystick />, cls: styles.fixedIcon }, { cx: G.cx + 83, icon: <Sun />, cls: styles.sunIcon }].map(b => (
          <g key={b.cx} pointerEvents="none">
            <circle cx={b.cx} cy={G.cy} r={G.r + 1} fill="#000" opacity={0.6} filter={url('soft')} transform="translate(0 4)" />
            <circle cx={b.cx} cy={G.cy} r={G.r - 1} fill={url('round')} className={styles.roundEdge} />
            <circle cx={b.cx} cy={G.cy} r={G.r - 3} className={styles.rim} />
            <svg className={b.cls} x={b.cx - 13} y={G.cy - 13} width={26} height={26} viewBox="0 0 24 24">{b.icon}</svg>
          </g>
        ))}
        {LOCK_LIGHTS.map(l => (
          <g key={l.x} pointerEvents="none">
            <text className={styles.lockText} x={l.x} y={B.y + 43}>{l.text}</text>
            <circle className={styles.lockDot} cx={l.x} cy={B.y + 67} r={3.4} />
          </g>
        ))}
        <g pointerEvents="none">
          <path d={`M${R.x - 14} ${B.y}H${R.x + R.w - 18}V${B.y + 70}Q${R.x + R.w - 18} ${B.y + 92} ${R.x + R.w - 40} ${B.y + 92}H${R.x + 8}Q${R.x - 14} ${B.y + 92} ${R.x - 14} ${B.y + 70}Z`}
            fill="#000" opacity={0.6} filter={url('soft')} transform="translate(0 5)" />
          <path d={`M${R.x - 14} ${B.y}H${R.x + R.w - 18}V${B.y + 70}Q${R.x + R.w - 18} ${B.y + 92} ${R.x + R.w - 40} ${B.y + 92}H${R.x + 8}Q${R.x - 14} ${B.y + 92} ${R.x - 14} ${B.y + 70}Z`}
            className={styles.housing} />
          <rect x={R.x + 12} y={B.y + 10} width={234} height={50} rx={7} className={styles.well} />
          <rect x={R.x + 18} y={B.y + 13} width={222} height={44} rx={5} fill={url('chrome')} />
          {Array.from({ length: Math.floor(218 / KNURL_STEP) }, (_, i) => R.x + 22 + i * KNURL_STEP).map(x => (
            <line key={x} className={styles.knurl} x1={x} x2={x} y1={B.y + 14} y2={B.y + 56} />
          ))}
          <rect x={R.x + 18} y={B.y + 20} width={222} height={5} className={styles.rollerLight} />
        </g>

        {/* Light from every key spilling onto the plate, in the keys' rainbow. */}
        <g className={styles.underglow} stroke={url('rgb')} filter={url('under')}>
          {shapes.map(k => (k.round
            ? <circle key={`u${k.cid}`} cx={k.x + k.w / 2} cy={k.y + k.h / 2 + 4} r={k.w / 2 + 1} />
            : k.path
              ? <path key={`u${k.cid}${k.layout ?? ''}`} d={k.path} transform="translate(0 4)" />
              : <rect key={`u${k.cid}${k.layout ?? ''}`} x={k.x - 1} y={k.y + 3} width={k.w + 2} height={k.h + 2} rx={CAP_RADIUS + 1} />))}
        </g>

        <g key={layerKey} className={styles.keys}>
          {shapes.map(k => {
            const key = keyOf(k.cid) as number;
            const f = face(key);
            const legend = legendOf(k);
            const cls = [
              styles.key,
              f.source === 'own' ? styles.assigned : '',
              f.source === 'inherited' ? styles.inherited : '',
              f.tone === 'gshift' ? styles.gshift : '',
              f.tone === 'disabled' ? styles.disabled : '',
              selectedKey === key ? styles.selected : '',
              hover === key ? styles.hover : '',
              dropOver === key ? styles.dropOver : '',
              flashKey === key ? styles.flash : '',
            ].join(' ');
            const cx = k.x + k.w / 2;
            const cy = k.y + k.h / 2;
            const style = { '--d': `${Math.round(k.x * SWEEP_MS_PER_UNIT)}ms`, transformOrigin: `${cx}px ${cy}px` } as CSSProperties;
            const onKeyDown = (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(key);
              }
            };
            const faceCy = cy - FACE_LIP / 2;
            const iconSize = Math.min(k.w, k.h) * 0.42;
            const media = k.media !== undefined ? MEDIA_LEGEND[k.media] : undefined;
            const shifted = shiftedOf(k.usage, layout);
            const numSub = k.usage !== undefined ? NUMPAD_SUB[k.usage] : undefined;
            const labelFont = f.label !== null ? (f.icon || f.sub ? Math.min(22, fontFor(f.label, k.w)) : fontFor(f.label, k.w)) : 0;
            const lit = { fill: url('rgb'), filter: url('glow') };
            return (
              <g
                key={`${k.cid}-${k.layout ?? 'all'}-${flashKey === key ? 'f' : 's'}`}
                className={cls}
                style={style}
                role="button"
                tabIndex={inactive ? -1 : 0}
                aria-label={keyAria(key, legend)}
                aria-pressed={selectedKey === key}
                onClick={() => onSelect(key)}
                onKeyDown={onKeyDown}
                onMouseEnter={() => setHover(key)}
                onMouseLeave={() => setHover(prev => (prev === key ? null : prev))}
                onFocus={() => setHover(key)}
                onBlur={() => setHover(prev => (prev === key ? null : prev))}
                {...dragProps(key)}
              >
                {k.round ? (
                  <>
                    <circle cx={cx} cy={cy} r={k.w / 2} fill="#000" opacity={0.7} filter={url('soft')} transform="translate(0 5)" />
                    <circle className={`${styles.face} ${styles.roundEdge}`} cx={cx} cy={cy} r={k.w / 2} fill={url('round')} />
                    <circle className={styles.rim} cx={cx} cy={cy} r={k.w / 2 - 2.5} />
                    <circle className={styles.ring} cx={cx} cy={cy} r={k.w / 2 + 7} />
                  </>
                ) : k.path ? (
                  <>
                    <path d={k.path} fill={url('skirt')} filter={url('capShadow')} className={styles.capEdge} />
                    <path className={styles.face} d={k.path} fill={url('faceTall')} transform={`translate(${cx} ${cy - 4}) scale(0.93 0.92) translate(${-cx} ${-cy})`} />
                    <path className={styles.ring} d={k.path} transform={`translate(${cx} ${cy}) scale(1.06) translate(${-cx} ${-cy})`} />
                  </>
                ) : (
                  <>
                    <rect x={k.x} y={k.y} width={k.w} height={k.h} rx={CAP_RADIUS} fill={url('skirt')} filter={url('capShadow')} className={styles.capEdge} />
                    <rect className={styles.face} x={k.x + FACE_INSET} y={k.y + 2} width={k.w - 2 * FACE_INSET} height={k.h - FACE_LIP} rx={CAP_RADIUS - 2} fill={url(k.h > TALL ? 'faceTall' : 'face')} />
                    <rect className={styles.faceLine} x={k.x + FACE_INSET} y={k.y + 2} width={k.w - 2 * FACE_INSET} height={k.h - FACE_LIP} rx={CAP_RADIUS - 2} />
                    <line className={styles.topLight} x1={k.x + 10} x2={k.x + k.w - 10} y1={k.y + 3.2} y2={k.y + 3.2} />
                    <rect className={styles.ring} x={k.x - 5} y={k.y - 5} width={k.w + 10} height={k.h + 10} rx={CAP_RADIUS + 4} />
                  </>
                )}
                <circle className={styles.ripple} cx={cx} cy={faceCy} r={Math.max(k.w, k.h) / 2} />
                {f.label !== null || f.icon ? (
                  <>
                    {legend !== '' && !k.round && (
                      <text className={styles.corner} x={k.x + FACE_INSET + 6} y={k.y + 17}>{fit(legend, k.w * 0.6, 13)}</text>
                    )}
                    {f.icon && (
                      <svg
                        className={styles.icon}
                        x={cx - (f.label ? iconSize * 0.4 : iconSize / 2)}
                        y={f.label ? faceCy - iconSize * 0.62 : faceCy - iconSize / 2 + 4}
                        width={f.label ? iconSize * 0.8 : iconSize}
                        height={f.label ? iconSize * 0.8 : iconSize}
                        viewBox="0 0 24 24"
                      >
                        {f.icon}
                      </svg>
                    )}
                    {f.sub && <text className={styles.sub} x={cx} y={faceCy - 6} fontSize={SUB_FONT}>{fit(f.sub, k.w, SUB_FONT)}</text>}
                    {f.label !== null && (
                      <text className={styles.label} x={cx} y={f.icon ? faceCy + 22 : f.sub ? faceCy + 18 : faceCy + 2} fontSize={labelFont}>
                        {fit(f.label, k.w, labelFont)}
                      </text>
                    )}
                  </>
                ) : media ? (
                  <g className={styles.mediaLegend} fill={url('rgb')} stroke={url('rgb')} filter={url('glow')}>{media(cx, cy)}</g>
                ) : k.round ? (
                  <text className={`${styles.legend} ${styles.roundLegend}`} x={cx} y={cy} fontSize={20}>{legend}</text>
                ) : shifted ? (
                  <>
                    <text className={styles.shifted} x={cx} y={faceCy - 12} fontSize={15} {...lit}>{shifted}</text>
                    <text className={styles.legend} x={cx} y={faceCy + 10} fontSize={21} {...lit}>{legend}</text>
                  </>
                ) : numSub ? (
                  <>
                    <text className={styles.legend} x={cx} y={faceCy - 8} fontSize={22} {...lit}>{legend}</text>
                    <text className={styles.shifted} x={cx} y={faceCy + 15} fontSize={12} {...lit}>{numSub}</text>
                  </>
                ) : (
                  <text className={`${styles.legend} ${[...legend].length > 2 ? styles.word : ''}`} x={cx} y={faceCy} fontSize={fontFor(legend, k.w)} {...lit}>
                    {fit(legend, k.w, fontFor(legend, k.w))}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
