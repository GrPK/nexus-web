import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudioBlockCard } from './StudioBlockCard';
import { studioBlock } from './studioBlocks';
import { makeBlock } from './studioCompiler';
import type { AudioSnapshot } from '../../../../hooks/useAudioState';

vi.mock('../../../../lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

// The rings speed knob with a bass mod at half strength.
function ringsWithBass() {
  const block = makeBlock('rings');
  block.uid = 'r1';
  const p = studioBlock('rings')!.params.find(x => x.key === 'speed')!;
  block.params.speed = p.min;
  block.mods = { speed: { source: 'bass', amount: 0.5 } };
  return { block, p };
}

const noop = () => {};
const render_ = (audioRef?: { current: AudioSnapshot | null }) => {
  const { block } = ringsWithBass();
  return render(
    <StudioBlockCard
      block={block} def={studioBlock('rings')!} firstPattern removable={false} canSwitchTo={() => true}
      onChange={noop} onCommit={noop} onTypeChange={noop} onRemove={noop}
      isPinned={() => false} onTogglePin={noop} audioRef={audioRef}
    />,
  );
};

// Positioned track overlays (band and marker) carry an inline `left`.
const overlays = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('span[style*="left"]')];

describe('StudioBlockCard audio modulation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('draws the span full volume moves a modulated knob across', () => {
    const { container } = render_();
    const band = overlays(container).find(el => el.style.width);
    expect(band?.style.left).toBe('0%');
    expect(band?.style.width).toBe('50%');
  });

  it('marks where the music has the knob now', async () => {
    const audioRef = { current: { level: 0, bass: 0.5, mid: 0, high: 0, beat: 0, spectrum: [], spectrum64: [] } as AudioSnapshot };
    const { container } = render_(audioRef);
    const lefts = () => overlays(container).filter(el => !el.style.width).map(el => el.style.left);
    expect(lefts()).not.toContain('25%');
    await act(async () => { vi.advanceTimersByTime(100); });
    // Half the bass moves it half of the band.
    expect(lefts()).toContain('25%');
  });
});
