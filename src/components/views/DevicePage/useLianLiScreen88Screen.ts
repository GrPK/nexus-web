import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getLianLiScreen88Settings,
  setLianLiScreen88Settings,
  type LianLiScreen88Settings,
  type LianLiScreen88SettingsPatch,
} from '../../../api/lianliScreen88';

const SETTINGS_POLL_MS = 5000;
// While a Windows display switch is on its way the glass restarts; the page follows it sooner.
const SWITCH_POLL_MS = 1500;

export interface LianLiScreen88Screen {
  settings: LianLiScreen88Settings | null;
  /** The first read has come back (with or without an answer). */
  loaded: boolean;
  write: (patch: LianLiScreen88SettingsPatch) => Promise<void>;
  previewBrightness: (value: number) => void;
  commitBrightness: (value: number) => void;
  refresh: () => Promise<void>;
  /** The clip on the glass: a running screen saver, else the selected video in video mode. */
  playingClip: string | null;
}

/**
 * Polled Universal Screen 8.8 screen settings, shared by its section and the panel preview;
 * idle when disabled. The same rules as the OLED Curved's (useHydroShift2CurveScreen).
 */
export function useLianLiScreen88Screen(enabled: boolean): LianLiScreen88Screen {
  const [settings, setSettings] = useState<LianLiScreen88Settings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const aliveRef = useRef(true);
  // A poll issued before the latest write finished may carry the old value.
  const writesInFlightRef = useRef(0);
  const writeGenRef = useRef(0);
  const brightnessDirtyRef = useRef(false);
  const serverBrightnessRef = useRef<number | null>(null);
  const brightnessInFlightRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const gen = writeGenRef.current;
    const s = await getLianLiScreen88Settings();
    if (!aliveRef.current) return;
    setLoaded(true);
    if (!s) return;
    if (writesInFlightRef.current > 0 || gen !== writeGenRef.current) return;
    serverBrightnessRef.current = s.screenSaverBrightness;
    setSettings(prev => (prev && brightnessDirtyRef.current
      ? { ...s, screenSaverBrightness: prev.screenSaverBrightness }
      : s));
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    aliveRef.current = true;
    void refresh();
    return () => { aliveRef.current = false; };
  }, [enabled, refresh]);

  const switching = isScreen88Switching(settings);
  useEffect(() => {
    if (!enabled) return undefined;
    const id = window.setInterval(() => { if (!document.hidden) void refresh(); }, switching ? SWITCH_POLL_MS : SETTINGS_POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, switching, refresh]);

  const write = useCallback(async (patch: LianLiScreen88SettingsPatch) => {
    setSettings(prev => (prev ? { ...prev, ...patch } : prev));
    writesInFlightRef.current += 1;
    try {
      await setLianLiScreen88Settings(patch);
    } finally {
      writesInFlightRef.current -= 1;
      writeGenRef.current += 1;
    }
    await refresh();
  }, [refresh]);

  const previewBrightness = useCallback((value: number) => {
    brightnessDirtyRef.current = true;
    setSettings(prev => (prev ? { ...prev, screenSaverBrightness: value } : prev));
  }, []);

  const commitBrightness = useCallback((value: number) => {
    brightnessDirtyRef.current = false;
    if ((brightnessInFlightRef.current ?? serverBrightnessRef.current) === value) return;
    brightnessInFlightRef.current = value;
    void write({ screenSaverBrightness: value }).finally(() => {
      if (brightnessInFlightRef.current === value) brightnessInFlightRef.current = null;
    });
  }, [write]);

  const playingClip = settings?.connected
    ? (settings.playing ?? (settings.screenMode === 'video' ? settings.video ?? null : null))
    : null;

  return { settings, loaded, write, previewBrightness, commitBrightness, refresh, playingClip };
}

/** The glass sits in its own Windows display mode: a Windows monitor, not a Nexus panel. */
export function isScreen88InWindowsDisplay(settings: LianLiScreen88Settings | null): boolean {
  return !!settings && !settings.connected && settings.inWindowsDisplay;
}

/** The user asked for the other mode and the glass is not there yet. */
export function isScreen88Switching(settings: LianLiScreen88Settings | null): boolean {
  if (!settings) return false;
  const asWindows = isScreen88InWindowsDisplay(settings);
  return asWindows ? settings.windowsDisplay === false : settings.windowsDisplay === true;
}
