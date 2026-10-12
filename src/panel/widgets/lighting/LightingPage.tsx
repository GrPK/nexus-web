import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ban, CheckCheck, Eye, EyeOff, ExternalLink, Gamepad2, Lightbulb, Music, Pause, Play, PanelRightOpen, PanelRightClose } from 'lucide-react';
import {
  startAnimate, startStatic, startScreenMirror, stopLighting, startGameSync,
  fetchStaticSettings,
  fetchLightingDevices, fetchAnimateSettings, saveAnimateTemplates,
  fetchAnimateDefaults, cachedAnimateDefaults,
  fetchMusicReactive, setMusicReactive, setLightingDevicePower, setLightingDeviceControlled,
  renameLightingDevice, saveLightingGroups, saveLightingStacks, saveDeviceLayout,
  fetchScreenEffect, setScreenEffect, fetchMediaEffect, setMediaEffect, fetchLedMap,
  fetchCurrentSync, fetchAvailableMappings, fetchGameSyncState, fetchGameSyncGames,
  steamArtworkUrl, resolveActiveGame, setLightingPaused,
  resetDeviceLayouts, applyDeviceLayouts, setActiveLayoutPreset, updateLayoutPreset, identifyLightingDevice,
  type LightingDevice, type LedMapEntry, type Pin, type PostProcessSettings, type GameSyncDevice,
  type GameSyncGame, type DeviceLayoutDto, type PresetApp,
} from '../../../api/lighting';
import { groupNamesOf, type DeviceGroup } from '../../../lib/deviceGroups';
import { matchesAllWords } from '../../../search/match';
import { RailSearchButton, RailSearchField, useRailSearch } from '../../../components/common/RailSearch/RailSearch';
import { useUndoRedo } from '../../../hooks/useUndoRedo';
import { useLayoutPresets, devicesToLayouts, devicesToPower } from './page/useLayoutPresets';
import { mediaIdle, playCurrentOrFirstMedia } from '../../../api/mediaLibrary';
import { getLianLiLighting, isLianLiHubId, setLianLiLighting } from '../../../api/lianli';
import { getLianLiWirelessLighting, setLianLiWirelessChainLighting } from '../../../api/lianli-wireless';
import { useLightingFrames } from '../../../hooks/useLightingFrames';
import { useLightingSync, normalizeSync } from '../../../hooks/useLightingSync';
import { useTopicCallback } from '../../../hooks/useMultiplexSocket';
import type { ServiceState } from '../../../hooks/useServiceState';
import type { ConnectionState } from '../../../hooks/useServiceStatus';
import type { DashboardSectionNavigate } from '../../engine/panelLayoutHelpers';
import { buildDeviceBlocks, sortZonesWithinDevice, type ZoneBlock } from './page/deviceBlocks';
import { usePins } from './page/usePins';
import { canStack, isStackedSet, setStackLayout, stackDevices, stackOf, unstackDevices, withStacked, type DeviceStack } from './page/deviceStacks';
import { controlGroupOf } from './page/controlGroupOf';
import { stackLayoutOf, type StackLayout } from '../../../lib/stackSlots';
import { useTranslation } from '../../../lib/i18n';
import { publishControlSync, subscribeControlSync } from '../../../lib/controlSync';
import { LIGHTING_MODE_ICONS } from '../../../lib/lightingModeIcons';
import { pluralKey } from '../../../lib/pluralKey';
import { Badge } from '../../../components/common/Badge/Badge';
import { EmptyState } from '../../../components/common/EmptyState/EmptyState';
import { HoverTooltip } from '../../../components/common/HoverTooltip/HoverTooltip';
import { ViewHeader } from '../../../components/common/ViewHeader/ViewHeader';
import { AdvancedModeCta } from '../../../components/common/AdvancedModeCta/AdvancedModeCta';
import { CollapsibleSection } from '../../../components/common/CollapsibleSection/CollapsibleSection';
import { ModeMenu, MODE_MENU_TAB_KEY } from '../../../components/common/ModeMenu/ModeMenu';
import { usePageModeMenu } from '../../../components/common/ModeMenu/usePageModeMenu';
import { DeviceCountSummary } from '../../../components/common/DeviceCountSummary/DeviceCountSummary';
import { Notice } from '../../../components/common/Notice/Notice';
import { SectionHeader } from '../../../components/common/SectionHeader/SectionHeader';
import { useUiSettings } from '../../../hooks/useUiSettings';
import { ServiceRequired } from '../../../components/views/ServiceRequired';
import { DeviceCanvas } from '../../../components/common/DeviceCanvas/DeviceCanvas';
import { canvasLabelName } from '../../../lib/canvasLabelName';
import { SCENE_3D } from '../../../lib/scene/sceneFeature';
import { useLightingScene } from './scene/useLightingScene';
import { ChipGroup } from '../../../components/common/ChipGroup/ChipGroup';
import { usePersistentState } from '../../../hooks/usePersistentState';
import {
  staticLookPin, colorPin, animatePin, MIRROR_PIN, MEDIA_PIN, selectionPin, pinGridKey, pinHex,
  pickerMarks, pinMode, pinnedNamesByEffect, pinModeTargetLabel, pressReach, tabPressChangesNothing, clearLegacyLightingKeys,
} from './pins';
import { usePanelBackgroundUsage } from '../../../hooks/usePanelBackgroundUsage';
import {
  EFFECTS, ANIMATE_EFFECTS, STATIC_EFFECTS, STATIC_PATTERN_EFFECTS, DEFAULT_STATIC_EFFECT, MODES,
  defaultStateFor, isStaticEffect,
  type EffectState, type EffectTemplateBundle, type LightingMode,
} from '../../../types/lighting';
import {
  PALETTE, isPaletteKey, paletteColorForKey, paletteFamilyKey,
  type PaletteColor,
} from '../../../types/lightingPalette';
import { defaultTemplatesFor, mergeTemplates, slotMatchesDefault, slotThumbSignature } from '../../../types/lightingTemplates';
import { AnimateGrid } from './page/AnimateGrid';
import { StaticPalette } from './page/StaticPalette';
import { SimpleAnimationRow } from './page/SimpleAnimationRow';
import { isSimpleAnimation, simpleAnimationLabelKey, simpleAnimationState } from './simpleAnimations';
import { StaticPickerCanvas } from './page/StaticPickerCanvas';
import { PICKER_FIELD_SVG, PICKER_SEGMENTED_SVG, snapToSegment, pickerHexAt, pickerPointFor } from './page/staticPickerField';
import { useColorWriteQueue } from './page/useColorWriteQueue';
import { EffectCard } from '../../../components/common/EffectCard/EffectCard';
import { FullscreenShader } from './page/FullscreenShader';
import { ModeControls } from './page/ModeControls';
import { MediaCanvasNotice } from './page/MediaCanvasNotice';
import { DevicePanel } from './page/DevicePanel';
import { type DiscoveryState } from './page/DeviceDiscoveryCard';
import { zoneCardSelectable, zoneCardUnavailable } from './page/ZoneCard';
import { Button } from '../../../components/common/Button/Button';
import { GAME_SYNC_GUIDE_URL } from '../../../lib/externalLinks';
import { GameSyncLeftPane } from './page/GameSyncLeftPane';
import { LedMapEditor } from './page/LedMapEditor';
import { ColorTuningModal } from './page/ColorTuningModal';
import { KeyReactionsModal } from './page/KeyReactionsModal';
import { fetchKeyReactive, type KeyReactiveState } from '../../../api/keyReactive';
import { visibleCards } from './page/zoneUtils';
import { OpenRgbButton } from './page/OpenRgbButton';
import { GlobalBrightnessSlider } from './page/GlobalBrightnessSlider';
import { PresetToolbar } from '../../../components/common/PresetToolbar/PresetToolbar';
import { PresetAppsModal } from './page/PresetAppsModal';
import { EffectTab, type PostProcessState } from './page/EffectTab';
import { useThrottle } from '../../../hooks/cadence';
import { useAudioState } from '../../../hooks/useAudioState';
import { useLightingAudioOutput } from '../../../hooks/useLightingAudioOutput';
import { Select } from '../../../components/common/Select/Select';
import styles from './LightingPage.module.scss';

/**
 * Lighting tab composer. Owns mode routing, per-effect animate state, device
 * canvas, and right-pane tab lifecycle. Individual renderers live in
 * `./lighting/*`.
 */

interface LightingViewProps {
  serviceOnline: boolean;
  serviceState: ServiceState;
  connectionState?: ConnectionState;
  activeProfileId?: string;
  platform?: string;
  /** Navigate to a sibling dashboard section (e.g. the smart-lights app). */
  onSectionNavigate?: DashboardSectionNavigate;
}

const DEFAULT_POST_PROCESS: PostProcessState = { hue: 0, colorize: 0, saturation: 1, contrast: 1 };

interface LayoutHistorySnapshot {
  layouts: Record<string, DeviceLayoutDto>;
  activeId: string | null;
  power: Record<string, boolean>;
  /** Device ids whose power this action changed; empty for layout-only edits.
   *  Scopes power reconciliation on undo/redo to exactly the touched devices. */
  powerIds: string[];
}

/** What the effect grid and dock are pointed at - see the `scoped` memo. */
type ScopedTarget =
  | { kind: 'none' }
  | { kind: 'mixed' }
  | { kind: 'pin'; pin: Pin; key: string; slot: number; hex: string };

// Module scope so the layout undo/redo history survives LightingPage's unmount
// on navigation. Session-only; not persisted to storage. Assumes one mounted
// LightingPage - two concurrent instances would share and clobber this history.
let layoutHistoryStacks: { undo: LayoutHistorySnapshot[]; redo: LayoutHistorySnapshot[] } | null = null;
const layoutHistoryStore = {
  read: () => layoutHistoryStacks,
  write: (s: { undo: LayoutHistorySnapshot[]; redo: LayoutHistorySnapshot[] }) => { layoutHistoryStacks = s; },
};

// How long the rail keeps saying a scan is running when none was ever reported.
const DISCOVERY_GRACE_MS = 4000;
const DEVICE_ORDER_KEY = 'lighting.deviceOrder';
function loadDeviceOrder(): string[] {
  try {
    const raw = localStorage.getItem(DEVICE_ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(v => typeof v === 'string')) return parsed;
  } catch { /* localStorage / JSON parse failed; fall through to empty */ }
  return [];
}

// three.js loads only when someone turns the 3D view on.
const LightingScene3D = lazy(() => import('./scene/LightingScene3D'));
const VIEW_2D = '2d';
const VIEW_3D = '3d';
export function LightingPage({ serviceOnline, serviceState, connectionState, activeProfileId, platform = '', onSectionNavigate }: LightingViewProps) {
  const { t, language } = useTranslation();
  const { mode, setMode, rawSync, setRawSync, synced, paused: syncedPaused } = useLightingSync(serviceOnline, activeProfileId);
  // gpuCanSwitch comes from the same enumeration the Settings picker gates on,
  // so the shortcut never lands on a tab with no GPU control. Offered only for a
  // card that failed: while initializing, the picker restarts the service and
  // discards the context the notice is waiting for.
  const canPickRenderGpu = (serviceState.lighting?.gpuCanSwitch ?? false)
    && serviceState.lighting?.gpuState === 'unavailable';
  const handlePickRenderGpu = useCallback(() => {
    onSectionNavigate?.('settings', { settingsTab: 'lighting-cooling', settingsAnchor: 'set-render-gpu' });
  }, [onSectionNavigate]);
  // Game Sync requires the Windows Chroma capture shim; hide it on non-Windows
  // (empty platform = ping not yet resolved, keep hidden to avoid a flash).
  const isWindows = platform === 'windows';
  const effectiveMode: LightingMode = (mode === 'gamesync' && !isWindows) ? 'none' : mode;
  const { settings: uiSettings, update: updateUiSettings } = useUiSettings();
  const simpleDashboard = uiSettings.lightingDashboardMode === 'simple';
  // Off / simple / advanced live behind the first tab (see modeTabs). The
  // popover anchors on the tab row, which is why the ref sits on the element
  // wrapping the header rather than on the tab itself.
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const modeMenuAnchorRef = useRef<HTMLDivElement | null>(null);
  const closeModeMenu = useCallback(() => setModeMenuOpen(false), []);
  const setDashboardMode = useCallback((next: 'simple' | 'advanced') => {
    updateUiSettings({ lightingDashboardMode: next });
  }, [updateUiSettings]);
  // Keeps the output socket open; the canvas paints its frames from ledFrameStore.
  const lightingStream = useLightingFrames();
  // Read RGB running/scanning off useServiceState (already subscribed
  // to the lighting topic for the sidebar pip) so a topic push doesn't
  // trigger a duplicate GET. `running` is the openrgb-headless
  // subprocess state (LightingStatus.rgbRunning), not the effect-engine
  // `running` field; the badge + rescan gate want the subprocess.
  const rgb = {
    running: serviceState.lighting?.rgbRunning ?? false,
    scanning: serviceState.lighting?.scanning ?? false,
  };
  const [devices, setDevices] = useState<LightingDevice[]>([]);
  // User-made rail groups. The service owns them (they ride the device list),
  // so a write is optimistic and the lighting topic reconciles.
  const [deviceGroups, setDeviceGroups] = useState<DeviceGroup[]>([]);
  // Stacked cards share one frame and one selection; the selection setters
  // below read the ref so they stay stable across stack edits.
  const [deviceStacks, setDeviceStacks] = useState<DeviceStack[]>([]);
  const deviceStacksRef = useRef(deviceStacks);
  deviceStacksRef.current = deviceStacks;
  const deviceDraggingRef = useRef(false);
  const pushLayoutRef = useRef<((snap: LayoutHistorySnapshot) => void) | null>(null);
  const layoutActiveIdRef = useRef<string | null>(null);
  const handleDragActiveChange = useCallback((active: boolean) => {
    deviceDraggingRef.current = active;
  }, []);
  // Device-list selection: which devices the canvas draws, and what a Static
  // pick lands on. `primaryDeviceId` is the one device a Static pick lands on
  // and the member a stacked frame's label names; every focused frame shows
  // its LED dots.
  // Not persisted: a restored selection would silently turn the next pick into a
  // pin, so every visit starts at "All devices".
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(() => {
    clearLegacyLightingKeys();
    return new Set();
  });
  const [primaryDeviceId, setPrimaryDeviceId] = useState<string | null>(null);
  // Canvas focus: which of the drawn frames take the frame-level edits (drag,
  // resize, rotate, power, LED dots). Kept apart from the list selection so a
  // click on empty canvas recedes the frames instead of clearing the canvas.
  // null = the focus follows the list selection; the empty set is the
  // explicit "nothing focused" a canvas click produces.
  const [canvasFocus, setCanvasFocus] = useState<Set<string> | null>(null);
  const canvasFocusIds = canvasFocus ?? selectedDeviceIds;
  const handleSetSelection = useCallback((ids: Set<string>, primary: string | null) => {
    setSelectedDeviceIds(withStacked(deviceStacksRef.current, ids));
    setPrimaryDeviceId(primary);
    setCanvasFocus(null);
  }, [setPrimaryDeviceId, setSelectedDeviceIds]);
  // Canvas taps and marquees move the focus only - the device list keeps its
  // selection, so every frame it picked stays drawn. A stacked card brings its
  // stack along either way.
  const handleFocusDevice = useCallback((id: string | null) => {
    setCanvasFocus(id ? withStacked(deviceStacksRef.current, [id]) : new Set());
    setPrimaryDeviceId(id);
  }, [setPrimaryDeviceId]);
  const handleSetFocus = useCallback((ids: Set<string>, primary: string | null) => {
    setCanvasFocus(withStacked(deviceStacksRef.current, ids));
    setPrimaryDeviceId(primary);
  }, [setPrimaryDeviceId]);
  const handleBeforeLayoutSave = useCallback(() => {
    pushLayoutRef.current?.({ layouts: devicesToLayouts(devicesRef.current), power: devicesToPower(devicesRef.current), activeId: layoutActiveIdRef.current, powerIds: [] });
  }, []);

  // Wired hubs whose active mode is not 'custom': a firmware animation overrides the per-LED engine.
  const [lianLiFirmwareHubs, setLianLiFirmwareHubs] = useState<ReadonlySet<string>>(() => new Set());
  const lianLiHubIds = useMemo(
    () => [...new Set(devices.map(d => d.parentDeviceId).filter(isLianLiHubId))].sort().join(','),
    [devices],
  );
  // A hub whose read fails keeps its last known state.
  const refreshLianLiModes = useCallback(async () => {
    const hubs = lianLiHubIds ? lianLiHubIds.split(',') : [];
    const modes = await Promise.all(hubs.map(h => getLianLiLighting(h).then(d => d?.mode ?? null, () => null)));
    setLianLiFirmwareHubs(prev => {
      const next = new Set<string>();
      hubs.forEach((h, i) => {
        const mode = modes[i];
        if (mode === null ? prev.has(h) : mode !== 'custom') next.add(h);
      });
      return next;
    });
  }, [lianLiHubIds]);

  // Hands the hub's LEDs back to the engine. Optimistic: the card state
  // flips immediately and reverts if the PUT fails, since nothing else
  // re-reads the mode until a refetch.
  const handleLianLiTakeControl = useCallback(async (hubId: string) => {
    setLianLiFirmwareHubs(prev => { const next = new Set(prev); next.delete(hubId); return next; });
    try {
      await setLianLiLighting({ mode: 'custom' }, hubId);
    } catch {
      setLianLiFirmwareHubs(prev => new Set(prev).add(hubId));
    }
  }, []);

  // Device ids of wireless chains playing an uploaded animation instead of the engine's frames.
  const [wirelessPresetIds, setWirelessPresetIds] = useState<ReadonlySet<string>>(() => new Set());
  const refreshWirelessPresets = useCallback(async () => {
    const data = await getLianLiWirelessLighting();
    if (!data) return;
    setWirelessPresetIds(new Set(
      data.chains.filter(c => c.mode !== 'custom').map(c => `lianli-wireless:${c.mac}`),
    ));
  }, []);
  const handleWirelessTakeControl = useCallback(async (deviceId: string) => {
    const mac = deviceId.slice('lianli-wireless:'.length);
    setWirelessPresetIds(prev => new Set([...prev].filter(id => id !== deviceId)));
    if (!await setLianLiWirelessChainLighting(mac, { mode: 'custom' })) void refreshWirelessPresets();
  }, [refreshWirelessPresets]);

  // Pinned devices, keyed by device id. The service owns them; this is its
  // copy plus the optimistic edits made here, re-read on every lighting frame.
  const { pins, refresh: refreshPins, applyPins, recordPins } = usePins();
  // Collapsing the effect dock hands its space to the canvas and the browser.
  // The preset toolbar keeps its width either way - it lives in row 1, which
  // sizes itself.
  const [dockCollapsed, setDockCollapsed] = usePersistentState('nexus.lighting.effectDockCollapsed', true);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [pickerSegmented, setPickerSegmented] = usePersistentState('nexus.lighting.pickerSegmented', true);
  const [customStaticColor, setCustomStaticColor] = usePersistentState('nexus.lighting.customColor', '');
  // The exact flat colour the global Static look is, from the service; '' when it is an effect.
  const [globalColor, setGlobalColor] = useState('');
  // Which way simple mode's sweeps travel. Browser-local, like the picks:
  // the service stores only the resulting speed sign.
  const [simpleReversed, setSimpleReversed] = usePersistentState('nexus.lighting.simpleReversed', false);

  const [activeEffect, setActiveEffect] = useState<string>('');
  // Read inside applyAnimate, which several handlers share: static and animate
  // drive the same template state through different start endpoints.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // Static keeps its own last-selected key, so switching modes returns to what
  // each one was showing rather than carrying the other's effect across.
  const staticEffectRef = useRef<string>(DEFAULT_STATIC_EFFECT);
  // The mirror of staticEffectRef: the catalogs are disjoint, so entering
  // Animation while a static key is selected must fall back to what Animation
  // last had rather than carrying a pattern across.
  const animateEffectRef = useRef<string>('rainbow');
  const [effectTemplates, setEffectTemplates] = useState<Record<string, EffectTemplateBundle>>({});
  // Canonical default bundles from the service (fetched once, session-cached).
  // Kept in state so default-dependent memos recompute when they arrive.
  const [animateDefaults, setAnimateDefaults] = useState<Record<string, EffectTemplateBundle> | null>(cachedAnimateDefaults);
  // Committed snapshot: updated on hydrate, on preset switch, and after a param
  // save lands - never during a drag. The grid + preset thumbnails (and the
  // selected highlight) read from this, so they refetch on commit, not per slider
  // frame (effectTemplates churns during drag for the live RGB preview).
  const [committedTemplates, setCommittedTemplates] = useState<Record<string, EffectTemplateBundle>>({});
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const sceneApi = useLightingScene(SCENE_3D);
  const [sceneEditorOpen, setSceneEditorOpen] = useState(false);
  const scene3d = SCENE_3D && !!sceneApi.scene?.view.enabled;
  // Canvas hides the frame for any device whose LEDs are off. The device
  // list is always mounted now, so there is no tab state to hide it behind.
  // Cards whose LEDs are all user-disabled disappear from the listing and
  // the canvas, but a device always keeps at least one card visible: a
  // fully parked device shows one card with its zero-enabled badge so it
  // stays selectable and its LED map editor remains reachable.
  const visibleDevices = useMemo(() => visibleCards(devices), [devices]);
  // The list selection, which is what the canvas frames, also shrinks without
  // passing through those handlers: the prune drops devices which stopped
  // being selectable (unplugged, or their LEDs switched off). A focus id for a
  // frame the canvas no longer draws would keep the group-drag branch armed
  // on a one-frame canvas, so drop it here.
  useEffect(() => {
    setCanvasFocus(prev => {
      if (prev === null) return prev;
      const next = new Set([...prev].filter(id => selectedDeviceIds.has(id)));
      if (next.size === prev.size) return prev;
      // Losing the last focused frame to an unplug is not the user asking for
      // "nothing focused", so hand the focus back to the list selection.
      return next.size === 0 ? null : next;
    });
  }, [selectedDeviceIds]);
  const hiddenFrameIds = useMemo(() => {
    const set = new Set<string>();
    // Nexus Control off joins lights off: both mean the hardware is not wearing
    // what the engine renders, and such a card can now be selected onto the
    // canvas.
    for (const d of visibleDevices) if (!d.ledsOn || d.controlled === false) set.add(d.id);
    return set;
  }, [visibleDevices]);

  // LED map editor - lifted here so both the canvas settings button and the
  // ZoneCard settings button can open it. Every card routes to the editor of
  // its OWNING device with that card's zone preselected; the community badge
  // deep-links to the editor with the community modal already stacked open.
  const [editorTarget, setEditorTarget] = useState<{
    deviceId: string;
    zoneId: string;
    zoneCustomizable: boolean;
  } | null>(null);
  const [editorCommunityOpen, setEditorCommunityOpen] = useState(false);
  const devicesRef = useRef<LightingDevice[]>([]);
  devicesRef.current = devices;
  const openEditorFor = useCallback((cardId: string, communityOpen: boolean) => {
    const card = devicesRef.current.find(d => d.id === cardId);
    if (!card) return;
    setEditorCommunityOpen(communityOpen);
    setEditorTarget({
      // deviceId falls back to the card id for services that predate the
      // zones model (single-zone behavior).
      deviceId: card.deviceId || card.id,
      zoneId: card.id,
      zoneCustomizable: card.zoneCustomizable === true,
    });
  }, []);
  const handleOpenSettings = useCallback((id: string) => {
    openEditorFor(id, false);
  }, [openEditorFor]);
  const handleOpenCommunity = useCallback((id: string) => {
    openEditorFor(id, true);
  }, [openEditorFor]);

  // After a hub composition change the device set may have changed (ports added/
  // removed, mirror toggled). Refetch devices and re-target the editor to the
  // first device that belongs to the same hub. The epoch counter forces the
  // editor to remount even when the deviceId doesn't change, so load() re-fires.
  const [compositionEpoch, setCompositionEpoch] = useState(0);
  const handleCompositionChanged = useCallback(async (hubId: string) => {
    const data = await fetchLightingDevices();
    if (!data) return;
    setDeviceGroups(data.groups ?? []);
    setDeviceStacks(data.stacks ?? []);
    const next = (data.devices ?? []).map(d => ({
      ...d,
      canvasW: Math.max(60, d.canvasW),
      canvasH: Math.max(60, d.canvasH),
    }));
    setDevices(next);
    // Re-target the editor to the hub's first device. Match on parentDeviceId
    // (the exact hub identity each card carries) so a multi-hub setup can't be
    // mis-targeted by a shared id prefix.
    const match = next.find(d => d.parentDeviceId === hubId);
    if (match) {
      setEditorTarget({
        deviceId: match.deviceId || match.id,
        zoneId: match.id,
        zoneCustomizable: match.zoneCustomizable === true,
      });
      setCompositionEpoch(e => e + 1);
    } else {
      setEditorTarget(null);
    }
  }, []);

  // Cached community-layout counts for the device-card badges. Cache-only on
  // the service side, so a single fetch per page mount is enough.
  const [mappingCounts, setMappingCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!serviceOnline) return;
    let cancelled = false;
    fetchAvailableMappings().then(data => {
      if (!cancelled && data && !data.error) setMappingCounts(data.counts ?? {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [serviceOnline]);

  // LED positions for every focused device and every card stacked with one,
  // by device id, so the canvas can show small dots indicating where each
  // active LED is. Maps are cached per device: a marquee re-focuses at pointer
  // rate, so only ids not seen or in flight yet are fetched. The cache is
  // keyed on the open editor target and the profile, since leaving the editor
  // or switching profile can have moved LEDs; a fetch that started under an
  // older key is dropped rather than written into the new one.
  const [selectedDeviceLeds, setSelectedDeviceLeds] = useState<Record<string, LedMapEntry[]> | null>(null);
  const ledMapCacheRef = useRef<{ key: string; maps: Map<string, LedMapEntry[]>; pending: Set<string> }>({ key: '', maps: new Map(), pending: new Set() });
  // The ids the dots are for right now; a fetch that lands late publishes
  // against these, not the focus it was started under.
  const ledFocusRef = useRef<string[]>([]);
  useEffect(() => {
    const ids = [...withStacked(deviceStacks, canvasFocusIds)];
    ledFocusRef.current = ids;
    const cache = ledMapCacheRef.current;
    const key = `${editorTarget?.deviceId ?? ''}|${editorTarget?.zoneId ?? ''}|${activeProfileId ?? ''}`;
    if (cache.key !== key) { cache.key = key; cache.maps.clear(); cache.pending.clear(); }
    const publish = () => {
      const current = ledFocusRef.current;
      if (current.length === 0) { setSelectedDeviceLeds(null); return; }
      const leds: Record<string, LedMapEntry[]> = {};
      for (const id of current) { const map = cache.maps.get(id); if (map) leds[id] = map; }
      setSelectedDeviceLeds(leds);
    };
    publish();
    for (const id of ids) {
      if (cache.maps.has(id) || cache.pending.has(id)) continue;
      cache.pending.add(id);
      fetchLedMap(id).then(data => {
        if (cache.key !== key) return;
        cache.pending.delete(id);
        if (data?.leds) cache.maps.set(id, data.leds);
        publish();
      }).catch(() => { if (cache.key === key) cache.pending.delete(id); });
    }
  }, [canvasFocusIds, deviceStacks, editorTarget, activeProfileId]);

  const [musicReactive, setMusicReactiveState] = useState(false);
  const audioRef = useAudioState(musicReactive && mode === 'animate');
  // Windows only: the macOS capture takes the whole system mix, so there is no
  // output to name or switch.
  const showAudioOutput = musicReactive && isWindows && mode === 'animate';
  const audioOutput = useLightingAudioOutput(showAudioOutput);

  // Optimistic local mirror of useLightingSync().paused, reconciled whenever
  // the server value changes (multiplex refetch, mode switch resetting it).
  const [paused, setPausedState] = useState(!!syncedPaused);
  useEffect(() => {
    setPausedState(!!syncedPaused);
  }, [syncedPaused]);

  const handlePauseToggle = useCallback(async () => {
    const next = !paused;
    setPausedState(next);
    try {
      await setLightingPaused(next);
    } catch {
      setPausedState(!next);
    }
  }, [paused]);


  // Screen + Media share an identical post-process shape (hue, colorize,
  // saturation, contrast). Each mode has its own persisted snapshot; the
  // tab writes to whichever is active.
  const [screenPP, setScreenPP] = useState<PostProcessState>(DEFAULT_POST_PROCESS);
  const [mediaPP, setMediaPP] = useState<PostProcessState>(DEFAULT_POST_PROCESS);

  const stateOf = useCallback((key: string, slot: number): EffectState => {
    const bundle = effectTemplates[key];
    if (!bundle || !bundle.slots || bundle.slots.length === 0) return defaultStateFor(key);
    const idx = Math.min(Math.max(slot, 0), bundle.slots.length - 1);
    return bundle.slots[idx];
  }, [effectTemplates]);
  const slotOf = useCallback((key: string) => effectTemplates[key]?.selected ?? 0, [effectTemplates]);
  const stateFor = useCallback(
    (key: string): EffectState => stateOf(key, slotOf(key)),
    [slotOf, stateOf],
  );
  const currentState: EffectState | null = useMemo(
    () => activeEffect ? stateFor(activeEffect) : null,
    [activeEffect, stateFor],
  );
  // Static renders at speed 0; the canvas preview has to match or it animates
  // a look the LEDs are holding still.
  const previewState: EffectState | null = useMemo(
    () => currentState && mode === 'static' ? { ...currentState, speed: 0 } : currentState,
    [currentState, mode],
  );

  const throttleAnimate = useThrottle();
  const throttlePostProcess = useThrottle();
  const localAnimateEditUntilRef = useRef(0);
  const activeProfileKey = activeProfileId ?? 'default';
  const activeProfileKeyRef = useRef(activeProfileKey);
  activeProfileKeyRef.current = activeProfileKey;
  const [loadedProfileLighting, setLoadedProfileLighting] = useState<{ profileKey: string; sync: string } | null>(null);

  const effectTemplatesRef = useRef(effectTemplates);
  effectTemplatesRef.current = effectTemplates;

  // keepSelection: static owns its selection (Lighting.Static.Effect); this
  // payload carries the animate one, so applying it here would drag the static
  // grid onto the last animated effect on every lighting broadcast.
  const hydrateAnimateSettings = useCallback(async (
    data: Awaited<ReturnType<typeof fetchAnimateSettings>>,
    keepSelection = false,
  ) => {
    if (!data) return;
    const defaults = await fetchAnimateDefaults();
    setAnimateDefaults(defaults);
    const merged: Record<string, EffectTemplateBundle> = {};
    const savedTemplates = data.templates ?? {};
    for (const fx of EFFECTS) {
      merged[fx.key] = mergeTemplates(fx.key, savedTemplates[fx.key], defaults);
    }
    if (!data.templates) {
      // Pre-templates service: fold the legacy per-effect states into slot 0
      // and persist, but only when there is something to migrate - the service
      // stores user deltas, so an all-defaults save is pure churn.
      const legacy = data.states ?? {};
      let migrated = false;
      for (const fx of EFFECTS) {
        const s = legacy[fx.key];
        if (!s) continue;
        migrated = true;
        const bundle = merged[fx.key];
        bundle.slots[0] = {
          ...bundle.slots[0],
          ...s,
          params: { ...bundle.slots[0].params, ...(s.params ?? {}) },
        };
        bundle.selected = 0;
      }
      if (migrated) {
        saveAnimateTemplates(merged).catch(() => { /* best-effort */ });
      }
    }
    setEffectTemplates(merged);
    setCommittedTemplates(merged);
    if (ANIMATE_EFFECTS.some(e => e.key === data.effect)) {
      animateEffectRef.current = data.effect;
    }
    if (!keepSelection && ANIMATE_EFFECTS.some(e => e.key === data.effect)) {
      setActiveEffect(data.effect);
    }
  }, []);

  const applyExternalEffectState = useCallback((effect: string, state?: EffectState, templateIndex?: number) => {
    if (!EFFECTS.some(e => e.key === effect)) return;
    setActiveEffect(effect);
    if (state === undefined && templateIndex === undefined) return;

    setEffectTemplates(prev => {
      const bundle = prev[effect] ?? defaultTemplatesFor(effect, cachedAnimateDefaults());
      const selected = templateIndex === undefined
        ? bundle.selected
        : Math.min(Math.max(templateIndex, 0), bundle.slots.length - 1);
      const slots = bundle.slots.slice();
      if (state) {
        slots[selected] = {
          ...slots[selected],
          ...state,
          params: { ...slots[selected].params, ...(state.params ?? {}) },
        };
      }
      return {
        ...prev,
        [effect]: { ...bundle, selected, slots },
      };
    });
  }, []);

  useEffect(() => subscribeControlSync(event => {
    if (event.domain !== 'lighting') return;
    if (event.effect) {
      applyExternalEffectState(event.effect, event.effectState, event.templateIndex);
    }
  }), [applyExternalEffectState]);

  useEffect(() => {
    if (!serviceOnline) return;
    let cancelled = false;
    const profileKey = activeProfileKey;
    setLoadedProfileLighting(null);

    const safe = <T,>(promise: Promise<T | null>): Promise<T | null> =>
      promise.catch(() => null);

    Promise.all([
      safe(fetchCurrentSync()),
      safe(fetchAnimateSettings()),
      safe(fetchMusicReactive()),
      safe(fetchScreenEffect()),
      safe(fetchMediaEffect()),
    ]).then(async ([
      currentSync,
      animateSettings,
      musicSettings,
      screenEffect,
      mediaEffect,
    ]) => {
      if (cancelled) return;
      const sync = currentSync?.sync ?? 'none';
      setRawSync(sync);
      setMode(normalizeSync(sync));

      if (animateSettings) {
        // Await: the profile-restore effect keyed off loadedProfileLighting
        // reads effectTemplates, which must hold the merged bundles (not the
        // pre-hydrate {}) or the restored effect starts with the base look.
        await hydrateAnimateSettings(animateSettings, normalizeSync(sync) === 'static');
        if (cancelled) return;
      }
      if (musicSettings) {
        setMusicReactiveState(!!musicSettings.enabled);
      }
      if (screenEffect) {
        setScreenPP(normalizePP(screenEffect));
      }
      if (mediaEffect) {
        setMediaPP(normalizePP(mediaEffect));
      }
      setLoadedProfileLighting({ profileKey, sync });
    });

    return () => { cancelled = true; };
  }, [serviceOnline, activeProfileKey, setMode, setRawSync, hydrateAnimateSettings]);

  // Seeded on mount, not just when static is active: entering the mode from
  // another one has to land on the key the service remembers.
  useEffect(() => {
    if (!serviceOnline) return;
    let cancelled = false;
    fetchStaticSettings().then(data => {
      if (cancelled || !data) return;
      if (isStaticEffect(data.effect)) staticEffectRef.current = data.effect;
      setGlobalColor(data.color ?? '');
    });
    return () => { cancelled = true; };
  }, [serviceOnline]);

  useEffect(() => {
    if (!serviceOnline || !rawSync) return;
    let cancelled = false;

    if (rawSync === 'static') {
      fetchStaticSettings().then(data => {
        if (cancelled || !data) return;
        setGlobalColor(data.color ?? '');
        if (isStaticEffect(data.effect)) {
          staticEffectRef.current = data.effect;
          setActiveEffect(data.effect);
        }
      });
    } else if (isSimpleAnimation(rawSync)) {
      // Started from simple mode, the widget or another client: a sweep has no
      // cell in the advanced grid, so leaving the last catalogue key selected
      // would mark that cell and draw its shader over a canvas running this.
      setActiveEffect('');
    } else if (EFFECTS.some(e => e.key === rawSync)) {
      setActiveEffect(rawSync);
      fetchAnimateSettings().then(data => {
        if (cancelled || !data) return;
        hydrateAnimateSettings(data);
      });
      fetchMusicReactive().then(data => {
        if (!cancelled && data) setMusicReactiveState(!!data.enabled);
      });
    } else if (rawSync === 'screen') {
      fetchScreenEffect().then(data => {
        if (!cancelled && data) setScreenPP(normalizePP(data));
      });
    } else if (rawSync === 'gif' || rawSync.includes('media')) {
      fetchMediaEffect().then(data => {
        if (!cancelled && data) setMediaPP(normalizePP(data));
      });
    }

    return () => { cancelled = true; };
  }, [serviceOnline, rawSync, hydrateAnimateSettings]);

  // Animate-mode templates: same shape - one fetch on entry, multiplex push
  // for the rest. Local edits still ignore pushes for the
  // localAnimateEditUntilRef debounce window so the user's drag isn't fought.
  useEffect(() => {
    if (!serviceOnline || (mode !== 'animate' && mode !== 'static')) return;
    let cancelled = false;
    fetchAnimateSettings().then(data => {
      if (cancelled || !data) return;
      hydrateAnimateSettings(data, mode === 'static');
    });
    return () => { cancelled = true; };
  }, [serviceOnline, mode, hydrateAnimateSettings]);

  // Push-driven refresh: every /lighting/* mutation publishes a 'lighting'
  // frame on the multiplex hub. Each branch refetches the resource it owns.
  useTopicCallback('lighting', serviceOnline, () => {
    // refreshDevices is declared further down; this callback only fires after
    // mount once the closure binding is initialized, so the "declared later"
    // static check is safe to disable.
     
    void refreshDevices();
    void refreshWirelessPresets();
    // A preset (picked here, on another client, or by app focus) can carry its own 3D view.
    if (SCENE_3D) void sceneApi.refreshView();
    // A pin set from another client arrives on this frame; ids with a write
    // still in flight here keep their local value.
    void refreshPins();
    // A remote change of the global flat colour.
    if (mode === 'static') {
      fetchStaticSettings().then(data => { if (data) setGlobalColor(data.color ?? ''); }).catch(() => {});
    }
    // Static edits the same template slots, so both modes follow a remote edit.
    if (mode === 'animate' || mode === 'static') {
      if (Date.now() < localAnimateEditUntilRef.current) return;
      fetchAnimateSettings().then(data => {
        if (!data) return;
        hydrateAnimateSettings(data, mode === 'static');
      });
    }
  });

  const handleMusicReactiveToggle = useCallback(async () => {
    const next = !musicReactive;
    setMusicReactiveState(next);
    try {
      await setMusicReactive(next);
    } catch {
      setMusicReactiveState(!next);
    }
  }, [musicReactive]);

  const [gameSyncState, setGameSyncState] = useState<{
    devices: GameSyncDevice[];
    lastFrameAt: number | null;
    activeApp: string | null;
    isReceiving: boolean;
    vendorConflict: boolean;
  }>({ devices: [], lastFrameAt: null, activeApp: null, isReceiving: false, vendorConflict: false });

  useEffect(() => {
    if (effectiveMode !== 'gamesync' || !serviceOnline) return;
    let cancelled = false;
    const poll = async () => {
      const data = await fetchGameSyncState().catch(() => null);
      if (cancelled || !data) return;
      const lastFrameAt = data.lastFrameAt ?? null;
      setGameSyncState({
        devices: data.devices ?? [],
        lastFrameAt,
        activeApp: data.activeApp ?? null,
        isReceiving: lastFrameAt != null && (Date.now() - lastFrameAt) < 2000,
        vendorConflict: data.synapseConflict === true,
      });
    };
    void poll();
    const id = window.setInterval(() => { void poll(); }, 1500);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [effectiveMode, serviceOnline]);

  const [gameSyncGames, setGameSyncGames] = useState<GameSyncGame[]>([]);

  useEffect(() => {
    if (effectiveMode !== 'gamesync' || !serviceOnline) return;
    let cancelled = false;
    fetchGameSyncGames().then(data => {
      if (!cancelled && data) setGameSyncGames(data.games ?? []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [effectiveMode, serviceOnline]);

  const restartedProfileRef = useRef<string | null>(null);
  useEffect(() => {
    restartedProfileRef.current = null;
  }, [activeProfileKey]);

  useEffect(() => {
    if (!serviceOnline || loadedProfileLighting?.profileKey !== activeProfileKey) return;
    const key = activeProfileKey;
    const sync = loadedProfileLighting.sync;
    if (restartedProfileRef.current === key) return;
    if (!sync || sync === 'none') { return; }
    restartedProfileRef.current = key;
    (async () => {
      if (EFFECTS.some(e => e.key === sync)) {
        const state = stateFor(sync);
        await startAnimate(sync, state.speed, state.intensity, state.hue,
          state.colorize, state.saturation, state.contrast, state.params, false);
      } else if (sync === 'screen') {
        await startScreenMirror(screenPP.saturation, screenPP.contrast, undefined, screenPP.hue, screenPP.colorize);
      } else if (sync === 'media' || sync === 'gif') {
        await playCurrentOrFirstMedia();
      }
    })();
  }, [
    serviceOnline,
    activeProfileKey,
    loadedProfileLighting,
    stateFor,
    screenPP.saturation,
    screenPP.contrast,
    screenPP.hue,
    screenPP.colorize,
  ]);

  const applyAnimate = useCallback((effect: string, state: EffectState, persist: boolean) => {
    if (!effect) return;
    const expectedProfileKey = activeProfileKeyRef.current;
    throttleAnimate(() => {
      if (activeProfileKeyRef.current !== expectedProfileKey) return;
      if (modeRef.current === 'static') {
        startStatic(
          effect, state.intensity, state.hue, state.colorize,
          state.saturation, state.contrast, state.params, persist,
        ).catch(() => {});
        return;
      }
      startAnimate(
        effect, state.speed, state.intensity, state.hue, state.colorize,
        state.saturation, state.contrast, state.params, persist,
      ).catch(() => {});
    });
  }, [throttleAnimate]);

  const writeTemplates = useCallback((
    next: Record<string, EffectTemplateBundle>,
    runningEffect: string | null,
    persist: boolean,
  ) => {
    // A typed slider edit commits in the same tick, before a re-render.
    effectTemplatesRef.current = next;
    setEffectTemplates(next);
    if (runningEffect) {
      const bundle = next[runningEffect];
      if (bundle) {
        const idx = Math.min(Math.max(bundle.selected, 0), bundle.slots.length - 1);
        applyAnimate(runningEffect, bundle.slots[idx], persist);
      }
    }
    // Return the save promise so callers can bump the thumbnail token only after
    // the new look is persisted (else the refetch races the write and re-caches
    // the old look).
    if (persist) {
      return saveAnimateTemplates(next).catch(() => { /* best-effort; UI already updated */ });
    }
    return Promise.resolve();
  }, [applyAnimate]);

  // What the effect grid, the dock and the preview are pointed at. Devices
  // selected and all wearing one pin: that pin's target (identity includes the
  // preset slot, so the same effect on two presets is a disagreement). Devices
  // wearing different pins, or a mix of pinned and following, have no single
  // value for the controls to edit, so the dock locks. Nothing selected, or
  // every selected device following the global mode: the global source.
  const selectionIds = useMemo(() => [...selectedDeviceIds], [selectedDeviceIds]);
  const scoped: ScopedTarget = useMemo(() => {
    const sel = selectionPin(pins, selectionIds);
    if (sel.kind === 'none') return { kind: 'none' };
    if (sel.kind === 'mixed') return { kind: 'mixed' };
    const pin = sel.pin;
    return {
      kind: 'pin',
      pin,
      key: pin.kind === 'mirror' ? '' : pinGridKey(pin),
      // An animate pin wears the shader's global settings, so its preset is the shader's own pointer.
      slot: pin.kind === 'static' ? (pin.slot ?? 0) : slotOf(pin.effect ?? ''),
      hex: pin.kind === 'static' ? pinHex(pin) : '',
    };
  }, [pins, selectionIds, slotOf]);
  // The tabs and the views under them show what the selection wears, so a
  // card pinned to Mirror opens on Mirror whatever the global mode is. Nothing
  // selected, a selection following the global mode, or one wearing different
  // pins shows the global mode.
  const viewMode: LightingMode = scoped.kind === 'pin' ? pinMode(scoped.pin.kind) : effectiveMode;

  // Pins the selection to a static look: the whole look travels, so the service
  // renders THIS effect for the device rather than approximating it with a
  // swatch colour. The pin records the slot it was made against, so a later
  // repoint of some other device leaves this one alone.
  const pinStaticLook = useCallback((key: string, slot: number, ids: string[], state?: EffectState) => {
    void applyPins(ids, staticLookPin(key, slot, state ?? stateOf(key, slot)));
  }, [applyPins, stateOf]);

  const handleEffectSelect = useCallback((key: string) => {
    // With devices selected a pick pins them to it, replacing whatever they
    // wore; the running effect is untouched. Unselected pinned devices are
    // never reached.
    const ids = [...selectedDeviceIds];
    if (ids.length > 0 && (viewMode === 'animate' || viewMode === 'static')) {
      if (viewMode === 'static') {
        if (isStaticEffect(key)) pinStaticLook(key, slotOf(key), ids);
      } else {
        void applyPins(ids, animatePin(key));
      }
      return;
    }
    // Picking an effect clears a global flat colour (the service does the same).
    if (modeRef.current === 'static') setGlobalColor('');
    if (activeEffect !== key) {
      setActiveEffect(key);
      applyAnimate(key, stateFor(key), true);
    }
    const selectMode = modeRef.current === 'static' ? 'static' : 'animate';
    // Remember the pick per mode: rawSync stays 'static' across selections, so
    // the hydrate effect never re-runs and would otherwise leave this stale.
    if (selectMode === 'static') staticEffectRef.current = key;
    else animateEffectRef.current = key;
    publishControlSync({
      domain: 'lighting',
      mode: selectMode,
      rawSync: selectMode === 'static' ? 'static' : key,
      effect: key,
    });
  }, [activeEffect, applyAnimate, applyPins, viewMode, pinStaticLook, selectedDeviceIds, slotOf, stateFor]);

  // Paces the pin writes a colour drag produces; the local copy is recorded
  // per move, the write follows when the previous one lands.
  const queueColorWrite = useColorWriteQueue(useCallback((ids: string[], pin: Pin) => applyPins(ids, pin, false), [applyPins]));

  const handleCustomSelect = useCallback((hex: string) => {
    setCustomStaticColor(hex);
    const ids = [...selectedDeviceIds];
    // Nothing selected: the colour is the exact global flat colour.
    if (ids.length === 0) {
      setGlobalColor(hex);
      void startStatic(DEFAULT_STATIC_EFFECT, 1, 0, 0, 1, 1, {}, true, hex).catch(() => {});
      return;
    }
    // Record without pushing and queue the write, so the commit cannot race a
    // preview still in flight and leave the hardware on the older colour.
    const pin = colorPin(hex);
    recordPins(ids, pin);
    queueColorWrite(pin, ids);
  }, [queueColorWrite, recordPins, selectedDeviceIds, setCustomStaticColor]);

  // Records as well as writes: the marks and the device cards read the pin, so
  // a drag has to move them with the pointer, not on release.
  const handleCustomPreview = useCallback((hex: string) => {
    const ids = [...selectedDeviceIds];
    if (ids.length === 0) return;
    const pin = colorPin(hex);
    recordPins(ids, pin);
    queueColorWrite(pin, ids);
  }, [queueColorWrite, recordPins, selectedDeviceIds]);

  const effectPool = mode === 'static' ? STATIC_EFFECTS : ANIMATE_EFFECTS;


  // Fullscreen edits one value; a mixed selection has none, so it closes.
  useEffect(() => { if (scoped.kind === 'mixed') setFullscreenOpen(false); }, [scoped.kind]);
  // A shader or static-look pin is the selection's own target; Mirror and
  // Media pins have nothing of their own, so their controls are the shared ones.
  const pinTarget = scoped.kind === 'pin' && (scoped.pin.kind === 'static' || scoped.pin.kind === 'animate') ? scoped : null;
  const ppMode = viewMode;
  const postProcess = ppMode === 'screen' ? screenPP : mediaPP;

  // The fullscreen arrows step through the effects. Under a pin scope they step
  // from the pinned target on screen and re-pin the selection; with no
  // selection they step the global effect.
  const stepEffect = useCallback((dir: 1 | -1) => {
    const stepFrom = pinTarget && (pinTarget.pin.kind === 'animate' || pinTarget.pin.kind === 'static')
      ? { pool: pinTarget.pin.kind === 'static' ? STATIC_PATTERN_EFFECTS : ANIMATE_EFFECTS, key: pinTarget.key }
      : { pool: effectPool, key: activeEffect };
    if (!stepFrom.pool.length) return;
    const raw = stepFrom.pool.findIndex(e => e.key === stepFrom.key);
    // A key outside the pool (a palette colour) enters it at the first entry.
    const idx = raw < 0 ? (dir === 1 ? -1 : 0) : raw;
    const next = stepFrom.pool[(idx + dir + stepFrom.pool.length) % stepFrom.pool.length].key;
    if (!pinTarget) { handleEffectSelect(next); return; }
    if (pinTarget.pin.kind === 'static') pinStaticLook(next, slotOf(next), selectionIds);
    else void applyPins(selectionIds, animatePin(next));
  }, [activeEffect, applyPins, effectPool, handleEffectSelect, pinStaticLook, pinTarget, selectionIds, slotOf]);
  const handlePrevEffect = useCallback(() => stepEffect(-1), [stepEffect]);
  const handleNextEffect = useCallback(() => stepEffect(1), [stepEffect]);

  // The dock always edits a single (effect, slot). Scoped, that is the pin's
  // target; otherwise the running effect's selected preset.
  const dockEffect = pinTarget ? pinTarget.key : activeEffect;
  const dockSlot = pinTarget ? pinTarget.slot : slotOf(activeEffect);
  // Editing an animation pin that is not the running effect changes its
  // settings only: the running effect and the other surfaces stay as they were.
  const pinnedElsewhere = pinTarget?.pin.kind === 'animate' && pinTarget.key !== activeEffect;
  // A static pin carries its own copy of the look, so an edit re-pins the devices.
  const staticPinEdit = pinTarget?.pin.kind === 'static' && !isPaletteKey(pinTarget.key);
  const dockState: EffectState | null = dockEffect ? stateOf(dockEffect, dockSlot) : null;
  // The preview renders client-side from these, not from the service canvas, so
  // a selection held on a pinned shader previews that shader with the look the
  // drawer is editing; otherwise it previews the running effect.
  const previewEffect = pinTarget && !isPaletteKey(dockEffect) ? dockEffect : activeEffect;
  const previewShaderState = pinTarget && !isPaletteKey(dockEffect) ? dockState : previewState;
  // The slot strip highlights what the dock edits, so a scoped bundle carries
  // the pin's slot rather than the effect's shared pointer.
  const dockBundle: EffectTemplateBundle | null = dockEffect
    ? (committedTemplates[dockEffect] ? { ...committedTemplates[dockEffect], selected: dockSlot } : null)
    : null;
  // A palette pin is a colour: the dock shows which one, and there is nothing
  // to edit or reset.
  const dockPalette = paletteColorForKey(dockEffect);
  const dockCanReset = !!(dockEffect && dockState && !dockPalette
    && !slotMatchesDefault(dockEffect, dockSlot, dockState, animateDefaults));

  const handleTemplateSelect = useCallback((idx: number) => {
    // A static pin repoints only the selected devices at this preset. The
    // effect's shared pointer stays put, so every other device wearing this
    // effect keeps the preset it was assigned.
    if (pinTarget?.pin.kind === 'static') {
      if (idx === pinTarget.slot) return;
      const bundle = effectTemplates[pinTarget.key];
      const clampedIdx = bundle ? Math.min(Math.max(idx, 0), bundle.slots.length - 1) : idx;
      pinStaticLook(pinTarget.key, clampedIdx, selectionIds, stateOf(pinTarget.key, clampedIdx));
      return;
    }
    // A selection pinned to a shader edits that shader's preset.
    const target = pinTarget ? pinTarget.key : activeEffect;
    if (!target) return;
    const bundle = effectTemplates[target];
    if (!bundle) return;
    if (idx === bundle.selected) return;
    localAnimateEditUntilRef.current = Date.now() + 1500;
    const clamped = Math.min(Math.max(idx, 0), bundle.slots.length - 1);
    const nextBundle: EffectTemplateBundle = { ...bundle, selected: clamped };
    const nextTemplates = { ...effectTemplates, [target]: nextBundle };
    writeTemplates(nextTemplates, target === activeEffect ? target : null, true);
    // Selection is instant and the slot's params are unchanged, so the committed
    // snapshot can advance immediately (no save race).
    setCommittedTemplates(nextTemplates);
    if (target !== activeEffect) return;
    publishControlSync({
      domain: 'lighting',
      // Static edits must not announce themselves as animate: subscribers
      // classify on rawSync, so a pattern key here flips every surface into
      // Animation mid-interaction.
      mode: modeRef.current === 'static' ? 'static' : 'animate',
      rawSync: modeRef.current === 'static' ? 'static' : activeEffect,
      effect: activeEffect,
      templateIndex: clamped,
      effectState: nextBundle.slots[clamped],
    });
  }, [activeEffect, effectTemplates, pinStaticLook, pinTarget, selectionIds, stateOf, writeTemplates]);

  const handleStatePatch = useCallback((patch: Partial<EffectState>, commit = false) => {
    if (!dockEffect || !dockState) return;
    localAnimateEditUntilRef.current = Date.now() + 1500;
    const bundle = effectTemplates[dockEffect];
    if (!bundle) return;
    const idx = Math.min(Math.max(dockSlot, 0), bundle.slots.length - 1);
    const nextSlot: EffectState = { ...dockState, ...patch };
    const nextSlots = bundle.slots.slice();
    nextSlots[idx] = nextSlot;
    const nextBundle: EffectTemplateBundle = { ...bundle, slots: nextSlots };
    // A preset is shared by every device that references it, so the edit lands
    // in the slot either way. What a pin changes is the side effects: a pinned
    // edit must not restart the global effect or announce itself to the other
    // surfaces as a change of what is running.
    writeTemplates(
      { ...effectTemplates, [dockEffect]: nextBundle },
      staticPinEdit || pinnedElsewhere ? null : dockEffect,
      commit,
    );
    if (pinnedElsewhere) return;
    if (staticPinEdit) {
      const pin = staticLookPin(dockEffect, idx, nextSlot);
      recordPins(selectionIds, pin);
      if (commit) void applyPins(selectionIds, pin, false);
      return;
    }
    publishControlSync({
      domain: 'lighting',
      // Static edits must not announce themselves as animate: subscribers
      // classify on rawSync, so a pattern key here flips every surface into
      // Animation mid-interaction.
      mode: modeRef.current === 'static' ? 'static' : 'animate',
      rawSync: modeRef.current === 'static' ? 'static' : dockEffect,
      effect: dockEffect,
      templateIndex: idx,
      effectState: nextSlot,
    });
  }, [applyPins, dockEffect, dockSlot, dockState, effectTemplates, pinnedElsewhere, recordPins, selectionIds, staticPinEdit, writeTemplates]);

  const handleStateCommit = useCallback(() => {
    if (!dockEffect) return;
    const freshTemplates = effectTemplatesRef.current;
    const bundle = freshTemplates[dockEffect];
    if (!bundle) return;
    const idx = Math.min(Math.max(dockSlot, 0), bundle.slots.length - 1);
    const latest = bundle.slots[idx];
    if (!latest) return;
    // Advance the committed snapshot only after the save lands, so the thumbnail
    // refetch can't race ahead of the persisted look.
    saveAnimateTemplates(freshTemplates)
      .then(() => setCommittedTemplates(freshTemplates))
      .catch(() => { /* best-effort */ });
    // A static pin's edit belongs to the pinned devices, not to whatever is
    // running on the canvas - restarting the global effect here would swap it
    // out from under every unselected device.
    if (staticPinEdit) {
      pinStaticLook(dockEffect, idx, selectionIds, latest);
      return;
    }
    if (pinnedElsewhere) return;
    applyAnimate(dockEffect, latest, true);
  }, [applyAnimate, dockEffect, dockSlot, pinStaticLook, pinnedElsewhere, selectionIds, staticPinEdit]);

  const handleStateReset = useCallback(() => {
    if (!dockEffect) return;
    const defaults = defaultTemplatesFor(dockEffect, animateDefaults);
    const bundle = effectTemplates[dockEffect];
    if (!bundle) return;
    const idx = Math.min(Math.max(dockSlot, 0), bundle.slots.length - 1);
    const nextSlots = bundle.slots.slice();
    nextSlots[idx] = defaults.slots[idx];
    const nextBundle: EffectTemplateBundle = { ...bundle, slots: nextSlots };
    const nextTemplates = { ...effectTemplates, [dockEffect]: nextBundle };
    writeTemplates(nextTemplates, staticPinEdit || pinnedElsewhere ? null : dockEffect, true)
      .then(() => {
        setCommittedTemplates(nextTemplates);
        if (staticPinEdit) pinStaticLook(dockEffect, idx, selectionIds, nextBundle.slots[idx]);
      });
  }, [animateDefaults, dockEffect, dockSlot, effectTemplates, pinStaticLook, pinnedElsewhere, selectionIds, staticPinEdit, writeTemplates]);

  // Cross-panel usage drives the "used by a panel" badge. No exclusion: the
  // desktop page isn't a panel, so every panel background counts.
  const panelUsage = usePanelBackgroundUsage();

  // Grid cell = this surface's selected slot + its content hash, both from the
  // committed snapshot so thumbnails track commits, not drag frames.
  const slotForEffect = useCallback((e: string) => committedTemplates[e]?.selected ?? 0, [committedTemplates]);
  const versionForSlot = useCallback((e: string, slot: number) => {
    const b = committedTemplates[e];
    if (!b || b.slots.length === 0) return '0';
    return slotThumbSignature(b.slots[Math.min(Math.max(slot, 0), b.slots.length - 1)]);
  }, [committedTemplates]);
  // The grid highlights what the selection wears, so the highlighted tile has
  // to depict that device's preset - not the effect's shared pointer, which is
  // some other device's business.
  const gridSlotFor = useCallback(
    (e: string) => (scoped.kind === 'pin' && e === scoped.key ? scoped.slot : slotForEffect(e)),
    [scoped, slotForEffect],
  );
  const gridVersionFor = useCallback(
    (e: string) => versionForSlot(e, gridSlotFor(e)),
    [gridSlotFor, versionForSlot],
  );

  const postProcessRef = useRef({ screen: screenPP, media: mediaPP });
  postProcessRef.current = { screen: screenPP, media: mediaPP };

  const applyPostProcess = useCallback((next: PostProcessState, persist: boolean) => {
    if (ppMode === 'screen') {
      throttlePostProcess(() => setScreenEffect(next, persist));
    } else if (ppMode === 'gif') {
      throttlePostProcess(() => setMediaEffect(next, persist));
    }
  }, [ppMode, throttlePostProcess]);

  // Writes the ref first: a typed slider edit commits in the same tick.
  const handlePostProcessChange = useCallback((patch: Partial<PostProcessState>, commit: boolean) => {
    if (ppMode === 'screen') {
      const next = { ...postProcessRef.current.screen, ...patch };
      postProcessRef.current = { ...postProcessRef.current, screen: next };
      setScreenPP(next);
      applyPostProcess(next, commit);
    } else if (ppMode === 'gif') {
      const next = { ...postProcessRef.current.media, ...patch };
      postProcessRef.current = { ...postProcessRef.current, media: next };
      setMediaPP(next);
      applyPostProcess(next, commit);
    }
  }, [ppMode, applyPostProcess]);

  const handlePostProcessCommit = useCallback(() => {
    const snapshot = postProcessRef.current;
    if (ppMode === 'screen') setScreenEffect(snapshot.screen, true).catch(() => {});
    else if (ppMode === 'gif') setMediaEffect(snapshot.media, true).catch(() => {});
  }, [ppMode]);

  const handlePostProcessReset = useCallback(() => {
    if (ppMode === 'screen') {
      const next = { ...screenPP, hue: 0, colorize: 0, saturation: 1, contrast: 1, reactivity: 0.5, intensity: 0.5 };
      setScreenPP(next);
      setScreenEffect(next, true).catch(() => {});
    } else if (ppMode === 'gif') {
      const next = { ...mediaPP, hue: 0, colorize: 0, saturation: 1, contrast: 1 };
      setMediaPP(next);
      setMediaEffect(next, true).catch(() => {});
    }
  }, [ppMode, screenPP, mediaPP]);

  // Per-zone toggle (flips one device's current state). Paired with the
  // absolute handleSetPower below: a per-zone toggle applied to a whole
  // group would re-enable already-off zones in a partially-lit group.
  const handleTogglePower = useCallback((id: string) => {
    const current = devicesRef.current.find(d => d.id === id);
    if (!current) return;
    const nextOn = !current.ledsOn;
    setLightingDevicePower(id, nextOn).catch(() => { /* 3s poll reconciles */ });
    setDevices(prev => prev.map(d => d.id === id ? { ...d, ledsOn: nextOn } : d));
  }, []);
  // Absolute setter, used by group-header switches to set every child
  // zone to the same state (see handleTogglePower).
  const handleSetPower = useCallback((id: string, on: boolean) => {
    setLightingDevicePower(id, on).catch(() => { /* 3s poll reconciles */ });
    setDevices(prev => prev.map(d => d.id === id ? { ...d, ledsOn: on } : d));
  }, []);

  // "Controlled" mirrors the power toggle/setter pair above, but controls
  // whether Nexus pushes frames to the device at all (distinct from power,
  // which drives it to black). One write lands on every card the service
  // widens it to, so the optimistic state covers the same set.
  const handleToggleControlled = useCallback((id: string) => {
    const current = devicesRef.current.find(d => d.id === id);
    if (!current) return;
    const nextControlled = current.controlled === false;
    const ids = controlGroupOf(devicesRef.current, current);
    setLightingDeviceControlled(id, nextControlled).catch(() => { /* 3s poll reconciles */ });
    setDevices(prev => prev.map(d => ids.has(d.id) ? { ...d, controlled: nextControlled } : d));
  }, []);
  const handleSetControlled = useCallback((id: string, controlled: boolean) => {
    const current = devicesRef.current.find(d => d.id === id);
    const ids = current ? controlGroupOf(devicesRef.current, current) : new Set([id]);
    setLightingDeviceControlled(id, controlled).catch(() => { /* 3s poll reconciles */ });
    setDevices(prev => prev.map(d => ids.has(d.id) ? { ...d, controlled } : d));
  }, []);
  // The card keeps the hardware name it is replacing, so the LED settings
  // modal can still show what the device calls itself. A rename off an already
  // renamed card must not overwrite that with the previous custom name.
  const handleGroupsChange = useCallback((next: DeviceGroup[]) => {
    setDeviceGroups(next);
    saveLightingGroups(next).catch(() => { /* 3s poll reconciles */ });
  }, []);

  const handleRenameDevice = useCallback((id: string, name: string) => {
    renameLightingDevice(id, name).catch(() => { /* 3s poll reconciles */ });
    setDevices(prev => prev.map(d => {
      if (d.id === id) {
        // An empty name clears the rename: fall back to the hardware name the
        // card has been carrying, so the revert shows before the refetch.
        return name === ''
          ? { ...d, name: d.originalName ?? d.name, originalName: undefined }
          : { ...d, name, originalName: d.originalName ?? d.name };
      }
      // A group rename is keyed on the parent, so it lands on every member.
      if (d.parentDeviceId === id) {
        return name === ''
          ? { ...d, parentName: undefined }
          : { ...d, parentName: name };
      }
      // A device rename is keyed on the device id, so it lands on every zone
      // of that device (a board port's chain).
      if (d.deviceId === id) {
        return name === ''
          ? { ...d, deviceName: undefined }
          : { ...d, deviceName: name };
      }
      return d;
    }));
  }, []);

  // Device list ordering: HTML5 drag/drop on ZoneCard, persisted to
  // localStorage. Mirrors the fan-card reorder pattern, but local-only -
  // device identity is per-machine, not per-profile.
  const [deviceOrder, setDeviceOrder] = useState<string[]>(loadDeviceOrder);
  useEffect(() => {
    try { localStorage.setItem(DEVICE_ORDER_KEY, JSON.stringify(deviceOrder)); } catch { /* persist best-effort */ }
  }, [deviceOrder]);
  // Reconcile the saved order against the live devices list: drop ids for
  // devices that no longer exist, append new ones. Without this, the saved
  // order would accumulate dead ids across USB unplugs / OpenRGB rescans.
  useEffect(() => {
    if (devices.length === 0) return;
    setDeviceOrder(prev => {
      const ids = devices.map(d => d.id);
      const kept = prev.filter(id => ids.includes(id));
      for (const id of ids) if (!kept.includes(id)) kept.push(id);
      return kept.length === prev.length && kept.every((id, i) => id === prev[i]) ? prev : kept;
    });
  }, [devices]);
  const orderedDevices = useMemo(() => {
    if (visibleDevices.length === 0) return visibleDevices;
    let out: LightingDevice[] = visibleDevices;
    if (deviceOrder.length > 0) {
      const byId = new Map(visibleDevices.map(d => [d.id, d]));
      const ordered: LightingDevice[] = [];
      const seen = new Set<string>();
      for (const id of deviceOrder) {
        const d = byId.get(id);
        if (d) { ordered.push(d); seen.add(id); }
      }
      for (const d of visibleDevices) if (!seen.has(d.id)) ordered.push(d);
      out = ordered;
    }
    // Cards that are zones of one device stay in the order that device
    // reports them: on an ARGB port that is the order the user wired the
    // chain in, and the saved drag order is a flat list that would otherwise
    // pin them where they used to sit.
    return sortZonesWithinDevice(out);
  }, [visibleDevices, deviceOrder]);

  // Cards a PICK can land on: a zone the service could not drive, one with
  // Nexus Control off, or one with its lights off is excluded, because a colour
  // written to it would go nowhere. Seeds the first selection and scopes the
  // palette writes.
  // Nexus Control off means a vendor app owns the device, so the eye hides it
  // from the rail. The unfiltered list stays for the group headers' indicator.
  const hideUncontrolled = !uiSettings.showUncontrolledLightingDevices;
  const railSearch = useRailSearch();
  // What the rail search matches a card on: its names, the hardware group and
  // split it sits in, and every user group above it.
  const railSearchFields = useMemo(() => {
    const out = new Map<string, (string | undefined)[]>();
    const addZones = (b: ZoneBlock, labels: string[], rowIds: string[]) => {
      if (b.kind === 'single') {
        out.set(b.device.id, [b.device.name, b.device.originalName, ...labels, ...groupNamesOf(deviceGroups, [...rowIds, b.device.id])]);
        return;
      }
      for (const d of b.devices) {
        out.set(d.id, [d.name, d.originalName, ...labels, b.label, ...groupNamesOf(deviceGroups, [...rowIds, b.groupKey, d.id])]);
      }
    };
    for (const block of buildDeviceBlocks(orderedDevices)) {
      if (block.kind === 'group') {
        for (const b of block.blocks) addZones(b, [block.label], [block.groupKey]);
      } else {
        addZones(block, [], []);
      }
    }
    return out;
  }, [orderedDevices, deviceGroups]);
  const railDevices = useMemo(
    () => orderedDevices.filter(d => (!hideUncontrolled || d.controlled !== false)
      && matchesAllWords(railSearch.query, railSearchFields.get(d.id) ?? [d.name])),
    [orderedDevices, hideUncontrolled, railSearch.query, railSearchFields],
  );

  const selectableIds = useMemo(
    () => orderedDevices.filter(zoneCardSelectable).map(d => d.id),
    [orderedDevices],
  );
  // Cards a SELECTION can hold, which is wider: a click lands on a dark or
  // un-driven card too, since selecting it is how its menu gets opened.
  const selectionKeepIds = useMemo(
    () => orderedDevices.filter(d => !zoneCardUnavailable(d)).map(d => d.id),
    [orderedDevices],
  );
  // Select all takes dark cards too, but skips Nexus Control off ones, which the
  // eye can hide - so it never builds a selection the user cannot see. A search
  // narrows it to the matches for the same reason.
  const selectAllIds = useMemo(
    () => (railSearch.active ? railDevices : orderedDevices)
      .filter(d => !zoneCardUnavailable(d) && d.controlled !== false).map(d => d.id),
    [orderedDevices, railDevices, railSearch.active],
  );

  // Colour tuning. The modal owns its own device scope, but it opens on what
  // the user right-clicked: the whole selection when the clicked card is part
  // of one, that card alone otherwise - the same rule the menu's own labels
  // announce. Null while closed; the modal is mounted only while open so it
  // re-reads the stored trims each time.
  const tunableDevices = useMemo(
    () => orderedDevices.filter(zoneCardSelectable),
    [orderedDevices],
  );
  const [colorTuningIds, setColorTuningIds] = useState<string[] | null>(null);
  // Key reactions. The service lists every per-key keyboard card it can react
  // on; only those get the menu row. Fetched on mount and after each device
  // refresh, since a keyboard can appear or leave with the device list. The
  // modal mounts only while open so it opens on the stored config.
  const [keyReactive, setKeyReactive] = useState<KeyReactiveState | null>(null);
  const [keyReactionsId, setKeyReactionsId] = useState<string | null>(null);
  const refreshKeyReactive = useCallback(async () => {
    const data = await fetchKeyReactive().catch(() => null);
    if (data) setKeyReactive(data);
  }, []);
  const keyReactiveIds = useMemo(
    () => new Set((keyReactive?.devices ?? []).map(d => d.id)),
    [keyReactive],
  );
  const keyReactiveOnIds = useMemo(
    () => new Set((keyReactive?.devices ?? []).filter(d => d.config.enabled).map(d => d.id)),
    [keyReactive],
  );
  const keyReactionsDevice = keyReactionsId
    ? keyReactive?.devices.find(d => d.id === keyReactionsId)
    : undefined;
  // A keyboard that drops out of the list closes its editor for good, rather
  // than leaving it to reopen when the card comes back.
  useEffect(() => {
    if (keyReactionsId && keyReactive && !keyReactionsDevice) setKeyReactionsId(null);
  }, [keyReactionsId, keyReactive, keyReactionsDevice]);
  const handleOpenColorTuning = useCallback((cardId: string) => {
    setColorTuningIds(
      selectedDeviceIds.size > 1 && selectedDeviceIds.has(cardId)
        ? [...selectedDeviceIds]
        : [cardId],
    );
  }, [selectedDeviceIds]);


  // Off shuts the OpenRGB subprocess down, so the rail can be short for a
  // reason the list itself cannot show. The tail card says so while off, then
  // reports the scan that turning a mode on kicks off, then goes away.
  const [leftOff, setLeftOff] = useState(false);
  // Null until the sync resolves: the mode reads 'none' while hydrating, and
  // treating that as the user turning lighting on flashed the card on load.
  const wasOffRef = useRef<boolean | null>(null);
  const sawScanRef = useRef(false);
  useEffect(() => {
    if (!synced) return;
    const off = effectiveMode === 'none';
    if (wasOffRef.current === null) { wasOffRef.current = off; return; }
    if (off) { wasOffRef.current = true; sawScanRef.current = false; setLeftOff(false); return; }
    if (wasOffRef.current) { wasOffRef.current = false; sawScanRef.current = false; setLeftOff(true); }
  }, [effectiveMode, synced]);
  useEffect(() => {
    if (!leftOff) return undefined;
    if (rgb.scanning) { sawScanRef.current = true; return undefined; }
    // The scan we were reporting has ended.
    if (sawScanRef.current) { setLeftOff(false); return undefined; }
    // No scan was reported at all - a box with no OpenRGB never starts one, so
    // give up rather than leave the card claiming a scan forever. This bounds
    // a display state; nothing waits on it.
    const timer = setTimeout(() => setLeftOff(false), DISCOVERY_GRACE_MS);
    return () => clearTimeout(timer);
  }, [leftOff, rgb.scanning]);
  const discovery: DiscoveryState | undefined = effectiveMode === 'none'
    ? 'off'
    : (leftOff ? 'detecting' : undefined);

  // A restored selection can name devices that are gone (unplugged between
  // visits). Drop those once the list has loaded. Judged against what a click
  // can select, NOT the pick targets: this effect re-runs on every device
  // poll, so pruning to the narrower set would quietly undo the selection of a
  // card the user picked precisely because its lights were off.
  useEffect(() => {
    if (orderedDevices.length === 0) return;
    const keep = new Set(selectionKeepIds);
    setSelectedDeviceIds(prev => {
      if ([...prev].every(id => keep.has(id))) return prev;
      return new Set([...prev].filter(id => keep.has(id)));
    });
    setPrimaryDeviceId(prev => (prev && !keep.has(prev) ? null : prev));
  }, [orderedDevices, selectionKeepIds, setSelectedDeviceIds, setPrimaryDeviceId]);

  // Devices list: fetch on entry + profile change, then refresh push-driven.
  // The `lighting` topic fires on every /lighting mutation (layout edits,
  // renames). The `devices` topic fires on USB hardware add/remove. RGB
  // rescan completion has no topic frame, so we piggyback on rgb.scanning
  // transitioning back to false (useServiceState polls for that flip).
  const refreshDevices = useCallback(async () => {
    const data = await fetchLightingDevices();
    if (!data || deviceDraggingRef.current) return;
    const devices = (data.devices ?? []).map(d => ({
      ...d,
      canvasW: Math.max(60, d.canvasW),
      canvasH: Math.max(60, d.canvasH),
    }));
    setDevices(devices);
    setDeviceGroups(data.groups ?? []);
    setDeviceStacks(data.stacks ?? []);
    void refreshKeyReactive();
  }, [refreshKeyReactive]);

  useEffect(() => {
    if (!serviceOnline) return;
    void refreshDevices();
    void refreshPins();
  }, [serviceOnline, activeProfileId, refreshDevices, refreshPins]);

  useEffect(() => {
    if (!serviceOnline) return;
    void refreshLianLiModes();
    void refreshWirelessPresets();
  }, [serviceOnline, refreshLianLiModes, refreshWirelessPresets]);

  useEffect(() => {
    const onFocus = () => {
      if (!serviceOnline) return;
      void refreshLianLiModes();
      void refreshWirelessPresets();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [serviceOnline, refreshLianLiModes, refreshWirelessPresets]);

  useTopicCallback('devices', serviceOnline, () => {
    void refreshDevices();
  });

  const prevScanningRef = useRef(rgb.scanning);
  useEffect(() => {
    if (prevScanningRef.current && !rgb.scanning) void refreshDevices();
    prevScanningRef.current = rgb.scanning;
  }, [rgb.scanning, refreshDevices]);

  const {
    presets, activeId: layoutActiveId,
    presetCount, loadPresets,
    handleCreate: handlePresetCreate,
    handleRename: handlePresetRename,
    handleDelete: handlePresetDelete,
    handleLoad: handlePresetLoad,
    handleSetApps: handlePresetSetApps,
  } = useLayoutPresets(serviceOnline, activeProfileId);

  // Snapshot of the preset the app-binding modal was opened for. The service
  // can activate a different preset while it is open (a bound app taking
  // focus), which would otherwise retarget the save.
  const [presetAppsTarget, setPresetAppsTarget] = useState<{ id: string; name: string; apps: PresetApp[] } | null>(null);
  // Apps other presets already trigger, keyed by id and by resolved process
  // name so the same app picked two ways is recognised as one.
  const takenApps = useMemo(() => {
    const out: Record<string, string> = {};
    for (const preset of presets) {
      if (preset.id === presetAppsTarget?.id) continue;
      for (const app of preset.apps ?? []) {
        out[app.id] = preset.name;
        if (app.processName) out[app.processName] = preset.name;
      }
    }
    return out;
  }, [presets, presetAppsTarget?.id]);

  const presetOptions = useMemo(
    () => presets.map(p => ({ id: p.id, name: p.name, hasApps: (p.apps?.length ?? 0) > 0 })),
    [presets],
  );

  layoutActiveIdRef.current = layoutActiveId;

  const undoRedoRef = useRef<{
    undo: (current: LayoutHistorySnapshot) => LayoutHistorySnapshot | null;
    redo: (current: LayoutHistorySnapshot) => LayoutHistorySnapshot | null;
  }>({ undo: () => null, redo: () => null });

  const handleUndoLayout = useCallback(async () => {
    const current: LayoutHistorySnapshot = { layouts: devicesToLayouts(devicesRef.current), power: devicesToPower(devicesRef.current), activeId: layoutActiveIdRef.current, powerIds: [] };
    const restored = undoRedoRef.current.undo(current);
    if (!restored) return;
    // The entry now on the redo stack must reconcile the same ids when redone.
    // setStacks stored a reference to current, so this mutation updates the stored entry.
    current.powerIds = restored.powerIds;
    await applyDeviceLayouts(restored.layouts);
    const powerIds = restored.powerIds ?? [];
    const powerChanges = powerIds.filter(id => {
      const dev = devicesRef.current.find(d => d.id === id);
      return dev !== undefined && restored.power[id] !== undefined && dev.ledsOn !== restored.power[id];
    });
    if (powerChanges.length > 0) {
      const changeSet = new Set(powerChanges);
      setDevices(prev => prev.map(d => changeSet.has(d.id) ? { ...d, ledsOn: restored.power[d.id] } : d));
      await Promise.all(powerChanges.map(id => setLightingDevicePower(id, restored.power[id]).catch(() => { /* 3s poll reconciles */ })));
    }
    if (restored.activeId !== layoutActiveIdRef.current) {
      await setActiveLayoutPreset(restored.activeId);
    }
    if (restored.activeId) {
      await updateLayoutPreset(restored.activeId, { saveCurrent: true, saveDeviceLooks: false });
    }
    await loadPresets();
    await refreshDevices();
  }, [loadPresets, refreshDevices]);

  const handleRedoLayout = useCallback(async () => {
    const current: LayoutHistorySnapshot = { layouts: devicesToLayouts(devicesRef.current), power: devicesToPower(devicesRef.current), activeId: layoutActiveIdRef.current, powerIds: [] };
    const restored = undoRedoRef.current.redo(current);
    if (!restored) return;
    // The entry now on the undo stack must reconcile the same ids when undone.
    // setStacks stored a reference to current, so this mutation updates the stored entry.
    current.powerIds = restored.powerIds;
    await applyDeviceLayouts(restored.layouts);
    const powerIds = restored.powerIds ?? [];
    const powerChanges = powerIds.filter(id => {
      const dev = devicesRef.current.find(d => d.id === id);
      return dev !== undefined && restored.power[id] !== undefined && dev.ledsOn !== restored.power[id];
    });
    if (powerChanges.length > 0) {
      const changeSet = new Set(powerChanges);
      setDevices(prev => prev.map(d => changeSet.has(d.id) ? { ...d, ledsOn: restored.power[d.id] } : d));
      await Promise.all(powerChanges.map(id => setLightingDevicePower(id, restored.power[id]).catch(() => { /* 3s poll reconciles */ })));
    }
    if (restored.activeId !== layoutActiveIdRef.current) {
      await setActiveLayoutPreset(restored.activeId);
    }
    if (restored.activeId) {
      await updateLayoutPreset(restored.activeId, { saveCurrent: true, saveDeviceLooks: false });
    }
    await loadPresets();
    await refreshDevices();
  }, [loadPresets, refreshDevices]);

  const {
    push: pushLayout,
    undo: undoLayout,
    redo: redoLayout,
    canUndo: canUndoLayout,
    canRedo: canRedoLayout,
    reset: resetLayoutHistory,
  } = useUndoRedo<LayoutHistorySnapshot>({
    maxDepth: 50,
    // Off while the LED map editor is open: it has its own undo/redo on the same
    // Cmd/Ctrl+Z, and both listen on window, so an enabled layout history would
    // also fire and undo the canvas underneath the modal.
    enabled: editorTarget === null,
    onUndo: handleUndoLayout,
    onRedo: handleRedoLayout,
    store: layoutHistoryStore,
  });

  undoRedoRef.current = { undo: undoLayout, redo: redoLayout };
  pushLayoutRef.current = pushLayout;

  const handlePresetLoadWithHistory = useCallback(async (id: string) => {
    pushLayout({ layouts: devicesToLayouts(devicesRef.current), power: devicesToPower(devicesRef.current), activeId: layoutActiveIdRef.current, powerIds: devicesRef.current.map(d => d.id) });
    await handlePresetLoad(id);
    await refreshDevices();
    await refreshPins();
  }, [pushLayout, handlePresetLoad, refreshDevices, refreshPins]);

  const handleResetWithHistory = useCallback(async () => {
    resetLayoutHistory();
    await resetDeviceLayouts();
    const id = layoutActiveIdRef.current;
    if (id) {
      // saveCurrent after resetDeviceLayouts writes an empty layouts map into the preset,
      // which the service interprets as "use provider defaults" on next activation.
      await updateLayoutPreset(id, { saveCurrent: true });
    }
    await loadPresets();
    await refreshDevices();
  }, [resetLayoutHistory, loadPresets, refreshDevices]);

  const handleLayoutCommit = useCallback(async () => {
    const id = layoutActiveIdRef.current;
    if (!id) return;
    await updateLayoutPreset(id, { saveCurrent: true });
    await loadPresets();
  }, [loadPresets]);

  // A new stack lands every member on the first member's frame, so the set
  // shares one rect from then on; the selection grows to hold whole stacks.
  // The stacks save first: a layout save's broadcast must not refetch the old
  // list and drop the badge until the second lands.
  const handleStacksChange = useCallback((next: DeviceStack[]) => {
    const before = deviceStacksRef.current;
    setDeviceStacks(next);
    deviceStacksRef.current = next;
    setSelectedDeviceIds(prev => withStacked(next, prev));
    saveLightingStacks(next).catch(() => { /* 3s poll reconciles */ });
    const fresh = next.filter(s => !before.some(b => b.id === s.id));
    if (fresh.length > 0) {
      handleBeforeLayoutSave();
      const rect = new Map<string, { x: number; y: number; w: number; h: number; r: number }>();
      for (const stack of fresh) {
        const lead = devicesRef.current.find(d => stack.members.includes(d.id));
        if (!lead) continue;
        for (const m of stack.members) {
          if (m !== lead.id) rect.set(m, { x: lead.canvasX, y: lead.canvasY, w: lead.canvasW, h: lead.canvasH, r: lead.canvasRotation ?? 0 });
        }
      }
      setDevices(prev => prev.map(d => {
        const to = rect.get(d.id);
        return to ? { ...d, canvasX: to.x, canvasY: to.y, canvasW: to.w, canvasH: to.h, canvasRotation: to.r } : d;
      }));
      void Promise.all([...rect].map(([id, to]) => saveDeviceLayout(id, to.x, to.y, to.w, to.h, to.r)))
        .then(() => handleLayoutCommit())
        .catch(() => { /* 3s poll reconciles */ });
    }
  }, [handleBeforeLayoutSave, handleLayoutCommit, setSelectedDeviceIds]);

  // Stacks outlive an undo or a preset load, which restore per-device rects;
  // a member that drifted off its frame is put back on it and saved.
  useEffect(() => {
    if (deviceDraggingRef.current || deviceStacks.length === 0) return;
    const drift: [string, LightingDevice][] = [];
    for (const stack of deviceStacks) {
      const members = devices.filter(d => stack.members.includes(d.id));
      const lead = members[0];
      if (!lead) continue;
      for (const m of members.slice(1)) {
        if (m.canvasX !== lead.canvasX || m.canvasY !== lead.canvasY || m.canvasW !== lead.canvasW
          || m.canvasH !== lead.canvasH || (m.canvasRotation ?? 0) !== (lead.canvasRotation ?? 0)) drift.push([m.id, lead]);
      }
    }
    if (drift.length === 0) return;
    const to = new Map(drift);
    setDevices(prev => prev.map(d => {
      const lead = to.get(d.id);
      return lead ? { ...d, canvasX: lead.canvasX, canvasY: lead.canvasY, canvasW: lead.canvasW, canvasH: lead.canvasH, canvasRotation: lead.canvasRotation ?? 0 } : d;
    }));
    for (const [id, lead] of drift) {
      saveDeviceLayout(id, lead.canvasX, lead.canvasY, lead.canvasW, lead.canvasH, lead.canvasRotation ?? 0).catch(() => { /* 3s poll reconciles */ });
    }
  }, [devices, deviceStacks]);

  // The canvas menu's stack rows over a frame selection: the same rule the
  // rail applies, over the rail's own blocks.
  const stackActionsFor = useCallback((ids: string[]) => {
    if (isStackedSet(deviceStacksRef.current, ids)) {
      const stack = stackOf(deviceStacksRef.current, ids[0])!;
      return {
        unstack: () => handleStacksChange(unstackDevices(deviceStacksRef.current, ids)),
        layout: { current: stackLayoutOf(stack), set: (layout: StackLayout) => handleStacksChange(setStackLayout(deviceStacksRef.current, ids[0], layout)) },
      };
    }
    if (canStack(buildDeviceBlocks(devicesRef.current), deviceGroups, ids)) {
      return { stack: () => handleStacksChange(stackDevices(deviceStacksRef.current, ids)) };
    }
    return {};
  }, [deviceGroups, handleStacksChange]);

  const handleSetDevicesPower = useCallback(async (ids: string[], on: boolean) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    pushLayoutRef.current?.({
      layouts: devicesToLayouts(devicesRef.current),
      power: devicesToPower(devicesRef.current),
      activeId: layoutActiveIdRef.current,
      powerIds: ids,
    });
    setDevices(prev => prev.map(d => idSet.has(d.id) ? { ...d, ledsOn: on } : d));
    await Promise.all(ids.map(id => setLightingDevicePower(id, on).catch(() => { /* 3s poll reconciles */ })));
    const presetId = layoutActiveIdRef.current;
    if (presetId) { await updateLayoutPreset(presetId, { saveCurrent: true }); await loadPresets(); }
  }, [loadPresets]);

  const handleModeChange = useCallback(async (m: LightingMode) => {
    setMode(m);
    // Starting any mode is never paused - reset optimistically so a stale
    // "paused" trailing glyph can't flash on the newly active tab while the
    // server confirms (paused doesn't carry across a mode switch).
    setPausedState(false);
    // Set rawSync optimistically so content renders the new mode immediately
    // without waiting for the publishControlSync round-trip.
    if (m !== 'animate') setRawSync(m);
    try {
      switch (m) {
        case 'animate': {
          const key = ANIMATE_EFFECTS.some(e => e.key === activeEffect)
            ? activeEffect
            : (ANIMATE_EFFECTS.some(e => e.key === rawSync) ? rawSync : animateEffectRef.current);
          setActiveEffect(key);
          setRawSync(key);
          const state = stateFor(key);
          await startAnimate(key, state.speed, state.intensity, state.hue, state.colorize, state.saturation, state.contrast, state.params);
          publishControlSync({ domain: 'lighting', mode: m, rawSync: key, effect: key });
          break;
        }
        case 'static': {
          const key = isStaticEffect(activeEffect) ? activeEffect : staticEffectRef.current;
          setActiveEffect(key);
          const state = stateFor(key);
          // Entering Static keeps a global flat colour: an effect start without one would clear it.
          await startStatic(key, state.intensity, state.hue, state.colorize, state.saturation, state.contrast, state.params, true, globalColor || undefined);
          publishControlSync({ domain: 'lighting', mode: m, rawSync: 'static', effect: key });
          break;
        }
        case 'screen':
          await startScreenMirror(screenPP.saturation, screenPP.contrast, undefined, screenPP.hue, screenPP.colorize);
          break;
        case 'gif': {
          const played = await playCurrentOrFirstMedia();
          if (!played) {
            // No playable media: black output while staying in Media mode, so
            // the tab stays selected instead of falling to Off.
            await mediaIdle();
          }
          break;
        }
        case 'gamesync':
          await startGameSync();
          break;
        case 'none': await stopLighting(); break;
      }
      if (m !== 'animate') {
        publishControlSync({ domain: 'lighting', mode: m, rawSync: m });
      }
    } catch { /* best-effort; backend state becomes source of truth */ }
  }, [activeEffect, globalColor, rawSync, setMode, setRawSync, screenPP, stateFor, setPausedState]);

  // Simple mode has no device rail, so a colour is the exact global flat colour.
  // Static has to own the output first.
  const handleSimplePaletteSelect = useCallback(async (color: PaletteColor) => {
    if (effectiveMode !== 'static') await handleModeChange('static');
    setGlobalColor(color.hex);
    void startStatic(DEFAULT_STATIC_EFFECT, 1, 0, 0, 1, 1, {}, true, color.hex).catch(() => {});
  }, [effectiveMode, handleModeChange]);

  // Simple mode has no per-device toggle, so a device left un-driven or dark on
  // the advanced page would sit black here with nothing on the page saying why.
  // Claimed when the user asks for something, not on arrival: switching the
  // view is not a decision about which devices Nexus drives.
  const claimAllDevices = useCallback((): string[] => {
    for (const d of devices) {
      if (d.controlled === false) handleSetControlled(d.id, true);
      if (!d.ledsOn) handleSetPower(d.id, true);
    }
    return orderedDevices.filter(d => !zoneCardUnavailable(d)).map(d => d.id);
  }, [devices, orderedDevices, handleSetControlled, handleSetPower]);

  // Counted over the devices the claim can actually reach. A zone with no LEDs
  // cannot be lit, so including it would leave the ratio permanently short of
  // its total and pin the claim button on screen with nothing left to do.
  const claimableDevices = useMemo(
    () => orderedDevices.filter(d => !zoneCardUnavailable(d)),
    [orderedDevices],
  );
  // Matches zoneCardSelectable: a device Nexus drives AND that is lit. Counting
  // only `controlled` would claim a dark device is being driven.
  const controlledCount = useMemo(
    () => claimableDevices.filter(d => d.controlled !== false && d.ledsOn).length,
    [claimableDevices],
  );

  // The switch holds a browser-local preference, but the direction the hardware
  // is running is the stored speed sign - conform to it once per sweep so a
  // second browser does not show the switch the wrong way round.
  const reverseReadFor = useRef<string | null>(null);

  // A sweep is one shared shader for every device, so starting Animate is the
  // whole assignment - there is no per-device write to make. activeEffect is
  // cleared because a sweep has no cell in the advanced grid: leaving the last
  // catalogue key there marks that cell selected and draws its shader on the
  // canvas while the hardware runs this one.
  const handleSimpleAnimationSelect = useCallback(async (key: string) => {
    claimAllDevices();
    setActiveEffect('');
    // This IS the direction now, so the conform read below must not run for
    // this key: rawSync goes optimistic, and the stored sign is still the old
    // one until the start persists.
    reverseReadFor.current = key;
    setMode('animate');
    setRawSync(key);
    const state = simpleAnimationState(simpleReversed);
    try {
      // Re-picking the running sweep reuses the live shader, and that path
      // never clears the engine's hold, so a paused engine has to be released
      // explicitly or the tile lights up over frozen LEDs.
      if (paused) { setPausedState(false); await setLightingPaused(false); }
      await startAnimate(key, state.speed, state.intensity, state.hue, state.colorize, state.saturation, state.contrast, state.params);
      publishControlSync({ domain: 'lighting', mode: 'animate', rawSync: key, effect: key });
    } catch { /* the sync poll reconciles */ }
  }, [claimAllDevices, paused, setMode, setPausedState, setRawSync, simpleReversed]);

  // The running sweep, which is also what marks a tile.
  const simpleAnimation = synced && effectiveMode === 'animate' && isSimpleAnimation(rawSync)
    ? rawSync
    : null;

  // Turning the row around restarts the running sweep with the other sign.
  const handleSimpleReverse = useCallback(async (next: boolean) => {
    setSimpleReversed(next);
    if (!simpleAnimation) return;
    const state = simpleAnimationState(next);
    try {
      // Same in-place uniform path a re-pick takes, which never clears the
      // engine's hold, so a paused engine has to be released explicitly.
      if (paused) { setPausedState(false); await setLightingPaused(false); }
      await startAnimate(simpleAnimation, state.speed, state.intensity, state.hue, state.colorize, state.saturation, state.contrast, state.params);
      publishControlSync({ domain: 'lighting', mode: 'animate', rawSync: simpleAnimation, effect: simpleAnimation });
    } catch { /* the sync poll reconciles */ }
  }, [paused, setPausedState, simpleAnimation, setSimpleReversed]);

  useEffect(() => {
    if (!simpleAnimation || reverseReadFor.current === simpleAnimation) return;
    reverseReadFor.current = simpleAnimation;
    let cancelled = false;
    fetchAnimateSettings().then(data => {
      const speed = data?.states?.[simpleAnimation]?.speed;
      if (!cancelled && typeof speed === 'number') setSimpleReversed(speed < 0);
    }).catch(() => { /* keep the local value */ });
    return () => { cancelled = true; };
  }, [simpleAnimation, setSimpleReversed]);

  // The swatch simple mode marks active: the exact global colour, when it is
  // one of the palette's.
  const simplePaletteId = useMemo(() => {
    if (effectiveMode !== 'static' || !globalColor) return null;
    return PALETTE.find(c => c.hex.toLowerCase() === globalColor.toLowerCase())?.id ?? null;
  }, [effectiveMode, globalColor]);

  // The simple page can only show Off or one palette swatch; anything else
  // leaves nothing marked active. `synced` gates it: an unsynced mode is a guess.
  const simpleCustomActive = synced && effectiveMode !== 'none' && !simpleAnimation
    && selectableIds.length > 0 && simplePaletteId === null;

  // A press or pick pulses the cards it changed; a new seq replays it.
  const [pulse, setPulse] = useState<{ ids: ReadonlySet<string>; seq: number }>({ ids: new Set(), seq: 0 });
  const pulseCards = useCallback((ids: ReadonlySet<string>) => setPulse(s => ({ ids, seq: s.seq + 1 })), []);
  const pulsePick = () => pulseCards(pressReach(visibleDevices, pins, selectedDeviceIds));
  // Pause/freeze applies to the three modes that drive a continuous output
  // (animate shader, media playback, screen mirror) - Off has nothing to
  // freeze and Game Sync is driven by the foreground game, not us.
  // Off is not a tab any more: it shares the first tab with the simple /
  // advanced swap, which the tab opens as a menu instead of switching mode.
  const modeMenu = usePageModeMenu({
    mode: simpleDashboard ? 'simple' : 'advanced',
    off: synced && effectiveMode === 'none',
    offIcon: LIGHTING_MODE_ICONS.none,
    offLabel: t('lighting.mode.off'),
    offDescription: t('lighting.modeMenu.offDesc'),
    simpleDescription: t('lighting.modeMenu.simpleDesc'),
    advancedDescription: t('lighting.modeMenu.advancedDesc'),
    // Simple mode never shows the device list, so Off claims what it can reach
    // first - the same claim the palette runs, so the page's counts agree.
    onOff: () => {
      // Already off: asking again would re-run the claim and re-issue the stop.
      if (synced && effectiveMode === 'none') return;
      pulseCards(pressReach(visibleDevices, pins, selectedDeviceIds, true));
      if (simpleDashboard) claimAllDevices();
      void handleModeChange('none');
    },
    onModeChange: setDashboardMode,
  });
  const modeMenuTab = {
    key: MODE_MENU_TAB_KEY,
    label: modeMenu.triggerLabel,
    ariaLabel: modeMenu.triggerAriaLabel,
    icon: modeMenu.triggerIcon,
    chip: true,
    expanded: modeMenuOpen,
  };
  const modeTabs = [modeMenuTab, ...MODES
    .filter(m => m.key !== 'none')
    .filter(m => m.key !== 'gamesync' || isWindows)
    .map(m => {
      const Icon = LIGHTING_MODE_ICONS[m.key];
      const showPauseToggle = synced && m.key === effectiveMode
        && (m.key === 'animate' || m.key === 'gif' || m.key === 'screen');
      return {
        key: m.key,
        label: t(m.labelKey),
        icon: <Icon size={14} />,
        trailing: showPauseToggle ? (
          <HoverTooltip body={t(paused ? 'lighting.resume' : 'lighting.pause')} side="top">
            <span
              role="button"
              tabIndex={0}
              className={`${styles.pauseToggle} ${paused ? styles.pauseTogglePaused : ''}`}
              aria-label={t(paused ? 'lighting.resume' : 'lighting.pause')}
              onClick={e => { e.stopPropagation(); void handlePauseToggle(); }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  void handlePauseToggle();
                }
              }}
            >
              {/* stroke="none": the glyph inherits a translucent currentColor, so a
                  same-colour stroke composites over the fill and paints a brighter
                  rim - a solid shape reads as an outline. Fill alone is uniform. */}
              {paused
                ? <Play size={13} fill="currentColor" stroke="none" />
                : <Pause size={13} fill="currentColor" stroke="none" />}
            </span>
          </HoverTooltip>
        ) : undefined,
      };
    })];
  // The strip marks the mode tab while lighting is off - it is the tab Off now
  // lives on. Every other mode still marks its own tab.
  const activeTabKey = !synced ? undefined
    : (viewMode === 'none' ? MODE_MENU_TAB_KEY : viewMode);
  // What a tab press gives the selected cards: that mode's global look, or the
  // one shared Mirror or Media. Game Sync and Off cannot be pinned, so they
  // always change everything.
  const tabPinFor = (m: LightingMode): Pin | null => {
    switch (m) {
      case 'static': {
        if (globalColor) return colorPin(globalColor);
        const key = effectiveMode === 'static' && isStaticEffect(activeEffect) ? activeEffect : staticEffectRef.current;
        return staticLookPin(key, slotOf(key), stateOf(key, slotOf(key)));
      }
      case 'animate':
        return animatePin((effectiveMode === 'animate' ? (simpleAnimation ?? activeEffect) : '') || animateEffectRef.current);
      case 'screen': return MIRROR_PIN;
      case 'gif': return MEDIA_PIN;
      default: return null;
    }
  };
  // Hovering a mode tab, the scope chip or a pick control (color field, effect
  // or media tile) previews the reach of its press. A press or the advanced
  // page unmounting skips the pointerleave, so both clear it.
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [scopeHovered, setScopeHovered] = useState(false);
  const [pickHovered, setPickHovered] = useState(false);
  const advancedHeader = serviceOnline && !simpleDashboard;
  const [hoverHeader, setHoverHeader] = useState(advancedHeader);
  if (hoverHeader !== advancedHeader) {
    setHoverHeader(advancedHeader);
    setHoveredTab(null);
    setScopeHovered(false);
    setPickHovered(false);
  }
  // A tab press either opens the mode menu or applies a mode: to the selected
  // cards when there are any, else to every unpinned one. A mode switch also
  // drops the menu, which the tab row keeps "inside" its anchor.
  const handleTabChange = (key: string) => {
    setHoveredTab(null);
    if (key === MODE_MENU_TAB_KEY) {
      setModeMenuOpen(open => !open);
      return;
    }
    closeModeMenu();
    if (!tabPressChangesNothing(key, activeTabKey, selectedDeviceIds.size, scoped.kind === 'pin')) {
      pulseCards(pressReach(visibleDevices, pins, selectedDeviceIds, key === 'gamesync'));
    }
    const pin = selectedDeviceIds.size > 0 ? tabPinFor(key as LightingMode) : null;
    if (pin) {
      // Cards already pinned to this mode keep their own look.
      if (!(scoped.kind === 'pin' && key === viewMode)) void applyPins([...selectedDeviceIds], pin);
      return;
    }
    void handleModeChange(key as LightingMode);
  };

  const shaderMode = viewMode === 'animate' || viewMode === 'static';
  // The preview stands for the selection; with nothing selected it is every
  // unpinned device, and the chip says how many pins a pick skips.
  const pinnedShown = visibleDevices.filter(d => d.id in pins).length;
  // The cards a hovered press or pick reaches, outlined. Off and Game Sync have no picks.
  const pickTargetIds = useMemo(() => {
    if (scopeHovered || pickHovered) {
      return viewMode === 'none' || viewMode === 'gamesync' ? undefined : pressReach(visibleDevices, pins, selectedDeviceIds);
    }
    if (!hoveredTab || hoveredTab === MODE_MENU_TAB_KEY) return undefined;
    if (tabPressChangesNothing(hoveredTab, activeTabKey, selectedDeviceIds.size, scoped.kind === 'pin')) return undefined;
    return pressReach(visibleDevices, pins, selectedDeviceIds, hoveredTab === 'gamesync');
  }, [scopeHovered, pickHovered, viewMode, hoveredTab, activeTabKey, scoped.kind, pins, selectedDeviceIds, visibleDevices]);
  const pinnedNames = useMemo(() => visibleDevices.filter(d => d.id in pins).map(canvasLabelName), [visibleDevices, pins]);
  const previewBadgeLabel = selectedDeviceIds.size > 0
    ? t(pluralKey('lighting.pane.selectedCount', language, selectedDeviceIds.size), { count: selectedDeviceIds.size })
    : pinnedShown === 0 ? t('lighting.pane.allDevices')
      : pinnedShown === visibleDevices.length ? t('lighting.pane.allPinned')
        : t(pluralKey('lighting.pane.allExceptPinned', language, pinnedShown), { count: pinnedShown });
  // The hover span stays mounted as the tooltip comes and goes, so its pointerleave always fires.
  const scopeBadge = (
    <Badge
      label={previewBadgeLabel}
      compact
      uppercase
      color={selectedDeviceIds.size > 0 ? 'var(--accent-glow)' : 'var(--text-dim)'}
    />
  );
  const scopeChip = (
    <span
      className={styles.scopeChip}
      onPointerEnter={e => { if (e.pointerType === 'mouse') setScopeHovered(true); }}
      onPointerLeave={e => { if (e.pointerType === 'mouse') setScopeHovered(false); }}
    >
      {selectedDeviceIds.size === 0 && pinnedNames.length > 0 ? (
        <HoverTooltip title={t('lighting.badge.pinnedDevices')} body={pinnedNames.join(', ')} side="bottom">
          <span>{scopeBadge}</span>
        </HoverTooltip>
      ) : scopeBadge}
    </span>
  );
  const pinnedDevices = useMemo(() => {
    const names = new Map(devices.map(d => [d.id, d.name]));
    return pinnedNamesByEffect(pins, viewMode === 'static' ? 'static' : 'animate', id => names.get(id));
  }, [pins, devices, viewMode]);
  // A global flat colour is what Static is showing, so no effect tile reads as selected beside it.
  const gridEffect = scoped.kind === 'pin' ? scoped.key
    : (scoped.kind === 'mixed' || (scoped.kind === 'none' && viewMode === 'static' && globalColor) ? '' : activeEffect);
  // With nothing selected, re-picking the running tile changes no card, so it
  // pulses none. A selection's re-pick can move a static pin to the current slot.
  const handleEffectPick = (key: string) => {
    if (!(key === gridEffect && selectedDeviceIds.size === 0)) pulsePick();
    handleEffectSelect(key);
  };
  // The colour the selection wears, which is where its dots sit on the field.
  const scopedHex = scoped.kind === 'pin' ? scoped.hex : (scoped.kind === 'none' ? globalColor : '');
  // Selected devices wearing different pins have no single value for the
  // controls to edit, so the dock locks until the selection agrees. Mirror's
  // and Media's controls are shared, so their dock never locks.
  const mixedSelection = scoped.kind === 'mixed' && viewMode !== 'screen' && viewMode !== 'gif';
  const allSelected = selectAllIds.length > 0 && selectAllIds.every(id => selectedDeviceIds.has(id));
  // The canvas previews the shared effect canvas, which Static does not sample
  // and Off has nothing to show on. Game Sync substitutes its own activity block.
  const showCanvas = viewMode !== 'static' && viewMode !== 'none' && viewMode !== 'gamesync';
  // The device list is the canvas filter: the canvas draws exactly what the
  // list has selected. Which of those frames is focused is the canvas's own
  // state (`canvasFocusIds`), so a canvas click never removes a frame.
  // Nothing selected draws the preview alone: frames and names belong to selected cards.
  const canvasDevices = useMemo(
    () => selectedDeviceIds.size === 0 ? visibleDevices : visibleDevices.filter(d => selectedDeviceIds.has(d.id)),
    [visibleDevices, selectedDeviceIds],
  );

  // Static's canvas is the colour picker. A pattern pin replaces the field
  // with the effect's own render; a colour pin (or none yet) keeps the field.
  const staticPattern = viewMode === 'static' && pinTarget?.pin.kind === 'static' && !isPaletteKey(pinTarget.key)
    ? { key: pinTarget.key, slot: pinTarget.slot }
    : null;
  // The picker tiles stand for "this selection's colour was chosen by hand", so
  // only a colour pin, or the global flat colour, lights one.
  const colorScoped = viewMode === 'static' && (pinTarget?.pin.kind === 'static'
    ? isPaletteKey(pinTarget.key)
    : scoped.kind === 'none' && globalColor !== '');
  const pickerDevices = useMemo(
    () => pickerMarks(canvasDevices, pins, selectedDeviceIds, globalColor),
    [canvasDevices, globalColor, pins, selectedDeviceIds],
  );
  // The picker tiles re-flatten the selection onto the colour it already shows,
  // the way the palette's custom slot did; the segmented one conforms it to the
  // nearest swatch, which is what makes the two tiles distinct picks.
  const handlePickerSelect = useCallback((toSegment: boolean) => {
    setPickerSegmented(toSegment);
    const base = scopedHex || customStaticColor || '#ff0000';
    if (!toSegment) {
      handleCustomSelect(base);
      return;
    }
    const p = pickerPointFor(base);
    const snapped = snapToSegment(p.x, p.y);
    handleCustomSelect(pickerHexAt(snapped.x, snapped.y));
  }, [customStaticColor, handleCustomSelect, scopedHex, setPickerSegmented]);

  // What a press on a following card's pin pins it to: the current global
  // source. Static pins the global static look, Animate the running shader,
  // Mirror pins the one universal mirror. Media, Game Sync and Off cannot be
  // pinned to.
  const effectLabel = useCallback((key: string) => {
    const def = EFFECTS.find(e => e.key === key);
    return def ? t(def.labelKey) : key;
  }, [t]);
  const globalPin: { pin: Pin; name: string } | null = useMemo(() => {
    if (!synced) return null;
    if (effectiveMode === 'static') {
      return activeEffect ? { pin: staticLookPin(activeEffect, slotOf(activeEffect), stateOf(activeEffect, slotOf(activeEffect))), name: effectLabel(activeEffect) } : null;
    }
    if (effectiveMode === 'animate') {
      const key = simpleAnimation ?? activeEffect;
      return key ? { pin: animatePin(key), name: simpleAnimation ? t(simpleAnimationLabelKey(simpleAnimation)) : effectLabel(key) } : null;
    }
    if (effectiveMode === 'screen') return { pin: MIRROR_PIN, name: t('lighting.mode.screen') };
    if (effectiveMode === 'gif') return { pin: MEDIA_PIN, name: t('lighting.mode.gif') };
    return null;
  }, [activeEffect, effectLabel, effectiveMode, simpleAnimation, slotOf, stateOf, synced, t]);
  const pinDisabledReason = globalPin ? undefined : t(
    effectiveMode === 'gamesync' ? 'lighting.pin.disabledGameSync'
        : effectiveMode === 'none' ? 'lighting.pin.disabledOff'
          : 'lighting.pin.disabledUnavailable',
  );
  const pinTargetName = useCallback((pin: Pin): string => pinModeTargetLabel(pin, t), [t]);
  const handleSetPin = useCallback((ids: string[], pinned: boolean) => {
    if (!pinned) { void applyPins(ids, null); return; }
    if (globalPin) void applyPins(ids, globalPin.pin);
  }, [applyPins, globalPin]);
  // A Mirror or Media pick with cards selected gives just them the shared source.
  const handleSelectionPick = useMemo(() => {
    if (selectedDeviceIds.size === 0 || (viewMode !== 'screen' && viewMode !== 'gif')) return undefined;
    const pin = viewMode === 'screen' ? MIRROR_PIN : MEDIA_PIN;
    const ids = [...selectedDeviceIds];
    return () => { void applyPins(ids, pin); };
  }, [applyPins, selectedDeviceIds, viewMode]);
  // A Mirror or Media pick also changes the shared source every card already
  // wearing it shows: those pinned to it, and the unpinned ones while it is global.
  const handleSharedPick = useCallback(() => {
    const kind = viewMode === 'screen' ? 'mirror' : 'media';
    const reach = pressReach(visibleDevices, pins, selectedDeviceIds);
    for (const d of visibleDevices) {
      if (d.ledsOn === false || d.controlled === false) continue;
      const pin = pins[d.id];
      if (pin ? pin.kind === kind : effectiveMode === viewMode) reach.add(d.id);
    }
    pulseCards(reach);
    handleSelectionPick?.();
  }, [viewMode, visibleDevices, pins, selectedDeviceIds, effectiveMode, pulseCards, handleSelectionPick]);

  const simpleOff = synced && effectiveMode === 'none';
  // The mode tab leads the strip in both dashboard modes; simple mode carries
  // nothing after it, so its header is the mode tab alone.
  const simpleTabs = [modeMenuTab];
  const modeMenuNode = (
    <ModeMenu
      open={modeMenuOpen}
      onClose={closeModeMenu}
      anchorRef={modeMenuAnchorRef}
      entries={modeMenu.entries}
      ariaLabel={t('uiMode.menuLabel')}
    />
  );

  if (!serviceOnline) {
    return (
      <div className={styles.lighting}>
        <div className={styles.tabsAnchor} ref={modeMenuAnchorRef}>
          <ViewHeader
            title={t('lighting.title')}
            tabs={simpleDashboard ? simpleTabs : modeTabs}
            activeTab={activeTabKey}
            onTabChange={handleTabChange}
            tabsDisabled
          />
        </div>
        <ServiceRequired page="lighting" state={connectionState} />
      </div>
    );
  }

  // Simple mode: one colour everywhere, or off, plus the advanced-mode path.
  // No mode tabs, preset toolbar, device rail, canvas or dock - those are the
  // advanced page below, and so are the patterns (gradients, two-tone,
  // spectrum), which are looks rather than colours.
  if (simpleDashboard) {
    return (
      <div className={styles.lighting}>
        <div className={`${styles.simpleBody} pageBodyFill`}>
          <div className={styles.tabsAnchor} ref={modeMenuAnchorRef}>
            <ViewHeader
              title={t('lighting.title')}
              tabs={simpleTabs}
              activeTab={activeTabKey}
              onTabChange={handleTabChange}
              /* Off states what it did; every other mode carries both counts,
                 so a device the advanced page left un-driven is visible here
                 without a device list. Same line either way. The action runs
                 the same claim the palette does - controlledCount also
                 requires the lights to be on, so setting `controlled` alone
                 would leave the count short and the button stuck on screen. */
              tabsAdjacent={(
                <DeviceCountSummary
                  detected={simpleOff
                    ? t('lighting.off.message')
                    : t(pluralKey('lighting.simple.controlledOf', language, claimableDevices.length), {
                      controlled: controlledCount,
                      total: claimableDevices.length,
                    })}
                  action={!simpleOff && controlledCount < claimableDevices.length ? (
                    <Button size="sm" pill onClick={() => { claimAllDevices(); }}>
                      {t('lighting.simple.controlAll')}
                    </Button>
                  ) : undefined}
                />
              )}
            />
            {modeMenuNode}
          </div>
          <div className={styles.simpleSection}>
            <SectionHeader className={styles.simpleSectionHeader}>{t('lighting.mode.static')}</SectionHeader>
            <StaticPalette
              selectedId={simplePaletteId}
              onSelect={color => { claimAllDevices(); void handleSimplePaletteSelect(color); }}
            />
          </div>
          <div className={styles.simpleSection}>
            <SectionHeader className={styles.simpleSectionHeader}>{t('lighting.mode.animate')}</SectionHeader>
            <SimpleAnimationRow
              activeKey={simpleAnimation}
              reversed={simpleReversed}
              gpuAvailable={serviceState.lighting?.gpuAvailable ?? true}
              onSelect={key => { void handleSimpleAnimationSelect(key); }}
              onReverse={next => { void handleSimpleReverse(next); }}
            />
          </div>
          {simpleCustomActive && (
            <Notice tone="info" role="status">{t('lighting.simple.customActive')}</Notice>
          )}
          <div className={styles.simpleFooter}>
            <AdvancedModeCta
              label={t('lighting.simple.advancedCta')}
              onPress={() => setDashboardMode('advanced')}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.lighting}>
      {/* Three columns: the device rail, the mode tabs + their content, and the
          always-mounted effect dock. Both side columns span the tab row so they
          rise to the very top of the page. Capped at --page-max (pageBody) so
          the page matches every other view's width. */}
      <div className={`${styles.body} ${dockCollapsed ? styles.bodyDockCollapsed : ''} pageBody`}>
        <div className={styles.topRow}>
          <div className={`${styles.tabsCell} ${styles.tabsAnchor}`} ref={modeMenuAnchorRef}>
            <ViewHeader
              title={t('lighting.title')}
              tabs={modeTabs}
              activeTab={activeTabKey}
              onTabChange={handleTabChange}
              onTabHover={setHoveredTab}
              tabActions={(
                <PresetToolbar
                  rail
                  presets={presetOptions}
                  activeId={layoutActiveId}
                  presetCount={presetCount}
                  canUndo={canUndoLayout}
                  canRedo={canRedoLayout}
                  onLoad={handlePresetLoadWithHistory}
                  onCreate={handlePresetCreate}
                  onRename={handlePresetRename}
                  onDelete={handlePresetDelete}
                  onManageApps={() => {
                    const preset = presets.find(p => p.id === layoutActiveId);
                    if (preset) {
                      setPresetAppsTarget({ id: preset.id, name: preset.name, apps: preset.apps ?? [] });
                    }
                  }}
                  onReset={handleResetWithHistory}
                  onUndo={handleUndoLayout}
                  onRedo={handleRedoLayout}
                />
              )}
            />
            {modeMenuNode}
          </div>
        </div>
        <div className={`${styles.paneHeader} ${styles.headerLeft}`}>
          <div className={styles.paneTitleGroup}>
            <span className={styles.paneTitle}>{t('lighting.rightPane.devices')}</span>
            <Badge label={String(railDevices.length)} compact color="var(--text-dim)" />
          </div>
          <div className={styles.deviceHeaderActions}>
            {selectAllIds.length > 0 && (
            <>
              {/* Icon-only: the rail is too narrow for both labels beside the title. */}
              <HoverTooltip body={t('lighting.pane.selectAllControlled')} side="bottom">
                <Button
                  tone="ghost"
                  size="sm"
                  icon={<CheckCheck />}
                  aria-label={t('lighting.pane.selectAllControlled')}
                  disabled={allSelected}
                  onClick={() => handleSetSelection(new Set(selectAllIds), selectAllIds[0] ?? null)}
                />
              </HoverTooltip>
              <HoverTooltip body={t('lightingOnboarding.selectNone')} side="bottom">
                <Button
                  tone="ghost"
                  size="sm"
                  icon={<Ban />}
                  aria-label={t('lightingOnboarding.selectNone')}
                  disabled={selectedDeviceIds.size === 0}
                  onClick={() => handleSetSelection(new Set(), null)}
                />
              </HoverTooltip>
              <span className={styles.headerSep} aria-hidden />
            </>
            )}
            <RailSearchButton open={railSearch.open} onToggle={railSearch.toggle} label={t('lighting.devices.search')} />
            <HoverTooltip
              body={hideUncontrolled ? t('devices.hidden.show') : t('devices.hidden.hide')}
              side="bottom"
            >
              <Button
                tone="ghost"
                size="sm"
                icon={hideUncontrolled ? <EyeOff /> : <Eye />}
                aria-label={hideUncontrolled ? t('devices.hidden.show') : t('devices.hidden.hide')}
                aria-pressed={hideUncontrolled}
                onClick={() => updateUiSettings({ showUncontrolledLightingDevices: hideUncontrolled })}
              />
            </HoverTooltip>
            <span className={styles.headerSep} aria-hidden />
            <OpenRgbButton rgbRunning={rgb.running} scanning={rgb.scanning} />
          </div>
        </div>
        <div className={`${styles.paneHeader} ${styles.headerCenter}`}>
          <span className={styles.paneTitle}>{t('lighting.pane.effects')}</span>
          {scopeChip}
          {SCENE_3D && showCanvas && (
            <ChipGroup
              className={styles.sceneViewSwitch}
              ariaLabel={t('lighting.scene.viewSwitch')}
              options={[{ key: VIEW_2D, label: t('lighting.scene.view.2d') }, { key: VIEW_3D, label: t('lighting.scene.view.3d') }]}
              activeKey={scene3d ? VIEW_3D : VIEW_2D}
              onChange={next => {
                const firstTime = next === VIEW_3D && (sceneApi.scene?.bindings.length ?? 0) === 0;
                void sceneApi.setEnabled(next === VIEW_3D);
                if (firstTime) setSceneEditorOpen(true);
              }}
            />
          )}
          {dockCollapsed && (
            <HoverTooltip body={t('lighting.effectDock.expand')} side="bottom">
              <Button
                tone="ghost"
                size="sm"
                icon={<PanelRightOpen />}
                aria-label={t('lighting.effectDock.expand')}
                className={styles.dockToggle}
                onClick={() => setDockCollapsed(false)}
              >
                {t('lighting.rightPane.effect')}
              </Button>
            </HoverTooltip>
          )}
        </div>
        {!dockCollapsed && (
          <div className={`${styles.paneHeader} ${styles.headerRight}`}>
            <span className={styles.paneTitle}>{t('lighting.rightPane.effect')}</span>
            <HoverTooltip body={t('lighting.effectDock.collapse')} side="bottom">
              <Button
                tone="ghost"
                size="sm"
                icon={<PanelRightClose />}
                aria-label={t('lighting.effectDock.collapse')}
                className={styles.dockToggle}
                onClick={() => setDockCollapsed(true)}
              />
            </HoverTooltip>
          </div>
        )}
        <div className={styles.devicePane}>
          {railSearch.open && (
            <RailSearchField
              className={styles.railSearch}
              query={railSearch.query}
              onChange={railSearch.setQuery}
              onClose={railSearch.close}
              placeholder={t('lighting.devices.searchPlaceholder')}
            />
          )}
          <DevicePanel
            devices={railDevices}
            allDevices={orderedDevices}
            hidingUncontrolled={hideUncontrolled}
            filtering={railSearch.active}
            // A pinned device wears its pin in every mode; its strip paints the
            // device's own bytes, and falls back to the pin's render without them.
            pins={pins}
            versionForSlot={versionForSlot}
            ledFullscreen={viewMode === 'static'}
            pinSource={globalPin?.name ?? null}
            pinDisabledReason={pinDisabledReason}
            pinTargetName={pinTargetName}
            onSetPin={handleSetPin}
            pickTargetIds={pickTargetIds}
            pulse={pulse}
            selectedIds={selectedDeviceIds}
            onSetSelection={handleSetSelection}
            onTogglePower={handleTogglePower}
            onSetPower={handleSetPower}
            onToggleControlled={handleToggleControlled}
            onSetControlled={handleSetControlled}
            lightingOff={effectiveMode === 'none'}
            onOpenSettings={handleOpenSettings}
            onOpenColorTuning={handleOpenColorTuning}
            keyReactiveIds={keyReactiveIds}
            keyReactiveOnIds={keyReactiveOnIds}
            onOpenKeyReactions={setKeyReactionsId}
            onRenameDevice={handleRenameDevice}
            groups={deviceGroups}
            onGroupsChange={handleGroupsChange}
            stacks={deviceStacks}
            onStacksChange={handleStacksChange}
            onDeviceReorder={(newOrder) => setDeviceOrder(newOrder)}
            communityCounts={mappingCounts}
            onOpenCommunity={handleOpenCommunity}
            lianLiFirmwareHubs={lianLiFirmwareHubs}
            onLianLiTakeControl={hubId => { void handleLianLiTakeControl(hubId); }}
            firmwareDeviceIds={wirelessPresetIds}
            onFirmwareTakeControl={id => { void handleWirelessTakeControl(id); }}
            onOpenSmartLights={() => onSectionNavigate?.('smart-lights')}
            discovery={discovery}
            rgbRunning={rgb.running}
          />
        </div>
        <div
          className={styles.main}
          onPointerOver={e => { if (e.pointerType === 'mouse') setPickHovered(!!(e.target as Element).closest('[data-pick]')); }}
          onPointerLeave={e => { if (e.pointerType === 'mouse') setPickHovered(false); }}
        >
          {viewMode === 'gamesync' ? (
            <>
              <div className={styles.canvasArea}>
                <GameSyncActivityBlock
                  isReceiving={gameSyncState.isReceiving}
                  activeApp={gameSyncState.activeApp}
                  vendorConflict={gameSyncState.vendorConflict}
                  games={gameSyncGames}
                />
              </div>
              <div className={styles.controls}>
                <GameSyncLeftPane />
              </div>
            </>
          ) : (
            <>
              {viewMode === 'static' && (
              <div className={styles.canvasArea}>
                <StaticPickerCanvas
                  devices={pickerDevices}
                  implied={selectedDeviceIds.size === 0}
                  hex={scopedHex}
                  segmented={pickerSegmented}
                  patternEffect={staticPattern?.key ?? null}
                  patternSlot={staticPattern?.slot ?? 0}
                  patternVersion={staticPattern ? versionForSlot(staticPattern.key, staticPattern.slot) : '0'}
                  gpuAvailable={serviceState.lighting?.gpuAvailable ?? true}
                  onPreview={handleCustomPreview}
                  onCommit={hex => { pulsePick(); handleCustomSelect(hex); }}
                />
              </div>
              )}
              {showCanvas && (
              <div className={styles.canvasArea}>
                {scene3d ? (
                  <Suspense fallback={<div className={styles.scenePlaceholder} />}>
                    <LightingScene3D
                      api={sceneApi}
                      devices={visibleDevices}
                      selectedDeviceId={primaryDeviceId}
                      onSelectDevice={handleFocusDevice}
                      shaderEffect={shaderMode ? previewEffect : null}
                      shaderState={shaderMode ? previewShaderState : null}
                      shaderPaused={paused}
                      audioRef={audioRef}
                      editorOpen={sceneEditorOpen}
                      onEditorOpenChange={setSceneEditorOpen}
                      onIdentify={id => { identifyLightingDevice(id).catch(() => { /* silent */ }); }}
                      onLayoutCommit={handleLayoutCommit}
                    />
                  </Suspense>
                ) : (
                  <DeviceCanvas devices={canvasDevices} hideFrames={selectedDeviceIds.size === 0} selectedIds={canvasFocusIds} primaryDeviceId={primaryDeviceId} onSelectDevice={handleFocusDevice} onSetSelection={handleSetFocus} shaderEffect={shaderMode ? previewEffect : null} shaderState={shaderMode ? previewShaderState : null} shaderPaused={paused} audioRef={audioRef} hiddenFrameIds={hiddenFrameIds} selectedDeviceLeds={selectedDeviceLeds} onOpenSettings={handleOpenSettings} keyReactiveIds={keyReactiveIds} onOpenKeyReactions={setKeyReactionsId} onDragActiveChange={handleDragActiveChange} onBeforeLayoutSave={handleBeforeLayoutSave} onLayoutCommit={handleLayoutCommit} onSetDevicesPower={handleSetDevicesPower} stacks={deviceStacks} stackActionsFor={stackActionsFor} gpuAvailable={serviceState.lighting?.gpuAvailable ?? true} gpuState={serviceState.lighting?.gpuState} onPickRenderGpu={canPickRenderGpu ? handlePickRenderGpu : undefined} />
                )}
                {viewMode === 'gif' && <MediaCanvasNotice />}
                {shaderMode && dockEffect && dockState && !mixedSelection && (
                  <>
                    {EFFECTS.find(e => e.key === dockEffect)?.audio && (
                      <div className={styles.musicReactive}>
                        <HoverTooltip body={t('lighting.musicReactive')} side="left">
                          <button
                            type="button"
                            className={`${styles.musicReactiveBtn} ${musicReactive ? styles.musicReactiveBtnOn : ''}`}
                            onClick={handleMusicReactiveToggle}
                            aria-label={t('lighting.musicReactive')}
                          >
                            <Music size={14} strokeWidth={1.5} />
                          </button>
                        </HoverTooltip>
                        {showAudioOutput && (
                          <Select
                            className={styles.musicReactiveOutput}
                            value={audioOutput.value}
                            options={audioOutput.options}
                            onChange={audioOutput.select}
                            ariaLabel={t('lighting.audioOutput.label')}
                            height={26}
                          />
                        )}
                      </div>
                    )}
                    <HoverTooltip body={t('lighting.fullscreen')} side="left">
                      <button type="button" className={styles.fullscreenBtn} onClick={() => setFullscreenOpen(true)} aria-label={t('lighting.fullscreen')}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9,1 13,1 13,5" /><polyline points="5,13 1,13 1,9" />
                          <line x1="13" y1="1" x2="8.5" y2="5.5" /><line x1="1" y1="13" x2="5.5" y2="8.5" />
                        </svg>
                      </button>
                    </HoverTooltip>
                  </>
                )}
              </div>
              )}
              {/* Off renders no picker at all; Static and Animation each own an
                  effect pool; Screen and Media get their source controls. */}
              {(viewMode === 'animate' || viewMode === 'static') ? (
                <>
                <div className={styles.browserWrap}>
                <AnimateGrid
                  effect={gridEffect}
                  onSelect={handleEffectPick}
                  effects={viewMode === 'static' ? STATIC_PATTERN_EFFECTS : ANIMATE_EFFECTS}
                  frozen={viewMode === 'static'}
                  slotFor={gridSlotFor}
                  versionFor={gridVersionFor}
                  panelEffects={panelUsage.effects}
                  pinnedDevices={pinnedDevices}
                  gpuAvailable={serviceState.lighting?.gpuAvailable ?? true}
                  leading={viewMode === 'static' ? (
                    <CollapsibleSection
                      compact
                      title={t('lighting.static.pickerGroup')}
                      open={paletteOpen}
                      onToggle={() => setPaletteOpen(o => !o)}
                    >
                      <div data-pick className={styles.animateGridSection}>
                        <EffectCard
                          overlay
                          label={t('lighting.static.pickerSegmented')}
                          thumbUrl={PICKER_SEGMENTED_SVG}
                          active={colorScoped && pickerSegmented}
                          onClick={() => { pulsePick(); handlePickerSelect(true); }}
                        />
                        <EffectCard
                          overlay
                          label={t('lighting.static.picker')}
                          thumbUrl={PICKER_FIELD_SVG}
                          active={colorScoped && !pickerSegmented}
                          onClick={() => { pulsePick(); handlePickerSelect(false); }}
                        />
                      </div>
                    </CollapsibleSection>
                  ) : undefined}
                />
                </div>
                </>
              ) : viewMode === 'none' ? (
                <EmptyState icon={<Lightbulb />} title={t('lighting.pane.offHint')} />
              ) : (
                <div className={`${styles.controls} ${viewMode === 'gif' ? styles.controlsFill : ''}`}>
                  <ModeControls
                    mode={viewMode}
                    screenPP={screenPP}
                    onScreenPPChange={setScreenPP}
                    keepMode={selectedDeviceIds.size > 0 && viewMode !== effectiveMode}
                    onSelectionPick={handleSharedPick}
                  />
                </div>
              )}
            </>
          )}
        </div>
        {!dockCollapsed && (
        <div className={styles.rightPane}>
          <div className={styles.dockBrightness}>
            <GlobalBrightnessSlider serviceOnline={serviceOnline} />
          </div>
            <div
              className={`${styles.effectTabBody} ${mixedSelection ? styles.effectTabBodyLocked : ''}`}
              inert={mixedSelection || undefined}
              aria-hidden={mixedSelection || undefined}
            >
              {dockPalette ? (
                <div className={styles.paletteDetail}>
                  <div className={styles.paletteDetailSwatch} style={{ backgroundColor: dockPalette.hex }} />
                  <span className={styles.paletteDetailName}>
                    {`${t(paletteFamilyKey(dockPalette.family))} ${dockPalette.shade}`}
                  </span>
                  <span className={styles.paletteDetailHint}>{t('lighting.palette.noControls')}</span>
                </div>
              ) : (
              <EffectTab
                mode={viewMode}
                effect={dockEffect}
                state={dockState}
                bundle={dockBundle}
                canReset={dockCanReset}
                onTemplateSelect={handleTemplateSelect}
                onAnimateChange={handleStatePatch}
                onAnimateCommit={handleStateCommit}
                onAnimateReset={handleStateReset}
                panelSlots={panelUsage.slotsByEffect.get(dockEffect)}
                postProcess={postProcess}
                onPostProcessChange={handlePostProcessChange}
                onPostProcessCommit={handlePostProcessCommit}
                onPostProcessReset={handlePostProcessReset}
              />
              )}
            </div>
        </div>
        )}
      </div>
      {fullscreenOpen && !mixedSelection && dockEffect && dockState && dockBundle && (
        // Shows and edits what the dock edits, so its handlers always write to
        // the effect on screen (a pinned target, or the running one).
        <FullscreenShader
          effect={dockEffect}
          state={dockState}
          bundle={dockBundle}
          canReset={dockCanReset}
          audioRef={audioRef}
          onTemplateSelect={handleTemplateSelect}
          onChange={handleStatePatch}
          onCommit={handleStateCommit}
          onReset={handleStateReset}
          panelSlots={panelUsage.slotsByEffect.get(dockEffect)}
          onClose={() => setFullscreenOpen(false)}
          onPrev={handlePrevEffect}
          onNext={handleNextEffect}
          gpuAvailable={serviceState.lighting?.gpuAvailable ?? true}
          gpuState={serviceState.lighting?.gpuState}
          paused={paused}
        />
      )}
      {editorTarget && (
        <LedMapEditor
          key={`${editorTarget.deviceId}-${compositionEpoch}`}
          deviceId={editorTarget.deviceId}
          initialZoneId={editorTarget.zoneId}
          devices={devices}
          zoneCustomizable={editorTarget.zoneCustomizable}
          initialCommunityOpen={editorCommunityOpen}
          // LED colour picks apply as they are made; the cards read them back on close.
          onClose={() => { setEditorTarget(null); void refreshDevices(); }}
          onCompositionChanged={hubId => { void handleCompositionChanged(hubId); }}
          onNavigateToDevicePage={deviceKey => onSectionNavigate?.('device', { deviceKey })}
        />
      )}
      {colorTuningIds && (
        <ColorTuningModal
          devices={tunableDevices}
          deviceIds={colorTuningIds}
          onClose={() => setColorTuningIds(null)}
        />
      )}
      {keyReactionsId && keyReactionsDevice && (
        <KeyReactionsModal
          cardId={keyReactionsId}
          deviceName={orderedDevices.find(d => d.id === keyReactionsId)?.name ?? keyReactionsId}
          initialConfig={keyReactionsDevice.config}
          inputAvailable={keyReactive?.inputAvailable ?? false}
          hardwareKeys={keyReactionsDevice.hardwareKeys}
          frameIndex={keyReactionsDevice.frameIndex}
          stream={lightingStream}
          onClose={() => { setKeyReactionsId(null); void refreshKeyReactive(); }}
        />
      )}
      {presetAppsTarget && (
        <PresetAppsModal
          presetName={presetAppsTarget.name}
          apps={presetAppsTarget.apps}
          taken={takenApps}
          onSave={async apps => {
            const result = await handlePresetSetApps(presetAppsTarget.id, apps);
            if (result.kind === 'conflict') {
              return {
                message: t('lighting.layoutPresets.appsTaken', {
                  app: result.conflict.appName,
                  preset: result.conflict.presetName,
                }),
                failed: false,
              };
            }
            // Anything other than a clean 200 keeps the modal open with the
            // edit intact - closing on a failed write discards it silently.
            if (result.kind === 'failed') {
              return { message: t('lighting.layoutPresets.appsSaveFailed'), failed: true };
            }
            setPresetAppsTarget(null);
            return null;
          }}
          onClose={() => setPresetAppsTarget(null)}
        />
      )}
    </div>
  );
}

interface GameSyncActivityBlockProps {
  isReceiving: boolean;
  activeApp: string | null;
  vendorConflict: boolean;
  games: GameSyncGame[];
}

function GameSyncActivityBlock({ isReceiving, activeApp, vendorConflict, games }: GameSyncActivityBlockProps) {
  const { t } = useTranslation();
  const [imgFailed, setImgFailed] = useState(false);

  const matchedGame = isReceiving && activeApp
    ? resolveActiveGame(activeApp, games)
    : null;

  const headerSrc = matchedGame ? steamArtworkUrl(matchedGame.appId, 'header') : null;

  // Reset failure flag when the URL changes so a new game's art gets a fresh attempt.
  const prevHeaderSrcRef = useRef(headerSrc);
  if (prevHeaderSrcRef.current !== headerSrc) {
    prevHeaderSrcRef.current = headerSrc;
    if (imgFailed) setImgFailed(false);
  }

  const showImage = headerSrc !== null && !imgFailed;

  return (
    <div className={styles.gameSyncActivity}>
      {showImage ? (
        <img
          src={headerSrc}
          alt=""
          aria-hidden
          className={styles.gameSyncActivityArt}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <Gamepad2
          size={36}
          className={`${styles.gameSyncActivityIcon} ${isReceiving ? styles.gameSyncActivityIconActive : ''}`}
          aria-hidden
        />
      )}
      <span className={`${styles.gameSyncActivityLabel} ${showImage ? styles.gameSyncActivityLabelOverArt : ''}`}>
        {isReceiving
          ? (activeApp
              ? t('lighting.gameSync.signal.receiving', { activeApp })
              : t('lighting.gameSync.signal.receivingUnknown'))
          : t('lighting.gameSync.signal.idle')}
      </span>
      {/* The service leaves a real vendor SDK (Razer Synapse's, typically) in
          place rather than replacing it, so games on that interface never reach
          Nexus. Without this line that reads as an endless "Waiting for a game". */}
      {!isReceiving && vendorConflict && (
        <span className={styles.gameSyncActivityNote}>
          {t('lighting.gameSync.signal.vendorConflict')}
        </span>
      )}
      {/* Anchored to the frame rather than the page: the guide explains what
          this frame is showing, so it belongs on it. */}
      <a
        className={styles.gameSyncGuideLink}
        href={GAME_SYNC_GUIDE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ExternalLink size={12} aria-hidden />
        {t('lighting.gameSync.guideLink')}
      </a>
    </div>
  );
}

function normalizePP(s: PostProcessSettings | null | undefined): PostProcessState {
  if (!s) return DEFAULT_POST_PROCESS;
  return {
    hue: typeof s.hue === 'number' ? s.hue : 0,
    colorize: typeof s.colorize === 'number' ? s.colorize : 0,
    saturation: typeof s.saturation === 'number' ? s.saturation : 1,
    contrast: typeof s.contrast === 'number' ? s.contrast : 1,
    flipX: !!s.flipX,
    flipY: !!s.flipY,
    reactive: !!s.reactive,
    reactivity: typeof s.reactivity === 'number' ? s.reactivity : 0.5,
    intensity: typeof s.intensity === 'number' ? s.intensity : 0.5,
  };
}

