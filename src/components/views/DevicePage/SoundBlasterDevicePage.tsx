import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Crosshair, Headphones, Radio, Speaker, Volume2, VolumeX } from 'lucide-react';
import {
  DECODER, PLAYBACK, RECORDING, applySoundBlasterMode, deleteSoundBlasterMode, paramKey, renameSoundBlasterMode,
  saveSoundBlasterMode, setSoundBlasterFeature, setSoundBlasterFilter, setSoundBlasterMicBoost, setSoundBlasterMicEq,
  setSoundBlasterMixer, setSoundBlasterOutput, setSoundBlasterParameter, setSoundBlasterSbx, setSoundBlasterScout,
  setSoundBlasterVoiceMorph,
  type SoundBlasterFeature, type SoundBlasterMixerChannel, type SoundBlasterOutput, type SoundBlasterState,
} from '../../../api/soundBlaster';
import { useTranslation } from '../../../lib/i18n';
import { Button } from '../../common/Button/Button';
import { ChipGroup } from '../../common/ChipGroup/ChipGroup';
import { EmptyState } from '../../common/EmptyState/EmptyState';
import { Notice } from '../../common/Notice/Notice';
import { PresetToolbar } from '../../common/PresetToolbar/PresetToolbar';
import { Select } from '../../common/Select/Select';
import { SettingGroup, SettingRow, SettingSlider, SettingToggle } from '../../common/SettingRow/SettingRow';
import { SettingsSection } from '../../common/SettingsSection/SettingsSection';
import { CurveGraph } from '../../../panel/widgets/cooling/page/CurveEditor';
import type { CurvePoint } from '../../../api/cooling';
import { Spinner } from '../../common/Spinner/Spinner';
import { ViewHeader } from '../../common/ViewHeader/ViewHeader';
import { useSoundBlaster } from './useSoundBlaster';
import { dbLabel, hzLabel } from './speakerUtils';
import styles from './SoundBlasterDevicePage.module.scss';

type Change = (call: () => Promise<SoundBlasterState | null>) => Promise<boolean>;
interface TabProps { state: SoundBlasterState; change: Change }

const P = 'devices.soundBlaster.';

// Playback parameters (Creative's MalcolmPlaybackManagerCommand).
const SURROUND = 0x00, SURROUND_LEVEL = 0x01, DIALOG = 0x02, DIALOG_LEVEL = 0x03;
const SMART_VOLUME = 0x04, SMART_VOLUME_LEVEL = 0x05, SMART_VOLUME_MODE = 0x06;
const CRYSTALIZER = 0x07, CRYSTALIZER_LEVEL = 0x08, EQ = 0x09, PREAMP = 0x0a, BAND0 = 0x0b;
const CROSSOVER = 0x17, BASS = 0x18, BASS_LEVEL = 0x19;
// Recording parameters (MalcolmVoiceInputManagerCommand) and the decoder's dynamic range.
const ECHO = 0x00, NOISE = 0x04, NOISE_LEVEL = 0x05, VOICE_FX = 0x0a, MIC_EQ = 0x13, MIC_SVM = 0x2c, MIC_SVM_LEVEL = 0x2d, RANGE = 0x02;

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
// The G8's five DAC filters, in its numbering (Creative App's names for them).
const FILTER_NAMES = 5;
// The preset toolbar needs a cap; the service keeps any number of modes.
const MODE_LIMIT = 99;
// Windows' names for the card's endpoints, and the words shown for them.
// Firmware 1.2 names them like the G6 (External Mic, Line In, SPDIF In, What U Hear); 1.0 used the others.
const CHANNELS: Record<string, string> = {
  Speakers: 'chSpeakers', Microphone: 'chMicrophone', 'External Mic': 'chMicrophone', Line: 'chLine', 'Line In': 'chLine',
  'SPDIF Interface': 'chSpdif', 'SPDIF In': 'chSpdif', 'Digital Audio Interface': 'chDigital', 'What U Hear': 'chWhatUHear',
};

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

/** While Scout Mode or Direct Mode holds the effects: the sections under it blurred, with a way out on top. */
function Veil({ mode, onOff, children }: { mode: 'scout' | 'direct' | null; onOff: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  const active = mode !== null;
  return (
    <div className={styles.veilWrap}>
      <div className={active ? `${styles.veilContent} ${styles.veiled}` : styles.veilContent} aria-hidden={active || undefined}>
        {children}
      </div>
      {active && (
        <div className={styles.veil}>
          <div className={styles.veilCard} role="status">
            {mode === 'direct' ? <Radio size={22} className={styles.veilIcon} aria-hidden /> : <Crosshair size={22} className={styles.veilIcon} aria-hidden />}
            <span className={styles.veilTitle}>{t(mode === 'direct' ? `${P}directVeilTitle` : `${P}scoutVeilTitle`)}</span>
            <span className={styles.veilBody}>{t(mode === 'direct' ? `${P}directVeilBody` : `${P}scoutVeilBody`)}</span>
            <Button size="sm" onClick={onOff}>{t(mode === 'direct' ? `${P}directOff` : `${P}scoutOff`)}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A device feature switch, shown only when the device has the feature. */
function FeatureToggle({ state, change, name, label, description, nested }: TabProps & {
  name: SoundBlasterFeature; label: string; description?: string; nested?: boolean;
}) {
  const on = state.features[name];
  if (on === undefined) return null;
  return (
    <SettingToggle
      label={label}
      description={description}
      checked={on}
      nested={nested}
      onChange={next => { void change(() => setSoundBlasterFeature(name, next)); }}
    />
  );
}

/** The modes saved in Nexus: the playback settings by name, applied from the list. */
function ModesSection({ state, change }: TabProps) {
  const { t } = useTranslation();
  return (
    <SettingsSection title={t(`${P}modes`)} description={t(`${P}modesHint`)} boxClassName={styles.box}>
      <SettingRow label={t(`${P}mode`)}>
        <PresetToolbar
          showHistory={false}
          translationPrefix="cooling.presets"
          cap={MODE_LIMIT}
          presetCount={state.modes.length}
          presets={state.modes.map(m => ({ id: m, name: m }))}
          activeId={state.activeMode ?? null}
          presetsHeader={t(`${P}modesSaved`)}
          inlineSave={{ label: t(`${P}modeSave`), disabled: !!state.activeMode }}
          onLoad={id => { void change(() => applySoundBlasterMode(id)); }}
          onCreate={async name => ((await change(() => saveSoundBlasterMode(name.trim()))) ? { error: false } : { error: true, msg: t(`${P}failed`) })}
          onRename={(id, name) => { if (name.trim() && name.trim() !== id) void change(() => renameSoundBlasterMode(id, name.trim())); }}
          onDelete={id => { void change(() => deleteSoundBlasterMode(id)); }}
        />
      </SettingRow>
    </SettingsSection>
  );
}

function PlaybackSections({ state, change }: TabProps) {
  const { t } = useTranslation();
  // The G8 ties SBX to the effects itself (an effect turned on turns SBX on, the last one off turns it off),
  // so the switches stay usable with SBX off. Only Scout Mode and Direct Mode hold them.
  const direct = state.features.directMode === true;
  const veil = direct ? 'direct' : state.scout ? 'scout' : null;
  const off = veil !== null;
  const eqOn = val(state, PLAYBACK, EQ) >= 0.5;
  const bands = BAND_HZ.map((_, i) => val(state, PLAYBACK, BAND0 + i));
  const flatten = async () => {
    for (let i = 0; i < BAND_HZ.length; i++) {
      if (bands[i] !== 0 && !(await change(() => setSoundBlasterParameter(PLAYBACK, BAND0 + i, 0)))) return;
    }
  };

  return (
    <>
      <ModesSection state={state} change={change} />

      <SettingsSection title={t(`${P}listening`)} boxClassName={styles.box}>
        <SettingToggle
          label={t(`${P}scout`)}
          description={t(`${P}scoutHint`)}
          checked={state.scout}
          disabled={direct}
          onChange={on => { void change(() => setSoundBlasterScout(on)); }}
        />
        <FeatureToggle state={state} change={change} name="directMode" label={t(`${P}directMode`)} description={t(`${P}directModeHint`)} />
      </SettingsSection>

      <Veil
        mode={veil}
        onOff={() => { void change(() => (direct ? setSoundBlasterFeature('directMode', false) : setSoundBlasterScout(false))); }}
      >
        <SettingsSection title={t(`${P}acoustic`)} description={t(`${P}acousticHint`)} boxClassName={styles.box}>
          <SettingToggle
            label={t(`${P}sbx`)}
            description={t(`${P}sbxHint`)}
            checked={state.sbx}
            disabled={off}
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
      </Veil>

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
              options={state.dacFilters.map(f => ({ key: String(f), label: f >= 1 && f <= FILTER_NAMES ? t(`${P}filter${f}`) : t(`${P}filter`, { n: f }) }))}
              activeKey={String(state.dacFilter ?? '')}
              onChange={f => { void change(() => setSoundBlasterFilter(Number(f))); }}
            />
          </SettingRow>
        )}
        {state.output === 'speakers' && (
          <FeatureToggle state={state} change={change} name="speakerVirtualization" label={t(`${P}speakerVirtualization`)} description={t(`${P}speakerVirtualizationHint`)} />
        )}
        <FeatureToggle state={state} change={change} name="spdifDirect" label={t(`${P}spdifDirect`)} description={t(`${P}spdifDirectHint`)} />
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

function MicrophoneSections({ state, change }: TabProps) {
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
        {has(state, RECORDING, VOICE_FX) && (
          <SettingGroup>
            {toggle(VOICE_FX, t(`${P}voiceMorph`), t(`${P}voiceMorphHint`))}
            <SettingRow label={t(`${P}character`)} nested disabled={!on(VOICE_FX)}>
              <Select
                ariaLabel={t(`${P}character`)}
                value={state.voiceMorph ?? ''}
                placeholder={t(`${P}custom`)}
                disabled={!on(VOICE_FX)}
                options={state.voicePresets.map(p => ({ value: p.id, label: p.name }))}
                onChange={id => { void change(() => setSoundBlasterVoiceMorph(id)); }}
              />
            </SettingRow>
          </SettingGroup>
        )}
        {has(state, RECORDING, MIC_EQ) && (
          <SettingGroup>
            {toggle(MIC_EQ, t(`${P}micEq`), t(`${P}micEqHint`))}
            <SettingRow label={t(`${P}micEqPreset`)} nested disabled={!on(MIC_EQ)}>
              <Select
                ariaLabel={t(`${P}micEqPreset`)}
                value={state.micEq ?? ''}
                placeholder={t(`${P}custom`)}
                disabled={!on(MIC_EQ)}
                options={state.micEqPresets.map(p => ({ value: p.id, label: p.name }))}
                onChange={id => { void change(() => setSoundBlasterMicEq(id)); }}
              />
            </SettingRow>
          </SettingGroup>
        )}
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

/** One endpoint's Windows volume: a slider, with its mute beside the name. */
function MixerRow({ channel, change }: { channel: SoundBlasterMixerChannel; change: Change }) {
  const { t } = useTranslation();
  const [drag, setDrag] = useState<number | null>(null);
  const word = CHANNELS[channel.name];
  const label = word ? t(`${P}${word}`) : channel.name;
  return (
    <SettingSlider
      label={label}
      description={t(channel.direction === 'playback' ? `${P}playbackChannel` : `${P}recordingChannel`)}
      editable
      trackFill
      min={0}
      max={100}
      formatValue={pct}
      disabled={channel.muted}
      value={drag ?? Math.round(channel.volume * 100)}
      labelSuffix={(
        <button
          type="button"
          className={styles.mute}
          aria-pressed={channel.muted}
          aria-label={t(channel.muted ? `${P}unmute` : `${P}mute`, { name: label })}
          onClick={() => { void change(() => setSoundBlasterMixer(channel.id, { muted: !channel.muted })); }}
        >
          {channel.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      )}
      onChange={v => setDrag(v)}
      onCommit={v => { void change(() => setSoundBlasterMixer(channel.id, { volume: v / 100 })).then(() => setDrag(cur => (cur === v ? null : cur))); }}
    />
  );
}

function MixerSection({ state, change }: TabProps) {
  const { t } = useTranslation();
  if (state.mixer.length === 0) return null;
  return (
    <SettingsSection title={t(`${P}mixer`)} description={t(`${P}mixerHint`)} boxClassName={styles.box}>
      {state.mixer.map(c => <MixerRow key={c.id} channel={c} change={change} />)}
    </SettingsSection>
  );
}

function DeviceSection({ state, change }: TabProps) {
  const { t } = useTranslation();
  const names: SoundBlasterFeature[] = ['logoLed', 'energySaving', 'volumeSync'];
  if (!names.some(n => state.features[n] !== undefined)) return null;
  return (
    <SettingsSection title={t(`${P}device`)} boxClassName={styles.box}>
      <FeatureToggle state={state} change={change} name="logoLed" label={t(`${P}logoLed`)} />
      <FeatureToggle state={state} change={change} name="energySaving" label={t(`${P}energySaving`)} description={t(`${P}energySavingHint`)} />
      <FeatureToggle state={state} change={change} name="volumeSync" label={t(`${P}volumeSync`)} description={t(`${P}volumeSyncHint`)} />
    </SettingsSection>
  );
}

/** A Creative Sound Blaster (G8, G6): Creative App's Scout Mode, acoustic engine, equalizer, output and microphone, one under the other. */
export function SoundBlasterDevicePage() {
  const { t } = useTranslation();
  const { state, loadFailed, failure, change } = useSoundBlaster();

  return (
    <div className={styles.page}>
      <ViewHeader
        // eslint-disable-next-line i18next/no-literal-string -- brand + model name
        title={state?.name ?? 'Creative Sound Blaster'}
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
            <PlaybackSections state={state} change={change} />
            <MicrophoneSections state={state} change={change} />
            <MixerSection state={state} change={change} />
            <DeviceSection state={state} change={change} />
            {state.firmware && <p className={styles.meta}>{t(`${P}firmware`, { version: state.firmware })}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
