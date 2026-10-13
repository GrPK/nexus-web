import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { Button } from '../../../components/common/Button/Button';
import { ConfirmModal } from '../../../components/common/ConfirmModal/ConfirmModal';

interface RemoveFromLeaderboardProps {
  /** Deletes the entry; resolves true once it is gone. */
  remove: () => Promise<boolean>;
  onRemoved: () => void;
}

/** Removes one of the user's own leaderboard entries after a confirm. Shared with the Build portal through @app. */
export function RemoveFromLeaderboard({ remove, onRemoved }: RemoveFromLeaderboardProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  // A failure that lands after a cancel must not resurface on the next open.
  const openRef = useRef(false);

  const show = () => {
    openRef.current = true;
    setOpen(true);
  };

  const close = () => {
    openRef.current = false;
    setOpen(false);
    setFailed(false);
  };

  const confirm = async () => {
    setPending(true);
    setFailed(false);
    const removed = await remove();
    setPending(false);
    if (removed) {
      close();
      onRemoved();
    } else if (openRef.current) {
      setFailed(true);
    }
  };

  return (
    <>
      <Button tone="ghost" icon={<Trash2 size={14} />} onClick={show}>
        {t('benchmark.remove.action')}
      </Button>
      <ConfirmModal
        open={open}
        title={t('benchmark.remove.title')}
        message={t('benchmark.remove.message')}
        note={failed ? t('benchmark.remove.failed') : undefined}
        // eslint-disable-next-line i18next/no-literal-string -- enum tone value, not user-facing text
        noteTone="critical"
        confirmLabel={t('benchmark.remove.confirm')}
        confirmDisabled={pending}
        onConfirm={() => { void confirm(); }}
        onCancel={close}
      />
    </>
  );
}
