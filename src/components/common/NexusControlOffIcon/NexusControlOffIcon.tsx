import { Link2Off } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { RowGlyph } from '../RowGlyph/RowGlyph';

/** Row glyph shown when Nexus Control is off for that device. */
export function NexusControlOffIcon({ className, label }: { className?: string; label?: string }) {
  const { t } = useTranslation();
  return (
    <RowGlyph
      icon={<Link2Off size={14} aria-hidden />}
      label={label ?? t('devices.nexusControlOff.sidebarTooltip')}
      className={className}
    />
  );
}
