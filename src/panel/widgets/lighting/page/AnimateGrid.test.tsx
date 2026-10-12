import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnimateGrid } from './AnimateGrid';

vi.mock('../../../../hooks/useEffectThumbnail', () => ({
  useEffectThumbnail: () => null,
}));
vi.mock('../../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('AnimateGrid live-on-RGB bulb', () => {
  it('marks exactly the rgb-active effect cell with a bulb', () => {
    const { container } = render(
      <AnimateGrid
        effect="plasma"
        onSelect={() => {}}
        slotFor={() => 0}
        versionFor={() => '0'}
        rgbActiveEffect="plasma"
      />,
    );
    expect(container.querySelectorAll('svg.lucide-lightbulb').length).toBe(1);
  });

  it('shows no bulb when nothing is live on the RGB (e.g. the lighting page)', () => {
    const { container } = render(
      <AnimateGrid
        effect="plasma"
        onSelect={() => {}}
        slotFor={() => 0}
        versionFor={() => '0'}
        rgbActiveEffect=""
      />,
    );
    expect(container.querySelectorAll('svg.lucide-lightbulb').length).toBe(0);
  });

  it('stacks a monitor icon on a panel-used effect, alongside the bulb', () => {
    const { container } = render(
      <AnimateGrid
        effect="plasma"
        onSelect={() => {}}
        slotFor={() => 0}
        versionFor={() => '0'}
        rgbActiveEffect="plasma"
        panelEffects={new Set(['plasma'])}
      />,
    );
    // plasma is both live on the LEDs and used by a panel → both badges.
    expect(container.querySelectorAll('svg.lucide-lightbulb').length).toBe(1);
    expect(container.querySelectorAll('svg.lucide-monitor').length).toBe(1);
  });

  it('shows no monitor when no panel uses the effect', () => {
    const { container } = render(
      <AnimateGrid
        effect="plasma"
        onSelect={() => {}}
        slotFor={() => 0}
        versionFor={() => '0'}
        panelEffects={new Set()}
      />,
    );
    expect(container.querySelectorAll('svg.lucide-monitor').length).toBe(0);
  });
});

describe('AnimateGrid gpuAvailable=false', () => {
  it('renders all effect cells without error when gpu is unavailable', () => {
    const { container } = render(
      <AnimateGrid effect="plasma" onSelect={() => {}} gpuAvailable={false} />,
    );
    expect(container.querySelectorAll('[data-effect-key]').length).toBeGreaterThan(0);
  });
});

describe('AnimateGrid category sections', () => {
  const has = (c: HTMLElement, key: string) => !!c.querySelector(`[data-effect-key="${key}"]`);

  it('lists every effect under pre-expanded category groups (no filtering)', () => {
    const { container } = render(<AnimateGrid effect="" onSelect={() => {}} />);
    expect(has(container, 'fire')).toBe(true);         // organic
    expect(has(container, 'boxtunnel')).toBe(true);    // geometric
    expect(has(container, 'spectrumbars')).toBe(true); // audio
  });

  it('orders sections simple, organic, then the rest with audio last', () => {
    const { container } = render(<AnimateGrid effect="" onSelect={() => {}} />);
    const text = container.textContent || '';
    const order = ['simple', 'organic', 'cosmic', 'geometric', 'pattern', 'audio'];
    const idxs = order.map(c => text.indexOf(`lighting.category.${c}`));
    expect(idxs.every(i => i >= 0)).toBe(true);
    expect(idxs).toEqual([...idxs].sort((a, b) => a - b));
  });

  it('collapses and re-expands a category when its header is clicked', () => {
    const { container } = render(<AnimateGrid effect="" onSelect={() => {}} />);
    expect(has(container, 'fire')).toBe(true); // organic, expanded by default
    const header = screen.getByRole('button', { name: /lighting\.category\.organic/ });
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(has(container, 'fire')).toBe(false);
    fireEvent.click(header);
    expect(has(container, 'fire')).toBe(true);
  });
});

describe('AnimateGrid pin badge', () => {
  const grid = (pinnedDevices?: Map<string, string[]>) => render(
    <AnimateGrid
      effect="plasma"
      onSelect={() => {}}
      slotFor={() => 0}
      versionFor={() => '0'}
      pinnedDevices={pinnedDevices}
    />,
  );

  it('badges exactly the effects with a pinned device, showing the count', () => {
    const { container } = grid(new Map([['plasma', ['Fan 1', 'Strip']]]));
    const badges = screen.getAllByTestId('effect-pin-badge');
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe('2');
    expect(badges[0].closest('[data-effect-key]')?.getAttribute('data-effect-key')).toBe('plasma');
    expect(container.querySelectorAll('svg.lucide-pin').length).toBe(1);
  });

  it('shows no pin when nothing is pinned', () => {
    const { container } = grid(new Map());
    expect(container.querySelectorAll('svg.lucide-pin').length).toBe(0);
  });

  it('lists the device names in the tooltip on hover', async () => {
    grid(new Map([['plasma', ['Fan 1', 'Strip']]]));
    fireEvent.pointerEnter(screen.getByTestId('effect-pin-badge'));
    expect(await screen.findByText('Fan 1')).toBeTruthy();
    expect(screen.getByText('Strip')).toBeTruthy();
  });

  it('keeps the usage icons beside the pin', () => {
    const { container } = render(
      <AnimateGrid
        effect="plasma" onSelect={() => {}} slotFor={() => 0} versionFor={() => '0'}
        rgbActiveEffect="plasma" pinnedDevices={new Map([['plasma', ['Fan 1']]])}
      />,
    );
    expect(container.querySelectorAll('svg.lucide-lightbulb').length).toBe(1);
    expect(container.querySelectorAll('svg.lucide-pin').length).toBe(1);
  });
});
