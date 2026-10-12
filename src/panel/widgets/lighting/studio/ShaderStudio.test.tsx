import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShaderStudio } from './ShaderStudio';
import type { MarketLink } from './studioLibrary';

vi.mock('../../../../lib/i18n', () => ({
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));

const startLive = vi.fn();
const stopLive = vi.fn();
vi.mock('../../../../api/lighting', () => ({
  primeShaderSource: () => {},
  forgetShaderSource: () => {},
  invalidateShaderSource: () => {},
  startStudioLive: (...a: unknown[]) => startLive(...a),
  stopStudioLive: (...a: unknown[]) => stopLive(...a),
}));

vi.mock('../../../../hooks/useAudioState', () => ({ useAudioState: () => ({ current: null }) }));
vi.mock('./StudioPreview', () => ({ StudioPreview: () => null }));
vi.mock('./CustomEffectsGrid', () => ({ CustomEffectsGrid: () => null }));

const put = vi.fn();
let savedEntries: unknown[] = [];
vi.mock('../../../../api/customEffects', () => ({
  STUDIO_UID_RE: /^[a-z0-9]{1,24}$/,
  customEffectKey: (id: string) => `custom:${id}`,
  customEffectId: (key: string) => key.slice('custom:'.length),
  getCustomEffects: () => savedEntries,
  useCustomEffects: () => savedEntries,
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

describe('ShaderStudio history keys', () => {
  // Both modifiers, so the shortcut matches whichever platform the test UA reports.
  const press = (shiftKey = false, target: EventTarget = window) =>
    fireEvent.keyDown(target, { code: 'KeyZ', key: 'z', metaKey: true, ctrlKey: true, shiftKey });

  it('undoes and redoes with Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z, from a slider but not a text field', () => {
    render(<ShaderStudio open effectId={null} onClose={() => {}} />);
    const undo = screen.getByRole('button', { name: 'lighting.studio.undo' });
    const redo = screen.getByRole('button', { name: 'lighting.studio.redo' });
    fireEvent.click(screen.getByRole('button', { name: 'lighting.studio.surprise' }));
    fireEvent.click(screen.getByRole('button', { name: 'lighting.studio.surprise' }));
    expect(undo).toBeEnabled();

    const field = document.body.appendChild(document.createElement('input'));
    press(false, field);
    expect(redo).toBeDisabled();
    field.remove();

    const slider = document.body.appendChild(Object.assign(document.createElement('input'), { type: 'range' }));
    press(false, slider);
    expect(redo).toBeEnabled();
    slider.remove();
    press();
    expect(undo).toBeDisabled();
    expect(redo).toBeEnabled();
    press(true);
    expect(undo).toBeEnabled();
  });
});

describe('ShaderStudio variations', () => {
  it('leaves only Done available until a variation is decided', () => {
    render(<ShaderStudio open effectId={null} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'lighting.studio.variations' }));
    for (const name of ['lighting.studio.surprise', 'lighting.studio.publish.button', 'lighting.studio.save', 'lighting.studio.undo']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    fireEvent.click(screen.getByRole('button', { name: 'lighting.studio.done' }));
    expect(screen.getByRole('button', { name: 'lighting.studio.surprise' })).toBeEnabled();
  });
});

describe('ShaderStudio live on devices', () => {
  beforeEach(() => {
    startLive.mockReset().mockResolvedValue({ active: true, leaseMs: 15000, sessionId: 's0' });
    stopLive.mockReset().mockResolvedValue({});
  });

  it('is off on open, sends the effect when switched on, and ends the session on switch-off and close', async () => {
    const { unmount } = render(<ShaderStudio open effectId={null} onClose={() => {}} />);
    const toggle = screen.getByRole('button', { name: 'lighting.studio.live' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(startLive).not.toHaveBeenCalled();

    fireEvent.click(toggle);
    await waitFor(() => expect(startLive).toHaveBeenCalledTimes(1));
    expect(startLive.mock.calls[0][0]).toContain('void main');
    fireEvent.click(toggle);
    await waitFor(() => expect(stopLive).toHaveBeenCalledTimes(1));

    fireEvent.click(toggle);
    await waitFor(() => expect(startLive).toHaveBeenCalledTimes(2));
    unmount();
    await waitFor(() => expect(stopLive).toHaveBeenCalledTimes(2));
  });

  it('renews and stops the session under the id the service gave it', async () => {
    startLive.mockResolvedValue({ active: true, leaseMs: 15000, sessionId: 's1' });
    render(<ShaderStudio open effectId={null} onClose={() => {}} />);
    const toggle = screen.getByRole('button', { name: 'lighting.studio.live' });
    fireEvent.click(toggle);
    await waitFor(() => expect(startLive).toHaveBeenCalledTimes(1));
    expect(startLive.mock.calls[0][2]).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'lighting.studio.surprise' }));
    await waitFor(() => expect(startLive).toHaveBeenCalledTimes(2));
    expect(startLive.mock.calls[1][2]).toBe('s1');
    fireEvent.click(toggle);
    await waitFor(() => expect(stopLive).toHaveBeenCalledWith('s1'));
  });

  it('switches live off on a refusal and keeps the message until switched on again', async () => {
    startLive.mockResolvedValueOnce(null);
    render(<ShaderStudio open effectId={null} onClose={() => {}} />);
    const toggle = screen.getByRole('button', { name: 'lighting.studio.live' });
    fireEvent.click(toggle);
    expect(await screen.findByText('lighting.studio.liveFailed')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    // Refused before any session was ours: no id-less stop that could end another tab's session.
    await act(async () => {});
    expect(stopLive).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    expect(screen.queryByText('lighting.studio.liveFailed')).not.toBeInTheDocument();
  });

  it('says lighting is off while the service reports no running mode, and clears it once one runs', async () => {
    startLive.mockResolvedValue({ active: true, leaseMs: 15000, sessionId: 's2', lightingOff: true });
    render(<ShaderStudio open effectId={null} onClose={() => {}} />);
    const toggle = screen.getByRole('button', { name: 'lighting.studio.live' });
    fireEvent.click(toggle);
    expect(await screen.findByText('lighting.studio.liveOff')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    startLive.mockResolvedValue({ active: true, leaseMs: 15000, sessionId: 's2', lightingOff: false });
    // An edit sends the next renewal.
    fireEvent.click(screen.getByRole('button', { name: /lighting\.studio\.surprise/ }));
    await waitFor(() => expect(screen.queryByText('lighting.studio.liveOff')).not.toBeInTheDocument());
    // Off again, then a new session that the service answers with lighting on: no stale notice.
    startLive.mockResolvedValue({ active: true, leaseMs: 15000, sessionId: 's3', lightingOff: true });
    fireEvent.click(screen.getByRole('button', { name: /lighting\.studio\.surprise/ }));
    expect(await screen.findByText('lighting.studio.liveOff')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByText('lighting.studio.liveOff')).not.toBeInTheDocument();
    startLive.mockResolvedValue({ active: true, leaseMs: 15000, sessionId: 's4', lightingOff: false });
    fireEvent.click(toggle);
    await waitFor(() => expect(startLive.mock.calls.at(-1)?.[2]).toBeNull());
    await act(async () => {});
    expect(screen.queryByText('lighting.studio.liveOff')).not.toBeInTheDocument();
    fireEvent.click(toggle);
  });

  it('stops only after a send still in flight, and ignores its late refusal', async () => {
    let finish!: (v: unknown) => void;
    startLive.mockReturnValueOnce(new Promise(r => { finish = r; }));
    render(<ShaderStudio open effectId={null} onClose={() => {}} />);
    const toggle = screen.getByRole('button', { name: 'lighting.studio.live' });
    fireEvent.click(toggle);
    await waitFor(() => expect(startLive).toHaveBeenCalledTimes(1));
    fireEvent.click(toggle);
    await act(async () => {});
    expect(stopLive).not.toHaveBeenCalled();
    await act(async () => { finish({ active: true, leaseMs: 15000, sessionId: 's9' }); });
    await waitFor(() => expect(stopLive).toHaveBeenCalledWith('s9'));
    expect(screen.queryByText('lighting.studio.liveFailed')).not.toBeInTheDocument();
  });
});

describe('ShaderStudio save prompt', () => {
  it('says whether the name saves a new effect or replaces one, and saves to match', async () => {
    const recipe = { v: 1, blocks: [{ uid: 'a1', type: 'rings', params: {} }, { uid: 'b2', type: 'palette', params: {} }], speed: 50, hue: 0, saturation: 1, contrast: 1 };
    savedEntries = [{ id: 'fx1', name: 'Glow', recipe: JSON.stringify(recipe), updatedAt: 1, audio: false }];
    put.mockReset().mockResolvedValue({ entry: {} });
    render(<ShaderStudio open effectId={null} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'lighting.studio.save' }));
    const field = screen.getByPlaceholderText('lighting.studio.namePlaceholder');
    fireEvent.change(field, { target: { value: 'Fresh' } });
    expect(screen.getByText('lighting.studio.saveNew')).toBeInTheDocument();
    fireEvent.change(field, { target: { value: ' glow ' } });
    expect(screen.getByText('lighting.studio.saveReplaces')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'lighting.studio.save' }).at(-1)!);
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][0]).toBe('fx1');
    savedEntries = [];
  });
});
