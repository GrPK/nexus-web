import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { WidgetSettingsProps } from '../types';
import { surfaceInputMode } from '../../types';
import { useTranslation } from '../../../lib/i18n';
import {
  CALENDAR_REFRESH_OPTIONS, DEFAULT_REFRESH_MINUTES, type CalendarRefreshMinutes, type CalendarSourceDto,
} from '../../../api/calendar';
import { useCalendarMutations, useCalendarSettings, useCalendarSources } from '../../../hooks/useCalendar';
import { Button } from '../../../components/common/Button/Button';
import { SettingRow } from '../../../components/common/SettingRow/SettingRow';
import { SettingsSection, SettingsToggle, SettingsSelect } from '../common/SettingsRow/SettingsRow';
import { hiddenCalendarIds, resolveCalendarView, syncedText } from './calendarEvents';
import { AddCalendarModal } from './page/AddCalendarModal';
import styles from './CalendarSettings.module.scss';

const REFRESH_LABEL_KEYS: Record<CalendarRefreshMinutes, string> = {
  5: 'panel.widget.calendar.refresh.min5',
  15: 'panel.widget.calendar.refresh.min15',
  30: 'panel.widget.calendar.refresh.min30',
  60: 'panel.widget.calendar.refresh.hour1',
};

const KIND_LABEL_KEYS: Record<CalendarSourceDto['kind'], string> = {
  ics: 'panel.widget.calendar.kind.ics',
  google: 'panel.widget.calendar.kind.google',
  microsoft: 'panel.widget.calendar.kind.microsoft',
};

export function CalendarSettings({ widget, surface, deviceTouch, desktopEditor, onUpdate }: WidgetSettingsProps) {
  const { t } = useTranslation();
  const config = widget.config;
  const view = resolveCalendarView(config);
  const weekStart = (config?.weekStart as string | undefined) ?? 'auto';
  const showDots = config?.showDots !== false;
  const immersiveView = (config?.immersiveView as string | undefined) ?? 'auto';
  const hidden = hiddenCalendarIds(config);

  const { sources } = useCalendarSources();
  const { settings, setRefreshMinutes, refreshNow } = useCalendarSettings();
  const { add } = useCalendarMutations();
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Adding needs a keyboard: the desktop editor has one even when it edits a touch panel's layout.
  const canAdd = desktopEditor === true || !surface || surfaceInputMode(surface, deviceTouch) !== 'touch';

  const toggleCalendar = (id: string, on: boolean) => {
    const next = on ? hidden.filter(h => h !== id) : [...hidden.filter(h => h !== id), id];
    onUpdate({ hiddenCalendars: next });
  };

  const doRefresh = async () => {
    setRefreshing(true);
    try { await refreshNow(); } catch { /* the sync status row reports the outcome */ } finally { setRefreshing(false); }
  };

  return (
    <>
      <SettingsSection title={t('panel.widget.calendar.settings.display')}>
        <SettingsSelect
          label={t('panel.widget.calendar.settings.view')}
          value={view}
          options={[
            // eslint-disable-next-line i18next/no-literal-string -- enum value
            { value: 'date', label: t('panel.widget.calendar.settings.viewDate') },
            // eslint-disable-next-line i18next/no-literal-string -- enum value
            { value: 'next', label: t('panel.widget.calendar.settings.viewNext') },
            // eslint-disable-next-line i18next/no-literal-string -- enum value
            { value: 'month', label: t('panel.widget.calendar.settings.viewMonth') },
          ]}
          onChange={value => onUpdate({ view: value })}
        />
        <SettingsSelect
          label={t('panel.widget.calendar.settings.weekStart')}
          value={weekStart}
          options={[
            // eslint-disable-next-line i18next/no-literal-string -- enum value
            { value: 'auto', label: t('panel.widget.calendar.settings.weekStartAuto') },
            // eslint-disable-next-line i18next/no-literal-string -- enum value
            { value: 'sunday', label: t('panel.widget.calendar.settings.weekStartSunday') },
            // eslint-disable-next-line i18next/no-literal-string -- enum value
            { value: 'monday', label: t('panel.widget.calendar.settings.weekStartMonday') },
          ]}
          onChange={value => onUpdate({ weekStart: value })}
        />
        {view === 'month' && (
          <SettingsToggle
            label={t('panel.widget.calendar.settings.showDots')}
            checked={showDots}
            onChange={value => onUpdate({ showDots: value })}
          />
        )}
        <SettingsSelect
          label={t('panel.widget.calendar.settings.immersiveView')}
          value={immersiveView}
          options={[
            // eslint-disable-next-line i18next/no-literal-string -- enum value
            { value: 'auto', label: t('panel.widget.calendar.settings.immersiveAuto') },
            // eslint-disable-next-line i18next/no-literal-string -- enum value
            { value: 'day', label: t('panel.widget.calendar.view.day') },
            // eslint-disable-next-line i18next/no-literal-string -- enum value
            { value: 'week', label: t('panel.widget.calendar.view.week') },
            // eslint-disable-next-line i18next/no-literal-string -- enum value
            { value: 'month', label: t('panel.widget.calendar.view.month') },
            // eslint-disable-next-line i18next/no-literal-string -- enum value
            { value: 'list', label: t('panel.widget.calendar.view.list') },
          ]}
          onChange={value => onUpdate({ immersiveView: value })}
        />
      </SettingsSection>

      <SettingsSection title={t('panel.widget.calendar.settings.calendars')}>
        {sources.map(source => (
          <SettingsToggle
            key={source.id}
            label={source.name}
            icon={<span className={styles.dot} style={{ background: source.color }} />}
            description={source.error
              ? t(`panel.widget.calendar.add.error.${source.error}`)
              : syncedText(t, source.lastSyncedAt, Date.now(), t(KIND_LABEL_KEYS[source.kind]))}
            checked={!hidden.includes(source.id)}
            onChange={on => toggleCalendar(source.id, on)}
          />
        ))}
        <SettingsSelect
          label={t('panel.widget.calendar.settings.refreshEvery')}
          value={String(settings?.refreshMinutes ?? DEFAULT_REFRESH_MINUTES)}
          options={CALENDAR_REFRESH_OPTIONS.map(m => ({ value: String(m), label: t(REFRESH_LABEL_KEYS[m]) }))}
          onChange={value => { void setRefreshMinutes(Number(value) as CalendarRefreshMinutes).catch(() => undefined); }}
        />
        <SettingRow
          label={syncedText(t, settings?.lastSyncedAt ?? null, Date.now())}
          description={t('panel.widget.calendar.settings.refreshHint')}
        >
          <Button size="sm" tone="neutral" onClick={() => { void doRefresh(); }} loading={refreshing || settings?.syncing === true}>
            {t('panel.widget.calendar.settings.refreshNow')}
          </Button>
        </SettingRow>
        {canAdd && (
          <div className={styles.addRow} data-settings-aside="true">
            <Button size="sm" tone="neutral" icon={<Plus size={16} aria-hidden />} onClick={() => setAdding(true)}>
              {t('panel.widget.calendar.add.button')}
            </Button>
          </div>
        )}
      </SettingsSection>

      {canAdd && (
        <AddCalendarModal
          open={adding}
          usedColors={sources.map(s => s.color)}
          onAdd={add}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}

export default CalendarSettings;
