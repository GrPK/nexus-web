import { Trash2 } from 'lucide-react';
import { useTranslation } from '../../../../lib/i18n';
import {
  CALENDAR_REFRESH_OPTIONS, DEFAULT_REFRESH_MINUTES, type CalendarRefreshMinutes, type CalendarSettingsDto, type CalendarSourceDto,
} from '../../../../api/calendar';
import { Button } from '../../../../components/common/Button/Button';
import { Checkbox } from '../../../../components/common/Checkbox/Checkbox';
import { IconLabelButton } from '../../../../components/common/IconLabelButton/IconLabelButton';
import { MiniMonth } from '../../../../components/common/MiniMonth/MiniMonth';
import { Select } from '../../../../components/common/Select/Select';
import { SettingsSection } from '../../../../components/common/SettingsSection/SettingsSection';
import { syncedText } from '../calendarEvents';
import styles from './CalendarRail.module.scss';

const REFRESH_LABEL_KEYS: Record<CalendarRefreshMinutes, string> = {
  5: 'panel.widget.calendar.refresh.min5',
  15: 'panel.widget.calendar.refresh.min15',
  30: 'panel.widget.calendar.refresh.min30',
  60: 'panel.widget.calendar.refresh.hour1',
};

interface Props {
  miniMonth: number;
  selected: number;
  today: number;
  weekStart: 0 | 1;
  highlightWeek: boolean;
  onSelectDay: (day: number) => void;
  onMonthChange: (delta: number) => void;
  sources: readonly CalendarSourceDto[];
  hidden: readonly string[];
  onToggle: (id: string, visible: boolean) => void;
  onRemove: (source: CalendarSourceDto) => void;
  settings: CalendarSettingsDto | null;
  onRefreshMinutes: (value: CalendarRefreshMinutes) => void;
  onRefreshNow: () => void;
  refreshing: boolean;
  now: number;
}

export function CalendarRail({
  miniMonth, selected, today, weekStart, highlightWeek, onSelectDay, onMonthChange, sources, hidden, onToggle, onRemove,
  settings, onRefreshMinutes, onRefreshNow, refreshing, now,
}: Props) {
  const { t } = useTranslation();

  return (
    <aside className={styles.rail}>
      <div className={styles.mini}>
        <MiniMonth
          month={miniMonth}
          selected={selected}
          today={today}
          weekStart={weekStart}
          highlightWeek={highlightWeek}
          onSelect={onSelectDay}
          onMonthChange={onMonthChange}
        />
      </div>
      <SettingsSection title={t('panel.widget.calendar.settings.calendars')}>
        {sources.map(source => (
          <div key={source.id} className={styles.sourceRow}>
            <Checkbox
              className={styles.sourceCheck}
              checked={!hidden.includes(source.id)}
              onChange={visible => onToggle(source.id, visible)}
              label={(
                <span className={styles.sourceText} style={{ ['--cal-color' as string]: source.color }}>
                  <span className={styles.name}><span className={styles.dot} />{source.name}</span>
                  <small className={source.error ? styles.error : undefined}>
                    {source.error ? t(`panel.widget.calendar.add.error.${source.error}`) : syncedText(t, source.lastSyncedAt, now)}
                  </small>
                </span>
              )}
            />
            <IconLabelButton
              variant="bare"
              icon={<Trash2 size={15} aria-hidden />}
              ariaLabel={t('panel.widget.calendar.remove.button', { name: source.name })}
              title={t('panel.widget.calendar.remove.title')}
              onPress={() => onRemove(source)}
            />
          </div>
        ))}
        <div className={styles.refresh}>
          <span className={styles.refreshLabel}>{t('panel.widget.calendar.settings.refreshEvery')}</span>
          <Select
            ariaLabel={t('panel.widget.calendar.settings.refreshEvery')}
            value={String(settings?.refreshMinutes ?? DEFAULT_REFRESH_MINUTES)}
            options={CALENDAR_REFRESH_OPTIONS.map(m => ({ value: String(m), label: t(REFRESH_LABEL_KEYS[m]) }))}
            onChange={value => onRefreshMinutes(Number(value) as CalendarRefreshMinutes)}
          />
          <div className={styles.refreshRow}>
            <span>{syncedText(t, settings?.lastSyncedAt ?? null, now)}</span>
            <Button size="sm" tone="neutral" onClick={onRefreshNow} loading={refreshing || settings?.syncing === true}>
              {t('panel.widget.calendar.settings.refreshNow')}
            </Button>
          </div>
        </div>
      </SettingsSection>
    </aside>
  );
}
