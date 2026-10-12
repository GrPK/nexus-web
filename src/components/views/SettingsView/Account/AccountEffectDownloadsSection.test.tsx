import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountEffectDownloadsSection } from './AccountEffectDownloadsSection';

vi.mock('../../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, string>) => (params?.author ? `${key} ${params.author}` : key) }),
}));
vi.mock('../../../../hooks/useUiSettings', () => ({ useUnitPrefs: () => ({ dateFormat: 'system', numberFormat: 'system' }) }));
vi.mock('../../../../panel/widgets/lighting/studio/recipePreview', () => ({ attachRecipePreview: () => () => {} }));

const listEffectDownloads = vi.fn();
vi.mock('../../../../api/effectMarket', () => ({ listEffectDownloads: () => listEffectDownloads() }));

const saveEffect = vi.fn();
const deleteEffect = vi.fn();
let saved: { id: string; marketId: string | null }[] = [];
vi.mock('../../../../panel/widgets/lighting/studio/studioLibrary', () => ({
  useSavedEffects: () => saved,
  saveEffect: (...a: unknown[]) => saveEffect(...a),
  deleteEffect: (...a: unknown[]) => deleteEffect(...a),
  newEffectId: () => 'fxnew',
  parseMarketRecipe: (r: unknown) => r,
}));

const recipe = { v: 1, blocks: [], speed: 50, hue: 0, saturation: 1, contrast: 1 };
const row = (over: Record<string, unknown>) => ({
  id: 'L1', name: 'Aurora', author: 'lumenlab', downloadedAt: '2026-10-12T10:00:00Z', removed: false, recipe, ...over,
});

describe('AccountEffectDownloadsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saved = [];
    saveEffect.mockResolvedValue(null);
    deleteEffect.mockResolvedValue(true);
  });

  it('marks a removed download and offers neither install nor the Marketplace page', async () => {
    listEffectDownloads.mockResolvedValue({ ok: true, value: { items: [row({ removed: true, recipe: null })] } });
    render(<AccountEffectDownloadsSection onOpenStoreEffect={() => {}} />);
    expect(await screen.findByText('account.effects.removed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'store.install' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'account.purchases.viewInStore' })).toBeNull();
  });

  it('keeps a removed download that is installed, and uninstalls it on confirm', async () => {
    saved = [{ id: 'fx1', marketId: 'L1' }];
    listEffectDownloads.mockResolvedValue({ ok: true, value: { items: [row({ removed: true, recipe: null })] } });
    render(<AccountEffectDownloadsSection />);
    expect(await screen.findByText('account.effects.installed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'store.effects.uninstall' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'store.effects.uninstall' }).at(-1)!);
    await waitFor(() => expect(deleteEffect).toHaveBeenCalledWith('fx1'));
  });

  it('installs a download that is not on this PC as a Marketplace copy', async () => {
    listEffectDownloads.mockResolvedValue({ ok: true, value: { items: [row({})] } });
    const onOpenStoreEffect = vi.fn();
    render(<AccountEffectDownloadsSection onOpenStoreEffect={onOpenStoreEffect} />);
    fireEvent.click(await screen.findByRole('button', { name: 'store.install' }));
    await waitFor(() => expect(saveEffect).toHaveBeenCalledWith('fxnew', 'Aurora', recipe, { marketId: 'L1', marketAuthor: 'lumenlab', downloaded: true }));
    fireEvent.click(screen.getByRole('button', { name: 'account.purchases.viewInStore' }));
    expect(onOpenStoreEffect).toHaveBeenCalledWith('L1');
  });

  it('leaves out the author line when the author account is gone', async () => {
    listEffectDownloads.mockResolvedValue({ ok: true, value: { items: [row({ author: '', removed: true, recipe: null })] } });
    render(<AccountEffectDownloadsSection />);
    await screen.findByText('Aurora');
    expect(screen.queryByText(/store\.effects\.byAuthor/)).toBeNull();
  });
});
