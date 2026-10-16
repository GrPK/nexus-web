// The id of the panel device record the widget tree renders for. Null outside
// a real panel (desktop dashboard, previews), where per-panel state falls back
// to the desktop's own. PanelKioskContent provides it.
import { createContext, useContext } from 'react';

const PanelDeviceIdContext = createContext<string | null>(null);

export function usePanelDeviceId(): string | null {
  return useContext(PanelDeviceIdContext);
}

export const PanelDeviceIdProvider = PanelDeviceIdContext.Provider;
