import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { Overlay } from '../../../../components/common/Overlay/Overlay';
import { Button } from '../../../../components/common/Button/Button';
import { TextInput } from '../../../../components/common/TextInput/TextInput';
import { ColorPickerWithPresets } from '../../../../components/common/ColorPickerWithPresets/ColorPickerWithPresets';
import { useStackOnOverflow } from '../../../../components/common/ConfirmModal/useStackOnOverflow';
import { CalendarRequestError, type AddCalendarInput, type CalendarAddError } from '../../../../api/calendar';
import styles from './AddCalendarModal.module.scss';

const ADDRESS_PLACEHOLDER = 'https://example.com/calendar.ics';

export const CALENDAR_COLORS: readonly string[] = [
  '#8b7cff', '#ff9f0a', '#32d74b', '#0a84ff', '#ff453a', '#bf5af2', '#64d2ff', '#ffd60a',
];

const ERROR_KEYS: Record<CalendarAddError, string> = {
  unreachable: 'panel.widget.calendar.add.error.unreachable',
  unauthorized: 'panel.widget.calendar.add.error.unauthorized',
  notFound: 'panel.widget.calendar.add.error.notFound',
  notIcs: 'panel.widget.calendar.add.error.notIcs',
  tooLarge: 'panel.widget.calendar.add.error.tooLarge',
  invalidUrl: 'panel.widget.calendar.add.error.invalidUrl',
};

/** The first palette colour no existing calendar uses, else the first. */
export function nextCalendarColor(used: readonly string[]): string {
  const taken = new Set(used.map(c => c.toLowerCase()));
  return CALENDAR_COLORS.find(c => !taken.has(c)) ?? CALENDAR_COLORS[0];
}

/** The feed's host, for a default name; null when the address does not parse. */
export function hostOfAddress(address: string): string | null {
  try {
    return new URL(address.trim().replace(/^webcal:/i, 'https:')).hostname || null;
  } catch {
    return null;
  }
}

interface AddCalendarModalProps {
  open: boolean;
  usedColors: readonly string[];
  onAdd: (input: AddCalendarInput) => Promise<unknown>;
  onClose: () => void;
}

export function AddCalendarModal({ open, usedColors, onAdd, onClose }: AddCalendarModalProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState(CALENDAR_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const attempt = useRef(0);
  const actionsRef = useRef<HTMLDivElement>(null);
  const errorId = useId();
  useStackOnOverflow(actionsRef, styles.stacked, open);

  useEffect(() => {
    if (!open) return;
    attempt.current += 1;
    setUrl('');
    setName('');
    setError(null);
    setBusy(false);
    setColor(nextCalendarColor(usedColors));
    // Reset only on the closed to open edge; the palette pick follows the colours in use at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const canSubmit = url.trim() !== '' && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    const mine = attempt.current;
    setBusy(true);
    setError(null);
    const address = url.trim();
    try {
      await onAdd({ url: address, name: name.trim() || hostOfAddress(address) || t('panel.widget.calendar'), color });
      if (attempt.current === mine) onClose();
    } catch (e) {
      if (attempt.current !== mine) return;
      const code = e instanceof CalendarRequestError ? e.code : null;
      setError(t(code ? ERROR_KEYS[code] : 'panel.widget.calendar.add.error.generic'));
      setBusy(false);
    }
  };

  return (
    <Overlay
      open={open}
      onClose={onClose}
      variant="alert"
      onEnter={() => { void submit(); }}
      backdropClassName={styles.backdrop}
      className={styles.modal}
      ariaLabel={t('panel.widget.calendar.add.title')}
    >
      <h2 className={styles.title}>{t('panel.widget.calendar.add.title')}</h2>
      <div className={styles.body}>
        <div className={styles.field}>
          <span className={styles.label}>{t('panel.widget.calendar.add.address')}</span>
          <TextInput
            value={url}
            placeholder={ADDRESS_PLACEHOLDER}
            ariaLabel={t('panel.widget.calendar.add.address')}
            onInput={value => { setUrl(value); setError(null); }}
            invalid={error !== null}
            autoComplete="off"
          />
          {error && <p id={errorId} className={styles.error} role="alert">{error}</p>}
        </div>
        <div className={styles.field}>
          <span className={styles.label}>{t('panel.widget.calendar.add.name')}</span>
          <TextInput
            value={name}
            maxLength={60}
            ariaLabel={t('panel.widget.calendar.add.name')}
            onInput={setName}
            autoComplete="off"
          />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>{t('panel.widget.calendar.add.color')}</span>
          <ColorPickerWithPresets
            value={color}
            presets={CALENDAR_COLORS}
            onCommit={setColor}
            className={styles.swatches}
          />
        </div>
        <div className={styles.account}>
          <span className={styles.label}>{t('panel.widget.calendar.add.accountLabel')}</span>
          <div className={styles.accountRow}>
            <Button tone="neutral" size="sm" disabled>{t('panel.widget.calendar.add.signIn')}</Button>
            <span className={styles.soon}>{t('panel.widget.calendar.add.comingLater')}</span>
          </div>
        </div>
      </div>
      <div ref={actionsRef} className={styles.actions}>
        <Button tone="neutral" size="md" onClick={onClose}>{t('confirm.cancel')}</Button>
        <div className={styles.actionsEnd}>
          <Button tone="accent" size="md" onClick={() => { void submit(); }} disabled={!canSubmit} loading={busy}>
            {t('panel.widget.calendar.add.confirm')}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
