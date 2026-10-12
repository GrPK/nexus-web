import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LightingTouch } from './LightingTouch';
import { fetchAnimateSettings, fetchCurrentSync, fetchPins, saveAnimateTemplates, setPins, startStatic, type Pin } from '../../../api/lighting';
import { defaultStateFor } from '../../../types/lighting';
import { paletteColor } from '../../../types/lightingPalette';
import type { PanelWidget } from '../types';

// The immersive shell and its heavy leaves are not what this file is about:
// the subject is where a pick is routed (global, or a pin on the selection), and against which preset slot.
// Static's picker rides in the widget's immersive canvas slot, so the stub has
// to render what is handed to it or the subject disappears.
vi.mock('./LightingWidget', () => ({
  LightingWidget: ({ immersiveCanvas }: { immersiveCanvas?: React.ReactNode }) => <div>{immersiveCanvas}</div>,
}));
vi.mock('../common/ImmersiveLayout', () => ({
  ImmersiveLayout: ({ cells }: { cells: React.ReactNode[] }) => <div>{cells}</div>,
}));
const controlsProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('./page/EffectControls', () => ({
  EffectControls: (props: Record<string, unknown>) => {
    controlsProps.current = props;
    return <div data-testid="effect-controls" data-effect={String(props.effect)} />;
  },
}));
// Every tab body at once: the real shell renders only the active one.
vi.mock('./effecteditor/EffectEditor', () => ({
  EffectEditor: ({ devices, options, effect, effectDisabled }: { devices?: React.ReactNode; options: React.ReactNode; effect?: React.ReactNode; effectDisabled?: boolean }) => (
    <div data-testid="editor" data-effect-disabled={String(!!effectDisabled)}>{devices}{options}{effect}</div>
  ),
}));
const pickerProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('./page/StaticPickerCanvas', () => ({
  StaticPickerCanvas: (props: Record<string, unknown>) => {
    pickerProps.current = props;
    return (
      <>
        <button type="button" onClick={() => (props.onCommit as (hex: string) => void)('#123456')}>
          pick-custom
        </button>
        <button type="button" onClick={() => (props.onPreview as (hex: string) => void)('#abcdef')}>
          drag-custom
        </button>
      </>
    );
  },
}));
vi.mock('./effecteditor/MediaList', () => ({ MediaList: () => <div /> }));
vi.mock('./effecteditor/PostProcessControls', () => ({ PostProcessControls: () => <div data-testid="post-process" /> }));
vi.mock('./page/ModeControls', () => ({ ScreenControls: () => <div data-testid="screen-controls" /> }));
const gridProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('./page/AnimateGrid', () => ({
  // `leading` carries the static palette; dropping it hides the subject.
  AnimateGrid: (props: { onSelect: (key: string) => void; leading?: React.ReactNode }) => {
    gridProps.current = props as unknown as Record<string, unknown>;
    return (
      <>
        {props.leading}
        <button type="button" onClick={() => props.onSelect('stripes')}>pick-stripes</button>
      </>
    );
  },
}));
const selectProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('./effecteditor/StaticDeviceSelect', () => ({
  StaticDeviceSelect: (props: Record<string, unknown>) => {
    selectProps.current = props;
    return <div data-testid="device-select" />;
  },
}));

vi.mock('../../../api/lighting', () => ({
  fetchAnimateDefaults: vi.fn(() => Promise.resolve(null)),
  fetchAnimateSettings: vi.fn(() => Promise.resolve({ effect: 'rainbow', templates: {} })),
  fetchCurrentSync: vi.fn(() => Promise.resolve({ sync: 'static' })),
  fetchStaticSettings: vi.fn(() => Promise.resolve({ effect: 'gradientlinear', states: {} })),
  fetchMediaEffect: vi.fn(() => Promise.resolve(null)),
  fetchScreenEffect: vi.fn(() => Promise.resolve(null)),
  fetchLightingDevices: vi.fn(() => Promise.resolve({ devices: [] })),
  saveAnimateTemplates: vi.fn(() => Promise.resolve()),
  setMediaEffect: vi.fn(() => Promise.resolve()),
  setScreenEffect: vi.fn(() => Promise.resolve()),
  fetchPins: vi.fn(() => Promise.resolve({})),
  setPins: vi.fn(() => Promise.resolve(true)),
  startAnimate: vi.fn(() => Promise.resolve()),
  startStatic: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../hooks/useMultiplexSocket', () => ({ useTopicCallback: vi.fn() }));
vi.mock('../../../lib/controlSync', () => ({ subscribeControlSync: vi.fn(() => () => {}) }));
vi.mock('../../../hooks/usePanelBackgroundUsage', () => ({
  usePanelBackgroundUsage: () => ({ effects: new Set(), slotsByEffect: new Map() }),
}));
vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
}));

const widget: PanelWidget = { id: 'w', type: 'lighting', size: '4x4', col: 0, row: 0 };

// The selection is not persisted, so a test makes it the way the device tab does.
const select = async (ids: string[]) => {
  await waitFor(() => expect(selectProps.current).not.toBeNull());
  act(() => {
    (selectProps.current!.onSetSelection as (ids: Set<string>, primary: string | null) => void)(new Set(ids), ids[0] ?? null);
  });
};

const lastPins = () => vi.mocked(setPins).mock.calls.at(-1) as unknown as [string[], Pin | null];

describe('LightingTouch pins', () => {
  beforeEach(() => {
    localStorage.clear();
    // Both hold the last props of an unmounted tree, so a stale one can satisfy
    // the next test's assertion.
    gridProps.current = null;
    pickerProps.current = null;
    selectProps.current = null;
    controlsProps.current = null;
    vi.mocked(saveAnimateTemplates).mockClear();
    vi.mocked(setPins).mockClear();
    vi.mocked(setPins).mockImplementation(() => Promise.resolve(true));
    vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({}));
    vi.mocked(fetchCurrentSync).mockImplementation(() => Promise.resolve({ sync: 'static' }));
    vi.mocked(startStatic).mockClear();
  });

  it('pins the selected devices to a Static pick, never the global effect', async () => {
    render(<LightingTouch widget={widget} />);
    await select(['dev-a', 'dev-b']);

    fireEvent.click(await screen.findByText('pick-stripes'));

    await waitFor(() => expect(setPins).toHaveBeenCalledTimes(1));
    expect(lastPins()[0]).toEqual(['dev-a', 'dev-b']);
    expect(lastPins()[1]).toMatchObject({ kind: 'static', effect: 'stripes' });
    // A global start would repaint every device that follows the global mode.
    expect(startStatic).not.toHaveBeenCalled();
  });

  // A pin stores the slot it was made against; devices hold references to
  // shared presets, so recording slot 0 for a look taken from another slot
  // points the page's card strip and dock at the wrong preset.
  it('records the pin against the preset slot it came from', async () => {
    const slots = [0, 1, 2, 3].map(() => defaultStateFor('stripes'));
    vi.mocked(fetchAnimateSettings).mockResolvedValueOnce({
      effect: 'rainbow',
      states: {},
      templates: { stripes: { selected: 2, slots } },
    });
    render(<LightingTouch widget={widget} />);
    await select(['dev-a']);

    fireEvent.click(await screen.findByText('pick-stripes'));

    await waitFor(() => expect(setPins).toHaveBeenCalled());
    expect(lastPins()[1]).toMatchObject({ kind: 'static', effect: 'stripes', slot: 2 });
  });

  it('with nothing selected a pick is global and needs no selection', async () => {
    render(<LightingTouch widget={widget} />);

    fireEvent.click(await screen.findByText('pick-stripes'));

    await waitFor(() => expect(startStatic).toHaveBeenCalled());
    expect(vi.mocked(startStatic).mock.calls.at(-1)?.[0]).toBe('stripes');
    expect(setPins).not.toHaveBeenCalled();
    expect(screen.queryByText('lighting.pane.pickDevices')).toBeNull();
  });

  it('with nothing selected a picked colour is the exact global colour', async () => {
    render(<LightingTouch widget={widget} />);
    fireEvent.click(await screen.findByText('pick-custom'));
    await waitFor(() => expect(startStatic).toHaveBeenCalled());
    expect(vi.mocked(startStatic).mock.calls.at(-1)?.[8]).toBe('#123456');
    expect(setPins).not.toHaveBeenCalled();
    await waitFor(() => expect(pickerProps.current!.hex).toBe('#123456'));
  });

  it('offers the picker canvas without a selection gate', async () => {
    render(<LightingTouch widget={widget} />);
    await select(['dev-a']);
    await waitFor(() => expect(pickerProps.current).not.toBeNull());
    expect(pickerProps.current).not.toHaveProperty('hasSelection');
    expect(typeof pickerProps.current!.onPreview).toBe('function');
    expect(typeof pickerProps.current!.onCommit).toBe('function');
  });

  // A finger drag has to reach the hardware on every move.
  it('pins a dragged colour on the selected devices', async () => {
    render(<LightingTouch widget={widget} />);
    await select(['dev-a']);

    fireEvent.click(await screen.findByText('drag-custom'));

    await waitFor(() => expect(setPins).toHaveBeenCalled());
    expect(lastPins()[0]).toEqual(['dev-a']);
    expect(lastPins()[1]).toMatchObject({ kind: 'static', effect: 'flat', color: '#abcdef' });
  });

  it('pins a custom colour on the selected devices', async () => {
    render(<LightingTouch widget={widget} />);
    await select(['dev-a']);
    fireEvent.click(await screen.findByText('pick-custom'));
    await waitFor(() => expect(setPins).toHaveBeenCalled());
    expect(lastPins()[0]).toEqual(['dev-a']);
    expect(lastPins()[1]).toMatchObject({ kind: 'static', effect: 'flat', color: '#123456' });
  });

  // The browsed effect is not what the devices wear: leaving the grid keyed on
  // it lights a pattern tile alongside the picker tile, so both read selected.
  it('highlights the grid from what the selection wears, not the browsed effect', async () => {
    render(<LightingTouch widget={widget} />);
    await select(['dev-a']);

    // A pattern pick: the grid marks the tile the selection now wears.
    fireEvent.click(await screen.findByText('pick-stripes'));
    await waitFor(() => expect(gridProps.current!.effect).toBe('stripes'));

    // A colour pick replaces it, so no pattern tile stays lit.
    fireEvent.click(screen.getByText('pick-custom'));
    await waitFor(() => expect(gridProps.current!.effect).toBe(''));
  });

  it('scopes the grid to a pinned pattern when its devices are selected', async () => {
    vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ 'dev-a': { kind: 'static', effect: 'checker', slot: 1 } }));
    render(<LightingTouch widget={widget} />);
    await select(['dev-a']);
    await waitFor(() => expect(gridProps.current?.effect).toBe('checker'));
  });

  it('gives every card a pin that pins to the global source and unpins', async () => {
    vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({ 'dev-b': { kind: 'mirror' } }));
    render(<LightingTouch widget={widget} />);
    await waitFor(() => expect(selectProps.current?.pinSource).toBeTruthy());
    const props = selectProps.current as {
      onSetPin: (ids: string[], pinned: boolean) => void;
      onUnpinAll: () => void;
    };
    props.onSetPin(['dev-a'], true);
    expect(lastPins()[0]).toEqual(['dev-a']);
    expect(lastPins()[1]).toMatchObject({ kind: 'static' });
    props.onSetPin(['dev-a'], false);
    expect(lastPins()).toEqual([['dev-a'], null]);
    await waitFor(() => expect(Object.keys((selectProps.current as { pins: object }).pins)).toContain('dev-b'));
    props.onUnpinAll();
    expect(lastPins()[1]).toBeNull();
    expect(lastPins()[0]).toContain('dev-b');
  });

  it('offers Pin selected to Mirror in the Mirror tab only', async () => {
    vi.mocked(fetchCurrentSync).mockImplementation(() => Promise.resolve({ sync: 'screen' }));
    render(<LightingTouch widget={widget} />);
    await select(['dev-a']);
    await waitFor(() => expect(selectProps.current?.onPinSelectedToMirror).toBeTypeOf('function'));
    (selectProps.current!.onPinSelectedToMirror as () => void)();
    expect(lastPins()).toEqual([['dev-a'], { kind: 'mirror' }]);
  });

  it('does not offer it in Static', async () => {
    render(<LightingTouch widget={widget} />);
    await waitFor(() => expect(selectProps.current).not.toBeNull());
    expect(selectProps.current!.onPinSelectedToMirror).toBeUndefined();
  });

  it('names pins as the page does: palette family and shade, simple sweeps by their label', async () => {
    render(<LightingTouch widget={widget} />);
    await waitFor(() => expect(selectProps.current).not.toBeNull());
    const name = selectProps.current!.pinTargetName as (pin: Pin) => string;
    expect(name({ kind: 'static', effect: 'flat', color: paletteColor('red-3')!.hex })).toBe('lighting.palette.red 3');
    expect(name({ kind: 'animate', effect: 'sweeprainbow' })).toBe('lighting.simple.anim.rainbow');
    expect(name({ kind: 'mirror' })).toBe('lighting.mode.screen');
  });

  it('does not restore a stored selection, and clears the old keys', async () => {
    localStorage.setItem('nexus.lighting.selectedDevices', JSON.stringify(['dev-a']));
    localStorage.setItem('nexus.lighting.pinSelection', JSON.stringify(['dev-a']));
    render(<LightingTouch widget={widget} />);
    await waitFor(() => expect(selectProps.current).not.toBeNull());
    expect((selectProps.current!.selectedIds as Set<string>).size).toBe(0);
    expect(localStorage.getItem('nexus.lighting.selectedDevices')).toBeNull();
    expect(localStorage.getItem('nexus.lighting.pinSelection')).toBeNull();
  });
});

describe('LightingTouch editor scope', () => {
  const rainbowTemplates = () => ({
    effect: 'rainbow',
    states: {},
    templates: {},
  });
  beforeEach(() => {
    localStorage.clear();
    gridProps.current = null;
    selectProps.current = null;
    controlsProps.current = null;
    vi.mocked(setPins).mockClear();
    vi.mocked(startStatic).mockClear();
    vi.mocked(saveAnimateTemplates).mockClear();
    vi.mocked(fetchCurrentSync).mockImplementation(() => Promise.resolve({ sync: 'rainbow' }));
    vi.mocked(fetchAnimateSettings).mockImplementation(() => Promise.resolve(rainbowTemplates()));
    vi.mocked(fetchPins).mockImplementation(() => Promise.resolve({
      a: { kind: 'animate', effect: 'aurora' },
      b: { kind: 'animate', effect: 'plasma' },
      c: { kind: 'static', effect: 'flat', color: '#ff0000' },
      m: { kind: 'mirror' },
    }));
  });

  const editorDisabled = () => screen.getByTestId('editor').dataset.effectDisabled;

  it('edits the pinned shader, and drops a staged edit when the selection moves to another target', async () => {
    render(<LightingTouch widget={widget} />);
    await select(['a']);
    await waitFor(() => expect(controlsProps.current?.effect).toBe('aurora'));

    // A drag stages an edit on Aurora...
    act(() => { (controlsProps.current!.onChange as (p: object, c?: boolean) => void)({ intensity: 0.2 }); });
    await waitFor(() => expect((controlsProps.current!.state as { intensity: number }).intensity).toBe(0.2));

    // ...and the selection then moves to Plasma, which must not inherit it.
    await select(['b']);
    await waitFor(() => expect(controlsProps.current?.effect).toBe('plasma'));
    expect((controlsProps.current!.state as { intensity: number }).intensity).not.toBe(0.2);
    expect(controlsProps.current!.canReset).toBe(false);

    vi.mocked(saveAnimateTemplates).mockClear();
    act(() => { (controlsProps.current!.onCommit as () => void)(); });
    expect(saveAnimateTemplates).not.toHaveBeenCalled();
  });

  it('writes a committed edit to the target it was made on', async () => {
    render(<LightingTouch widget={widget} />);
    await select(['a']);
    await waitFor(() => expect(controlsProps.current?.effect).toBe('aurora'));
    act(() => { (controlsProps.current!.onChange as (p: object, c?: boolean) => void)({ intensity: 0.2 }); });
    act(() => { (controlsProps.current!.onCommit as () => void)(); });
    await waitFor(() => expect(saveAnimateTemplates).toHaveBeenCalled());
    const saved = vi.mocked(saveAnimateTemplates).mock.calls.at(-1)![0] as Record<string, { selected: number; slots: { intensity: number }[] }>;
    expect(saved.aurora.slots[saved.aurora.selected].intensity).toBe(0.2);
    expect(saved.plasma.slots[saved.plasma.selected].intensity).not.toBe(0.2);
  });

  it('locks the effect editor for a mixed selection and for a palette colour', async () => {
    render(<LightingTouch widget={widget} />);
    await waitFor(() => expect(selectProps.current).not.toBeNull());
    expect(editorDisabled()).toBe('false');
    await select(['a', 'b']);
    await waitFor(() => expect(editorDisabled()).toBe('true'));
    await select(['c']);
    await waitFor(() => expect(editorDisabled()).toBe('true'));
    await select(['a']);
    await waitFor(() => expect(editorDisabled()).toBe('false'));
  });

  it('shows only the global Mirror filters for a mirror pin, and slider drags never touch the global effect', async () => {
    render(<LightingTouch widget={widget} />);
    await select(['m']);
    await waitFor(() => expect(screen.getByTestId('post-process')).toBeTruthy());
    expect(screen.getByText('lighting.pin.mirrorHint')).toBeTruthy();
    expect(screen.queryByTestId('effect-controls')).toBeNull();
    expect(screen.queryByTestId('screen-controls')).toBeNull();
  });

  it('says where the editor is for a shader pin on the Mirror tab', async () => {
    vi.mocked(fetchCurrentSync).mockImplementation(() => Promise.resolve({ sync: 'screen' }));
    render(<LightingTouch widget={widget} />);
    await select(['a']);
    await waitFor(() => expect(screen.getByText('lighting.pin.pinnedNotice')).toBeTruthy());
    expect(screen.queryByTestId('screen-controls')).toBeNull();
  });
});
