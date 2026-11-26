import { useId, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Gamepad2, Pause, SkipBack, SkipForward, Sun, VolumeX } from 'lucide-react';
import { ACTION_MIME } from '../logitechMouse/MouseIllustration';
import { ART, CASE, KEYS } from './g915x';
import { fit, fontFor, legendOf, type KeyboardIllustrationProps } from './keyCaps';
import { KeyboardPhoto } from './KeyboardPhoto';
import styles from './KeyboardIllustration.module.scss';

export { legendOf, type KeyFace } from './keyCaps';

// Icons for the media keys' own legends, by consumer usage.
const MEDIA_LEGEND: Record<number, ReactNode> = {
  0xB6: <SkipBack />, 0xCD: <Pause />, 0xB5: <SkipForward />, 0xE2: <VolumeX />,
};
// The shifted symbol printed above the main legend, by HID usage.
const SHIFTED: Record<number, string> = {
  0x1E: '!', 0x1F: '@', 0x20: '#', 0x21: '$', 0x22: '%', 0x23: '^', 0x24: '&', 0x25: '*', 0x26: '(', 0x27: ')',
  0x2D: '_', 0x2E: '+', 0x2F: '{', 0x30: '}', 0x31: '|', 0x32: '|', 0x33: ':', 0x34: '"', 0x35: '~', 0x36: '<', 0x37: '>', 0x38: '?',
};
// The navigation legend under a number-pad digit.
const NUMPAD_SUB: Record<number, string> = {
  0x59: 'End', 0x5A: '↓', 0x5B: 'PgDn', 0x5C: '←', 0x5E: '→', 0x5F: 'Home', 0x60: '↑', 0x61: 'PgUp', 0x62: 'Ins', 0x63: 'Del',
};
// Room around the case, in drawing units.
const PAD = 16;
const CAP_RADIUS = 9;
const FACE_INSET = 3;
// The top face sits higher than the cap's bottom edge, so the cap reads as raised.
const FACE_LIP = 9;
// The sweep across the keys when a layer opens, in ms per drawing unit from the left.
const SWEEP_MS_PER_UNIT = 0.18;
const ROLLER_RIDGES = 46;
const SUB_FONT = 15;

/**
 * The keyboard, drawn as a low-profile board on a brushed aluminium case: keycaps with a raised
 * face and a lit top edge, light spilling from under every key, metal buttons and a knurled
 * volume roller. A key lifts on hover; the selected key rings and breathes; an assigned key fills
 * with the accent colour and shows its new action, its own legend in the corner; a changed key
 * pops with a ripple; opening a layer sweeps the keys in. Actions from the library drop onto keys.
 */
export function KeyboardIllustration(props: KeyboardIllustrationProps & { photoUrl?: string | null }) {
  const { layout, keyOf, face, selectedKey, flashKey, layerKey, ariaLabel, keyAria, onSelect, onDropAction, photoUrl } = props;
  const [hover, setHover] = useState<number | null>(null);
  const [dropOver, setDropOver] = useState<number | null>(null);
  // The picture failed to load for this URL; draw the keyboard instead.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const uid = useId().replace(/:/g, '');
  const id = (name: string) => `kb-${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;
  const shapes = KEYS.filter(k => (!k.layout || k.layout === layout) && keyOf(k.cid) !== undefined);
  const top = CASE.body.y - PAD;
  const width = ART.width + 2 * PAD;
  const height = ART.height - CASE.body.y + 2 * PAD + 20;
  const B = CASE.body;
  const R = CASE.roller;

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

  if (photoUrl && photoUrl !== failedUrl) {
    return <KeyboardPhoto {...props} photoUrl={photoUrl} onPhotoError={() => setFailedUrl(photoUrl)} />;
  }

  return (
    <div className={styles.canvas} style={{ aspectRatio: `${width} / ${height}` }} role="group" aria-label={ariaLabel}>
      <svg className={styles.svg} viewBox={`${-PAD} ${top} ${width} ${height}`}>
        <defs>
          <linearGradient id={id('plate')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a3c42" /><stop offset="0.06" stopColor="#2c2e33" />
            <stop offset="0.5" stopColor="#232428" /><stop offset="1" stopColor="#18191c" />
          </linearGradient>
          <linearGradient id={id('edge')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6b6e76" /><stop offset="0.02" stopColor="#3e4046" /><stop offset="1" stopColor="#0c0c0e" />
          </linearGradient>
          <linearGradient id={id('band')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2f3136" /><stop offset="1" stopColor="#26272b" />
          </linearGradient>
          <linearGradient id={id('sheen')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.06" /><stop offset="0.35" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.7" stopColor="#fff" stopOpacity="0.025" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={id('face')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#34363c" /><stop offset="0.55" stopColor="#25262b" /><stop offset="1" stopColor="#1c1d21" />
          </linearGradient>
          <linearGradient id={id('skirt')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#151619" /><stop offset="1" stopColor="#08090a" />
          </linearGradient>
          <radialGradient id={id('metal')} cx="0.4" cy="0.35" r="0.75">
            <stop offset="0" stopColor="#5d6068" /><stop offset="0.55" stopColor="#2b2d32" /><stop offset="1" stopColor="#151619" />
          </radialGradient>
          <linearGradient id={id('roller')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0d0d0f" /><stop offset="0.35" stopColor="#5b5e66" /><stop offset="0.5" stopColor="#8c9099" />
            <stop offset="0.65" stopColor="#4c4f56" /><stop offset="1" stopColor="#0d0d0f" />
          </linearGradient>
          <filter id={id('brushed')} x="0" y="0" width="1" height="1">
            <feTurbulence type="fractalNoise" baseFrequency="0.0008 1.4" numOctaves="1" seed="7" />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 -.18" />
          </filter>
          <filter id={id('drop')} x="-10%" y="-10%" width="120%" height="140%">
            <feDropShadow dx="0" dy="26" stdDeviation="22" floodColor="#000" floodOpacity="0.75" />
          </filter>
          <filter id={id('under')} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter id={id('capShadow')} x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000" floodOpacity="0.7" />
          </filter>
        </defs>

        <rect x={B.x} y={B.y} width={B.w} height={B.h} rx={B.r} fill={url('edge')} filter={url('drop')} />
        <rect x={B.x + 3} y={B.y + 3} width={B.w - 6} height={B.h - 8} rx={B.r - 3} fill={url('plate')} />
        <rect x={B.x + 3} y={B.y + 3} width={B.w - 6} height={B.h - 8} rx={B.r - 3} filter={url('brushed')} opacity={0.22} />
        <rect className={styles.band} x={B.x + 14} y={B.y + 12} width={B.w - 28} height={92} rx={18} fill={url('band')} />
        <rect x={B.x + 3} y={B.y + 3} width={B.w - 6} height={B.h - 8} rx={B.r - 3} fill={url('sheen')} pointerEvents="none" />

        <rect x={R.x - 6} y={R.y - 4} width={R.w + 12} height={R.h + 8} rx={14} className={styles.well} />
        <rect x={R.x} y={R.y} width={R.w} height={R.h} rx={10} fill={url('roller')} />
        {Array.from({ length: ROLLER_RIDGES }, (_, i) => (
          <line key={i} className={i % 2 ? styles.ridgeLight : styles.ridgeDark}
            x1={R.x + 6 + i * 6.2} x2={R.x + 6 + i * 6.2} y1={R.y + 3} y2={R.y + R.h - 3} />
        ))}
        {[{ cx: CASE.gameMode.cx, icon: <Gamepad2 /> }, { cx: CASE.gameMode.cx + 80, icon: <Sun /> }].map(b => (
          <g key={b.cx}>
            <circle className={styles.well} cx={b.cx} cy={CASE.gameMode.cy} r={CASE.gameMode.r} />
            <circle cx={b.cx} cy={CASE.gameMode.cy - 1} r={CASE.gameMode.r - 4} fill={url('metal')} />
            <svg className={styles.fixedIcon} x={b.cx - 13} y={CASE.gameMode.cy - 14} width={26} height={26} viewBox="0 0 24 24">{b.icon}</svg>
          </g>
        ))}

        <g className={styles.underglow} filter={url('under')}>
          {shapes.filter(k => !k.round).map(k => (k.path
            ? <path key={`u${k.cid}${k.layout ?? ''}`} d={k.path} transform={`translate(${k.x + k.w / 2} ${k.y + k.h / 2}) scale(0.85) translate(${-(k.x + k.w / 2)} ${-(k.y + k.h / 2)})`} />
            : <rect key={`u${k.cid}${k.layout ?? ''}`} x={k.x + 8} y={k.y + 10} width={k.w - 16} height={k.h - 12} rx={10} />))}
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
            const mediaIcon = k.media !== undefined ? MEDIA_LEGEND[k.media] : undefined;
            const shifted = k.usage !== undefined ? SHIFTED[k.usage] : undefined;
            const numSub = k.usage !== undefined ? NUMPAD_SUB[k.usage] : undefined;
            const labelFont = f.label !== null ? (f.icon || f.sub ? Math.min(22, fontFor(f.label, k.w)) : fontFor(f.label, k.w)) : 0;
            return (
              <g
                key={`${k.cid}-${k.layout ?? 'all'}-${flashKey === key ? 'f' : 's'}`}
                className={cls}
                style={style}
                role="button"
                tabIndex={0}
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
                    <circle className={styles.well} cx={cx} cy={cy + 2} r={k.w / 2 + 3} />
                    <circle className={styles.face} cx={cx} cy={cy} r={k.w / 2 - 1} fill={url('metal')} />
                    <circle className={styles.rim} cx={cx} cy={cy} r={k.w / 2 - 1} />
                    <circle className={styles.ring} cx={cx} cy={cy} r={k.w / 2 + 7} />
                  </>
                ) : k.path ? (
                  <>
                    <path d={k.path} fill={url('skirt')} filter={url('capShadow')} />
                    <path className={styles.face} d={k.path} fill={url('face')} transform={`translate(${cx} ${cy - 3}) scale(0.93 0.92) translate(${-cx} ${-cy})`} />
                    <path className={styles.ring} d={k.path} transform={`translate(${cx} ${cy}) scale(1.06) translate(${-cx} ${-cy})`} />
                  </>
                ) : (
                  <>
                    <rect x={k.x} y={k.y} width={k.w} height={k.h} rx={CAP_RADIUS} fill={url('skirt')} filter={url('capShadow')} />
                    <rect className={styles.face} x={k.x + FACE_INSET} y={k.y + 2} width={k.w - 2 * FACE_INSET} height={k.h - FACE_LIP} rx={CAP_RADIUS - 2} fill={url('face')} />
                    <rect className={styles.faceLine} x={k.x + FACE_INSET} y={k.y + 2} width={k.w - 2 * FACE_INSET} height={k.h - FACE_LIP} rx={CAP_RADIUS - 2} />
                    <line className={styles.topLight} x1={k.x + 9} x2={k.x + k.w - 9} y1={k.y + 3.5} y2={k.y + 3.5} />
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
                ) : mediaIcon ? (
                  <svg className={styles.legendIcon} x={cx - iconSize / 2} y={cy - iconSize / 2} width={iconSize} height={iconSize} viewBox="0 0 24 24">{mediaIcon}</svg>
                ) : shifted ? (
                  <>
                    <text className={styles.shifted} x={cx} y={faceCy - 12} fontSize={15}>{shifted}</text>
                    <text className={styles.legend} x={cx} y={faceCy + 10} fontSize={21}>{legend}</text>
                  </>
                ) : numSub ? (
                  <>
                    <text className={styles.legend} x={cx} y={faceCy - 8} fontSize={22}>{legend}</text>
                    <text className={styles.shifted} x={cx} y={faceCy + 15} fontSize={12}>{numSub}</text>
                  </>
                ) : (
                  <text className={`${styles.legend} ${[...legend].length > 2 ? styles.word : ''}`} x={cx} y={k.round ? cy : faceCy} fontSize={k.round ? 20 : fontFor(legend, k.w)}>
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
