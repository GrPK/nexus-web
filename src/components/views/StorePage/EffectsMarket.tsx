import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, Download, User } from 'lucide-react';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { ChipGroup } from '../../common/ChipGroup/ChipGroup';
import { ConfirmModal } from '../../common/ConfirmModal/ConfirmModal';
import { EffectCard } from '../../common/EffectCard/EffectCard';
import { InlineError } from '../../common/InlineError/InlineError';
import { SearchInput } from '../../common/SearchInput/SearchInput';
import { useTranslation } from '../../../lib/i18n';
import { pluralKey } from '../../../lib/pluralKey';
import {
  downloadEffect, getEffect, listEffects, unpublishEffect,
  type EffectListing, type EffectMarketError, type EffectSort,
} from '../../../api/effectMarket';
import { forgetShaderSource, primeShaderSource } from '../../../api/lighting';
import { customEffectDef, customEffectKey } from '../../../api/customEffects';
import { LIGHTING_MODE_ICONS } from '../../../lib/lightingModeIcons';
import { useAudioState } from '../../../hooks/useAudioState';
import type { EffectState } from '../../../types/lighting';
import { baselineTemplates, slotMatchesDefault } from '../../../types/lightingTemplates';
import { EffectControls } from '../../../panel/widgets/lighting/page/EffectControls';
import { StudioPreview } from '../../../panel/widgets/lighting/studio/StudioPreview';
import { attachRecipePreview } from '../../../panel/widgets/lighting/studio/recipePreview';
import { HoverTooltip } from '../../common/HoverTooltip/HoverTooltip';
import { useUnitPrefs } from '../../../hooks/useUiSettings';
import { formatNumber } from '../../../lib/units';
import { deleteEffect, isDownloaded, newEffectId, parseMarketRecipe, saveEffect, unlinkEffect, useSavedEffects } from '../../../panel/widgets/lighting/studio/studioLibrary';
import { compileStudio, type StudioRecipe } from '../../../panel/widgets/lighting/studio/studioCompiler';
import storeStyles from './StorePage.module.scss';
import styles from './EffectsMarket.module.scss';

type NeedsSignIn = (retry: () => void) => void;

const SEARCH_DEBOUNCE_MS = 300;
const SORT_POPULAR: EffectSort = 'popular';
const SORT_NEW: EffectSort = 'new';
const AnimationIcon = LIGHTING_MODE_ICONS.animate;

// Parsed once per listing object: the preview attaches per recipe identity.
const parsedRecipes = new WeakMap<EffectListing, StudioRecipe | null>();
function recipeOf(listing: EffectListing): StudioRecipe | null {
  if (!parsedRecipes.has(listing)) parsedRecipes.set(listing, parseMarketRecipe(listing.recipe));
  return parsedRecipes.get(listing)!;
}

function RecipeCanvas({ recipe, className }: { recipe: StudioRecipe; className: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => (ref.current ? attachRecipePreview(ref.current, recipe) : undefined), [recipe]);
  return <canvas ref={ref} className={className} aria-hidden={true} />;
}

function useDownloadsLabel() {
  const { t, language } = useTranslation();
  const { numberFormat } = useUnitPrefs();
  return (n: number) => t(pluralKey('store.effects.downloads', language, n), { count: formatNumber(n, numberFormat) });
}

function EffectTile({ listing, onOpen }: { listing: EffectListing; onOpen: () => void }) {
  const { t } = useTranslation();
  const { numberFormat } = useUnitPrefs();
  const downloads = useDownloadsLabel();
  const recipe = recipeOf(listing);
  return (
    <EffectCard
      label={listing.name}
      ariaLabel={`${listing.name}, ${downloads(listing.downloads)}`}
      meta={t('store.effects.byAuthor', { author: listing.author })}
      metaSans
      thumbUrl={null}
      thumbStatic
      thumbOverlay={recipe ? <RecipeCanvas recipe={recipe} className={styles.tileCanvas} /> : null}
      cornerBadge={(
        <HoverTooltip body={downloads(listing.downloads)} side="top">
          <span className={styles.tileDownloads}>
            <Download size={12} aria-hidden={true} />
            {formatNumber(listing.downloads, numberFormat)}
          </span>
        </HoverTooltip>
      )}
      audio={listing.audio}
      active={false}
      onClick={onOpen}
    />
  );
}

/** A page of listings that grows with "Load more"; reloads whenever `query` changes value. */
function useListings(query: Parameters<typeof listEffects>[0]) {
  const [items, setItems] = useState<EffectListing[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<EffectMarketError | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  // A response for a query that has since changed is dropped.
  const key = JSON.stringify(query);
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    let alive = true;
    setItems(null);
    setError(null);
    setLoadingMore(false);
    pageRef.current = 1;
    void listEffects({ ...query, page: 1 }).then(res => {
      if (!alive) return;
      if (res.ok) { setItems(res.value.items); setHasMore(res.value.hasMore); } else setError(res.error);
    });
    return () => { alive = false; };
    // `key` carries the query's value; the object identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loadMore = useCallback(() => {
    const forKey = key;
    const next = pageRef.current + 1;
    setLoadingMore(true);
    void listEffects({ ...query, page: next }).then(res => {
      if (keyRef.current !== forKey) return;
      setLoadingMore(false);
      if (!res.ok) return;
      pageRef.current = next;
      setItems(prev => {
        const seen = new Set((prev ?? []).map(i => i.id));
        return [...(prev ?? []), ...res.value.items.filter(i => !seen.has(i.id))];
      });
      setHasMore(res.value.hasMore);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { items, hasMore, error, loadingMore, loadMore };
}

function ListingGrid({ items, hasMore, error, loadingMore, loadMore, empty, onOpen }: ReturnType<typeof useListings> & {
  empty: string;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (error) return <div className={storeStyles.notice}>{t(error === 'unavailable' ? 'store.effects.unavailable' : 'store.unavailable')}</div>;
  if (!items) return <div className={storeStyles.notice}>{t('store.loading')}</div>;
  if (items.length === 0) return <div className={storeStyles.notice}>{empty}</div>;
  return (
    <>
      <div className={styles.grid}>
        {items.map(l => <EffectTile key={l.id} listing={l} onOpen={() => onOpen(l.id)} />)}
      </div>
      {hasMore && (
        <div className={styles.more}>
          <Button size="sm" loading={loadingMore} disabled={loadingMore} onClick={loadMore}>{t('store.effects.loadMore')}</Button>
        </div>
      )}
    </>
  );
}

function EffectsBrowse({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<EffectSort>(SORT_POPULAR);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);
  const listing = useListings({ sort, q: q || undefined });
  return (
    <>
      <div className={styles.toolbar}>
        <ChipGroup
          ariaLabel={t('store.effects.sortLabel')}
          options={[
            { key: SORT_POPULAR, label: t('store.effects.sort.popular') },
            { key: SORT_NEW, label: t('store.effects.sort.new') },
          ]}
          activeKey={sort}
          onChange={k => setSort(k as EffectSort)}
        />
        <SearchInput
          className={styles.search}
          value={search}
          onChange={setSearch}
          placeholder={t('store.effects.search')}
          ariaLabel={t('store.effects.search')}
        />
      </div>
      <ListingGrid {...listing} empty={t(q ? 'lighting.effects.noMatches' : 'store.effects.empty')} onOpen={onOpen} />
    </>
  );
}

function BackBar({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={storeStyles.topBar}>
      <button type="button" className={storeStyles.back} onClick={onBack}>
        <ChevronLeft size={16} aria-hidden={true} />
        {t('store.back')}
      </button>
    </div>
  );
}

function CreatorEffects({ author, onOpen, onBack }: { author: string; onOpen: (id: string) => void; onBack: () => void }) {
  const { t } = useTranslation();
  const listing = useListings({ author, sort: SORT_NEW });
  return (
    <>
      <BackBar onBack={onBack} />
      <h1 className={`${storeStyles.heroTitle} selectable`}>{t('store.effects.byCreator', { author })}</h1>
      <ListingGrid {...listing} empty={t('store.effects.creatorEmpty')} onOpen={onOpen} />
    </>
  );
}

// Listing shaders stay primed for the last few detail pages instead of being
// evicted on unmount: StrictMode re-runs cleanups while the preview and knobs
// still read the key, and nothing on the service backs it.
const PRIMED_MAX = 8;
const primedKeys: string[] = [];
function primeListingShader(key: string, frag: string): void {
  primeShaderSource(key, frag);
  const at = primedKeys.indexOf(key);
  if (at >= 0) primedKeys.splice(at, 1);
  primedKeys.push(key);
  while (primedKeys.length > PRIMED_MAX) forgetShaderSource(primedKeys.shift()!);
}

const ERROR_KEYS: Partial<Record<EffectMarketError, string>> = {
  unavailable: 'store.effects.unavailable',
  not_found: 'store.effects.gone',
};

/**
 * The listing running live with the Lighting page's effect controls. It is
 * compiled the way an installed effect is (baked), so the neutral preset renders
 * the recipe as published; edits only change this preview.
 */
function EffectPlayground({ listing, recipe, children }: { listing: EffectListing; recipe: StudioRecipe; children: ReactNode }) {
  const { t } = useTranslation();
  const compiled = useMemo(() => {
    const c = compileStudio(recipe, { bake: true });
    primeListingShader(c.key, c.frag);
    return c;
  }, [recipe]);
  const def = useMemo(() => customEffectDef(
    { id: listing.id, name: listing.name, recipe: JSON.stringify(recipe), updatedAt: 0, audio: listing.audio }, t,
  ), [listing.id, listing.name, listing.audio, recipe, t]);
  const neutral = useMemo(() => baselineTemplates(compiled.key), [compiled.key]);
  const [state, setState] = useState<EffectState>(neutral.slots[0]);
  const stateRef = useRef<EffectState | null>(state);
  useLayoutEffect(() => { stateRef.current = state; }, [state]);
  const audioRef = useAudioState(listing.audio);
  return (
    <div className={styles.playground}>
      <div className={styles.main}>
        <StudioPreview effectKey={compiled.key} stateRef={stateRef} audioRef={audioRef} className={styles.detailPreview} />
        {children}
      </div>
      <Card compact className={styles.controls}>
        <EffectControls
          effect={compiled.key}
          customDef={def}
          state={state}
          bundle={{ selected: 0, slots: [state] }}
          canReset={!slotMatchesDefault(compiled.key, 0, state, { [compiled.key]: neutral })}
          onTemplateSelect={() => {}}
          onChange={patch => setState(s => ({ ...s, ...patch }))}
          onCommit={() => {}}
          onReset={() => setState(neutral.slots[0])}
          noPresets
        />
      </Card>
    </div>
  );
}

function EffectDetail({ id, username, onBack, onCreator, onNeedsSignIn, onOpenInLighting }: {
  id: string;
  /** The signed-in account's username; null when signed out. */
  username: string | null;
  onBack: () => void;
  onCreator: (author: string) => void;
  onNeedsSignIn: NeedsSignIn;
  /** Runs an installed copy on the Lighting page. */
  onOpenInLighting?: (effectKey: string) => void;
}) {
  const { t } = useTranslation();
  const downloads = useDownloadsLabel();
  const [listing, setListing] = useState<EffectListing | null>(null);
  const [loadError, setLoadError] = useState<EffectMarketError | null>(null);
  const [state, setState] = useState<'idle' | 'working' | 'failed'>('idle');
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const [unpublishFailed, setUnpublishFailed] = useState(false);
  const saved = useSavedEffects();

  useEffect(() => {
    let alive = true;
    void getEffect(id).then(res => {
      if (!alive) return;
      if (res.ok) setListing(res.value); else setLoadError(res.error);
    });
    return () => { alive = false; };
  }, [id]);

  const recipe = useMemo(() => (listing ? recipeOf(listing) : null), [listing]);
  const installed = saved.filter(s => s.marketId === id);
  const mine = !!listing && !!username && listing.author.toLowerCase() === username.toLowerCase();

  const install = async () => {
    setState('working');
    const res = await downloadEffect(id);
    if (!res.ok) {
      setState(res.error === 'sign_in_required' ? 'idle' : 'failed');
      if (res.error === 'sign_in_required') onNeedsSignIn(() => { void install(); });
      return;
    }
    setListing(res.value);
    const parsed = recipeOf(res.value);
    const error = parsed
      ? await saveEffect(newEffectId(), res.value.name, parsed, { marketId: res.value.id, marketAuthor: res.value.author, downloaded: true })
      : 'unsupported';
    setState(error ? 'failed' : 'idle');
  };

  const uninstall = async () => {
    setConfirmUninstall(false);
    setState('working');
    const results = await Promise.all(installed.map(s => deleteEffect(s.id)));
    setState(results.every(Boolean) ? 'idle' : 'failed');
  };

  const unpublish = async () => {
    setConfirmUnpublish(false);
    const res = await unpublishEffect(id);
    if (!res.ok) {
      setUnpublishFailed(true);
      return;
    }
    // The author's own copies stop showing as published; a later publish lists them anew.
    const errors = await Promise.all(saved.filter(s => s.marketId === id && !isDownloaded(s, username)).map(s => unlinkEffect(s)));
    if (errors.some(Boolean)) setUnpublishFailed(true);
    else onBack();
  };

  if (loadError) return <><BackBar onBack={onBack} /><div className={storeStyles.notice}>{t(ERROR_KEYS[loadError] ?? 'store.unavailable')}</div></>;
  if (!listing) return <div className={storeStyles.notice}>{t('store.loading')}</div>;

  const header = (
    <header className={storeStyles.heroMain}>
      <h1 className={`${storeStyles.heroTitle} selectable`}>{listing.name}</h1>
      <div className={styles.byline}>
        <button type="button" className={styles.author} onClick={() => onCreator(listing.author)}>
          <User size={14} aria-hidden={true} />
          {t('store.effects.byAuthor', { author: listing.author })}
        </button>
        <span className={styles.count}>
          <Download size={14} aria-hidden={true} />
          {downloads(listing.downloads)}
        </span>
      </div>
      <div className={storeStyles.heroActions}>
        {mine ? (
          <Button tone="danger" onClick={() => setConfirmUnpublish(true)}>{t('store.effects.unpublish')}</Button>
        ) : installed.length > 0 ? (
          <Button tone="neutral" loading={state === 'working'} disabled={state === 'working'} onClick={() => setConfirmUninstall(true)}>
            {t('store.effects.uninstall')}
          </Button>
        ) : (
          <Button tone="accent" loading={state === 'working'} disabled={!recipe || state === 'working'} onClick={() => { void install(); }}>
            {state === 'failed' ? t('store.retry') : t('store.install')}
          </Button>
        )}
      </div>
      {installed.length > 0 && onOpenInLighting && (
        <Button tone="neutral" size="sm" icon={<AnimationIcon size={14} />} onClick={() => onOpenInLighting(customEffectKey(installed[0].id))}>
          {t('store.effects.openInLighting')}
        </Button>
      )}
      {state === 'failed' && <InlineError>{t(installed.length > 0 ? 'store.effects.uninstallFailed' : 'store.effects.getFailed')}</InlineError>}
      {unpublishFailed && <InlineError>{t('store.effects.unpublishFailed')}</InlineError>}
    </header>
  );

  return (
    <>
      <BackBar onBack={onBack} />
      {recipe ? (
        <EffectPlayground key={listing.id} listing={listing} recipe={recipe}>{header}</EffectPlayground>
      ) : (
        <div className={styles.main}>
          <div className={styles.detailPreview}><p className={styles.unsupported}>{t('store.effects.unsupported')}</p></div>
          {header}
        </div>
      )}
      <ConfirmModal
        open={confirmUninstall}
        title={t('store.effects.uninstallTitle')}
        message={t('store.effects.uninstallMessage', { name: listing.name })}
        confirmLabel={t('store.effects.uninstall')}
        destructive
        onConfirm={() => { void uninstall(); }}
        onCancel={() => setConfirmUninstall(false)}
      />
      <ConfirmModal
        open={confirmUnpublish}
        title={t('store.effects.unpublishTitle')}
        message={t('store.effects.unpublishMessage', { name: listing.name })}
        confirmLabel={t('store.effects.unpublish')}
        destructive
        onConfirm={() => { void unpublish(); }}
        onCancel={() => setConfirmUnpublish(false)}
      />
    </>
  );
}

/**
 * The Marketplace's lighting effects: Shader Studio recipes other accounts
 * published. `path` is the route below `effects`: empty for the browse list,
 * `<id>` for an effect, `by/<username>` for one creator's effects.
 */
export function EffectsMarket({ path, username, onNavigate, onNeedsSignIn, onOpenInLighting }: {
  path: string;
  username: string | null;
  /** Sets the route below `effects`. */
  onNavigate: (path: string) => void;
  onNeedsSignIn: NeedsSignIn;
  onOpenInLighting?: (effectKey: string) => void;
}) {
  const [first, second] = path.split('/');
  const open = (id: string) => onNavigate(id);
  const creator = (author: string) => onNavigate(`by/${encodeURIComponent(author)}`);
  return (
    <div className={styles.root}>
      {first === 'by' && second ? (
        <CreatorEffects author={decodeURIComponent(second)} onOpen={open} onBack={() => onNavigate('')} />
      ) : first ? (
        <EffectDetail id={first} username={username} onBack={() => onNavigate('')} onCreator={creator} onNeedsSignIn={onNeedsSignIn} onOpenInLighting={onOpenInLighting} />
      ) : (
        <EffectsBrowse onOpen={open} />
      )}
    </div>
  );
}

export default EffectsMarket;
