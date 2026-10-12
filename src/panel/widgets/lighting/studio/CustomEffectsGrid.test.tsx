import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomEffectsGrid } from './CustomEffectsGrid';
import { makeBlock } from './studioCompiler';

vi.mock('../../../../lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../../hooks/useEffectThumbnail', () => ({ useEffectThumbnail: () => null }));
const still = vi.fn((recipe: { speed: number }) => `data:still-${recipe.speed}`);
vi.mock('./recipePreview', () => ({ renderRecipeStill: (r: { speed: number }) => still(r) }));
vi.mock('./studioLibrary', () => ({
  migrateLegacyEffects: async () => {},
  deleteEffect: async () => {},
  useSavedEffects: () => [
    { id: 'fxa', name: 'Alpha', updatedAt: 1, recipe: { v: 1, blocks: [makeBlock('plasma'), makeBlock('palette')], speed: 50, hue: 0, saturation: 1, contrast: 1 } },
    { id: 'fxb', name: 'Beta', updatedAt: 1, recipe: { v: 1, blocks: [makeBlock('rings'), makeBlock('palette')], speed: 50, hue: 0, saturation: 1, contrast: 1 } },
    { id: 'fxm', name: 'Gamma', updatedAt: 1, marketId: 'L1', marketAuthor: 'Someone', recipe: { v: 1, blocks: [makeBlock('rings'), makeBlock('palette')], speed: 50, hue: 0, saturation: 1, contrast: 1 } },
    { id: 'fxp', name: 'Delta', updatedAt: 1, marketId: 'L2', marketAuthor: 'Me', recipe: { v: 1, blocks: [makeBlock('rings'), makeBlock('palette')], speed: 50, hue: 0, saturation: 1, contrast: 1 } },
    { id: 'fxd', name: 'Epsilon', updatedAt: 1, marketId: 'L3', marketAuthor: 'Me', downloaded: true, recipe: { v: 1, blocks: [makeBlock('rings'), makeBlock('palette')], speed: 50, hue: 0, saturation: 1, contrast: 1 } },
    { id: 'fxo', name: 'Zeta', updatedAt: 1, marketId: 'L4', marketAuthor: 'Someone', downloaded: false, recipe: { v: 1, blocks: [makeBlock('rings'), makeBlock('palette')], speed: 50, hue: 0, saturation: 1, contrast: 1 } },
  ],
}));

describe('CustomEffectsGrid', () => {
  it('selects an effect by its custom key on click instead of opening the editor', () => {
    const onSelect = vi.fn();
    const onCreate = vi.fn();
    render(<CustomEffectsGrid effect={null} query="" onSelect={onSelect} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
    expect(onSelect).toHaveBeenCalledWith('custom:fxb');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('opens the editor only from the create tile', () => {
    const onCreate = vi.fn();
    render(<CustomEffectsGrid effect={null} query="" onSelect={() => {}} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: /lighting\.studio\.create/ }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('filters by name', () => {
    render(<CustomEffectsGrid effect={null} query="alp" onSelect={() => {}} onCreate={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Beta' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
  });

  const sectionOf = (name: string) =>
    screen.getByRole('button', { name }).closest('[data-pick]')?.parentElement?.parentElement?.textContent ?? '';

  it('lists own effects under Custom and other accounts\' downloads under Marketplace', () => {
    render(<CustomEffectsGrid effect={null} query="" username="me" onSelect={() => {}} onCreate={() => {}} />);
    const text = document.body.textContent ?? '';
    expect(text.indexOf('lighting.category.custom')).toBeLessThan(text.indexOf('lighting.category.marketplace'));
    expect(sectionOf('Delta')).toContain('lighting.category.custom');
    expect(sectionOf('Gamma')).toContain('lighting.category.marketplace');
    expect(sectionOf('Gamma')).not.toContain('Delta');
  });

  it('files by the recorded downloaded flag over the author, signed in or not', () => {
    for (const username of ['me', null]) {
      const { unmount } = render(<CustomEffectsGrid effect={null} query="" username={username} onSelect={() => {}} onCreate={() => {}} />);
      expect(sectionOf('Epsilon')).toContain('lighting.category.marketplace');
      expect(sectionOf('Zeta')).toContain('lighting.category.custom');
      unmount();
    }
  });

  it('shows a new draft at once and re-renders its tile as the recipe changes', async () => {
    vi.useFakeTimers();
    try {
      const recipe = { v: 1 as const, blocks: [makeBlock('solid'), makeBlock('palette')], speed: 50, hue: 0, saturation: 1, contrast: 1 };
      const { rerender, container } = render(
        <CustomEffectsGrid effect={null} query="" draft={{ id: null, recipe }} onSelect={() => {}} onCreate={() => {}} />,
      );
      await act(async () => { vi.advanceTimersByTime(0); });
      expect(container.querySelector('img[src="data:still-50"]')).not.toBeNull();
      rerender(<CustomEffectsGrid effect={null} query="" draft={{ id: null, recipe: { ...recipe, speed: 20 } }} onSelect={() => {}} onCreate={() => {}} />);
      await act(async () => { vi.advanceTimersByTime(500); });
      expect(container.querySelector('img[src="data:still-20"]')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('draws an open saved effect from its unsaved recipe', async () => {
    vi.useFakeTimers();
    try {
      const recipe = { v: 1 as const, blocks: [makeBlock('solid'), makeBlock('palette')], speed: 7, hue: 0, saturation: 1, contrast: 1 };
      render(<CustomEffectsGrid effect="custom:fxb" query="" draft={{ id: 'fxb', recipe }} onSelect={() => {}} onCreate={() => {}} />);
      await act(async () => { vi.advanceTimersByTime(0); });
      expect(screen.getByRole('button', { name: 'Beta' }).querySelector('img')?.getAttribute('src')).toBe('data:still-7');
      expect(screen.getByRole('button', { name: 'Alpha' }).querySelector('img')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
