import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MultiplexContext, type MultiplexContextValue } from './useMultiplexSocket';
import { invalidateCalendar, resetCalendarStore, useCalendarEvents, useCalendarSettings, useCalendarSources } from './useCalendar';

const api = vi.hoisted(() => ({
  fetchCalendarSources: vi.fn(),
  fetchCalendarSettings: vi.fn(),
  fetchCalendarEvents: vi.fn(),
  postCalendarRefresh: vi.fn(),
  putCalendarRefreshMinutes: vi.fn(),
}));

vi.mock('../api/calendar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/calendar')>();
  return { ...actual, ...api, subscribeCalendarMock: () => () => {}, addCalendarSource: vi.fn(), removeCalendarSource: vi.fn(), updateCalendarSource: vi.fn() };
});

const dto = (id: string, calendarId: string) => ({
  id, calendarId, title: id, location: null, notes: null, allDay: false, start: 1000, end: 2000,
  startDate: null, endDate: null, status: 'confirmed' as const, providerId: null, etag: null,
});

const listeners = new Map<string, Set<(raw: unknown) => void>>();
const multiplex = {
  subscribe: (topic: string, fn: (raw: unknown) => void) => {
    if (!listeners.has(topic)) listeners.set(topic, new Set());
    listeners.get(topic)!.add(fn);
  },
  unsubscribe: (topic: string, fn: (raw: unknown) => void) => { listeners.get(topic)?.delete(fn); },
  connected: true,
} as unknown as MultiplexContextValue;

const wrapper = ({ children }: { children: ReactNode }) => (
  <MultiplexContext.Provider value={multiplex}>{children}</MultiplexContext.Provider>
);

beforeEach(() => {
  resetCalendarStore();
  listeners.clear();
  api.fetchCalendarSources.mockResolvedValue([{ id: 'a', kind: 'ics', name: 'A', color: '#fff', host: null, lastSyncedAt: null, status: 'ok', error: null }]);
  api.fetchCalendarSettings.mockResolvedValue({ refreshMinutes: 15, lastSyncedAt: null, syncing: false });
  api.fetchCalendarEvents.mockResolvedValue({ events: [dto('e1', 'a'), dto('e2', 'b')], syncedAt: 5 });
});

afterEach(() => {
  Object.values(api).forEach(fn => fn.mockReset());
});

describe('calendar store', () => {
  it('makes one request per range however many consumers read it', async () => {
    const { result } = renderHook(() => ({
      one: useCalendarEvents(0, 100),
      two: useCalendarEvents(0, 100),
      sources: useCalendarSources(),
    }), { wrapper });
    await waitFor(() => expect(result.current.one.loaded).toBe(true));
    expect(api.fetchCalendarEvents).toHaveBeenCalledTimes(1);
    expect(result.current.two.events).toHaveLength(2);
    expect(result.current.sources.sources).toHaveLength(1);
  });

  it('drops hidden calendars client-side without another request', async () => {
    const { result } = renderHook(() => useCalendarEvents(0, 100, ['b']), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.events.map(e => e.id)).toEqual(['e1']);
    expect(api.fetchCalendarEvents).toHaveBeenCalledTimes(1);
  });

  it('refetches the canonical resources when a calendar frame arrives', async () => {
    const { result } = renderHook(() => ({ events: useCalendarEvents(0, 100), sources: useCalendarSources() }), { wrapper });
    await waitFor(() => expect(result.current.events.loaded).toBe(true));
    api.fetchCalendarEvents.mockResolvedValue({ events: [dto('e3', 'a')], syncedAt: 9 });
    await act(async () => { listeners.get('calendar')?.forEach(fn => fn({ revision: 2 })); });
    await waitFor(() => expect(result.current.events.events.map(e => e.id)).toEqual(['e3']));
    expect(api.fetchCalendarSources).toHaveBeenCalledTimes(2);
  });

  it('coalesces invalidations from the same tick into one refetch', async () => {
    const { result } = renderHook(() => useCalendarEvents(0, 100), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    api.fetchCalendarEvents.mockClear();
    await act(async () => { invalidateCalendar(); invalidateCalendar(); invalidateCalendar(); });
    await waitFor(() => expect(api.fetchCalendarEvents).toHaveBeenCalledTimes(1));
  });

  it('keeps the loaded events when a refetch fails', async () => {
    const { result } = renderHook(() => useCalendarEvents(0, 100), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    api.fetchCalendarEvents.mockRejectedValue(new Error('offline'));
    await act(async () => { invalidateCalendar(); });
    await waitFor(() => expect(api.fetchCalendarEvents).toHaveBeenCalledTimes(2));
    expect(result.current.events).toHaveLength(2);
  });

  it('does nothing while disabled', async () => {
    renderHook(() => useCalendarEvents(0, 100, [], false), { wrapper });
    await act(async () => { await Promise.resolve(); });
    expect(api.fetchCalendarEvents).not.toHaveBeenCalled();
    expect(api.fetchCalendarSources).not.toHaveBeenCalled();
    expect(listeners.get('calendar')?.size ?? 0).toBe(0);
  });

  it('shares the refresh interval and resyncs after a manual refresh', async () => {
    api.putCalendarRefreshMinutes.mockResolvedValue({ refreshMinutes: 30, lastSyncedAt: null, syncing: false });
    api.postCalendarRefresh.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCalendarSettings(), { wrapper });
    await waitFor(() => expect(result.current.settings?.refreshMinutes).toBe(15));
    await act(async () => { await result.current.setRefreshMinutes(30); });
    expect(result.current.settings?.refreshMinutes).toBe(30);
    api.fetchCalendarSettings.mockClear();
    await act(async () => { await result.current.refreshNow(); });
    expect(api.postCalendarRefresh).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.fetchCalendarSettings).toHaveBeenCalledTimes(1));
  });
});
