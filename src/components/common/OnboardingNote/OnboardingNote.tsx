import type { ReactNode } from 'react';
import styles from './OnboardingNote.module.scss';

/**
 * The reassurance line that closes every onboarding page ("you can change this
 * any time"). It sits at the bottom of the page, below the content, not under a
 * section title: onboarding pages are not settings sections.
 */
export function OnboardingNote({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={className ? `${styles.note} ${className}` : styles.note}>{children}</p>;
}
