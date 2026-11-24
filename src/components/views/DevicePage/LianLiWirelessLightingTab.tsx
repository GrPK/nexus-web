import { Fragment, useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { SettingRow, SettingSelect, SettingToggle } from '../../common/SettingRow/SettingRow';
import { HsvPicker } from '../../common/HsvPicker/HsvPicker';
import { Lightbulb } from 'lucide-react';
import { Button } from '../../common/Button/Button';
import { ConfirmModal } from '../../common/ConfirmModal/ConfirmModal';
import { SettingsSection } from '../../common/SettingsSection/SettingsSection';
import { LightingPageSwitch } from './LightingPageSwitch';
import { lianLiSyncKey, type LianLiSyncLock } from '../../../api/lianli-sync';
import {
  getLianLiWirelessLighting,
  setLianLiWirelessChainLighting,
  type LianLiChainLightingApi,
  type LianLiFlexZone,
  type LianLiWirelessChainLighting,
  type LianLiWirelessChainPatch,
  type LianLiWirelessLane,
  type LianLiWirelessLighting,
} from '../../../api/lianli-wireless';
import { fanTypeKey } from './LianLiWirelessFansTab';
import { LIANLI_DEFAULT_COLORS as DEFAULT_COLORS, LianLiChainEffectControls, effectLabel, type LianLiEffectValue } from './LianLiChainEffectControls';
import {
  applyChainPatch, canMerge, chainLookOf, hasOwnHalves, mergeLeaderMac, moveInSequence, numberDuplicateTitles, patchAffectsLeader, sortBySequence, swapInSequence,
} from './lianliChainUtils';
import { useTranslation } from '../../../lib/i18n';
import styles from './LianLiDevicePage.module.scss';

const WIRELESS_LIGHTING_API: LianLiChainLightingApi = {
  get: () => getLianLiWirelessLighting(),
  set: (mac, patch) => setLianLiWirelessChainLighting(mac, patch),
};

// The longest a write in flight keeps reads from applying.
const WRITE_HOLD_MS = 10000;

const MODE_CUSTOM = 'custom';
const MODE_PER_LANE = 'perLane';
const MODE_PER_ZONE = 'perZone';
const DEFAULT_LANE_MODE = 'rainbow';
const DEFAULT_EFFECT = 'rainbow';

type Translate = ReturnType<typeof useTranslation>['t'];

function chainTitle(t: Translate, chain: LianLiWirelessChainLighting): string {
  return chain.kind === 'strimer'
    ? chain.model
    : t(`devices.lianli-wireless.${fanTypeKey(chain.fanType)}` as Parameters<Translate>[0]);
}

/**
 * A chain's name with what it holds counted: its screens, or a fan chain without screens its fans.
 * A Strimer keeps its name, and so does every chain when nothing counts the screens.
 */
function withCount(t: Translate, name: string, chain: LianLiWirelessChainLighting, screens: number | undefined): string {
  if (screens === undefined) return name;
  if (screens > 0) {
    return screens === 1
      ? t('devices.lianli-hub.chainOneScreen', { name })
      : t('devices.lianli-hub.chainScreens', { name, count: screens });
  }
  if (chain.kind !== 'fans' || chain.fanCount <= 0) return name;
  return chain.fanCount === 1
    ? t('devices.lianli-hub.chainOneFan', { name })
    : t('devices.lianli-hub.chainFans', { name, count: chain.fanCount });
}

/** The P28 V2 receiver: always driven by the Lighting page, with no stored effects, merge or motherboard ARGB. */
export const isP28Chain = (chain: LianLiWirelessChainLighting, flex: boolean): boolean =>
  flex && (chain.family ? chain.family === 'p28v2' : fanTypeKey(chain.fanType) === 'fanTypeP28v2');

function lanesOf(chain: LianLiWirelessChainLighting): LianLiWirelessLane[] {
  return Array.from({ length: chain.lanes }, (_, i) => chain.laneSettings[i] ?? {
    mode: DEFAULT_LANE_MODE,
    direction: 0,
    color: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  });
}

const ZONE_LABEL_KEYS: Record<LianLiFlexZone['id'], string> = {
  up: 'devices.lianli-flex.zoneUp',
  down: 'devices.lianli-flex.zoneDown',
  center: 'devices.lianli-flex.zoneCenter',
  inner: 'devices.lianli-flex.zoneInner',
  outer: 'devices.lianli-flex.zoneOuter',
};
// A TL fan seen upright, as its screen shows the boot logo: L-Connect's "up" half (LEDs 0..12) is
// the right half and "down" (LEDs 13..25) the left one. The ids and the patches keep up and down.
const TL_HALF_LABEL_KEYS: Partial<Record<LianLiFlexZone['id'], string>> = {
  up: 'devices.lianli-wireless.halfRight',
  down: 'devices.lianli-wireless.halfLeft',
};
const TL_FAN_TYPES: ReadonlySet<string> = new Set(['fanTypeTlv2', 'fanTypeTlLcd', 'fanTypeTlFlex']);

/** A TL fan chain, wireless or on a wired Flex hub: its two halves are its left and right. */
export function isTlChain(chain: LianLiWirelessChainLighting): boolean {
  if (chain.kind !== 'fans') return false;
  if (chain.family) return chain.family === 'tlFlex';
  return chain.supportsScope === true || TL_FAN_TYPES.has(fanTypeKey(chain.fanType));
}

interface LianLiWirelessLightingTabProps {
  onSectionNavigate?: (section: string) => void;
  /** The lighting endpoints of the device family; the wireless ones by default. */
  api?: LianLiChainLightingApi;
  /** Rendered above the chains, for example a group control; it receives the chains as last read and each unit's name on this page. */
  header?: (chains: readonly LianLiWirelessChainLighting[], names: ReadonlyMap<string, string>) => ReactNode;
  /** The wired fans are synced as a group, so their own look controls do nothing. */
  syncOn?: boolean;
  /** Runs once every write in flight has settled and the units are read back, accepted or not, for views that mirror them. */
  onSettled?: () => void;
  /** A change here re-reads the chains, after a write made outside this tab. */
  reloadSignal?: number;
  /** Runs when a move changes the light sequence, with the new order of the chains' MACs. */
  onSequence?: (macs: string[]) => void;
  /** The service's name per unit MAC (Flex); a unit without one is numbered by sequence. */
  unitNames?: ReadonlyMap<string, string>;
  /**
   * Shows only these chains (the Lian Li page groups them: Strimers, fans, fans with screens),
   * ordered by `chainOrder` and then by the light sequence. A move then swaps a chain with the
   * neighbour shown next to it; the chains not shown keep their places in the sequence.
   */
  chainFilter?: (chain: LianLiWirelessChainLighting) => boolean;
  chainOrder?: (a: LianLiWirelessChainLighting, b: LianLiWirelessChainLighting) => number;
  /**
   * The screens on a chain. Given, every chain's name counts what it holds: "TL LCD Wireless Fans (3 screens)",
   * or for a fan chain without screens its fans, "TL Wireless Fans (3 fans)". Without it the names count nothing.
   */
  screensOf?: (chain: LianLiWirelessChainLighting) => number;
  /** Runs with each chain's name on this page (by MAC) when the names change, for views that name the chains alike. */
  onNames?: (names: ReadonlyMap<string, string>) => void;
  /** The chains Sync all drives (MACs, lianLiSyncKey): their own look and Lighting page switch lock. */
  syncAllMacs?: ReadonlySet<string>;
  /**
   * Runs with the chains Sync all can drive (the wireless TL chains and Strimers) that the Lighting page or their
   * motherboard input drive instead (by MAC, lianLiSyncKey), when that changes.
   */
  onLocks?: (locks: ReadonlyMap<string, LianLiSyncLock>) => void;
}

/** Per-chain animation picker for the Strimer cables and fan chains bound to the controller. */
export function LianLiWirelessLightingTab({ onSectionNavigate, api = WIRELESS_LIGHTING_API, header, syncOn = false, onSettled, reloadSignal, onSequence, unitNames, chainFilter, chainOrder, screensOf, onNames, syncAllMacs, onLocks }: LianLiWirelessLightingTabProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<LianLiWirelessLighting | null>(null);
  const aliveRef = useRef(true);

  // Send order of reads: a response is applied only if no later-sent one was.
  const sentRef = useRef(0);
  // Writes still awaiting the service; a read answered meanwhile predates their previews, so it is dropped.
  // A write the service never answers counts as settled after WRITE_HOLD_MS, so it cannot block reads for good.
  const inFlightRef = useRef(0);
  const holdTimersRef = useRef(new Set<number>());

  const refresh = useCallback(async () => {
    const seq = ++sentRef.current;
    let d: LianLiWirelessLighting | null = null;
    try {
      d = await api.get();
    } catch {
      // A failed read leaves the screen as it is.
    }
    if (aliveRef.current && d && seq === sentRef.current && inFlightRef.current === 0) setData(d);
  }, [api]);

  // The service may change more than the patch (a merge or Lighting-page switch moves other units), so read it back.
  const settleRead = useCallback(async () => {
    try {
      await refresh();
    } finally {
      onSettled?.();
    }
  }, [refresh, onSettled]);

  // Returns the call that ends the write. One read follows the last write to settle, so a half-applied batch
  // (a move sends one write per unit) never replaces a preview.
  const beginWrite = useCallback(() => {
    inFlightRef.current += 1;
    let state: 'open' | 'expired' | 'done' = 'open';
    const timer = window.setTimeout(() => {
      holdTimersRef.current.delete(timer);
      if (state !== 'open') return;
      state = 'expired';
      inFlightRef.current -= 1;
      if (inFlightRef.current === 0) void settleRead();
    }, WRITE_HOLD_MS);
    holdTimersRef.current.add(timer);
    return async () => {
      window.clearTimeout(timer);
      holdTimersRef.current.delete(timer);
      const expired = state === 'expired';
      state = 'done';
      // An expired write already left the count, so it only asks for one more read.
      if (!expired) inFlightRef.current -= 1;
      // While another write is in flight, that batch's own settle covers the read and the report.
      if (inFlightRef.current > 0) return;
      await settleRead();
    };
  }, [settleRead]);

  useEffect(() => {
    aliveRef.current = true;
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => {
      aliveRef.current = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    const timers = holdTimersRef.current;
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const firstSignalRef = useRef(true);
  useEffect(() => {
    if (firstSignalRef.current) { firstSignalRef.current = false; return; }
    void refresh();
  }, [reloadSignal, refresh]);

  const preview = useCallback((mac: string, patch: LianLiWirelessChainPatch) => {
    setData(prev => prev && {
      ...prev,
      // A named leader may no longer hold once the merge, the effect or the order changes.
      mergeLeaderMac: patchAffectsLeader(patch) ? undefined : prev.mergeLeaderMac,
      chains: prev.chains.map(c => (c.mac === mac ? applyChainPatch(c, patch) : c)),
    });
  }, []);

  const commit = useCallback(async (mac: string, patch: LianLiWirelessChainPatch) => {
    preview(mac, patch);
    const endWrite = beginWrite();
    try {
      // effectMode is derived by the service; it only feeds the preview.
      await api.set(mac, { ...patch, effectMode: undefined });
    } catch {
      // The read after the write shows what the service kept.
    } finally {
      await endWrite();
    }
  }, [api, preview, beginWrite]);

  const reset = useCallback(async (mac: string) => {
    const endWrite = beginWrite();
    try {
      return (await api.reset?.(mac)) ?? false;
    } catch {
      return false;
    } finally {
      await endWrite();
    }
  }, [api, beginWrite]);

  // With only some chains shown, a move swaps with the neighbour shown next to the chain.
  const move = useCallback((mac: string, delta: -1 | 1, shownNeighbour?: string) => {
    if (!data) return;
    const moves = shownNeighbour ? swapInSequence(data.chains, mac, shownNeighbour) : moveInSequence(data.chains, mac, delta);
    if (moves.length > 0) {
      const next = data.chains.map(c => ({ ...c, sortIndex: moves.find(m => m.mac === c.mac)?.sortIndex ?? c.sortIndex }));
      onSequence?.(sortBySequence(next).map(c => c.mac));
    }
    for (const { mac: m, sortIndex } of moves) void commit(m, { sortIndex });
  }, [data, commit, onSequence]);

  const all = data ? sortBySequence(data.chains) : [];
  // Units of one model read the same, so repeated titles are numbered in sequence order.
  const numbered = numberDuplicateTitles(all.map(c => chainTitle(t, c)));
  const names = new Map(all.map((c, i) => [c.mac, withCount(t, unitNames?.get(c.mac) ?? numbered[i], c, screensOf?.(c))]));
  const namesKey = JSON.stringify([...names]);
  const namesRef = useRef(names);
  namesRef.current = names;
  useEffect(() => {
    if (namesRef.current.size > 0) onNames?.(namesRef.current);
  }, [namesKey, onNames]);

  // What drives each chain Sync all can drive (the wireless TL chains and Strimers) instead of its own look,
  // for Sync all to wait on. The motherboard input counts as the service counts it: the saved choice, or with
  // none saved what the chain reports.
  const flexApi = api !== WIRELESS_LIGHTING_API;
  const locks = new Map<string, LianLiSyncLock>();
  for (const c of all) {
    if (flexApi || !(c.kind === 'strimer' || isTlChain(c))) continue;
    if (c.motherboardArgb ?? c.playingMotherboardArgb === true) locks.set(lianLiSyncKey(c.mac), 'motherboardArgb');
    else if (c.mode === MODE_CUSTOM) locks.set(lianLiSyncKey(c.mac), 'lightingPage');
  }
  const locksKey = data ? JSON.stringify([...locks]) : '';
  const locksRef = useRef(locks);
  locksRef.current = locks;
  useEffect(() => {
    if (locksKey) onLocks?.(locksRef.current);
  }, [locksKey, onLocks]);

  if (!data) return null;
  // The service names the leader when it can; otherwise the same rule applies here.
  const leaderMac = data.mergeLeaderMac !== undefined ? data.mergeLeaderMac : mergeLeaderMac(all);
  const flex = api !== WIRELESS_LIGHTING_API;
  const leader = all.find(c => c.mac === leaderMac);
  const leaderTitle = leader && names.get(leader.mac);
  // Array.sort is stable, so chains the order ranks alike keep their sequence order.
  const chains = chainFilter ? all.filter(chainFilter).sort((a, b) => chainOrder?.(a, b) ?? 0) : all;
  return (
    <>
      {header?.(all, names)}
      {chains.map((chain, i) => (
        <ChainSection
          key={chain.mac}
          chain={chain}
          title={names.get(chain.mac) ?? ''}
          laneModes={data.laneModes}
          onPreview={patch => preview(chain.mac, patch)}
          onCommit={patch => { void commit(chain.mac, patch); }}
          followsTitle={leader && leader.mac !== chain.mac ? leaderTitle : undefined}
          onReset={api.reset ? () => reset(chain.mac) : undefined}
          onMove={chains.length > 1 && chain.sortIndex !== undefined
            ? delta => move(chain.mac, delta, chainFilter ? chains[i + delta]?.mac : undefined)
            : undefined}
          first={i === 0}
          flex={flex}
          synced={(syncOn && chain.supportsZones === true && !isP28Chain(chain, flex)) || (syncAllMacs?.has(lianLiSyncKey(chain.mac)) ?? false)}
          syncAll={syncAllMacs?.has(lianLiSyncKey(chain.mac)) ?? false}
          last={i === chains.length - 1}
          onSectionNavigate={onSectionNavigate}
        />
      ))}
    </>
  );
}

interface ChainSectionProps {
  chain: LianLiWirelessChainLighting;
  /** The unit's name on this page, numbered when several share a model. */
  title: string;
  laneModes: string[];
  onPreview: (patch: LianLiWirelessChainPatch) => void;
  onCommit: (patch: LianLiWirelessChainPatch) => void;
  /** Present when the family can restore a fan's default look. */
  onReset?: () => Promise<boolean>;
  /** Title of the unit whose look this one follows while merged, when it is not the leader. */
  followsTitle?: string;
  /** Present when the fans have an order to set. */
  onMove?: (delta: -1 | 1) => void;
  first: boolean;
  last: boolean;
  /** The chain is a wired Flex unit, not an RF wireless one. */
  flex: boolean;
  /** The group sync, or Sync all, drives this fan's look. */
  synced: boolean;
  /** It is Sync all on the Lian Li page: the Lighting page and motherboard switches can still go off. */
  syncAll?: boolean;
  onSectionNavigate?: (section: string) => void;
}

/** The effect controls when `show`, otherwise only the rows they hold (the halves, Merge). */
function MaybeEffectControls({ show, children, ...props }: { show: boolean } & ComponentProps<typeof LianLiChainEffectControls>) {
  return show ? <LianLiChainEffectControls {...props}>{children}</LianLiChainEffectControls> : <>{children}</>;
}

function ChainSection({ chain, title, laneModes, onPreview, onCommit, onReset, followsTitle, onMove, first, last, flex, synced, syncAll = false, onSectionNavigate }: ChainSectionProps) {
  const { t } = useTranslation();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);
  const p28 = isP28Chain(chain, flex);
  const lightingPage = chain.mode === MODE_CUSTOM;
  // With no saved choice the switch shows what the chain reports it is doing.
  const argbOn = !p28 && (chain.motherboardArgb ?? chain.playingMotherboardArgb === true);
  // Effect controls do nothing while the chain plays its motherboard input.
  const locked = lightingPage || argbOn;
  // The animation the chain plays when the Lighting page is not driving it.
  const effectKey = lightingPage ? chain.effectMode ?? DEFAULT_EFFECT : chain.mode;
  // A merged unit that is not the leader plays the leader's look, so its own look fields do nothing.
  const follower = !synced && chain.merge === true && canMerge(chain) && followsTitle !== undefined;
  const lookLocked = locked || follower || synced;
  const perLane = chain.supportsPerLane && effectKey === MODE_PER_LANE;
  // A wireless TL chain sets each half of a fan apart (L-Connect's Up / Down scope) with its own switch;
  // a wired Flex fan picks Per zone in its mode list.
  const scoped = chain.supportsScope === true && !p28;
  const ownHalves = scoped && hasOwnHalves(chain);
  const tl = isTlChain(chain);
  const perZone = (chain.supportsZones === true && !p28 && effectKey === MODE_PER_ZONE) || ownHalves;
  // A half without a look of its own plays the whole fan's.
  const shownZones: Pick<LianLiFlexZone, 'id' | 'mode' | 'speed' | 'direction' | 'brightness' | 'colors'>[] = ownHalves
    ? (['up', 'down'] as const).map(id => ({ id, ...(chain[id] ?? chainLookOf(chain)) }))
    : chain.zones ?? [];
  // A TL fan reads in reading order: its left half ("down"), then its right half ("up").
  const zones = tl ? [...shownZones].sort((a, b) => Number(a.id === 'up') - Number(b.id === 'up')) : shownZones;
  const zonePatch = (id: LianLiFlexZone['id'], patch: Partial<LianLiEffectValue>): LianLiWirelessChainPatch =>
    ownHalves && (id === 'up' || id === 'down') ? { scope: id, ...patch } : { zones: [{ id, ...patch }] };
  // L-Connect starts a picked effect from its own colours, so a TL pick clears the stored ones.
  const pickedLook = (mode: string): Partial<LianLiEffectValue> => (scoped ? { mode, colors: [] } : { mode });
  const pickMode = (v: string): LianLiWirelessChainPatch => ({ ...pickedLook(v), effectMode: v });
  // On gives the up half a look of its own, the one the fan plays now; off plays the whole fan's look
  // again, and a whole-fan look drops both halves.
  const setHalves = (on: boolean): LianLiWirelessChainPatch => (on ? { scope: 'up' } : { mode: chainLookOf(chain).mode });

  const effectOptions = chain.modes.map(e => ({ value: e.key, label: effectLabel(t, e.key) }));
  // The choices that are not effects come first, set apart from the effect list.
  const modeOptions = [
    ...(chain.supportsZones && !p28 ? [{ value: MODE_PER_ZONE, label: t('devices.lianli-flex.modePerZone') }, { value: '', label: '', divider: true }] : []),
    ...effectOptions,
    ...(chain.supportsPerLane ? [{ value: MODE_PER_LANE, label: t('devices.lianli-wireless.strimerModePerLane') }] : []),
  ];
  const directionOptions = [
    { value: '0', label: t('devices.lianli.directionLtr') },
    { value: '1', label: t('devices.lianli.directionRtl') },
  ];

  const lanes = lanesOf(chain);
  const setLane = (i: number, lane: Partial<LianLiWirelessLane>, commit: boolean) => {
    const next = lanes.map((l, idx) => (idx === i ? { ...l, ...lane } : l));
    (commit ? onCommit : onPreview)({ laneSettings: next });
  };

  return (
    <>
    <SettingsSection title={title} boxClassName={styles.sectionBox}>
      {!p28 && (chain.argbCableConnected || argbOn) && (
        <SettingToggle
          label={t('devices.motherboardArgb.label')}
          description={t('devices.motherboardArgb.hint')}
          checked={argbOn}
          onChange={on => onCommit({ motherboardArgb: on })}
          disabled={syncAll && !argbOn}
        />
      )}
      {!p28 && <LightingPageSwitch
        on={lightingPage}
        disabled={argbOn || (synced && !(syncAll && lightingPage))}
        onChange={on => onCommit(on ? { mode: MODE_CUSTOM } : { mode: effectKey, effectMode: effectKey })}
        onSectionNavigate={onSectionNavigate}
      />}

      {p28 ? (
        <SettingRow label={t('devices.lightingPage.setHint')}>
          <Button size="sm" tone="neutral" icon={<Lightbulb size={14} />} onClick={() => onSectionNavigate?.('lighting')}>
            {t('smartLights.colorOnLightingPage')}
          </Button>
        </SettingRow>
      ) : (<>
      {scoped && (
        <SettingToggle
          label={t('devices.lianli-wireless.separateHalves')}
          description={t('devices.lianli-wireless.separateHalvesHint')}
          checked={ownHalves}
          onChange={on => onCommit(setHalves(on))}
          disabled={lookLocked}
        />
      )}
      {/* With the halves apart the whole fan's own picker does nothing, so only the halves show. */}
      <MaybeEffectControls
        show={!ownHalves}
        modes={chain.modes}
        value={{ mode: effectKey, speed: chain.speed, direction: chain.direction, brightness: chain.brightness, colors: chain.colors }}
        modeOptions={modeOptions}
        modeValue={effectKey}
        disabled={lookLocked}
        paletteDimmed={lightingPage || follower || synced}
        trimPalette={chain.supportsZones === true}
        hideBrightness={perZone}
        forceSpeed={perLane}
        onModeChange={v => onCommit(pickMode(v))}
        onPreview={onPreview}
        onCommit={onCommit}
      >
        {synced && <SettingRow label={t(syncAll ? 'devices.lianli-hub.followsSyncAll' : 'devices.lianli-flex.followsSync')} />}
        {follower && <SettingRow label={t('devices.lianli-flex.followsLeader', { leader: followsTitle })} />}
        {perZone && zones.map(zone => (
          <Fragment key={zone.id}>
            <p className={styles.zoneHeading} data-settings-aside="true">
              {t(((tl ? TL_HALF_LABEL_KEYS[zone.id] : undefined) ?? ZONE_LABEL_KEYS[zone.id]) as Parameters<Translate>[0])}
            </p>
            <LianLiChainEffectControls
              modes={chain.modes}
              value={zone}
              modeOptions={effectOptions}
              modeValue={zone.mode}
              disabled={locked || synced}
              paletteDimmed={lightingPage || synced}
              trimPalette
              onModeChange={v => onCommit(zonePatch(zone.id, pickedLook(v)))}
              onPreview={patch => onPreview(zonePatch(zone.id, patch))}
              onCommit={patch => onCommit(zonePatch(zone.id, patch))}
            />
          </Fragment>
        ))}
        {!p28 && (canMerge(chain) || chain.supportsZones) && (
          <SettingToggle
            label={t('devices.lianli-wireless.merge')}
            description={canMerge(chain) || !chain.supportsZones
              ? t(chain.supportsZones ? 'devices.lianli-flex.mergeHint' : 'devices.lianli-wireless.mergeHint')
              : t('devices.lianli-flex.mergeNeedsEffect')}
            checked={chain.merge ?? false}
            onChange={on => onCommit({ merge: on })}
            disabled={locked || synced || (chain.supportsZones === true && !canMerge(chain))}
          />
        )}
      </MaybeEffectControls>
      </>)}

      {chain.upDownSwap != null && (
        <SettingToggle
          label={t(tl ? 'devices.lianli-wireless.leftRightSwap' : 'devices.lianli-flex.upDownSwap')}
          description={t(tl ? 'devices.lianli-wireless.leftRightSwapHint' : 'devices.lianli-flex.upDownSwapHint')}
          checked={chain.upDownSwap}
          onChange={on => onCommit({ upDownSwap: on })}
          disabled={argbOn}
        />
      )}

      {onMove && (
        <SettingRow label={t('devices.lianli-flex.lightSequence')} description={t('devices.lianli-flex.lightSequenceHint')}>
          <Button size="sm" tone="neutral" disabled={first} onClick={() => onMove(-1)}>
            {t('devices.lianli-wireless.orderMoveLeft')}
          </Button>
          <Button size="sm" tone="neutral" disabled={last} onClick={() => onMove(1)}>
            {t('devices.lianli-wireless.orderMoveRight')}
          </Button>
        </SettingRow>
      )}

      {onReset && !p28 && (
        <SettingRow label={t('devices.lianli-flex.resetLighting')} description={t('devices.lianli-flex.resetLightingHint')}>
          <Button size="sm" tone="neutral" onClick={() => { setResetFailed(false); setConfirmReset(true); }}>
            {t('devices.lianli-flex.resetLightingButton')}
          </Button>
        </SettingRow>
      )}
      {resetFailed && (
        <p className={styles.customNote} role="alert" data-settings-aside="true">
          {t('devices.lianli-flex.resetFailed')}
        </p>
      )}

      {perLane && lanes.map((lane, i) => (
        // Under a sync the service plays the synced look in place of the lanes.
        <div key={i} className={`${styles.colorBlock} ${lightingPage || synced ? styles.rowDisabled : ''}`} data-settings-aside="true">
          <SettingSelect
            label={t('devices.lianli-wireless.strimerLaneN', { n: i + 1 })}
            value={lane.mode}
            onChange={v => setLane(i, { mode: v }, true)}
            options={laneModes.map(key => ({ value: key, label: effectLabel(t, key) }))}
            disabled={locked || synced}
          />
          <SettingSelect
            label={t('devices.lianli.lightingDirection')}
            value={String(lane.direction)}
            onChange={v => setLane(i, { direction: Number(v) }, true)}
            options={directionOptions}
            disabled={locked || synced}
          />
          <HsvPicker
            value={lane.color}
            onPreview={(hex: string) => setLane(i, { color: hex }, false)}
            onCommit={(hex: string) => setLane(i, { color: hex }, true)}
          />
        </div>
      ))}
    </SettingsSection>

    <ConfirmModal
      open={confirmReset}
      title={t('devices.lianli-flex.resetConfirmTitle')}
      message={t(lightingPage ? 'devices.lianli-flex.resetConfirmMessageLightingPage' : 'devices.lianli-flex.resetConfirmMessage')}
      destructive={false}
      confirmLabel={t('devices.lianli-flex.resetLighting')}
      onCancel={() => setConfirmReset(false)}
      onConfirm={() => { setConfirmReset(false); void onReset?.().then(ok => setResetFailed(!ok)); }}
    />
    </>
  );
}
