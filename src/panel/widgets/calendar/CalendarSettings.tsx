import type { WidgetSettingsProps } from '../types';
import { surfaceInputMode } from '../../types';
import { useTranslation } from '../../../lib/i18n';
import { SettingsSection, SettingsToggle, SettingsSelect } from '../common/SettingsRow/SettingsRow';
import { hiddenCalendarIds, resolveCalendarDisplay, supportsGridAndEvents } from './calendarEvents';
import { CalendarSourcesSections } from './CalendarSourcesSections';

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

  // Adding needs a keyboard: the desktop editor has one even when it edits a touch panel's layout.
  const canAdd = desktopEditor === true || !surface || surfaceInputMode(surface, deviceTouch) !== 'touch';

  const toggleCalendar = (id: string, on: boolean) => {
    const next = on ? hidden.filter(h => h !== id) : [...hidden.filter(h => h !== id), id];
    onUpdate({ hiddenCalendars: next });
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

      <CalendarSourcesSections hidden={hidden} onToggle={toggleCalendar} canEdit={canAdd} />
    </>
  );
}

export default CalendarSettings;
