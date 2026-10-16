import { useCallback, useEffect, useRef, useState } from 'react';

/** Matches the api's per-address verify mail cap; the api stays the real limit. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Whole seconds left until the deadline, never negative. */
export function remainingSeconds(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

/** Counts down from `initialSeconds` on mount; `start` restarts it from `seconds`. */
export function useResendCooldown(initialSeconds: number, seconds = RESEND_COOLDOWN_SECONDS) {
  const deadline = useRef(0);
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    deadline.current = Date.now() + initialSeconds * 1000;
    const id = window.setInterval(() => {
      setRemaining(remainingSeconds(deadline.current, Date.now()));
    }, 1000);
    return () => window.clearInterval(id);
  }, [initialSeconds]);

  const start = useCallback(() => {
    deadline.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
  }, [seconds]);

  return { remaining, start };
}
