import { useCallback, useEffect, useRef, useState } from 'react';
import { Fan, CircleEqual, Lightbulb, RadioReceiver, Unplug } from 'lucide-react';
import { ViewHeader } from '../../common/ViewHeader/ViewHeader';
import { EmptyState } from '../../common/EmptyState/EmptyState';
import {
  getLianLiWirelessState,
  type LianLiWirelessLinkStatus,
} from '../../../api/lianli-wireless';
import {
  LIANLI_FLEX_CHANNEL_PREFIX,
  getLianLiFlexState,
  type LianLiFlexState,
  identifyLianLiFlexFan,
  lianLiFlexLightingApi,
  lianLiFlexScreenApi,
  restartLianLiFlexLcd,
} from '../../../api/lianli-flex';
import { WIRELESS_CHANNEL_PREFIX } from './lianliWirelessCoolingUtils';
import { LianLiFlexLcdThemesSection } from './LianLiFlexLcdThemesSection';
import { LianLiFlexSyncSection, isSyncOn, useLianLiFlexSync } from './LianLiFlexSyncSection';
import { reconcileRestarts, type RestartPending } from './lianliFlexRestart';
import { fetchPanelDevices } from '../../../api/panel';
import { streamedPanelId } from '../../../hooks/usePanelDevices';
import { panelDeviceKey } from '../../../hooks/useUnifiedDevices';
import { ConflictAppCard } from '../../common/ConflictAppCard/ConflictAppCard';
import { L_CONNECT_CONFLICT_ID } from '../../../api/conflicts';
import { useConflictApps } from '../../../hooks/useConflictApps';
import { useTranslation } from '../../../lib/i18n';
import { LianLiWirelessFansTab, fanTypeKey, isFanDevice, isHydroShiftDevice } from './LianLiWirelessFansTab';
import { LianLiWirelessCoolingTab } from './LianLiWirelessCoolingTab';
import { CoolingPageShortcut, LightingPageShortcut } from './CoolingPageLink';
import type { DashboardSectionNavigate } from '../../../panel/engine/panelLayoutHelpers';
import { lianLiFlexCoolingAnchors, lianLiFlexLightingAnchors, lianLiWirelessCoolingAnchors, lianLiWirelessLightingAnchors } from '../../../lib/pageAnchors';
import { LianLiWirelessLightingTab } from './LianLiWirelessLightingTab';
import { LianLiWirelessScreenTab } from './LianLiWirelessScreenTab';
import styles from './LianLiWirelessDevicePage.module.scss';
import { useReportDeviceWaiting } from './deviceDetecting';
import { lianLiFanScreensTitle, useLianLiFanScreenCount } from './lianliFanScreens';

// Polling interval matches the service RpmPollMs.
const RPM_POLL_MS = 2000;

// Give up waiting for a Restart LCD to show in the polled state.
const RESTART_PENDING_TIMEOUT_MS = 20000;

// The streamed-panel family of a HydroShift II on USB: its screen's own device page.
const HYDROSHIFT2_PANEL_FAMILY = 'lianli-hydroshift2';
const AIO_PANEL_LOOKUP_MS = 10_000;

export type LianLiWirelessTab = 'fans' | 'lighting' | 'cooling' | 'screen';

// Strimer Wireless dev_types with a known LED layout; the service lists only these.
const isStrimerDevType = (devType: number) => devType >= 1 && devType <= 4;

// One hint line under the disconnected title. 'none' has none: the title
// already says nothing is connected.
const LINK_HINT_KEYS: Partial<Record<LianLiWirelessLinkStatus, string>> = {
  txMissing: 'devices.lianli-wireless.linkTxMissing',
  rxMissing: 'devices.lianli-wireless.linkRxMissing',
  busy: 'devices.lianli-wireless.linkBusy',
  openFailed: 'devices.lianli-wireless.linkOpenFailed',
  noResponse: 'devices.lianli-wireless.linkNoResponse',
};

const FLEX_LINK_HINT_KEYS: Partial<Record<LianLiWirelessLinkStatus, string>> = {
  busy: 'devices.lianli-flex.linkBusy',
};

interface LianLiUnitOptions {
  /** The wired LCD Flex fans rather than the L-Wireless controller. */
  flex: boolean;
  /** Off: nothing is read (a page that may hold no such unit). */
  enabled?: boolean;
  /** The Lighting tab is shown, so the Flex sync is read. */
  lightingActive: boolean;
  onSectionNavigate?: DashboardSectionNavigate;
}

/**
 * The L-Wireless controller or the LCD Flex hub as its page shows it: the
 * connection poll, the units, and what each tab needs from them. The device page
 * and the Lian Li page both read a unit through this.
 */
export function useLianLiUnit({ flex, enabled = true, lightingActive, onSectionNavigate }: LianLiUnitOptions) {
  const getState = flex ? getLianLiFlexState : getLianLiWirelessState;
  const [connection, setConnection] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [state, setState] = useState<LianLiFlexState | null>(null);
  // Send order of state GETs: a response is applied only if no later-sent one already was.
  const sentSeqRef = useRef(0);
  const appliedSeqRef = useRef(0);
  const [linkStatus, setLinkStatus] = useState<LianLiWirelessLinkStatus | undefined>(undefined);
  // A sync write changes each unit's own look, so the Lighting tab re-reads the units after it.
  const [lightingRev, setLightingRev] = useState(0);
  const onSyncWritten = useCallback(() => setLightingRev(r => r + 1), []);
  const flexSync = useLianLiFlexSync(flex && enabled && lightingActive, onSyncWritten);
  const aliveRef = useRef(true);
  const connectedRef = useRef(false);

  const refresh = useCallback(async () => {
    const seq = ++sentSeqRef.current;
    const s = await getState();
    if (!aliveRef.current) return;
    if (s === null || seq < appliedSeqRef.current) return;
    appliedSeqRef.current = seq;
    setLinkStatus(s.linkStatus);
    if (!s.isConnected) {
      connectedRef.current = false;
      setConnection('disconnected');
      setState(null);
      return;
    }
    connectedRef.current = true;
    setConnection('connected');
    setState(s);
  }, [getState]);

  // Steady-state telemetry tick: refresh the fan list (RPM changes every
  // poll) without re-triggering the disconnected branch on a transient null.
  const refreshLive = useCallback(async () => {
    if (!connectedRef.current) { void refresh(); return; }
    const seq = ++sentSeqRef.current;
    const s = await getState();
    if (!aliveRef.current || s === null || seq < appliedSeqRef.current) return;
    appliedSeqRef.current = seq;
    setLinkStatus(s.linkStatus);
    if (!s.isConnected) {
      connectedRef.current = false;
      setConnection('disconnected');
      setState(null);
      return;
    }
    setState(s);
  }, [refresh, getState]);

  useEffect(() => {
    aliveRef.current = true;
    if (!enabled) return () => { aliveRef.current = false; };
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    const id = window.setInterval(() => { void refreshLive(); }, RPM_POLL_MS);
    return () => {
      aliveRef.current = false;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(id);
    };
  }, [enabled, refresh, refreshLive]);

  // A HydroShift II on USB has a panel page while its screen streams. The streamed
  // record follows the stream session, not the USB link, so it is looked up again
  // while the AIO stays on USB. One USB HydroShift II at a time, so the family names it.
  const usbAio = !flex && !!state?.fans.some(f => f.usbConnected);
  const [aioPanelKey, setAioPanelKey] = useState<string | null>(null);
  useEffect(() => {
    if (!usbAio) { setAioPanelKey(null); return; }
    let alive = true;
    const lookup = () => {
      void fetchPanelDevices().then(res => {
        if (!alive || !res) return;
        const record = res.devices.find(d => d.streamed && d.capabilities?.family === HYDROSHIFT2_PANEL_FAMILY);
        setAioPanelKey(record ? panelDeviceKey(streamedPanelId(record.id)) : null);
      });
    };
    lookup();
    const id = window.setInterval(lookup, AIO_PANEL_LOOKUP_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, [usbAio]);
  const panelOpener = (mac: string) => {
    const onUsb = !!state?.fans.find(f => f.mac === mac)?.usbConnected;
    return onUsb && aioPanelKey && onSectionNavigate
      ? () => onSectionNavigate('device', { deviceKey: aioPanelKey })
      : undefined;
  };

  // Restart LCD requests awaiting the polled state, by unit MAC.
  const [restarts, setRestarts] = useState<RestartPending>({});
  const restartTimersRef = useRef<Record<string, ReturnType<typeof window.setTimeout>>>({});
  useEffect(() => {
    if (state) setRestarts(prev => reconcileRestarts(prev, state.fans));
  }, [state]);
  useEffect(() => () => {
    for (const id of Object.values(restartTimersRef.current)) window.clearTimeout(id);
  }, []);
  const macOfScreen = (serial: string) => state?.fans.find(f => f.screenSerial === serial)?.mac;
  const lcdRestart = flex ? {
    isRestarting: (serial: string) => {
      const mac = macOfScreen(serial);
      return !!mac && (mac in restarts || state?.fans.find(f => f.mac === mac)?.lcdRestarting === true);
    },
    onRestart: (serial: string) => {
      const mac = macOfScreen(serial);
      if (!mac) return;
      const clear = () => {
        window.clearTimeout(restartTimersRef.current[mac]);
        delete restartTimersRef.current[mac];
        if (aliveRef.current) setRestarts(prev => {
          if (!(mac in prev)) return prev;
          const next = { ...prev };
          delete next[mac];
          return next;
        });
      };
      setRestarts(prev => ({ ...prev, [mac]: false }));
      window.clearTimeout(restartTimersRef.current[mac]);
      restartTimersRef.current[mac] = window.setTimeout(clear, RESTART_PENDING_TIMEOUT_MS);
      void restartLianLiFlexLcd(mac).catch(() => false).then(ok => {
        if (!ok) clear();
        void refreshLive();
      });
    },
  } : undefined;

  const disconnected = connection === 'disconnected';
  const hintKey = linkStatus ? (flex ? FLEX_LINK_HINT_KEYS : LINK_HINT_KEYS)[linkStatus] : undefined;
  // Only polled while the reason for being down is an app holding the dongle.
  const { conflicts } = useConflictApps(enabled && disconnected && linkStatus === 'busy');
  const blockingApp = conflicts.find(c => c.id === L_CONNECT_CONFLICT_ID);

  const hasStrimer = !flex && !!state?.fans.some(f => f.boundToUs && isStrimerDevType(f.devType));
  const hasFans = !!state?.fans.some(f => f.boundToUs && isFanDevice(f.devType));
  // Fan families the service can upload animations to; CL and unclassified chains stream only.
  // A wired unit with its control on always can.
  const hasLighting = flex ? hasFans : hasStrimer || !!state?.fans.some(f => f.boundToUs && isFanDevice(f.devType) && f.fanCount > 0
    && !['fanTypeCl', 'fanTypeGeneric'].includes(fanTypeKey(f.fanType)));
  const hasScreen = !flex || !!state?.fans.some(f => f.screenSerial) || !!state?.screenOnlySerials?.length;
  // The service names each Flex screen and unit; the tiles use those, TL before SL-INF.
  const screenFans = (state?.fans ?? []).filter(f => f.screenSerial);
  const unitNames = flex ? new Map((state?.fans ?? []).filter(f => f.name).map(f => [f.mac, f.name as string])) : undefined;
  const screenOrder = [...screenFans]
    .sort((a, b) => Number(a.family === 'slInfFlex') - Number(b.family === 'slInfFlex')
      || (a.sortIndex ?? 0) - (b.sortIndex ?? 0) || a.mac.localeCompare(b.mac))
    .map(f => f.screenSerial as string);
  const p28Only = flex && !!state?.fans.length && state.fans.every(f => f.family === 'p28v2');
  const boundMacs = (state?.fans ?? []).filter(f => f.boundToUs).map(f => f.mac);
  const flexLcdKey = (state?.fans ?? []).filter(f => f.flexLcdChain).map(f => `${f.mac}:${f.fanCount}`).join(',');
  const aioMacs = (state?.fans ?? []).filter(f => f.boundToUs && isHydroShiftDevice(f.devType)).map(f => f.mac);
  const usbMacs = (state?.fans ?? []).filter(f => f.usbConnected).map(f => f.mac);

  return {
    flex, state, refresh, connection, disconnected, hintKey, blockingApp,
    flexSync, lightingRev, panelOpener, lcdRestart,
    hasLighting, hasFans, hasScreen, unitNames, screenOrder, p28Only, boundMacs, flexLcdKey, aioMacs, usbMacs,
  };
}

export type LianLiUnit = ReturnType<typeof useLianLiUnit>;

interface LianLiUnitTabBodyProps {
  unit: LianLiUnit;
  tab: LianLiWirelessTab;
  onSectionNavigate?: DashboardSectionNavigate;
  /** Shown inside the Lian Li page, next to the other unit: no links to the units' own pages. */
  embedded?: boolean;
  /** Added to the unit's own reload count, for a sync written outside this body. */
  reloadSignal?: number;
}

/** One tab of a unit's page: its fans and binding, lighting, cooling or screens. */
export function LianLiUnitTabBody({ unit, tab, onSectionNavigate, embedded = false, reloadSignal = 0 }: LianLiUnitTabBodyProps) {
  const { flex, state, refresh, flexSync, lightingRev, panelOpener, lcdRestart } = unit;
  return (
    <>
      {tab === 'fans' && (
        <LianLiWirelessFansTab
          state={state}
          refresh={refresh}
          panelOpener={panelOpener}
          wired={flex}
          onOpenWiredPage={onSectionNavigate && !embedded ? () => onSectionNavigate('device', { deviceKey: 'curated-lianli-flex' }) : undefined}
          onOpenRadioPage={onSectionNavigate && !embedded ? () => onSectionNavigate('device', { deviceKey: 'curated-lianli-wireless' }) : undefined}
          identify={flex ? identifyLianLiFlexFan : undefined}
        />
      )}
      {tab === 'lighting' && (
        <LianLiWirelessLightingTab
          onSectionNavigate={onSectionNavigate}
          api={flex ? lianLiFlexLightingApi : undefined}
          unitNames={unit.unitNames}
          header={flex ? (chains, names) => <LianLiFlexSyncSection sync={flexSync} chains={chains} names={names} /> : undefined}
          syncOn={flex && isSyncOn(flexSync)}
          onSettled={flex ? flexSync.refresh : undefined}
          onSequence={flex ? flexSync.reorder : undefined}
          reloadSignal={lightingRev + reloadSignal}
        />
      )}
      {tab === 'cooling' && (
        <LianLiWirelessCoolingTab
          state={state}
          channelPrefix={flex ? LIANLI_FLEX_CHANNEL_PREFIX : WIRELESS_CHANNEL_PREFIX}
        />
      )}
      {tab === 'screen' && !flex && <LianLiFlexLcdThemesSection reloadKey={unit.flexLcdKey} />}
      {tab === 'screen' && (
        <LianLiWirelessScreenTab
          api={flex ? lianLiFlexScreenApi : undefined}
          defaultOrder={flex ? unit.screenOrder : undefined}
          lcdRestart={lcdRestart}
          aioMacs={unit.aioMacs}
          usbMacs={unit.usbMacs}
          panelOpener={panelOpener}
          onOpenScreenPanel={onSectionNavigate
            ? id => onSectionNavigate('device', { deviceKey: panelDeviceKey(streamedPanelId(id)) })
            : undefined}
        />
      )}
    </>
  );
}

interface LianLiWirelessDevicePageProps {
  onSectionNavigate?: DashboardSectionNavigate;
  /** The wired LCD Flex fans: the same tabs without the controller link, bind or lock. */
  flex?: boolean;
  /**
   * Opened from the Lian Li page, which holds the lighting, screens and cooling:
   * only the connection and the wireless devices (the Devices tab), with no tab bar.
   */
  devicesOnly?: boolean;
}

const SCREEN_TAB: LianLiWirelessTab = 'screen';

/**
 * The fan screens of the L-Wireless controller or the LCD Flex hub as a page of their own, opened
 * from the Lian Li page's Screens tab: the unit's screen settings alone, so they live in one place.
 */
export function LianLiFanScreensPage({ onSectionNavigate, flex = false }: { onSectionNavigate?: DashboardSectionNavigate; flex?: boolean }) {
  const { t } = useTranslation();
  const unit = useLianLiUnit({ flex, lightingActive: false, onSectionNavigate });
  useReportDeviceWaiting(unit.connection !== 'connected');
  const { disconnected, hintKey, blockingApp } = unit;
  const count = useLianLiFanScreenCount(flex, true);
  return (
    <div className={styles.page}>
      <ViewHeader title={lianLiFanScreensTitle(t, flex, unit.p28Only, count)} />
      <div className={`${styles.pageBody} pageBody`}>
        {disconnected && (
          <EmptyState
            icon={<Unplug size={40} />}
            title={t(flex ? 'devices.lianli-flex.notConnected' : 'devices.lianli-wireless.notConnected')}
            hint={hintKey ? t(hintKey) : undefined}
            action={blockingApp ? <ConflictAppCard conflict={blockingApp} /> : undefined}
          />
        )}
        <div className={styles.tabBody} hidden={disconnected}>
          <LianLiUnitTabBody unit={unit} tab={SCREEN_TAB} onSectionNavigate={onSectionNavigate} />
        </div>
      </div>
    </div>
  );
}


/**
 * Routed page for the Lian Li L-Wireless controller (SLV3 2.4GHz dongle).
 * Owns the active-tab state; the unit's poll lives in useLianLiUnit and each
 * tab renders its own controls from its own file.
 */
export function LianLiWirelessDevicePage({ onSectionNavigate, flex = false, devicesOnly = false }: LianLiWirelessDevicePageProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<LianLiWirelessTab>('fans');
  const unit = useLianLiUnit({ flex, lightingActive: !devicesOnly && activeTab === 'lighting', onSectionNavigate });
  useReportDeviceWaiting(unit.connection !== 'connected');
  const { disconnected, hintKey, blockingApp, boundMacs } = unit;

  const tabs = [
    { key: 'fans', label: t('devices.lianli-wireless.tab.devices'), icon: <RadioReceiver size={14} /> },
    ...(!devicesOnly && unit.hasLighting ? [{ key: 'lighting', label: t('lighting.title'), icon: <Lightbulb size={14} /> }] : []),
    ...(!devicesOnly && unit.hasFans ? [{ key: 'cooling', label: t('cooling.title'), icon: <Fan size={14} /> }] : []),
    ...(!devicesOnly && unit.hasScreen ? [{ key: 'screen', label: t('devices.lianli-wireless.tab.screen'), icon: <CircleEqual size={14} /> }] : []),
  ];
  // A tab that disappears (its chain unbound or out of range) falls back to Devices.
  const tab: LianLiWirelessTab = tabs.some(x => x.key === activeTab) ? activeTab : 'fans';

  return (
    <div className={styles.page}>
      <ViewHeader
        // eslint-disable-next-line i18next/no-literal-string -- brand + model name
        title={flex ? (unit.p28Only ? 'Lian Li P28 V2' : 'Lian Li LCD Flex') : 'Lian Li L-Wireless Controller'}
        tabs={disconnected || devicesOnly ? undefined : tabs}
        activeTab={tab}
        onTabChange={key => setActiveTab(key as LianLiWirelessTab)}
        tabActions={disconnected || !onSectionNavigate ? undefined
          : tab === 'cooling' ? <CoolingPageShortcut onSectionNavigate={onSectionNavigate} anchors={flex ? lianLiFlexCoolingAnchors(boundMacs) : lianLiWirelessCoolingAnchors(boundMacs)} fanId={flex && boundMacs[0] ? `${LIANLI_FLEX_CHANNEL_PREFIX}${boundMacs[0]}:port0` : undefined} />
          : tab === 'lighting' ? <LightingPageShortcut onSectionNavigate={onSectionNavigate} anchors={flex ? lianLiFlexLightingAnchors(boundMacs) : lianLiWirelessLightingAnchors()} />
          : undefined}
      />
      <div className={`${styles.pageBody} pageBody`}>
        {disconnected && (
          <EmptyState
            icon={<Unplug size={40} />}
            title={t(flex ? 'devices.lianli-flex.notConnected' : 'devices.lianli-wireless.notConnected')}
            hint={hintKey ? t(hintKey) : undefined}
            action={blockingApp ? <ConflictAppCard conflict={blockingApp} /> : undefined}
          />
        )}
        {/* Tab body stays mounted across a transient disconnect so a fan's
            in-flight bind/unbind pending state survives the reconnect. */}
        <div className={styles.tabBody} hidden={disconnected}>
          <LianLiUnitTabBody unit={unit} tab={tab} onSectionNavigate={onSectionNavigate} />
        </div>
      </div>
    </div>
  );
}

export default LianLiWirelessDevicePage;
