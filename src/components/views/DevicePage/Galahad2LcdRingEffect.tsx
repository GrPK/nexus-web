import { useCallback, useEffect, useRef, useState } from 'react';
import { HsvPicker } from '../../common/HsvPicker/HsvPicker';
import { SettingSelect, SettingSlider } from '../../common/SettingRow/SettingRow';
import { SettingsSection } from '../../common/SettingsSection/SettingsSection';
import {
  getGalahad2LcdRingEffect,
  setGalahad2LcdRingEffect,
  type Galahad2LcdRingEffectSpec,
} from '../../../api/lianli-galahad2-lcd';
import { useTranslation } from '../../../lib/i18n';
import lianli from './LianLiDevicePage.module.scss';
import styles from './Galahad2LcdRingEffect.module.scss';

const SPEED_KEYS = ['slowest', 'slower', 'normal', 'faster', 'fastest'];
const DEFAULT_COLOR = '#ff0000';

interface Draft {
  effect: string;
  speed: number;
  brightness: number;
  colors: string[];
}

/** Trims or tops up the color list to exactly what the animation reads. */
export function fitColors(colors: string[], count: number): string[] {
  const next = colors.slice(0, count);
  while (next.length < count) next.push(DEFAULT_COLOR);
  return next;
}

/**
 * The animations the pump ring plays on its own. The panel cannot report what it plays,
 * so the values shown are the last write Nexus made. Every change is written at once.
 */
export function Galahad2LcdRingEffectSection() {
  const { t } = useTranslation();
  const [effects, setEffects] = useState<Galahad2LcdRingEffectSpec[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [nexusDriven, setNexusDriven] = useState(false);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    void (async () => {
      const data = await getGalahad2LcdRingEffect();
      if (!aliveRef.current || data === null || !data.isConnected || data.effects.length === 0) return;
      const spec = data.effects.find(e => e.id === data.effect) ?? data.effects[0];
      setEffects(data.effects);
      setNexusDriven(data.nexusDriven);
      setDraft({
        effect: spec.id,
        speed: data.speed,
        brightness: data.brightness,
        colors: fitColors(data.colors, spec.colors),
      });
    })();
    return () => { aliveRef.current = false; };
  }, []);

  const apply = useCallback(async (next: Draft) => {
    setDraft(next);
    setFailed(false);
    const ok = await setGalahad2LcdRingEffect(next);
    if (!aliveRef.current || ok !== null) return;
    // A refusal usually means the ring was handed to Nexus lighting meanwhile, so re-read
    // that flag and only report a failure when the ring is still free to take the write.
    const fresh = await getGalahad2LcdRingEffect();
    if (!aliveRef.current) return;
    if (fresh?.nexusDriven) setNexusDriven(true);
    else setFailed(true);
  }, []);

  const effectLabel = (id: string) => (id === 'breathing' ? t('devices.fwAnimation.breathing') : t(`devices.galahad2Ring.${id}`));
  if (!draft) return null;
  const spec = effects.find(e => e.id === draft.effect) ?? effects[0];
  if (!spec) return null;
  const activeIndex = Math.min(active, Math.max(spec.colors - 1, 0));

  const setColor = (hex: string, commit: boolean) => {
    const colors = [...draft.colors];
    colors[activeIndex] = hex;
    if (commit) void apply({ ...draft, colors });
    else setDraft({ ...draft, colors });
  };

  return (
    <SettingsSection
      title={t('devices.q60.lightingFirmwareSection')}
      boxClassName={lianli.sectionBox}
      description={<p>{t('devices.q60.lightingFirmwareHelp')}</p>}
    >
      <div className={styles.block}>
        <SettingSelect
          label={t('devices.fwAnimation.effect')}
          value={draft.effect}
          disabled={nexusDriven}
          onChange={v => {
            const next = effects.find(e => e.id === v);
            if (!next) return;
            setActive(0);
            void apply({ ...draft, effect: v, colors: fitColors(draft.colors, next.colors) });
          }}
          options={effects.map(e => ({ value: e.id, label: effectLabel(e.id) }))}
        />

        <SettingSlider
          editable
          trackFill
          disabled={nexusDriven}
          label={t('devices.lianli.lightingSpeed')}
          value={draft.speed}
          min={0}
          max={4}
          step={1}
          formatValue={v => t(`devices.nzxt-kraken.speed.${SPEED_KEYS[Math.round(v)] ?? 'normal'}`)}
          ariaLabel={t('devices.lianli.lightingSpeedAria')}
          onChange={(v: number) => { setDraft({ ...draft, speed: Math.round(v) }); }}
          onCommit={(v: number) => { void apply({ ...draft, speed: Math.round(v) }); }}
        />

        <SettingSlider
          editable
          trackFill
          disabled={nexusDriven}
          label={t('devices.lianli.lightingBrightness')}
          value={draft.brightness}
          min={0}
          max={4}
          step={1}
          ariaLabel={t('devices.lianli.lightingBrightnessAria')}
          onChange={(v: number) => { setDraft({ ...draft, brightness: Math.round(v) }); }}
          onCommit={(v: number) => { void apply({ ...draft, brightness: Math.round(v) }); }}
        />

        {spec.colors > 0 && !nexusDriven && (
          <>
            <div className={styles.swatchRow}>
              {draft.colors.map((hex, i) => (
                <button
                  key={i}
                  type="button"
                  className={`${styles.swatch} ${i === activeIndex ? styles.swatchActive : ''}`}
                  style={{ background: hex }}
                  aria-label={t('devices.nzxt-kraken.colorSlot', { n: i + 1 })}
                  aria-pressed={i === activeIndex}
                  onClick={() => { setActive(i); }}
                />
              ))}
            </div>
            <div className={lianli.colorBlock} data-settings-aside="true">
              <HsvPicker
                value={draft.colors[activeIndex] ?? DEFAULT_COLOR}
                onPreview={(hex: string) => { setColor(hex, false); }}
                onCommit={(hex: string) => { setColor(hex, true); }}
              />
            </div>
          </>
        )}

        {failed && (
          <p className={lianli.customNote} data-settings-aside="true">
            {t('devices.galahad2Ring.failed')}
          </p>
        )}

        {nexusDriven && (
          <p className={lianli.customNote} data-settings-aside="true">
            {t('devices.galahad2Ring.overridden')}
          </p>
        )}
      </div>
    </SettingsSection>
  );
}
