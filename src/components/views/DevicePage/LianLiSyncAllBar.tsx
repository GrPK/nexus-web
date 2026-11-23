import { useCallback, useEffect, useRef, useState } from 'react';
import { SettingRow, SettingToggle } from '../../common/SettingRow/SettingRow';
import { SettingsSection } from '../../common/SettingsSection/SettingsSection';
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

/** The effect's look after a patch, as the service stores it. */
function patchEffect(data: LianLiSyncAll, patch: LianLiSyncAllPatch): LianLiSyncAll {
  const { enabled, effect, speed, brightness, direction, colors } = patch;
  const target = effect ?? data.effect;
  const lookChanged = speed !== undefined || brightness !== undefined || direction !== undefined || colors !== undefined;
  return {
    ...data,
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
export function LianLiSyncAllBar({ api = LIANLI_SYNC_ALL_API, onWritten }: LianLiSyncAllBarProps) {
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
    if (ok) onWritten?.();
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
        modeOptions={data.effects.map(e => ({ value: e.key, label: effectLabel(t, e.key) }))}
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
          {data.devices.map(d => (
            <SettingRow key={`${d.kind}:${d.id}`} label={d.name} description={fanCountLabel(d.fanCount)} />
          ))}
        </>
      )}
    </SettingsSection>
  );
}
