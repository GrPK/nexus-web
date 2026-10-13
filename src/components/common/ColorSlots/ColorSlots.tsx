import { useRef, type KeyboardEvent } from 'react';
import styles from './ColorSlots.module.scss';

export interface ColorSlotsProps {
  colors: readonly string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  /** Accessible name of one slot, from its zero-based index. */
  slotLabel: (index: number) => string;
  ariaLabel?: string;
}

/**
 * A row of filled color swatches that picks which slot an editor works on. The
 * active swatch carries a ring; arrows move between slots and Space or Enter
 * selects, the same radio behavior as ChipGroup.
 */
export function ColorSlots({ colors, activeIndex, onSelect, slotLabel, ariaLabel }: ColorSlotsProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1
        : 0;
    if (step === 0) return;
    const items = [...(groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])];
    if (items.length === 0) return;
    const from = items.indexOf(document.activeElement as HTMLButtonElement);
    event.preventDefault();
    items[(Math.max(from, 0) + step + items.length) % items.length].focus();
  };

  return (
    <div ref={groupRef} className={styles.row} role="radiogroup" aria-label={ariaLabel} onKeyDown={handleKeyDown}>
      {colors.map((hex, i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={i === activeIndex}
          aria-label={slotLabel(i)}
          tabIndex={i === activeIndex ? 0 : -1}
          className={`${styles.swatch} ${i === activeIndex ? styles.active : ''}`}
          style={{ background: hex }}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  );
}
