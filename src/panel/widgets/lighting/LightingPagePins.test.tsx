import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLightingDevices, fetchPins, fetchStaticSettings, saveAnimateTemplates, setPins, startAnimate, startStatic, type Pin } from '../../../api/lighting';
import { UiSettingsProvider } from '../../../hooks/useUiSettings';
import { ANIMATE_EFFECTS } from '../../../types/lighting';
import { LightingPage } from './LightingPage';
import { colorPin } from './pins';

const topicHandlers = vi.hoisted(() => ({ lighting: [] as (() => void)[] }));
const syncState = vi.hoisted(() => ({ mode: 'animate', rawSync: 'fire' }));

vi.mock('../../../hooks/useLightingSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../hooks/useLightingSync')>()),
  useLightingSync: () => ({
    mode: syncState.mode,
    setMode: vi.fn(),
    rawSync: syncState.rawSync,
    setRawSync: vi.fn(),
    synced: true,
    paused: false,
  }),
}));

vi.mock('../../../hooks/useMultiplexSocket', () => ({
  useTopicCallback: (topic: string, enabled: boolean, cb: () => void) => {
    if (topic === 'lighting' && enabled && !topicHandlers.lighting.includes(cb)) {
      topicHandlers.lighting.push(cb);
    }
  },
  useTopic: vi.fn(() => null),
}));

vi.mock('../../../hooks/useLightingFrames', () => ({
  useLightingFrames: () => ({ connected: false, live: false }),
}));
vi.mock('../../../hooks/useUsbDevices', () => ({ useUsbDevices: () => ({ devices: [] }) }));
vi.mock('../../../hooks/useAudioState', () => ({ useAudioState: () => ({ current: null }) }));
vi.mock('../../../lib/controlSync', () => ({
  publishControlSync: vi.fn(),
  subscribeControlSync: vi.fn(() => () => {}),
}));

// The selection the page hands the grid is the thing under test, so the stub
// renders it instead of the real cells.
vi.mock('./page/AnimateGrid', () => ({
  AnimateGrid: ({ effect, onSelect, pinnedDevices }: {
    effect: string;
    onSelect?: (key: string) => void;
    pinnedDevices?: ReadonlyMap<string, readonly string[]>;
  }) => (
    <div>
      <div data-testid="grid-effect" onClick={() => onSelect?.('stripes')}>{effect}</div>
      <div data-testid="grid-pins">{[...(pinnedDevices ?? [])].map(([k, v]) => `${k}=${v.join('+')}`).join(';')}</div>
    </div>
  ),
}));
vi.mock('./page/FullscreenShader', () => ({
  FullscreenShader: ({ effect, onPrev }: { effect: string; onPrev: () => void }) => (
    <div data-testid="fullscreen" data-effect={effect}>
      <button type="button" onClick={onPrev}>fs-prev</button>
    </div>
  ),
}));
vi.mock('./page/ModeControls', () => ({
  ModeControls: ({ mode }: { mode: string }) => <div data-testid="mode-controls" data-mode={mode} />,
}));
vi.mock('./page/StaticPickerCanvas', () => ({
  StaticPickerCanvas: ({ onCommit, onPreview, hex, devices, implied }: {
    onCommit: (hex: string) => void;
    onPreview: (hex: string) => void;
    hex: string;
    devices: { id: string; hex: string }[];
    implied?: boolean;
  }) => (
    <div>
      <span data-testid="picker-hex">{hex}</span>
      <span data-testid="picker-marks" data-implied={implied ? '1' : ''}>{devices.map(d => `${d.id}@${d.hex}`).join(';')}</span>
      <button type="button" onClick={() => onCommit('#00ff00')}>pick-green</button>
      <button type="button" onClick={() => onPreview('#0000ff')}>preview-blue</button>
    </div>
  ),
}));
// The stub exposes what the pins ride on: the pins the rail is handed, the
// source a press pins to, the disabled reason, and the callbacks.
vi.mock('./page/DevicePanel', () => ({
  DevicePanel: ({ pins, pinSource, pinDisabledReason, pinTargetName, onSetPin, onUnpinAll, onSetSelection }: {
    pins?: Record<string, Pin>;
    pinSource?: string | null;
    pinDisabledReason?: string;
    pinTargetName?: (pin: Pin) => string;
    onSetPin?: (ids: string[], pinned: boolean) => void;
    onUnpinAll?: () => void;
    onSetSelection: (ids: Set<string>, primary: string | null) => void;
  }) => (
    <div
      data-testid="rail"
      data-pin={pins?.a ? JSON.stringify(pins.a) : ''}
      data-pin-name={pins?.a && pinTargetName ? pinTargetName(pins.a) : ''}
      data-source={pinSource ?? ''}
      data-disabled={pinDisabledReason ?? ''}
    >
      <button type="button" onClick={() => onSetPin?.(['a'], !pins?.a)}>toggle</button>
      <button type="button" onClick={() => onUnpinAll?.()}>unpin-all</button>
      <button type="button" onClick={() => onSetSelection(new Set(['a']), 'a')}>select-a</button>
      <button type="button" onClick={() => onSetSelection(new Set(['a', 'b']), 'a')}>select-ab</button>
      <button type="button" onClick={() => onSetSelection(new Set(), null)}>clear-selection</button>
    </div>
  ),
}));
vi.mock('./page/LedMapEditor', () => ({ LedMapEditor: () => null }));
vi.mock('./page/RightPaneTabs', () => ({ RightPaneTabs: () => null }));
// A typed slider edit is onChange(v, true) followed synchronously by onCommit.
vi.mock('./page/EffectTab', () => ({
  EffectTab: ({ mode, effect, state, onAnimateChange, onAnimateCommit }: {
    mode: string;
    effect: string;
    state: { intensity: number } | null;
    onAnimateChange: (patch: { intensity: number }, commit?: boolean) => void;
    onAnimateCommit: () => void;
  }) => (
    <button
      type="button"
      data-testid="type-intensity"
      data-mode={mode}
      data-effect={effect}
      data-intensity={state?.intensity}
      onClick={() => { onAnimateChange({ intensity: 0.3 }, true); onAnimateCommit(); }}
    >type</button>
  ),
}));
vi.mock('../../../components/common/ViewHeader/ViewHeader', () => ({ ViewHeader: () => null }));
vi.mock('../../../components/views/ServiceRequired', () => ({ ServiceRequired: () => null }));
vi.mock('../../../components/common/DeviceCanvas/DeviceCanvas', () => ({
  DeviceCanvas: ({ shaderEffect }: { shaderEffect?: string | null }) => (
    <div data-testid="preview" data-effect={shaderEffect ?? ''} />
  ),
}));

vi.mock('../../../api/lighting', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../api/lighting')>();
  return {
    ...actual,
    fetchCurrentSync: vi.fn(() => Promise.resolve({ sync: syncState.rawSync })),
    fetchAnimateSettings: vi.fn(() => Promise.resolve({ effect: 'fire', states: {}, templates: {} })),
    fetchStaticSettings: vi.fn(() => Promise.resolve({ effect: 'checker', states: {} })),
    fetchAnimateDefaults: vi.fn(() => Promise.resolve(null)),
    cachedAnimateDefaults: vi.fn(() => null),
    fetchMusicReactive: vi.fn(() => Promise.resolve({ enabled: false })),
    fetchScreenEffect: vi.fn(() => Promise.resolve({ hue: 0, colorize: 0, saturation: 1, contrast: 1 })),
    fetchMediaEffect: vi.fn(() => Promise.resolve({ hue: 0, colorize: 0, saturation: 1, contrast: 1 })),
    fetchLightingDevices: vi.fn(() => Promise.resolve({ isInit: true, devices: [{ id: 'a', name: 'Fan A', ledsOn: true, ledCount: 10, canvasX: 0, canvasY: 0, canvasW: 1, canvasH: 1, canvasRotation: 0 }] })),
    fetchLedMap: vi.fn(() => Promise.resolve(null)),
    fetchAvailableMappings: vi.fn(() => Promise.resolve(null)),
    fetchLayoutPresets: vi.fn(() => Promise.resolve(null)),
    saveAnimateTemplates: vi.fn(() => Promise.resolve(null)),
    startAnimate: vi.fn(() => Promise.resolve(null)),
    startStatic: vi.fn(() => Promise.resolve(null)),
    startScreenMirror: vi.fn(() => Promise.resolve(null)),
    stopLighting: vi.fn(() => Promise.resolve(null)),
    setMusicReactive: vi.fn(() => Promise.resolve(null)),
    setPins: vi.fn(() => Promise.resolve(true)),
    fetchPins: vi.fn(() => Promise.resolve({})),
  };
});

const serviceState = { cooling: null, lighting: null, panel: null } as never;

const renderPage = () => render(
  <UiSettingsProvider>
    <LightingPage serviceOnline serviceState={serviceState} activeProfileId="p1" />
  </UiSettingsProvider>,
);

const device = (id: string, name: string) => ({ id, name, ledsOn: true, ledCount: 10, canvasX: 0, canvasY: 0, canvasW: 1, canvasH: 1, canvasRotation: 0 });
const withDevices = (...ids: string[]) => vi.mocked(fetchLightingDevices).mockImplementation(
  () => Promise.resolve({ isInit: true, devices: ids.map(id => device(id, `Fan ${id.toUpperCase()}`)) }) as never,
);

const pinOf = () => {
  const raw = screen.getByTestId('rail').dataset.pin;
  return raw ? JSON.parse(raw) as Pin : null;
};
const lastPinsCall = () => vi.mocked(setPins).mock.calls.at(-1) as unknown as [string[], Pin | null];

describe('LightingPage pins', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('nexus_settings', JSON.stringify({ general: { lightingDashboardMode: 'advanced', coolingDashboardMode: 'advanced' } }));
    syncState.mode = 'animate';
    syncState.rawSync = 'fire';
    vi.mocked(setPins).mockClear();
    vi.mocked(setPins).mockImplementation(() => Promise.resolve(true));
    vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({}));
    vi.mocked(fetchStaticSettings).mockImplementation(() => Promise.resolve({ effect: 'checker', states: {} }));
    withDevices('a');
    vi.mocked(startAnimate).mockClear();
    vi.mocked(startStatic).mockClear();
    vi.mocked(saveAnimateTemplates).mockClear();
    topicHandlers.lighting.length = 0;
  });

  describe('the pin button', () => {
    it('pins a following card to the running shader in Animate, optimistically, and a second press unpins', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByTestId('rail').dataset.source).not.toBe(''));
      expect(screen.getByTestId('rail').dataset.disabled).toBe('');

      fireEvent.click(screen.getByText('toggle'));
      expect(pinOf()).toEqual({ kind: 'animate', effect: 'fire' });
      expect(setPins).toHaveBeenCalledWith(['a'], { kind: 'animate', effect: 'fire' });

      fireEvent.click(screen.getByText('toggle'));
      expect(pinOf()).toBeNull();
      expect(lastPinsCall()).toEqual([['a'], null]);
    });

    it('pins to the global static look in Static', async () => {
      syncState.mode = 'static';
      syncState.rawSync = 'static';
      renderPage();
      await waitFor(() => expect(screen.getByTestId('rail').dataset.source).not.toBe(''));
      fireEvent.click(screen.getByText('toggle'));
      expect(lastPinsCall()[0]).toEqual(['a']);
      expect(lastPinsCall()[1]).toMatchObject({ kind: 'static', effect: 'checker' });
    });

    it('pins to the one universal Mirror in Mirror', async () => {
      syncState.mode = 'screen';
      syncState.rawSync = 'screen';
      renderPage();
      await waitFor(() => expect(screen.getByTestId('rail').dataset.source).not.toBe(''));
      fireEvent.click(screen.getByText('toggle'));
      expect(lastPinsCall()).toEqual([['a'], { kind: 'mirror' }]);
    });

    it('keeps the pin enabled for a Simple-mode sweep and pins it as an animate shader', async () => {
      syncState.rawSync = 'sweeprainbow';
      renderPage();
      await waitFor(() => expect(screen.getByTestId('rail').dataset.source).not.toBe(''));
      expect(screen.getByTestId('rail').dataset.disabled).toBe('');
      fireEvent.click(screen.getByText('toggle'));
      expect(lastPinsCall()).toEqual([['a'], { kind: 'animate', effect: 'sweeprainbow' }]);
    });

    it.each([
      ['gif', 'lighting.pin.disabledMedia'],
      ['none', 'lighting.pin.disabledOff'],
    ])('is disabled in %s, naming why', async (mode, reason) => {
      syncState.mode = mode;
      syncState.rawSync = mode;
      renderPage();
      await waitFor(() => expect(screen.getByTestId('rail').dataset.disabled).toBe(reason));
      expect(screen.getByTestId('rail').dataset.source).toBe('');
    });

    it('names a pin by its target', async () => {
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: { kind: 'mirror' } }));
      renderPage();
      await waitFor(() => expect(screen.getByTestId('rail').dataset.pinName).toBe('lighting.mode.screen'));
    });

    it('puts the pin back when the service refuses', async () => {
      vi.mocked(setPins).mockImplementation(() => Promise.resolve(false));
      renderPage();
      await waitFor(() => expect(screen.getByTestId('rail').dataset.source).not.toBe(''));
      fireEvent.click(screen.getByText('toggle'));
      expect(pinOf()).not.toBeNull();
      await waitFor(() => expect(pinOf()).toBeNull());
    });

    it('unpins everything from Unpin all', async () => {
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: { kind: 'animate', effect: 'aurora' }, b: { kind: 'mirror' } }));
      renderPage();
      await waitFor(() => expect(pinOf()).not.toBeNull());
      fireEvent.click(screen.getByText('unpin-all'));
      expect(lastPinsCall()).toEqual([['a', 'b'], null]);
      expect(pinOf()).toBeNull();
    });
  });

  describe('what a pick with nothing selected reaches', () => {
    it('says how many pinned devices it skips', async () => {
      withDevices('a', 'b');
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: { kind: 'mirror' } }));
      renderPage();
      expect(await screen.findByText('lighting.pane.allExceptPinned.one')).toBeTruthy();
    });

    it('says all pinned when every device wears a pin', async () => {
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: { kind: 'mirror' } }));
      renderPage();
      expect(await screen.findByText('lighting.pane.allPinned')).toBeTruthy();
    });

    it('marks the unpinned devices dotted on the global color, and a selection solid on what each wears', async () => {
      withDevices('a', 'b');
      syncState.mode = 'static';
      syncState.rawSync = 'static';
      vi.mocked(fetchStaticSettings).mockResolvedValue({ effect: 'checker', states: {}, color: '#336699' });
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: colorPin('#ff0000') }));
      renderPage();
      const marks = () => screen.getByTestId('picker-marks');
      await waitFor(() => expect(marks().textContent).toBe('b@#336699'));
      expect(marks().dataset.implied).toBe('1');
      fireEvent.click(screen.getByText('select-ab'));
      await waitFor(() => expect(marks().textContent).toBe('a@#ff0000;b@#336699'));
      expect(marks().dataset.implied).toBe('');
    });
  });

  describe('syncing with the service', () => {
    it('reads the pins on mount and again on the lighting broadcast', async () => {
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: { kind: 'animate', effect: 'aurora' } }));
      renderPage();
      await waitFor(() => expect(pinOf()?.effect).toBe('aurora'));

      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({}));
      topicHandlers.lighting.forEach(cb => cb());
      await waitFor(() => expect(pinOf()).toBeNull());
    });

    it('keeps what it has when the pins are unreadable', async () => {
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: { kind: 'animate', effect: 'aurora' } }));
      renderPage();
      await waitFor(() => expect(pinOf()?.effect).toBe('aurora'));
      vi.mocked(fetchPins).mockClear();
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve(null));
      topicHandlers.lighting.forEach(cb => cb());
      await waitFor(() => expect(fetchPins).toHaveBeenCalled());
      expect(pinOf()?.effect).toBe('aurora');
    });

    it('keeps a pin request in flight against a lighting frame that predates it', async () => {
      let resolve: (ok: boolean) => void = () => {};
      vi.mocked(setPins).mockImplementation(() => new Promise<boolean>(r => { resolve = r; }));
      renderPage();
      await waitFor(() => expect(screen.getByTestId('rail').dataset.source).not.toBe(''));
      fireEvent.click(screen.getByText('toggle'));
      expect(pinOf()?.effect).toBe('fire');

      vi.mocked(fetchPins).mockClear();
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({}));
      topicHandlers.lighting.forEach(cb => cb());
      await waitFor(() => expect(fetchPins).toHaveBeenCalled());
      await new Promise(r => setTimeout(r, 0));
      expect(pinOf()?.effect).toBe('fire');

      resolve(true);
      await new Promise(r => setTimeout(r, 0));
      expect(pinOf()?.effect).toBe('fire');
    });
  });

  describe('picks', () => {
    it('with nothing selected a Static pick is global, never a pin, and needs no selection', async () => {
      syncState.mode = 'static';
      syncState.rawSync = 'static';
      renderPage();
      await waitFor(() => expect(screen.getByTestId('grid-effect').textContent).toBe('checker'));
      vi.mocked(startStatic).mockClear();
      fireEvent.click(screen.getByTestId('grid-effect'));
      await waitFor(() => expect(startStatic).toHaveBeenCalled());
      expect(vi.mocked(startStatic).mock.calls.at(-1)?.[0]).toBe('stripes');
      expect(setPins).not.toHaveBeenCalled();
    });

    it('with nothing selected a picked colour is the exact global colour', async () => {
      syncState.mode = 'static';
      syncState.rawSync = 'static';
      renderPage();
      await waitFor(() => expect(screen.getByTestId('grid-effect').textContent).toBe('checker'));
      vi.mocked(startStatic).mockClear();
      fireEvent.click(screen.getByText('pick-green'));
      await waitFor(() => expect(startStatic).toHaveBeenCalled());
      expect(vi.mocked(startStatic).mock.calls.at(-1)?.[8]).toBe('#00ff00');
      expect(setPins).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.getByTestId('picker-hex').textContent).toBe('#00ff00'));
    });

    it('shows the service\'s global flat colour as the selected look, with no effect tile lit', async () => {
      syncState.mode = 'static';
      syncState.rawSync = 'static';
      vi.mocked(fetchStaticSettings).mockResolvedValue({ effect: 'checker', states: {}, color: '#336699' });
      renderPage();
      await waitFor(() => expect(screen.getByTestId('picker-hex').textContent).toBe('#336699'));
      expect(screen.getByTestId('grid-effect').textContent).toBe('');
    });

    it('picking an effect after a global colour leaves the colour out of the start', async () => {
      syncState.mode = 'static';
      syncState.rawSync = 'static';
      vi.mocked(fetchStaticSettings).mockResolvedValue({ effect: 'checker', states: {}, color: '#336699' });
      renderPage();
      await waitFor(() => expect(screen.getByTestId('picker-hex').textContent).toBe('#336699'));
      vi.mocked(startStatic).mockClear();
      fireEvent.click(screen.getByTestId('grid-effect'));
      await waitFor(() => expect(startStatic).toHaveBeenCalled());
      expect(vi.mocked(startStatic).mock.calls.at(-1)?.[8]).toBeUndefined();
      await waitFor(() => expect(screen.getByTestId('picker-hex').textContent).toBe(''));
    });

    it('with nothing selected an Animate pick is global', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByTestId('grid-effect').textContent).toBe('fire'));
      vi.mocked(startAnimate).mockClear();
      fireEvent.click(screen.getByTestId('grid-effect'));
      await waitFor(() => expect(vi.mocked(startAnimate).mock.calls.some(c => c[0] === 'stripes')).toBe(true));
      expect(setPins).not.toHaveBeenCalled();
    });

    it('with devices selected an Animate pick pins them and leaves the running effect alone', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByTestId('grid-effect').textContent).toBe('fire'));
      fireEvent.click(screen.getByText('select-a'));
      vi.mocked(startAnimate).mockClear();
      fireEvent.click(screen.getByTestId('grid-effect'));
      expect(lastPinsCall()).toEqual([['a'], { kind: 'animate', effect: 'stripes' }]);
      expect(startAnimate).not.toHaveBeenCalled();
    });

    it('with devices selected a Static pick pins the whole look', async () => {
      syncState.mode = 'static';
      syncState.rawSync = 'static';
      renderPage();
      await waitFor(() => expect(screen.getByTestId('grid-effect').textContent).toBe('checker'));
      fireEvent.click(screen.getByText('select-a'));
      fireEvent.click(screen.getByTestId('grid-effect'));
      expect(lastPinsCall()[0]).toEqual(['a']);
      expect(lastPinsCall()[1]).toMatchObject({ kind: 'static', effect: 'stripes', slot: 0 });
      expect(lastPinsCall()[1]?.params).toBeDefined();
    });

    it('with devices selected a picked colour pins them to it', async () => {
      syncState.mode = 'static';
      syncState.rawSync = 'static';
      renderPage();
      await waitFor(() => expect(screen.getByTestId('grid-effect').textContent).toBe('checker'));
      fireEvent.click(screen.getByText('select-a'));
      fireEvent.click(screen.getByText('pick-green'));
      await waitFor(() => expect(setPins).toHaveBeenCalled());
      expect(lastPinsCall()[0]).toEqual(['a']);
      expect(lastPinsCall()[1]).toMatchObject({ kind: 'static', effect: 'flat', color: '#00ff00' });
    });

    it('re-pins a selected pinned device instead of blocking, with no refusal notice', async () => {
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: { kind: 'animate', effect: 'aurora' } }));
      renderPage();
      await waitFor(() => expect(pinOf()?.effect).toBe('aurora'));
      fireEvent.click(screen.getByText('select-a'));
      fireEvent.click(screen.getByTestId('grid-effect'));
      expect(lastPinsCall()).toEqual([['a'], { kind: 'animate', effect: 'stripes' }]);
      await waitFor(() => expect(pinOf()?.effect).toBe('stripes'));
      expect(screen.queryByText(/lockedNotice/)).toBeNull();
    });

    it('never touches unselected pinned devices', async () => {
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ b: { kind: 'animate', effect: 'aurora' } }));
      renderPage();
      await waitFor(() => expect(fetchPins).toHaveBeenCalled());
      fireEvent.click(screen.getByText('select-a'));
      fireEvent.click(screen.getByTestId('grid-effect'));
      expect(lastPinsCall()[0]).toEqual(['a']);
    });
  });

  it('starts with no selection, so the grid and preview show the running effect', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('grid-effect').textContent).toBe('fire'));
    expect(screen.getByTestId('preview').dataset.effect).toBe('fire');
  });

  describe('a selection wearing one pin', () => {
    it('scopes the grid, preview and fullscreen to a pinned shader, and clearing leaves the scope', async () => {
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: { kind: 'animate', effect: 'aurora' } }));
      renderPage();
      await waitFor(() => expect(pinOf()?.effect).toBe('aurora'));
      expect(screen.getByTestId('grid-effect').textContent).toBe('fire');

      vi.mocked(startAnimate).mockClear();
      fireEvent.click(screen.getByText('select-a'));
      await waitFor(() => expect(screen.getByTestId('grid-effect').textContent).toBe('aurora'));
      expect(screen.getByTestId('preview').dataset.effect).toBe('aurora');
      expect(startAnimate).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'lighting.fullscreen' }));
      expect(screen.getByTestId('fullscreen').dataset.effect).toBe('aurora');

      fireEvent.click(screen.getByText('clear-selection'));
      await waitFor(() => expect(screen.getByTestId('preview').dataset.effect).toBe('fire'));
      expect(screen.getByTestId('grid-effect').textContent).toBe('fire');
    });

    it('edits a pinned shader\'s global settings without restarting the running effect', async () => {
      localStorage.setItem('nexus.lighting.effectDockCollapsed', 'false');
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: { kind: 'animate', effect: 'aurora' } }));
      renderPage();
      await waitFor(() => expect(pinOf()?.effect).toBe('aurora'));
      fireEvent.click(screen.getByText('select-a'));
      await waitFor(() => expect(screen.getByTestId('type-intensity').dataset.effect).toBe('aurora'));
      await waitFor(() => expect(startAnimate).toHaveBeenCalled());
      vi.mocked(startAnimate).mockClear();
      vi.mocked(saveAnimateTemplates).mockClear();

      fireEvent.click(screen.getByTestId('type-intensity'));
      await waitFor(() => expect(saveAnimateTemplates).toHaveBeenCalled());
      const saved = vi.mocked(saveAnimateTemplates).mock.calls.at(-1)?.[0] as Record<string, { selected: number; slots: { intensity: number }[] }>;
      expect(saved.aurora.slots[saved.aurora.selected].intensity).toBe(0.3);
      expect(startAnimate).not.toHaveBeenCalled();
      expect(setPins).not.toHaveBeenCalled();
    });

    it('edits a static pin by re-pinning its devices with the new look', async () => {
      localStorage.setItem('nexus.lighting.effectDockCollapsed', 'false');
      syncState.mode = 'static';
      syncState.rawSync = 'static';
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: { kind: 'static', effect: 'stripes', slot: 0, intensity: 1 } }));
      renderPage();
      await waitFor(() => expect(pinOf()?.effect).toBe('stripes'));
      fireEvent.click(screen.getByText('select-a'));
      await waitFor(() => expect(screen.getByTestId('grid-effect').textContent).toBe('stripes'));
      await waitFor(() => expect(screen.getByTestId('type-intensity').dataset.effect).toBe('stripes'));
      vi.mocked(startStatic).mockClear();

      fireEvent.click(screen.getByTestId('type-intensity'));
      await waitFor(() => expect(setPins).toHaveBeenCalled());
      expect(lastPinsCall()[0]).toEqual(['a']);
      expect(lastPinsCall()[1]).toMatchObject({ kind: 'static', effect: 'stripes', intensity: 0.3 });
      expect(startStatic).not.toHaveBeenCalled();
    });

    it.each(['animate', 'static', 'gif'])('shows only the global Mirror filters for a mirror pin on the %s tab, never the screen picker', async mode => {
      localStorage.setItem('nexus.lighting.effectDockCollapsed', 'false');
      syncState.mode = mode;
      syncState.rawSync = mode === 'animate' ? 'fire' : mode;
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: { kind: 'mirror' } }));
      renderPage();
      await waitFor(() => expect(pinOf()?.kind).toBe('mirror'));
      fireEvent.click(screen.getByText('select-a'));
      await waitFor(() => expect(screen.getByTestId('type-intensity').dataset.mode).toBe('screen'));
      // The monitor picker and the reactive toggle start Mirror, which would switch the global mode.
      expect(screen.queryByTestId('mode-controls')).toBeNull();
      expect(screen.getByText('lighting.pin.mirrorHint')).toBeTruthy();
      expect(screen.queryByTestId('grid-effect')).toBeNull();
    });

    it('keeps the full Mirror controls on the Mirror tab itself', async () => {
      syncState.mode = 'screen';
      syncState.rawSync = 'screen';
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: { kind: 'mirror' } }));
      renderPage();
      await waitFor(() => expect(pinOf()?.kind).toBe('mirror'));
      fireEvent.click(screen.getByText('select-a'));
      expect(screen.getByTestId('mode-controls').dataset.mode).toBe('screen');
      expect(screen.queryByText('lighting.pin.mirrorHint')).toBeNull();
    });

    it.each(['screen', 'gif'])('says where the editor is for a shader pin on the %s tab, and opens it', async mode => {
      localStorage.setItem('nexus.lighting.effectDockCollapsed', 'false');
      syncState.mode = mode;
      syncState.rawSync = mode;
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: { kind: 'animate', effect: 'aurora' } }));
      renderPage();
      await waitFor(() => expect(pinOf()?.effect).toBe('aurora'));
      fireEvent.click(screen.getByText('select-a'));
      await waitFor(() => expect(screen.getByText('lighting.pin.pinnedNotice')).toBeTruthy());
      expect(screen.queryByTestId('mode-controls')).toBeNull();
      expect(screen.queryByTestId('type-intensity')).toBeNull();

      vi.mocked(startAnimate).mockClear();
      fireEvent.click(screen.getByText('lighting.pin.openTab'));
      await waitFor(() => expect(startAnimate).toHaveBeenCalled());
    });

    it('a fullscreen arrow steps from the pinned target on screen and re-pins the selection', async () => {
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: { kind: 'animate', effect: 'aurora' } }));
      renderPage();
      await waitFor(() => expect(pinOf()?.effect).toBe('aurora'));
      fireEvent.click(screen.getByText('select-a'));
      await waitFor(() => expect(screen.getByTestId('grid-effect').textContent).toBe('aurora'));
      fireEvent.click(screen.getByRole('button', { name: 'lighting.fullscreen' }));
      const at = ANIMATE_EFFECTS.findIndex(e => e.key === 'aurora');
      fireEvent.click(screen.getByText('fs-prev'));
      expect(lastPinsCall()).toEqual([['a'], { kind: 'animate', effect: ANIMATE_EFFECTS[at - 1].key }]);
      // The pin moved, so the screen moves with it and the next press steps on from there.
      await waitFor(() => expect(screen.getByTestId('fullscreen').dataset.effect).toBe(ANIMATE_EFFECTS[at - 1].key));
      fireEvent.click(screen.getByText('fs-prev'));
      expect(lastPinsCall()[1]).toEqual({ kind: 'animate', effect: ANIMATE_EFFECTS[at - 2].key });
    });

    it('a fullscreen arrow with nothing selected steps the global effect, as before', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByTestId('grid-effect').textContent).toBe('fire'));
      fireEvent.click(screen.getByRole('button', { name: 'lighting.fullscreen' }));
      const at = ANIMATE_EFFECTS.findIndex(e => e.key === 'fire');
      vi.mocked(startAnimate).mockClear();
      fireEvent.click(screen.getByText('fs-prev'));
      await waitFor(() => expect(vi.mocked(startAnimate).mock.calls.some(c => c[0] === ANIMATE_EFFECTS[at - 1].key)).toBe(true));
      expect(setPins).not.toHaveBeenCalled();
    });

    it('offers no fullscreen on a mixed selection, and closes it when the selection becomes mixed', async () => {
      vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: { kind: 'animate', effect: 'aurora' } }));
      renderPage();
      await waitFor(() => expect(pinOf()?.effect).toBe('aurora'));
      fireEvent.click(screen.getByText('select-a'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'lighting.fullscreen' })).toBeTruthy());
      fireEvent.click(screen.getByRole('button', { name: 'lighting.fullscreen' }));
      expect(screen.getByTestId('fullscreen')).toBeTruthy();

      // Pinned beside a device that follows the global mode: no single value to edit.
      fireEvent.click(screen.getByText('select-ab'));
      await waitFor(() => expect(screen.queryByTestId('fullscreen')).toBeNull());
      expect(screen.queryByRole('button', { name: 'lighting.fullscreen' })).toBeNull();

      fireEvent.click(screen.getByText('select-a'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'lighting.fullscreen' })).toBeTruthy());
      expect(screen.queryByTestId('fullscreen')).toBeNull();
    });
  });

  describe('Mirror tab', () => {
    beforeEach(() => {
      syncState.mode = 'screen';
      syncState.rawSync = 'screen';
    });

    it('offers Pin selected to Mirror only with devices selected, and pins them', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByTestId('mode-controls')).toBeTruthy());
      expect(screen.queryByText('lighting.pin.pinSelectedToMirror')).toBeNull();
      fireEvent.click(screen.getByText('select-a'));
      fireEvent.click(await screen.findByText('lighting.pin.pinSelectedToMirror'));
      expect(lastPinsCall()).toEqual([['a'], { kind: 'mirror' }]);
    });

    it('switching tabs never pins', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByTestId('mode-controls')).toBeTruthy());
      expect(setPins).not.toHaveBeenCalled();
    });
  });

  it('badges the grid cells with the names of the devices pinned to them', async () => {
    vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ a: { kind: 'animate', effect: 'aurora' } }));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('grid-pins').textContent).toBe('aurora=Fan A'));
  });

  it('a typed value reaches the service and is not overwritten by its own commit', async () => {
    localStorage.setItem('nexus.lighting.effectDockCollapsed', 'false');
    renderPage();
    await waitFor(() => expect(screen.getByTestId('type-intensity').dataset.effect).toBe('fire'));
    // Mount hydration restarts the running effect; let it land before typing.
    await waitFor(() => expect(startAnimate).toHaveBeenCalled());
    vi.mocked(startAnimate).mockClear();
    vi.mocked(saveAnimateTemplates).mockClear();
    fireEvent.click(screen.getByTestId('type-intensity'));
    await waitFor(() => expect(screen.getByTestId('type-intensity').dataset.intensity).toBe('0.3'));
    await waitFor(() => expect(startAnimate).toHaveBeenCalled());
    expect(vi.mocked(startAnimate).mock.calls.at(-1)?.[2]).toBe(0.3);
    const saved = vi.mocked(saveAnimateTemplates).mock.calls.at(-1)?.[0] as Record<string, { selected: number; slots: { intensity: number }[] }>;
    expect(saved.fire.slots[saved.fire.selected].intensity).toBe(0.3);
  });
});

void within;
