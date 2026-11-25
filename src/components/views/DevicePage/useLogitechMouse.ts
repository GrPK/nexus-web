import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMouse, type MouseState } from '../../../api/logitechMouse';

const POLL_MS = 5000;
// How long a failure notice stays when nothing else clears it.
const NOTICE_MS = 6000;
const FAILED_KEY = 'devices.logitechMouse.failed';

type Change = () => Promise<MouseState | null>;

/**
 * The mouse's onboard memory, polled, plus `change` to send a write. Same ordering rules as the
 * speaker page: only a reply newer than the last one applied is shown, a poll that began before a
 * write is dropped, and polls pause while a write is in flight (a profile write takes a moment).
 */
export function useLogitechMouse() {
  const [state, setState] = useState<MouseState | null>(null);
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
      void fetchMouse(ctl.signal).then(next => {
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
  }, []);

  const change = useCallback(async (call: Change) => {
    const mine = ++seq.current;
    lastWrite.current = mine;
    writing.current += 1;
    setBusy(true);
    let next: MouseState | null = null;
    try {
      next = await call();
    } finally {
      writing.current -= 1;
      if (writing.current === 0) setBusy(false);
    }
    if (!alive.current) return false;
    if (!next) {
      report(FAILED_KEY);
      return false;
    }
    if (mine > applied.current) {
      applied.current = mine;
      setState(next);
    }
    return true;
  }, [report]);

  return { state, loadFailed, failure, busy, change };
}
