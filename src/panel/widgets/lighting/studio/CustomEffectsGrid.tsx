import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { EffectCard } from '../../../../components/common/EffectCard/EffectCard';
import { ConfirmModal } from '../../../../components/common/ConfirmModal/ConfirmModal';
import { useTranslation } from '../../../../lib/i18n';
import { matchesAllWords } from '../../../../search/match';
import { deleteSavedEffect, putSavedEffect, useSavedEffects, type SavedEffect } from './studioLibrary';
import { renderStudioThumbnail } from './studioThumbnail';
import pageStyles from '../LightingPage.module.scss';
import styles from './ShaderStudio.module.scss';

// Entries whose thumbnail failed to render (no WebGL2, compile error); not retried this session.
const thumbFailed = new Set<string>();

/** Saved Shader Studio effects plus a create tile, laid out like the built-in effect grid. */
export function CustomEffectsGrid({ query, onCreate, onOpen }: {
  query: string;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const saved = useSavedEffects();
  const [pendingDelete, setPendingDelete] = useState<SavedEffect | null>(null);
  const shown = saved.filter(s => matchesAllWords(query, [s.name]));

  // Effects saved before thumbnails existed get one rendered once and stored.
  useEffect(() => {
    for (const s of saved) {
      if (s.thumb || thumbFailed.has(s.id)) continue;
      const thumb = renderStudioThumbnail(s.recipe);
      if (thumb) putSavedEffect({ ...s, thumb });
      else thumbFailed.add(s.id);
    }
  }, [saved]);

  return (
    <div className={pageStyles.animateGridWrap}>
      <div className={pageStyles.animateGrid}>
        <div className={pageStyles.animateGridSection}>
          <button type="button" className={`${pageStyles.addSmartLights} ${styles.createTile}`} onClick={onCreate}>
            <Plus size={20} aria-hidden />
            <span>{t('lighting.studio.create')}</span>
          </button>
          {shown.map(s => (
            <EffectCard
              key={s.id}
              overlay
              asDiv
              label={s.name}
              thumbUrl={s.thumb ?? null}
              thumbStatic
              active={false}
              onClick={() => onOpen(s.id)}
              onDelete={() => setPendingDelete(s)}
              deleteAriaLabel={t('lighting.studio.delete')}
            />
          ))}
        </div>
        {query && shown.length === 0 && saved.length > 0 && (
          <p className={pageStyles.browserHint}>{t('lighting.effects.noMatches')}</p>
        )}
      </div>
      <ConfirmModal
        open={!!pendingDelete}
        title={t('lighting.studio.deleteTitle')}
        message={t('lighting.studio.deleteMessage', { name: pendingDelete?.name ?? '' })}
        confirmLabel={t('lighting.studio.delete')}
        destructive
        onConfirm={() => {
          if (pendingDelete) deleteSavedEffect(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
