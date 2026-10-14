import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSystemMic, setSystemMicMuted, setSystemMicVolume } from '../api/mic';
import type { SystemVolumeState } from './useSystemVolume';

const DEFAULT_STATE: SystemVolumeState = { supported: false, volume: 0, muted: false };
const WRITE_INTERVAL_MS = 80;
const OVERRIDE_MS = 1500;

/**
 * Default capture device level + mute. Polls while enabled (there is no live
 * topic for it); drag writes are coalesced to the latest value, and a local
 * edit outranks a poll for a moment so the fader does not snap back.
 */
export function useSystemMic(enabled: boolean, pollMs = 2000) {
  const [state, setState] = useState<SystemVolumeState>(DEFAULT_STATE);
  const overrideUntil = useRef(0);
  const write = useRef<{ inFlight: boolean; queued: number | null; lastAt: number; timer: ReturnType<typeof setTimeout> | null }>({
    inFlight: false, queued: null, lastAt: 0, timer: null,
  });

  const refresh = useCallback(async () => {
    const data = await fetchSystemMic();
    if (!data || Date.now() < overrideUntil.current) return;
    setState({
      supported: !!data.supported,
      volume: typeof data.volume === 'number' ? data.volume : 0,
      muted: !!data.muted,
    });
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      await refresh();
      if (!cancelled) timer = setTimeout(tick, pollMs);
    };
    void tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [enabled, pollMs, refresh]);

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
    void setSystemMicVolume(next).finally(() => { w.inFlight = false; pumpRef.current(); });
  }, []);
  useEffect(() => { pumpRef.current = pump; }, [pump]);

  useEffect(() => () => {
    const w = write.current;
    if (w.timer) clearTimeout(w.timer);
    w.timer = null;
  }, []);

  const previewVolume = useCallback((v: number) => {
    overrideUntil.current = Date.now() + OVERRIDE_MS;
    setState(s => ({ ...s, volume: Math.max(0, Math.min(1, v)) }));
  }, []);

  const commitVolume = useCallback((v: number) => {
    overrideUntil.current = Date.now() + OVERRIDE_MS;
    const clamped = Math.max(0, Math.min(1, v));
    setState(s => ({ ...s, volume: clamped }));
    write.current.queued = clamped;
    write.current.lastAt = 0;
    pump();
  }, [pump]);

  const setMuted = useCallback(async (muted: boolean) => {
    overrideUntil.current = Date.now() + OVERRIDE_MS;
    setState(s => ({ ...s, muted }));
    await setSystemMicMuted(muted);
  }, []);

  return { state, previewVolume, commitVolume, setMuted };
}
