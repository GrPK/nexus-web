import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Gauge, Keyboard, ListOrdered, Mouse, MousePointer2, Music, Pencil, RotateCcw, Sparkles, Undo2 } from 'lucide-react';
import {
  restoreMouseProfile, setMouseActiveProfile, setMouseMode, updateMouseProfile,
  type MacroStep, type MouseButton, type MouseProfile, type MouseProfilePatch, type MouseState,
} from '../../../api/logitechMouse';
import { useTranslation } from '../../../lib/i18n';
import { Button } from '../../common/Button/Button';
import { ChipGroup } from '../../common/ChipGroup/ChipGroup';
import { EmptyState } from '../../common/EmptyState/EmptyState';
import { Notice } from '../../common/Notice/Notice';
import { Select } from '../../common/Select/Select';
import { SettingsSection } from '../../common/SettingsSection/SettingsSection';
import { Spinner } from '../../common/Spinner/Spinner';
import { TextInput } from '../../common/TextInput/TextInput';
import { ViewHeader } from '../../common/ViewHeader/ViewHeader';
import { ActionLibrary, type LibraryGroup } from './logitechMouse/ActionLibrary';
import { DpiTrack } from './logitechMouse/DpiTrack';
import { isModifier, keyCap } from './logitechMouse/hidKeys';
import { MacroEditor } from './logitechMouse/MacroEditor';
import { MouseIllustration } from './logitechMouse/MouseIllustration';
import { FACTORY, HOTSPOTS, gName, type MouseView } from './logitechMouse/g502x';
import { useLogitechMouse } from './useLogitechMouse';
import styles from './LogitechMouseDevicePage.module.scss';

const P = 'devices.logitechMouse.';
type Change = (call: () => Promise<MouseState | null>) => Promise<boolean>;
type Tab = 'assignments' | 'sensitivity';
type Layer = 'primary' | 'gShift';
const LAYERS: readonly Layer[] = ['primary', 'gShift'];
const VIEWS: readonly MouseView[] = ['top', 'side'];
const TABS: readonly { key: Tab; icon: ReactNode }[] = [
  { key: 'assignments', icon: <Mouse size={14} /> },
  { key: 'sensitivity', icon: <Gauge size={14} /> },
];
// How long an assigned button's callout keeps its flash.
const FLASH_MS = 1200;
const ARROW = '→';

// Mouse buttons as their bit in the binding's mask.
const MOUSE_BUTTONS: readonly { mask: number; key: string }[] = [
  { mask: 0x01, key: 'left' }, { mask: 0x02, key: 'right' }, { mask: 0x04, key: 'middle' },
  { mask: 0x08, key: 'back' }, { mask: 0x10, key: 'forward' },
];
// Built-in functions offered for a button (firmware codes); others still show when a profile uses them.
const OFFERED_SPECIALS: readonly number[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2, 17, 16, 0];
// HID consumer usages for the media actions.
const MEDIA: readonly { usage: number; key: string }[] = [
  { usage: 0xCD, key: 'playPause' }, { usage: 0xB5, key: 'nextTrack' }, { usage: 0xB6, key: 'previousTrack' },
  { usage: 0xB7, key: 'stop' }, { usage: 0xE9, key: 'volumeUp' }, { usage: 0xEA, key: 'volumeDown' }, { usage: 0xE2, key: 'mute' },
];
// Keyboard keys by HID usage: letters, digits, F1-F12 and a few common ones.
const LETTER_A = 0x04;
const DIGIT_1 = 0x1E;
const F1 = 0x3A;
const NAMED_KEYS: readonly { usage: number; key: string }[] = [
  { usage: 0x28, key: 'enter' }, { usage: 0x29, key: 'escape' }, { usage: 0x2A, key: 'backspace' },
  { usage: 0x2B, key: 'tab' }, { usage: 0x2C, key: 'space' }, { usage: 0x4C, key: 'delete' },
];
const SPECIAL_KIND = 'special';
const MACRO_KIND = 'macro';
const MODIFIER_NAMES: readonly [number, string][] = [[1, 'Ctrl'], [2, 'Shift'], [4, 'Alt'], [8, 'Win']];
// Library values: a new macro opens the editor; a stored one carries its steps; one made elsewhere, where it lives.
const MACRO_NEW = 'macro-new';
const MACRO_STEPS = 'macro:';
const MACRO_AT = 'macro-at:';
// How many keys a macro's name lists before it is cut short.
const SUMMARY_KEYS = 4;
const ELLIPSIS = '…';

function keyName(usage: number, t: (k: string) => string): string {
  const named = NAMED_KEYS.find(k => k.usage === usage);
  if (named) return t(`${P}key.${named.key}`);
  return keyCap(usage) ?? '0x' + usage.toString(16).toUpperCase();
}

const stepsKey = (steps: readonly MacroStep[]) => JSON.stringify(steps.map(s => [s.type, s.code, s.modifiers ?? 0]));

function encode(b: Pick<MouseButton, 'kind' | 'code' | 'modifiers' | 'raw' | 'macro'>): string {
  if (b.kind === 'raw') return `raw:${b.raw ?? ''}`;
  if (b.kind === MACRO_KIND) return b.macro ? MACRO_STEPS + stepsKey(b.macro) : `${MACRO_AT}${b.code}:${b.modifiers}`;
  return `${b.kind}:${b.code}:${b.modifiers}`;
}

function decode(value: string, slot: number): MouseButton {
  if (value.startsWith(MACRO_STEPS)) {
    const rows = JSON.parse(value.slice(MACRO_STEPS.length)) as [MacroStep['type'], number, number][];
    return { slot, kind: MACRO_KIND, code: 0, modifiers: 0, macro: rows.map(([type, code, modifiers]) => ({ type, code, modifiers })) };
  }
  if (value.startsWith(MACRO_AT)) {
    const [sector, address] = value.slice(MACRO_AT.length).split(':');
    return { slot, kind: MACRO_KIND, code: Number(sector), modifiers: Number(address) };
  }
  const [kind, a, b] = value.split(':');
  if (kind === 'raw') return { slot, kind: 'raw', code: 0, modifiers: 0, raw: a };
  return { slot, kind: kind as MouseButton['kind'], code: Number(a), modifiers: Number(b) };
}

/** Words for what one macro step presses: a key (with any extra modifiers), a mouse button, a media control. */
function describeStep(step: MacroStep, t: (k: string, v?: Record<string, string>) => string): string {
  if (step.type === 'mouseDown' || step.type === 'mouseUp') {
    const names = MOUSE_BUTTONS.filter(m => (step.code & m.mask) !== 0).map(m => t(`${P}mouse.${m.key}`));
    return names.join('+') || '0x' + step.code.toString(16);
  }
  if (step.type === 'consumerDown' || step.type === 'consumerUp') {
    const media = MEDIA.find(m => m.usage === step.code);
    return media ? t(`${P}media.${media.key}`) : t(`${P}consumerCode`, { code: '0x' + step.code.toString(16).toUpperCase() });
  }
  const mods = MODIFIER_NAMES.filter(([bit]) => ((step.modifiers ?? 0) & bit) !== 0).map(([, name]) => name);
  return [...mods, keyName(step.code, t)].join('+');
}

/** A macro's name: the keys and buttons it presses, modifiers held at the time joined on ("Shift+H, I"). */
function summarizeMacro(steps: readonly MacroStep[], t: (k: string, v?: Record<string, string>) => string): string {
  const held: number[] = [];
  const parts: string[] = [];
  for (const s of steps) {
    if (s.type === 'keyDown' && isModifier(s.code)) {
      held.push(s.code);
    } else if (s.type === 'keyUp' && isModifier(s.code)) {
      const at = held.indexOf(s.code);
      if (at >= 0) held.splice(at, 1);
    } else if (s.type === 'keyDown' || s.type === 'mouseDown' || s.type === 'consumerDown') {
      parts.push([...held.map(u => keyName(u, t)), describeStep(s, t)].join('+'));
    }
  }
  if (parts.length === 0 && held.length > 0) parts.push(held.map(u => keyName(u, t)).join('+'));
  return parts.length > SUMMARY_KEYS ? parts.slice(0, SUMMARY_KEYS).join(', ') + ELLIPSIS : parts.join(', ');
}

/** The action library, grouped as the vendor app groups it; the macros group lists every macro stored in the mouse. */
function useLibrary(state: MouseState): LibraryGroup[] {
  const { t } = useTranslation();
  return useMemo(() => {
    const macros = new Map<string, string>([[MACRO_NEW, t(`${P}macro.new`)]]);
    for (const p of state.profiles) {
      for (const b of [...p.buttons, ...p.gShiftButtons]) {
        if (b.kind !== MACRO_KIND) continue;
        const value = encode(b);
        if (!macros.has(value)) {
          macros.set(value, b.macro ? t(`${P}macro.summary`, { keys: summarizeMacro(b.macro, t) }) : t(`${P}macro.foreign`));
        }
      }
    }
    const specialName = (code: number) => state.specials.find(s => s.code === code)?.name ?? String(code);
    const usages = [
      ...Array.from({ length: 26 }, (_, i) => LETTER_A + i),
      ...Array.from({ length: 10 }, (_, i) => DIGIT_1 + i),
      ...Array.from({ length: 12 }, (_, i) => F1 + i),
      ...NAMED_KEYS.map(k => k.usage),
    ];
    return [
      { key: 'mouse', title: t(`${P}group.mouse`), icon: <MousePointer2 size={14} />,
        items: MOUSE_BUTTONS.map(m => ({ value: encode({ kind: 'mouse', code: m.mask, modifiers: 0 }), label: t(`${P}mouse.${m.key}`) })) },
      { key: 'functions', title: t(`${P}group.functions`), icon: <Sparkles size={14} />,
        items: OFFERED_SPECIALS.map(code => ({ value: encode({ kind: SPECIAL_KIND, code, modifiers: 0 }), label: t(`${P}special.${specialName(code)}`) })) },
      { key: 'macros', title: t(`${P}group.macros`), icon: <ListOrdered size={14} />,
        items: [...macros].map(([value, label]) => ({ value, label })) },
      { key: 'media', title: t(`${P}group.media`), icon: <Music size={14} />,
        items: MEDIA.map(m => ({ value: encode({ kind: 'consumer', code: m.usage, modifiers: 0 }), label: t(`${P}media.${m.key}`) })) },
      { key: 'keys', title: t(`${P}group.keyboard`), icon: <Keyboard size={14} />,
        items: usages.map(u => ({ value: encode({ kind: 'key', code: u, modifiers: 0 }), label: keyName(u, t) })) },
    ];
  }, [state.specials, state.profiles, t]);
}

/** Words for a binding, also for ones the library does not list (a key with modifiers, a macro). */
function bindingLabel(b: MouseButton | undefined, library: LibraryGroup[], state: MouseState, t: (k: string, v?: Record<string, string>) => string): string {
  if (!b) return '';
  const value = encode(b);
  for (const g of library) {
    const hit = g.items.find(i => i.value === value);
    if (hit) return hit.label;
  }
  if (b.kind === 'key') {
    const mods = MODIFIER_NAMES.filter(([bit]) => (b.modifiers & bit) !== 0).map(([, name]) => name);
    return [...mods, keyName(b.code, t)].join('+');
  }
  if (b.kind === SPECIAL_KIND) return t(`${P}special.${state.specials.find(s => s.code === b.code)?.name ?? 'none'}`);
  if (b.kind === 'consumer') return t(`${P}consumerCode`, { code: '0x' + b.code.toString(16).toUpperCase() });
  if (b.kind === MACRO_KIND) return b.macro ? t(`${P}macro.summary`, { keys: summarizeMacro(b.macro, t) }) : t(`${P}macro.foreign`);
  return t(`${P}customBinding`);
}

interface ProfileProps { state: MouseState; profile: MouseProfile; change: Change; busy: boolean }

function AssignmentsTab({ state, profile, change, busy }: ProfileProps) {
  const { t } = useTranslation();
  const library = useLibrary(state);
  const [layer, setLayer] = useState<Layer>('primary');
  const [selected, setSelected] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  // The macro editor, open in the library's place for one button.
  const [editing, setEditing] = useState<{ slot: number; steps: MacroStep[] | null } | null>(null);
  const flashTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);
  const buttons = layer === 'primary' ? profile.buttons : profile.gShiftButtons;
  const bySlot = (slot: number) => buttons.find(b => b.slot === slot);
  const spot = selected === null ? undefined : HOTSPOTS.find(h => h.slot === selected);
  const current = selected === null ? undefined : bySlot(selected);

  const assign = (slot: number, value: string): Promise<boolean> => {
    setSelected(slot);
    if (value === MACRO_NEW) {
      setEditing({ slot, steps: null });
      return Promise.resolve(false);
    }
    const binding = decode(value, slot);
    const patch: MouseProfilePatch = layer === 'primary' ? { buttons: [binding] } : { gShiftButtons: [binding] };
    return change(() => updateMouseProfile(profile.number, patch)).then(ok => {
      if (ok) {
        window.clearTimeout(flashTimer.current);
        setFlash(slot);
        flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS);
      }
      return ok;
    });
  };
  const select = (slot: number) => {
    // With the editor open, picking another button moves the macro being made to it.
    if (editing) {
      setSelected(slot);
      setEditing({ ...editing, slot });
      return;
    }
    setSelected(prev => (prev === slot ? null : slot));
  };
  const saveMacro = (steps: MacroStep[]) => {
    if (!editing) return;
    void assign(editing.slot, encode({ kind: MACRO_KIND, code: 0, modifiers: 0, macro: steps })).then(ok => {
      if (ok) setEditing(null);
    });
  };
  const editingSpot = editing ? HOTSPOTS.find(h => h.slot === editing.slot) : undefined;
  const reset = () => {
    if (selected === null || !FACTORY[selected]) return;
    const f = FACTORY[selected];
    void assign(selected, encode({ kind: f.kind, code: f.code, modifiers: 0 }));
  };
  const label = (slot: number) => bindingLabel(bySlot(slot), library, state, t);

  return (
    <div className={styles.assign}>
      {editing && editingSpot ? (
        <MacroEditor
          key={editing.steps ? stepsKey(editing.steps) : MACRO_NEW}
          buttonName={gName(editingSpot.g)}
          initial={editing.steps}
          busy={busy}
          describe={step => describeStep(step, t)}
          onSave={saveMacro}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <ActionLibrary
          groups={library}
          initiallyOpen={3}
          currentValue={current ? encode(current) : null}
          disabled={busy}
          title={t(`${P}library`)}
          hint={spot ? t(`${P}libraryHintSelected`, { button: gName(spot.g) }) : t(`${P}libraryHint`)}
          searchLabel={t(`${P}librarySearch`)}
          emptyLabel={t(`${P}libraryEmpty`)}
          onPick={value => { if (selected !== null) void assign(selected, value); }}
        />
      )}
      <div className={styles.stage}>
        <div className={styles.stageBar}>
          <ChipGroup
            ariaLabel={t(`${P}layer`)}
            options={LAYERS.map(l => ({ key: l, label: t(`${P}layer.${l}`) }))}
            activeKey={layer}
            onChange={key => setLayer(key as Layer)}
          />
          {spot && current && (
            <div className={styles.selectedInfo} aria-live="polite">
              <span className={styles.selectedBadge}>{gName(spot.g)}</span>
              <span className={styles.selectedName}>{state.buttonLabels[spot.slot] ?? ''}</span>
              <span className={styles.selectedArrow} aria-hidden>{ARROW}</span>
              <span className={styles.selectedAction}>{label(spot.slot)}</span>
              {current.kind === MACRO_KIND && current.macro && !editing && (
                <Button size="sm" tone="ghost" icon={<Pencil size={14} />} disabled={busy} onClick={() => setEditing({ slot: spot.slot, steps: current.macro ?? null })}>
                  {t(`${P}macro.edit`)}
                </Button>
              )}
              <Button size="sm" tone="ghost" icon={<Undo2 size={14} />} disabled={busy || !FACTORY[spot.slot]} onClick={reset}>
                {t(`${P}resetButton`)}
              </Button>
            </div>
          )}
        </div>
        <div className={`${styles.views} ${layer === 'gShift' ? styles.gShift : ''}`}>
          {VIEWS.map(view => (
            <div key={view} className={view === 'top' ? styles.viewTop : styles.viewSide}>
              <MouseIllustration
                view={view}
                actionLabel={label}
                selectedSlot={selected}
                flashSlot={flash}
                ariaLabel={t(`${P}view.${view}`)}
                onSelect={select}
                onDropAction={(slot, value) => { void assign(slot, value); }}
              />
              <span className={styles.viewCaption}>{t(`${P}view.${view}`)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SensitivityTab({ state, profile, change, busy }: ProfileProps) {
  const { t } = useTranslation();
  return (
    <>
      <SettingsSection title={t(`${P}dpi`)} description={t(`${P}dpiTrackHint`)} boxClassName={styles.box}>
        <DpiTrack
          dpi={profile.dpi}
          defaultDpiIndex={profile.defaultDpiIndex}
          shiftDpiIndex={profile.shiftDpiIndex}
          busy={busy}
          labels={{
            track: t(`${P}dpi`),
            level: n => t(`${P}level`, { n: String(n) }),
            value: t(`${P}dpiValue`),
            setDefault: t(`${P}setDefault`),
            setShift: t(`${P}setShift`),
            remove: t(`${P}removeLevel`),
            add: t(`${P}addLevel`),
            isDefault: t(`${P}defaultLevel`),
            isShift: t(`${P}shiftLevel`),
          }}
          onCommit={c => { void change(() => updateMouseProfile(profile.number, c)); }}
        />
      </SettingsSection>
      <SettingsSection title={t(`${P}reportRate`)} description={t(`${P}reportRateHint`)} boxClassName={styles.box}>
        <ChipGroup
          ariaLabel={t(`${P}reportRate`)}
          options={[...state.reportRatesHz].sort((a, b) => a - b).map(hz => ({ key: String(hz), label: t(`${P}hz`, { hz: String(hz) }), disabled: busy }))}
          activeKey={String(profile.reportRateHz)}
          onChange={key => { void change(() => updateMouseProfile(profile.number, { reportRateHz: Number(key) })); }}
        />
      </SettingsSection>
    </>
  );
}

function ProfileBar({ state, profile, change, busy, onPick }: ProfileProps & { onPick: (n: number) => void }) {
  const { t } = useTranslation();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  useEffect(() => setNameDraft(null), [profile.number, profile.name]);
  const saveName = (text: string) => {
    const name = text.trim();
    if (name !== profile.name) void change(() => updateMouseProfile(profile.number, { name }));
  };
  const active = profile.number === state.activeProfile;
  return (
    <div className={styles.profileBar}>
      <Select
        className={styles.profileSelect}
        ariaLabel={t(`${P}profile`)}
        value={String(profile.number)}
        options={state.profiles.map(p => ({
          value: String(p.number),
          label: t(`${P}profileOption`, { n: String(p.number), name: p.name || t(`${P}unnamed`) }),
          note: p.number === state.activeProfile ? t(`${P}active`) : (p.enabled ? undefined : t(`${P}notInCycle`)),
        }))}
        onChange={v => onPick(Number(v))}
      />
      {active
        ? <span className={styles.activePill}>{t(`${P}active`)}</span>
        : <Button size="sm" disabled={busy} onClick={() => { void change(() => setMouseActiveProfile(profile.number)); }}>{t(`${P}useProfile`)}</Button>}
      <div className={styles.nameField}>
        <TextInput
          size="sm"
          maxLength={24}
          ariaLabel={t(`${P}name`)}
          value={nameDraft ?? profile.name}
          placeholder={t(`${P}unnamed`)}
          disabled={busy}
          onInput={setNameDraft}
          onSubmit={saveName}
          onBlur={text => { if (nameDraft !== null) saveName(text); }}
        />
      </div>
      {busy && <Spinner size={16} />}
      {profile.canRestore && (
        <Button size="sm" tone="ghost" icon={<RotateCcw size={14} />} disabled={busy} onClick={() => { void change(() => restoreMouseProfile(profile.number)); }}>
          {t(`${P}restore`)}
        </Button>
      )}
    </div>
  );
}

/** The Logitech mouse page: the profiles in the mouse's own memory, edited the way the vendor app's onboard memory mode does. */
export function LogitechMouseDevicePage() {
  const { t } = useTranslation();
  const { state, loadFailed, failure, busy, change } = useLogitechMouse();
  const [tab, setTab] = useState<Tab>('assignments');
  const [selected, setSelected] = useState<number | null>(null);

  const profiles = state?.profiles ?? [];
  const number = selected ?? state?.activeProfile ?? profiles[0]?.number ?? null;
  const profile = profiles.find(p => p.number === number) ?? null;
  // Brand + model name, not translated.
  const title = 'Logitech ' + (state?.model ?? 'G502 X PLUS');

  return (
    <div className={styles.page}>
      <ViewHeader
        title={title}
        tabs={state?.present ? TABS.map(({ key, icon }) => ({ key, icon, label: t(`${P}tab.${key}`) })) : undefined}
        activeTab={tab}
        onTabChange={key => setTab(key as Tab)}
      />
      <div className={styles.body}>
        {failure && <Notice tone="critical" role="alert">{t(failure)}</Notice>}
        {loadFailed && !state && <Notice tone="critical" role="alert">{t(`${P}loadFailed`)}</Notice>}
        {!state && !loadFailed && <div className={styles.loading}><Spinner size={28} /></div>}
        {state && !state.present && (
          <EmptyState icon={<MousePointer2 size={40} />} title={t(`${P}notFound`)} hint={t(`${P}notFoundHint`)} />
        )}
        {state?.present && state.error && <Notice tone="critical" role="alert">{t(`${P}readFailed`)}</Notice>}
        {state?.present && state.mode === 'host' && (
          <Notice
            tone="warning"
            actions={<Button size="sm" disabled={busy} onClick={() => { void change(() => setMouseMode('onboard')); }}>{t(`${P}useOnboard`)}</Button>}
          >
            {t(`${P}hostMode`)}
          </Notice>
        )}
        {state?.present && profile && (
          <>
            <ProfileBar state={state} profile={profile} change={change} busy={busy} onPick={setSelected} />
            <div className={styles.tab} key={tab}>
              {tab === 'assignments'
                ? <AssignmentsTab state={state} profile={profile} change={change} busy={busy} />
                : <SensitivityTab state={state} profile={profile} change={change} busy={busy} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
