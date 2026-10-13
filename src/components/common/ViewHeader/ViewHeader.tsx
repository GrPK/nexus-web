import type { ReactNode } from 'react';
import { Tabs, type TabDef } from '../Tabs/Tabs';
import styles from './ViewHeader.module.scss';

interface ViewHeaderProps {
  // Page name. No longer rendered as a heading (the top bar shows it) - kept
  // only as the accessible label for the tab strip.
  title: string;
  tabs?: readonly TabDef[];
  activeTab?: string;
  onTabChange?: (key: string, origin?: HTMLButtonElement) => void;
  onTabHover?: (key: string | null) => void;
  tabsDisabled?: boolean;
  /** Transient, right-aligned status. Never gets a row of its own: with a tab
   *  row it sits in the tab rail at label height, without one it floats at the
   *  header's top-right. Appearing or disappearing never changes the height. */
  actions?: ReactNode;
  /** Widget sitting immediately beside the tab bar, sharing the row's gap.
   *  Unlike `tabActions` it stays next to the tabs instead of pinning right. */
  tabsAdjacent?: ReactNode;
  /** Right-aligned widget sharing the tab row: the tab bar takes what it needs
   *  and this keeps its own width beside it. */
  tabActions?: ReactNode;
}

// Page-level tabs use the shared Tabs primitive so every tab bar in the app
// reads as one control. Text-only and icon+text tabs both flow through the
// single component.

export function ViewHeader({ title, tabs, activeTab, onTabChange, onTabHover, tabsDisabled, actions, tabActions, tabsAdjacent }: ViewHeaderProps) {
  const hasTabs = !!tabs && tabs.length > 0;
  const hasTabRow = hasTabs || !!tabActions || !!tabsAdjacent;
  return (
    <header className={styles.header}>
      {!hasTabRow && actions && <div className={styles.actionsFloat}>{actions}</div>}
      {hasTabRow && (
        <div className={styles.tabsRow}>
          {hasTabs && (
            <Tabs
              tabs={tabs}
              activeKey={activeTab ?? ''}
              onChange={(k, origin) => onTabChange?.(k, origin)}
              onHover={onTabHover}
              disabled={tabsDisabled}
              className={styles.viewHeaderTabs}
              ariaLabel={title}
            />
          )}
          {tabsAdjacent && (
            <div className={styles.tabsAdjacent}>{tabsAdjacent}</div>
          )}
          {(tabActions || actions) && (
            <div className={styles.tabActions}>
              {tabActions}
              {actions && <div className={styles.actionsInline}>{actions}</div>}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
