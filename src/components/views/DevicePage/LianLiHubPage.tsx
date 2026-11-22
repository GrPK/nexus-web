import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleEqual, Fan, Lightbulb, RadioReceiver } from 'lucide-react';
import { ViewHeader } from '../../common/ViewHeader/ViewHeader';
import { SettingRow } from '../../common/SettingRow/SettingRow';
import { SettingsSection } from '../../common/SettingsSection/SettingsSection';
import { Button } from '../../common/Button/Button';
import { ExperimentalEnableModal } from '../../common/ExperimentalEnableModal/ExperimentalEnableModal';
import { NexusControlConflictModal } from '../../common/NexusControlConflictModal/NexusControlConflictModal';
import { getLianLiWirelessState } from '../../../api/lianli-wireless';
import {
  LIANLI_FLEX_CHANNEL_PREFIX,
  getLianLiFlexState,
  lianLiFlexLightingApi,
  lianLiFlexScreenApi,
  type LianLiFlexState,
} from '../../../api/lianli-flex';
import { HYDROSHIFT2_CURVE_LIGHTING_API } from '../../../api/hydroshift2Curve';
import { LIANLI_SCREEN88_LIGHTING_API } from '../../../api/lianliScreen88';
import { useConflictGuardedEnable } from '../../../hooks/useConflictGuardedEnable';
import { panelDeviceKey, type UnifiedDevice } from '../../../hooks/useUnifiedDevices';
import { streamedPanelId } from '../../../hooks/usePanelDevices';
import type { DashboardSectionNavigate } from '../../../panel/engine/panelLayoutHelpers';
import { DeviceCard } from '../../../panel/widgets/devices/DevicesPage';
import { useTranslation } from '../../../lib/i18n';
import { HydroShift2CurveSettings } from './HydroShift2CurveSettings';
import { HydroShift2RingSettings } from './HydroShift2RingSettings';
import { LianLiFlexLcdThemesSection } from './LianLiFlexLcdThemesSection';
import { LianLiFlexSyncSection, isSyncOn, useLianLiFlexSync } from './LianLiFlexSyncSection';
import { LianLiSyncAllBar } from './LianLiSyncAllBar';
import { LianLiWirelessCoolingTab } from './LianLiWirelessCoolingTab';
import { isHydroShiftDevice } from './LianLiWirelessFansTab';
import { LianLiWirelessLightingTab } from './LianLiWirelessLightingTab';
import { LianLiWirelessScreenTab } from './LianLiWirelessScreenTab';
import { WIRELESS_CHANNEL_PREFIX } from './lianliWirelessCoolingUtils';
import { useHydroShift2CurveScreen } from './useHydroShift2CurveScreen';
// The page's own styles first: the docked-tabs check reads the first styles module as the page's.
import styles from './LianLiWirelessDevicePage.module.scss';
import devicesStyles from '../../../panel/widgets/devices/DevicesPage.module.scss';

// Polling interval matches the service RpmPollMs, as on the L-Wireless page.
const RPM_POLL_MS = 2000;

const WIRELESS_ID = 'lianli-wireless';
const FLEX_ID = 'lianli-flex';
const RING_ID = 'lianli-hydroshift2';
const CURVE_ID = 'lianli-hydroshift2-curve';
// The 8.8" Universal Screen, whose bezel LEDs the service drives itself.
const SCREEN88_ID = 'lianli-screen88';

type LianLiHubTab = 'devices' | 'lighting' | 'screens' | 'cooling';

/** The units of the L-Wireless controller or the Flex hub, read while a tab needs them. */
function useUnitState(active: boolean, getState: () => Promise<LianLiFlexState | null>): LianLiFlexState | null {
  const [state, setState] = useState<LianLiFlexState | null>(null);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const read = () => {
      void getState().then(s => {
        if (alive && s) setState(s.isConnected ? s : null);
      }).catch(() => {});
    };
    read();
    const id = window.setInterval(read, RPM_POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, [active, getState]);
  return active ? state : null;
}

interface LianLiHubPageProps {
  /** The connected Lian Li devices the page stands for (see groupLianLiDevices). */
  members: readonly UnifiedDevice[];
  controlDevice: (id: string, nextEnabled: boolean) => Promise<unknown>;
  onSectionNavigate?: DashboardSectionNavigate;
}

/**
 * The Lian Li page, like L-Connect's one window: every Lian Li device on the
 * Devices tab, all their lights on Lighting (with Sync all once the service has
 * it; the HydroShift II ring and Curve edge and the 8.8" bezel share one card),
 * their screens on Screens, and their fans and pump on Cooling. Each device keeps
 * its own page, opened from its card.
 */
export function LianLiHubPage({ members, controlDevice, onSectionNavigate }: LianLiHubPageProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<LianLiHubTab>('devices');
  // A sync write changes each device's own look, so the lighting sections re-read after it.
  const [lightingRev, setLightingRev] = useState(0);
  const onSyncWritten = useCallback(() => setLightingRev(r => r + 1), []);

  const sorted = useMemo(
    () => [...members].sort((a, b) =>
      a.shortName.localeCompare(b.shortName, undefined, { sensitivity: 'base', numeric: true }) || a.key.localeCompare(b.key)),
    [members],
  );
  const has = (id: string) => members.some(m => m.curatedId === id);
  const wireless = has(WIRELESS_ID);
  const flex = has(FLEX_ID);
  const panels = sorted.filter(m => m.kind === 'panel');
  const ring = panels.find(m => m.curatedId === RING_ID);
  const curve = panels.find(m => m.curatedId === CURVE_ID);
  const screen88 = sorted.find(m => m.curatedId === SCREEN88_ID);
  // The Uni hubs, Uni Fan TL, Galahad II and Strimer: their controls stay on their own pages.
  const ownPage = sorted.filter(m => m.kind !== 'panel' && m.curatedId !== WIRELESS_ID && m.curatedId !== FLEX_ID);

  const hasLighting = wireless || flex || !!ring || !!curve || !!screen88 || ownPage.length > 0;
  const hasScreens = wireless || flex || panels.length > 0;
  const hasCooling = wireless || flex;
  const tabs = [
    { key: 'devices', label: t('devices.lianli-wireless.tab.devices'), icon: <RadioReceiver size={14} /> },
    ...(hasLighting ? [{ key: 'lighting', label: t('lighting.title'), icon: <Lightbulb size={14} /> }] : []),
    ...(hasScreens ? [{ key: 'screens', label: t('devices.lianli-wireless.tab.screen'), icon: <CircleEqual size={14} /> }] : []),
    ...(hasCooling ? [{ key: 'cooling', label: t('cooling.title'), icon: <Fan size={14} /> }] : []),
  ];
  const tab: LianLiHubTab = tabs.some(x => x.key === activeTab) ? activeTab : 'devices';

  const unitTab = tab === 'screens' || tab === 'cooling';
  const wirelessState = useUnitState(wireless && unitTab, getLianLiWirelessState);
  const flexState = useUnitState(flex && unitTab, getLianLiFlexState);
  const curveScreen = useHydroShift2CurveScreen(!!curve && tab === 'screens');
  const flexSync = useLianLiFlexSync(flex && tab === 'lighting', onSyncWritten);

  const open = (deviceKey: string) => onSectionNavigate?.('device', { deviceKey });
  const controlGuard = useConflictGuardedEnable();
  // The same gate the Devices list card has: the handler control API, guarded for a running conflict app.
  const toggleFor = (d: UnifiedDevice): ((next: boolean) => void) | undefined => {
    const id = d.curatedId;
    if (!d.supportsNexusControl || !id || d.panelDevice?.displayId) return undefined;
    return next => {
      const apply = () => void controlDevice(id, next);
      if (next) void controlGuard.requestEnable(d, apply);
      else apply();
    };
  };

  const wirelessFans = wirelessState?.fans ?? [];
  const aioMacs = wirelessFans.filter(f => f.boundToUs && isHydroShiftDevice(f.devType)).map(f => f.mac);
  const usbMacs = wirelessFans.filter(f => f.usbConnected).map(f => f.mac);
  const flexLcdKey = wirelessFans.filter(f => f.flexLcdChain).map(f => `${f.mac}:${f.fanCount}`).join(',');

  // A device whose controls are on its own page: one row that opens it.
  const openRow = (d: UnifiedDevice, label: string, action: string) => (
    <SettingsSection key={d.key} title={d.shortName} boxClassName={styles.sectionBox}>
      <SettingRow label={label}>
        <Button size="sm" tone="neutral" onClick={() => open(d.key)}>{action}</Button>
      </SettingRow>
    </SettingsSection>
  );

  return (
    <div className={styles.page}>
      <ViewHeader
        // eslint-disable-next-line i18next/no-literal-string -- brand name
        title="Lian Li"
        tabs={tabs}
        activeTab={tab}
        onTabChange={key => setActiveTab(key as LianLiHubTab)}
      />
      <div className={`${styles.pageBody} pageBody`}>
        <div className={styles.tabBody}>
          {tab === 'devices' && (
            <div className={devicesStyles.list}>
              {sorted.map(d => (
                <DeviceCard key={d.key} device={d} onClick={() => open(d.key)} onToggleControl={toggleFor(d)} />
              ))}
            </div>
          )}

          {tab === 'lighting' && (
            <>
              <LianLiSyncAllBar onWritten={onSyncWritten} />
              {wireless && <LianLiWirelessLightingTab onSectionNavigate={onSectionNavigate} reloadSignal={lightingRev} />}
              {flex && (
                <LianLiWirelessLightingTab
                  onSectionNavigate={onSectionNavigate}
                  api={lianLiFlexLightingApi}
                  header={(chains, names) => <LianLiFlexSyncSection sync={flexSync} chains={chains} names={names} />}
                  syncOn={isSyncOn(flexSync)}
                  onSettled={flexSync.refresh}
                  onSequence={flexSync.reorder}
                  reloadSignal={lightingRev}
                />
              )}
              {ring && <HydroShift2RingSettings title={ring.shortName} onSectionNavigate={onSectionNavigate} />}
              {curve && <HydroShift2RingSettings title={curve.shortName} api={HYDROSHIFT2_CURVE_LIGHTING_API} onSectionNavigate={onSectionNavigate} />}
              {screen88 && <HydroShift2RingSettings title={screen88.shortName} api={LIANLI_SCREEN88_LIGHTING_API} onSectionNavigate={onSectionNavigate} />}
              {ownPage.map(d => openRow(d, t('devices.lightingPage.setHint'), t('lighting.devices.menuOpenDevicePage')))}
            </>
          )}

          {tab === 'screens' && (
            <>
              {wireless && <LianLiFlexLcdThemesSection reloadKey={flexLcdKey} />}
              {wireless && (
                <LianLiWirelessScreenTab
                  aioMacs={aioMacs}
                  usbMacs={usbMacs}
                  onOpenScreenPanel={id => open(panelDeviceKey(streamedPanelId(id)))}
                />
              )}
              {flex && <LianLiWirelessScreenTab api={lianLiFlexScreenApi} />}
              {curve && <HydroShift2CurveSettings screen={curveScreen} />}
              {panels.map(p => openRow(p, p.name, t('devices.lianli-wireless.openPanel')))}
            </>
          )}

          {tab === 'cooling' && (
            <>
              {wireless && <LianLiWirelessCoolingTab state={wirelessState} channelPrefix={WIRELESS_CHANNEL_PREFIX} />}
              {flex && <LianLiWirelessCoolingTab state={flexState} channelPrefix={LIANLI_FLEX_CHANNEL_PREFIX} />}
            </>
          )}
        </div>
      </div>

      <ExperimentalEnableModal
        open={controlGuard.experimental !== null}
        onConfirm={controlGuard.confirmExperimental}
        onCancel={controlGuard.cancelExperimental}
      />
      <NexusControlConflictModal
        pending={controlGuard.pending}
        onConfirm={controlGuard.confirm}
        onCancel={controlGuard.cancel}
      />
    </div>
  );
}

export default LianLiHubPage;
