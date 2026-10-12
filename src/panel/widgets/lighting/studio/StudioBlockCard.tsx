import { useEffect, useState } from 'react';
import { AudioLines, GripVertical, Pin, X } from 'lucide-react';
import type { AudioSnapshot } from '../../../../hooks/useAudioState';
import { Card } from '../../../../components/common/Card/Card';
import { Select } from '../../../../components/common/Select/Select';
import { Slider } from '../../../../components/common/Slider/Slider';
import { Button } from '../../../../components/common/Button/Button';
import { HoverTooltip } from '../../../../components/common/HoverTooltip/HoverTooltip';
import { ColorPickerWithPresets } from '../../../../components/common/ColorPickerWithPresets/ColorPickerWithPresets';
import type { SortableRowArgs } from '../../../../components/common/SortableList/SortableList';
import { useTranslation } from '../../../../lib/i18n';
import { blocksForStage, type StudioBlockDef, type StudioParam } from './studioBlocks';
import { STUDIO_MOD_SOURCES, blockParams, type StudioBlock, type StudioModSource } from './studioCompiler';
import styles from './ShaderStudio.module.scss';

const STACKED = 'stacked' as const;
const INLINE = 'inline' as const;

// How often a modulated slider's live marker follows the music.
const LIVE_AUDIO_MS = 66;

type Levels = Partial<Record<StudioModSource, number>>;

/** The current level of each of `sources`, sampled while there are any; null when silent. Re-renders only when a level moves. */
function useLiveLevels(audioRef: React.RefObject<AudioSnapshot | null> | undefined, sources: readonly StudioModSource[]): Levels | null {
  const [levels, setLevels] = useState<Levels | null>(null);
  const key = sources.join(',');
  useEffect(() => {
    if (!key || !audioRef) return;
    const wanted = key.split(',') as StudioModSource[];
    const id = window.setInterval(() => {
      const snap = audioRef.current;
      const next: Levels | null = snap ? Object.fromEntries(wanted.map(s => [s, Math.round((snap[s] ?? 0) * 100) / 100])) : null;
      setLevels(prev => (prev && next && wanted.every(s => prev[s] === next[s]) ? prev : next));
    }, LIVE_AUDIO_MS);
    return () => window.clearInterval(id);
  }, [key, audioRef]);
  return key ? levels : null;
}

const COLOR_PRESETS = ['#ff2a8c', '#ff7a1a', '#ffd21f', '#3dff8a', '#00e5ff', '#3a5bff', '#a64dff', '#ffffff'] as const;

export function rgbToHex([r, g, b]: readonly number[]): string {
  return `#${[r, g, b].map(c => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Display scale: sliders show integers, as EffectControls does. */
const scaleOf = (p: StudioParam) => (p.step < 1 ? Math.round(1 / p.step) : 1);

interface StudioBlockCardProps {
  block: StudioBlock;
  def: StudioBlockDef;
  firstPattern: boolean;
  removable: boolean;
  /** Types the dropdown may switch to; others in the stage show disabled. */
  canSwitchTo: (type: string) => boolean;
  drag?: SortableRowArgs;
  onChange: (block: StudioBlock, commit: boolean) => void;
  onCommit: () => void;
  onTypeChange: (type: string) => void;
  onRemove: () => void;
  /** Params shown as knobs in the Lighting page's effect controls. */
  isPinned: (key: string) => boolean;
  onTogglePin: (key: string) => void;
  /** Live audio, so a modulated knob shows where the music has it now. */
  audioRef?: React.RefObject<AudioSnapshot | null>;
}

export function StudioBlockCard({
  block, def, firstPattern, removable, canSwitchTo, drag, onChange, onCommit, onTypeChange, onRemove, isPinned, onTogglePin, audioRef,
}: StudioBlockCardProps) {
  const { t } = useTranslation();
  const audio = useLiveLevels(audioRef, [...new Set(Object.values(block.mods ?? {}).map(m => m.source))]);
  const typeOptions = blocksForStage(def.stage).map(d => ({
    value: d.type,
    label: t(`lighting.studio.block.${d.type}`),
    disabled: d.type !== block.type && !canSwitchTo(d.type),
  }));

  const setParam = (key: string, value: number, commit: boolean) =>
    onChange({ ...block, params: { ...block.params, [key]: value } }, commit);

  const toggleMod = (key: string) => {
    const mods = { ...block.mods };
    if (mods[key]) delete mods[key];
    else mods[key] = { source: 'bass', amount: 0.5 };
    onChange({ ...block, mods }, true);
  };

  const setMod = (key: string, patch: Partial<{ source: StudioModSource; amount: number }>, commit: boolean) => {
    const current = block.mods?.[key];
    if (!current) return;
    onChange({ ...block, mods: { ...block.mods, [key]: { ...current, ...patch } } }, commit);
  };

  const renderParam = (p: StudioParam) => {
    const label = t(`lighting.studio.param.${p.key}`);
    const value = block.params[p.key] ?? p.def;
    if (p.options) {
      return (
        <div key={p.key} className={styles.enumRow}>
          <span className={styles.enumLabel}>{label}</span>
          <Select
            ariaLabel={label}
            options={p.options.map((o, i) => ({ value: String(i), label: t(o) }))}
            value={String(Math.round(value))}
            onChange={v => setParam(p.key, Number(v), true)}
          />
        </div>
      );
    }
    const scale = scaleOf(p);
    const mod = block.mods?.[p.key];
    // As the shader does: value + amount x the param's span x the audio source's level (0 to 1), clamped.
    // The slider's band is how far full volume moves the knob; its marker, where the music has it now.
    const clampP = (v: number) => Math.min(p.max, Math.max(p.min, v));
    const swing = mod ? Math.min(1, Math.max(-1, mod.amount)) * (p.max - p.min) : 0;
    const reach = mod ? clampP(value + swing) : null;
    const live = mod && audio ? clampP(value + swing * (audio[mod.source] ?? 0)) : null;
    const modLabel = t('lighting.studio.mod.toggle');
    const pinLabel = t('lighting.studio.pin');
    const pinned = isPinned(p.key);
    return (
      <div key={p.key} className={styles.paramBlock}>
        <Slider
          orientation={STACKED} editable trackFill
          label={label}
          labelAction={(
            <span className={styles.paramActions}>
              <HoverTooltip body={pinLabel} side="left">
                <button
                  type="button"
                  className={`${styles.modToggle} ${pinned ? styles.modToggleOn : ''}`}
                  aria-label={pinLabel}
                  aria-pressed={pinned}
                  onClick={() => onTogglePin(p.key)}
                >
                  <Pin size={13} strokeWidth={1.75} />
                </button>
              </HoverTooltip>
              <HoverTooltip body={modLabel} side="left">
                <button
                  type="button"
                  className={`${styles.modToggle} ${mod ? styles.modToggleOn : ''}`}
                  aria-label={modLabel}
                  aria-pressed={!!mod}
                  onClick={() => toggleMod(p.key)}
                >
                  <AudioLines size={13} strokeWidth={1.75} />
                </button>
              </HoverTooltip>
            </span>
          )}
          value={Math.round(value * scale)}
          min={Math.round(p.min * scale)}
          max={Math.round(p.max * scale)}
          band={reach === null ? undefined : [Math.round(value * scale), Math.round(reach * scale)]}
          marker={live === null ? undefined : Math.round(live * scale)}
          onChange={(v, commit) => setParam(p.key, v / scale, !!commit)}
          onCommit={onCommit}
        />
        {mod && (
          <div className={styles.modRow}>
            <Select
              ariaLabel={t('lighting.studio.mod.source')}
              options={STUDIO_MOD_SOURCES.map(s => ({ value: s, label: t(`lighting.studio.mod.${s}`) }))}
              value={mod.source}
              onChange={v => setMod(p.key, { source: v as StudioModSource }, true)}
              height={28}
            />
            <Slider
              orientation={INLINE}
              trackFill
              zeroMarker
              ariaLabel={t('lighting.studio.mod.amount')}
              value={Math.round(mod.amount * 100)}
              min={-100}
              max={100}
              onChange={(v, commit) => setMod(p.key, { amount: v / 100 }, !!commit)}
              onCommit={onCommit}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={drag?.ref}
      style={drag?.style}
      {...drag?.attributes}
      className={drag?.isDragging ? drag.placeholderClassName : undefined}
    >
      <Card compact className={styles.blockCard}>
        <div className={styles.blockHeader}>
          {drag && (
            <span className={styles.dragHandle} aria-label={t('lighting.studio.reorder')} {...drag.listeners}>
              <GripVertical size={14} />
            </span>
          )}
          <Select
            className={styles.blockType}
            ariaLabel={t(`lighting.studio.stage.${def.stage}`)}
            options={typeOptions}
            value={block.type}
            onChange={onTypeChange}
            accentValue
          />
          {removable && (
            <Button size="sm" tone="ghost" icon={<X size={14} />} aria-label={t('lighting.studio.remove')} onClick={onRemove} />
          )}
        </div>
        <div className={styles.blockParams} data-no-dnd>
          {blockParams(def, firstPattern).map(renderParam)}
          {def.colors?.map(c => (
            <div key={c.key} className={styles.enumRow}>
              <span className={styles.enumLabel}>{t(`lighting.studio.param.${c.key}`)}</span>
              <ColorPickerWithPresets
                value={rgbToHex(block.colors?.[c.key] ?? c.def)}
                presets={COLOR_PRESETS}
                allowCustom
                pickerPortal
                onPreview={hex => onChange({ ...block, colors: { ...block.colors, [c.key]: hexToRgb(hex) } }, false)}
                onCommit={hex => onChange({ ...block, colors: { ...block.colors, [c.key]: hexToRgb(hex) } }, true)}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
