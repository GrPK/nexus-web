import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishEffectModal } from './PublishEffectModal';
import { makeBlock, type StudioRecipe } from './studioCompiler';

vi.mock('../../../../lib/i18n', () => ({
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));

const fetchCloudAccounts = vi.fn();
vi.mock('../../../../api/cloud', () => ({ fetchCloudAccounts: () => fetchCloudAccounts() }));

const publishEffect = vi.fn();
const updateEffect = vi.fn();
const getEffect = vi.fn();
vi.mock('../../../../api/effectMarket', () => ({
  publishEffect: (...a: unknown[]) => publishEffect(...a),
  updateEffect: (...a: unknown[]) => updateEffect(...a),
  getEffect: (...a: unknown[]) => getEffect(...a),
}));

vi.mock('../../../../components/views/SettingsView/Account/AccountSignInModal', () => ({
  AccountSignInModal: ({ open, onSignedIn }: { open: boolean; onSignedIn: () => void }) =>
    open ? <button type="button" onClick={onSignedIn}>signed-in</button> : null,
}));

const recipe: StudioRecipe = { v: 1, blocks: [makeBlock('rings'), makeBlock('palette')], speed: 50, hue: 0, saturation: 1, contrast: 1 };
const listing = { id: 'L1', name: 'Spin', description: null, author: 'alice', recipe, audio: false, downloads: 0, createdAt: '', updatedAt: '' };
const signedIn = (username: string | null) => fetchCloudAccounts.mockResolvedValue(
  username ? { accounts: [{ accountId: 'a', username }], activeAccountId: 'a' } : { accounts: [], activeAccountId: null },
);

function show(link: { marketId: string; marketAuthor: string } | null = null) {
  const save = vi.fn().mockResolvedValue(null);
  render(<PublishEffectModal open initialName="Spin" recipe={recipe} link={link} save={save} onClose={() => {}} />);
  return save;
}

describe('PublishEffectModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEffect.mockResolvedValue({ ok: false, error: 'not_found' });
  });

  it('saves, publishes, then stores the listing link', async () => {
    signedIn('alice');
    publishEffect.mockResolvedValue({ ok: true, value: listing });
    const save = show();
    fireEvent.click(await screen.findByRole('button', { name: 'lighting.studio.publish.confirm' }));
    expect(await screen.findByText('lighting.studio.publish.doneTitle')).toBeInTheDocument();
    expect(publishEffect).toHaveBeenCalledWith({ name: 'Spin', description: undefined, recipe });
    expect(save.mock.calls).toEqual([['Spin'], ['Spin', { marketId: 'L1', marketAuthor: 'alice' }]]);
  });

  it("updates the author's own listing, and publishes anew when it was removed", async () => {
    signedIn('Alice');
    updateEffect.mockResolvedValue({ ok: false, error: 'not_found' });
    publishEffect.mockResolvedValue({ ok: true, value: listing });
    show({ marketId: 'L0', marketAuthor: 'alice' });
    fireEvent.click(await screen.findByRole('button', { name: 'lighting.studio.publish.update' }));
    await screen.findByText('lighting.studio.publish.doneTitle');
    expect(updateEffect.mock.calls[0][0]).toBe('L0');
    expect(publishEffect).toHaveBeenCalled();
  });

  it('publishes a downloaded effect as a new listing', async () => {
    signedIn('bob');
    publishEffect.mockResolvedValue({ ok: true, value: { ...listing, author: 'bob' } });
    show({ marketId: 'L0', marketAuthor: 'alice' });
    fireEvent.click(await screen.findByRole('button', { name: 'lighting.studio.publish.confirm' }));
    await screen.findByText('lighting.studio.publish.doneTitle');
    expect(updateEffect).not.toHaveBeenCalled();
  });

  it('signs in first, then finishes the publish', async () => {
    signedIn(null);
    publishEffect.mockResolvedValue({ ok: true, value: listing });
    const save = show();
    fireEvent.click(await screen.findByRole('button', { name: 'lighting.studio.publish.signIn' }));
    expect(publishEffect).not.toHaveBeenCalled();
    signedIn('alice');
    fireEvent.click(screen.getByRole('button', { name: 'signed-in' }));
    await waitFor(() => expect(publishEffect).toHaveBeenCalled());
    expect(await screen.findByText('lighting.studio.publish.doneTitle')).toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('keeps the form when the effect is renamed mid-publish', async () => {
    signedIn('alice');
    const save = vi.fn().mockResolvedValue(null);
    const { rerender } = render(<PublishEffectModal open initialName="" recipe={recipe} link={null} save={save} onClose={() => {}} />);
    await screen.findByRole('button', { name: 'lighting.studio.publish.confirm' });
    fireEvent.input(screen.getByRole('textbox', { name: 'lighting.studio.publish.description' }), { target: { value: 'Spins' } });
    rerender(<PublishEffectModal open initialName="Spin" recipe={recipe} link={null} save={save} onClose={() => {}} />);
    expect(screen.getByRole('textbox', { name: 'lighting.studio.publish.description' })).toHaveValue('Spins');
    expect(fetchCloudAccounts).toHaveBeenCalledTimes(1);
  });

  it('does not publish on a later open when the sign-in left no session', async () => {
    signedIn(null);
    publishEffect.mockResolvedValue({ ok: true, value: listing });
    const save = vi.fn().mockResolvedValue(null);
    const props = { initialName: 'Spin', recipe, link: null, save, onClose: () => {} };
    const { rerender } = render(<PublishEffectModal open {...props} />);
    fireEvent.click(await screen.findByRole('button', { name: 'lighting.studio.publish.signIn' }));
    fireEvent.click(screen.getByRole('button', { name: 'signed-in' }));
    await waitFor(() => expect(fetchCloudAccounts).toHaveBeenCalledTimes(2));
    rerender(<PublishEffectModal open={false} {...props} />);
    signedIn('alice');
    rerender(<PublishEffectModal open {...props} />);
    await screen.findByRole('button', { name: 'lighting.studio.publish.confirm' });
    expect(publishEffect).not.toHaveBeenCalled();
  });

  it("prefills the listing's description once, whatever the parent re-renders", async () => {
    signedIn('alice');
    getEffect.mockResolvedValue({ ok: true, value: { ...listing, description: 'From cloud' } });
    const save = vi.fn().mockResolvedValue(null);
    const props = { open: true, initialName: 'Spin', recipe, save, onClose: () => {} };
    const { rerender } = render(<PublishEffectModal {...props} link={{ marketId: 'L0', marketAuthor: 'alice' }} />);
    const field = await screen.findByRole('textbox', { name: 'lighting.studio.publish.description' });
    await waitFor(() => expect(field).toHaveValue('From cloud'));
    fireEvent.input(field, { target: { value: 'Edited' } });
    rerender(<PublishEffectModal {...props} link={{ marketId: 'L0', marketAuthor: 'alice' }} />);
    await waitFor(() => expect(getEffect).toHaveBeenCalledTimes(1));
    expect(field).toHaveValue('Edited');
  });
});
