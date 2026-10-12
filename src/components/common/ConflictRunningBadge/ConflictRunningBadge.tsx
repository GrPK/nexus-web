import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { Badge } from '../Badge/Badge';

/** Pill badge naming a running third-party app that also drives this device; sits beside ExperimentalBadge on the Devices list. */
export function ConflictRunningBadge({ appName, className }: { appName: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge
      label={t('devices.conflictRunning.badge', { app: appName })}
      color="var(--warn)"
      icon={<AlertTriangle size={12} aria-hidden />}
      tooltip={{
        title: t('devices.conflictRunning.tooltip.title', { app: appName }),
        body: t('devices.conflictRunning.tooltip.body', { app: appName }),
      }}
      className={className}
    />
  );
}
