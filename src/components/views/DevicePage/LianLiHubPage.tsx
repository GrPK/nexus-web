import { useCallback, useMemo, useState } from 'react';
import { CircleEqual, Fan, Lightbulb, RadioReceiver } from 'lucide-react';
import { ViewHeader } from '../../common/ViewHeader/ViewHeader';
import { SettingRow } from '../../common/SettingRow/SettingRow';
import { SettingsSection } from '../../common/SettingsSection/SettingsSection';
import { Button } from '../../common/Button/Button';
import { ExperimentalEnableModal } from '../../common/ExperimentalEnableModal/ExperimentalEnableModal';
import { NexusControlConflictModal } from '../../common/NexusControlConflictModal/NexusControlConflictModal';
import { LIANLI_FLEX_CHANNEL_PREFIX } from '../../../api/lianli-flex';
import { HYDROSHIFT2_CURVE_LIGHTING_API } from '../../../api/hydroshift2Curve';
import { LIANLI_SCREEN88_LIGHTING_API } from '../../../api/lianliScreen88';
import { useConflictGuardedEnable } from '../../../hooks/useConflictGuardedEnable';
import type { UnifiedDevice } from '../../../hooks/useUnifiedDevices';
import type { DashboardSectionNavigate } from '../../../panel/engine/panelLayoutHelpers';
import { DeviceCard } from '../../../panel/widgets/devices/DevicesPage';
import { lianLiFlexCoolingAnchors, lianLiFlexLightingAnchors, lianLiWirelessCoolingAnchors, lianLiWirelessLightingAnchors } from '../../../lib/pageAnchors';
import { useTranslation } from '../../../lib/i18n';
import { CoolingPageShortcut, LightingPageShortcut } from './CoolingPageLink';
import { HydroShift2CurveHeadSettings } from './HydroShift2CurveHeadSettings';
import { HydroShift2CurvePumpSettings, HydroShift2CurveSettings } from './HydroShift2CurveSettings';
import { HydroShift2RingSettings } from './HydroShift2RingSettings';
import { LianLiSyncAllBar } from './LianLiSyncAllBar';
import { LianLiUnitTabBody, useLianLiUnit } from './LianLiWirelessDevicePage';
import { useHydroShift2CurveScreen } from './useHydroShift2CurveScreen';
// The page's own styles first: the docked-tabs check reads the first styles module as the page's.
import styles from './LianLiWirelessDevicePage.module.scss';
import devicesStyles from '../../../panel/widgets/devices/DevicesPage.module.scss';

const WIRELESS_ID = 'lianli-wireless';
const FLEX_ID = 'lianli-flex';
const RING_ID = 'lianli-hydroshift2';
const CURVE_ID = 'lianli-hydroshift2-curve';
// The 8.8" Universal Screen, whose bezel LEDs the service drives itself.
const SCREEN88_ID = 'lianli-screen88';
// The units whose lighting, screens and cooling live on this page; their own page keeps only
// the connection and the wireless devices (LianLiWirelessDevicePage devicesOnly).
const UNIT_IDS = new Set([WIRELESS_ID, FLEX_ID]);

type LianLiHubTab = 'devices' | 'lighting' | 'screens' | 'cooling';

interface LianLiHubPageProps {
  /** The connected Lian Li devices the page stands for (see groupLianLiDevices). */
  members: readonly UnifiedDevice[];
  controlDevice: (id: string, nextEnabled: boolean) => Promise<unknown>;
  onSectionNavigate?: DashboardSectionNavigate;
}

/**
 * The Lian Li page, like L-Connect's one window: every Lian Li device on the
 * Devices tab (each card opens its own page; the L-Wireless and Flex ones show
 * only their connection and wireless devices there), all their lights on
 * Lighting (Sync all, the chains, and the HydroShift II ring, Curve edge and 8.8"
 * bezel on one card), their screens on Screens, and their fans, pump and the
 * Curve's head on Cooling.
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
  const ownPage = sorted.filter(m => m.kind !== 'panel' && !UNIT_IDS.has(m.curatedId ?? ''));

  const hasLighting = wireless || flex || !!ring || !!curve || !!screen88 || ownPage.length > 0;
  const hasScreens = wireless || flex || panels.length > 0;
  // The Curve's pump and head are cooling, not screen, settings.
  const hasCooling = wireless || flex || !!curve;
  const tabs = [
    { key: 'devices', label: t('devices.lianli-wireless.tab.devices'), icon: <RadioReceiver size={14} /> },
    ...(hasLighting ? [{ key: 'lighting', label: t('lighting.title'), icon: <Lightbulb size={14} /> }] : []),
    ...(hasScreens ? [{ key: 'screens', label: t('devices.lianli-wireless.tab.screen'), icon: <CircleEqual size={14} /> }] : []),
    ...(hasCooling ? [{ key: 'cooling', label: t('cooling.title'), icon: <Fan size={14} /> }] : []),
  ];
  const tab: LianLiHubTab = tabs.some(x => x.key === activeTab) ? activeTab : 'devices';

  // The L-Wireless controller and the Flex hub, read the way their own pages read them.
  const wirelessUnit = useLianLiUnit({ flex: false, enabled: wireless, lightingActive: tab === 'lighting', onSectionNavigate });
  const flexUnit = useLianLiUnit({ flex: true, enabled: flex, lightingActive: tab === 'lighting', onSectionNavigate });
  const units = [...(wireless ? [wirelessUnit] : []), ...(flex ? [flexUnit] : [])];
  const curveScreen = useHydroShift2CurveScreen(!!curve && (tab === 'screens' || tab === 'cooling'));

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

  // A device whose controls are on its own page: one row that opens it.
  const openRow = (d: UnifiedDevice, label: string, action: string) => (
    <SettingsSection key={d.key} title={d.shortName} boxClassName={styles.sectionBox}>
      <SettingRow label={label}>
        <Button size="sm" tone="neutral" onClick={() => open(d.key)}>{action}</Button>
      </SettingRow>
    </SettingsSection>
  );

  const coolingAnchors = [
    ...(wireless ? lianLiWirelessCoolingAnchors(wirelessUnit.boundMacs) : []),
    ...(flex ? lianLiFlexCoolingAnchors(flexUnit.boundMacs) : []),
  ];
  const lightingAnchors = [
    ...(wireless ? lianLiWirelessLightingAnchors() : []),
    ...(flex ? lianLiFlexLightingAnchors(flexUnit.boundMacs) : []),
  ];
  const flexFirstFan = flexUnit.boundMacs[0];

  return (
    <div className={styles.page}>
      <ViewHeader
        // eslint-disable-next-line i18next/no-literal-string -- brand name
        title="Lian Li"
        tabs={tabs}
        activeTab={tab}
        onTabChange={key => setActiveTab(key as LianLiHubTab)}
        tabActions={!onSectionNavigate ? undefined
          : tab === 'cooling' ? (
            <CoolingPageShortcut
              onSectionNavigate={onSectionNavigate}
              anchors={coolingAnchors}
              fanId={!wireless && flex && flexFirstFan ? `${LIANLI_FLEX_CHANNEL_PREFIX}${flexFirstFan}:port0` : undefined}
            />
          )
          : tab === 'lighting' ? <LightingPageShortcut onSectionNavigate={onSectionNavigate} anchors={lightingAnchors} />
          : undefined}
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
              {units.map(unit => (
                <LianLiUnitTabBody
                  key={unit.flex ? FLEX_ID : WIRELESS_ID}
                  unit={unit}
                  tab="lighting"
                  onSectionNavigate={onSectionNavigate}
                  embedded
                  reloadSignal={lightingRev}
                />
              ))}
              {ring && <HydroShift2RingSettings title={ring.shortName} onSectionNavigate={onSectionNavigate} />}
              {curve && <HydroShift2RingSettings title={curve.shortName} api={HYDROSHIFT2_CURVE_LIGHTING_API} onSectionNavigate={onSectionNavigate} />}
              {screen88 && <HydroShift2RingSettings title={screen88.shortName} api={LIANLI_SCREEN88_LIGHTING_API} onSectionNavigate={onSectionNavigate} />}
              {ownPage.map(d => openRow(d, t('devices.lightingPage.setHint'), t('lighting.devices.menuOpenDevicePage')))}
            </>
          )}

          {tab === 'screens' && (
            <>
              {units.filter(u => u.hasScreen).map(unit => (
                <LianLiUnitTabBody key={unit.flex ? FLEX_ID : WIRELESS_ID} unit={unit} tab="screen" onSectionNavigate={onSectionNavigate} embedded />
              ))}
              {curve && <HydroShift2CurveSettings screen={curveScreen} hidePump />}
              {panels.map(p => openRow(p, p.name, t('devices.lianli-wireless.openPanel')))}
            </>
          )}

          {tab === 'cooling' && (
            <>
              {units.map(unit => (
                <LianLiUnitTabBody key={unit.flex ? FLEX_ID : WIRELESS_ID} unit={unit} tab="cooling" onSectionNavigate={onSectionNavigate} embedded />
              ))}
              {curve && <HydroShift2CurveHeadSettings />}
              {curve && <HydroShift2CurvePumpSettings screen={curveScreen} />}
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
