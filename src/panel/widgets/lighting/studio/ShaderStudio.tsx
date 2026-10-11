import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Dices, LayoutGrid, Redo2, Save, Trash2, Undo2, WandSparkles } from 'lucide-react';
import { DeviceModal } from '../../../../components/common/DeviceModal/DeviceModal';
import { Button } from '../../../../components/common/Button/Button';
import { Card } from '../../../../components/common/Card/Card';
import { Select } from '../../../../components/common/Select/Select';
import { Slider } from '../../../../components/common/Slider/Slider';
import { Badge } from '../../../../components/common/Badge/Badge';
import { PromptModal } from '../../../../components/common/PromptModal/PromptModal';
import { SortableList, type SortableRowArgs } from '../../../../components/common/SortableList/SortableList';
import { forgetShaderSource, primeShaderSource } from '../../../../api/lighting';
import { useAudioState } from '../../../../hooks/useAudioState';
import { useTranslation } from '../../../../lib/i18n';
import type { EffectState } from '../../../../types/lighting';
import {
  PATTERN_BLEND_PARAMS, STUDIO_COST_BUDGET, STUDIO_STAGES, STUDIO_STAGE_LIMIT, blocksForStage, studioBlock,
  type StudioStage,
} from './studioBlocks';
import {
  STUDIO_MOD_SOURCES, compileStudio, makeBlock, recipeCost, stageCount,
  type CompiledStudio, type StudioBlock, type StudioRecipe,
} from './studioCompiler';
import { STUDIO_STARTERS, mutateRecipe, shuffleRecipe } from './studioRecipes';
import { StudioBlockCard } from './StudioBlockCard';
import { StudioPreview } from './StudioPreview';
import styles from './ShaderStudio.module.scss';

const STACKED = 'stacked' as const;

// Prototype storage: browser-local until the service owns custom effects.
const SAVED_KEY = 'nexus.studio.saved';
const DRAFT_KEY = 'nexus.studio.draft';
const HISTORY_LIMIT = 50;
const VARIATION_COUNT = 6;

interface SavedEffect {
  id: string;
  name: string;
  recipe: StudioRecipe;
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

const isObj = (o: unknown): o is Record<string, unknown> => !!o && typeof o === 'object' && !Array.isArray(o);

function isBlock(b: StudioBlock | null | undefined): boolean {
  if (!b || typeof b.uid !== 'string' || !studioBlock(b.type) || !isObj(b.params)) return false;
  if (!Object.values(b.params).every(isNum)) return false;
  if (b.mods !== undefined && !(isObj(b.mods) && Object.values(b.mods).every(m => isObj(m) && STUDIO_MOD_SOURCES.includes(m.source) && isNum(m.amount)))) return false;
  return b.colors === undefined || (isObj(b.colors) && Object.values(b.colors).every(c => Array.isArray(c) && c.length === 3 && c.every(isNum)));
}

function isRecipe(x: unknown): x is StudioRecipe {
  if (!x || typeof x !== 'object') return false;
  const r = x as StudioRecipe;
  if (r.v !== 1 || !Array.isArray(r.blocks) || !r.blocks.every(isBlock)) return false;
  if (![r.speed, r.hue, r.saturation, r.contrast].every(isNum)) return false;
  return stageCount(r, 'pattern') >= 1 && stageCount(r, 'color') === 1;
}

function readSaved(): SavedEffect[] {
  const raw = readJson(SAVED_KEY);
  return Array.isArray(raw) ? raw.filter((s): s is SavedEffect => !!s && typeof s.name === 'string' && isRecipe(s.recipe)) : [];
}

// Keys this editor primed; evicted on close so the module-level shader cache stays bounded.
const primedKeys = new Set<string>();

function primed(recipe: StudioRecipe): CompiledStudio {
  const compiled = compileStudio(recipe);
  primeShaderSource(compiled.key, compiled.frag);
  primedKeys.add(compiled.key);
  return compiled;
}

function stateFor(recipe: StudioRecipe, compiled: CompiledStudio): EffectState {
  return {
    speed: recipe.speed, intensity: 1, hue: recipe.hue, colorize: 0,
    saturation: recipe.saturation, contrast: recipe.contrast, params: compiled.params,
  };
}

const stageOf = (b: StudioBlock): StudioStage | undefined => studioBlock(b.type)?.stage;

function VariationTile({ recipe, label, onPick }: { recipe: StudioRecipe; label: string; onPick: () => void }) {
  const compiled = useMemo(() => primed(recipe), [recipe]);
  const stateRef = useRef<EffectState | null>(stateFor(recipe, compiled));
  // Tiles are reused across rounds, so the renderer must see each new recipe's values.
  useLayoutEffect(() => {
    stateRef.current = stateFor(recipe, compiled);
  }, [recipe, compiled]);
  return (
    <button type="button" className={styles.variationTile} onClick={onPick} aria-label={label}>
      <StudioPreview effectKey={compiled.key} stateRef={stateRef} />
    </button>
  );
}

export function ShaderStudio({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [recipe, setRecipe] = useState<StudioRecipe>(() => {
    const draft = readJson(DRAFT_KEY);
    return isRecipe(draft) ? draft : STUDIO_STARTERS[0].build();
  });
  const [past, setPast] = useState<StudioRecipe[]>([]);
  const [future, setFuture] = useState<StudioRecipe[]>([]);
  const [variations, setVariations] = useState<StudioRecipe[] | null>(null);
  const [saved, setSaved] = useState<SavedEffect[]>(readSaved);
  const [saving, setSaving] = useState(false);
  const committedRef = useRef(recipe);
  const recipeRef = useRef(recipe);

  const compiled = useMemo(() => primed(recipe), [recipe]);
  const stateRef = useRef<EffectState | null>(stateFor(recipe, compiled));
  useLayoutEffect(() => {
    stateRef.current = stateFor(recipe, compiled);
    recipeRef.current = recipe;
  }, [recipe, compiled]);

  const hasMods = recipe.blocks.some(b => b.mods && Object.keys(b.mods).length > 0);
  const audioRef = useAudioState(open && hasMods);

  // Evicts on the explicit close, not an unmount cleanup: StrictMode re-runs cleanups
  // while the previews still need their keys.
  const close = () => {
    primedKeys.forEach(forgetShaderSource);
    primedKeys.clear();
    onClose();
  };

  const apply = (next: StudioRecipe, commit: boolean) => {
    setRecipe(next);
    recipeRef.current = next;
    if (!commit || next === committedRef.current) return;
    const prev = committedRef.current;
    setPast(p => [...p.slice(1 - HISTORY_LIMIT), prev]);
    setFuture([]);
    committedRef.current = next;
    writeJson(DRAFT_KEY, next);
  };
  const commitCurrent = () => apply(recipeRef.current, true);

  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast(past.slice(0, -1));
    setFuture([committedRef.current, ...future]);
    committedRef.current = prev;
    setRecipe(prev);
    writeJson(DRAFT_KEY, prev);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture(future.slice(1));
    setPast([...past, committedRef.current]);
    committedRef.current = next;
    setRecipe(next);
    writeJson(DRAFT_KEY, next);
  };

  const cost = recipeCost(recipe);
  const fitsBudget = (delta: number) => cost + delta <= STUDIO_COST_BUDGET;
  const canAdd = (type: string) => {
    const def = studioBlock(type);
    return !!def && stageCount(recipe, def.stage) < STUDIO_STAGE_LIMIT[def.stage] && fitsBudget(def.cost);
  };

  const updateBlock = (uid: string, block: StudioBlock, commit: boolean) =>
    apply({ ...recipe, blocks: recipe.blocks.map(b => (b.uid === uid ? block : b)) }, commit);

  const changeType = (uid: string, type: string) => {
    const next = makeBlock(type);
    const old = recipe.blocks.find(b => b.uid === uid);
    if (old && studioBlock(type)?.stage === 'pattern') {
      for (const p of PATTERN_BLEND_PARAMS) next.params[p.key] = old.params[p.key] ?? p.def;
    }
    apply({ ...recipe, blocks: recipe.blocks.map(b => (b.uid === uid ? next : b)) }, true);
  };

  const reorder = (stage: StudioStage, ids: string[]) => {
    const byId = new Map(recipe.blocks.map(b => [b.uid, b]));
    const others = recipe.blocks.filter(b => stageOf(b) !== stage);
    apply({ ...recipe, blocks: [...others, ...ids.map(id => byId.get(id)!)] }, true);
  };

  const openVariations = (from: StudioRecipe) =>
    setVariations(Array.from({ length: VARIATION_COUNT }, () => mutateRecipe(from)));

  const pickVariation = (v: StudioRecipe) => {
    apply(v, true);
    openVariations(v);
  };

  const saveEffect = (name: string) => {
    const next = [...saved, { id: `fx${Date.now().toString(36)}`, name: name.trim(), recipe: structuredClone(recipe) }];
    setSaved(next);
    writeJson(SAVED_KEY, next);
    setSaving(false);
  };

  const deleteSaved = (id: string) => {
    const next = saved.filter(s => s.id !== id);
    setSaved(next);
    writeJson(SAVED_KEY, next);
  };

  const costLevel = cost <= 4 ? 'light' : cost <= 8 ? 'medium' : 'heavy';

  const toolbar = (
    <div className={styles.toolbar}>
      <Select
        ariaLabel={t('lighting.studio.starters')}
        placeholder={t('lighting.studio.starters')}
        value=""
        options={STUDIO_STARTERS.map(s => ({ value: s.id, label: t(`lighting.studio.starter.${s.id}`) }))}
        onChange={id => {
          const starter = STUDIO_STARTERS.find(s => s.id === id);
          if (starter) apply(starter.build(), true);
        }}
        height={32}
      />
      <Button size="sm" icon={<Dices size={14} />} onClick={() => apply(shuffleRecipe(), true)}>
        {t('lighting.studio.shuffle')}
      </Button>
      <Button size="sm" icon={<LayoutGrid size={14} />} onClick={() => (variations ? setVariations(null) : openVariations(recipe))}>
        {variations ? t('lighting.studio.done') : t('lighting.studio.variations')}
      </Button>
      <Button size="sm" tone="ghost" icon={<Undo2 size={14} />} aria-label={t('lighting.studio.undo')} disabled={!past.length} onClick={undo} />
      <Button size="sm" tone="ghost" icon={<Redo2 size={14} />} aria-label={t('lighting.studio.redo')} disabled={!future.length} onClick={redo} />
      <Button size="sm" tone="accent" icon={<Save size={14} />} onClick={() => setSaving(true)}>
        {t('lighting.studio.save')}
      </Button>
    </div>
  );

  const renderStage = (stage: StudioStage) => {
    const blocks = recipe.blocks.filter(b => stageOf(b) === stage);
    const addOptions = blocksForStage(stage).map(d => ({
      value: d.type, label: t(`lighting.studio.block.${d.type}`), disabled: !canAdd(d.type),
    }));
    const removable = (b: StudioBlock) => stage !== 'color' && !(stage === 'pattern' && blocks.length === 1 && blocks[0] === b);
    const renderCard = (b: StudioBlock, drag?: SortableRowArgs) => {
      const def = studioBlock(b.type)!;
      return (
        <StudioBlockCard
          key={b.uid}
          block={b}
          def={def}
          firstPattern={stage === 'pattern' && blocks[0] === b}
          removable={removable(b)}
          canSwitchTo={type => fitsBudget((studioBlock(type)?.cost ?? 0) - def.cost)}
          drag={drag}
          onChange={(nb, commit) => updateBlock(b.uid, nb, commit)}
          onCommit={commitCurrent}
          onTypeChange={type => changeType(b.uid, type)}
          onRemove={() => apply({ ...recipe, blocks: recipe.blocks.filter(x => x.uid !== b.uid) }, true)}
        />
      );
    };
    return (
      <section key={stage} className={styles.stage}>
        <div className={styles.stageHeader}>
          <h4 className={styles.stageTitle}>{t(`lighting.studio.stage.${stage}`)}</h4>
          {stage !== 'color' && blocks.length < STUDIO_STAGE_LIMIT[stage] && (
            <Select
              className={styles.addSelect}
              ariaLabel={t('lighting.studio.add')}
              placeholder={t('lighting.studio.add')}
              value=""
              options={addOptions}
              onChange={type => apply({ ...recipe, blocks: [...recipe.blocks, makeBlock(type)] }, true)}
              height={28}
            />
          )}
        </div>
        {blocks.length > 1 ? (
          <SortableList
            className={styles.blockList}
            ids={blocks.map(b => b.uid)}
            onReorder={ids => reorder(stage, ids)}
            renderRow={(id, args) => renderCard(blocks.find(b => b.uid === id)!, args)}
            ariaLabel={t(`lighting.studio.stage.${stage}`)}
          />
        ) : (
          <div className={styles.blockList}>{blocks.map(b => renderCard(b))}</div>
        )}
      </section>
    );
  };

  return (
    <DeviceModal
      open={open}
      onClose={close}
      fullscreen
      title={t('lighting.studio.title')}
      icon={<WandSparkles size={18} />}
      headerRight={toolbar}
    >
      <div className={styles.layout}>
        <div className={styles.viewPane}>
          {variations ? (
            <>
              <p className={styles.hint}>{t('lighting.studio.variationsHint')}</p>
              <div className={styles.variationGrid}>
                {variations.map((v, i) => (
                  <VariationTile key={i} recipe={v} label={`${t('lighting.studio.variations')} ${i + 1}`} onPick={() => pickVariation(v)} />
                ))}
              </div>
            </>
          ) : (
            <>
              <StudioPreview effectKey={compiled.key} stateRef={stateRef} audioRef={audioRef} />
              <div className={styles.underPreview}>
                <div className={styles.ledColumn}>
                  <span className={styles.caption}>{t('lighting.studio.ledView')}</span>
                  <StudioPreview effectKey={compiled.key} stateRef={stateRef} audioRef={audioRef} led />
                </div>
                <div className={styles.savedColumn}>
                  <div className={styles.savedHeader}>
                    <span className={styles.caption}>{t('lighting.studio.saved')}</span>
                    <Badge label={`${t(`lighting.studio.cost.${costLevel}`)} ${cost}/${STUDIO_COST_BUDGET}`} compact />
                  </div>
                  {saved.length === 0 ? (
                    <p className={styles.hint}>{t('lighting.studio.savedEmpty')}</p>
                  ) : (
                    <ul className={styles.savedList}>
                      {saved.map(s => (
                        <li key={s.id} className={styles.savedRow}>
                          <Button size="sm" tone="ghost" className={styles.savedName} onClick={() => apply(structuredClone(s.recipe), true)}>
                            {s.name}
                          </Button>
                          <Button size="sm" tone="ghost" icon={<Trash2 size={13} />} aria-label={t('lighting.studio.delete')} onClick={() => deleteSaved(s.id)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <div className={styles.stackPane}>
          <Card compact className={styles.blockCard}>
            <div className={styles.blockParams}>
              <Slider orientation={STACKED} editable trackFill zeroMarker label={t('lighting.controls.speed')}
                value={recipe.speed} min={-100} max={100}
                onChange={(v, commit) => apply({ ...recipe, speed: v }, !!commit)} onCommit={commitCurrent} />
              <Slider orientation={STACKED} editable trackFill label={t('lighting.studio.param.hue')}
                value={Math.round(recipe.hue * 100)} min={0} max={100}
                onChange={(v, commit) => apply({ ...recipe, hue: v / 100 }, !!commit)} onCommit={commitCurrent} />
              <Slider orientation={STACKED} editable trackFill label={t('lighting.controls.saturation')}
                value={Math.round(recipe.saturation * 100)} min={0} max={200}
                onChange={(v, commit) => apply({ ...recipe, saturation: v / 100 }, !!commit)} onCommit={commitCurrent} />
              <Slider orientation={STACKED} editable trackFill label={t('lighting.controls.contrast')}
                value={Math.round(recipe.contrast * 100)} min={0} max={200}
                onChange={(v, commit) => apply({ ...recipe, contrast: v / 100 }, !!commit)} onCommit={commitCurrent} />
            </div>
          </Card>
          {STUDIO_STAGES.map(renderStage)}
        </div>
      </div>
      <PromptModal
        open={saving}
        title={t('lighting.studio.saveTitle')}
        placeholder={t('lighting.studio.namePlaceholder')}
        maxLength={40}
        confirmLabel={t('lighting.studio.save')}
        validate={v => (v.trim() ? null : t('lighting.studio.nameRequired'))}
        onConfirm={saveEffect}
        onCancel={() => setSaving(false)}
      />
    </DeviceModal>
  );
}
