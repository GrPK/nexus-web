import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomEffectsGrid } from './CustomEffectsGrid';
import { makeBlock } from './studioCompiler';

vi.mock('../../../../lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../../hooks/useEffectThumbnail', () => ({ useEffectThumbnail: () => null }));
vi.mock('./studioLibrary', () => ({
  migrateLegacyEffects: async () => {},
  deleteEffect: async () => {},
  useSavedEffects: () => [
    { id: 'fxa', name: 'Alpha', updatedAt: 1, recipe: { v: 1, blocks: [makeBlock('plasma'), makeBlock('palette')], speed: 50, hue: 0, saturation: 1, contrast: 1 } },
    { id: 'fxb', name: 'Beta', updatedAt: 1, recipe: { v: 1, blocks: [makeBlock('rings'), makeBlock('palette')], speed: 50, hue: 0, saturation: 1, contrast: 1 } },
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
});
