import { useState, type CSSProperties, type DragEvent, type KeyboardEvent } from 'react';
import { ACTION_MIME } from '../logitechMouse/MouseIllustration';
import { ART, KEYS } from './g915x';
import { fit, fontFor, legendOf, type KeyboardIllustrationProps } from './keyCaps';
import styles from './KeyboardPhoto.module.scss';

export interface KeyboardPhotoProps extends KeyboardIllustrationProps {
  photoUrl: string;
  onPhotoError: () => void;
}

// The part of the picture shown: the board and a little of its cable.
const TOP = 70;
const KEY_RADIUS = 9;
const INSET = 3;
const SUB_FONT = 15;
// The sweep across the keys when a layer opens, in ms per drawing unit from the left.
const SWEEP_MS_PER_UNIT = 0.18;

/**
 * The keyboard as the vendor app shows it: its own picture from the user's G HUB install, with
 * every key a target over the picture. Hover brightens a key, the selected key rings and breathes,
 * an assigned key fills with the accent and shows its action, a changed key pops with a ripple,
 * and opening a layer sweeps the assigned keys in. Positions are the picture's own (2048 x 830).
 */
export function KeyboardPhoto({
  layout, keyOf, face, selectedKey, flashKey, layerKey, ariaLabel, keyAria, onSelect, onDropAction, photoUrl, onPhotoError,
}: KeyboardPhotoProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [dropOver, setDropOver] = useState<number | null>(null);
  const shapes = KEYS.filter(k => (!k.layout || k.layout === layout) && keyOf(k.cid) !== undefined);
  const height = ART.height - TOP;

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
    <div className={styles.canvas} style={{ aspectRatio: `${ART.width} / ${height}` }} role="group" aria-label={ariaLabel}>
      <svg className={styles.svg} viewBox={`0 ${TOP} ${ART.width} ${height}`}>
        <image className={styles.photo} href={photoUrl} x={0} y={0} width={ART.width} height={ART.height} onError={onPhotoError} />
        <g key={layerKey} className={styles.keys}>
          {shapes.map(k => {
            const key = keyOf(k.cid) as number;
            const f = face(key);
            const legend = legendOf(k);
            const marked = f.source !== null;
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
            const shape = (className: string, grow = 0) => (k.round
              ? <circle className={className} cx={cx} cy={cy} r={k.w / 2 + grow} />
              : k.path
                ? <path className={className} d={k.path} transform={grow ? `translate(${cx} ${cy}) scale(${1 + grow / 60}) translate(${-cx} ${-cy})` : undefined} />
                : <rect className={className} x={k.x + INSET - grow} y={k.y + INSET - grow} width={k.w - 2 * INSET + 2 * grow} height={k.h - 2 * INSET + 2 * grow} rx={KEY_RADIUS + grow} />);
            const iconSize = Math.min(k.w, k.h) * 0.46;
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
                {shape(styles.hit)}
                {marked && shape(styles.fill)}
                {shape(styles.ring, 5)}
                <circle className={styles.ripple} cx={cx} cy={cy} r={Math.max(k.w, k.h) / 2} />
                {marked && (
                  <g className={styles.content}>
                    {legend !== '' && !k.round && <text className={styles.corner} x={k.x + INSET + 7} y={k.y + 18}>{fit(legend, k.w * 0.6, 13)}</text>}
                    {f.icon && (
                      <svg
                        className={styles.icon}
                        x={cx - (f.label ? iconSize * 0.4 : iconSize / 2)}
                        y={f.label ? cy - iconSize * 0.62 : cy - iconSize / 2 + 3}
                        width={f.label ? iconSize * 0.8 : iconSize}
                        height={f.label ? iconSize * 0.8 : iconSize}
                        viewBox="0 0 24 24"
                      >
                        {f.icon}
                      </svg>
                    )}
                    {f.sub && <text className={styles.sub} x={cx} y={cy - 6} fontSize={SUB_FONT}>{fit(f.sub, k.w, SUB_FONT)}</text>}
                    {f.label !== null && (
                      <text className={styles.label} x={cx} y={f.icon ? cy + 22 : f.sub ? cy + 17 : cy + 2} fontSize={labelFont}>
                        {fit(f.label, k.w, labelFont)}
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
