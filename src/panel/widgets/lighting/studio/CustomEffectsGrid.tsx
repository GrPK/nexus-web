import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { EffectCard } from '../../../../components/common/EffectCard/EffectCard';
import { ConfirmModal } from '../../../../components/common/ConfirmModal/ConfirmModal';
import { customEffectKey } from '../../../../api/customEffects';
import { useEffectThumbnail } from '../../../../hooks/useEffectThumbnail';
import { useTranslation } from '../../../../lib/i18n';
import { matchesAllWords } from '../../../../search/match';
import { deleteEffect, migrateLegacyEffects, useSavedEffects, type SavedEffect } from './studioLibrary';
import pageStyles from '../LightingPage.module.scss';
import styles from './ShaderStudio.module.scss';

function CustomEffectCell({ effect, active, gpuAvailable, onSelect, onDelete }: {
  effect: SavedEffect;
  active: boolean;
  gpuAvailable: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const key = customEffectKey(effect.id);
  const url = useEffectThumbnail(key, 0, String(effect.updatedAt), !gpuAvailable);
  return (
    <EffectCard
      overlay
      asDiv
      dataEffectKey={key}
      label={effect.name}
      thumbUrl={url}
      thumbStatic={!gpuAvailable}
      active={active}
      onClick={onSelect}
      onDelete={onDelete}
      deleteAriaLabel={t('lighting.studio.delete')}
    />
  );
}

/** Saved Shader Studio effects plus a create tile, laid out like the built-in effect grid. Clicking one runs it. */
export function CustomEffectsGrid({ effect, query, gpuAvailable = true, onSelect, onCreate }: {
  /** Running effect key, highlighted when it is one of these. */
  effect: string | null;
  query: string;
  gpuAvailable?: boolean;
  onSelect: (key: string) => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  const saved = useSavedEffects();
  const [pendingDelete, setPendingDelete] = useState<SavedEffect | null>(null);
  const shown = saved.filter(s => matchesAllWords(query, [s.name]));

  useEffect(() => { void migrateLegacyEffects(); }, []);

  return (
    <div className={pageStyles.animateGridWrap}>
      <div className={pageStyles.animateGrid}>
        <div className={pageStyles.animateGridSection}>
          <button type="button" className={`${pageStyles.addSmartLights} ${styles.createTile}`} onClick={onCreate}>
            <Plus size={20} aria-hidden />
            <span>{t('lighting.studio.create')}</span>
          </button>
          {shown.map(s => (
            <CustomEffectCell
              key={s.id}
              effect={s}
              active={effect === customEffectKey(s.id)}
              gpuAvailable={gpuAvailable}
              onSelect={() => onSelect(customEffectKey(s.id))}
              onDelete={() => setPendingDelete(s)}
            />
          ))}
        </div>
        {query.trim() && shown.length === 0 && saved.length > 0 && (
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
          if (pendingDelete) void deleteEffect(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
