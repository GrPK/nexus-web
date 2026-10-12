import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Download, User } from 'lucide-react';
import { Button } from '../../common/Button/Button';
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
import { attachRecipePreview } from '../../../panel/widgets/lighting/studio/recipePreview';
import { newEffectId, parseMarketRecipe, saveEffect, useSavedEffects } from '../../../panel/widgets/lighting/studio/studioLibrary';
import type { StudioRecipe } from '../../../panel/widgets/lighting/studio/studioCompiler';
import storeStyles from './StorePage.module.scss';
import styles from './EffectsMarket.module.scss';

type NeedsSignIn = (retry: () => void) => void;

const SEARCH_DEBOUNCE_MS = 300;
const SORT_POPULAR: EffectSort = 'popular';
const SORT_NEW: EffectSort = 'new';

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
  return (n: number) => t(pluralKey('store.effects.downloads', language, n), { count: n.toLocaleString(language) });
}

function EffectTile({ listing, onOpen }: { listing: EffectListing; onOpen: () => void }) {
  const { t } = useTranslation();
  const downloads = useDownloadsLabel();
  const recipe = recipeOf(listing);
  return (
    <EffectCard
      label={listing.name}
      meta={`${t('store.effects.byAuthor', { author: listing.author })} · ${downloads(listing.downloads)}`}
      thumbUrl={null}
      thumbStatic
      thumbOverlay={recipe ? <RecipeCanvas recipe={recipe} className={styles.tileCanvas} /> : null}
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

const ERROR_KEYS: Partial<Record<EffectMarketError, string>> = {
  unavailable: 'store.effects.unavailable',
  not_found: 'store.effects.gone',
};

function EffectDetail({ id, username, onBack, onCreator, onNeedsSignIn }: {
  id: string;
  /** The signed-in account's username; null when signed out. */
  username: string | null;
  onBack: () => void;
  onCreator: (author: string) => void;
  onNeedsSignIn: NeedsSignIn;
}) {
  const { t } = useTranslation();
  const downloads = useDownloadsLabel();
  const [listing, setListing] = useState<EffectListing | null>(null);
  const [loadError, setLoadError] = useState<EffectMarketError | null>(null);
  const [state, setState] = useState<'idle' | 'working' | 'failed'>('idle');
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
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
  const added = saved.some(s => s.marketId === id);
  const mine = !!listing && !!username && listing.author.toLowerCase() === username.toLowerCase();

  const get = async () => {
    setState('working');
    const res = await downloadEffect(id);
    if (!res.ok) {
      setState(res.error === 'sign_in_required' ? 'idle' : 'failed');
      if (res.error === 'sign_in_required') onNeedsSignIn(() => { void get(); });
      return;
    }
    setListing(res.value);
    const parsed = recipeOf(res.value);
    const error = parsed
      ? await saveEffect(newEffectId(), res.value.name, parsed, { marketId: res.value.id, marketAuthor: res.value.author })
      : 'unsupported';
    setState(error ? 'failed' : 'idle');
  };

  const unpublish = async () => {
    setConfirmUnpublish(false);
    const res = await unpublishEffect(id);
    if (res.ok) onBack(); else setUnpublishFailed(true);
  };

  if (loadError) return <><BackBar onBack={onBack} /><div className={storeStyles.notice}>{t(ERROR_KEYS[loadError] ?? 'store.unavailable')}</div></>;
  if (!listing) return <div className={storeStyles.notice}>{t('store.loading')}</div>;

  return (
    <>
      <BackBar onBack={onBack} />
      <div className={styles.detailPreview}>
        {recipe
          ? <RecipeCanvas recipe={recipe} className={styles.detailCanvas} />
          : <p className={styles.unsupported}>{t('store.effects.unsupported')}</p>}
      </div>
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
          ) : added ? (
            <Button tone="neutral" disabled>{t('store.effects.added')}</Button>
          ) : (
            <Button tone="accent" loading={state === 'working'} disabled={!recipe || state === 'working'} onClick={() => { void get(); }}>
              {state === 'failed' ? t('store.retry') : t('store.effects.get')}
            </Button>
          )}
        </div>
        {(added || mine) && <span className={storeStyles.installedVersion}>{t('store.effects.whereToFind')}</span>}
        {state === 'failed' && <InlineError>{t('store.effects.getFailed')}</InlineError>}
        {unpublishFailed && <InlineError>{t('store.effects.unpublishFailed')}</InlineError>}
      </header>
      {listing.description && (
        <section className={storeStyles.section}>
          <h2 className={storeStyles.sectionTitle}>{t('store.section.description')}</h2>
          <p className={`${styles.description} selectable`}>{listing.description}</p>
        </section>
      )}
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
export function EffectsMarket({ path, username, onNavigate, onNeedsSignIn }: {
  path: string;
  username: string | null;
  /** Sets the route below `effects`. */
  onNavigate: (path: string) => void;
  onNeedsSignIn: NeedsSignIn;
}) {
  const [first, second] = path.split('/');
  const open = (id: string) => onNavigate(id);
  const creator = (author: string) => onNavigate(`by/${encodeURIComponent(author)}`);
  return (
    <div className={styles.root}>
      {first === 'by' && second ? (
        <CreatorEffects author={decodeURIComponent(second)} onOpen={open} onBack={() => onNavigate('')} />
      ) : first ? (
        <EffectDetail id={first} username={username} onBack={() => onNavigate('')} onCreator={creator} onNeedsSignIn={onNeedsSignIn} />
      ) : (
        <EffectsBrowse onOpen={open} />
      )}
    </div>
  );
}

export default EffectsMarket;
