import type { ReactNode } from 'react';
import styles from '../LightingPage.module.scss';

/**
 * Stands in for controls that do not apply on the current tab: the selection is
 * pinned to something this tab cannot edit. Says where the controls are and,
 * when it can, takes the user there.
 */
export function PinNotice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.pinNotice} role="note">
      <p>{children}</p>
      {action}
    </div>
  );
}
