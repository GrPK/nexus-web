import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsiahorseUmbraDevicePage } from './AsiahorseUmbraDevicePage';
import type { UmbraEffectSettings, UmbraState } from '../../../api/asiahorse-umbra';

/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));

const mockGet = vi.fn();
const mockLighting = vi.fn();
const mockPort = vi.fn();
const mockDetect = vi.fn();
const mockFan = vi.fn();
const mockBoot = vi.fn();

vi.mock('../../../api/asiahorse-umbra', () => ({
  getUmbraState: (...a: any[]) => mockGet(...a),
  setUmbraLighting: (...a: any[]) => mockLighting(...a),
  setUmbraPort: (...a: any[]) => mockPort(...a),
  autoDetectUmbra: (...a: any[]) => mockDetect(...a),
  setUmbraFan: (...a: any[]) => mockFan(...a),
  setUmbraBoot: (...a: any[]) => mockBoot(...a),
}));

vi.mock('../../common/HsvPicker/HsvPicker', () => ({
  HsvPicker: ({ value, onCommit }: { value: string; onCommit: (hex: string) => void }) => (
    <button type="button" data-testid="picker" data-value={value} onClick={() => onCommit('#abcdef')} />
  ),
}));

const P = 'devices.asiahorse-umbra.';

const fx = (effect: string): UmbraEffectSettings => ({
  effect, speed: 3, brightness: 3, direction: 'forward', colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'],
});

function makeState(over: Partial<UmbraState> = {}): UmbraState {
  return {
    isConnected: true,
    deviceId: 'CDAB2F9648BC44FE',
    firmware: '1.0.6',
    lighting: { source: 'firmware', lightOn: true, group: 'sync', sync: fx('rainbow'), merge: fx('runway'), async: [] },
    fan: { syncMb: false, duty: 20 },
    boot: { mode: 'memory', selfCheck: true },
    ports: Array.from({ length: 10 }, (_, i) => ({
      index: i, ledCount: i === 9 ? 6 : 0, direction: 'forward' as const, order: i + 1,
    })),
    effects: [
      { key: 'static', colors: 1, speed: false, direction: false, merge: false },
      { key: 'rainbow', colors: 0, speed: true, direction: true, merge: true },
      { key: 'breath', colors: 4, speed: true, direction: false, merge: false },
      { key: 'runway', colors: 1, speed: true, direction: true, merge: true },
    ],
    ...over,
  };
}

const withSync = (effect: string) => {
  const s = makeState();
  s.lighting.sync = fx(effect);
  return s;
};

type Tab = 'device' | 'lighting' | 'fans' | 'settings';
const TAB_NAMES: Record<Tab, string> = {
  device: `${P}statusSection`,
  lighting: 'lighting.title',
  fans: `${P}fanSection`,
  settings: 'nav.settings',
};

function openTab(tab: Tab) {
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${TAB_NAMES[tab]}$`) }));
}

async function mount(state: UmbraState, tab: Tab = 'lighting', onSectionNavigate?: (s: string) => void) {
  mockGet.mockResolvedValue(state);
  await act(async () => { render(<AsiahorseUmbraDevicePage onSectionNavigate={onSectionNavigate} />); });
  if (tab !== 'device') openTab(tab);
}

beforeEach(() => {
  // The service answers with the canonical state, so echo the source and mode the patch set.
  mockLighting.mockImplementation(async (patch: { source?: UmbraState['lighting']['source']; group?: UmbraState['lighting']['group'] }) => {
    const s = makeState();
    if (patch.source) s.lighting.source = patch.source;
    if (patch.group) s.lighting.group = patch.group;
    return s;
  });
  mockPort.mockImplementation(async () => makeState());
  mockFan.mockImplementation(async () => makeState());
  mockBoot.mockImplementation(async () => makeState());
});

afterEach(() => { vi.clearAllMocks(); });

describe('AsiahorseUmbraDevicePage', () => {
  it('shows the not-connected state', async () => {
    await mount(makeState({ isConnected: false }), 'device');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByText(`${P}notConnected`)).toBeInTheDocument();
  });

  it('opens on the Device tab and switches between the four tabs', async () => {
    mockGet.mockResolvedValue(makeState());
    await act(async () => { render(<AsiahorseUmbraDevicePage />); });
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([
      `${P}statusSection`, 'lighting.title', `${P}fanSection`, 'nav.settings',
    ]);
    expect(screen.getByText('1.0.6')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: `${P}fanSync` })).not.toBeInTheDocument();
    openTab('fans');
    expect(screen.getByRole('switch', { name: `${P}fanSync` })).toBeInTheDocument();
    openTab('settings');
    expect(screen.getByRole('switch', { name: `${P}selfCheck` })).toBeInTheDocument();
  });

  it('shows the device identity', async () => {
    await mount(makeState(), 'device');
    expect(screen.getByText('1.0.6')).toBeInTheDocument();
    expect(screen.getByText('CDAB2F9648BC44FE')).toBeInTheDocument();
  });

  it('switches the lighting source and hides the effect controls off device effects', async () => {
    await mount(makeState());
    expect(screen.getByRole('radio', { name: `${P}effect.rainbow` })).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: `${P}sourceNexus` })); });
    expect(mockLighting).toHaveBeenCalledWith({ source: 'nexus' });
    expect(screen.queryByRole('radio', { name: `${P}effect.rainbow` })).not.toBeInTheDocument();
    expect(screen.getByText(`${P}sourceNexusHint`)).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: `${P}sourceArgb` })); });
    expect(mockLighting).toHaveBeenLastCalledWith({ source: 'argbInput' });
    expect(screen.getByText(`${P}sourceArgbHint`)).toBeInTheDocument();
  });

  it('sends only the effect key when an effect is picked', async () => {
    await mount(makeState());
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: `${P}effect.runway` })); });
    expect(mockLighting).toHaveBeenCalledWith({ sync: { effect: 'runway' } });
  });

  it('offers the controls the selected effect reads', async () => {
    await mount(withSync('static'));
    expect(screen.queryByText('devices.lianli.lightingSpeed')).not.toBeInTheDocument();
    expect(screen.queryByText('devices.lianli.lightingDirection')).not.toBeInTheDocument();
    expect(screen.getByText('devices.lianli.lightingBrightness')).toBeInTheDocument();
    expect(screen.getByTestId('picker')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'devices.lianli.colorN:{"n":2}' })).not.toBeInTheDocument();
  });

  it('shows speed and direction but no colors for rainbow', async () => {
    await mount(makeState());
    expect(screen.getByText('devices.lianli.lightingSpeed')).toBeInTheDocument();
    expect(screen.getByText('devices.lianli.lightingDirection')).toBeInTheDocument();
    expect(screen.queryByTestId('picker')).not.toBeInTheDocument();
  });

  it('shows one swatch per color slot and commits the whole color list', async () => {
    await mount(withSync('breath'));
    expect(screen.getAllByRole('radio', { name: /colorN/ })).toHaveLength(4);
    expect(screen.getByRole('radiogroup', { name: `${P}colors` })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'devices.lianli.colorN:{"n":3}' })); });
    expect(screen.getByTestId('picker')).toHaveAttribute('data-value', '#0000ff');
    await act(async () => { fireEvent.click(screen.getByTestId('picker')); });
    expect(mockLighting).toHaveBeenCalledWith({
      sync: { colors: ['#ff0000', '#00ff00', '#abcdef', '#ffff00'] },
    });
  });

  it('lists only merge-capable effects in merge mode and sends the mode change', async () => {
    await mount(makeState());
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: `${P}modeMerge` })); });
    expect(mockLighting).toHaveBeenCalledWith({ group: 'merge' });
    expect(screen.queryByRole('radio', { name: `${P}effect.static` })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: `${P}effect.runway` })).toBeInTheDocument();
  });

  it('addresses an async edit to the chosen port', async () => {
    const s = makeState();
    s.lighting.group = 'async';
    s.lighting.async = [{ ...fx('rainbow'), port: 9 }];
    await mount(s);
    await act(async () => { fireEvent.click(screen.getAllByRole('radio', { name: `${P}effect.runway` })[0]); });
    expect(mockLighting).toHaveBeenCalledWith({ async: { effect: 'runway', port: 9 } });
  });

  it('writes a port edit to that port index', async () => {
    await mount(makeState(), 'device');
    // Port 10 holds the only LEDs; pick it, then change its RGB flow.
    await act(async () => { fireEvent.click(screen.getAllByRole('radio', { name: `${P}portN:{"n":10}` })[0]); });
    fireEvent.click(screen.getByRole('button', { name: `${P}flow` }));
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: `${P}directionReverse` }));
    });
    expect(mockPort).toHaveBeenCalledWith(9, { direction: 'reverse' });
  });

  it('shows auto-detect progress on the button without inserting anything', async () => {
    await mount(makeState(), 'device');
    let finish: (s: UmbraState | null) => void = () => {};
    mockDetect.mockReturnValue(new Promise<UmbraState | null>(r => { finish = r; }));

    const button = screen.getByRole('button', { name: `${P}autoDetect` });
    const before = document.body.querySelectorAll('*').length;
    await act(async () => { fireEvent.click(button); });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(`${P}autoDetecting`);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(document.body.querySelectorAll('*').length).toBe(before);
    expect(screen.getByRole('slider', { name: /ledCountAria/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: `${P}portN:{"n":1}` })).toBeDisabled();

    const found = makeState();
    found.ports[0] = { ...found.ports[0], ledCount: 18 };
    await act(async () => { finish(found); });
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent(`${P}autoDetect`);
    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it('restarts the controller on an LED count commit and then shows the live count', async () => {
    await mount(makeState(), 'device');
    let finish: (s: UmbraState | null) => void = () => {};
    mockPort.mockReturnValue(new Promise<UmbraState | null>(r => { finish = r; }));

    const slider = screen.getByRole('slider', { name: /ledCountAria/ });
    fireEvent.change(slider, { target: { value: '20' } });
    fireEvent.pointerUp(slider);
    await waitFor(() => expect(mockPort).toHaveBeenCalledWith(9, { ledCount: 20 }));

    // Mid-restart the slider keeps the committed value and the card is locked.
    expect(slider).toBeDisabled();
    expect((slider as HTMLInputElement).value).toBe('20');
    expect(screen.getByRole('button', { name: `${P}autoDetecting` })).toBeDisabled();

    // The controller reports what it really found.
    const live = makeState();
    live.ports[9] = { ...live.ports[9], ledCount: 6 };
    await act(async () => { finish(live); });
    expect(screen.getByRole('slider', { name: /ledCountAria/ })).not.toBeDisabled();
    expect((screen.getByRole('slider', { name: /ledCountAria/ }) as HTMLInputElement).value).toBe('6');
  });

  it('explains the LED count rule under the slider', async () => {
    await mount(makeState(), 'device');
    expect(screen.getByText(`${P}ledCountHint`)).toBeInTheDocument();
  });

  it('reports a failed auto-detect', async () => {
    await mount(makeState(), 'device');
    mockDetect.mockResolvedValue(null);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: `${P}autoDetect` })); });
    expect(screen.getByRole('alert')).toHaveTextContent(`${P}autoDetectFailed`);
  });

  it('keeps the page up through the reconnect while detecting', async () => {
    await mount(makeState(), 'device');
    mockGet.mockResolvedValue(makeState({ isConnected: false }));
    mockDetect.mockReturnValue(new Promise(() => {}));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: `${P}autoDetect` })); });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(screen.queryByText(`${P}notConnected`)).not.toBeInTheDocument();
  });

  it('toggles the fan sync and links to Cooling only while the Umbra drives the fans', async () => {
    await mount(makeState(), 'fans', vi.fn());
    expect(screen.getByText('devices.coolingPage.speedHint')).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: `${P}fanSync` })); });
    expect(mockFan).toHaveBeenCalledWith(true);
  });

  it('writes boot mode and self-check', async () => {
    await mount(makeState(), 'settings');
    fireEvent.click(screen.getByRole('button', { name: `${P}bootMode` }));
    await act(async () => { fireEvent.click(screen.getByRole('option', { name: `${P}bootFixed` })); });
    expect(mockBoot).toHaveBeenCalledWith({ mode: 'fixed' });
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: `${P}selfCheck` })); });
    expect(mockBoot).toHaveBeenLastCalledWith({ selfCheck: false });
  });

  // The stacked sliders' value buttons, in page order: speed, brightness, LED count.
  const typeInto = async (slider: 'speed' | 'brightness' | 'leds', value: string) => {
    const index = { speed: 0, brightness: 1, leds: 0 }[slider];
    fireEvent.click(screen.getAllByRole('button', { name: /^\d+%?$/ })[index]);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
  };

  it('writes a typed speed once, as a 0..5 level', async () => {
    await mount(makeState());
    await typeInto('speed', '100');
    expect(mockLighting).toHaveBeenCalledTimes(1);
    expect(mockLighting).toHaveBeenCalledWith({ sync: { speed: 5 } });
  });

  it('keeps brightness at level 1 or above', async () => {
    await mount(makeState());
    await typeInto('brightness', '0');
    expect(mockLighting).toHaveBeenCalledTimes(1);
    expect(mockLighting).toHaveBeenCalledWith({ sync: { brightness: 1 } });
  });

  it('writes a typed LED count once', async () => {
    await mount(makeState(), 'device');
    await typeInto('leds', '12');
    expect(mockPort).toHaveBeenCalledTimes(1);
    expect(mockPort).toHaveBeenCalledWith(9, { ledCount: 12 });
  });

  it('shows a failed write only on the tab that wrote', async () => {
    await mount(makeState(), 'fans');
    mockFan.mockResolvedValue(null);
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: `${P}fanSync` })); });
    expect(screen.getByRole('alert')).toHaveTextContent(`${P}saveFailed`);

    openTab('lighting');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    mockLighting.mockResolvedValue(null);
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: `${P}effect.runway` })); });
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    openTab('fans');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('keeps a card error across polls until that card writes again', async () => {
    await mount(makeState(), 'fans');
    mockFan.mockResolvedValueOnce(null);
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: `${P}fanSync` })); });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    const now = vi.spyOn(Date, 'now');
    try {
      now.mockReturnValue(Date.now() + 10_000);
      await act(async () => { window.dispatchEvent(new Event('focus')); });
      expect(screen.getByRole('alert')).toBeInTheDocument();
    } finally {
      now.mockRestore();
    }

    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: `${P}fanSync` })); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not poll over an edit made moments ago', async () => {
    await mount(makeState());
    const calls = mockGet.mock.calls.length;
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: `${P}effect.runway` })); });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(mockGet.mock.calls.length).toBe(calls);
  });

  it('drops a response older than the latest edit', async () => {
    await mount(makeState());
    const resolvers: Array<(s: UmbraState) => void> = [];
    mockLighting.mockImplementation(() => new Promise<UmbraState>(r => { resolvers.push(r); }));
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: `${P}sourceNexus` })); });
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: `${P}sourceArgb` })); });
    const nexus = makeState();
    nexus.lighting.source = 'nexus';
    const argb = makeState();
    argb.lighting.source = 'argbInput';
    await act(async () => { resolvers[1](argb); });
    await act(async () => { resolvers[0](nexus); });
    expect(screen.getByText(`${P}sourceArgbHint`)).toBeInTheDocument();
    expect(screen.queryByText(`${P}sourceNexusHint`)).not.toBeInTheDocument();
  });

  it('keeps the async port and the ports card selection separate', async () => {
    const s = makeState();
    s.lighting.group = 'async';
    s.ports[2] = { ...s.ports[2], ledCount: 4 };
    await mount(s);
    const chip = (group: Element, key: string) => group.querySelector(`[data-chip-key="${key}"]`) as HTMLElement;
    const picker = () => screen.getByRole('radiogroup', { name: `${P}port` });
    expect(chip(picker(), '2')).toHaveAttribute('aria-checked', 'true');
    await act(async () => { fireEvent.click(chip(picker(), '9')); });

    openTab('device');
    expect(chip(picker(), '2')).toHaveAttribute('aria-checked', 'true');
    await act(async () => { fireEvent.click(chip(picker(), '9')); });
    await act(async () => { fireEvent.click(chip(picker(), '2')); });

    openTab('lighting');
    expect(chip(picker(), '9')).toHaveAttribute('aria-checked', 'true');
  });

  it('writes a dragged LED count to the port it started on, even when it hits zero', async () => {
    const s = makeState();
    s.ports[2] = { ...s.ports[2], ledCount: 4 };
    await mount(s, 'device');
    const slider = screen.getByRole('slider', { name: /ledCountAria.*3/ });
    fireEvent.change(slider, { target: { value: '0' } });
    fireEvent.pointerUp(slider);
    await waitFor(() => expect(mockPort).toHaveBeenCalledTimes(1));
    expect(mockPort).toHaveBeenCalledWith(2, { ledCount: 0 });
  });

  it('opens the ports card on the first port that has LEDs', async () => {
    await mount(makeState(), 'device');
    const group = screen.getByRole('radiogroup', { name: `${P}port` });
    expect(group.querySelector('[data-chip-key="9"]')).toHaveAttribute('aria-checked', 'true');
    expect(group.querySelector('[data-chip-key="9"]')).toHaveTextContent(`${P}portChip:{"port":"10","leds":"6"}`);
    expect(group.querySelector('[data-chip-key="0"]')).toHaveTextContent(/^1$/);
  });

  it('pins the ports card on the first connected state, not on a disconnected one', async () => {
    const empty = makeState({ isConnected: false });
    empty.ports = empty.ports.map(p => ({ ...p, ledCount: 0 }));
    mockGet.mockResolvedValue(empty);
    await act(async () => { render(<AsiahorseUmbraDevicePage />); });
    expect(screen.getByText(`${P}notConnected`)).toBeInTheDocument();

    mockGet.mockResolvedValue(makeState());
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    const group = screen.getByRole('radiogroup', { name: `${P}port` });
    expect(group.querySelector('[data-chip-key="9"]')).toHaveAttribute('aria-checked', 'true');
  });

  it('keeps the pinned port when auto-detect finds no LEDs on it', async () => {
    await mount(makeState(), 'device');
    const found = makeState();
    found.ports = found.ports.map(p => (p.index === 9 ? { ...p, ledCount: 0 } : p.index === 2 ? { ...p, ledCount: 4 } : p));
    mockDetect.mockResolvedValue(found);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: `${P}autoDetect` })); });
    const group = screen.getByRole('radiogroup', { name: `${P}port` });
    expect(group.querySelector('[data-chip-key="9"]')).toHaveAttribute('aria-checked', 'true');
  });

  it('explains an empty async editor instead of writing to port 1', async () => {
    const s = makeState();
    s.lighting.group = 'async';
    s.ports = s.ports.map(p => ({ ...p, ledCount: 0 }));
    await mount(s);
    expect(screen.getByText(`${P}asyncNoPorts`)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: `${P}effect.rainbow` })).not.toBeInTheDocument();
    expect(mockLighting).not.toHaveBeenCalled();
  });
});
