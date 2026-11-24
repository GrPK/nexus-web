import { Lightbulb } from 'lucide-react';
import { SettingRow } from '../../common/SettingRow/SettingRow';
import { Toggle } from '../../common/Toggle/Toggle';
import { Button } from '../../common/Button/Button';
import { NOTICE_ICONS } from '../../common/Notice/Notice';
import { useTranslation } from '../../../lib/i18n';
import styles from './LightingPageSwitch.module.scss';

// The warning notice's own icon, so the pill reads as the same amber warning.
const WarningIcon = NOTICE_ICONS.warning;

interface LightingPageSwitchProps {
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  onSectionNavigate?: (section: string) => void;
  /** Sync all on the Lian Li page drives the light: an amber "Sync is active" pill after the label. */
  controlledBySyncAll?: boolean;
}

/** Hands a device's LEDs to the Lighting page, or back to the animation configured under it. */
export function LightingPageSwitch({ on, onChange, disabled, onSectionNavigate, controlledBySyncAll = false }: LightingPageSwitchProps) {
  const { t } = useTranslation();
  const label = t('devices.lightingPage.use');
  // The link rides the label line and is only hidden while off, so the row never changes height.
  const link = onSectionNavigate && (
    <span className={on ? undefined : styles.linkHidden} aria-hidden={!on}>
      <Button
        size="sm"
        tone="neutral"
        icon={<Lightbulb size={14} />}
        disabled={!on}
        tabIndex={on ? 0 : -1}
        onClick={() => onSectionNavigate('lighting')}
      >
        {t('smartLights.colorOnLightingPage')}
      </Button>
    </span>
  );
  // Right after the label text; the label line wraps it under the label when it does not fit.
  const syncPill = controlledBySyncAll && (
    <span className={styles.syncPill}>
      <WarningIcon className={styles.syncPillIcon} size="1em" aria-hidden />
      {t('devices.lianli-hub.syncActive')}
    </span>
  );
  return (
    // The same row SettingToggle builds, except that under Sync all only the switch locks: the row stays
    // readable, since the pill says why.
    <SettingRow
      label={label}
      labelSuffix={syncPill || link ? <>{syncPill || null}{link || null}</> : undefined}
      description={t('devices.lightingPage.useHint')}
      disabled={disabled && !controlledBySyncAll}
    >
      <Toggle checked={on} onChange={onChange} disabled={disabled} ariaLabel={label} />
    </SettingRow>
  );
}
