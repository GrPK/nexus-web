import { useCallback, useEffect, useRef, useState } from 'react';
import { SettingRow, SettingToggle } from '../../common/SettingRow/SettingRow';
import { Button } from '../../common/Button/Button';
import { SettingsSection } from '../../common/SettingsSection/SettingsSection';
import type { SelectOption } from '../../common/Select/Select';
import {
  LIANLI_SYNC_ALL_API, type LianLiSyncAll, type LianLiSyncAllApi, type LianLiSyncAllPatch, type LianLiSyncEffect,
} from '../../../api/lianli-sync';
import type { LianLiWirelessLightingEffect } from '../../../api/lianli-wireless';
import { LianLiChainEffectControls, effectLabel, type LianLiEffectValue } from './LianLiChainEffectControls';
import { useTranslation } from '../../../lib/i18n';
import styles from './LianLiDevicePage.module.scss';

// The "N fans" strings the Lian Li pages already have.
const MAX_FAN_COUNT_LABEL = 6;

interface LianLiSyncAllBarProps {
  /** The sync endpoints; the service's by default. */
  api?: LianLiSyncAllApi;
  /** Runs after a write the service accepted, so the per-device looks below are read again. */
  onWritten?: () => void;
  /** Each TL chain's name on the Lighting tab, by MAC; a chain without one keeps the service's name. */
  chainNames?: ReadonlyMap<string, string>;
}

const TL_CHAIN = 'tlChain';

type Translate = ReturnType<typeof useTranslation>['t'];

/**
 * The effect picker's options in the service's order. When both kinds are listed, a heading
 * goes before the ones each device plays on its own and before L-Connect's merged ones, which
 * L-Connect marks "(W*)" as their labels here do.
 */
export function syncEffectOptions(t: Translate, effects: readonly LianLiSyncEffect[]): SelectOption[] {
  const grouped = effects.some(e => e.merge) && effects.some(e => !e.merge);
  const options: SelectOption[] = [];
  let group: boolean | null = null;
  for (const e of effects) {
    const merge = e.merge === true;
    if (grouped && merge !== group) {
      group = merge;
      options.push({
        value: merge ? 'group-merged' : 'group-each',
        label: t(merge ? 'devices.lianli-hub.syncMerged' : 'devices.lianli-hub.syncEachDevice'),
        header: true,
      });
    }
    options.push({ value: e.key, label: effectLabel(t, e.key) });
  }
  return options;
}

/** The sync effects as the shared effect controls read them: each takes exactly its colour count. */
const asModes = (effects: readonly LianLiSyncEffect[]): LianLiWirelessLightingEffect[] => effects.map(e => ({
  key: e.key,
  hasSpeed: e.hasSpeed,
  hasDirection: e.hasDirection,
  colorsMin: e.colorsMax,
  colorsMax: e.colorsMax,
  defaultColors: e.defaultColors,
}));

/** The devices in a new merge order, as the service stores it: the listed ones first, then the rest as they were. */
function reorderDevices(devices: LianLiSyncAll['devices'], order: NonNullable<LianLiSyncAllPatch['devices']>): LianLiSyncAll['devices'] {
  const key = (id: string) => id.toUpperCase();
  const listed = order.map(o => devices.find(d => key(d.id) === key(o.id))).filter(d => d !== undefined);
  const seen = new Set(listed.map(d => key(d.id)));
  return [...listed, ...devices.filter(d => !seen.has(key(d.id)))];
}

/** The effect's look and the merge order after a patch, as the service stores them. */
function patchEffect(data: LianLiSyncAll, patch: LianLiSyncAllPatch): LianLiSyncAll {
  const { enabled, effect, speed, brightness, direction, colors, devices } = patch;
  const target = effect ?? data.effect;
  const lookChanged = speed !== undefined || brightness !== undefined || direction !== undefined || colors !== undefined;
  return {
    ...data,
    devices: devices ? reorderDevices(data.devices, devices) : data.devices,
    enabled: enabled ?? data.enabled,
    effect: target,
    effects: !lookChanged ? data.effects : data.effects.map(e => (e.key !== target ? e : {
      ...e,
      speed: speed ?? e.speed,
      brightness: brightness ?? e.brightness,
      direction: direction ?? e.direction,
      colors: colors ?? e.colors,
    })),
  };
}

/**
 * Sync all on the Lian Li page: one effect across every light the service lists
 * (L-Connect's Merge), each effect keeping its own look, or each device plays its own.
 */
export function LianLiSyncAllBar({ api = LIANLI_SYNC_ALL_API, onWritten, chainNames }: LianLiSyncAllBarProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<LianLiSyncAll | null>(null);
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    let next: LianLiSyncAll | null = null;
    try {
      next = await api.get();
    } catch {
      // A failed read leaves the bar as it is.
    }
    if (aliveRef.current && next) setData(next);
  }, [api]);

  useEffect(() => {
    aliveRef.current = true;
    void refresh();
    return () => { aliveRef.current = false; };
  }, [refresh]);

  const preview = useCallback((patch: LianLiSyncAllPatch) => {
    setData(prev => prev && patchEffect(prev, patch));
  }, []);

  const commit = useCallback(async (patch: LianLiSyncAllPatch) => {
    preview(patch);
    let ok = false;
    try {
      ok = await api.set(patch);
    } catch {
      // The read below shows what the service kept.
    }
    // A new merge order changes no device's own look.
    if (ok && Object.keys(patch).some(k => k !== 'devices')) onWritten?.();
    await refresh();
  }, [api, preview, refresh, onWritten]);

  // A service without the sync route has nothing to show.
  if (!data || data.effects.length === 0) return null;

  const current = data.effects.find(e => e.key === data.effect) ?? data.effects[0];
  const value: LianLiEffectValue = {
    mode: current.key,
    speed: current.speed,
    direction: current.direction,
    brightness: current.brightness,
    colors: current.colors,
  };
  // The controls name the effect `mode`; the route names it `effect`.
  const toPatch = ({ mode, ...look }: Partial<LianLiEffectValue>): LianLiSyncAllPatch =>
    (mode === undefined ? look : { ...look, effect: mode });
  const fanCountLabel = (n: number | undefined) => (n !== undefined && n >= 0 && n <= MAX_FAN_COUNT_LABEL
    ? t(`devices.lianli.fanCount${n}` as Parameters<typeof t>[0])
    : undefined);
  // A TL chain reads as the Lighting tab names it; the MAC's case may differ between the routes.
  const namesByMac = new Map<string, string>();
  for (const [mac, name] of chainNames ?? []) namesByMac.set(mac.toUpperCase(), name);
  const deviceName = (d: LianLiSyncAll['devices'][number]) =>
    (d.kind === TL_CHAIN ? namesByMac.get(d.id.toUpperCase()) : undefined) ?? d.name;
  // The whole order is sent, so the service stores exactly what the list shows.
  const move = (index: number, delta: number) => {
    const order = data.devices.map(d => d.id);
    const other = index + delta;
    if (other < 0 || other >= order.length) return;
    [order[index], order[other]] = [order[other], order[index]];
    void commit({ devices: order.map(id => ({ id })) });
  };

  return (
    <SettingsSection title={t('devices.lianli-flex.syncSection')} boxClassName={styles.sectionBox}>
      <SettingToggle
        label={t('devices.lianli-hub.syncAll')}
        description={t('devices.lianli-hub.syncAllHint')}
        checked={data.enabled}
        onChange={on => { void commit({ enabled: on }); }}
      />
      <LianLiChainEffectControls
        modes={asModes(data.effects)}
        value={value}
        modeOptions={syncEffectOptions(t, data.effects)}
        modeValue={current.key}
        disabled={!data.enabled}
        paletteDimmed={!data.enabled}
        trimPalette
        onModeChange={next => { void commit({ effect: next }); }}
        onPreview={patch => preview(toPatch(patch))}
        onCommit={patch => { void commit(toPatch(patch)); }}
      />
      {data.devices.length > 0 && (
        <>
          <p className={styles.zoneHeading} data-settings-aside="true">{t('devices.lianli-wireless.tab.devices')}</p>
          {data.devices.map((d, i) => (
            <SettingRow key={`${d.kind}:${d.id}`} label={deviceName(d)} description={fanCountLabel(d.fanCount)}>
              {data.devices.length > 1 && (<>
                <Button size="sm" tone="neutral" disabled={i === 0} onClick={() => move(i, -1)}>
                  {t('devices.lianli-wireless.orderMoveUp')}
                </Button>
                <Button size="sm" tone="neutral" disabled={i === data.devices.length - 1} onClick={() => move(i, 1)}>
                  {t('devices.lianli-wireless.orderMoveDown')}
                </Button>
              </>)}
            </SettingRow>
          ))}
        </>
      )}
    </SettingsSection>
  );
}
