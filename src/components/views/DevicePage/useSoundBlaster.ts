import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSoundBlaster, type SoundBlasterState } from '../../../api/soundBlaster';

const POLL_MS = 3000;
// How long a failure notice stays when nothing else clears it.
const NOTICE_MS = 6000;
const FAILED_KEY = 'devices.soundBlaster.failed';

type Change = () => Promise<SoundBlasterState | null>;

/**
 * The Sound Blaster's state, polled, plus `change` to send a write. Every request takes the next
 * sequence number and only a reply newer than the last one applied is shown, so a slow or
 * out-of-order reply never puts older state back. A poll that began before a write started is
 * dropped, and polls pause while a write is in flight.
 */
export function useSoundBlaster() {
  const [state, setState] = useState<SoundBlasterState | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const alive = useRef(true);
  const seq = useRef(0);
  const applied = useRef(0);
  const lastWrite = useRef(0);
  const writing = useRef(0);
  const noticeTimer = useRef(0);
  const noticeKey = useRef<string | null>(null);

  // A good reply ends the generic failure; a specific notice is left to its own timer.
  const clearGeneric = useCallback(() => {
    if (noticeKey.current !== FAILED_KEY) return;
    window.clearTimeout(noticeTimer.current);
    noticeKey.current = null;
    setFailure(null);
  }, []);

  /** Shows a failure notice (an i18n key) for a short while; the generic one also ends on the next good reply. */
  const report = useCallback((key: string) => {
    window.clearTimeout(noticeTimer.current);
    noticeKey.current = key;
    setFailure(key);
    noticeTimer.current = window.setTimeout(() => {
      noticeKey.current = null;
      setFailure(null);
    }, NOTICE_MS);
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
    let busy = false;
    const load = () => {
      if (busy || writing.current > 0) return;
      busy = true;
      const mine = ++seq.current;
      void fetchSoundBlaster(ctl.signal).then(next => {
        busy = false;
        if (ctl.signal.aborted || !alive.current) return;
        if (!next) {
          setLoadFailed(true);
          return;
        }
        setLoadFailed(false);
        if (mine > lastWrite.current && mine > applied.current && writing.current === 0) {
          applied.current = mine;
          setState(next);
          clearGeneric();
        }
      });
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      window.clearInterval(timer);
      ctl.abort();
    };
  }, [clearGeneric]);

  const change = useCallback(async (call: Change) => {
    const mine = ++seq.current;
    lastWrite.current = mine;
    writing.current += 1;
    let next: SoundBlasterState | null = null;
    try {
      next = await call();
    } finally {
      writing.current -= 1;
    }
    if (!alive.current) return false;
    if (!next) {
      report(FAILED_KEY);
      return false;
    }
    if (mine > applied.current) {
      applied.current = mine;
      setState(next);
      clearGeneric();
    }
    return true;
  }, [report, clearGeneric]);

  return { state, loadFailed, failure, report, change };
}
