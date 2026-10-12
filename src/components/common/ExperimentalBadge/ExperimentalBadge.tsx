import { FlaskConical } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { Badge } from '../Badge/Badge';

/**
 * Pill badge flagging a device whose support is experimental - non-HYTE/iBUYPOWER
 * hardware Nexus drives on a best-effort basis. Rendered left of the Nexus Control
 * switch on the Devices list and under the on/off switch on the device page.
 */
export function ExperimentalBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge
      label={t('devices.experimental.badge')}
      color="var(--warn)"
      icon={<FlaskConical size={12} aria-hidden />}
      tooltip={{ title: t('devices.experimental.tooltip.title'), body: t('devices.experimental.tooltip.body') }}
      className={className}
    />
  );
}
