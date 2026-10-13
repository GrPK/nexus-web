import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountEffectDownloadsSection } from './AccountEffectDownloadsSection';

vi.mock('../../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, string>) => (params?.author ? `${key} ${params.author}` : key) }),
}));
vi.mock('../../../../hooks/useUiSettings', () => ({ useUnitPrefs: () => ({ dateFormat: 'system', numberFormat: 'system' }) }));
vi.mock('../../../../panel/widgets/lighting/studio/recipePreview', () => ({ attachRecipePreview: () => () => {} }));

const listEffectDownloads = vi.fn();
const downloadEffect = vi.fn();
vi.mock('../../../../api/effectMarket', () => ({
  listEffectDownloads: () => listEffectDownloads(),
  downloadEffect: (id: string) => downloadEffect(id),
}));

const saveEffect = vi.fn();
let saved: { id: string; name: string; marketId: string | null }[] = [];
vi.mock('../../../../panel/widgets/lighting/studio/studioLibrary', async importOriginal => ({
  copyName: (await importOriginal<typeof import('../../../../panel/widgets/lighting/studio/studioLibrary')>()).copyName,
  getSavedEffects: () => saved,
  saveEffect: (...a: unknown[]) => saveEffect(...a),
  newEffectId: () => 'fxnew',
  parseMarketRecipe: (r: unknown) => r,
}));

const recipe = { v: 1, blocks: [], speed: 50, hue: 0, saturation: 1, contrast: 1 };
const row = (over: Record<string, unknown>) => ({
  id: 'L1', name: 'Aurora', author: 'lumenlab', downloadedAt: '2026-10-12T10:00:00Z', removed: false, recipe, version: 1, latestVersion: 1, ...over,
});
const listing = { id: 'L1', name: 'Aurora', author: 'lumenlab', recipe, version: 3 };

describe('AccountEffectDownloadsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saved = [];
    saveEffect.mockResolvedValue(null);
    downloadEffect.mockResolvedValue({ ok: true, value: listing });
  });

  it('marks a removed download and offers neither a copy nor the Marketplace page', async () => {
    listEffectDownloads.mockResolvedValue({ ok: true, value: { items: [row({ removed: true, recipe: null, latestVersion: null })] } });
    render(<AccountEffectDownloadsSection onOpenStoreEffect={() => {}} />);
    expect(await screen.findByText('account.effects.removed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'account.effects.addAgain' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'account.purchases.viewInStore' })).toBeNull();
  });

  it('adds a fresh copy of the listing as it is now, named apart from the copies you have', async () => {
    saved = [{ id: 'fx1', name: 'Aurora', marketId: 'L1' }];
    listEffectDownloads.mockResolvedValue({ ok: true, value: { items: [row({})] } });
    const onOpenStoreEffect = vi.fn();
    render(<AccountEffectDownloadsSection onOpenStoreEffect={onOpenStoreEffect} />);
    fireEvent.click(await screen.findByRole('button', { name: 'account.effects.addAgain' }));
    await waitFor(() => expect(saveEffect).toHaveBeenCalledWith('fxnew', 'Aurora 2', recipe, { marketId: 'L1', marketAuthor: 'lumenlab', downloaded: true }));
    expect(downloadEffect).toHaveBeenCalledWith('L1');
    expect(await screen.findByText('account.effects.added')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'account.purchases.viewInStore' }));
    expect(onOpenStoreEffect).toHaveBeenCalledWith('L1');
  });

  it('shows the version copied and a newer one the author has listed since', async () => {
    listEffectDownloads.mockResolvedValue({ ok: true, value: { items: [row({ version: 2, latestVersion: 4 })] } });
    render(<AccountEffectDownloadsSection />);
    expect(await screen.findByText('account.effects.copiedVersion')).toBeInTheDocument();
    expect(screen.getByText('account.effects.latestVersion')).toBeInTheDocument();
  });

  it('leaves out the author line when the author account is gone', async () => {
    listEffectDownloads.mockResolvedValue({ ok: true, value: { items: [row({ author: '', removed: true, recipe: null })] } });
    render(<AccountEffectDownloadsSection />);
    await screen.findByText('Aurora');
    expect(screen.queryByText(/store\.effects\.byAuthor/)).toBeNull();
  });
});
