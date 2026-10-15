import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSystemMic, setSystemMicMuted, setSystemMicVolume } from '../api/mic';
import { useLatestWriter } from './useLatestWriter';
import type { SystemVolumeState } from './useSystemVolume';

const DEFAULT_STATE: SystemVolumeState = { supported: false, volume: 0, muted: false };
const WRITE_INTERVAL_MS = 80;
const OVERRIDE_MS = 1500;

/**
 * Default capture device level + mute. Polls while enabled (there is no live
 * topic for it). The fader writes live during a drag, coalesced to the latest
 * value, and the release flushes at once. A local edit outranks a poll for a
 * moment so the fader does not snap back.
 */
export function useSystemMic(enabled: boolean, pollMs = 2000) {
  const [state, setState] = useState<SystemVolumeState>(DEFAULT_STATE);
  const overrideUntil = useRef(0);

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

  const write = useLatestWriter(setSystemMicVolume, WRITE_INTERVAL_MS);

  const previewVolume = useCallback((v: number) => {
    overrideUntil.current = Date.now() + OVERRIDE_MS;
    const clamped = Math.max(0, Math.min(1, v));
    setState(s => ({ ...s, volume: clamped }));
    write(clamped);
  }, [write]);

  const commitVolume = useCallback((v: number) => {
    overrideUntil.current = Date.now() + OVERRIDE_MS;
    const clamped = Math.max(0, Math.min(1, v));
    setState(s => ({ ...s, volume: clamped }));
    write(clamped, true);
  }, [write]);

  const setMuted = useCallback(async (muted: boolean) => {
    overrideUntil.current = Date.now() + OVERRIDE_MS;
    setState(s => ({ ...s, muted }));
    await setSystemMicMuted(muted);
  }, []);

  return { state, previewVolume, commitVolume, setMuted };
}
