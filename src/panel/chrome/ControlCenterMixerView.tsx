import { ChevronLeft } from 'lucide-react';
import { useAudioMixer } from '../../hooks/useAudioMixer';
import { useTranslation } from '../../lib/i18n';
import { MixerStrip } from '../widgets/mixer/MixerStrip';
import styles from './PanelControlCenter.module.scss';

/**
 * Per-app volume sub-view of the control center: one fader per audio session,
 * the app icon mutes it. Built from the mixer widget's strip.
 */
export function ControlCenterMixerView({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const mixer = useAudioMixer(true);
  const sessions = mixer.supported ? mixer.sessions : [];
  return (
    <div className={styles.card} data-cc-keep="true">
      <button type="button" className={styles.backRow} onClick={onBack}>
        {/* eslint-disable-next-line i18next/no-literal-string -- aria boolean */}
        <ChevronLeft size={20} aria-hidden="true" />
        <span>{t('panel.controlCenter.back')}</span>
      </button>
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
