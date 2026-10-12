import { StrictMode } from 'react';
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
const remove = vi.fn();
let installed: { id: string; name: string; recipe: string; updatedAt: number; audio: boolean; marketId?: string }[] = [];
vi.mock('../../../api/customEffects', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../api/customEffects')>()),
  getCustomEffects: () => installed,
  useCustomEffects: () => installed,
  refreshCustomEffects: async () => {},
  putCustomEffect: (...a: unknown[]) => put(...a),
  deleteCustomEffect: (...a: unknown[]) => remove(...a),
}));

vi.mock('../../../panel/widgets/lighting/studio/recipePreview', () => ({ attachRecipePreview: () => () => {} }));

const fetchShaderSource = vi.fn();
vi.mock('../../../api/lighting', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../api/lighting')>()),
  fetchShaderSource: (...a: unknown[]) => fetchShaderSource(...a),
}));

let previewState: { current: { speed: number } | null } | null = null;
vi.mock('../../../panel/widgets/lighting/studio/StudioPreview', () => ({
  StudioPreview: (props: { stateRef: { current: { speed: number } | null } }) => { previewState = props.stateRef; return null; },
}));

const ID = '0b5c1a52-5f0e-4b8e-9d55-1a2b3c4d5e6f';
const recipe = {
  v: 1, speed: 50, hue: 0, saturation: 1, contrast: 1,
  blocks: [{ uid: 'a1', type: 'rings', params: {} }, { uid: 'b2', type: 'palette', params: {} }],
};
const listing: EffectListing = {
  id: ID, name: 'Fan spin', author: 'alice', recipe, audio: false,
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
    remove.mockResolvedValue(true);
    fetchShaderSource.mockResolvedValue(null);
    installed = [];
    previewState = null;
  });

  it('lists the most downloaded effects and opens one', async () => {
    listEffects.mockResolvedValue({ ok: true, value: { items: [listing], page: 1, limit: 24, hasMore: false } });
    const onNavigate = vi.fn();
    render(<EffectsMarket path="" username={null} onNavigate={onNavigate} onNeedsSignIn={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Fan spin/ }));
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
    fireEvent.click(await screen.findByRole('button', { name: 'store.install' }));
    await waitFor(() => expect(onNeedsSignIn).toHaveBeenCalled());
    expect(put).not.toHaveBeenCalled();

    downloadEffect.mockResolvedValueOnce({ ok: true, value: { ...listing, downloads: 4 } });
    onNeedsSignIn.mock.calls[0][0]();
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][1]).toMatchObject({ name: 'Fan spin', marketId: ID, marketAuthor: 'alice', downloaded: true });
  });

  it('uninstalls every local copy of the listing after a confirmation', async () => {
    installed = [{ id: 'fx1', name: 'Fan spin', recipe: JSON.stringify(recipe), updatedAt: 1, audio: false, marketId: ID }];
    detail();
    fireEvent.click(await screen.findByRole('button', { name: 'store.effects.uninstall' }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'store.effects.uninstall' }).at(-1)!);
    await waitFor(() => expect(remove).toHaveBeenCalledWith('fx1'));
  });

  it('opens an installed copy on the Lighting page', async () => {
    installed = [{ id: 'fx1', name: 'Fan spin', recipe: JSON.stringify(recipe), updatedAt: 1, audio: false, marketId: ID }];
    const onOpenInLighting = vi.fn();
    render(<EffectsMarket path={ID} username="bob" onNavigate={() => {}} onNeedsSignIn={() => {}} onOpenInLighting={onOpenInLighting} />);
    fireEvent.click(await screen.findByRole('button', { name: 'store.effects.openInLighting' }));
    expect(onOpenInLighting).toHaveBeenCalledWith('custom:fx1');
  });

  it('shows the download count on a browse tile', async () => {
    listEffects.mockResolvedValue({ ok: true, value: { items: [{ ...listing, downloads: 1234567 }], page: 1, limit: 24, hasMore: false } });
    render(<EffectsMarket path="" username={null} onNavigate={() => {}} onNeedsSignIn={() => {}} />);
    const tile = await screen.findByRole('button', { name: /^Fan spin/ });
    expect(screen.getByText(/1.234.567/)).toBeInTheDocument();
    expect(tile.getAttribute('aria-label')).toMatch(/store\.effects\.downloads/);
  });

  it("plays the effect with the Lighting page's controls, changing only the preview", async () => {
    detail();
    const speed = await screen.findByRole('slider', { name: /lighting\.controls\.speed/ });
    fireEvent.change(speed, { target: { value: '80' } });
    await waitFor(() => expect(previewState?.current?.speed).toBe(80));
    expect(put).not.toHaveBeenCalled();
  });

  it('keeps the knobs under StrictMode, which re-runs unmount cleanups', async () => {
    render(<StrictMode><EffectsMarket path={ID} username="bob" onNavigate={() => {}} onNeedsSignIn={() => {}} /></StrictMode>);
    await screen.findByRole('slider', { name: /lighting\.controls\.speed/ });
    // The service has no source for a listing's key: a remount that lost the primed one would fetch it.
    expect(fetchShaderSource).not.toHaveBeenCalled();
  });

  it("unpublishing clears the author's own copy's link, not a downloaded one", async () => {
    installed = [
      { id: 'fx1', name: 'Fan spin', recipe: JSON.stringify(recipe), updatedAt: 1, audio: false, marketId: ID, marketAuthor: 'Alice', downloaded: false } as typeof installed[number],
      { id: 'fx2', name: 'Fan spin', recipe: JSON.stringify(recipe), updatedAt: 2, audio: false, marketId: ID, marketAuthor: 'Alice', downloaded: true } as typeof installed[number],
    ];
    unpublishEffect.mockResolvedValue({ ok: true, value: undefined });
    detail('Alice');
    fireEvent.click(await screen.findByRole('button', { name: 'store.effects.unpublish' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'store.effects.unpublish' }).at(-1)!);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0][0]).toBe('fx1');
    expect(put.mock.calls[0][1]).toMatchObject({ marketId: '' });
  });

  it("offers the author Unpublish instead of Install", async () => {
    detail('Alice');
    expect(await screen.findByRole('button', { name: 'store.effects.unpublish' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'store.install' })).not.toBeInTheDocument();
  });

  it('cannot get an effect this build cannot run', async () => {
    getEffect.mockResolvedValue({ ok: true, value: { ...listing, recipe: { ...recipe, blocks: [{ uid: 'x', type: 'hologram', params: {} }] } } });
    detail();
    expect(await screen.findByText('store.effects.unsupported')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'store.install' })).toBeDisabled();
  });
});
