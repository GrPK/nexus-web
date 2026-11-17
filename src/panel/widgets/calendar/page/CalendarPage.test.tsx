import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarRequestError, type CalendarSourceDto } from '../../../../api/calendar';
import { normalizeEvent, type CalEvent } from '../calendarEvents';
import { timedEvent } from '../calendarPreviewData';
import { CalendarPage } from './CalendarPage';

const store = vi.hoisted(() => ({
  sources: [] as CalendarSourceDto[],
  events: [] as CalEvent[],
  hiddenSeen: [] as string[][],
  add: vi.fn(),
  remove: vi.fn(),
  refreshNow: vi.fn(() => Promise.resolve()),
  setRefreshMinutes: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/useCalendar', () => ({
  useCalendarSources: () => ({ sources: store.sources, loaded: true }),
  useCalendarEvents: (_f: number, _t: number, hidden: readonly string[] = []) => {
    store.hiddenSeen.push([...hidden]);
    return { events: store.events.filter(e => !hidden.includes(e.calendarId)), syncedAt: null, loaded: true };
  },
  useCalendarSettings: () => ({
    settings: { refreshMinutes: 15, lastSyncedAt: null, syncing: false },
    setRefreshMinutes: store.setRefreshMinutes,
    refreshNow: store.refreshNow,
  }),
  useCalendarMutations: () => ({ add: store.add, remove: store.remove }),
}));

vi.mock('../../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => (params && Object.keys(params).length > 0 ? `${key}|${Object.values(params).join('|')}` : key),
    language: 'en',
  }),
}));

vi.mock('../../../../components/common/Select/Select', () => ({
  Select: ({ value, onChange, options, ariaLabel }: {
    value: string; onChange: (v: string) => void; options?: { value: string; label: string }[]; ariaLabel?: string;
  }) => (
    <select aria-label={ariaLabel} value={value} onChange={e => onChange(e.target.value)}>
      {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

const NOW = new Date(2026, 10, 17, 14, 35).getTime();
const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).getTime();
const source = (id: string, name: string, color: string): CalendarSourceDto => ({
  id, kind: 'ics', name, color, host: null, lastSyncedAt: null, status: 'ok', error: null,
});

function ev(id: string, cal: string, title: string, day: number, sh: number, eh: number, extra: Partial<CalEvent> = {}): CalEvent {
  return { ...normalizeEvent(timedEvent(id, cal, title, at(day, sh), at(day, eh))), ...extra };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  window.localStorage.clear();
  store.sources = [source('work', 'Work', '#8b7cff'), source('home', 'Home', '#ff9f0a')];
  store.events = [
    ev('1', 'work', 'Design review', 17, 14, 15, { location: 'Studio', notes: 'Bring the mockups' }),
    ev('2', 'home', 'Pick up Leo', 17, 16, 17),
  ];
  store.hiddenSeen = [];
  store.add.mockReset();
  store.remove.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CalendarPage', () => {
  it('opens a read-only popover from an event and closes it on Escape', () => {
    render(<CalendarPage tab="day" />);
    fireEvent.click(screen.getByRole('button', { name: 'Design review' }));
    const dialog = screen.getByRole('dialog', { name: 'Design review' });
    expect(within(dialog).getByText('Studio')).toBeTruthy();
    expect(within(dialog).getByText('Bring the mockups')).toBeTruthy();
    expect(within(dialog).getByText('Work')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Design review' })).toBeNull();
  });

  it('toggles the popover when the same event is pressed twice', () => {
    render(<CalendarPage tab="day" />);
    const chip = screen.getByRole('button', { name: 'Design review' });
    fireEvent.click(chip);
    fireEvent.click(chip);
    expect(screen.queryByRole('dialog', { name: 'Design review' })).toBeNull();
  });

  it('folds a crowded month cell into "+N more" and lists the whole day from it', () => {
    store.events = [
      ev('1', 'work', 'One', 17, 8, 9), ev('2', 'work', 'Two', 17, 9, 10), ev('3', 'home', 'Three', 17, 10, 11),
      ev('4', 'home', 'Four', 17, 11, 12), ev('5', 'work', 'Five', 17, 12, 13), ev('6', 'work', 'Six', 17, 13, 14),
      ev('7', 'work', 'Seven', 17, 14, 15), ev('8', 'work', 'Eight', 17, 15, 16), ev('9', 'work', 'Nine', 17, 16, 17),
    ];
    render(<CalendarPage tab="month" />);
    const more = screen.getAllByRole('button').find(b => b.getAttribute('aria-label')?.startsWith('panel.widget.calendar.moreCount'));
    expect(more).toBeTruthy();
    fireEvent.click(more!);
    const dialog = screen.getAllByRole('dialog')[0];
    expect(within(dialog).getAllByRole('button').length).toBe(9);
  });

  it('hides a calendar from the view only, and remembers the choice', () => {
    render(<CalendarPage tab="day" />);
    expect(screen.getByRole('button', { name: 'Pick up Leo' })).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /Home/ }));
    expect(screen.queryByRole('button', { name: 'Pick up Leo' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Design review' })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem('nexus.calendar.hiddenCalendars') ?? '[]')).toEqual(['home']);
  });

  it('starts with the saved hidden calendars', () => {
    window.localStorage.setItem('nexus.calendar.hiddenCalendars', JSON.stringify(['work']));
    render(<CalendarPage tab="day" />);
    expect(screen.queryByRole('button', { name: 'Design review' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Pick up Leo' })).toBeTruthy();
  });

  it('switches views through the docked tabs', () => {
    const onTabChange = vi.fn();
    render(<CalendarPage tab="month" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'panel.widget.calendar.view.list' }));
    expect(onTabChange).toHaveBeenCalledWith('list');
  });

  it('defaults to the month view and treats an unknown tab the same', () => {
    render(<CalendarPage tab="nonsense" />);
    expect(screen.getByText('November')).toBeTruthy();
  });

  it('refreshes from the rail', () => {
    render(<CalendarPage tab="day" />);
    fireEvent.click(screen.getByText('panel.widget.calendar.settings.refreshNow'));
    expect(store.refreshNow).toHaveBeenCalledTimes(1);
  });

  it('asks before removing a calendar', async () => {
    store.remove.mockResolvedValue(undefined);
    render(<CalendarPage tab="day" />);
    fireEvent.click(screen.getByRole('button', { name: 'panel.widget.calendar.remove.button|Home' }));
    expect(store.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('panel.widget.calendar.remove.confirm'));
    await waitFor(() => expect(store.remove).toHaveBeenCalledWith('home'));
  });
});

describe('Add calendar dialog', () => {
  const open = () => {
    render(<CalendarPage tab="day" />);
    fireEvent.click(screen.getAllByText('panel.widget.calendar.add.button')[0]);
    return screen.getByRole('alertdialog');
  };

  it('keeps Add disabled until an address is typed and puts Cancel first', () => {
    const dialog = open();
    const buttons = within(dialog).getAllByRole('button');
    const labels = buttons.map(b => b.textContent);
    expect(labels.indexOf('confirm.cancel')).toBeLessThan(labels.indexOf('panel.widget.calendar.add.confirm'));
    const add = within(dialog).getByText('panel.widget.calendar.add.confirm').closest('button') as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.input(within(dialog).getByLabelText('panel.widget.calendar.add.address'), { target: { value: 'https://x.test/a.ics' } });
    expect(add.disabled).toBe(false);
  });

  it('sends the address, a name and a color, then closes', async () => {
    store.add.mockResolvedValue({});
    const dialog = open();
    fireEvent.input(within(dialog).getByLabelText('panel.widget.calendar.add.address'), { target: { value: ' https://x.test/a.ics ' } });
    fireEvent.input(within(dialog).getByLabelText('panel.widget.calendar.add.name'), { target: { value: 'Gym' } });
    fireEvent.click(within(dialog).getByText('panel.widget.calendar.add.confirm'));
    await waitFor(() => expect(store.add).toHaveBeenCalledTimes(1));
    expect(store.add.mock.calls[0][0]).toMatchObject({ url: 'https://x.test/a.ics', name: 'Gym' });
    expect(store.add.mock.calls[0][0].color).toMatch(/^#[0-9a-f]{6}$/);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('defaults the name to the feed host', async () => {
    store.add.mockResolvedValue({});
    const dialog = open();
    fireEvent.input(within(dialog).getByLabelText('panel.widget.calendar.add.address'), { target: { value: 'webcal://cal.example.org/feed.ics' } });
    fireEvent.click(within(dialog).getByText('panel.widget.calendar.add.confirm'));
    await waitFor(() => expect(store.add).toHaveBeenCalled());
    expect(store.add.mock.calls[0][0].name).toBe('cal.example.org');
  });

  it('shows the service refusal inline and stays open', async () => {
    store.add.mockRejectedValue(new CalendarRequestError('bad', 'notIcs'));
    const dialog = open();
    fireEvent.input(within(dialog).getByLabelText('panel.widget.calendar.add.address'), { target: { value: 'https://x.test/page' } });
    fireEvent.click(within(dialog).getByText('panel.widget.calendar.add.confirm'));
    expect((await screen.findByRole('alert')).textContent).toBe('panel.widget.calendar.add.error.notIcs');
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('falls back to a generic message for an unknown failure', async () => {
    store.add.mockRejectedValue(new Error('boom'));
    const dialog = open();
    fireEvent.input(within(dialog).getByLabelText('panel.widget.calendar.add.address'), { target: { value: 'https://x.test/page' } });
    fireEvent.click(within(dialog).getByText('panel.widget.calendar.add.confirm'));
    expect((await screen.findByRole('alert')).textContent).toBe('panel.widget.calendar.add.error.generic');
  });

  it('shows the Google and Microsoft sign-in as disabled with a note', () => {
    const dialog = open();
    expect((within(dialog).getByText('panel.widget.calendar.add.signIn').closest('button') as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).getByText('panel.widget.calendar.add.comingLater')).toBeTruthy();
  });
});
