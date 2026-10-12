import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '../../../common/Button/Button';
import { ConfirmModal } from '../../../common/ConfirmModal/ConfirmModal';
import { InlineError } from '../../../common/InlineError/InlineError';
import { SettingsSection } from '../../../common/SettingsSection/SettingsSection';
import { useTranslation } from '../../../../lib/i18n';
import { useUnitPrefs } from '../../../../hooks/useUiSettings';
import { formatDate } from '../../../../lib/units';
import { listEffectDownloads, type EffectDownload } from '../../../../api/effectMarket';
import { attachRecipePreview } from '../../../../panel/widgets/lighting/studio/recipePreview';
import { deleteEffect, newEffectId, parseMarketRecipe, saveEffect, useSavedEffects } from '../../../../panel/widgets/lighting/studio/studioLibrary';
import type { StudioRecipe } from '../../../../panel/widgets/lighting/studio/studioCompiler';
import styles from './AccountPurchases.module.scss';

type RowState = 'working' | 'failed';

// Parsed once per row object, so a re-render keeps each preview's recipe identity and its canvas attached.
const parsedRecipes = new WeakMap<EffectDownload, StudioRecipe | null>();
function recipeOf(item: EffectDownload): StudioRecipe | null {
  if (item.removed) return null;
  if (!parsedRecipes.has(item)) parsedRecipes.set(item, parseMarketRecipe(item.recipe));
  return parsedRecipes.get(item)!;
}

function Preview({ recipe }: { recipe: StudioRecipe | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => (ref.current && recipe ? attachRecipePreview(ref.current, recipe) : undefined), [recipe]);
  return <canvas ref={ref} className={styles.effectThumb} aria-hidden={true} />;
}

/** Lighting effects the account downloaded from the Marketplace, removed ones included, with what this PC has of each. */
export function AccountEffectDownloadsSection({ onOpenStoreEffect }: {
  /** Opens the effect's Marketplace page. */
  onOpenStoreEffect?: (listingId: string) => void;
}) {
  const { t } = useTranslation();
  const { dateFormat } = useUnitPrefs();
  const saved = useSavedEffects();
  const [items, setItems] = useState<EffectDownload[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [pendingUninstall, setPendingUninstall] = useState<EffectDownload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listEffectDownloads().then(res => {
      if (cancelled) return;
      if (res.ok) setItems(res.value.items);
      else setLoadFailed(true);
    });
    return () => { cancelled = true; };
  }, []);

  const copiesOf = (id: string) => saved.filter(s => s.marketId === id);
  const run = async (id: string, job: () => Promise<boolean>) => {
    setRows(prev => ({ ...prev, [id]: 'working' }));
    const ok = await job();
    setRows(prev => {
      const next = { ...prev };
      if (ok) delete next[id]; else next[id] = 'failed';
      return next;
    });
  };
  const install = (item: EffectDownload, recipe: StudioRecipe) => run(item.id, async () =>
    !await saveEffect(newEffectId(), item.name, recipe, { marketId: item.id, marketAuthor: item.author, downloaded: true }));
  const uninstall = (item: EffectDownload) => run(item.id, async () =>
    (await Promise.all(copiesOf(item.id).map(s => deleteEffect(s.id)))).every(Boolean));

  const downloadedOn = (iso: string) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? ''
      : formatDate(date, dateFormat, { variant: 'year', system: { year: 'numeric', month: 'short', day: 'numeric' } });
  };

  return (
    <SettingsSection title={t('store.effects.tab')} description={t('account.effects.description')}>
      {loadFailed && <InlineError>{t('account.effects.loadFailed')}</InlineError>}
      {items?.length === 0 && <p className={styles.empty}>{t('account.effects.empty')}</p>}
      {items?.map(item => {
        const recipe = recipeOf(item);
        const installed = copiesOf(item.id).length > 0;
        const state = rows[item.id];
        const date = downloadedOn(item.downloadedAt);
        return (
          <div key={item.id} className={styles.row}>
            <Preview recipe={recipe} />
            <div className={styles.info}>
              <span className={styles.name}>{item.name}</span>
              {item.author && <span className={styles.tagline}>{t('store.effects.byAuthor', { author: item.author })}</span>}
              <ul className={styles.facts}>
                {item.removed
                  ? <li className={styles.removed}>{t('account.effects.removed')}</li>
                  : !recipe ? <li className={styles.value}>{t('store.effects.unsupported')}</li>
                    : null}
                <li className={styles.value}>{t(installed ? 'account.effects.installed' : 'account.effects.notInstalled')}</li>
                {date && <li>{t('account.effects.downloaded')} <span className={styles.value}>{date}</span></li>}
              </ul>
            </div>
            <div className={styles.actions}>
              {!installed && recipe && (
                <Button type="button" tone={state === 'failed' ? 'danger' : 'accent'} size="sm"
                  loading={state === 'working'} disabled={state === 'working'} onClick={() => { void install(item, recipe); }}>
                  {state === 'failed' ? t('store.retry') : t('store.install')}
                </Button>
              )}
              {!item.removed && onOpenStoreEffect && (
                <Button type="button" tone="neutral" size="sm" icon={<ExternalLink size={14} />} onClick={() => onOpenStoreEffect(item.id)}>
                  {t('account.purchases.viewInStore')}
                </Button>
              )}
              {installed && (
                <Button type="button" tone={state === 'failed' ? 'danger' : 'neutral'} size="sm"
                  loading={state === 'working'} disabled={state === 'working'} onClick={() => setPendingUninstall(item)}>
                  {state === 'failed' ? t('store.retry') : t('store.effects.uninstall')}
                </Button>
              )}
            </div>
          </div>
        );
      })}
      <ConfirmModal
        open={!!pendingUninstall}
        title={t('store.effects.uninstallTitle')}
        message={t('store.effects.uninstallMessage', { name: pendingUninstall?.name ?? '' })}
        confirmLabel={t('store.effects.uninstall')}
        destructive
        onConfirm={() => {
          const target = pendingUninstall;
          setPendingUninstall(null);
          if (target) void uninstall(target);
        }}
        onCancel={() => setPendingUninstall(null)}
      />
    </SettingsSection>
  );
}

export default AccountEffectDownloadsSection;
