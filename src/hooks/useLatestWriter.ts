import { useCallback, useEffect, useRef } from 'react';

/**
 * Latest-value-wins write loop for a slider drag: at most one request in
 * flight, at most one per interval, always carrying the newest value.
 * `flush` skips the interval wait (the release of the drag).
 */
export function useLatestWriter(send: (value: number) => Promise<unknown>, intervalMs: number) {
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; }, [send]);
  const w = useRef<{ inFlight: boolean; queued: number | null; lastAt: number; timer: ReturnType<typeof setTimeout> | null }>({
    inFlight: false, queued: null, lastAt: 0, timer: null,
  });
  const pumpRef = useRef<() => void>(() => {});

  const pump = useCallback(() => {
    const s = w.current;
    if (s.inFlight || s.queued == null) return;
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    const wait = intervalMs - (Date.now() - s.lastAt);
    if (wait > 0) { s.timer = setTimeout(() => pumpRef.current(), wait); return; }
    const next = s.queued;
    s.queued = null;
    s.inFlight = true;
    s.lastAt = Date.now();
    void sendRef.current(next).catch(() => null).finally(() => { s.inFlight = false; pumpRef.current(); });
  }, [intervalMs]);
  useEffect(() => { pumpRef.current = pump; }, [pump]);

  useEffect(() => () => {
    if (w.current.timer) clearTimeout(w.current.timer);
    w.current.timer = null;
  }, []);

  return useCallback((value: number, flush = false) => {
    w.current.queued = value;
    if (flush) w.current.lastAt = 0;
    pump();
  }, [pump]);
}
