import { act, fireEvent, render, screen } from '@testing-library/react';
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

async function mount(state: UmbraState) {
  mockGet.mockResolvedValue(state);
  await act(async () => { render(<AsiahorseUmbraDevicePage />); });
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
    await mount(makeState({ isConnected: false }));
    expect(screen.getByText(`${P}notConnected`)).toBeInTheDocument();
  });

  it('shows the device identity', async () => {
    await mount(makeState());
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
    await mount(makeState());
    // Port 10 holds the only LEDs; pick it, then change its RGB flow.
    await act(async () => { fireEvent.click(screen.getAllByRole('radio', { name: `${P}portN:{"n":10}` })[0]); });
    fireEvent.click(screen.getByRole('button', { name: `${P}flow` }));
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: `${P}directionReverse` }));
    });
    expect(mockPort).toHaveBeenCalledWith(9, { direction: 'reverse' });
  });

  it('shows auto-detect progress and the result', async () => {
    await mount(makeState());
    let finish: (s: UmbraState | null) => void = () => {};
    mockDetect.mockReturnValue(new Promise<UmbraState | null>(r => { finish = r; }));

    const button = screen.getByRole('button', { name: `${P}autoDetect` });
    await act(async () => { fireEvent.click(button); });
    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(`${P}autoDetecting`);

    const found = makeState();
    found.ports[0] = { ...found.ports[0], ledCount: 18 };
    await act(async () => { finish(found); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(screen.getByText(`${P}autoDetectDone:{"ports":"2","leds":"24"}`)).toBeInTheDocument();
  });

  it('reports a failed auto-detect', async () => {
    await mount(makeState());
    mockDetect.mockResolvedValue(null);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: `${P}autoDetect` })); });
    expect(screen.getByRole('alert')).toHaveTextContent(`${P}autoDetectFailed`);
  });

  it('keeps the page up through the reconnect while detecting', async () => {
    await mount(makeState());
    mockGet.mockResolvedValue(makeState({ isConnected: false }));
    mockDetect.mockReturnValue(new Promise(() => {}));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: `${P}autoDetect` })); });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(screen.queryByText(`${P}notConnected`)).not.toBeInTheDocument();
  });

  it('toggles the fan sync and links to Cooling only while the Umbra drives the fans', async () => {
    const onNavigate = vi.fn();
    mockGet.mockResolvedValue(makeState());
    await act(async () => { render(<AsiahorseUmbraDevicePage onSectionNavigate={onNavigate} />); });
    expect(screen.getByText('devices.coolingPage.speedHint')).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: `${P}fanSync` })); });
    expect(mockFan).toHaveBeenCalledWith(true);
  });

  it('writes boot mode and self-check', async () => {
    await mount(makeState());
    fireEvent.click(screen.getByRole('button', { name: `${P}bootMode` }));
    await act(async () => { fireEvent.click(screen.getByRole('option', { name: `${P}bootFixed` })); });
    expect(mockBoot).toHaveBeenCalledWith({ mode: 'fixed' });
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: `${P}selfCheck` })); });
    expect(mockBoot).toHaveBeenLastCalledWith({ selfCheck: false });
  });
});
