import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KeyboardState } from '../../../api/logitechKeyboard';
import { LogitechKeyboardDevicePage } from './LogitechKeyboardDevicePage';

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    language: 'en',
    t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
  }),
}));

const api = vi.hoisted(() => ({
  fetchKeyboard: vi.fn(),
  setKeyboardLayers: vi.fn(),
  rewriteKeyboard: vi.fn(),
  setKeyboardEnabled: vi.fn(),
  setKeyboardLayout: vi.fn(),
  keyboardPhotoUrl: vi.fn(() => 'photo.webp'),
}));
vi.mock('../../../api/logitechKeyboard', () => api);

const P = 'devices.logitechKeyboard.';
const M = 'devices.logitechMouse.';
const G1 = 0x6E;
const G2 = 0x77;
const ESC = 0x00;
const A = 0x43;
// The keyboard's control list: key number -> control id (G1 399, G2 400, Esc 332, A 290).
const controls = Array.from({ length: 128 }, (_, i) => ({ [G1]: 399, [G2]: 400, [ESC]: 332, [A]: 290 } as Record<number, number>)[i] ?? 0);
const state = (over: Partial<KeyboardState> = {}): KeyboardState => ({
  present: true,
  model: 'G915 X',
  layoutCode: 0x37,
  layout: 'iso',
  layoutChoice: null,
  layoutDetected: 'iso',
  controls,
  enabled: true,
  written: true,
  layers: { base: [], fn: [], gShift: [] },
  ...over,
});

async function mount(s: KeyboardState) {
  api.fetchKeyboard.mockResolvedValue(s);
  render(<LogitechKeyboardDevicePage />);
  await act(async () => { await Promise.resolve(); });
}

const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const key = (name: string) => screen.getByRole('button', { name });

describe('LogitechKeyboardDevicePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty state when no keyboard is connected', async () => {
    await mount(state({ present: false }));
    expect(screen.getByText(`${P}notFound`)).toBeTruthy();
  });

  it('draws the keys the keyboard has and assigns an action to the selected key', async () => {
    await mount(state());
    expect(key('G1')).toBeTruthy();
    expect(key('Esc')).toBeTruthy();
    expect(screen.getByText(`${M}special.gShift`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'G3' })).toBeNull();

    api.setKeyboardLayers.mockResolvedValue(state({ layers: { base: [{ key: G1, kind: 'mouse', code: 0x10, modifiers: 0 }], fn: [], gShift: [] } }));
    fireEvent.click(key('G1'));
    fireEvent.click(screen.getByText(`${M}mouse.forward`));
    await settle();

    expect(api.setKeyboardLayers).toHaveBeenCalledWith({ base: [{ key: G1, kind: 'mouse', code: 0x10, modifiers: 0 }], fn: [], gShift: [] });
    expect(key(`G1 → ${M}mouse.forward`)).toBeTruthy();
  });

  it('shows Base assignments through on G-Shift and keeps G-Shift itself to the Base layer', async () => {
    await mount(state({ layers: { base: [{ key: A, kind: 'keyboard', code: 0x0F, modifiers: 0 }, { key: G2, kind: 'gshift', code: 2, modifiers: 0 }], fn: [], gShift: [] } }));
    fireEvent.click(screen.getByText(`${P}layer.gShift`));

    fireEvent.click(key('A → L'));
    expect(screen.getByText(`${P}fromBase`)).toBeTruthy();
    // The functions group is open; on G-Shift it offers no G-Shift key.
    expect(screen.getByText(`${P}group.functions`)).toBeTruthy();
    expect(screen.queryByText(`${M}special.gShift`)).toBeNull();

    api.setKeyboardLayers.mockResolvedValue(state());
    // The library's "Disable key" and the selected-key bar's; either assigns it.
    fireEvent.click(screen.getAllByText(`${P}disable`)[0]);
    await settle();
    expect(api.setKeyboardLayers).toHaveBeenCalledWith({
      base: [{ key: A, kind: 'keyboard', code: 0x0F, modifiers: 0 }, { key: G2, kind: 'gshift', code: 2, modifiers: 0 }],
      fn: [],
      gShift: [{ key: A, kind: 'disabled', code: 0, modifiers: 0 }],
    });
  });

  it('records a shortcut with its modifiers', async () => {
    await mount(state());
    api.setKeyboardLayers.mockResolvedValue(state());
    fireEvent.click(key('G2'));
    fireEvent.click(screen.getByText(`${P}shortcut.record`));
    expect(screen.getByText(`${P}shortcut.listening`)).toBeTruthy();

    fireEvent.keyDown(window, { code: 'ControlLeft', ctrlKey: true });
    fireEvent.keyDown(window, { code: 'KeyC', ctrlKey: true });
    await settle();

    expect(api.setKeyboardLayers).toHaveBeenCalledWith({ base: [{ key: G2, kind: 'keyboard', code: 0x06, modifiers: 1 }], fn: [], gShift: [] });
  });

  it('offers to write the layers when Nexus has not written them yet', async () => {
    const layers = { base: [{ key: G1, kind: 'disabled' as const, code: 0, modifiers: 0 }], fn: [], gShift: [] };
    await mount(state({ written: false, layers }));
    api.setKeyboardLayers.mockResolvedValue(state({ layers }));
    fireEvent.click(screen.getByText(`${P}writeNow`));
    await settle();
    expect(api.setKeyboardLayers).toHaveBeenCalledWith(layers);
  });

  it('flips the custom assignments switch', async () => {
    await mount(state());
    api.setKeyboardEnabled.mockResolvedValue(state({ enabled: false }));
    fireEvent.click(screen.getByRole('switch', { name: `${P}switch` }));
    await settle();
    expect(api.setKeyboardEnabled).toHaveBeenCalledWith(false);
  });

  it('greys the keys and keeps them from being picked while the custom assignments are off', async () => {
    await mount(state({ enabled: false }));
    fireEvent.click(key('G1'));
    expect(key('G1').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getAllByText(`${P}switch: ${P}switchOff`).length).toBeGreaterThan(1);
  });
});
