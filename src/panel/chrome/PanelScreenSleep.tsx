import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../lib/i18n';
import styles from './PanelScreenSleep.module.scss';

// The layer outlives the waking touch's release by this long, so the click the
// browser synthesizes from it lands on the layer and not on whatever is under.
const WAKE_GUARD_MS = 400;

/**
 * Full-screen black layer: the panel's screen sleep. Any touch wakes it, on
 * release, and that touch is swallowed whole: the press, a long hold's
 * context menu, the release and the click. The host hides the panel content
 * while asleep and unhides it at `onWakeStart`; `onWake` removes the layer.
 */
export function PanelScreenSleep({ asleep, onWakeStart, onWake }: {
  asleep: boolean;
  onWakeStart: () => void;
  onWake: () => void;
}) {
  const { t } = useTranslation();
  const [waking, setWaking] = useState(false);
  const pressed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cbs = useRef({ onWakeStart, onWake });
  useEffect(() => { cbs.current = { onWakeStart, onWake }; }, [onWakeStart, onWake]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    if (!asleep) { setWaking(false); pressed.current = false; }
  }, [asleep]);

  if (!asleep) return null;

  const swallow = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); };
  const wake = (e: React.SyntheticEvent) => {
    swallow(e);
    if (waking) return;
    setWaking(true);
    cbs.current.onWakeStart();
    timer.current = setTimeout(() => { timer.current = null; cbs.current.onWake(); }, WAKE_GUARD_MS);
  };

  return (
    <div
      className={styles.layer}
      data-waking={waking ? 'true' : undefined}
      role="button"
      tabIndex={0}
      aria-label={t('panel.controlCenter.screenSleep.wake')}
      onPointerDown={(e) => { swallow(e); pressed.current = true; }}
      onPointerUp={(e) => { if (pressed.current) wake(e); else swallow(e); }}
      onPointerCancel={(e) => { if (pressed.current) wake(e); }}
      onContextMenu={swallow}
      onMouseDown={swallow}
      onMouseUp={swallow}
      onTouchEnd={swallow}
      onClick={swallow}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') wake(e); }}
    />
  );
}
