import { useId } from 'react';
import { ART, HOTSPOTS } from './g502x';
import { TopArt } from './g502xArt';
import styles from './MouseIllustration.module.scss';

export interface MouseMiniProps {
  /** Slots whose buttons glow in the accent. */
  lit: readonly number[];
  /** Changes when the glow should flash again (a new level picked). */
  pulse: string | number;
}

/** The mouse's top view, small, with a few buttons glowing (the DPI buttons on the sensitivity page). */
export function MouseMini({ lit, pulse }: MouseMiniProps) {
  const uid = useId().replace(/:/g, '');
  const id = (name: string) => `mm-${uid}-${name}`;
  const art = ART.top;
  return (
    <svg className={styles.mini} viewBox={`${art.x} ${art.y} ${art.width} ${art.height}`} aria-hidden>
      <TopArt id={id} url={name => `url(#${id(name)})`} link={name => `#${id(name)}`} />
      {HOTSPOTS.filter(h => h.view === 'top' && lit.includes(h.slot)).map(h => (
        <path key={`${h.slot}-${pulse}`} className={styles.lit} d={h.region} />
      ))}
    </svg>
  );
}
