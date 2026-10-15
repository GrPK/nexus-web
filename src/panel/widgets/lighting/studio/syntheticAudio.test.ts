import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AudioSnapshot } from '../../../../hooks/useAudioState';
import { useStudioAudio } from './syntheticAudio';

describe('useStudioAudio', () => {
  it('keeps one ref while the switch moves its reads between live and simulated music', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const live = { current: null as AudioSnapshot | null };
    const { result, rerender } = renderHook(({ simulate }) => useStudioAudio(live, simulate), { initialProps: { simulate: false } });
    const ref = result.current;
    expect(ref.current).toBeNull();
    rerender({ simulate: true });
    expect(result.current).toBe(ref);
    expect(ref.current?.spectrum).toHaveLength(16);
    // Reads within one frame see the same snapshot, as the renderer counts a new object as a new frame.
    expect(ref.current).toBe(ref.current);
    rerender({ simulate: false });
    expect(ref.current).toBeNull();
    now.mockRestore();
  });
});
