import { useCallback, useEffect, useRef, useState } from 'react';
import { useLatestWriter } from './useLatestWriter';
import { fetchService, postService } from '../api/service';
import { fetchDisplayBrightness, setDisplayBrightness } from '../api/displays';
import type { DeviceListItem } from './useDevices';

export type PanelBrightnessKind = 'y70' | 'display';

export interface PanelBrightnessTarget {
  kind: PanelBrightnessKind;
  // Required for 'display'.
  displayId?: string;
}

// Which hardware path a surface's brightness slider drives: the Y70's own
// backlight, a promoted touch monitor over DDC, or nothing.
export function brightnessTargetFor(surface: string, displayId: string | undefined): PanelBrightnessTarget | null {
  if (surface === 'y70') return { kind: 'y70' };
  if (displayId) return { kind: 'display', displayId };
  return null;
}

// The Y70 shows this device warning while only its video link is up.
export function isY70UsbDown(devices: DeviceListItem[] | null): boolean {
  const y70 = devices?.find(d => d.id === 'y70');
  return y70?.warning === 'usb-disconnected';
}

const WRITE_INTERVAL_MS = 120;
const OVERRIDE_MS = 1500;

/**
 * Brightness for the surface this panel runs on, 0-100. `available` is false
 * until a read proves the control exists (hidden then); `linkDown` is the
 * Y70's USB link warning, which disables the slider with an inline notice.
 * Reads again each time `enabled` turns on. The slider writes live during a
 * drag (coalesced) and the release flushes.
 */
export function usePanelBrightness(enabled: boolean, target: PanelBrightnessTarget | null) {
  const [value, setValue] = useState(0);
  const [available, setAvailable] = useState(false);
  const [linkDown, setLinkDown] = useState(false);
  const overrideUntil = useRef(0);
  const kind = target?.kind ?? null;
  const displayId = target?.displayId;

  useEffect(() => {
    if (!enabled || !kind) return undefined;
    let cancelled = false;
    void (async () => {
      if (kind === 'y70') {
        const [b, devices] = await Promise.all([
          fetchService<{ brightness: number }>('/y70/brightness').catch(() => null),
          fetchService<DeviceListItem[]>('/devices/all').catch(() => null),
        ]);
        if (cancelled) return;
        const down = isY70UsbDown(devices);
        const read = !!b && typeof b.brightness === 'number';
        setLinkDown(down);
        // A failed read hides the slider, unless the link warning explains it.
        setAvailable(read || down);
        if (read && b && Date.now() >= overrideUntil.current) setValue(b.brightness);
      } else if (displayId) {
        const b = await fetchDisplayBrightness(displayId).catch(() => null);
        if (cancelled) return;
        const ok = !!b && b.status !== 'unsupported' && typeof b.brightness === 'number';
        setAvailable(ok);
        if (ok && b && Date.now() >= overrideUntil.current) setValue(b.brightness);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, kind, displayId]);

  const send = useCallback((v: number) => (kind === 'y70'
    ? postService('/y70/brightness', { brightness: v })
    : displayId ? setDisplayBrightness(displayId, v) : Promise.resolve(null)), [kind, displayId]);
  const write = useLatestWriter(send, WRITE_INTERVAL_MS);

  const preview = useCallback((v: number) => {
    overrideUntil.current = Date.now() + OVERRIDE_MS;
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    setValue(clamped);
    write(clamped);
  }, [write]);

  const commit = useCallback((v: number) => {
    overrideUntil.current = Date.now() + OVERRIDE_MS;
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    setValue(clamped);
    write(clamped, true);
  }, [write]);

  return { available, linkDown, value, preview, commit };
}
