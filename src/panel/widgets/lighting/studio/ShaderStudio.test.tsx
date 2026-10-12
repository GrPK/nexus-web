import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShaderStudio } from './ShaderStudio';
import type { MarketLink } from './studioLibrary';

vi.mock('../../../../lib/i18n', () => ({
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));

vi.mock('../../../../api/lighting', () => ({
  primeShaderSource: () => {},
  forgetShaderSource: () => {},
  invalidateShaderSource: () => {},
}));

vi.mock('../../../../hooks/useAudioState', () => ({ useAudioState: () => ({ current: null }) }));
vi.mock('./StudioPreview', () => ({ StudioPreview: () => null }));

const put = vi.fn();
vi.mock('../../../../api/customEffects', () => ({
  STUDIO_UID_RE: /^[a-z0-9]{1,24}$/,
  customEffectKey: (id: string) => `custom:${id}`,
  getCustomEffects: () => [],
  useCustomEffects: () => [],
  refreshCustomEffects: async () => {},
  putCustomEffect: (...a: unknown[]) => put(...a),
  deleteCustomEffect: async () => true,
}));

type Save = (name: string, link?: MarketLink) => Promise<string | null>;
let save: Save | null = null;
vi.mock('./PublishEffectModal', () => ({
  // Keeps the first `save`, as the dialog's submit closure does for both of its calls.
  PublishEffectModal: (props: { open: boolean; save: Save }) => {
    if (props.open) save ??= props.save;
    return null;
  },
}));

describe('ShaderStudio publishing', () => {
  beforeEach(() => {
    put.mockReset();
    put.mockResolvedValue({ entry: {} });
    save = null;
  });

  it('saves an unsaved effect and its listing link under one id', async () => {
    // Effect ids come from the clock; a ticking clock makes a second fresh id certain.
    let now = 1_800_000_000_000;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now++);
    render(<ShaderStudio open effectId={null} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'lighting.studio.publish.button' }));
    await act(async () => { await save!('Spin'); });
    await act(async () => { await save!('Spin', { marketId: 'L1', marketAuthor: 'alice' }); });
    expect(put).toHaveBeenCalledTimes(2);
    expect(put.mock.calls[1][0]).toBe(put.mock.calls[0][0]);
    expect(put.mock.calls[1][1]).toMatchObject({ name: 'Spin', marketId: 'L1', marketAuthor: 'alice' });
    clock.mockRestore();
  });
});
