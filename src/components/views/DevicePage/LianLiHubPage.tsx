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
import {
  LIANLI_SCREEN88_ID, LIANLI_SCREEN88_LIGHTING_API, LIANLI_SCREEN88_NAME,
} from '../../../api/lianliScreen88';
import { useConflictGuardedEnable } from '../../../hooks/useConflictGuardedEnable';
import type { UnifiedDevice } from '../../../hooks/useUnifiedDevices';
import type { DashboardSectionNavigate } from '../../../panel/engine/panelLayoutHelpers';
import { DeviceCard } from '../../../panel/widgets/devices/DevicesPage';
import { lianLiFlexCoolingAnchors, lianLiFlexLightingAnchors, lianLiWirelessCoolingAnchors, lianLiWirelessLightingAnchors } from '../../../lib/pageAnchors';
import { useTranslation } from '../../../lib/i18n';
import { CoolingPageShortcut, LightingPageShortcut } from './CoolingPageLink';
import { HydroShift2CurvePumpSettings } from './HydroShift2CurveSettings';
import { HydroShift2RingSettings } from './HydroShift2RingSettings';
import { LianLiSyncAllBar } from './LianLiSyncAllBar';
import { LianLiUnitTabBody, openLianLiUnitOnScreens, useLianLiUnit } from './LianLiWirelessDevicePage';
import { useHydroShift2CurveScreen } from './useHydroShift2CurveScreen';
import { useLianLiScreen88Screen } from './useLianLiScreen88Screen';
// The page's own styles first: the docked-tabs check reads the first styles module as the page's.
import styles from './LianLiWirelessDevicePage.module.scss';
import devicesStyles from '../../../panel/widgets/devices/DevicesPage.module.scss';

const WIRELESS_ID = 'lianli-wireless';
const FLEX_ID = 'lianli-flex';
const RING_ID = 'lianli-hydroshift2';
const CURVE_ID = 'lianli-hydroshift2-curve';
// The units whose lighting and cooling live on this page; their own page keeps the connection,
// the wireless devices and their fan screens (LianLiWirelessDevicePage grouped).
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
 * Devices tab (each card opens its own page), all their lights on Lighting (Sync
 * all, the chains, and the HydroShift II ring, Curve edge and 8.8" bezel on one
 * card), their fans and pumps on Cooling, and on Screens one card per screen that
 * opens that screen's own page. A setting lives in one place only: nothing a
 * screen's page holds is repeated here.
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
  const screen88 = sorted.find(m => m.curatedId === LIANLI_SCREEN88_ID);
  const screen88Panel = screen88?.kind === 'panel';
  // The Uni hubs, Uni Fan TL, Galahad II and Strimer: their controls stay on their own pages.
  const ownPage = sorted.filter(m => m.kind !== 'panel' && m.navigable
    && !UNIT_IDS.has(m.curatedId ?? '') && m.curatedId !== LIANLI_SCREEN88_ID);

  // The 8.8's row without a panel (listed while the glass is a Windows display or only its LED board is
  // there) is a screen only as a Windows display, which only the service can tell.
  const screen88Screen = useLianLiScreen88Screen(!!screen88 && !screen88Panel);
  const screen88Windows = screen88Screen.view === 'windows' || screen88Screen.view === 'restarting';
  const screen88Title = screen88?.shortName ?? LIANLI_SCREEN88_NAME;

  // The L-Wireless controller and the Flex hub, read the way their own pages read them.
  const wirelessUnit = useLianLiUnit({ flex: false, enabled: wireless, lightingActive: activeTab === 'lighting', onSectionNavigate });
  const flexUnit = useLianLiUnit({ flex: true, enabled: flex, lightingActive: activeTab === 'lighting', onSectionNavigate });
  const units = [...(wireless ? [wirelessUnit] : []), ...(flex ? [flexUnit] : [])];

  const open = (deviceKey: string) => onSectionNavigate?.('device', { deviceKey });
  // One card per screen, each opening that screen's own page: the units' fan screens (their page opens
  // on its Screen tab), every Lian Li panel, and the 8.8 while its glass is a Windows display.
  const screenCards: { device: UnifiedDevice; onOpen: () => void }[] = [
    ...units.filter(u => u.hasScreen).flatMap(u => {
      const member = sorted.find(m => m.curatedId === (u.flex ? FLEX_ID : WIRELESS_ID));
      return member ? [{
        device: { ...member, shortName: t('devices.lianli-hub.fanScreens', { name: member.shortName }) },
        onOpen: () => {
          openLianLiUnitOnScreens(u.flex);
          open(member.key);
        },
      }] : [];
    }),
    ...panels.map(p => ({ device: p, onOpen: () => open(p.key) })),
    ...(screen88 && !screen88Panel && screen88Windows ? [{ device: screen88, onOpen: () => open(screen88.key) }] : []),
  ];

  const hasLighting = wireless || flex || !!ring || !!curve || !!screen88 || ownPage.length > 0;
  const hasScreens = screenCards.length > 0;
  // The Curve's pump option is a cooling setting; its head position is on its own panel page only.
  const hasCooling = wireless || flex || !!curve;
  const tabs = [
    { key: 'devices', label: t('devices.lianli-wireless.tab.devices'), icon: <RadioReceiver size={14} /> },
    ...(hasLighting ? [{ key: 'lighting', label: t('lighting.title'), icon: <Lightbulb size={14} /> }] : []),
    ...(hasScreens ? [{ key: 'screens', label: t('devices.lianli-wireless.tab.screen'), icon: <CircleEqual size={14} /> }] : []),
    ...(hasCooling ? [{ key: 'cooling', label: t('cooling.title'), icon: <Fan size={14} /> }] : []),
  ];
  const tab: LianLiHubTab = tabs.some(x => x.key === activeTab) ? activeTab : 'devices';
  // Only Cooling reads the Curve's settings, for its pump option.
  const curveScreen = useHydroShift2CurveScreen(!!curve && tab === 'cooling');
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
              {screen88 && <HydroShift2RingSettings title={screen88Title} api={LIANLI_SCREEN88_LIGHTING_API} onSectionNavigate={onSectionNavigate} />}
              {ownPage.map(d => openRow(d, t('devices.lightingPage.setHint'), t('lighting.devices.menuOpenDevicePage')))}
            </>
          )}

          {tab === 'screens' && (
            <div className={devicesStyles.list}>
              {screenCards.map(c => <DeviceCard key={c.device.key} device={c.device} onClick={c.onOpen} />)}
            </div>
          )}

          {tab === 'cooling' && (
            <>
              {units.map(unit => (
                <LianLiUnitTabBody key={unit.flex ? FLEX_ID : WIRELESS_ID} unit={unit} tab="cooling" onSectionNavigate={onSectionNavigate} embedded />
              ))}
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
