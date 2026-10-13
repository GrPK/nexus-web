import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudioBlockCard } from './StudioBlockCard';
import { studioBlock } from './studioBlocks';
import { makeBlock, type StudioBlock, type StudioMod } from './studioCompiler';
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
const render_ = (audioRef?: { current: AudioSnapshot | null }, mod?: StudioMod, onChange: (b: StudioBlock, commit: boolean) => void = noop) => {
  const { block } = ringsWithBass();
  if (mod) block.mods = { speed: mod };
  return render(
    <StudioBlockCard
      block={block} def={studioBlock('rings')!} firstPattern removable={false} canSwitchTo={() => true}
      onChange={onChange} onCommit={noop} onTypeChange={noop} onRemove={noop}
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

describe('StudioBlockCard mod shaping', () => {
  it('offers a threshold for music and a rate for a wave', () => {
    const { unmount } = render_(undefined, { source: 'bass', amount: 0.5 });
    expect(screen.getByText('lighting.studio.mod.gate')).toBeInTheDocument();
    expect(screen.queryByText('lighting.studio.mod.rate')).toBeNull();
    unmount();
    render_(undefined, { source: 'sine', amount: 0.5, rate: 1 });
    expect(screen.getByText('lighting.studio.mod.rate')).toBeInTheDocument();
    expect(screen.queryByText('lighting.studio.mod.gate')).toBeNull();
  });

  it('drops the threshold and starts a default rate when music becomes a wave', () => {
    const onChange = vi.fn();
    render_(undefined, { source: 'bass', amount: 0.5, gate: 0.4 }, onChange);
    fireEvent.click(screen.getByRole('button', { name: 'lighting.studio.mod.source' }));
    fireEvent.click(screen.getByRole('option', { name: 'lighting.studio.mod.triangle' }));
    const next = onChange.mock.calls.at(-1)![0] as StudioBlock;
    expect(next.mods?.speed).toEqual({ source: 'triangle', amount: 0.5, rate: 0.5 });
  });

  it('draws no live marker for a wave, which moves without audio', async () => {
    vi.useFakeTimers();
    const audioRef = { current: { level: 1, bass: 1, mid: 1, high: 1, beat: 1, spectrum: [], spectrum64: [] } as AudioSnapshot };
    const { container } = render_(audioRef, { source: 'sine', amount: 0.5, rate: 1 });
    // The amount slider's zero tick is the only unsized overlay before audio is sampled.
    const ticks = () => overlays(container).filter(el => !el.style.width).length;
    const before = ticks();
    await act(async () => { vi.advanceTimersByTime(100); });
    expect(ticks()).toBe(before);
    vi.useRealTimers();
  });
});
