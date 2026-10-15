import type { CSSProperties, ReactNode } from 'react';
import { SectionHeader } from '../SectionHeader/SectionHeader';
import styles from './SettingsSection.module.scss';

/**
 * Canonical settings group: a muted body-type header sitting ABOVE a
 * surface-filled box that holds the section's controls. The one pattern every
 * settings surface uses (dashboard Settings, panel editor, widget settings,
 * device modal) so they read identically. Replaces the older
 * SectionHeader-with-underline-inside-a-card look.
 *
 * Each section owns the gap below it, so stacks need no gap or margin of their own
 * between sections; a non-section child of a stack is wrapped in SettingsBlock.
 *
 * Renders correctly both in the dashboard and inside `.panel-root` (kiosk):
 * SectionHeader uses `--text-dim` and the box surface uses `--surface`.
 */
export function SettingsSection({
  title,
  description,
  footer,
  footnote,
  fill,
  flush,
  titleStyle,
  action,
  children,
  className,
  boxClassName,
  ariaLabel,
}: {
  // Omit for a titleless box (e.g. the welcome screen's preferences group).
  title?: ReactNode;
  // Optional muted hint under the title (still outside the box). Laid out as a
  // column, so each child becomes its own stacked line - a sentence with inline
  // markup must be wrapped in a single element or it breaks apart mid-sentence.
  description?: ReactNode;
  // Controls bound to the box (a pager strip under a preview), directly under it.
  footer?: ReactNode;
  // Short text under the box.
  footnote?: ReactNode;
  // Grow to fill the parent column and end flush with its bottom.
  fill?: boolean;
  // Drop the gap below, for a section that ends its column or row.
  flush?: boolean;
  // Per-section title colour override (e.g. the danger zone red).
  titleStyle?: CSSProperties;
  // Optional trailing control next to the title (e.g. a section-wide "Sync
  // now" button), aligned on the same row.
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  boxClassName?: string;
  ariaLabel?: string;
}) {
  const hasHeader = title !== undefined || description !== undefined || action !== undefined;
  return (
    <section className={[styles.section, fill ? styles.fill : '', flush ? styles.flush : '', className ?? ''].filter(Boolean).join(' ')} aria-label={ariaLabel}>
      {hasHeader && (
        <div className={styles.header}>
          <div className={styles.titleRow}>
            {title !== undefined && <SectionHeader style={titleStyle}>{title}</SectionHeader>}
            {action !== undefined && <div className={styles.action}>{action}</div>}
          </div>
          {description !== undefined && <div className={styles.description}>{description}</div>}
        </div>
      )}
      <div className={boxClassName ? `${styles.box} ${boxClassName}` : styles.box}>
        {children}
      </div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
      {footnote ? <div className={styles.footnote}>{footnote}</div> : null}
    </section>
  );
}

/** A non-section child of a section stack (a notice, a card) carrying the same gap below. */
export function SettingsBlock({ children }: { children: ReactNode }) {
  return <div className={styles.block}>{children}</div>;
}
