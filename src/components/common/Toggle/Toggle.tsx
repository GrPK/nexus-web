import styles from './Toggle.module.scss';

/**
 * Switch-style toggle. 40x22 pill with a 16x16 white knob that slides on
 * checked.
 *
 * Accepts a single `checked` boolean and `onChange(next)`. Use
 * `ariaLabel` when the toggle is a standalone control without an
 * adjacent label element; otherwise the parent should label it via
 * `aria-labelledby`.
 */
export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  className?: string;
  /** The controlled targets disagree: indeterminate knob, `aria-checked="mixed"`. A click sets all on. */
  mixed?: boolean;
}

export function Toggle({
  checked, onChange, disabled, ariaLabel, ariaLabelledBy, className, mixed = false,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={mixed ? 'mixed' : checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      data-on={mixed ? 'mixed' : (checked ? 'true' : 'false')}
      disabled={disabled}
      onClick={() => onChange(mixed ? true : !checked)}
      className={`${styles.toggle} ${className ?? ''}`}
    >
      <span className={styles.thumb} aria-hidden="true" />
    </button>
  );
}
