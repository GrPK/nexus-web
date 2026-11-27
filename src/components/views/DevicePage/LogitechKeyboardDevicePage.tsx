import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Ban, Keyboard, MousePointer2, Music, Pause, RefreshCw, SkipBack, SkipForward, Sparkles,
  Square, Undo2, Volume1, Volume2, VolumeX, Zap,
} from 'lucide-react';
import {
  fetchKeyboard, rewriteKeyboard, setKeyboardEnabled, setKeyboardLayers, setKeyboardLayout,
  type KeyAssignment, type KeyboardLayers, type KeyboardState,
} from '../../../api/logitechKeyboard';
import { useTranslation } from '../../../lib/i18n';
import { Button } from '../../common/Button/Button';
import { ChipGroup } from '../../common/ChipGroup/ChipGroup';
import { EmptyState } from '../../common/EmptyState/EmptyState';
import { Notice } from '../../common/Notice/Notice';
import { Select } from '../../common/Select/Select';
import { Spinner } from '../../common/Spinner/Spinner';
import { Toggle } from '../../common/Toggle/Toggle';
import { ViewHeader } from '../../common/ViewHeader/ViewHeader';
import { ActionLibrary, type LibraryGroup } from './logitechMouse/ActionLibrary';
import { isModifier, usageOfCode } from './logitechMouse/hidKeys';
import { KeyboardIllustration, legendOf, type KeyFace } from './logitechKeyboard/KeyboardIllustration';
import { KEYS, type KeyboardLayout } from './logitechKeyboard/g915x';
import { MEDIA, MODIFIERS, MOUSE_BUTTONS, capText, keyName, modifierCaps, shortcutText } from './logitechKeyboard/keyNames';
import { usePolledDevice } from './usePolledDevice';
import { DeviceSwitcherContext } from './logitechHubContext';
import styles from './LogitechKeyboardDevicePage.module.scss';

const P = 'devices.logitechKeyboard.';
const M = 'devices.logitechMouse.';
type LayerName = keyof KeyboardLayers;
const LAYERS: readonly LayerName[] = ['base', 'fn', 'gShift'];
// How long a changed key keeps its pop.
const FLASH_MS = 1200;
const ARROW = '→';
// Library values that are not an assignment.
const SHORTCUT = 'shortcut';
const LAYOUT_AUTO = 'auto';
const LAYOUT_ANSI: KeyboardLayout = 'ansi';
const LAYOUT_ISO: KeyboardLayout = 'iso';
// The library opens with every group but the long list of keys unfolded; search reaches the keys too.
const OPEN_GROUPS = 4;

// Keys offered in the library, by HID usage.
const LETTER_A = 0x04;
const DIGIT_1 = 0x1E;
const F1 = 0x3A;
const F13 = 0x68;
const OTHER_KEYS: readonly number[] = [
  0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x39, 0x4C, 0x49, 0x4A, 0x4D, 0x4B, 0x4E, 0x52, 0x51, 0x50, 0x4F,
  0x46, 0x47, 0x48, 0x65, 0x2D, 0x2E, 0x2F, 0x30, 0x31, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38,
  0xE0, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7,
  0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x5B, 0x5C, 0x5D, 0x5E, 0x5F, 0x60, 0x61, 0x62, 0x63,
];
const MEDIA_ICON: Record<number, ReactNode> = {
  0xCD: <Pause />, 0xB5: <SkipForward />, 0xB6: <SkipBack />, 0xB7: <Square />,
  0xE9: <Volume2 />, 0xEA: <Volume1 />, 0xE2: <VolumeX />,
};
// Modifier bits of a recorded shortcut, from the keys held.
const MOD_CTRL = 0x01;
const MOD_SHIFT = 0x02;
const MOD_ALT = 0x04;
const MOD_WIN = 0x08;

type Assign = Omit<KeyAssignment, 'key'>;
type T = (k: string, v?: Record<string, string>) => string;

const encode = (a: Assign) => `${a.kind}:${a.code}:${a.modifiers}`;

function decode(value: string, key: number): KeyAssignment {
  const [kind, code, modifiers] = value.split(':');
  return { key, kind: kind as KeyAssignment['kind'], code: Number(code), modifiers: Number(modifiers) };
}

/** Words for an assignment, for lists and the selected-key bar. */
function describe(a: Assign, t: T): string {
  switch (a.kind) {
    case 'keyboard': return shortcutText(a.code, a.modifiers, t);
    case 'mouse': {
      const names = MOUSE_BUTTONS.filter(m => (a.code & m.mask) !== 0).map(m => t(`${M}mouse.${m.key}`));
      return names.join('+') || '0x' + a.code.toString(16);
    }
    case 'consumer': {
      const media = MEDIA.find(m => m.usage === a.code);
      return media ? t(`${M}media.${media.key}`) : t(`${M}consumerCode`, { code: '0x' + a.code.toString(16).toUpperCase() });
    }
    case 'gshift': return t(`${M}special.gShift`);
    default: return t(`${P}disable`);
  }
}

/** How an assignment reads on a key cap. */
function capFace(a: Assign, source: KeyFace['source'], t: T): KeyFace {
  switch (a.kind) {
    case 'keyboard': {
      const cap = capText(a.code) || keyName(a.code, t);
      return a.modifiers === 0 ? { source, label: cap } : { source, label: cap, sub: modifierCaps(a.modifiers) };
    }
    case 'consumer':
      return MEDIA_ICON[a.code] ? { source, label: null, icon: MEDIA_ICON[a.code] } : { source, label: describe(a, t) };
    case 'mouse': {
      const shorts = MOUSE_BUTTONS.filter(m => (a.code & m.mask) !== 0).map(m => m.short).join('');
      return { source, label: shorts || '?', icon: <MousePointer2 /> };
    }
    case 'gshift':
      return { source, label: 'G', sub: 'SHIFT', tone: 'gshift' };
    default:
      return { source, label: '⊘', tone: 'disabled' };
  }
}

/** The action library, grouped like the vendor app's; G-Shift only goes on the Base layer. */
function useLibrary(layer: LayerName): LibraryGroup[] {
  const { t } = useTranslation();
  return useMemo(() => {
    const usages = [
      ...Array.from({ length: 26 }, (_, i) => LETTER_A + i),
      ...Array.from({ length: 10 }, (_, i) => DIGIT_1 + i),
      ...Array.from({ length: 12 }, (_, i) => F1 + i),
      ...Array.from({ length: 12 }, (_, i) => F13 + i),
      ...OTHER_KEYS,
    ];
    const functions = [
      ...(layer === 'base' ? [{ value: encode({ kind: 'gshift', code: 2, modifiers: 0 }), label: t(`${M}special.gShift`) }] : []),
      { value: encode({ kind: 'disabled', code: 0, modifiers: 0 }), label: t(`${P}disable`) },
    ];
    return [
      { key: 'shortcut', title: t(`${P}group.shortcut`), icon: <Zap size={14} />,
        items: [{ value: SHORTCUT, label: t(`${P}shortcut.record`) }] },
      { key: 'functions', title: t(`${P}group.functions`), icon: <Sparkles size={14} />, items: functions },
      { key: 'mouse', title: t(`${M}group.mouse`), icon: <MousePointer2 size={14} />,
        items: MOUSE_BUTTONS.map(m => ({ value: encode({ kind: 'mouse', code: m.mask, modifiers: 0 }), label: t(`${M}mouse.${m.key}`) })) },
      { key: 'media', title: t(`${M}group.media`), icon: <Music size={14} />,
        items: MEDIA.map(m => ({ value: encode({ kind: 'consumer', code: m.usage, modifiers: 0 }), label: t(`${M}media.${m.key}`) })) },
      { key: 'keys', title: t(`${M}group.keyboard`), icon: <Keyboard size={14} />,
        items: usages.map(u => ({ value: encode({ kind: 'keyboard', code: u, modifiers: 0 }), label: keyName(u, t) })) },
    ];
  }, [layer, t]);
}

/** The modifiers held so far while a shortcut is recorded ("Ctrl+Shift+…"). */
const modsText = (held: number) => [...MODIFIERS.filter(([bit]) => (held & bit) !== 0).map(([, name]) => name), '…'].join('+');

/** A key's name for people: its legend, a media control's name, or its number. */
function keyTitle(key: number, state: KeyboardState, t: T): string {
  const shape = KEYS.find(k => k.cid === state.controls[key]);
  if (shape?.media !== undefined) {
    const media = MEDIA.find(m => m.usage === shape.media);
    if (media) return t(`${M}media.${media.key}`);
  }
  if (shape?.usage !== undefined) {
    const legend = capText(shape.usage);
    if (legend && legend.length <= 3) return legend;
    return keyName(shape.usage, t);
  }
  const legend = shape ? legendOf(shape) : '';
  return legend || t(`${P}keyNumber`, { n: String(key) });
}

/** Listens for the next key press with its modifiers while `active`; Esc alone cancels. */
function useShortcutCapture(active: boolean, onCapture: (usage: number, modifiers: number) => void, onCancel: () => void) {
  const [held, setHeld] = useState(0);
  const handlers = useRef({ onCapture, onCancel });
  useEffect(() => {
    handlers.current = { onCapture, onCancel };
  });
  useEffect(() => {
    if (!active) {
      setHeld(0);
      return undefined;
    }
    const mods = (e: KeyboardEvent) =>
      (e.ctrlKey ? MOD_CTRL : 0) | (e.shiftKey ? MOD_SHIFT : 0) | (e.altKey ? MOD_ALT : 0) | (e.metaKey ? MOD_WIN : 0);
    const down = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      const usage = usageOfCode(e.code);
      if (usage === undefined) return;
      if (isModifier(usage)) {
        setHeld(mods(e));
        return;
      }
      if (usage === 0x29 && mods(e) === 0) {
        handlers.current.onCancel();
        return;
      }
      handlers.current.onCapture(usage, mods(e));
    };
    const up = (e: KeyboardEvent) => setHeld(mods(e));
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
    };
  }, [active]);
  return held;
}

interface StageProps { state: KeyboardState; change: (call: () => Promise<KeyboardState | null>) => Promise<boolean>; busy: boolean }

function AssignmentsStage({ state, change, busy }: StageProps) {
  const { t } = useTranslation();
  const [layer, setLayer] = useState<LayerName>('base');
  const [selected, setSelected] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [capturing, setCapturing] = useState(false);
  const flashTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);
  const library = useLibrary(layer);
  const layout: KeyboardLayout = state.layout ?? 'ansi';

  const keyOfCid = useMemo(() => {
    const map = new Map<number, number>();
    state.controls.forEach((cid, index) => { if (cid !== 0 && !map.has(cid)) map.set(cid, index); });
    return map;
  }, [state.controls]);

  const own = (key: number, name: LayerName = layer) => state.layers[name].find(r => r.key === key);
  const effective = (key: number): { row: KeyAssignment; source: KeyFace['source'] } | null => {
    const mine = own(key);
    if (mine) return { row: mine, source: 'own' };
    if (layer === 'gShift') {
      const base = own(key, 'base');
      if (base) return { row: base, source: 'inherited' };
    }
    return null;
  };
  const face = (key: number): KeyFace => {
    const hit = effective(key);
    return hit ? capFace(hit.row, hit.source, t) : { label: null, source: null };
  };

  const write = (next: KeyboardLayers, key: number) =>
    change(() => setKeyboardLayers(next)).then(ok => {
      if (ok) {
        window.clearTimeout(flashTimer.current);
        setFlash(key);
        flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS);
      }
      return ok;
    });

  const withRow = (key: number, row: KeyAssignment | null): KeyboardLayers => {
    const rows = state.layers[layer].filter(r => r.key !== key);
    if (row) rows.push(row);
    rows.sort((a, b) => a.key - b.key);
    return { ...state.layers, [layer]: rows };
  };

  const assign = (key: number, value: string) => {
    setSelected(key);
    if (value === SHORTCUT) {
      setCapturing(true);
      return;
    }
    const row = decode(value, key);
    if (row.kind === 'gshift' && layer !== 'base') return;
    void write(withRow(key, row), key);
  };
  const reset = () => {
    if (selected !== null) void write(withRow(selected, null), selected);
  };
  const held = useShortcutCapture(
    capturing,
    (usage, modifiers) => {
      setCapturing(false);
      if (selected !== null) void write(withRow(selected, { key: selected, kind: 'keyboard', code: usage, modifiers }), selected);
    },
    () => setCapturing(false),
  );
  // With the custom assignments off the keyboard ignores them, so they show greyed and cannot be picked.
  const off = state.enabled === false;
  const select = (key: number) => {
    if (off) return;
    setCapturing(false);
    setSelected(prev => (prev === key ? null : key));
  };
  useEffect(() => { if (off) { setSelected(null); setCapturing(false); } }, [off]);

  const current = selected === null ? null : effective(selected);
  const counts = (name: LayerName) => state.layers[name].length;

  return (
    <div className={styles.assign}>
      <ActionLibrary
        groups={library}
        initiallyOpen={OPEN_GROUPS}
        currentValue={current?.source === 'own' ? encode(current.row) : null}
        disabled={busy || off}
        title={t(`${M}library`)}
        hint={selected !== null ? t(`${P}libraryHintSelected`, { key: keyTitle(selected, state, t) }) : t(`${P}libraryHint`)}
        searchLabel={t(`${M}librarySearch`)}
        emptyLabel={t(`${M}libraryEmpty`)}
        onPick={value => { if (selected !== null && !off) assign(selected, value); }}
      />
      <div className={styles.stage}>
        <div className={styles.stageBar}>
          <div className={styles.layerBlock}>
            <ChipGroup
              ariaLabel={t(`${P}layer`)}
              options={LAYERS.map(l => ({
                key: l,
                label: (
                  <span className={styles.layerChip}>
                    {t(`${P}layer.${l}`)}
                    {counts(l) > 0 && <span className={styles.layerCount}>{counts(l)}</span>}
                  </span>
                ),
              }))}
              activeKey={layer}
              onChange={key => { setLayer(key as LayerName); setCapturing(false); }}
            />
            <span className={styles.layerHint}>{t(`${P}layerHint.${layer}`)}</span>
          </div>
          {off && <span className={styles.offBadge}>{t(`${P}switch`)}: {t(`${P}switchOff`)}</span>}
          {selected !== null && (
            <div className={`${styles.selectedInfo} ${capturing ? styles.capturing : ''}`} aria-live="polite">
              <span className={styles.selectedBadge}>{keyTitle(selected, state, t)}</span>
              <span className={styles.selectedArrow} aria-hidden>{ARROW}</span>
              {capturing ? (
                <>
                  <span className={styles.selectedAction}>
                    {held ? modsText(held) : t(`${P}shortcut.listening`)}
                  </span>
                  <Button size="sm" tone="ghost" onClick={() => setCapturing(false)}>{t(`${P}shortcut.cancel`)}</Button>
                </>
              ) : (
                <>
                  <span className={styles.selectedAction}>
                    {current ? describe(current.row, t) : t(`${P}default`)}
                    {current?.source === 'inherited' && <span className={styles.fromBase}>{t(`${P}fromBase`)}</span>}
                  </span>
                  <Button size="sm" tone="ghost" icon={<Ban size={14} />} disabled={busy || (current?.row.kind === 'disabled' && current.source === 'own')}
                    onClick={() => assign(selected, encode({ kind: 'disabled', code: 0, modifiers: 0 }))}>
                    {t(`${P}disable`)}
                  </Button>
                  <Button size="sm" tone="ghost" icon={<Undo2 size={14} />} disabled={busy || current?.source !== 'own'} onClick={reset}>
                    {t(`${M}resetButton`)}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        <div className={`${styles.board} ${styles[`layer_${layer}`] ?? ''}`}>
          <KeyboardIllustration
            inactive={off}
            layout={layout}
            keyOf={cid => keyOfCid.get(cid)}
            face={face}
            selectedKey={selected}
            flashKey={flash}
            layerKey={layer}
            ariaLabel={t(`${P}keyboard`)}
            keyAria={(key, legend) => {
              const hit = effective(key);
              const name = legend || keyTitle(key, state, t);
              return hit ? `${name} ${ARROW} ${describe(hit.row, t)}` : name;
            }}
            onSelect={select}
            onDropAction={(key, value) => { if (!off) assign(key, value); }}
          />
        </div>
        <div className={styles.footer}>
          <label className={styles.switchRow}>
            <Toggle
              checked={state.enabled === true}
              disabled={busy || state.enabled === null || state.enabled === undefined}
              ariaLabel={t(`${P}switch`)}
              onChange={next => { void change(() => setKeyboardEnabled(next)); }}
            />
            <span className={styles.switchText}>
              <span className={styles.switchTitle}>{t(`${P}switch`)}: {state.enabled ? t(`${P}switchOn`) : t(`${P}switchOff`)}</span>
              <span className={styles.switchHint}>{t(`${P}stored`)} {t(`${P}switchHint`)}</span>
            </span>
          </label>
          {state.written && (
            <Button size="sm" tone="ghost" icon={<RefreshCw size={14} />} disabled={busy} onClick={() => { void change(() => rewriteKeyboard()); }}>
              {t(`${P}rewrite`)}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The Logitech keyboard page: the BASE / FN / G-SHIFT key assignments the keyboard applies itself. */
export function LogitechKeyboardDevicePage() {
  const { t } = useTranslation();
  const { state, loadFailed, failure, busy, change } = usePolledDevice(fetchKeyboard, `${P}failed`);
  // Brand + model name, not translated.
  const title = 'Logitech ' + (state?.model ?? 'G915 X');
  const layoutValue = state?.layoutChoice ?? LAYOUT_AUTO;
  const autoLayout = state?.layoutDetected ? state.layoutDetected.toUpperCase() : '?';
  const switcher = useContext(DeviceSwitcherContext);
  // The keyboard says its layout; the choice only shows when it did not, or one was picked by hand.
  const askLayout = !state?.layoutDetected || state.layoutChoice !== null && state.layoutChoice !== undefined;

  return (
    <div className={styles.page}>
      <ViewHeader title={title} tabActions={switcher ?? undefined} />
      <div className={styles.body}>
        {failure && <Notice tone="critical" role="alert">{t(failure)}</Notice>}
        {loadFailed && !state && <Notice tone="critical" role="alert">{t(`${P}loadFailed`)}</Notice>}
        {!state && !loadFailed && <div className={styles.loading}><Spinner size={28} /></div>}
        {state && !state.present && (
          <EmptyState icon={<Keyboard size={40} />} title={t(`${P}notFound`)} hint={t(`${P}notFoundHint`)} />
        )}
        {state?.present && state.error && <Notice tone="critical" role="alert">{t(`${P}unsupported`)}</Notice>}
        {state?.present && !state.error && !state.written && (
          <Notice
            tone="info"
            actions={<Button size="sm" disabled={busy} onClick={() => { void change(() => setKeyboardLayers(state.layers)); }}>{t(`${P}writeNow`)}</Button>}
          >
            {t(`${P}notWritten`)}
          </Notice>
        )}
        {state?.present && !state.error && (
          <>
            {askLayout && (
            <div className={styles.toolbar}>
              <Select
                className={styles.layoutSelect}
                ariaLabel={t(`${P}layout`)}
                value={layoutValue}
                options={[
                  { value: LAYOUT_AUTO, label: t(`${P}layout.auto`, { layout: autoLayout }) },
                  { value: LAYOUT_ANSI, label: t(`${P}layout.ansi`) },
                  { value: LAYOUT_ISO, label: t(`${P}layout.iso`) },
                ]}
                onChange={v => { void change(() => setKeyboardLayout(v === LAYOUT_AUTO ? null : (v as KeyboardLayout))); }}
              />
              {busy && <Spinner size={16} />}
            </div>
            )}
            <AssignmentsStage state={state} change={change} busy={busy} />
          </>
        )}
      </div>
    </div>
  );
}
