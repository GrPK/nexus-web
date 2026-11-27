import { createContext, type ReactNode } from 'react';

/**
 * The Logitech page's device switcher (G502 X PLUS / G915 X / G560). A Logitech device page shows
 * it at the right of its own tab row, so the Logitech page has one row of tabs, not two; null when
 * the page is open on its own.
 */
export const DeviceSwitcherContext = createContext<ReactNode>(null);
