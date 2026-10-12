import { useCallback, useRef, useState } from 'react';

/** The global flat color ('' for a pattern). `read()` at fetch start returns the
 *  lander for its answer, which is dropped if a local change came after the ask, a
 *  local write is still in flight, or a later-asked fetch already landed. */
export function useGlobalColor() {
  const [color, setColor] = useState('');
  const local = useRef(0);
  const inFlight = useRef(0);
  const asked = useRef(0);
  const landed = useRef(0);

  const set = useCallback((hex: string, write?: Promise<unknown>) => {
    local.current++;
    setColor(hex);
    if (!write) return;
    inFlight.current++;
    void write.catch(() => {}).finally(() => { inFlight.current--; });
  }, []);

  const read = useCallback(() => {
    const n = ++asked.current;
    const localAtAsk = local.current;
    return (hex: string) => {
      if (localAtAsk !== local.current || inFlight.current > 0 || n < landed.current) return;
      landed.current = n;
      setColor(hex);
    };
  }, []);

  return [color, set, read] as const;
}
