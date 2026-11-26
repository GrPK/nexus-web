import { useId, useState, type DragEvent } from 'react';
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
// Spacing of the knurl on the scroll wheel.
const KNURL = 14;

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
 * One view of the mouse: our shaded art (a matte shell lit from the top left, panel seams, a
 * knurled metal wheel, rubber grip, the light strip in the theme's accent), every button as a
 * region that lights on hover and fills when selected, with a marker and a callout saying what
 * it does. A selected button ripples like the vendor app's; actions from the library drop onto
 * a button or its callout.
 */
export function MouseIllustration({ view, actionLabel, selectedSlot, flashSlot, ariaLabel, onSelect, onDropAction }: MouseIllustrationProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [dropOver, setDropOver] = useState<number | null>(null);
  const uid = useId().replace(/:/g, '');
  const id = (name: string) => `m-${uid}-${view}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;
  const art = ART[view];
  const spots = HOTSPOTS.filter(h => h.view === view);
  const panels = spots.filter(h => art.panels.includes(h.g));
  const buttons = spots.filter(h => !art.panels.includes(h.g) && !(art.wheel && h.g === 3) && !(art.tilt && (h.g === 7 || h.g === 8)));
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
  const wheel = art.wheel;

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
          <linearGradient id={id('shell')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#0e0e11" /><stop offset="0.22" stopColor="#26272c" /><stop offset="0.55" stopColor="#2d2e34" />
            <stop offset="0.85" stopColor="#1b1c20" /><stop offset="1" stopColor="#0c0c0e" />
          </linearGradient>
          <radialGradient id={id('shellHi')} cx="0.38" cy="0.22" r="0.55">
            <stop offset="0" stopColor="#fff" stopOpacity="0.16" /><stop offset="0.5" stopColor="#fff" stopOpacity="0.04" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id('panel')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#34363c" /><stop offset="0.6" stopColor="#25262b" /><stop offset="1" stopColor="#1c1d21" />
          </linearGradient>
          <radialGradient id={id('panelHi')} cx="0.35" cy="0.2" r="0.7">
            <stop offset="0" stopColor="#fff" stopOpacity="0.22" /><stop offset="0.45" stopColor="#fff" stopOpacity="0.05" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id('channel')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#050506" /><stop offset="0.5" stopColor="#121215" /><stop offset="1" stopColor="#050506" />
          </linearGradient>
          <linearGradient id={id('wheel')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#111214" /><stop offset="0.3" stopColor="#5f636b" /><stop offset="0.5" stopColor="#a7abb4" />
            <stop offset="0.7" stopColor="#5a5e66" /><stop offset="1" stopColor="#101113" />
          </linearGradient>
          <linearGradient id={id('button')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4a4c53" /><stop offset="0.5" stopColor="#2a2b30" /><stop offset="1" stopColor="#16171a" />
          </linearGradient>
          <pattern id={id('grip')} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="22" height="22" fill="#141417" /><rect width="11" height="22" fill="#1d1e22" />
          </pattern>
          <filter id={id('drop')} x="-30%" y="-10%" width="160%" height="130%">
            <feDropShadow dx="0" dy="50" stdDeviation="45" floodColor="#000" floodOpacity="0.8" />
          </filter>
          <filter id={id('glow')} x="-50%" y="-200%" width="200%" height="500%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <clipPath id={id('body')}><path d={art.body} /></clipPath>
        </defs>

        <path d={art.body} fill="#000" filter={url('drop')} />
        <path d={art.body} fill={url('shell')} />
        <g clipPath={url('body')}>
          <path d={art.grip} fill={url('grip')} opacity={0.9} />
          {art.footY !== undefined && (
            <>
              <rect className={styles.foot} x={0} y={art.footY} width={art.width} height={art.height - art.footY} />
              <line className={styles.seamLight} x1={0} x2={art.width} y1={art.footY} y2={art.footY} />
            </>
          )}
          <rect x={0} y={0} width={art.width} height={art.height} fill={url('shellHi')} />
          {art.details.map((d, i) => (
            <g key={i}>
              <path className={styles.seam} d={d} />
              <path className={styles.seamLight} d={d} transform="translate(12 10)" />
            </g>
          ))}
          {panels.map(h => (
            <g key={`p${h.slot}`}>
              <path className={styles.panelSeam} d={h.region} fill={url('panel')} />
              <path d={h.region} fill={url('panelHi')} />
              <path className={styles.panelEdge} d={h.region} transform="translate(0 4)" />
            </g>
          ))}
          {art.channel && <path d={art.channel} fill={url('channel')} />}
          {art.strip && (
            <>
              <path className={styles.stripGlow} d={art.strip} filter={url('glow')} />
              <path className={styles.strip} d={art.strip} />
            </>
          )}
        </g>
        {wheel && (
          <g>
            <rect className={styles.well} x={wheel.x - 7} y={wheel.y - 10} width={wheel.w + 14} height={wheel.h + 20} rx={wheel.w / 2 - 5} />
            <rect x={wheel.x} y={wheel.y} width={wheel.w} height={wheel.h} rx={wheel.w / 2 - 11} fill={url('wheel')} />
            {Array.from({ length: Math.floor((wheel.h - 30) / KNURL) }, (_, i) => wheel.y + 15 + i * KNURL).map(y => (
              <g key={y}>
                <line className={styles.knurlDark} x1={wheel.x + 5} x2={wheel.x + wheel.w - 5} y1={y} y2={y} />
                <line className={styles.knurlLight} x1={wheel.x + 7} x2={wheel.x + wheel.w - 7} y1={y + 5} y2={y + 5} />
              </g>
            ))}
          </g>
        )}
        {art.tilt?.map(d => <path key={d} className={styles.tilt} d={d} />)}
        {buttons.map(h => (
          <g key={`b${h.slot}`}>
            <path className={styles.well} d={h.region} transform="translate(5 10)" />
            <path className={styles.button} d={h.region} fill={url('button')} />
          </g>
        ))}
        <path className={styles.rimLight} d={art.body} />

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
            <circle className={styles.dot} r={22} />
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
