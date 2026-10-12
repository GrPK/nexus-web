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
  stopStudioLive: () => stopLive(),
}));

vi.mock('../../../../hooks/useAudioState', () => ({ useAudioState: () => ({ current: null }) }));
vi.mock('./StudioPreview', () => ({ StudioPreview: () => null }));
vi.mock('./CustomEffectsGrid', () => ({ CustomEffectsGrid: () => null }));

const put = vi.fn();
vi.mock('../../../../api/customEffects', () => ({
  STUDIO_UID_RE: /^[a-z0-9]{1,24}$/,
  customEffectKey: (id: string) => `custom:${id}`,
  customEffectId: (key: string) => key.slice('custom:'.length),
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
    startLive.mockReset().mockResolvedValue({});
    stopLive.mockReset().mockResolvedValue({});
  });

  it('is off on open, sends the effect when switched on, and ends the session on switch-off and close', async () => {
    const { unmount } = render(<ShaderStudio open effectId={null} onClose={() => {}} />);
    const toggle = screen.getByRole('switch');
    expect(toggle).not.toBeChecked();
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

  it('switches live off on a refusal and keeps the message until switched on again', async () => {
    startLive.mockResolvedValueOnce(null);
    render(<ShaderStudio open effectId={null} onClose={() => {}} />);
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    expect(await screen.findByText('lighting.studio.liveFailed')).toBeInTheDocument();
    expect(toggle).not.toBeChecked();
    await waitFor(() => expect(stopLive).toHaveBeenCalledTimes(1));
    fireEvent.click(toggle);
    expect(screen.queryByText('lighting.studio.liveFailed')).not.toBeInTheDocument();
  });

  it('stops only after a send still in flight, and ignores its late refusal', async () => {
    let finish!: (v: unknown) => void;
    startLive.mockReturnValueOnce(new Promise(r => { finish = r; }));
    render(<ShaderStudio open effectId={null} onClose={() => {}} />);
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    await waitFor(() => expect(startLive).toHaveBeenCalledTimes(1));
    fireEvent.click(toggle);
    await act(async () => {});
    expect(stopLive).not.toHaveBeenCalled();
    await act(async () => { finish(null); });
    await waitFor(() => expect(stopLive).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('lighting.studio.liveFailed')).not.toBeInTheDocument();
  });
});
