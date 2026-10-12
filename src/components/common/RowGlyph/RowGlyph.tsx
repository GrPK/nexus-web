import type { ReactNode } from 'react';
import { HoverTooltip } from '../HoverTooltip/HoverTooltip';
import styles from './RowGlyph.module.scss';

/**
 * Right-aligned status glyph with a hover label on a device or nav row. Bare
 * (non-focusable) so it can sit inside a row that is itself a button.
 */
export function RowGlyph({ icon, label, tone = 'dim', className }: {
  icon: ReactNode;
  label: string;
  tone?: 'dim' | 'accent';
  className?: string;
}) {
  return (
    <HoverTooltip body={label} side="top">
      <span className={`${styles.glyph} ${styles[tone]} ${className ?? ''}`} role="img" aria-label={label}>
        {icon}
      </span>
    </HoverTooltip>
  );
}
