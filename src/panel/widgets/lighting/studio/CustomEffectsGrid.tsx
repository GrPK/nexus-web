import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CopyPlus, Plus, Store } from 'lucide-react';
import { HoverTooltip } from '../../../../components/common/HoverTooltip/HoverTooltip';
import { EffectCard } from '../../../../components/common/EffectCard/EffectCard';
import { CollapsibleSection } from '../../../../components/common/CollapsibleSection/CollapsibleSection';
import { ConfirmModal } from '../../../../components/common/ConfirmModal/ConfirmModal';
import { customEffectKey } from '../../../../api/customEffects';
import { useEffectThumbnail } from '../../../../hooks/useEffectThumbnail';
import { useTranslation } from '../../../../lib/i18n';
import { matchesAllWords } from '../../../../search/match';
import { renderRecipeStill } from './recipePreview';
import { deleteEffect, isDownloaded, isMarketCopy, migrateLegacyEffects, useSavedEffects, type SavedEffect } from './studioLibrary';
import type { StudioRecipe } from './studioCompiler';
import pageStyles from '../LightingPage.module.scss';
import styles from './ShaderStudio.module.scss';

const STILL_DEBOUNCE_MS = 150;
// Raw defines, not DEV_TOOLS: the Marketplace badges are left out of production with the rest of the Marketplace.
const MARKETPLACE = import.meta.env.DEV || __DEV_TOOLS__;
const SECTION_CUSTOM = 'custom';
type Section = typeof SECTION_CUSTOM;

/** The recipe being edited, shown on its tile while unsaved; `id` null is a new effect. */
export interface StudioDraft {
  id: string | null;
  recipe: StudioRecipe;
}

/** A still of `recipe` rendered in the browser: before the first paint, then again once edits pause. */
function useRecipeStill(recipe: StudioRecipe | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const firstRef = useRef(true);
  useLayoutEffect(() => {
    if (!recipe) {
      firstRef.current = true;
      return;
    }
    if (firstRef.current) {
      firstRef.current = false;
      setUrl(renderRecipeStill(recipe));
      return;
    }
    const timer = window.setTimeout(() => setUrl(renderRecipeStill(recipe)), STILL_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [recipe]);
  return recipe ? url : null;
}

function CustomEffectCell({ effect, active, published, copiedFrom, draft, gpuAvailable, onSelect, onDelete }: {
  effect: SavedEffect;
  active: boolean;
  /** The user's own effect, listed in the Marketplace. */
  published: boolean;
  /** A copy of someone else's Marketplace effect: its author, credited on the tile. */
  copiedFrom: string | null;
  /** The unsaved edit of this effect, rendered in place of its saved thumbnail. */
  draft: StudioRecipe | null;
  gpuAvailable: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const key = customEffectKey(effect.id);
  const saved = useEffectThumbnail(key, 0, String(effect.updatedAt), !gpuAvailable);
  const live = useRecipeStill(draft);
  return (
    <EffectCard
      overlay
      asDiv
      dataEffectKey={key}
      label={effect.name}
      thumbUrl={live ?? saved}
      thumbStatic={!gpuAvailable && !live}
      active={active}
      onClick={onSelect}
      onDelete={onDelete}
      deleteAriaLabel={t('lighting.studio.delete')}
      cornerBadge={published ? (
        <HoverTooltip body={t('lighting.studio.publishedBadge')} side="top">
          <span className={styles.publishedBadge} data-testid="effect-published-badge"><Store aria-hidden={true} /></span>
        </HoverTooltip>
      ) : copiedFrom ? (
        <HoverTooltip body={t('lighting.studio.copiedBadge', { author: copiedFrom })} side="top">
          <span className={styles.publishedBadge} data-testid="effect-copied-badge"><CopyPlus aria-hidden={true} /></span>
        </HoverTooltip>
      ) : undefined}
    />
  );
}

function NewDraftCell({ recipe, label }: { recipe: StudioRecipe; label: string }) {
  const url = useRecipeStill(recipe);
  return <EffectCard overlay nonInteractive label={label} thumbUrl={url} active />;
}

/**
 * Saved Studio effects as the lighting browser's first category, Custom: the
 * account's own and its copies of Marketplace effects alike. With `onCreate`,
 * it leads with a create tile; with `draft`, the edited effect's tile shows the
 * unsaved recipe.
 */
export function SavedEffectSections({ effect, query, username, gpuAvailable = true, draft, flat, onSelect, onCreate, onDeleted }: {
  /** Running effect key, highlighted when it is one of these. */
  effect: string | null;
  query: string;
  /** Signed-in account, for effects with no recorded `downloaded`: one linked to anyone else's listing is a download. */
  username?: string | null;
  gpuAvailable?: boolean;
  draft?: StudioDraft | null;
  /** One grid with no section header. */
  flat?: boolean;
  onSelect: (key: string) => void;
  onCreate?: () => void;
  /** After an effect was deleted from this grid, with the effect listed after it (before it when it was last). */
  onDeleted?: (id: string, nextId: string | null) => void;
}) {
  const { t } = useTranslation();
  const saved = useSavedEffects();
  const [collapsed, setCollapsed] = useState<ReadonlySet<Section>>(() => new Set());
  const [pendingDelete, setPendingDelete] = useState<SavedEffect | null>(null);

  useEffect(() => { void migrateLegacyEffects(); }, []);

  const searching = query.trim() !== '';
  const downloaded = (s: SavedEffect) => isDownloaded(s, username);
  const shown = saved.filter(s => matchesAllWords(query, [s.name]));
  const sections: { key: Section; items: SavedEffect[]; lead: boolean }[] = [
    { key: SECTION_CUSTOM, items: shown, lead: !!onCreate },
  ];
  const newDraft = draft && !draft.id ? draft.recipe : null;

  const toggle = (key: Section) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const grid = (s: typeof sections[number]) => (
    <div key={s.key} data-pick className={pageStyles.animateGridSection}>
      {s.lead && (
        <button type="button" className={`${pageStyles.addSmartLights} ${styles.createTile}`} onClick={onCreate}>
          <Plus size={20} aria-hidden />
          <span>{t('lighting.studio.create')}</span>
        </button>
      )}
      {s.lead && newDraft && <NewDraftCell recipe={newDraft} label={t('lighting.studio.create')} />}
      {s.items.map(item => (
        <CustomEffectCell
          key={item.id}
          effect={item}
          active={effect === customEffectKey(item.id)}
          published={MARKETPLACE && !!item.marketId && !downloaded(item)}
          copiedFrom={MARKETPLACE && isMarketCopy(item, username) ? item.marketAuthor : null}
          draft={draft?.id === item.id ? draft.recipe : null}
          gpuAvailable={gpuAvailable}
          onSelect={() => onSelect(customEffectKey(item.id))}
          onDelete={() => setPendingDelete(item)}
        />
      ))}
    </div>
  );

  return (
    <>
      {sections.filter(s => s.lead || s.items.length > 0).map(s => (flat ? grid(s) : (
        <CollapsibleSection
          key={s.key}
          compact
          title={t(`lighting.category.${s.key}`)}
          open={searching || !collapsed.has(s.key)}
          onToggle={() => toggle(s.key)}
        >
          {grid(s)}
        </CollapsibleSection>
      )))}
      <ConfirmModal
        open={!!pendingDelete}
        title={t('lighting.studio.deleteTitle')}
        message={t('lighting.studio.deleteMessage', { name: pendingDelete?.name ?? '' })}
        confirmLabel={t('lighting.studio.delete')}
        destructive
        onConfirm={() => {
          const target = pendingDelete;
          if (target) {
            const order = sections.flatMap(s => s.items).map(s => s.id);
            const at = order.indexOf(target.id);
            const nextId = order[at + 1] ?? order[at - 1] ?? null;
            void deleteEffect(target.id).then(ok => { if (ok) onDeleted?.(target.id, nextId); });
          }
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

/** The Studio's My effects: every saved effect in one headerless grid, in its own scroller, with a create tile. */
export function CustomEffectsGrid({ query, ...rest }: Parameters<typeof SavedEffectSections>[0] & { onCreate: () => void }) {
  const { t } = useTranslation();
  const saved = useSavedEffects();
  const none = query.trim() !== '' && saved.length > 0 && !saved.some(s => matchesAllWords(query, [s.name]));
  return (
    <div className={pageStyles.animateGridWrap}>
      <div className={pageStyles.animateGrid}>
        <SavedEffectSections query={query} flat {...rest} />
        {none && <p className={pageStyles.browserHint}>{t('lighting.effects.noMatches')}</p>}
      </div>
    </div>
  );
}
