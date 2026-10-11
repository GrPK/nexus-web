import { useRef, type CSSProperties } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import styles from '../LightingPage.module.scss';

// How long the box stays up; the stylesheet fades it over the same span.
const NOTICE_MS = 3800;

/**
 * Over the Animate canvas: says why a pick changed nothing for a locked
 * device. `seq` is the page's flash counter, so only a bump after this mounted
 * shows the box; a flash from before it mounted stays quiet.
 */
export function AnimateLockNotice({ seq }: { seq: number }) {
  const { t } = useTranslation();
  const mountedSeq = useRef(seq);
  if (seq === mountedSeq.current) return null;
  return (
    <div className={styles.staticNotice} style={{ '--picker-notice-hold': `${NOTICE_MS}ms` } as CSSProperties}>
      <div key={seq} className={styles.staticNoticeBox} role="status">
        <strong>{t('lighting.animate.lockedNoticeTitle')}</strong>
        <span>{t('lighting.animate.lockedNoticeBody')}</span>
      </div>
    </div>
  );
}
