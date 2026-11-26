import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MouseButton, MouseState } from '../../../api/logitechMouse';
import { LogitechMouseDevicePage } from './LogitechMouseDevicePage';
import { ACTION_MIME } from './logitechMouse/MouseIllustration';
import { normalizeDpi, spreadLabels } from './logitechMouse/DpiTrack';

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    language: 'en',
    t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
  }),
}));

const api = vi.hoisted(() => ({
  fetchMouse: vi.fn(),
  updateMouseProfile: vi.fn(),
  restoreMouseProfile: vi.fn(),
  setMouseActiveProfile: vi.fn(),
  setMouseMode: vi.fn(),
  setMouseProfileCycle: vi.fn(),
  setMouseKeepOnboard: vi.fn(),
  mousePictureUrl: vi.fn(() => 'mouse.png'),
}));
vi.mock('../../../api/logitechMouse', () => api);

const P = 'devices.logitechMouse.';
const button = (slot: number, kind: MouseButton['kind'], code: number): MouseButton => ({ slot, kind, code, modifiers: 0 });
// The G502 X PLUS factory layout.
const buttons = [
  button(0, 'mouse', 1), button(1, 'mouse', 2), button(2, 'mouse', 4), button(3, 'mouse', 8), button(4, 'special', 7),
  button(5, 'mouse', 16), button(6, 'special', 1), button(7, 'special', 2), button(8, 'special', 10), button(9, 'special', 3),
  button(10, 'special', 4),
];
const profile = (n: number, over = {}) => ({
  number: n,
  sector: n,
  enabled: n === 1,
  name: n === 1 ? 'Default' : '',
  reportRateHz: 1000,
  dpi: [1000, 1500, 2000, 2500, 3000],
  defaultDpiIndex: 0,
  shiftDpiIndex: 0,
  buttons,
  gShiftButtons: buttons,
  crcValid: true,
  canRestore: true,
  ...over,
});
const specials = ['none', 'tiltLeft', 'tiltRight', 'dpiUp', 'dpiDown', 'dpiCycle', 'dpiDefault', 'dpiShift', 'profileNext',
  'profilePrevious', 'profileCycle', 'gShift', 'batteryStatus', 'profileSelect', 'modeSwitch', 'hostButton', 'scrollDown', 'scrollUp']
  .map((name, code) => ({ code, name }));
const state = (over: Partial<MouseState> = {}): MouseState => ({
  present: true,
  model: 'G502 X PLUS',
  mode: 'onboard',
  activeProfile: 1,
  buttonCount: 11,
  buttonLabels: ['Left click', 'Right click', 'Middle click', 'Back', 'DPI shift', 'Forward', 'Scroll left', 'Scroll right', 'Profile switch', 'DPI up', 'DPI down'],
  specials,
  reportRatesHz: [1000, 500, 250, 125],
  profiles: [profile(1), profile(2)],
  ...over,
});

async function mount(s: MouseState) {
  api.fetchMouse.mockResolvedValue(s);
  render(<LogitechMouseDevicePage />);
  await act(async () => { await Promise.resolve(); });
}

const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
// The callout button for a G key (the selected-button bar repeats the name, outside any callout).
const callout = (g: string) => screen.getAllByText(g)
  .map(el => el.closest('button'))
  .find(b => b !== null && b.getAttribute('aria-pressed') !== null) as HTMLButtonElement;

describe('LogitechMouseDevicePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty state when no mouse is connected', async () => {
    await mount(state({ present: false, profiles: [] }));
    expect(screen.getByText(`${P}notFound`)).toBeTruthy();
  });

  it('draws a callout per button with what it does', async () => {
    await mount(state());
    for (let g = 1; g <= 11; g++) expect(callout('G' + String(g))).toBeTruthy();
    expect(callout('G1').textContent).toContain(`${P}mouse.left`);
    expect(callout('G6').textContent).toContain(`${P}special.dpiShift`);
    expect(screen.getByDisplayValue('Default')).toBeTruthy();
  });

  it('assigns the picked action to the selected button', async () => {
    api.updateMouseProfile.mockResolvedValue(state());
    await mount(state());
    fireEvent.click(callout('G4'));
    expect(callout('G4').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getAllByText(`${P}mouse.forward`).find(el => el.closest('aside')) as HTMLElement);
    await settle();
    expect(api.updateMouseProfile).toHaveBeenCalledWith(1, { buttons: [{ slot: 3, kind: 'mouse', code: 16, modifiers: 0 }] });
  });

  it('assigns an action dropped on a button, on the G-Shift set when that is shown', async () => {
    api.updateMouseProfile.mockResolvedValue(state());
    await mount(state());
    fireEvent.click(screen.getByText(`${P}layer.gShift`));
    const dataTransfer = { types: [ACTION_MIME], getData: () => 'consumer:205:0', dropEffect: '' };
    fireEvent.dragOver(callout('G5'), { dataTransfer });
    fireEvent.drop(callout('G5'), { dataTransfer });
    await settle();
    expect(api.updateMouseProfile).toHaveBeenCalledWith(1, { gShiftButtons: [{ slot: 5, kind: 'consumer', code: 205, modifiers: 0 }] });
  });

  it('puts a button back to its factory action', async () => {
    api.updateMouseProfile.mockResolvedValue(state());
    await mount(state({ profiles: [profile(1, { buttons: buttons.map(b => (b.slot === 4 ? button(4, 'key', 4) : b)) })] }));
    fireEvent.click(callout('G6'));
    fireEvent.click(screen.getByText(`${P}resetButton`));
    await settle();
    expect(api.updateMouseProfile).toHaveBeenCalledWith(1, { buttons: [{ slot: 4, kind: 'special', code: 7, modifiers: 0 }] });
  });

  it('writes a typed DPI level, kept in ascending order', async () => {
    api.updateMouseProfile.mockResolvedValue(state());
    await mount(state());
    fireEvent.click(screen.getByText(`${P}tab.sensitivity`));
    const input = screen.getByLabelText(`${P}dpiValue`);
    fireEvent.input(input, { target: { value: '2210' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await settle();
    expect(api.updateMouseProfile).toHaveBeenCalledWith(1, { dpi: [1500, 2000, 2200, 2500, 3000], defaultDpiIndex: 2, shiftDpiIndex: 2 });
  });

  it('normalizes DPI levels: ascending, zeros last, start and shift levels follow their values', () => {
    expect(normalizeDpi([3200, 800, 0, 1600, 0], 0, 1)).toEqual({ dpi: [800, 1600, 3200, 0, 0], defaultDpiIndex: 2, shiftDpiIndex: 0 });
  });

  it('keeps DPI values on one row, spreading close ones apart inside the track', () => {
    expect(spreadLabels([100, 300], 1000, 64)).toEqual([100, 300]);
    expect(spreadLabels([500, 520, 540], 1000, 64)).toEqual([456, 520, 584]);
    expect(spreadLabels([0, 10], 1000, 64)).toEqual([32, 96]);
    expect(spreadLabels([990, 1000], 1000, 64)).toEqual([904, 968]);
  });

  it('offers to put the mouse back on its onboard memory when software drives it', async () => {
    api.setMouseMode.mockResolvedValue(state());
    await mount(state({ mode: 'host' }));
    fireEvent.click(screen.getByText(`${P}useOnboard`));
    await settle();
    expect(api.setMouseMode).toHaveBeenCalledWith('onboard');
  });

  it('names a stored macro by the keys it presses and offers it in the library', async () => {
    const macro = [
      { type: 'keyDown', code: 0xE1 }, { type: 'keyDown', code: 0x0B }, { type: 'delay', code: 30 }, { type: 'keyUp', code: 0x0B },
      { type: 'keyUp', code: 0xE1 }, { type: 'keyDown', code: 0x0C }, { type: 'keyUp', code: 0x0C },
    ] as const;
    const withMacro = buttons.map(b => (b.slot === 9 ? { slot: 9, kind: 'macro' as const, code: 6, modifiers: 0, macro: [...macro], macroEditable: true } : b));
    await mount(state({ profiles: [profile(1, { buttons: withMacro })] }));
    // Slot 9 is DPI up, printed G8 on the mouse.
    expect(callout('G8').textContent).toContain(`${P}macro.summary:{"keys":"Shift+H, I"}`);
    expect(screen.getAllByText(`${P}macro.summary:{"keys":"Shift+H, I"}`).some(el => el.closest('aside'))).toBe(true);
    fireEvent.click(callout('G8'));
    fireEvent.click(screen.getByText(`${P}macro.edit`));
    expect(screen.getAllByText(`${P}macro.pressed:{"key":"H"}`)).toHaveLength(1);
  });

  it('records a macro and stores it in the mouse on the selected button', async () => {
    api.updateMouseProfile.mockResolvedValue(state());
    await mount(state());
    fireEvent.click(callout('G4'));
    fireEvent.click(screen.getAllByText(`${P}macro.new`).find(el => el.closest('aside')) as HTMLElement);
    fireEvent.click(screen.getByText(`${P}macro.delay.none`));
    fireEvent.click(screen.getByText(`${P}macro.record`));
    fireEvent.keyDown(window, { code: 'ControlLeft' });
    fireEvent.keyDown(window, { code: 'KeyC' });
    fireEvent.keyDown(window, { code: 'KeyC', repeat: true });
    fireEvent.keyUp(window, { code: 'KeyC' });
    fireEvent.click(screen.getByText(`${P}macro.stop`));
    fireEvent.click(screen.getByText(`${P}macro.save`));
    await settle();
    expect(api.updateMouseProfile).toHaveBeenCalledWith(1, { buttons: [{ slot: 3, kind: 'macro', code: 0, modifiers: 0, macro: [
      { type: 'keyDown', code: 0xE0, modifiers: 0 }, { type: 'keyDown', code: 0x06, modifiers: 0 },
      { type: 'keyUp', code: 0x06, modifiers: 0 }, { type: 'keyUp', code: 0xE0, modifiers: 0 },
    ] }] });
  });

  it('restores a profile from its backup', async () => {
    api.restoreMouseProfile.mockResolvedValue(state());
    await mount(state());
    fireEvent.click(screen.getByText(`${P}restore`));
    await settle();
    expect(api.restoreMouseProfile).toHaveBeenCalledWith(1);
  });
});
