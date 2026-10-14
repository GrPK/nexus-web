import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EffectCard } from './EffectCard';

vi.mock('../../../lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('EffectCard', () => {
  it('drops an image that fails to load for the plain tile, and shows the next one', () => {
    const { container, rerender } = render(<EffectCard label="Glitch Garden" thumbUrl="blob:gone" onClick={() => {}} />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    rerender(<EffectCard label="Glitch Garden" thumbUrl="blob:fresh" onClick={() => {}} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:fresh');
  });
});
