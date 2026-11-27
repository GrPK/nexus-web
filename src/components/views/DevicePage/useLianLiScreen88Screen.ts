import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  getLianLiScreen88Settings,
  setLianLiScreen88Settings,
  type LianLiScreen88Settings,
  type LianLiScreen88SettingsPatch,
} from '../../../api/lianliScreen88';
import { useTopicCallback } from '../../../hooks/useMultiplexSocket';

/**
 * Pushes after which the 8.8's settings are read again; nothing is read on a timer. `devices`
 * fires when the USB set changes (the glass turning between 1CBE:A088 and 1A86:AD21),
 * `panel/device` when its panel comes or goes, and `lianli-screen88` is the service's own
 * notice that the glass changed mode.
 */
export const SCREEN88_PUSH_TOPICS = ['devices', 'panel/device', 'lianli-screen88'] as const;

/** Where a Windows display switch the user pressed is going, until the service shows the glass there. */
export type Screen88Mode = 'windows' | 'panel';

// One 8.8 per PC, so a press is shared: its page, its section and the Lian Li page all follow it at once.
let pendingMode: Screen88Mode | null = null;
let giveUpTimer: ReturnType<typeof setTimeout> | undefined;
const pendingListeners = new Set<() => void>();
// A switch the glass never makes (L-Connect holds it, Nexus Control is off) stops showing as restarting.
const SWITCH_GIVE_UP_MS = 60_000;

function setPendingMode(next: Screen88Mode | null): void {
  if (giveUpTimer !== undefined) clearTimeout(giveUpTimer);
  giveUpTimer = next ? setTimeout(() => setPendingMode(null), SWITCH_GIVE_UP_MS) : undefined;
  if (pendingMode === next) return;
  pendingMode = next;
  pendingListeners.forEach(listener => listener());
}

function subscribePending(listener: () => void): () => void {
  pendingListeners.add(listener);
  return () => { pendingListeners.delete(listener); };
}

/** Forgets a pressed switch (a test between cases). */
export function resetScreen88PendingMode(): void {
  setPendingMode(null);
}

/** The settings show the glass where a pressed switch was going. */
function reached(mode: Screen88Mode, settings: LianLiScreen88Settings): boolean {
  return mode === 'windows' ? isScreen88InWindowsDisplay(settings) : settings.connected;
}

export interface LianLiScreen88Screen {
  settings: LianLiScreen88Settings | null;
  /** The first read has come back (with or without an answer). */
  loaded: boolean;
  /** A Windows display switch the user pressed and the glass has not finished yet. */
  pendingMode: Screen88Mode | null;
  /** What the page shows: the mode a pressed switch is going to, else the glass's own. */
  view: 'windows' | 'panel' | 'restarting' | 'none';
  write: (patch: LianLiScreen88SettingsPatch) => Promise<void>;
  /** Asks the service for the other mode and shows it at once; the glass restarts meanwhile. */
  switchWindowsDisplay: (on: boolean) => Promise<void>;
  /** Shows a change the page made elsewhere (a new mount) before the service confirms it. */
  assume: (patch: Partial<LianLiScreen88Settings>) => void;
  previewBrightness: (value: number) => void;
  commitBrightness: (value: number) => void;
  refresh: () => Promise<void>;
  /** The clip on the glass: a running screen saver, else the selected video in video mode. */
  playingClip: string | null;
}

/**
 * The Universal Screen 8.8's screen settings, shared by its page, its section and the Lian Li page;
 * idle when disabled. Read on mount, after a write, when the page becomes visible again and on
 * the service's pushes, never on a timer. The OLED Curved's rules otherwise (useHydroShift2CurveScreen).
 */
export function useLianLiScreen88Screen(enabled: boolean): LianLiScreen88Screen {
  const [settings, setSettings] = useState<LianLiScreen88Settings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const pending = useSyncExternalStore(subscribePending, () => pendingMode, () => null);
  const aliveRef = useRef(true);
  // A read issued before the latest write finished may carry the old value.
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
    if (pendingMode && reached(pendingMode, s)) setPendingMode(null);
    setSettings(prev => (prev && brightnessDirtyRef.current
      ? { ...s, screenSaverBrightness: prev.screenSaverBrightness }
      : s));
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    aliveRef.current = true;
    void refresh();
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      aliveRef.current = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refresh]);

  const onPush = useCallback(() => { void refresh(); }, [refresh]);
  useTopicCallback(SCREEN88_PUSH_TOPICS[0], enabled, onPush);
  useTopicCallback(SCREEN88_PUSH_TOPICS[1], enabled, onPush);
  useTopicCallback(SCREEN88_PUSH_TOPICS[2], enabled, onPush);

  // A switch given up on shows the glass as the service last said; read it once more.
  const hadPendingRef = useRef(pending !== null);
  useEffect(() => {
    if (enabled && hadPendingRef.current && pending === null) void refresh();
    hadPendingRef.current = pending !== null;
  }, [enabled, pending, refresh]);

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

  const switchWindowsDisplay = useCallback(async (on: boolean) => {
    setPendingMode(on ? 'windows' : 'panel');
    await write({ windowsDisplay: on });
  }, [write]);

  const assume = useCallback((patch: Partial<LianLiScreen88Settings>) => {
    setSettings(prev => (prev ? { ...prev, ...patch } : prev));
  }, []);

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

  const view = screen88View(settings, pending);
  const playingClip = view === 'panel' && settings
    ? (settings.playing ?? (settings.screenMode === 'video' ? settings.video ?? null : null))
    : null;

  return { settings, loaded, pendingMode: pending, view, write, switchWindowsDisplay, assume, previewBrightness, commitBrightness, refresh, playingClip };
}

/** The glass sits in its own Windows display mode: a Windows monitor, not a Nexus panel. */
export function isScreen88InWindowsDisplay(settings: LianLiScreen88Settings | null): boolean {
  return !!settings && !settings.connected && settings.inWindowsDisplay;
}

/**
 * What the 8.8's page shows. A pressed switch shows its target at once: a Windows display, or,
 * on the way back, the switch alone while the glass restarts as a panel. Otherwise the glass's
 * own mode from the settings route; 'none' when it is neither a panel nor a Windows display.
 */
export function screen88View(settings: LianLiScreen88Settings | null, pending: Screen88Mode | null): 'windows' | 'panel' | 'restarting' | 'none' {
  if (pending === 'windows') return 'windows';
  if (pending === 'panel') return settings?.connected ? 'panel' : 'restarting';
  if (isScreen88InWindowsDisplay(settings)) return 'windows';
  return settings?.connected ? 'panel' : 'none';
}
