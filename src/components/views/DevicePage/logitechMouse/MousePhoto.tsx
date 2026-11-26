import { useState, type DragEvent } from 'react';
import type { MousePicture } from '../../../../api/logitechMouse';
import { HOTSPOTS, gName } from './g502x';
import { ACTION_MIME } from './MouseIllustration';
import base from './MouseIllustration.module.scss';
import styles from './MousePhoto.module.scss';

export interface MousePhotoProps {
  picture: MousePicture;
  photoUrl: string;
  /** What each slot does now, already worded for display. */
  actionLabel: (slot: number) => string;
  selectedSlot: number | null;
  flashSlot: number | null;
  ariaLabel: string;
  onSelect: (slot: number) => void;
  onDropAction: (slot: number, value: string) => void;
  /** The picture failed to load: draw the mouse instead. */
  onPhotoError: () => void;
}

// Room for the callouts beside the picture, as a share of its width.
const LABEL_GAP = 0.06;
const LABEL_ROOM = 0.55;
const PAD = 0.04;
// Smallest vertical distance between two callouts on one side, as a share of the picture's height.
const LABEL_STEP = 0.075;
// The picture is drawn at the drawn mouse's scale (2700 units tall), so the shared callout,
// leader and marker styles keep their weight.
const ART_HEIGHT = 2700;
// The halo around a button, as a share of the picture's width.
const HALO = 0.032;
// The marker dot, in drawing units (the drawn mouse's size).
const DOT = 20;
// Spots right of this share of the width put their callout on the right.
const RIGHT_FROM = 0.33;

interface Placed { slot: number; g: number; x: number; y: number; side: 'left' | 'right'; labelY: number }

/** Callout heights for one side: each at its button's height, pushed apart so none overlap, kept on the picture. */
function placeLabels(spots: Placed[], height: number): Placed[] {
  const sorted = [...spots].sort((a, b) => a.y - b.y);
  const step = height * LABEL_STEP;
  let last = -Infinity;
  for (const s of sorted) {
    s.labelY = Math.max(s.y, last + step);
    last = s.labelY;
  }
  const overflow = last - height * (1 - PAD);
  if (overflow > 0) for (const s of sorted) s.labelY -= overflow;
  return sorted;
}

/**
 * The mouse as a picture the user gave Nexus (a real photo), with every button marked on it: a
 * halo that lights on hover and fills when the button is selected, a leader line and a callout
 * saying what it does. Actions from the library drop onto a button's halo or callout.
 */
export function MousePhoto({ picture, photoUrl, actionLabel, selectedSlot, flashSlot, ariaLabel, onSelect, onDropAction, onPhotoError }: MousePhotoProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [dropOver, setDropOver] = useState<number | null>(null);
  const k = ART_HEIGHT / picture.height;
  const w = picture.width * k;
  const h = ART_HEIGHT;
  const spots: Placed[] = picture.spots.flatMap(s => {
    const hot = HOTSPOTS.find(x => x.slot === s.slot);
    if (!hot) return [];
    const side = s.side ?? (s.x > picture.width * RIGHT_FROM ? 'right' : 'left');
    return [{ slot: s.slot, g: hot.g, x: s.x * k, y: s.y * k, side, labelY: s.y * k }];
  });
  const placed = [...placeLabels(spots.filter(s => s.side === 'left'), h), ...placeLabels(spots.filter(s => s.side === 'right'), h)];
  const room = w * LABEL_ROOM;
  const gap = w * LABEL_GAP;
  const x0 = -(gap + room);
  const width = w + 2 * (gap + room);
  const y0 = -h * PAD;
  const height = h * (1 + 2 * PAD);
  const anchorX = (s: Placed) => (s.side === 'left' ? -gap : w + gap);
  const pctX = (x: number) => `${((x - x0) / width) * 100}%`;
  const pctY = (y: number) => `${((y - y0) / height) * 100}%`;
  const state = (slot: number) =>
    [selectedSlot === slot ? base.selected : '', hover === slot ? base.hover : '', dropOver === slot ? base.dropOver : ''].join(' ');
  // The same states in this module's names, for the halos.
  const spotState = (slot: number) =>
    [selectedSlot === slot ? styles.selected : '', hover === slot ? styles.hover : '', dropOver === slot ? styles.dropOver : ''].join(' ');
  const halo = w * HALO;

  const dragProps = (slot: number) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(ACTION_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDropOver(slot);
    },
    onDragLeave: () => setDropOver(prev => (prev === slot ? null : prev)),
    onDrop: (e: DragEvent) => {
      const value = e.dataTransfer.getData(ACTION_MIME);
      setDropOver(null);
      if (!value) return;
      e.preventDefault();
      onDropAction(slot, value);
    },
  });

  return (
    <div className={base.canvas} style={{ aspectRatio: `${width} / ${height}` }} role="group" aria-label={ariaLabel}>
      <svg className={base.svg} viewBox={`${x0} ${y0} ${width} ${height}`} aria-hidden>
        <image className={styles.photo} href={photoUrl} x={0} y={0} width={w} height={h} onError={onPhotoError} />
        {placed.map(s => {
          const ax = anchorX(s);
          const elbow = s.side === 'left' ? ax + gap * 0.6 : ax - gap * 0.6;
          return (
            <path
              key={`l${s.slot}-${selectedSlot === s.slot ? 'on' : 'off'}`}
              className={`${base.leader} ${state(s.slot)}`}
              d={`M${s.x} ${s.y} L${elbow} ${s.labelY} L${ax} ${s.labelY}`}
            />
          );
        })}
        {placed.map(s => (
          <g
            key={`m${s.slot}`}
            className={`${base.marker} ${styles.spot} ${state(s.slot)} ${spotState(s.slot)}`}
            transform={`translate(${s.x} ${s.y})`}
            onMouseEnter={() => setHover(s.slot)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect(s.slot)}
            {...dragProps(s.slot)}
          >
            <circle className={styles.halo} r={halo} />
            <circle className={base.ring} r={DOT * 1.2} />
            <circle className={`${base.ring} ${base.ringLate}`} r={DOT * 1.2} />
            <circle className={base.dot} r={DOT} />
          </g>
        ))}
      </svg>
      {placed.map(s => (
        <button
          type="button"
          key={`c${s.slot}-${flashSlot === s.slot ? 'flash' : 'still'}`}
          className={`${base.callout} ${s.side === 'left' ? base.calloutLeft : base.calloutRight} ${state(s.slot)} ${flashSlot === s.slot ? base.flash : ''}`}
          style={{ left: pctX(anchorX(s)), top: pctY(s.labelY), maxWidth: `${(room / width) * 96}%` }}
          aria-pressed={selectedSlot === s.slot}
          onMouseEnter={() => setHover(s.slot)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(s.slot)}
          onBlur={() => setHover(null)}
          onClick={() => onSelect(s.slot)}
          {...dragProps(s.slot)}
        >
          <span className={base.badge}>{gName(s.g)}</span>
          <span className={base.action}>{actionLabel(s.slot)}</span>
        </button>
      ))}
    </div>
  );
}
