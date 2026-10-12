import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EffectsMarket } from './EffectsMarket';
import type { EffectListing } from '../../../api/effectMarket';

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    language: 'en',
    t: (key: string, params?: Record<string, string | number>) => {
      let text = key;
      if (params) for (const [k, v] of Object.entries(params)) text += ` ${k}=${v}`;
      return text;
    },
  }),
}));

const listEffects = vi.fn();
const getEffect = vi.fn();
const downloadEffect = vi.fn();
const unpublishEffect = vi.fn();
vi.mock('../../../api/effectMarket', () => ({
  listEffects: (...a: unknown[]) => listEffects(...a),
  getEffect: (...a: unknown[]) => getEffect(...a),
  downloadEffect: (...a: unknown[]) => downloadEffect(...a),
  unpublishEffect: (...a: unknown[]) => unpublishEffect(...a),
}));

const put = vi.fn();
vi.mock('../../../api/customEffects', () => ({
  STUDIO_UID_RE: /^[a-z0-9]{1,24}$/,
  customEffectKey: (id: string) => `custom:${id}`,
  getCustomEffects: () => [],
  useCustomEffects: () => [],
  refreshCustomEffects: async () => {},
  putCustomEffect: (...a: unknown[]) => put(...a),
  deleteCustomEffect: async () => true,
}));

vi.mock('../../../panel/widgets/lighting/studio/recipePreview', () => ({ attachRecipePreview: () => () => {} }));

const ID = '0b5c1a52-5f0e-4b8e-9d55-1a2b3c4d5e6f';
const recipe = {
  v: 1, speed: 50, hue: 0, saturation: 1, contrast: 1,
  blocks: [{ uid: 'a1', type: 'rings', params: {} }, { uid: 'b2', type: 'palette', params: {} }],
};
const listing: EffectListing = {
  id: ID, name: 'Fan spin', description: 'Spins', author: 'alice', recipe, audio: false,
  downloads: 3, createdAt: '2026-10-11T00:00:00Z', updatedAt: '2026-10-11T00:00:00Z',
};

function detail(username: string | null = 'bob') {
  const onNeedsSignIn = vi.fn();
  render(<EffectsMarket path={ID} username={username} onNavigate={() => {}} onNeedsSignIn={onNeedsSignIn} />);
  return onNeedsSignIn;
}

describe('EffectsMarket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEffect.mockResolvedValue({ ok: true, value: listing });
    put.mockResolvedValue({ entry: {} });
  });

  it('lists the most downloaded effects and opens one', async () => {
    listEffects.mockResolvedValue({ ok: true, value: { items: [listing], page: 1, limit: 24, hasMore: false } });
    const onNavigate = vi.fn();
    render(<EffectsMarket path="" username={null} onNavigate={onNavigate} onNeedsSignIn={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Fan spin' }));
    expect(listEffects.mock.calls[0][0]).toMatchObject({ sort: 'popular', page: 1 });
    expect(onNavigate).toHaveBeenCalledWith(ID);
  });

  it("lists one creator's effects newest first", async () => {
    listEffects.mockResolvedValue({ ok: true, value: { items: [], page: 1, limit: 24, hasMore: false } });
    render(<EffectsMarket path="by/alice" username={null} onNavigate={() => {}} onNeedsSignIn={() => {}} />);
    expect(await screen.findByText('store.effects.creatorEmpty')).toBeInTheDocument();
    expect(listEffects.mock.calls[0][0]).toMatchObject({ author: 'alice', sort: 'new' });
  });

  it('asks for a sign-in when the download is refused, then retries', async () => {
    downloadEffect.mockResolvedValueOnce({ ok: false, error: 'sign_in_required' });
    const onNeedsSignIn = detail(null);
    fireEvent.click(await screen.findByRole('button', { name: 'store.effects.get' }));
    await waitFor(() => expect(onNeedsSignIn).toHaveBeenCalled());
    expect(put).not.toHaveBeenCalled();

    downloadEffect.mockResolvedValueOnce({ ok: true, value: { ...listing, downloads: 4 } });
    onNeedsSignIn.mock.calls[0][0]();
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][1]).toMatchObject({ name: 'Fan spin', marketId: ID, marketAuthor: 'alice' });
  });

  it("offers the author Unpublish instead of Get", async () => {
    detail('Alice');
    expect(await screen.findByRole('button', { name: 'store.effects.unpublish' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'store.effects.get' })).not.toBeInTheDocument();
  });

  it('cannot get an effect this build cannot run', async () => {
    getEffect.mockResolvedValue({ ok: true, value: { ...listing, recipe: { ...recipe, blocks: [{ uid: 'x', type: 'hologram', params: {} }] } } });
    detail();
    expect(await screen.findByText('store.effects.unsupported')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'store.effects.get' })).toBeDisabled();
  });
});
