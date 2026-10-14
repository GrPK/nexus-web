import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bluetooth, Lock, Mic, MicOff, MonitorOff, Moon, Pause, Plane, Play, Power, SkipBack, SkipForward, Sun, Volume2, VolumeX, Wifi,
} from 'lucide-react';
import { cssPxPerMm } from '../engine/panelGrid';
import {
  CONTROL_CENTER_COMMIT_MM,
  CONTROL_CENTER_DISMISS_MM,
  CONTROL_CENTER_ENGAGE_MM,
  CONTROL_CENTER_FLICK_MM_PER_MS,
  controlCenterBandPx,
  controlCenterGestureEnabled,
  inControlCenterBand,
  oppositeThemeMode,
  readSafeAreaTopPx,
} from '../engine/controlCenterGesture';
import { usePanelControlCenterSwipe } from '../engine/usePanelControlCenterSwipe';
import { LONG_PRESS_MOVE_THRESHOLD } from '../engine/useLongPress';
import { useTouchViaPointer, type GestureContact } from '../engine/touchViaPointer';
import { usePanelImmersiveOpen } from '../widgets/common/PanelImmersiveContext';
import { PanelMixerSlider } from '../widgets/common/PanelMixerSlider';
import { IconLabelButton } from '../../components/common/IconLabelButton/IconLabelButton';
import { useTranslation } from '../../lib/i18n';
import { useUnitPrefs } from '../../hooks/useUiSettings';
import { resolveHour12 } from '../../lib/units';
import { useSystemVolume } from '../../hooks/useSystemVolume';
import { useSystemMic } from '../../hooks/useSystemMic';
import { usePanelBrightness, brightnessTargetFor } from '../../hooks/usePanelBrightness';
import { controlActiveMedia, useMedia, type MediaSession } from '../../hooks/useMedia';
import { systemPower } from '../../api/system';
import { fetchRadios, setRadio, type RadioKind, type RadiosState } from '../../api/radios';
import type { PanelSurface } from '../types';
import { ControlCenterMixerView } from './ControlCenterMixerView';
import styles from './PanelControlCenter.module.scss';

// Hold on the volume fader this long, without moving, for the per-app mixer.
const MIXER_LONG_PRESS_MS = 600;
const RADIOS_POLL_MS = 2000;

interface PanelControlCenterProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  surface: PanelSurface;
  deviceTouch?: boolean;
  kioskBehavior: boolean;
  // The gesture surface, shared with the actions tray.
  surfaceRef: React.RefObject<HTMLElement | null>;
  // The panel record's display id, when this panel is a promoted monitor.
  displayId?: string;
  isLandscape: boolean;
  resolvedThemeMode: 'dark' | 'light';
  onSetThemeMode: (mode: 'dark' | 'light') => void;
  onScreenSleep: () => void;
  // Reasons the gesture must not arm, owned by the host.
  sheetOpen: boolean;
  trayOpen: boolean;
  offline: boolean;
  rearranging: boolean;
  dragArmed: boolean;
  asleep: boolean;
}

export function activeMediaSession(sessions: Record<string, MediaSession>): MediaSession | null {
  const list = Object.values(sessions);
  if (list.length === 0) return null;
  return list.find(s => s.playback?.playing && !s.playback?.stopped) ?? list[0];
}

export function PanelControlCenter({
  open,
  onOpen,
  onClose,
  surface,
  deviceTouch,
  kioskBehavior,
  surfaceRef,
  displayId,
  isLandscape,
  resolvedThemeMode,
  onSetThemeMode,
  onScreenSleep,
  sheetOpen,
  trayOpen,
  offline,
  rearranging,
  dragArmed,
  asleep,
}: PanelControlCenterProps) {
  const { t, language } = useTranslation();
  const immersiveOpen = usePanelImmersiveOpen();
  const sheetRef = useRef<HTMLElement | null>(null);

  const gate = controlCenterGestureEnabled({
    surface, deviceTouch, kioskBehavior, immersiveOpen, sheetOpen, trayOpen, offline, rearranging, dragArmed, asleep,
  });

  // Anything that makes the gesture illegal also puts the sheet away.
  useEffect(() => {
    if (open && !gate) onClose();
  }, [open, gate, onClose]);

  const pxPerMm = useMemo(() => cssPxPerMm(surface), [surface]);
  const [safeTop, setSafeTop] = useState(0);
  useEffect(() => {
    if (!gate) return undefined;
    const measure = () => setSafeTop(readSafeAreaTopPx());
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [gate]);
  const bandPx = controlCenterBandPx(pxPerMm, safeTop);

  const openSwipe = usePanelControlCenterSwipe({
    enabled: gate && !open,
    surfaceRef,
    direction: 'down',
    engagePx: CONTROL_CENTER_ENGAGE_MM * pxPerMm,
    commitPx: CONTROL_CENTER_COMMIT_MM * pxPerMm,
    flickPxPerMs: CONTROL_CENTER_FLICK_MM_PER_MS * pxPerMm,
    shouldYield: useCallback((c: GestureContact) => !inControlCenterBand(c.clientY, bandPx), [bandPx]),
    onCommit: onOpen,
  });

  const dismissSwipe = usePanelControlCenterSwipe({
    enabled: gate && open,
    surfaceRef: sheetRef,
    direction: 'up',
    engagePx: CONTROL_CENTER_ENGAGE_MM * pxPerMm,
    commitPx: CONTROL_CENTER_DISMISS_MM * pxPerMm,
    flickPxPerMs: CONTROL_CENTER_FLICK_MM_PER_MS * pxPerMm,
    // A fader or horizontal control owns its own drag.
    shouldYield: useCallback((c: GestureContact) => (
      c.target instanceof Element
      && Boolean(c.target.closest('input, [role="slider"], [data-panel-horizontal-control="true"]'))
    ), []),
    onCommit: onClose,
  });

  const { reset: resetOpenSwipe } = openSwipe;
  useEffect(() => {
    if (!gate || open) resetOpenSwipe();
  }, [gate, open, resetOpenSwipe]);

  const opening = openSwipe.state === 'dragging' && !open;
  const dismissing = dismissSwipe.state === 'dragging' && open;
  const dragProgress = opening ? Math.min(1, openSwipe.offset / (CONTROL_CENTER_COMMIT_MM * pxPerMm * 2)) : 0;
  const showScrim = open || opening;

  const [view, setView] = useState<'main' | 'mixer'>('main');
  useEffect(() => { if (!open) setView('main'); }, [open]);

  // The body stays mounted through the close slide so the content does not vanish mid-motion.
  const [bodyMounted, setBodyMounted] = useState(false);
  const visible = open || opening;
  useEffect(() => {
    if (visible) { setBodyMounted(true); return undefined; }
    const id = setTimeout(() => setBodyMounted(false), 320);
    return () => clearTimeout(id);
  }, [visible]);

  const sheetStyle = opening
    // Follows the finger from fully hidden; --cc-zoom converts the pointer
    // delta back where the sheet is zoomed.
    ? { transform: `translateY(min(0px, calc(-100% + ${openSwipe.offset}px / var(--cc-zoom, 1))))` }
    : dismissing
      ? { transform: `translateY(calc(${-dismissSwipe.offset}px / var(--cc-zoom, 1)))` }
      : undefined;

  return (
    <>
      {showScrim && (
        <div
          className={styles.scrim}
          data-visible={open ? 'true' : undefined}
          data-dragging={opening || dismissing ? 'true' : undefined}
          style={opening ? { opacity: dragProgress } : dismissing ? { opacity: Math.max(0, 1 - dismissSwipe.offset / (CONTROL_CENTER_DISMISS_MM * pxPerMm * 3)) } : undefined}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        ref={sheetRef}
        className={styles.sheet}
        data-state={open ? (dismissing ? 'dragging' : 'open') : (opening ? 'dragging' : 'closed')}
        data-landscape={isLandscape ? 'true' : undefined}
        style={sheetStyle}
        aria-label={t('panel.controlCenter.label')}
        aria-hidden={!open && !opening ? true : undefined}
        onClick={(e) => {
          if (!open) return;
          const target = e.target instanceof Element ? e.target : null;
          if (!target?.closest('[data-cc-keep="true"]')) onClose();
        }}
      >
        {bodyMounted ? (
          <ControlCenterBody
            open={open}
            view={view}
            setView={setView}
            language={language}
            surface={surface}
            displayId={displayId}
            resolvedThemeMode={resolvedThemeMode}
            onSetThemeMode={onSetThemeMode}
            onClose={onClose}
            onScreenSleep={onScreenSleep}
          />
        ) : null}
      </aside>
    </>
  );
}

interface BodyProps {
  open: boolean;
  view: 'main' | 'mixer';
  setView: (v: 'main' | 'mixer') => void;
  language: string;
  surface: PanelSurface;
  displayId?: string;
  resolvedThemeMode: 'dark' | 'light';
  onSetThemeMode: (mode: 'dark' | 'light') => void;
  onClose: () => void;
  onScreenSleep: () => void;
}

function ControlCenterBody({
  open, view, setView, language, surface, displayId, resolvedThemeMode, onSetThemeMode, onClose, onScreenSleep,
}: BodyProps) {
  const { t } = useTranslation();
  const touchViaPointer = useTouchViaPointer();

  // Clock header: follows the app's time-format setting.
  const { timeFormat } = useUnitPrefs();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const timeText = useMemo(
    () => new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit', hour12: resolveHour12(timeFormat) }).format(now),
    [now, language, timeFormat],
  );
  const dateText = useMemo(
    () => new Intl.DateTimeFormat(language, { weekday: 'long', month: 'long', day: 'numeric' }).format(now),
    [now, language],
  );

  const brightness = usePanelBrightness(true, brightnessTargetFor(surface, displayId));
  const volume = useSystemVolume(true, null, 2000);
  const mic = useSystemMic(true);

  const [radios, setRadios] = useState<RadiosState | null>(null);
  // Re-read every 2 s while the sheet is open: Wi-Fi and Bluetooth can come
  // back after an airplane-off POST returned, and the OS can change them too.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const r = await fetchRadios().catch(() => null);
      if (cancelled) return;
      if (r) setRadios(r);
      timer = setTimeout(tick, RADIOS_POLL_MS);
    };
    void tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open]);
  // The read-back state is the truth: no rollback on a mismatch, the next
  // read corrects whatever the optimistic flip got wrong.
  const toggleRadio = (kind: RadioKind) => {
    const current = radios?.[kind];
    if (!current) return;
    setRadios(prev => (prev ? { ...prev, [kind]: { on: !current.on } } : prev));
    void setRadio(kind, !current.on)
      .then(r => { if (r) setRadios(r); })
      .catch(() => {});
  };

  const media = useMedia(true);
  const session = activeMediaSession(media.sessions);

  // Long-press on the volume fader opens the per-app mixer. The fader jumps to
  // the touch point on press, so a press that turns into a hold restores the
  // level it started from.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdOrigin = useRef({ x: 0, y: 0, volume: 0 });
  const clearHold = useCallback(() => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
  }, []);
  useEffect(() => clearHold, [clearHold]);
  const volumeRef = useRef(volume);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  const onVolumeDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && !touchViaPointer) return;
    // A press on the mute button is a tap, not a hold.
    if (e.target instanceof Element && e.target.closest('button')) return;
    clearHold();
    holdOrigin.current = { x: e.clientX, y: e.clientY, volume: volumeRef.current.state.volume };
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      volumeRef.current.commitVolume(holdOrigin.current.volume, { flush: true });
      setView('mixer');
    }, MIXER_LONG_PRESS_MS);
  };
  const onVolumeMove = (e: React.PointerEvent) => {
    if (!holdTimer.current) return;
    const dx = e.clientX - holdOrigin.current.x;
    const dy = e.clientY - holdOrigin.current.y;
    if (dx * dx + dy * dy > LONG_PRESS_MOVE_THRESHOLD * LONG_PRESS_MOVE_THRESHOLD) clearHold();
  };

  if (view === 'mixer') {
    return (
      <div className={styles.content} data-landscape-hint="mixer">
        <ControlCenterMixerView onBack={() => setView('main')} />
      </div>
    );
  }

  const showBrightness = brightness.available;
  const showMic = mic.state.supported;
  const volPct = Math.round(volume.state.volume * 100);
  const micPct = Math.round(mic.state.volume * 100);
  const dark = resolvedThemeMode === 'dark';

  return (
    <div className={styles.content} data-open={open ? 'true' : undefined}>
      <div className={styles.clock}>
        <div className={styles.time}>{timeText}</div>
        <div className={styles.date}>{dateText}</div>
      </div>

      <div className={styles.card} data-cc-keep="true">
        <div className={styles.faders}>
          {showBrightness && (
            <PanelMixerSlider
              className={styles.fader}
              min={0}
              max={100}
              value={brightness.value}
              disabled={brightness.linkDown}
              showValue
              valueLabel={`${brightness.value}`}
              topLabel={t('panel.controlCenter.brightness')}
              icon={<Sun strokeWidth={1.7} />}
              ariaLabel={t('panel.controlCenter.brightness')}
              onChange={brightness.preview}
              onCommit={brightness.commit}
            />
          )}
          {showMic && (
            <PanelMixerSlider
              className={styles.fader}
              min={0}
              max={100}
              value={micPct}
              showValue
              valueLabel={`${micPct}`}
              topLabel={t('panel.controlCenter.mic')}
              icon={mic.state.muted ? <MicOff strokeWidth={1.7} /> : <Mic strokeWidth={1.7} />}
              iconButton={{
                ariaLabel: mic.state.muted ? t('panel.controlCenter.mic.unmute') : t('panel.controlCenter.mic.mute'),
                ariaPressed: mic.state.muted,
                active: mic.state.muted,
                onClick: () => { void mic.setMuted(!mic.state.muted); },
              }}
              ariaLabel={t('panel.controlCenter.mic')}
              onChange={v => mic.previewVolume(v / 100)}
              onCommit={v => mic.commitVolume(v / 100)}
            />
          )}
          {volume.state.supported && (
            <div
              className={styles.holdWrap}
              // Capture phase: the fader stops its pointer events from bubbling.
              onPointerDownCapture={onVolumeDown}
              onPointerMoveCapture={onVolumeMove}
              onPointerUpCapture={clearHold}
              onPointerCancelCapture={clearHold}
              title={t('panel.controlCenter.volume.hint')}
            >
              <PanelMixerSlider
                className={styles.fader}
                min={0}
                max={100}
                value={volPct}
                showValue
                valueLabel={`${volPct}`}
                topLabel={t('panel.controlCenter.volume')}
                icon={volume.state.muted ? <VolumeX strokeWidth={1.7} /> : <Volume2 strokeWidth={1.7} />}
                iconButton={{
                  ariaLabel: volume.state.muted ? t('panel.controlCenter.volume.unmute') : t('panel.controlCenter.volume.mute'),
                  ariaPressed: volume.state.muted,
                  active: volume.state.muted,
                  onClick: () => { void volume.setMuted(!volume.state.muted); },
                }}
                ariaLabel={t('panel.controlCenter.volume')}
                onChange={v => volume.previewVolume(v / 100)}
                onCommit={v => volume.commitVolume(v / 100, { flush: true })}
              />
            </div>
          )}
        </div>
        {showBrightness && brightness.linkDown && (
          <div className={styles.notice} role="status">{t('panel.controlCenter.brightness.usbDown')}</div>
        )}
      </div>

      <div className={styles.card} data-cc-keep="true">
        <div className={styles.grid}>
          {radios?.wifi && (
            <IconLabelButton
              className={styles.tile}
              icon={<Wifi />}
              label={t('panel.controlCenter.wifi')}
              active={radios.wifi.on}
              onPress={() => toggleRadio('wifi')}
            />
          )}
          {radios?.bluetooth && (
            <IconLabelButton
              className={styles.tile}
              icon={<Bluetooth />}
              label={t('panel.controlCenter.bluetooth')}
              active={radios.bluetooth.on}
              onPress={() => toggleRadio('bluetooth')}
            />
          )}
          {radios?.airplane && (
            <IconLabelButton
              className={styles.tile}
              icon={<Plane />}
              label={t('panel.controlCenter.airplane')}
              active={radios.airplane.on}
              onPress={() => toggleRadio('airplane')}
            />
          )}
          <IconLabelButton
            className={styles.tile}
            icon={dark ? <Moon /> : <Sun />}
            label={t('panel.controlCenter.darkMode')}
            active={dark}
            onPress={() => onSetThemeMode(oppositeThemeMode(resolvedThemeMode))}
          />
          <IconLabelButton
            className={styles.tile}
            icon={<Lock />}
            label={t('panel.controlCenter.lockPc')}
            onPress={() => { void systemPower('lock'); onClose(); }}
          />
          <IconLabelButton
            className={styles.tile}
            icon={<Power />}
            label={t('panel.controlCenter.sleepPc')}
            onPress={() => { void systemPower('sleep'); onClose(); }}
          />
          <IconLabelButton
            className={styles.tile}
            icon={<MonitorOff />}
            label={t('panel.controlCenter.screenSleep')}
            onPress={() => { onClose(); onScreenSleep(); }}
          />
        </div>
      </div>

      {session && (
        <div className={styles.card} data-cc-keep="true">
          <div className={styles.media}>
            <div className={styles.mediaText}>
              <div className={styles.mediaTitle}>{session.song.title}</div>
              <div className={styles.mediaArtist}>{session.song.artist}</div>
            </div>
            <div className={styles.mediaButtons}>
              <IconLabelButton
                className={styles.mediaButton}
                variant="bare"
                icon={<SkipBack />}
                ariaLabel={t('panel.controlCenter.media.previous')}
                onPress={() => { void controlActiveMedia('previous'); }}
              />
              <IconLabelButton
                className={styles.mediaButton}
                variant="bare"
                icon={session.playback.playing ? <Pause /> : <Play />}
                ariaLabel={t('panel.controlCenter.media.playPause')}
                onPress={() => { void controlActiveMedia('playpause'); }}
              />
              <IconLabelButton
                className={styles.mediaButton}
                variant="bare"
                icon={<SkipForward />}
                ariaLabel={t('panel.controlCenter.media.next')}
                onPress={() => { void controlActiveMedia('next'); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
