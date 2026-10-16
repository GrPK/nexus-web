import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../common/Button/Button';
import { useTranslation } from '../../../../lib/i18n';
import type { AuthBackend } from '../../../../api/authBackend';
import { authErrorMessage } from './accountErrors';
import { RESEND_COOLDOWN_SECONDS, useResendCooldown } from './resendCooldown';
import styles from './Account.module.scss';

interface ResendVerificationProps {
  backend: AuthBackend;
  email: string;
}

// Mounts when a verification mail has just been sent, so it starts on cooldown.
export function ResendVerification({ backend, email }: ResendVerificationProps) {
  const { t } = useTranslation();
  const { remaining, start } = useResendCooldown(RESEND_COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const handleResend = async () => {
    setSending(true);
    setSent(false);
    setError(null);
    const ok = await backend.resendVerification(email);
    if (!mounted.current) return;
    setSending(false);
    start();
    if (ok) setSent(true);
    else setError(authErrorMessage(t, null));
  };

  return (
    <div className={styles.resendRow}>
      <Button
        type="button"
        size="sm"
        loading={sending}
        disabled={remaining > 0 || sending}
        onClick={() => void handleResend()}
      >
        {remaining > 0 ? t('account.verify.resendWait', { seconds: remaining }) : t('account.verify.resend')}
      </Button>
      <p
        className={error ? styles.resendError : styles.resendStatus}
        role={error ? 'alert' : 'status'}
      >
        {error ?? (sent ? t('account.verify.resendSent') : '')}
      </p>
    </div>
  );
}
