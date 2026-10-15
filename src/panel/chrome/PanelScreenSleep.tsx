import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../lib/i18n';
import styles from './PanelScreenSleep.module.scss';

// The layer outlives the waking touch's release by this long, so the click the
// browser synthesizes from it lands on the layer and not on whatever is under.
const WAKE_GUARD_MS = 400;
// Longer than the fade, in case its end event never comes.
const FADE_FALLBACK_MS = 600;

/**
 * Full-screen black layer: the panel's screen sleep. It fades in to black and
 * out again on wake, with the same easing. Any touch wakes it, on
 * release, and that touch is swallowed whole: the press, a long hold's
 * context menu, the release and the click. The host hides the panel content
 * once `onSleepFaded` fires and unhides it at `onWakeStart`; `onWake` removes
 * the layer. A touch during the fade-in wakes at its release like any other.
 */
export function PanelScreenSleep({ asleep, onSleepFaded, onWakeStart, onWake }: {
  asleep: boolean;
  // The fade to black has finished; the host may now hide the panel.
  onSleepFaded: () => void;
  onWakeStart: () => void;
  onWake: () => void;
}) {
  const { t } = useTranslation();
  const [waking, setWaking] = useState(false);
  // False for the first frame, so the layer fades in to black instead of snapping.
  const [entered, setEntered] = useState(false);
  const faded = useRef(false);
  const pressed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cbs = useRef({ onSleepFaded, onWakeStart, onWake });
  useEffect(() => { cbs.current = { onSleepFaded, onWakeStart, onWake }; }, [onSleepFaded, onWakeStart, onWake]);
  const waked = useRef(false);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    if (!asleep) { setWaking(false); setEntered(false); pressed.current = false; faded.current = false; waked.current = false; return undefined; }
    const frame = requestAnimationFrame(() => setEntered(true));
    // A transition end that never arrives must not strand the panel half-faded.
    const fallback = setTimeout(() => finishFade(), FADE_FALLBACK_MS);
    return () => { cancelAnimationFrame(frame); clearTimeout(fallback); };
  }, [asleep]);

  const finishFade = () => {
    if (faded.current || waked.current) return;
    faded.current = true;
    cbs.current.onSleepFaded();
  };

  if (!asleep) return null;

  const swallow = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); };
  const wake = (e: React.SyntheticEvent) => {
    swallow(e);
    if (waking) return;
    waked.current = true;
    setWaking(true);
    cbs.current.onWakeStart();
    timer.current = setTimeout(() => { timer.current = null; cbs.current.onWake(); }, WAKE_GUARD_MS);
  };

  return (
    <div
      className={styles.layer}
      data-entered={entered ? 'true' : undefined}
      data-waking={waking ? 'true' : undefined}
      role="button"
      tabIndex={0}
      aria-label={t('panel.controlCenter.screenSleep.wake')}
      onPointerDown={(e) => { swallow(e); pressed.current = true; }}
      onPointerUp={(e) => { if (pressed.current) wake(e); else swallow(e); }}
      onPointerCancel={(e) => { if (pressed.current) wake(e); }}
      onTransitionEnd={(e) => { if (e.target === e.currentTarget && entered && !waking) finishFade(); }}
      onContextMenu={swallow}
      onMouseDown={swallow}
      onMouseUp={swallow}
      onTouchEnd={swallow}
      onClick={swallow}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') wake(e); }}
    />
  );
}
