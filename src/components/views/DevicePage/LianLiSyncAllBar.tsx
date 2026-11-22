import { useCallback, useEffect, useRef, useState } from 'react';
import { SettingToggle } from '../../common/SettingRow/SettingRow';
import { SettingsSection } from '../../common/SettingsSection/SettingsSection';
import { LIANLI_SYNC_ALL_API, type LianLiSyncAll, type LianLiSyncAllApi, type LianLiSyncAllPatch } from '../../../api/lianli-sync';
import { LianLiChainEffectControls, effectLabel, type LianLiEffectValue } from './LianLiChainEffectControls';
import { useTranslation } from '../../../lib/i18n';
import styles from './LianLiDevicePage.module.scss';

interface LianLiSyncAllBarProps {
  /** The sync endpoints; the service's by default (see LIANLI_SYNC_ALL_API). */
  api?: LianLiSyncAllApi;
  /** Runs after a write the service accepted, so the per-device looks below are read again. */
  onWritten?: () => void;
}

/** Sync all on the Lian Li page: one effect across every Lian Li light, or each plays its own. */
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
    setData(prev => prev && { ...prev, ...patch });
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
  if (!data) return null;

  const mode = data.modes.some(e => e.key === data.mode) ? data.mode : data.modes[0]?.key ?? '';
  const value: LianLiEffectValue = {
    mode, speed: data.speed, direction: data.direction, brightness: data.brightness, colors: data.colors,
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
        modes={data.modes}
        value={value}
        modeOptions={data.modes.map(e => ({ value: e.key, label: effectLabel(t, e.key) }))}
        modeValue={mode}
        disabled={!data.enabled}
        paletteDimmed={!data.enabled}
        trimPalette
        onModeChange={next => { void commit({ mode: next }); }}
        onPreview={patch => preview(patch)}
        onCommit={patch => { void commit(patch); }}
      />
    </SettingsSection>
  );
}
