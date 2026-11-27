import { useId } from 'react';
import { ART, HOTSPOTS, gName } from './g502x';
import { TopArt } from './g502xArt';
import styles from './MouseIllustration.module.scss';

// Room on the drawing's left for the labels, the gap before them and their text size, in the
// drawing's units.
const LABEL_ROOM = 290;
const LABEL_GAP = 16;
const LABEL_SIZE = 34;

export interface MouseMiniProps {
  /** Buttons that glow, each with what it does, labelled on the left ("G8 DPI up"). */
  lit: readonly { slot: number; text: string }[];
  /** Changes when the glow should flash again (a new level picked). */
  pulse: string | number;
}

/** The mouse's top view, small, with a few buttons glowing and named (the DPI buttons on the sensitivity page). */
export function MouseMini({ lit, pulse }: MouseMiniProps) {
  const uid = useId().replace(/:/g, '');
  const id = (name: string) => `mm-${uid}-${name}`;
  const art = ART.top;
  const spots = lit.flatMap(l => {
    const h = HOTSPOTS.find(s => s.view === 'top' && s.slot === l.slot);
    return h ? [{ ...h, text: l.text }] : [];
  });
  const textX = art.x - LABEL_GAP;
  return (
    <svg className={styles.mini} viewBox={`${art.x - LABEL_ROOM} ${art.y} ${art.width + LABEL_ROOM} ${art.height}`} aria-hidden>
      <TopArt id={id} url={name => `url(#${id(name)})`} link={name => `#${id(name)}`} />
      {spots.map(h => (
        <path key={`${h.slot}-${pulse}`} className={styles.lit} d={h.region} />
      ))}
      {spots.map(h => (
        <g key={`l${h.slot}`}>
          <path className={styles.miniLeader} d={`M${h.x} ${h.y} L${textX + 4} ${h.y}`} />
          <circle className={styles.miniDot} cx={h.x} cy={h.y} r={5} />
          <text className={styles.miniLabel} x={textX - 8} y={h.y} fontSize={LABEL_SIZE}>
            <tspan className={styles.miniBadge}>{gName(h.g)}</tspan>
            <tspan dx={10}>{h.text}</tspan>
          </text>
        </g>
      ))}
    </svg>
  );
}
