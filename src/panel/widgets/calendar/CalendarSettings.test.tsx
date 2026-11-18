import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarSourceDto } from '../../../api/calendar';
import type { PanelSurface, PanelWidget } from '../../types';
import { CalendarSettings } from './CalendarSettings';

const hooks = vi.hoisted(() => ({
  sources: [] as CalendarSourceDto[],
  refreshNow: vi.fn(() => Promise.resolve()),
  setRefreshMinutes: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../hooks/useCalendar', () => ({
  useCalendarSources: () => ({ sources: hooks.sources, loaded: true }),
  useCalendarSettings: () => ({
    settings: { refreshMinutes: 15, lastSyncedAt: null, syncing: false },
    setRefreshMinutes: hooks.setRefreshMinutes,
    refreshNow: hooks.refreshNow,
  }),
  useCalendarMutations: () => ({ add: vi.fn(), remove: vi.fn(), update: vi.fn() }),
}));

vi.mock('../../../components/common/Select/Select', () => ({
  Select: ({ value, onChange, options, ariaLabel }: {
    value: string; onChange: (v: string) => void; options?: { value: string; label: string }[]; ariaLabel?: string;
  }) => (
    <select aria-label={ariaLabel} value={value} onChange={e => onChange(e.target.value)}>
      {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => (params && Object.keys(params).length > 0 ? `${key}|${Object.values(params).join('|')}` : key),
    language: 'en',
  }),
}));

const source = (id: string): CalendarSourceDto => ({
  id, kind: 'ics', name: `Cal ${id}`, color: '#8b7cff', host: null, lastSyncedAt: null, status: 'ok', error: null,
});

const widget = (config?: Record<string, unknown>): PanelWidget => ({ id: 'w', type: 'calendar', size: '4x2', col: 0, row: 0, config } as PanelWidget);

function renderSettings(opts: { surface?: PanelSurface; desktopEditor?: boolean; config?: Record<string, unknown> }) {
  const onUpdate = vi.fn();
  render(
    <CalendarSettings
      widget={widget(opts.config)}
      surface={opts.surface}
      desktopEditor={opts.desktopEditor}
      onUpdate={onUpdate}
      onResize={vi.fn()}
    />,
  );
  return onUpdate;
}

beforeEach(() => {
  hooks.sources = [source('a'), source('b')];
  hooks.refreshNow.mockClear();
});

describe('CalendarSettings', () => {
  it('offers Add calendar on a pointer surface', () => {
    renderSettings({ surface: 'desktop' });
    expect(screen.getByText('panel.widget.calendar.add.button')).toBeTruthy();
  });

  it.each(['y70', 'phone'] as const)('hides Add calendar on the %s touch surface, keeping toggles and refresh', surface => {
    renderSettings({ surface });
    expect(screen.queryByText('panel.widget.calendar.add.button')).toBeNull();
    expect(screen.getAllByRole('switch').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('panel.widget.calendar.settings.refreshNow')).toBeTruthy();
    expect(screen.getByLabelText('panel.widget.calendar.settings.refreshEvery')).toBeTruthy();
  });

  it('keeps Add calendar in the desktop editor even for a touch panel', () => {
    renderSettings({ surface: 'y70', desktopEditor: true });
    expect(screen.getByText('panel.widget.calendar.add.button')).toBeTruthy();
  });

  it('stores hidden calendars as opaque ids only', () => {
    const onUpdate = renderSettings({ surface: 'desktop' });
    const toggle = screen.getByRole('switch', { name: /Cal a/ });
    fireEvent.click(toggle);
    expect(onUpdate).toHaveBeenCalledWith({ hiddenCalendars: ['a'] });
  });

  it('turns a hidden calendar back on', () => {
    const onUpdate = renderSettings({ surface: 'desktop', config: { hiddenCalendars: ['a', 'b'] } });
    fireEvent.click(screen.getByRole('switch', { name: /Cal a/ }));
    expect(onUpdate).toHaveBeenCalledWith({ hiddenCalendars: ['b'] });
  });

  it('writes both display toggles together and shows the dots toggle only with the grid on', () => {
    const onUpdate = renderSettings({ surface: 'desktop', config: { showGrid: false, showEvents: true } });
    expect(screen.queryByRole('switch', { name: 'panel.widget.calendar.settings.showDots' })).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'panel.widget.calendar.settings.showGrid' }));
    expect(onUpdate).toHaveBeenCalledWith({ showGrid: true, showEvents: true });
  });

  it('turns events off while keeping the grid, starting from a legacy showGrid', () => {
    const onUpdate = renderSettings({ surface: 'desktop', config: { showGrid: true } });
    expect(screen.getByRole('switch', { name: 'panel.widget.calendar.settings.showDots' })).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'panel.widget.calendar.settings.showEvents' }));
    expect(onUpdate).toHaveBeenCalledWith({ showGrid: true, showEvents: false });
  });

  it('offers an edit button per calendar on a pointer surface only', () => {
    renderSettings({ surface: 'desktop' });
    expect(screen.getAllByRole('button', { name: /panel.widget.calendar.edit.button/ })).toHaveLength(2);
  });

  it.each(['y70', 'phone'] as const)('has no edit button on the %s touch surface', surface => {
    renderSettings({ surface });
    expect(screen.queryByRole('button', { name: /panel.widget.calendar.edit.button/ })).toBeNull();
  });

  it('keeps edit in the desktop editor for a touch panel', () => {
    renderSettings({ surface: 'y70', desktopEditor: true });
    expect(screen.getAllByRole('button', { name: /panel.widget.calendar.edit.button/ })).toHaveLength(2);
  });

  it('refreshes every calendar from one button', () => {
    renderSettings({ surface: 'y70' });
    fireEvent.click(screen.getByText('panel.widget.calendar.settings.refreshNow'));
    expect(hooks.refreshNow).toHaveBeenCalledTimes(1);
  });

  it('changes the service-wide refresh interval', () => {
    renderSettings({ surface: 'desktop' });
    fireEvent.change(screen.getByLabelText('panel.widget.calendar.settings.refreshEvery'), { target: { value: '30' } });
    expect(hooks.setRefreshMinutes).toHaveBeenCalledWith(30);
  });
});
