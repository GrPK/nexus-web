import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Headphones, Mic, Music, Speaker } from 'lucide-react';
import {
  DECODER, PLAYBACK, RECORDING, paramKey, setSoundBlasterFilter, setSoundBlasterMicBoost, setSoundBlasterOutput,
  setSoundBlasterParameter, setSoundBlasterSbx, setSoundBlasterScout,
  type SoundBlasterOutput, type SoundBlasterState,
} from '../../../api/soundBlaster';
import { useTranslation } from '../../../lib/i18n';
import { Button } from '../../common/Button/Button';
import { ChipGroup } from '../../common/ChipGroup/ChipGroup';
import { EmptyState } from '../../common/EmptyState/EmptyState';
import { Notice } from '../../common/Notice/Notice';
import { SettingGroup, SettingRow, SettingSlider, SettingToggle } from '../../common/SettingRow/SettingRow';
import { SettingsSection } from '../../common/SettingsSection/SettingsSection';
import { CurveGraph } from '../../../panel/widgets/cooling/page/CurveEditor';
import type { CurvePoint } from '../../../api/cooling';
import { Spinner } from '../../common/Spinner/Spinner';
import { ViewHeader } from '../../common/ViewHeader/ViewHeader';
import { useSoundBlaster } from './useSoundBlaster';
import { dbLabel, hzLabel } from './speakerUtils';
import styles from './SoundBlasterDevicePage.module.scss';

type Tab = 'playback' | 'microphone';
type Change = (call: () => Promise<SoundBlasterState | null>) => Promise<boolean>;
interface TabProps { state: SoundBlasterState; change: Change }

const P = 'devices.soundBlaster.';
const TABS: readonly { key: Tab; icon: ReactNode }[] = [
  { key: 'playback', icon: <Music size={14} /> },
  { key: 'microphone', icon: <Mic size={14} /> },
];

// Playback parameters (Creative's MalcolmPlaybackManagerCommand).
const SURROUND = 0x00, SURROUND_LEVEL = 0x01, DIALOG = 0x02, DIALOG_LEVEL = 0x03;
const SMART_VOLUME = 0x04, SMART_VOLUME_LEVEL = 0x05, SMART_VOLUME_MODE = 0x06;
const CRYSTALIZER = 0x07, CRYSTALIZER_LEVEL = 0x08, EQ = 0x09, PREAMP = 0x0a, BAND0 = 0x0b;
const CROSSOVER = 0x17, BASS = 0x18, BASS_LEVEL = 0x19;
// Recording parameters (MalcolmVoiceInputManagerCommand) and the decoder's dynamic range.
const ECHO = 0x00, NOISE = 0x04, NOISE_LEVEL = 0x05, MIC_SVM = 0x2c, MIC_SVM_LEVEL = 0x2d, RANGE = 0x02;

// The G8 reports these ranges itself: pre-amp ±6 dB, bands ±12 dB, crossover 10 to 300 Hz.
const BAND_HZ = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const BAND_DB = 12;
const PREAMP_DB = 6;
const DB_STEP = 0.5;
const CROSSOVER_MIN = 10;
const CROSSOVER_MAX = 300;
const GRAPH_H = 220;
const EASING = 'smooth';
const SVM_MODES = ['normal', 'loud', 'night'] as const;
// Creative's dynamic range values: 1 full, 2 normal, 3 night.
const RANGES = [{ key: '1', label: 'full' }, { key: '2', label: 'normal' }, { key: '3', label: 'night' }] as const;
const BOOSTS = [0, 10, 20, 30];

const pct = (v: number) => `${Math.round(v)}%`;

/** A parameter's value, 0 when the device did not answer for it. */
const val = (state: SoundBlasterState, family: number, id: number) => state.values[paramKey(family, id)] ?? 0;
const has = (state: SoundBlasterState, family: number, id: number) => paramKey(family, id) in state.values;

/** A slider that shows its own value while dragged and sends one write on release. */
function ParamSlider({ state, change, family, id, label, min, max, step, scale = 1, format, disabled, nested }: TabProps & {
  family: number; id: number; label: string; min: number; max: number; step?: number;
  /** The slider shows value × scale (levels 0..1 as 0..100 %). */
  scale?: number; format: (v: number) => string; disabled?: boolean; nested?: boolean;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  if (!has(state, family, id)) return null;
  return (
    <SettingSlider
      label={label}
      nested={nested}
      editable
      trackFill
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      formatValue={format}
      value={drag ?? Math.round(val(state, family, id) * scale / (step ?? 1)) * (step ?? 1)}
      onChange={v => setDrag(v)}
      onCommit={v => {
        void change(() => setSoundBlasterParameter(family, id, v / scale)).then(() => setDrag(cur => (cur === v ? null : cur)));
      }}
    />
  );
}

/** An effect: its switch, then its level under it. */
function Effect({ state, change, label, description, on, level, disabled, children }: TabProps & {
  label: string; description?: string; on: number; level?: number; disabled: boolean; children?: ReactNode;
}) {
  const { t } = useTranslation();
  if (!has(state, PLAYBACK, on)) return null;
  const enabled = val(state, PLAYBACK, on) >= 0.5;
  return (
    <SettingGroup>
      <SettingToggle
        label={label}
        description={description}
        checked={enabled}
        disabled={disabled}
        onChange={next => { void change(() => setSoundBlasterParameter(PLAYBACK, on, next ? 1 : 0)); }}
      />
      {level !== undefined && (
        <ParamSlider
          state={state}
          change={change}
          family={PLAYBACK}
          id={level}
          nested
          label={t(`${P}level`)}
          min={0}
          max={100}
          scale={100}
          format={pct}
          disabled={disabled || !enabled}
        />
      )}
      {children}
    </SettingGroup>
  );
}

function EqBands({ state, change, disabled }: TabProps & { disabled: boolean }) {
  const { t } = useTranslation();
  const bands = BAND_HZ.map((_, i) => val(state, PLAYBACK, BAND0 + i));
  const [live, setLive] = useState<Record<number, number>>({});
  const moved = useRef<number | null>(null);
  const key = bands.join(',');
  // A new reading from the device replaces what was shown while a band waited for its answer.
  useEffect(() => setLive({}), [key]);

  const shown = bands.map((b, i) => live[i] ?? b);
  const points = shown.map((speed, temp) => ({ temp, speed }));
  const axis = {
    xTicks: BAND_HZ.map((_, i) => i),
    formatX: (v: number) => hzLabel(BAND_HZ[v] ?? 0),
    xName: t('lighting.studio.param.frequency'),
    yName: t('lighting.studio.param.gain'),
  };
  const yAxis = {
    min: -BAND_DB, max: BAND_DB, step: DB_STEP, lines: [0],
    labels: [{ value: BAND_DB, label: dbLabel(BAND_DB) }, { value: -BAND_DB, label: dbLabel(-BAND_DB) }],
    formatValue: dbLabel,
  };
  const drag = useMemo(() => ({
    isLocked: () => disabled,
    apply: (pts: CurvePoint[], index: number, value: number) => {
      moved.current = index;
      return pts.map((pt, i) => (i === index ? { ...pt, speed: value } : pt));
    },
  }), [disabled]);

  return (
    <CurveGraph
      points={points}
      height={GRAPH_H}
      tempMin={-0.5}
      tempMax={BAND_HZ.length - 0.5}
      editable={!disabled}
      easing={EASING}
      axis={axis}
      yAxis={yAxis}
      verticalDrag={drag}
      keyboardStep={DB_STEP}
      onPreview={next => {
        const i = moved.current;
        if (i !== null) setLive(prev => ({ ...prev, [i]: next[i].speed }));
      }}
      onCancel={() => {
        const i = moved.current;
        moved.current = null;
        if (i !== null) setLive(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => Number(k) !== i)));
      }}
      onChange={next => {
        const i = moved.current;
        moved.current = null;
        if (i === null) return;
        const db = next[i].speed;
        setLive(prev => ({ ...prev, [i]: db }));
        void change(() => setSoundBlasterParameter(PLAYBACK, BAND0 + i, db));
      }}
    />
  );
}

function PlaybackTab({ state, change }: TabProps) {
  const { t } = useTranslation();
  // Scout Mode takes the SBX processing over; the effects wait until it is off.
  const off = !state.sbx || state.scout;
  const eqOn = val(state, PLAYBACK, EQ) >= 0.5;
  const bands = BAND_HZ.map((_, i) => val(state, PLAYBACK, BAND0 + i));
  const flatten = async () => {
    for (let i = 0; i < BAND_HZ.length; i++) {
      if (bands[i] !== 0 && !(await change(() => setSoundBlasterParameter(PLAYBACK, BAND0 + i, 0)))) return;
    }
  };

  return (
    <>
      <SettingsSection title={t(`${P}acoustic`)} description={t(`${P}acousticHint`)} boxClassName={styles.box}>
        <SettingToggle
          label={t(`${P}sbx`)}
          checked={state.sbx}
          disabled={state.scout}
          onChange={on => { void change(() => setSoundBlasterSbx(on)); }}
        />
        <Effect state={state} change={change} label={t(`${P}surround`)} description={t(`${P}surroundHint`)} on={SURROUND} level={SURROUND_LEVEL} disabled={off} />
        <Effect state={state} change={change} label={t(`${P}crystalizer`)} description={t(`${P}crystalizerHint`)} on={CRYSTALIZER} level={CRYSTALIZER_LEVEL} disabled={off} />
        <Effect state={state} change={change} label={t(`${P}bass`)} description={t(`${P}bassHint`)} on={BASS} level={BASS_LEVEL} disabled={off}>
          <ParamSlider
            state={state}
            change={change}
            family={PLAYBACK}
            id={CROSSOVER}
            nested
            label={t(`${P}crossover`)}
            min={CROSSOVER_MIN}
            max={CROSSOVER_MAX}
            step={1}
            format={hzLabel}
            disabled={off || val(state, PLAYBACK, BASS) < 0.5}
          />
        </Effect>
        <Effect state={state} change={change} label={t(`${P}smartVolume`)} description={t(`${P}smartVolumeHint`)} on={SMART_VOLUME} level={SMART_VOLUME_LEVEL} disabled={off}>
          {has(state, PLAYBACK, SMART_VOLUME_MODE) && (
            <SettingRow label={t(`${P}mode`)} nested disabled={off || val(state, PLAYBACK, SMART_VOLUME) < 0.5}>
              <ChipGroup
                ariaLabel={t(`${P}mode`)}
                options={SVM_MODES.map((m, i) => ({
                  key: String(i), label: t(`${P}${m}`), disabled: off || val(state, PLAYBACK, SMART_VOLUME) < 0.5,
                }))}
                activeKey={String(Math.round(val(state, PLAYBACK, SMART_VOLUME_MODE)))}
                onChange={k => { void change(() => setSoundBlasterParameter(PLAYBACK, SMART_VOLUME_MODE, Number(k))); }}
              />
            </SettingRow>
          )}
        </Effect>
        <Effect state={state} change={change} label={t(`${P}dialog`)} description={t(`${P}dialogHint`)} on={DIALOG} level={DIALOG_LEVEL} disabled={off} />
      </SettingsSection>

      <SettingsSection
        title={t(`${P}equalizer`)}
        boxClassName={styles.box}
        action={(
          <Button size="sm" disabled={off || !eqOn || bands.every(b => b === 0)} onClick={() => { void flatten(); }}>
            {t(`${P}flat`)}
          </Button>
        )}
      >
        <SettingToggle
          label={t(`${P}equalizerOn`)}
          checked={eqOn}
          disabled={off}
          onChange={on => { void change(() => setSoundBlasterParameter(PLAYBACK, EQ, on ? 1 : 0)); }}
        />
        <ParamSlider
          state={state}
          change={change}
          family={PLAYBACK}
          id={PREAMP}
          label={t(`${P}preamp`)}
          min={-PREAMP_DB}
          max={PREAMP_DB}
          step={DB_STEP}
          format={dbLabel}
          disabled={off || !eqOn}
        />
        <EqBands state={state} change={change} disabled={off || !eqOn} />
      </SettingsSection>

      <SettingsSection title={t(`${P}scout`)} boxClassName={styles.box}>
        <SettingToggle
          label={t(`${P}scout`)}
          description={t(`${P}scoutHint`)}
          checked={state.scout}
          onChange={on => { void change(() => setSoundBlasterScout(on)); }}
        />
      </SettingsSection>

      <SettingsSection title={t(`${P}output`)} boxClassName={styles.box}>
        {state.outputs.length > 0 && (
          <SettingRow label={t(`${P}outputTo`)}>
            <ChipGroup
              ariaLabel={t(`${P}outputTo`)}
              options={state.outputs.map(o => ({
                key: o,
                label: <span className={styles.chip}>{o === 'headphones' ? <Headphones size={14} /> : <Speaker size={14} />}{t(`${P}${o}`)}</span>,
              }))}
              activeKey={state.output ?? ''}
              onChange={o => { void change(() => setSoundBlasterOutput(o as SoundBlasterOutput)); }}
            />
          </SettingRow>
        )}
        {state.dacFilters.length > 0 && (
          <SettingRow label={t(`${P}dacFilter`)} description={t(`${P}dacFilterHint`)}>
            <ChipGroup
              ariaLabel={t(`${P}dacFilter`)}
              options={state.dacFilters.map(f => ({ key: String(f), label: t(`${P}filter`, { n: f }) }))}
              activeKey={String(state.dacFilter ?? '')}
              onChange={f => { void change(() => setSoundBlasterFilter(Number(f))); }}
            />
          </SettingRow>
        )}
        {has(state, DECODER, RANGE) && (
          <SettingRow label={t(`${P}dynamicRange`)} description={t(`${P}dynamicRangeHint`)}>
            <ChipGroup
              ariaLabel={t(`${P}dynamicRange`)}
              options={RANGES.map(r => ({ key: r.key, label: t(`${P}${r.label}`) }))}
              activeKey={String(Math.round(val(state, DECODER, RANGE)))}
              onChange={k => { void change(() => setSoundBlasterParameter(DECODER, RANGE, Number(k))); }}
            />
          </SettingRow>
        )}
      </SettingsSection>
    </>
  );
}

function MicrophoneTab({ state, change }: TabProps) {
  const { t } = useTranslation();
  const on = (id: number) => val(state, RECORDING, id) >= 0.5;
  const toggle = (id: number, label: string, description?: string) => has(state, RECORDING, id) && (
    <SettingToggle
      label={label}
      description={description}
      checked={on(id)}
      onChange={next => { void change(() => setSoundBlasterParameter(RECORDING, id, next ? 1 : 0)); }}
    />
  );

  return (
    <>
      <SettingsSection title={t(`${P}microphone`)} boxClassName={styles.box}>
        {state.micBoost !== undefined && (
          <SettingRow label={t(`${P}micBoost`)} description={t(`${P}micBoostHint`)}>
            <ChipGroup
              ariaLabel={t(`${P}micBoost`)}
              options={BOOSTS.map(db => ({ key: String(db), label: `+${db} dB` }))}
              activeKey={String(state.micBoost)}
              onChange={k => { void change(() => setSoundBlasterMicBoost(Number(k))); }}
            />
          </SettingRow>
        )}
      </SettingsSection>

      <SettingsSection title={t(`${P}voice`)} description={t(`${P}voiceHint`)} boxClassName={styles.box}>
        <SettingGroup>
          {toggle(NOISE, t(`${P}noiseReduction`), t(`${P}noiseReductionHint`))}
          <ParamSlider
            state={state}
            change={change}
            family={RECORDING}
            id={NOISE_LEVEL}
            nested
            label={t(`${P}level`)}
            min={0}
            max={100}
            scale={100}
            format={pct}
            disabled={!on(NOISE)}
          />
        </SettingGroup>
        {toggle(ECHO, t(`${P}echo`), t(`${P}echoHint`))}
        <SettingGroup>
          {toggle(MIC_SVM, t(`${P}micSmartVolume`), t(`${P}micSmartVolumeHint`))}
          <ParamSlider
            state={state}
            change={change}
            family={RECORDING}
            id={MIC_SVM_LEVEL}
            nested
            label={t(`${P}level`)}
            min={0}
            max={100}
            scale={100}
            format={pct}
            disabled={!on(MIC_SVM)}
          />
        </SettingGroup>
      </SettingsSection>
    </>
  );
}

/** A Creative Sound Blaster (G8, G6): Creative App's acoustic engine, equalizer, Scout Mode, output and microphone. */
export function SoundBlasterDevicePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('playback');
  const { state, loadFailed, failure, change } = useSoundBlaster();

  return (
    <div className={styles.page}>
      <ViewHeader
        // eslint-disable-next-line i18next/no-literal-string -- brand + model name
        title={state?.name ?? 'Creative Sound Blaster'}
        tabs={state?.present ? TABS.map(({ key, icon }) => ({ key, icon, label: t(`${P}${key}`) })) : undefined}
        activeTab={tab}
        onTabChange={key => setTab(key as Tab)}
      />
      <div className={styles.body}>
        {failure && <Notice tone="critical" role="alert">{t(failure)}</Notice>}
        {loadFailed && !state && <Notice tone="critical" role="alert">{t(`${P}loadFailed`)}</Notice>}
        {!state && !loadFailed && <div className={styles.loading}><Spinner size={28} /></div>}
        {state && !state.present && (
          <EmptyState icon={<Speaker size={40} />} title={t(`${P}notFound`)} hint={t(`${P}notFoundHint`)} />
        )}
        {state?.present && (
          <div className={styles.tab}>
            {tab === 'microphone' ? <MicrophoneTab state={state} change={change} /> : <PlaybackTab state={state} change={change} />}
            {state.firmware && <p className={styles.meta}>{t(`${P}firmware`, { version: state.firmware })}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
