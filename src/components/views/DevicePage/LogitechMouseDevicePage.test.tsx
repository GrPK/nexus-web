import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MouseButton, MouseState } from '../../../api/logitechMouse';
import { LogitechMouseDevicePage } from './LogitechMouseDevicePage';

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
}));
vi.mock('../../../api/logitechMouse', () => api);

const P = 'devices.logitechMouse.';
const button = (slot: number, kind: MouseButton['kind'], code: number): MouseButton => ({ slot, kind, code, modifiers: 0 });
const buttons = [button(0, 'mouse', 1), button(1, 'mouse', 2), button(2, 'special', 7)];
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
const state = (over: Partial<MouseState> = {}): MouseState => ({
  present: true,
  model: 'G502 X PLUS',
  mode: 'onboard',
  activeProfile: 1,
  buttonCount: 3,
  buttonLabels: ['Left click', 'Right click', 'DPI shift'],
  specials: [{ code: 0, name: 'none' }, { code: 7, name: 'dpiShift' }, { code: 3, name: 'dpiUp' }],
  reportRatesHz: [1000, 500, 250, 125],
  profiles: [profile(1), profile(2)],
  ...over,
});

async function mount(s: MouseState) {
  api.fetchMouse.mockResolvedValue(s);
  render(<LogitechMouseDevicePage />);
  await act(async () => { await Promise.resolve(); });
}

describe('LogitechMouseDevicePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the empty state when no mouse is connected', async () => {
    await mount(state({ present: false, profiles: [] }));
    expect(screen.getByText(`${P}notFound`)).toBeTruthy();
  });

  it('shows the active profile with its DPI levels', async () => {
    await mount(state());
    expect(screen.getByDisplayValue('1000')).toBeTruthy();
    expect(screen.getByDisplayValue('3000')).toBeTruthy();
    expect(screen.getByDisplayValue('Default')).toBeTruthy();
  });

  it('sends a changed DPI level rounded to the sensor step', async () => {
    api.updateMouseProfile.mockResolvedValue(state());
    await mount(state());
    const input = screen.getByDisplayValue('1500');
    fireEvent.input(input, { target: { value: '1620' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => { await Promise.resolve(); });
    expect(api.updateMouseProfile).toHaveBeenCalledWith(1, { dpi: [1000, 1600, 2000, 2500, 3000] });
  });

  it('refuses a DPI level outside the sensor range without writing', async () => {
    await mount(state());
    const input = screen.getByDisplayValue('2000');
    fireEvent.input(input, { target: { value: '50' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => { await Promise.resolve(); });
    expect(api.updateMouseProfile).not.toHaveBeenCalled();
  });

  it('offers to put the mouse back on its onboard memory when software drives it', async () => {
    api.setMouseMode.mockResolvedValue(state());
    await mount(state({ mode: 'host' }));
    fireEvent.click(screen.getByText(`${P}useOnboard`));
    await act(async () => { await Promise.resolve(); });
    expect(api.setMouseMode).toHaveBeenCalledWith('onboard');
  });

  it('restores a profile from its backup', async () => {
    api.restoreMouseProfile.mockResolvedValue(state());
    await mount(state());
    fireEvent.click(screen.getByText(`${P}restore`));
    await act(async () => { await Promise.resolve(); });
    expect(api.restoreMouseProfile).toHaveBeenCalledWith(1);
  });
});
