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
import { hiddenCalendarIds, resolveCalendarDisplay, supportsGridAndEvents, syncedText } from './calendarEvents';
import { CalendarSourceRow } from './CalendarSourceRow';
import { CalendarSourceEditor } from './CalendarSourceEditor';
import { CalendarSourceModal } from './page/CalendarSourceModal';
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
  const { grid, events: showEvents } = resolveCalendarDisplay(config, widget.size);
  const weekStart = (config?.weekStart as string | undefined) ?? 'auto';
  const showDots = config?.showDots !== false;
  // Both keys are written together so a toggle never re-derives the other from an older config shape.
  const setDisplay = (next: Partial<{ showGrid: boolean; showEvents: boolean }>) => onUpdate({ showGrid: grid, showEvents, ...next });
  // Sizes with no room for both: while one is on the other is greyed out.
  const exclusive = !supportsGridAndEvents(widget.size);
  const immersiveView = (config?.immersiveView as string | undefined) ?? 'auto';
  const hidden = hiddenCalendarIds(config);

  const { sources } = useCalendarSources();
  const { settings, setRefreshMinutes, refreshNow } = useCalendarSettings();
  const { add } = useCalendarMutations();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CalendarSourceDto | null>(null);
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
        <SettingsToggle
          label={t('panel.widget.calendar.settings.showGrid')}
          checked={grid}
          disabled={exclusive && showEvents}
          onChange={value => setDisplay({ showGrid: value })}
        />
        <SettingsToggle
          label={t('panel.widget.calendar.settings.showEvents')}
          checked={showEvents}
          disabled={exclusive && grid}
          onChange={value => setDisplay({ showEvents: value })}
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
        {grid && (
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
          <CalendarSourceRow
            key={source.id}
            name={source.name}
            color={source.color}
            isError={source.error !== null}
            description={source.error
              ? t(`panel.widget.calendar.add.error.${source.error}`)
              : syncedText(t, source.lastSyncedAt, Date.now(), t(KIND_LABEL_KEYS[source.kind]))}
            checked={!hidden.includes(source.id)}
            onChange={on => toggleCalendar(source.id, on)}
            onEdit={canAdd ? () => setEditing(source) : undefined}
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
        <CalendarSourceModal
          open={adding}
          usedColors={sources.map(s => s.color)}
          onAdd={add}
          onClose={() => setAdding(false)}
        />
      )}
      {canAdd && <CalendarSourceEditor source={editing} usedColors={sources.map(s => s.color)} onClose={() => setEditing(null)} />}
    </>
  );
}

export default CalendarSettings;
