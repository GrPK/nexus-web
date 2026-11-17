import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  addCalendarSource, fetchCalendarEvents, fetchCalendarSettings, fetchCalendarSources, postCalendarRefresh,
  putCalendarRefreshMinutes, removeCalendarSource, subscribeCalendarMock,
  type AddCalendarInput, type CalendarRefreshMinutes, type CalendarSettingsDto, type CalendarSourceDto,
} from '../api/calendar';
import { normalizeEvent, type CalEvent } from '../panel/widgets/calendar/calendarEvents';
import { useMultiplex, useTopicCallback } from './useMultiplexSocket';

// One shared store for every calendar surface, so several tiles and the page
// make one request per range, and one `calendar` frame refreshes them all.

interface RangeData { events: CalEvent[]; syncedAt: number | null }

interface CalendarState {
  sources: CalendarSourceDto[];
  settings: CalendarSettingsDto | null;
  // True once the first sources + settings fetch settled, whatever its outcome.
  loaded: boolean;
  ranges: ReadonlyMap<string, RangeData>;
}

let state: CalendarState = { sources: [], settings: null, loaded: false, ranges: new Map() };
const listeners = new Set<() => void>();
const activeRanges = new Map<string, number>();
const inFlight = new Map<string, Promise<void>>();
let users = 0;
let stopMock: (() => void) | null = null;
let metaGeneration = 0;

function setState(patch: Partial<CalendarState>) {
  state = { ...state, ...patch };
  listeners.forEach(l => l());
}

const rangeKey = (from: number, to: number) => `${from}:${to}`;

async function loadMeta() {
  const generation = ++metaGeneration;
  const [sources, settings] = await Promise.allSettled([fetchCalendarSources(), fetchCalendarSettings()]);
  if (generation !== metaGeneration) return;
  setState({
    sources: sources.status === 'fulfilled' ? sources.value : state.sources,
    settings: settings.status === 'fulfilled' ? settings.value : state.settings,
    loaded: true,
  });
}

function loadRange(key: string, from: number, to: number): Promise<void> {
  const pending = inFlight.get(key);
  if (pending) return pending;
  const job = fetchCalendarEvents(from, to)
    .then(res => {
      const ranges = new Map(state.ranges);
      ranges.set(key, { events: res.events.map(normalizeEvent), syncedAt: res.syncedAt });
      setState({ ranges });
    })
    .catch(() => {
      // A failed refetch keeps whatever the range already held.
    })
    .finally(() => { inFlight.delete(key); });
  inFlight.set(key, job);
  return job;
}

let invalidatePending = false;

/** Refetches sources, settings and every range a mounted surface is using; calls in one tick coalesce. */
export function invalidateCalendar(): void {
  if (invalidatePending) return;
  invalidatePending = true;
  void Promise.resolve().then(() => {
    invalidatePending = false;
    void loadMeta();
    for (const key of activeRanges.keys()) {
      const [from, to] = key.split(':').map(Number);
      inFlight.delete(key);
      void loadRange(key, from, to);
    }
  });
}

function retain() {
  users++;
  if (users === 1) {
    void loadMeta();
    stopMock = subscribeCalendarMock(invalidateCalendar);
  }
}

function release() {
  users--;
  if (users === 0) {
    stopMock?.();
    stopMock = null;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const getState = () => state;

/** Test seam: forget everything the store holds. */
export function resetCalendarStore(): void {
  state = { sources: [], settings: null, loaded: false, ranges: new Map() };
  activeRanges.clear();
  inFlight.clear();
  invalidatePending = false;
  users = 0;
  stopMock?.();
  stopMock = null;
}

/** Mounts the shared fetch + push wiring for one consumer. */
function useCalendarSync(enabled: boolean) {
  const connected = useMultiplex()?.connected ?? false;
  useEffect(() => {
    if (!enabled) return;
    retain();
    return release;
  }, [enabled]);
  useTopicCallback('calendar', enabled, invalidateCalendar);
  const wasConnected = useRef(connected);
  useEffect(() => {
    // A dropped socket misses pushes, so a reconnect resyncs from the service.
    if (enabled && connected && !wasConnected.current) invalidateCalendar();
    wasConnected.current = connected;
  }, [enabled, connected]);
}

export interface UseCalendarSources {
  sources: CalendarSourceDto[];
  loaded: boolean;
}

export function useCalendarSources(enabled = true): UseCalendarSources {
  useCalendarSync(enabled);
  const snap = useSyncExternalStore(subscribe, getState);
  return { sources: snap.sources, loaded: snap.loaded };
}

export interface UseCalendarSettings {
  settings: CalendarSettingsDto | null;
  setRefreshMinutes: (value: CalendarRefreshMinutes) => Promise<void>;
  refreshNow: () => Promise<void>;
}

export function useCalendarSettings(enabled = true): UseCalendarSettings {
  useCalendarSync(enabled);
  const snap = useSyncExternalStore(subscribe, getState);
  const setRefreshMinutes = useCallback(async (value: CalendarRefreshMinutes) => {
    const next = await putCalendarRefreshMinutes(value);
    setState({ settings: next });
  }, []);
  const refreshNow = useCallback(async () => {
    await postCalendarRefresh();
    invalidateCalendar();
  }, []);
  return { settings: snap.settings, setRefreshMinutes, refreshNow };
}

export interface CalendarMutations {
  add: (input: AddCalendarInput) => Promise<CalendarSourceDto>;
  remove: (id: string) => Promise<void>;
}

export function useCalendarMutations(): CalendarMutations {
  return useMemo(() => ({
    add: async (input: AddCalendarInput) => {
      const source = await addCalendarSource(input);
      invalidateCalendar();
      return source;
    },
    remove: async (id: string) => {
      await removeCalendarSource(id);
      invalidateCalendar();
    },
  }), []);
}

export interface UseCalendarEvents {
  events: CalEvent[];
  syncedAt: number | null;
  loaded: boolean;
}

const NO_EVENTS: CalEvent[] = [];

/** Events in [from, to). Pass day-aligned bounds so surfaces share one request. `hidden` drops calendars client-side. */
export function useCalendarEvents(from: number, to: number, hidden: readonly string[] = [], enabled = true): UseCalendarEvents {
  useCalendarSync(enabled);
  const key = rangeKey(from, to);
  useEffect(() => {
    if (!enabled) return;
    activeRanges.set(key, (activeRanges.get(key) ?? 0) + 1);
    if (!state.ranges.has(key)) void loadRange(key, from, to);
    return () => {
      const left = (activeRanges.get(key) ?? 1) - 1;
      if (left <= 0) activeRanges.delete(key); else activeRanges.set(key, left);
    };
  }, [enabled, key, from, to]);
  const snap = useSyncExternalStore(subscribe, getState);
  const range = snap.ranges.get(key);
  const hiddenKey = hidden.join('|');
  const events = useMemo(() => {
    if (!range) return NO_EVENTS;
    if (hidden.length === 0) return range.events;
    return range.events.filter(ev => !hidden.includes(ev.calendarId));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hiddenKey is the value identity of `hidden`
  }, [range, hiddenKey]);
  return { events, syncedAt: range?.syncedAt ?? null, loaded: range !== undefined };
}
