import { useState, type CSSProperties, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Pause, SkipBack, SkipForward, VolumeX } from 'lucide-react';
import { ACTION_MIME } from '../logitechMouse/MouseIllustration';
import { capText } from './keyNames';
import { ART, CASE, KEYS, type KeyShape, type KeyboardLayout } from './g915x';
import styles from './KeyboardIllustration.module.scss';

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
  /** The key whose assignment just changed; it pops. */
  flashKey: number | null;
  /** Changes with the layer shown, so the keys sweep in again. */
  layerKey: string;
  ariaLabel: string;
  /** Accessible name of a key, from its legend. */
  keyAria: (key: number, legend: string) => string;
  onSelect: (key: number) => void;
  onDropAction: (key: number, value: string) => void;
}

// Icons for the media keys' own legends, by consumer usage.
const MEDIA_LEGEND: Record<number, ReactNode> = {
  0xB6: <SkipBack />, 0xCD: <Pause />, 0xB5: <SkipForward />, 0xE2: <VolumeX />,
};
const PAD = 14;
const INSET = 7;
const RADIUS = 11;
// The sweep across the keys when a layer opens, in ms per drawing unit from the left.
const SWEEP_MS_PER_UNIT = 0.18;

/** A key's own legend: its cap text, its G number, or a media icon. */
export function legendOf(k: KeyShape): string {
  if (k.g) return `G${k.g}`;
  if (k.usage !== undefined) return capText(k.usage);
  return '';
}

// Text sizes in drawing units; the drawing shows at about half size, so 16 is the smallest that reads.
const MIN_FONT = 16;
const SUB_FONT = 15;
const CHAR_WIDTH = 0.58;

function fontFor(text: string, width: number): number {
  const n = [...text].length;
  const size = n <= 1 ? 32 : n <= 2 ? 28 : n <= 3 ? 24 : n <= 4 ? 21 : 18;
  const fits = Math.floor((width - 2 * INSET) / (Math.max(n, 1) * CHAR_WIDTH));
  return Math.max(MIN_FONT, Math.min(size, fits, width < 66 ? 22 : size));
}

function fit(text: string, width: number, font = MIN_FONT): string {
  const max = Math.max(3, Math.floor((width - 2 * INSET) / (font * CHAR_WIDTH)));
  return [...text].length > max ? [...text].slice(0, max - 1).join('') + '…' : text;
}

/**
 * The keyboard, drawn as keycaps on a case: every key lights on hover, a selected key glows and
 * ripples, an assigned key shows its new action on the cap with its own legend in the corner, and
 * opening a layer sweeps the keys in from the left. Actions from the library can be dropped on a key.
 */
export function KeyboardIllustration({
  layout, keyOf, face, selectedKey, flashKey, layerKey, ariaLabel, keyAria, onSelect, onDropAction,
}: KeyboardIllustrationProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [dropOver, setDropOver] = useState<number | null>(null);
  const shapes = KEYS.filter(k => (!k.layout || k.layout === layout) && keyOf(k.cid) !== undefined);

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
    <div className={styles.canvas} style={{ aspectRatio: `${ART.width + 2 * PAD} / ${ART.height - CASE.body.y + 2 * PAD}` }} role="group" aria-label={ariaLabel}>
      <svg className={styles.svg} viewBox={`${-PAD} ${CASE.body.y - PAD} ${ART.width + 2 * PAD} ${ART.height - CASE.body.y + 2 * PAD}`}>
        <defs>
          <linearGradient id="kb-case" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className={styles.caseTop} />
            <stop offset="1" className={styles.caseBottom} />
          </linearGradient>
          <linearGradient id="kb-face" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className={styles.faceTop} />
            <stop offset="1" className={styles.faceBottom} />
          </linearGradient>
        </defs>
        <rect className={styles.case} x={CASE.body.x} y={CASE.body.y} width={CASE.body.w} height={CASE.body.h} rx={CASE.body.r} fill="url(#kb-case)" />
        <rect className={styles.band} x={CASE.topBand.x + 6} y={CASE.topBand.y + 6} width={CASE.topBand.w - 12} height={CASE.topBand.h} rx={CASE.body.r - 6} />
        <rect className={styles.roller} x={CASE.roller.x} y={CASE.roller.y} width={CASE.roller.w} height={CASE.roller.h} rx={CASE.roller.h / 2} />
        {Array.from({ length: 22 }, (_, i) => (
          <line key={i} className={styles.ridge} x1={CASE.roller.x + 18 + i * 12} x2={CASE.roller.x + 18 + i * 12} y1={CASE.roller.y + 10} y2={CASE.roller.y + CASE.roller.h - 10} />
        ))}
        <circle className={styles.fixed} cx={CASE.gameMode.cx} cy={CASE.gameMode.cy} r={CASE.gameMode.r} />
        <g key={layerKey} className={styles.keys}>
          {shapes.map(k => {
            const key = keyOf(k.cid) as number;
            const f = face(key);
            const legend = legendOf(k);
            const cls = [
              styles.key,
              k.round ? styles.round : '',
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
            const mediaIcon = k.media !== undefined ? MEDIA_LEGEND[k.media] : undefined;
            const iconSize = Math.min(k.w, k.h) * 0.42;
            const showLabel = f.label !== null || f.icon;
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
                    <circle className={styles.ring} cx={cx} cy={cy} r={k.w / 2 + 4} />
                    <circle className={styles.cap} cx={cx} cy={cy} r={k.w / 2} />
                    <circle className={styles.face} cx={cx} cy={cy - 2} r={k.w / 2 - INSET + 2} fill="url(#kb-face)" />
                  </>
                ) : k.path ? (
                  <>
                    <path className={styles.ring} d={k.path} />
                    <path className={styles.cap} d={k.path} />
                    <path className={styles.face} d={k.path} fill="url(#kb-face)" transform={`translate(${cx} ${cy - 3}) scale(0.9) translate(${-cx} ${-cy})`} />
                  </>
                ) : (
                  <>
                    <rect className={styles.ring} x={k.x - 4} y={k.y - 4} width={k.w + 8} height={k.h + 8} rx={RADIUS + 4} />
                    <rect className={styles.cap} x={k.x} y={k.y} width={k.w} height={k.h} rx={RADIUS} />
                    <rect className={styles.face} x={k.x + INSET} y={k.y + INSET - 3} width={k.w - 2 * INSET} height={k.h - 2 * INSET - 2} rx={RADIUS - 3} fill="url(#kb-face)" />
                  </>
                )}
                {showLabel ? (
                  <>
                    {legend !== '' && !k.round && (
                      <text className={styles.corner} x={k.x + INSET + 3} y={k.y + INSET + 12}>{fit(legend, k.w * 0.6, 13)}</text>
                    )}
                    {f.icon && (
                      <svg
                        className={styles.icon}
                        x={cx - (f.label ? iconSize * 0.4 : iconSize / 2)}
                        y={f.label ? cy - iconSize * 0.65 : cy - iconSize / 2 + 4}
                        width={f.label ? iconSize * 0.8 : iconSize}
                        height={f.label ? iconSize * 0.8 : iconSize}
                        viewBox="0 0 24 24"
                      >
                        {f.icon}
                      </svg>
                    )}
                    {f.sub && (
                      <text className={styles.sub} x={cx} y={cy - 4} fontSize={SUB_FONT}>{fit(f.sub, k.w, SUB_FONT)}</text>
                    )}
                    {f.label !== null && (
                      <text
                        className={styles.label}
                        x={cx}
                        y={f.icon ? cy + 24 : f.sub ? cy + 22 : cy + 8}
                        fontSize={f.icon || f.sub ? Math.min(22, fontFor(f.label, k.w)) : fontFor(f.label, k.w)}
                      >
                        {fit(f.label, k.w, f.icon || f.sub ? Math.min(22, fontFor(f.label, k.w)) : fontFor(f.label, k.w))}
                      </text>
                    )}
                  </>
                ) : mediaIcon ? (
                  <svg className={styles.legendIcon} x={cx - iconSize / 2} y={cy - iconSize / 2 - 2} width={iconSize} height={iconSize} viewBox="0 0 24 24">{mediaIcon}</svg>
                ) : (
                  <text className={styles.legend} x={cx} y={cy + 6} fontSize={fontFor(legend, k.w)}>{fit(legend, k.w, fontFor(legend, k.w))}</text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
