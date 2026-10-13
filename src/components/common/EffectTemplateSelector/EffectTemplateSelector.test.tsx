import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EffectTemplateSelector } from './EffectTemplateSelector';
import type { EffectState } from '../../../types/lighting';

vi.mock('../../../lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
let thumb = 'blob:gone';
vi.mock('../../../hooks/useEffectThumbnail', () => ({ useEffectThumbnail: () => thumb }));

describe('EffectTemplateSelector', () => {
  it('drops a preset image that fails to load for the skeleton, and shows the next one', () => {
    const slots = [{ speed: 50, intensity: 1, hue: 0, colorize: 0, saturation: 1, contrast: 1, params: {} } as unknown as EffectState];
    const view = () => <EffectTemplateSelector effect="custom:fx1" slots={slots} activeIndex={0} onSelect={() => {}} ariaLabel="presets" />;
    const { container, rerender } = render(view());
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    thumb = 'blob:fresh';
    rerender(view());
    expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:fresh');
  });
});
