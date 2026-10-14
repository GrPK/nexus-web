import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/common/Button/Button';
import { useAudioMixer } from '../../hooks/useAudioMixer';
import { useTranslation } from '../../lib/i18n';
import { MixerStrip } from '../widgets/mixer/MixerStrip';
import styles from './PanelControlCenter.module.scss';

/**
 * Per-app volume sub-view of the control center: one fader per audio session,
 * the app icon mutes it. Built from the mixer widget's strip.
 */
export function ControlCenterMixerView({ onBack, active }: { onBack: () => void; active: boolean }) {
  const { t } = useTranslation();
  const mixer = useAudioMixer(active);
  const sessions = mixer.supported ? mixer.sessions : [];
  return (
    <div className={styles.card} data-cc-keep="true">
      <Button tone="ghost" icon={<ArrowLeft size={18} strokeWidth={2.2} />} onClick={onBack}>
        {t('panel.controlCenter.back')}
      </Button>
      <div className={styles.mixerTitle}>{t('panel.controlCenter.mixer.title')}</div>
      {sessions.length === 0 ? (
        <div className={styles.mixerEmpty}>{t('panel.controlCenter.mixer.empty')}</div>
      ) : (
        <div className={styles.mixerRow} data-panel-horizontal-control="true">
          {sessions.map(s => (
            <div key={s.id} className={styles.mixerCell}>
              <MixerStrip
                id={s.id}
                name={s.name}
                volume={s.volume}
                muted={s.muted}
                idle={!s.active}
                onChange={v => mixer.changeVolume(s.id, v)}
                onCommit={v => mixer.commitVolume(s.id, v)}
                onToggleMute={() => mixer.toggleMuted(s.id, !s.muted)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
