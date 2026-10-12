import { getTokenSync } from '../api/auth';

export const PANEL_DEVICE_ID_KEY = 'nexus_panel_device_id';
const PANEL_DEVICE_IDS_KEY = 'nexus_panel_device_ids';
export const PHONE_PANEL_PWA_KEY = 'nexus_phone_panel_pwa';
export const RESERVED_PANEL_PATH_SEGMENTS = new Set(['phone', 'q60', 'devices']);

export function shouldForcePhonePanelRoute() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  if (!standalone) return false;
  if (window.location.pathname.startsWith('/panel')) return false;
  return localStorage.getItem(PHONE_PANEL_PWA_KEY) === '1';
}

// The Android app loads every PC from one loopback origin, so one slot would
// make each PC switch allocate a fresh default layout. Ids are keyed by a hash
// of the PC's session token; PANEL_DEVICE_ID_KEY stays as the fallback.
function pcKey(): string | null {
  const token = getTokenSync();
  if (!token) return null;
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function readIdMap(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PANEL_DEVICE_IDS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

export function readCachedPanelDeviceId(): string | null {
  const key = pcKey();
  return (key && readIdMap()[key]) || localStorage.getItem(PANEL_DEVICE_ID_KEY);
}

export function writeCachedPanelDeviceId(id: string): void {
  localStorage.setItem(PANEL_DEVICE_ID_KEY, id);
  const key = pcKey();
  if (!key) return;
  localStorage.setItem(PANEL_DEVICE_IDS_KEY, JSON.stringify({ ...readIdMap(), [key]: id }));
}

export function forgetCachedPanelDeviceId(id: string): void {
  if (localStorage.getItem(PANEL_DEVICE_ID_KEY) === id) localStorage.removeItem(PANEL_DEVICE_ID_KEY);
  const key = pcKey();
  const map = readIdMap();
  if (!key || map[key] !== id) return;
  delete map[key];
  localStorage.setItem(PANEL_DEVICE_IDS_KEY, JSON.stringify(map));
}
