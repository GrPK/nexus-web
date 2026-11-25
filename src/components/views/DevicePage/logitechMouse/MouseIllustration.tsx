import { useState, type DragEvent } from 'react';
import { ART, HOTSPOTS, gName, type MouseHotspot, type MouseView } from './g502x';
import styles from './MouseIllustration.module.scss';

/** MIME type of an action dragged from the library onto a button. */
export const ACTION_MIME = 'application/x-nexus-mouse-action';

// Room around the art for the callouts, in art units.
const PAD_TOP = 250;
const PAD_BOTTOM = 150;
const LABEL_GAP = 120;
const LABEL_ROOM = 1050;
const ELBOW = 70;

export interface MouseIllustrationProps {
  view: MouseView;
  /** What each slot does now, already worded for display. */
  actionLabel: (slot: number) => string;
  selectedSlot: number | null;
  /** Slots whose binding just changed; their callout flashes. */
  flashSlot: number | null;
  ariaLabel: string;
  onSelect: (slot: number) => void;
  onDropAction: (slot: number, value: string) => void;
}

/**
 * One view of the mouse: our outline art, every button as a lit region with a marker, and a callout
 * per button saying what it does. Hover and selection light the button and its callout together; a
 * selected button ripples like the vendor app's, and an action dragged from the library can be
 * dropped on a button or on its callout.
 */
export function MouseIllustration({ view, actionLabel, selectedSlot, flashSlot, ariaLabel, onSelect, onDropAction }: MouseIllustrationProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [dropOver, setDropOver] = useState<number | null>(null);
  const art = ART[view];
  const spots = HOTSPOTS.filter(h => h.view === view);
  const hasRight = spots.some(h => h.side === 'right');
  const x0 = -(LABEL_GAP + LABEL_ROOM);
  const width = art.width + 2 * (LABEL_GAP + LABEL_ROOM) - (hasRight ? 0 : LABEL_ROOM);
  const y0 = -PAD_TOP;
  const height = art.height + PAD_TOP + PAD_BOTTOM;
  const anchorX = (h: MouseHotspot) => (h.side === 'left' ? -LABEL_GAP : art.width + LABEL_GAP);
  const pctX = (x: number) => `${((x - x0) / width) * 100}%`;
  const pctY = (y: number) => `${((y - y0) / height) * 100}%`;
  const state = (slot: number) =>
    [selectedSlot === slot ? styles.selected : '', hover === slot ? styles.hover : '', dropOver === slot ? styles.dropOver : ''].join(' ');

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
    <div className={styles.canvas} style={{ aspectRatio: `${width} / ${height}` }} role="group" aria-label={ariaLabel}>
      <svg className={styles.svg} viewBox={`${x0} ${y0} ${width} ${height}`} aria-hidden>
        <defs>
          <linearGradient id={`mouse-body-${view}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className={styles.stopLight} />
            <stop offset="1" className={styles.stopDark} />
          </linearGradient>
          <linearGradient id={`mouse-sheen-${view}`} x1="0" y1="0" x2="0.6" y2="0.7">
            <stop offset="0" className={styles.sheenOn} />
            <stop offset="1" className={styles.sheenOff} />
          </linearGradient>
        </defs>
        <path className={styles.body} d={art.body} fill={`url(#mouse-body-${view})`} />
        <path className={styles.sheen} d={art.body} fill={`url(#mouse-sheen-${view})`} />
        {art.details.map((d, i) => <path key={i} className={styles.detail} d={d} />)}
        {spots.map(h => (
          <path
            key={`r${h.slot}`}
            className={`${styles.region} ${state(h.slot)}`}
            d={h.region}
            onMouseEnter={() => setHover(h.slot)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect(h.slot)}
            {...dragProps(h.slot)}
          />
        ))}
        {spots.map(h => {
          const ax = anchorX(h);
          const elbowX = h.side === 'left' ? ax + ELBOW : ax - ELBOW;
          return (
            <path
              key={`l${h.slot}-${selectedSlot === h.slot ? 'on' : 'off'}`}
              className={`${styles.leader} ${state(h.slot)}`}
              d={`M${h.x} ${h.y} L${elbowX} ${h.labelY} L${ax} ${h.labelY}`}
            />
          );
        })}
        {spots.map(h => (
          <g
            key={`m${h.slot}`}
            className={`${styles.marker} ${state(h.slot)}`}
            transform={`translate(${h.x} ${h.y})`}
            onMouseEnter={() => setHover(h.slot)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect(h.slot)}
            {...dragProps(h.slot)}
          >
            <circle className={styles.ring} r={30} />
            <circle className={`${styles.ring} ${styles.ringLate}`} r={30} />
            <circle className={styles.dot} r={26} />
          </g>
        ))}
      </svg>
      {spots.map(h => (
        <button
          type="button"
          key={`c${h.slot}-${flashSlot === h.slot ? 'flash' : 'still'}`}
          className={`${styles.callout} ${h.side === 'left' ? styles.calloutLeft : styles.calloutRight} ${state(h.slot)} ${flashSlot === h.slot ? styles.flash : ''}`}
          style={{ left: pctX(anchorX(h)), top: pctY(h.labelY), maxWidth: `${(LABEL_ROOM / width) * 96}%` }}
          aria-pressed={selectedSlot === h.slot}
          onMouseEnter={() => setHover(h.slot)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(h.slot)}
          onBlur={() => setHover(null)}
          onClick={() => onSelect(h.slot)}
          {...dragProps(h.slot)}
        >
          <span className={styles.badge}>{gName(h.g)}</span>
          <span className={styles.action}>{actionLabel(h.slot)}</span>
        </button>
      ))}
    </div>
  );
}
