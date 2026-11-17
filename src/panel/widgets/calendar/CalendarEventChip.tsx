import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';

interface Props {
  className: string;
  color: string;
  style?: CSSProperties;
  label: string;
  // Present on a pointer surface: the chip becomes a button that opens the event.
  onPress?: (el: HTMLElement) => void;
  children: ReactNode;
}

/**
 * One event drawn as a block or line. Static on panels (the tile never takes input); a real button where the host passes `onPress`.
 */
export function CalendarEventChip({ className, color, style, label, onPress, children }: Props) {
  const vars = { ...style, '--cal-color': color } as CSSProperties;
  if (!onPress) return <div className={className} style={vars}>{children}</div>;
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPress(e.currentTarget);
    }
  };
  return (
    <div
      className={className}
      style={vars}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-haspopup="dialog"
      onClick={e => onPress(e.currentTarget)}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
