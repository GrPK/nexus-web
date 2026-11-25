import { useEffect, useMemo, useState } from 'react';
import { MousePointer2, RotateCcw } from 'lucide-react';
import {
  restoreMouseProfile, setMouseActiveProfile, setMouseMode, updateMouseProfile,
  type MouseButton, type MouseProfile, type MouseProfilePatch, type MouseState,
} from '../../../api/logitechMouse';
import { useTranslation } from '../../../lib/i18n';
import { Button } from '../../common/Button/Button';
import { ChipGroup } from '../../common/ChipGroup/ChipGroup';
import { EmptyState } from '../../common/EmptyState/EmptyState';
import { Notice } from '../../common/Notice/Notice';
import { Select, type SelectOption } from '../../common/Select/Select';
import { SettingRow } from '../../common/SettingRow/SettingRow';
import { SettingsSection } from '../../common/SettingsSection/SettingsSection';
import { Spinner } from '../../common/Spinner/Spinner';
import { TextInput } from '../../common/TextInput/TextInput';
import { ViewHeader } from '../../common/ViewHeader/ViewHeader';
import { useLogitechMouse } from './useLogitechMouse';
import styles from './LogitechMouseDevicePage.module.scss';

const P = 'devices.logitechMouse.';
type Change = (call: () => Promise<MouseState | null>) => Promise<boolean>;
type Layer = 'primary' | 'gShift';
const LAYERS: readonly Layer[] = ['primary', 'gShift'];

// The HERO sensor's range, in the 50 DPI steps G HUB offers.
const DPI_MIN = 100;
const DPI_MAX = 25600;
const DPI_STEP = 50;

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

function keyName(usage: number, t: (k: string) => string): string {
  if (usage >= LETTER_A && usage < LETTER_A + 26) return String.fromCharCode(0x41 + usage - LETTER_A);
  if (usage >= DIGIT_1 && usage < DIGIT_1 + 10) return String((usage - DIGIT_1 + 1) % 10);
  if (usage >= F1 && usage < F1 + 12) return `F${usage - F1 + 1}`;
  const named = NAMED_KEYS.find(k => k.usage === usage);
  return named ? t(`${P}key.${named.key}`) : `0x${usage.toString(16).toUpperCase()}`;
}

function encode(b: Pick<MouseButton, 'kind' | 'code' | 'modifiers' | 'raw'>): string {
  return b.kind === 'raw' ? `raw:${b.raw ?? ''}` : `${b.kind}:${b.code}:${b.modifiers}`;
}

function decode(value: string, slot: number): MouseButton {
  const [kind, a, b] = value.split(':');
  if (kind === 'raw') return { slot, kind: 'raw', code: 0, modifiers: 0, raw: a };
  return { slot, kind: kind as MouseButton['kind'], code: Number(a), modifiers: Number(b) };
}

function useActionOptions(state: MouseState): SelectOption[] {
  const { t } = useTranslation();
  return useMemo(() => {
    const specialName = (code: number) => state.specials.find(s => s.code === code)?.name ?? String(code);
    const opts: SelectOption[] = [{ value: 'h-mouse', label: t(`${P}group.mouse`), header: true }];
    for (const m of MOUSE_BUTTONS) opts.push({ value: encode({ kind: 'mouse', code: m.mask, modifiers: 0 }), label: t(`${P}mouse.${m.key}`) });
    opts.push({ value: 'h-special', label: t(`${P}group.functions`), header: true });
    for (const code of OFFERED_SPECIALS) opts.push({ value: encode({ kind: SPECIAL_KIND, code, modifiers: 0 }), label: t(`${P}special.${specialName(code)}`) });
    opts.push({ value: 'h-media', label: t(`${P}group.media`), header: true });
    for (const m of MEDIA) opts.push({ value: encode({ kind: 'consumer', code: m.usage, modifiers: 0 }), label: t(`${P}media.${m.key}`) });
    opts.push({ value: 'h-keys', label: t(`${P}group.keyboard`), header: true });
    const usages = [
      ...Array.from({ length: 26 }, (_, i) => LETTER_A + i),
      ...Array.from({ length: 10 }, (_, i) => DIGIT_1 + i),
      ...Array.from({ length: 12 }, (_, i) => F1 + i),
      ...NAMED_KEYS.map(k => k.usage),
    ];
    for (const u of usages) opts.push({ value: encode({ kind: 'key', code: u, modifiers: 0 }), label: keyName(u, t) });
    return opts;
  }, [state.specials, t]);
}

/** Label for a binding the option list does not carry (a key with modifiers, a macro, a rare function). */
function currentLabel(b: MouseButton, state: MouseState, t: (k: string, v?: Record<string, string>) => string): string {
  if (b.kind === 'key') {
    const mods = [b.modifiers & 1 ? 'Ctrl' : '', b.modifiers & 2 ? 'Shift' : '', b.modifiers & 4 ? 'Alt' : '', b.modifiers & 8 ? 'Win' : '']
      .filter(Boolean);
    return [...mods, keyName(b.code, t)].join('+');
  }
  if (b.kind === SPECIAL_KIND) return t(`${P}special.${state.specials.find(s => s.code === b.code)?.name ?? 'none'}`);
  if (b.kind === 'consumer') return t(`${P}consumerCode`, { code: `0x${b.code.toString(16).toUpperCase()}` });
  return t(`${P}customBinding`);
}

interface ProfileProps { state: MouseState; profile: MouseProfile; change: Change; busy: boolean }

function DpiSection({ profile, change, busy }: ProfileProps) {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [invalid, setInvalid] = useState<number | null>(null);
  const dpiKey = profile.dpi.join(',');
  useEffect(() => { setDrafts({}); setInvalid(null); }, [profile.number, dpiKey]);
  const used = profile.dpi.filter(v => v > 0).length;

  const commit = (index: number, text: string) => {
    const value = Math.round(Number(text) / DPI_STEP) * DPI_STEP;
    if (!Number.isFinite(value) || value < DPI_MIN || value > DPI_MAX) {
      setInvalid(index);
      return;
    }
    setInvalid(null);
    const dpi = profile.dpi.map((v, i) => (i === index ? value : v));
    void change(() => updateMouseProfile(profile.number, { dpi }));
  };
  const levelOptions = Array.from({ length: Math.max(used, 1) }, (_, i) => ({ key: String(i), label: String(i + 1), disabled: busy }));

  return (
    <SettingsSection title={t(`${P}dpi`)} description={t(`${P}dpiHint`, { min: String(DPI_MIN), max: String(DPI_MAX), step: String(DPI_STEP) })} boxClassName={styles.box}>
      {profile.dpi.map((v, i) => (
        <SettingRow key={i} label={t(`${P}level`, { n: String(i + 1) })}>
          <TextInput
            type="number"
            size="sm"
            align="right"
            ariaLabel={t(`${P}level`, { n: String(i + 1) })}
            value={drafts[i] ?? (v > 0 ? String(v) : '')}
            invalid={invalid === i}
            disabled={busy}
            onInput={text => setDrafts(prev => ({ ...prev, [i]: text }))}
            onSubmit={text => commit(i, text)}
            onBlur={text => { if (drafts[i] !== undefined && Number(text) !== v) commit(i, text); }}
          />
        </SettingRow>
      ))}
      <SettingRow label={t(`${P}defaultLevel`)} description={t(`${P}defaultLevelHint`)}>
        <ChipGroup
          ariaLabel={t(`${P}defaultLevel`)}
          options={levelOptions}
          activeKey={String(profile.defaultDpiIndex)}
          onChange={key => { void change(() => updateMouseProfile(profile.number, { defaultDpiIndex: Number(key) })); }}
        />
      </SettingRow>
      <SettingRow label={t(`${P}shiftLevel`)} description={t(`${P}shiftLevelHint`)}>
        <ChipGroup
          ariaLabel={t(`${P}shiftLevel`)}
          options={levelOptions}
          activeKey={String(profile.shiftDpiIndex)}
          onChange={key => { void change(() => updateMouseProfile(profile.number, { shiftDpiIndex: Number(key) })); }}
        />
      </SettingRow>
    </SettingsSection>
  );
}

function ButtonsSection({ state, profile, change, busy }: ProfileProps) {
  const { t } = useTranslation();
  const [layer, setLayer] = useState<Layer>('primary');
  const base = useActionOptions(state);
  const buttons = layer === 'primary' ? profile.buttons : profile.gShiftButtons;

  const set = (slot: number, value: string) => {
    const binding = decode(value, slot);
    const patch: MouseProfilePatch = layer === 'primary' ? { buttons: [binding] } : { gShiftButtons: [binding] };
    void change(() => updateMouseProfile(profile.number, patch));
  };

  return (
    <SettingsSection
      title={t(`${P}buttons`)}
      description={t(`${P}buttonsHint`)}
      boxClassName={styles.box}
      action={(
        <ChipGroup
          ariaLabel={t(`${P}layer`)}
          options={LAYERS.map(l => ({ key: l, label: t(`${P}layer.${l}`) }))}
          activeKey={layer}
          onChange={key => setLayer(key as Layer)}
        />
      )}
    >
      {buttons.map(b => {
        const value = encode(b);
        const options = base.some(o => o.value === value) ? base : [{ value, label: currentLabel(b, state, t) }, ...base];
        const label = state.buttonLabels[b.slot] ?? t(`${P}buttonN`, { n: String(b.slot + 1) });
        return (
          <SettingRow key={`${layer}-${b.slot}`} label={label}>
            <Select ariaLabel={label} value={value} options={options} disabled={busy} onChange={v => set(b.slot, v)} />
          </SettingRow>
        );
      })}
    </SettingsSection>
  );
}

/** The Logitech mouse page: the profiles the mouse keeps in its own memory, as G HUB's onboard memory mode edits them. */
export function LogitechMouseDevicePage() {
  const { t } = useTranslation();
  const { state, loadFailed, failure, busy, change } = useLogitechMouse();
  const [selected, setSelected] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);

  const profiles = state?.profiles ?? [];
  const number = selected ?? state?.activeProfile ?? profiles[0]?.number ?? null;
  const profile = profiles.find(p => p.number === number) ?? null;
  useEffect(() => setNameDraft(null), [profile?.number, profile?.name]);

  // Brand + model name, not translated.
  const title = `Logitech ${state?.model ?? 'G502 X PLUS'}`;

  return (
    <div className={styles.page}>
      <ViewHeader title={title} />
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
          <div className={styles.tab}>
            <SettingsSection
              title={t(`${P}profile`)}
              description={t(`${P}profileHint`)}
              boxClassName={styles.box}
              action={profile.canRestore ? (
                <Button size="sm" icon={<RotateCcw size={14} />} disabled={busy} onClick={() => { void change(() => restoreMouseProfile(profile.number)); }}>
                  {t(`${P}restore`)}
                </Button>
              ) : undefined}
            >
              <SettingRow label={t(`${P}profile`)}>
                <Select
                  ariaLabel={t(`${P}profile`)}
                  value={String(profile.number)}
                  options={profiles.map(p => ({
                    value: String(p.number),
                    label: t(`${P}profileOption`, { n: String(p.number), name: p.name || t(`${P}unnamed`) }),
                    note: p.number === state.activeProfile ? t(`${P}active`) : (p.enabled ? undefined : t(`${P}notInCycle`)),
                  }))}
                  onChange={v => setSelected(Number(v))}
                />
              </SettingRow>
              <SettingRow label={t(`${P}inUse`)} description={t(`${P}inUseHint`)}>
                {profile.number === state.activeProfile
                  ? <span className={styles.active}>{t(`${P}active`)}</span>
                  : <Button size="sm" disabled={busy} onClick={() => { void change(() => setMouseActiveProfile(profile.number)); }}>{t(`${P}useProfile`)}</Button>}
              </SettingRow>
              <SettingRow label={t(`${P}name`)}>
                <TextInput
                  size="sm"
                  maxLength={24}
                  ariaLabel={t(`${P}name`)}
                  value={nameDraft ?? profile.name}
                  placeholder={t(`${P}unnamed`)}
                  disabled={busy}
                  onInput={setNameDraft}
                  onSubmit={text => { void change(() => updateMouseProfile(profile.number, { name: text.trim() })); }}
                  onBlur={text => { if (nameDraft !== null && text.trim() !== profile.name) void change(() => updateMouseProfile(profile.number, { name: text.trim() })); }}
                />
              </SettingRow>
              <SettingRow label={t(`${P}reportRate`)} description={t(`${P}reportRateHint`)}>
                <ChipGroup
                  ariaLabel={t(`${P}reportRate`)}
                  options={[...state.reportRatesHz].sort((a, b) => a - b).map(hz => ({ key: String(hz), label: t(`${P}hz`, { hz: String(hz) }), disabled: busy }))}
                  activeKey={String(profile.reportRateHz)}
                  onChange={key => { void change(() => updateMouseProfile(profile.number, { reportRateHz: Number(key) })); }}
                />
              </SettingRow>
            </SettingsSection>
            <DpiSection state={state} profile={profile} change={change} busy={busy} />
            <ButtonsSection state={state} profile={profile} change={change} busy={busy} />
          </div>
        )}
      </div>
    </div>
  );
}
