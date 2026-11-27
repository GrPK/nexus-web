import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_MS = 5000;
// How long a failure notice stays when nothing else clears it.
const NOTICE_MS = 6000;

/**
 * A device's state, polled, plus `change` to send a write that answers with the new state. Only a
 * reply newer than the last one applied is shown, a poll that began before a write is dropped, and
 * polls pause while a write is in flight (writes to device memory take a moment).
 */
export function usePolledDevice<T>(fetcher: (signal?: AbortSignal) => Promise<T | null>, failedKey: string) {
  const [state, setState] = useState<T | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const seq = useRef(0);
  const applied = useRef(0);
  const lastWrite = useRef(0);
  const writing = useRef(0);
  const noticeTimer = useRef(0);

  const report = useCallback((key: string) => {
    window.clearTimeout(noticeTimer.current);
    setFailure(key);
    noticeTimer.current = window.setTimeout(() => setFailure(null), NOTICE_MS);
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(noticeTimer.current);
    };
  }, []);

  useEffect(() => {
    const ctl = new AbortController();
    let loading = false;
    const load = () => {
      if (loading || writing.current > 0) return;
      loading = true;
      const mine = ++seq.current;
      void fetcher(ctl.signal).then(next => {
        loading = false;
        if (ctl.signal.aborted || !alive.current) return;
        if (!next) {
          setLoadFailed(true);
          return;
        }
        setLoadFailed(false);
        if (mine > lastWrite.current && mine > applied.current && writing.current === 0) {
          applied.current = mine;
          setState(next);
        }
      });
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      window.clearInterval(timer);
      ctl.abort();
    };
  }, [fetcher]);

  const change = useCallback(async (call: () => Promise<T | null>) => {
    const mine = ++seq.current;
    lastWrite.current = mine;
    writing.current += 1;
    setBusy(true);
    let next: T | null = null;
    try {
      next = await call();
    } finally {
      writing.current -= 1;
      if (writing.current === 0) setBusy(false);
    }
    if (!alive.current) return false;
    if (!next) {
      report(failedKey);
      return false;
    }
    if (mine > applied.current) {
      applied.current = mine;
      setState(next);
    }
    return true;
  }, [report, failedKey]);

  return { state, loadFailed, failure, busy, change };
}
