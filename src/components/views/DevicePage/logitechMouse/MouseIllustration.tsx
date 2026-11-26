import { useId, useState, type DragEvent } from 'react';
import { ART, HOTSPOTS, gName, type MouseHotspot, type MouseView } from './g502x';
import { SideArt, TopArt } from './g502xArt';
import styles from './MouseIllustration.module.scss';

/** MIME type of an action dragged from the library onto a button. */
export const ACTION_MIME = 'application/x-nexus-mouse-action';

// Room around the drawing for the callouts and the marker sizes, in units of a view 2700 tall;
// each view scales them to its own units so both mice read the same.
const VIEW_UNITS = 2700;
const PAD_TOP = 250;
const PAD_BOTTOM = 150;
const LABEL_GAP = 120;
const LABEL_ROOM = 1050;
const ELBOW = 70;
const RING = 30;
const DOT = 22;

export interface MouseIllustrationProps {
  view: MouseView;
  /** What each slot does now, already worded for display. */
  actionLabel: (slot: number) => string;
  selectedSlot: number | null;
  /** Slots whose binding just changed; the button and its callout flash. */
  flashSlot: number | null;
  ariaLabel: string;
  onSelect: (slot: number) => void;
  onDropAction: (slot: number, value: string) => void;
}

/**
 * One view of the mouse: our hand-made drawing of the G502 X PLUS, every button as a region
 * that lights on hover and glows when selected, with a marker and a callout saying what it does.
 * A selected button breathes and its marker ripples, like the vendor app's; a button that just
 * got a new action flashes. Actions from the library drop onto a button or its callout.
 */
export function MouseIllustration({ view, actionLabel, selectedSlot, flashSlot, ariaLabel, onSelect, onDropAction }: MouseIllustrationProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [dropOver, setDropOver] = useState<number | null>(null);
  const uid = useId().replace(/:/g, '');
  const id = (name: string) => `m-${uid}-${view}-${name}`;
  const ids = { id, url: (name: string) => `url(#${id(name)})`, link: (name: string) => `#${id(name)}` };
  const art = ART[view];
  const Drawing = view === 'top' ? TopArt : SideArt;
  const k = art.height / VIEW_UNITS;
  const spots = HOTSPOTS.filter(h => h.view === view);
  const room = (LABEL_GAP + LABEL_ROOM) * k;
  const roomLeft = spots.some(h => h.side === 'left') ? room : 0;
  const roomRight = spots.some(h => h.side === 'right') ? room : 0;
  const x0 = art.x - roomLeft;
  const width = art.width + roomLeft + roomRight;
  const y0 = art.y - PAD_TOP * k;
  const height = art.height + (PAD_TOP + PAD_BOTTOM) * k;
  const anchorX = (h: MouseHotspot) => (h.side === 'left' ? art.x - LABEL_GAP * k : art.x + art.width + LABEL_GAP * k);
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
  const pointProps = (slot: number) => ({
    onMouseEnter: () => setHover(slot),
    onMouseLeave: () => setHover(null),
    onClick: () => onSelect(slot),
    ...dragProps(slot),
  });

  return (
    <div className={styles.canvas} style={{ aspectRatio: `${width} / ${height}` }} role="group" aria-label={ariaLabel}>
      <svg className={styles.svg} viewBox={`${x0} ${y0} ${width} ${height}`} aria-hidden>
        <g transform={art.transform}>
          <Drawing {...ids} />
          {spots.map(h => (
            <path
              key={`r${h.slot}-${flashSlot === h.slot ? 'flash' : 'still'}`}
              className={`${styles.region} ${state(h.slot)} ${flashSlot === h.slot ? styles.flash : ''}`}
              d={h.region}
              {...pointProps(h.slot)}
            />
          ))}
        </g>
        {spots.map(h => {
          const [mx, my] = art.place(h.x, h.y);
          const ax = anchorX(h);
          const elbowX = h.side === 'left' ? ax + ELBOW * k : ax - ELBOW * k;
          return (
            <path
              key={`l${h.slot}-${selectedSlot === h.slot ? 'on' : 'off'}`}
              className={`${styles.leader} ${state(h.slot)}`}
              d={`M${mx} ${my} L${elbowX} ${h.labelY} L${ax} ${h.labelY}`}
            />
          );
        })}
        {spots.map(h => {
          const [mx, my] = art.place(h.x, h.y);
          return (
            <g key={`m${h.slot}`} className={`${styles.marker} ${state(h.slot)}`} transform={`translate(${mx} ${my})`} {...pointProps(h.slot)}>
              <circle className={styles.ring} r={RING * k} />
              <circle className={`${styles.ring} ${styles.ringLate}`} r={RING * k} />
              <circle className={styles.dot} r={DOT * k} />
            </g>
          );
        })}
      </svg>
      {spots.map(h => (
        <button
          type="button"
          key={`c${h.slot}-${flashSlot === h.slot ? 'flash' : 'still'}`}
          className={`${styles.callout} ${h.side === 'left' ? styles.calloutLeft : styles.calloutRight} ${state(h.slot)} ${flashSlot === h.slot ? styles.flash : ''}`}
          style={{ left: pctX(anchorX(h)), top: pctY(h.labelY), maxWidth: `${((LABEL_ROOM * k) / width) * 96}%` }}
          aria-pressed={selectedSlot === h.slot}
          onFocus={() => setHover(h.slot)}
          onBlur={() => setHover(null)}
          {...pointProps(h.slot)}
        >
          <span className={styles.badge}>{gName(h.g)}</span>
          <span className={styles.action}>{actionLabel(h.slot)}</span>
        </button>
      ))}
    </div>
  );
}
