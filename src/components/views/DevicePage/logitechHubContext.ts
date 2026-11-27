import { createContext } from 'react';

/**
 * True for a Logitech device page shown inside the Logitech page: that page's own tab row picks the
 * device, so the device page leaves out its header and shows all its sections one under the other.
 */
export const InLogitechHub = createContext(false);
