import { useCallback, useEffect, useRef, useState } from 'react';
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
 */
export function usePanelBrightness(enabled: boolean, target: PanelBrightnessTarget | null) {
  const [value, setValue] = useState(0);
  const [available, setAvailable] = useState(false);
  const [linkDown, setLinkDown] = useState(false);
  const overrideUntil = useRef(0);
  const write = useRef<{ inFlight: boolean; queued: number | null; lastAt: number; timer: ReturnType<typeof setTimeout> | null }>({
    inFlight: false, queued: null, lastAt: 0, timer: null,
  });
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
        setLinkDown(isY70UsbDown(devices));
        setAvailable(true);
        if (b && typeof b.brightness === 'number' && Date.now() >= overrideUntil.current) setValue(b.brightness);
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

  const pumpRef = useRef<() => void>(() => {});
  const pump = useCallback(() => {
    const w = write.current;
    if (w.inFlight || w.queued == null) return;
    if (w.timer) { clearTimeout(w.timer); w.timer = null; }
    const wait = WRITE_INTERVAL_MS - (Date.now() - w.lastAt);
    if (wait > 0) { w.timer = setTimeout(() => pumpRef.current(), wait); return; }
    const next = w.queued;
    w.queued = null;
    w.inFlight = true;
    w.lastAt = Date.now();
    const req = kind === 'y70'
      ? postService('/y70/brightness', { brightness: next })
      : displayId ? setDisplayBrightness(displayId, next) : Promise.resolve(null);
    void req.catch(() => null).finally(() => { w.inFlight = false; pumpRef.current(); });
  }, [kind, displayId]);
  useEffect(() => { pumpRef.current = pump; }, [pump]);

  useEffect(() => () => {
    const w = write.current;
    if (w.timer) clearTimeout(w.timer);
    w.timer = null;
  }, []);

  const preview = useCallback((v: number) => {
    overrideUntil.current = Date.now() + OVERRIDE_MS;
    setValue(Math.max(0, Math.min(100, Math.round(v))));
  }, []);

  const commit = useCallback((v: number) => {
    overrideUntil.current = Date.now() + OVERRIDE_MS;
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    setValue(clamped);
    write.current.queued = clamped;
    write.current.lastAt = 0;
    pump();
  }, [pump]);

  return { available, linkDown, value, preview, commit };
}
