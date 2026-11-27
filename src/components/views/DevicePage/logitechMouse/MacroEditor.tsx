import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Circle, Clock, MousePointerClick, Music, Square, Trash2, X } from 'lucide-react';
import type { MacroStep } from '../../../../api/logitechMouse';
import { useTranslation } from '../../../../lib/i18n';
import { Button } from '../../../common/Button/Button';
import { ChipGroup } from '../../../common/ChipGroup/ChipGroup';
import { TextInput } from '../../../common/TextInput/TextInput';
import { usageOfCode } from './hidKeys';
import styles from './MacroEditor.module.scss';

const P = 'devices.logitechMouse.macro.';
/** Most steps the mouse takes in one macro (the service checks the same). */
export const MAX_STEPS = 80;
const MAX_DELAY_MS = 65535;
const DEFAULT_FIXED_MS = 50;
const LEFT_BUTTON = 0x01;
type DelayMode = 'recorded' | 'fixed' | 'none';
const DELAY_MODES: readonly DelayMode[] = ['recorded', 'fixed', 'none'];

const PRESS: Partial<Record<MacroStep['type'], MacroStep['type']>> = { keyDown: 'keyUp', mouseDown: 'mouseUp', consumerDown: 'consumerUp' };
const RELEASE: Partial<Record<MacroStep['type'], MacroStep['type']>> = { keyUp: 'keyDown', mouseUp: 'mouseDown', consumerUp: 'consumerDown' };

const clampDelay = (ms: number) => Math.min(MAX_DELAY_MS, Math.max(1, Math.round(ms)));

/** True when everything the steps press is released again, in order. */
export function isBalanced(steps: readonly MacroStep[]): boolean {
  const held = new Set<string>();
  for (const s of steps) {
    if (PRESS[s.type]) held.add(`${s.type}:${s.code}`);
    const down = RELEASE[s.type];
    if (down && !held.delete(`${down}:${s.code}`)) return false;
  }
  return held.size === 0;
}

// Removing a press also removes its release (and the other way round), so the macro stays balanced.
function withoutStep(steps: readonly MacroStep[], index: number): MacroStep[] {
  const s = steps[index];
  const drop = new Set([index]);
  const up = PRESS[s.type];
  const down = RELEASE[s.type];
  if (up) {
    const j = steps.findIndex((t, k) => k > index && t.type === up && t.code === s.code);
    if (j >= 0) drop.add(j);
  } else if (down) {
    for (let k = index - 1; k >= 0; k--) {
      if (steps[k].type === down && steps[k].code === s.code) { drop.add(k); break; }
    }
  }
  return steps.filter((_, k) => !drop.has(k));
}

export interface MacroEditorProps {
  /** The button the macro goes on ("G10"). */
  buttonName: string;
  /** The macro now on the button, or null for a new one. */
  initial: readonly MacroStep[] | null;
  busy: boolean;
  /** Words for what a step presses: a key, a mouse button, a media control. */
  describe: (step: MacroStep) => string;
  onSave: (steps: MacroStep[]) => void;
  onCancel: () => void;
}

/**
 * The macro editor that takes the action list's place, like the vendor app's: record keystrokes with their
 * own timing, a fixed delay or none, add pauses and clicks, fix any delay by hand, then store the macro in
 * the mouse, where it plays with no software running.
 */
export function MacroEditor({ buttonName, initial, busy, describe, onSave, onCancel }: MacroEditorProps) {
  const { t } = useTranslation();
  const [steps, setSteps] = useState<MacroStep[]>(() => (initial ? [...initial] : []));
  const [recording, setRecording] = useState(false);
  const [mode, setMode] = useState<DelayMode>('recorded');
  const [fixedMs, setFixedMs] = useState(DEFAULT_FIXED_MS);
  const [fresh, setFresh] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);
  // The recording listener reads the delay settings as they are when each key arrives.
  const settings = useRef({ mode, fixedMs });
  useEffect(() => {
    settings.current = { mode, fixedMs };
  }, [mode, fixedMs]);

  useEffect(() => {
    if (!recording) return undefined;
    const held: number[] = [];
    let last: number | null = null;
    const onKey = (e: KeyboardEvent) => {
      const usage = usageOfCode(e.code);
      if (usage === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      const down = e.type === 'keydown';
      if (down && (e.repeat || held.includes(usage))) return;
      if (!down) {
        const at = held.indexOf(usage);
        if (at < 0) return; // pressed before the recording started
        held.splice(at, 1);
      } else {
        held.push(usage);
      }
      const now = e.timeStamp;
      const { mode: m, fixedMs: fixed } = settings.current;
      const gap = last === null ? 0 : m === 'recorded' ? now - last : m === 'fixed' ? fixed : 0;
      last = now;
      setSteps(prev => {
        const add: MacroStep[] = [];
        if (gap >= 1 && prev.length > 0) add.push({ type: 'delay', code: clampDelay(gap) });
        add.push({ type: down ? 'keyDown' : 'keyUp', code: usage });
        return prev.length + add.length > MAX_STEPS ? prev : [...prev, ...add];
      });
      setFresh(n => n + 1);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      // Keys still down when the recording stops are released at the end.
      if (held.length > 0) {
        const releases = [...held].reverse().map((code): MacroStep => ({ type: 'keyUp', code }));
        setSteps(prev => [...prev, ...releases]);
      }
    };
  }, [recording]);

  useEffect(() => {
    const list = listRef.current;
    if (list && fresh > 0) list.scrollTop = list.scrollHeight;
  }, [fresh]);

  const append = (add: MacroStep[]) => {
    setSteps(prev => (prev.length + add.length > MAX_STEPS ? prev : [...prev, ...add]));
    setFresh(n => n + 1);
  };
  const setDelay = (index: number, text: string) => {
    const ms = Number(text);
    if (!Number.isFinite(ms)) return;
    setSteps(prev => prev.map((s, k) => (k === index ? { ...s, code: clampDelay(ms) } : s)));
  };

  const balanced = isBalanced(steps);
  const full = steps.length >= MAX_STEPS;
  const canSave = !busy && !recording && steps.length > 0 && balanced;

  const icon = (s: MacroStep) => {
    if (s.type === 'keyDown' || s.type === 'mouseDown' || s.type === 'consumerDown') return <ArrowDown size={13} aria-hidden />;
    if (s.type === 'keyUp' || s.type === 'mouseUp' || s.type === 'consumerUp') return <ArrowUp size={13} aria-hidden />;
    if (s.type === 'delay') return <Clock size={13} aria-hidden />;
    return <Music size={13} aria-hidden />;
  };
  const kindClass = (s: MacroStep) => (s.type === 'delay' ? styles.delay : RELEASE[s.type] ? styles.release : styles.press);

  return (
    <aside className={styles.editor} aria-label={initial ? t(`${P}titleEdit`, { button: buttonName }) : t(`${P}titleNew`, { button: buttonName })}>
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{initial ? t(`${P}titleEdit`, { button: buttonName }) : t(`${P}titleNew`, { button: buttonName })}</span>
          <Button size="sm" tone="ghost" icon={<X size={14} />} onClick={onCancel} disabled={recording}>{t(`${P}cancel`)}</Button>
        </div>
        <span className={styles.hint}>{t(`${P}onboardNote`)}</span>
        <Button
          size="sm"
          tone={recording ? 'danger-solid' : 'accent'}
          icon={recording ? <Square size={13} /> : <Circle size={13} />}
          disabled={busy || (full && !recording)}
          onClick={() => setRecording(r => !r)}
        >
          {recording ? t(`${P}stop`) : t(`${P}record`)}
        </Button>
        {recording && <span className={styles.recording} role="status">{t(`${P}recording`)}</span>}
        <div className={styles.modeRow}>
          <span className={styles.modeLabel}>{t(`${P}delays`)}</span>
          <ChipGroup
            ariaLabel={t(`${P}delays`)}
            options={DELAY_MODES.map(m => ({ key: m, label: t(`${P}delay.${m}`) }))}
            activeKey={mode}
            onChange={key => setMode(key as DelayMode)}
          />
          {mode === 'fixed' && (
            <div className={styles.fixedField}>
              <TextInput
                size="sm"
                type="number"
                align="right"
                ariaLabel={t(`${P}fixedMs`)}
                value={String(fixedMs)}
                onSubmit={v => setFixedMs(clampDelay(Number(v) || DEFAULT_FIXED_MS))}
                onBlur={v => setFixedMs(clampDelay(Number(v) || DEFAULT_FIXED_MS))}
              />
            </div>
          )}
        </div>
      </div>
      <ol ref={listRef} className={styles.steps}>
        {steps.length === 0 && <li className={styles.empty}>{t(`${P}empty`)}</li>}
        {steps.map((s, i) => (
          <li key={`${String(i)}-${s.type}-${String(s.code)}`} className={`${styles.step} ${kindClass(s)}`}>
            <span className={styles.stepIcon}>{icon(s)}</span>
            {s.type === 'delay' ? (
              <span className={styles.delayField}>
                <TextInput
                  size="sm"
                  type="number"
                  align="right"
                  ariaLabel={t(`${P}delayLabel`)}
                  value={String(s.code)}
                  disabled={recording}
                  onSubmit={v => setDelay(i, v)}
                  onBlur={v => setDelay(i, v)}
                />
                <span className={styles.unit}>{t(`${P}msUnit`)}</span>
              </span>
            ) : (
              <span className={styles.stepText}>
                {s.type === 'wheel' || s.type === 'hwheel'
                  ? t(`${P}${s.type}`, { n: String(s.code) })
                  : t(PRESS[s.type] ? `${P}pressed` : `${P}released`, { key: describe(s) })}
              </span>
            )}
            <button type="button" className={styles.remove} aria-label={t(`${P}removeStep`)} disabled={recording} onClick={() => setSteps(prev => withoutStep(prev, i))}>
              <Trash2 size={13} aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      <div className={styles.foot}>
        <div className={styles.add}>
          <Button size="sm" tone="ghost" icon={<Clock size={13} />} disabled={recording || full} onClick={() => append([{ type: 'delay', code: fixedMs }])}>
            {t(`${P}addDelay`)}
          </Button>
          <Button
            size="sm"
            tone="ghost"
            icon={<MousePointerClick size={13} />}
            disabled={recording || steps.length + 2 > MAX_STEPS}
            onClick={() => append([{ type: 'mouseDown', code: LEFT_BUTTON }, { type: 'mouseUp', code: LEFT_BUTTON }])}
          >
            {t(`${P}addClick`)}
          </Button>
          <Button size="sm" tone="ghost" icon={<Trash2 size={13} />} disabled={recording || steps.length === 0} onClick={() => setSteps([])}>
            {t(`${P}clear`)}
          </Button>
        </div>
        <span className={styles.count}>{t(`${P}stepCount`, { n: String(steps.length), max: String(MAX_STEPS) })}</span>
        {!balanced && <span className={styles.warn}>{t(`${P}unbalanced`)}</span>}
        <Button tone="accent" disabled={!canSave} onClick={() => onSave(steps)}>{t(`${P}save`)}</Button>
      </div>
    </aside>
  );
}
