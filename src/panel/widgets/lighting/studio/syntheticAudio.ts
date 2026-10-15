import { useLayoutEffect, useMemo, useRef } from 'react';
import type { AudioSnapshot } from '../../../../hooks/useAudioState';

const BEAT_S = 0.6;
// Readers treat each new snapshot object as a new analysis frame, so the stand-in changes at a frame rate, not per read.
const FRAME_HZ = 30;

function band(t: number, i: number, n: number, beat: number): number {
  const x = i / (n - 1);
  // Bass bands ride the beat; higher bands flicker on their own and sit lower.
  const kick = beat * Math.max(0, 1 - x * 3);
  const wobble = 0.5 + 0.5 * Math.sin(t * (2 + x * 9) + i * 1.7);
  return Math.min(1, Math.max(0, kick * 0.9 + wobble * (0.55 - x * 0.3) + 0.08));
}

/** A stand-in music signal at `t` seconds, shaped like the service's audio frame. */
export function syntheticAudio(t: number): AudioSnapshot {
  const beat = Math.exp(-((t / BEAT_S) % 1) * 6);
  return {
    beat,
    bass: 0.5 + 0.45 * Math.sin(t * 2.3),
    mid: 0.45 + 0.35 * Math.sin(t * 3.1 + 1),
    high: 0.35 + 0.3 * Math.sin(t * 5.3 + 2),
    level: 0.55 + 0.3 * Math.sin(t * 1.7),
    spectrum: Array.from({ length: 16 }, (_, i) => band(t, i, 16, beat)),
    spectrum64: Array.from({ length: 64 }, (_, i) => band(t, i, 64, beat)),
  };
}

/** One ref for the life of the caller: reads give the stand-in signal while `simulate`, else `live`'s value. */
export function useStudioAudio(live: React.RefObject<AudioSnapshot | null>, simulate: boolean): React.RefObject<AudioSnapshot | null> {
  // Readers capture the ref once (the shader renderer's frame loop), so the switch lives behind it, not in its identity.
  const simulateRef = useRef(simulate);
  useLayoutEffect(() => { simulateRef.current = simulate; }, [simulate]);
  return useMemo(() => {
    let frame = -1;
    let snap: AudioSnapshot | null = null;
    return {
      get current() {
        if (!simulateRef.current) return live.current;
        const now = performance.now() / 1000;
        const f = Math.floor(now * FRAME_HZ);
        if (f !== frame) {
          frame = f;
          snap = syntheticAudio(now);
        }
        return snap;
      },
    };
  }, [live]);
}
