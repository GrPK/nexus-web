import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../lib/i18n';
import styles from './PanelScreenSleep.module.scss';

// After the waking touch, the layer stays up (invisible) this long so the
// pointerup, the synthesized mouse events and the click land on it and never
// on whatever is underneath.
const WAKE_GUARD_MS = 400;

/**
 * Full-screen black layer: the panel's screen sleep. Any touch wakes it, and
 * that touch is swallowed. The host hides the panel content while asleep.
 */
export function PanelScreenSleep({ asleep, onWake }: { asleep: boolean; onWake: () => void }) {
  const { t } = useTranslation();
  const [waking, setWaking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onWakeRef = useRef(onWake);
  useEffect(() => { onWakeRef.current = onWake; }, [onWake]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    if (!asleep) setWaking(false);
  }, [asleep]);

  if (!asleep) return null;

  const wake = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (waking) return;
    setWaking(true);
    timer.current = setTimeout(() => { timer.current = null; onWakeRef.current(); }, WAKE_GUARD_MS);
  };
  const swallow = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <div
      className={styles.layer}
      data-waking={waking ? 'true' : undefined}
      role="button"
      tabIndex={0}
      aria-label={t('panel.controlCenter.screenSleep.wake')}
      onPointerDown={wake}
      onTouchStart={wake}
      onPointerUp={swallow}
      onTouchEnd={swallow}
      onMouseDown={swallow}
      onMouseUp={swallow}
      onClick={swallow}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') wake(e); }}
    />
  );
}
