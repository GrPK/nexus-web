import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { Overlay } from '../../../../components/common/Overlay/Overlay';
import { Button } from '../../../../components/common/Button/Button';
import { TextInput } from '../../../../components/common/TextInput/TextInput';
import { ColorPickerWithPresets } from '../../../../components/common/ColorPickerWithPresets/ColorPickerWithPresets';
import { useStackOnOverflow } from '../../../../components/common/ConfirmModal/useStackOnOverflow';
import { ADD_CALENDAR_GUIDE_URL } from '../../../../lib/externalLinks';
import { CollapsibleSection } from '../../../../components/common/CollapsibleSection/CollapsibleSection';
import { TroubleshootLink } from '../../../../components/common/TroubleshootLink/TroubleshootLink';
import { CalendarRequestError, type AddCalendarInput, type CalendarAddError, type CalendarSourceDto } from '../../../../api/calendar';
import styles from './CalendarSourceModal.module.scss';

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

/** Google's public iCal address, which a calendar that is not public refuses. */
export function isGooglePublicAddress(address: string): boolean {
  return /^(https?|webcal):\/\/calendar\.google\.com\/calendar\/ical\/.+\/public\//i.test(address.trim());
}

/** The feed's host, for a default name; null when the address does not parse. */
export function hostOfAddress(address: string): string | null {
  try {
    return new URL(address.trim().replace(/^webcal:/i, 'https:')).hostname || null;
  } catch {
    return null;
  }
}

interface CalendarSourceModalProps {
  open: boolean;
  usedColors: readonly string[];
  onClose: () => void;
  // Add mode.
  onAdd?: (input: AddCalendarInput) => Promise<unknown>;
  // Edit mode: the calendar being edited, with save and remove.
  source?: CalendarSourceDto | null;
  onSave?: (patch: { name: string; color: string }) => Promise<unknown>;
  onRemove?: () => void;
}

/** The Add calendar dialog, and the same dialog in edit mode for a calendar that exists. */
export function CalendarSourceModal({ open, usedColors, onAdd, source, onSave, onRemove, onClose }: CalendarSourceModalProps) {
  const { t } = useTranslation();
  const editing = source != null;
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState(CALENDAR_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const attempt = useRef(0);
  const actionsRef = useRef<HTMLDivElement>(null);
  const errorId = useId();
  useStackOnOverflow(actionsRef, styles.stacked, open);

  useEffect(() => {
    if (!open) return;
    attempt.current += 1;
    setUrl('');
    setName(source?.name ?? '');
    setError(null);
    setBusy(false);
    setHelpOpen(false);
    setColor(source?.color ?? nextCalendarColor(usedColors));
    // Reset only on the closed to open edge; the palette pick follows the colours in use at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const changed = editing && (name.trim() !== source.name || color.toLowerCase() !== source.color.toLowerCase());
  const canSubmit = !busy && (editing ? name.trim() !== '' && changed : url.trim() !== '');

  const submit = async () => {
    if (!canSubmit) return;
    const mine = attempt.current;
    setBusy(true);
    setError(null);
    const address = url.trim();
    try {
      if (editing) await onSave?.({ name: name.trim(), color });
      else await onAdd?.({ url: address, name: name.trim() || hostOfAddress(address) || t('panel.widget.calendar'), color });
      if (attempt.current === mine) onClose();
    } catch (e) {
      if (attempt.current !== mine) return;
      if (editing) {
        setError(t('panel.widget.calendar.edit.error'));
        setBusy(false);
        return;
      }
      const code = e instanceof CalendarRequestError ? e.code : null;
      const googlePublic = (code === 'notFound' || code === 'unauthorized') && isGooglePublicAddress(address);
      setError(t(googlePublic ? 'panel.widget.calendar.add.error.googlePublic' : code ? ERROR_KEYS[code] : 'panel.widget.calendar.add.error.generic'));
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
      ariaLabel={t(editing ? 'panel.widget.calendar.edit.title' : 'panel.widget.calendar.add.title')}
    >
      <h2 className={styles.title}>{t(editing ? 'panel.widget.calendar.edit.title' : 'panel.widget.calendar.add.title')}</h2>
      <div className={styles.body}>
        {editing ? (
          <div className={styles.field}>
            <span className={styles.label}>{t('panel.widget.calendar.edit.feed')}</span>
            <span className={styles.readonly}>{source.host ?? ''}</span>
            <span className={styles.note}>{t('panel.widget.calendar.add.readOnly')}</span>
            {error && <p id={errorId} className={styles.error} role="alert">{error}</p>}
          </div>
        ) : (
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
          <span className={styles.note}>{t('panel.widget.calendar.add.readOnly')}</span>
          <CollapsibleSection compact open={helpOpen} onToggle={() => setHelpOpen(o => !o)} title={t('panel.widget.calendar.add.help.title')}>
            <div className={styles.help}>
              <p>{t('panel.widget.calendar.add.help.google')}</p>
              <p>{t('panel.widget.calendar.add.help.outlook')}</p>
              <p>{t('panel.widget.calendar.add.help.icloud')}</p>
              <p>{t('panel.widget.calendar.add.help.other')}</p>
              <TroubleshootLink label={t('panel.widget.calendar.add.help.learnMore')} href={ADD_CALENDAR_GUIDE_URL} />
            </div>
          </CollapsibleSection>
        </div>
        )}
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
      </div>
      <div ref={actionsRef} className={styles.actions}>
        <Button tone="neutral" size="md" onClick={onClose}>{t('confirm.cancel')}</Button>
        <div className={styles.actionsEnd}>
          {editing && onRemove && (
            <Button tone="danger" size="md" onClick={onRemove} disabled={busy}>{t('panel.widget.calendar.remove.title')}</Button>
          )}
          <Button tone="accent" size="md" onClick={() => { void submit(); }} disabled={!canSubmit} loading={busy}>
            {t(editing ? 'panel.widget.calendar.edit.save' : 'panel.widget.calendar.add.confirm')}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
