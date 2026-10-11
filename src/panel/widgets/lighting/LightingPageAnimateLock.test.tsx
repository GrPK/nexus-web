import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAnimateDeviceLocks, setAnimateDeviceLock, startAnimate } from '../../../api/lighting';
import { UiSettingsProvider } from '../../../hooks/useUiSettings';
import { LightingPage } from './LightingPage';

const topicHandlers = vi.hoisted(() => ({ lighting: [] as (() => void)[] }));

vi.mock('../../../hooks/useLightingSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../hooks/useLightingSync')>()),
  useLightingSync: () => ({
    mode: 'animate',
    setMode: vi.fn(),
    rawSync: 'fire',
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

// The selection the page hands the grid is the thing that regressed, so the
// stub renders it instead of the real cells.
vi.mock('./page/AnimateGrid', () => ({
  AnimateGrid: ({ effect, onSelect, lockedDevices }: {
    effect: string;
    onSelect?: (key: string) => void;
    lockedDevices?: ReadonlyMap<string, readonly string[]>;
  }) => (
    <div>
      <div data-testid="grid-effect" onClick={() => onSelect?.('stripes')}>{effect}</div>
      <div data-testid="grid-locks">{[...(lockedDevices ?? [])].map(([k, v]) => `${k}=${v.join('+')}`).join(';')}</div>
    </div>
  ),
}));
vi.mock('./page/FullscreenShader', () => ({
  FullscreenShader: ({ effect, onPrev, children }: { effect: string; onPrev: () => void; children?: React.ReactNode }) => (
    <div data-testid="fullscreen" data-effect={effect}>
      <button type="button" onClick={onPrev}>fs-prev</button>
      {children}
    </div>
  ),
}));
vi.mock('./page/ModeControls', () => ({ ModeControls: () => null }));
// The stub exposes exactly what the lock rides on: the pick the rail is handed
// (locked or not) and the toggle callback.
vi.mock('./page/DevicePanel', () => ({
  DevicePanel: ({ devicePicks, animateLocks, animateLockable, onSetAnimateLock, lockFlash, onSetSelection }: {
    devicePicks?: Record<string, { key: string }>;
    animateLocks?: Record<string, string>;
    animateLockable?: boolean;
    onSetAnimateLock?: (ids: string[], locked: boolean) => void;
    lockFlash?: { ids: ReadonlySet<string>; seq: number };
    onSetSelection: (ids: Set<string>, primary: string | null) => void;
  }) => (
    <div
      data-testid="rail"
      data-lockable={String(!!animateLockable)}
      data-lock={animateLocks?.a ?? ''}
      data-pick={devicePicks?.a?.key ?? ''}
      data-flash={`${lockFlash?.seq ?? 0}:${[...(lockFlash?.ids ?? [])].join(',')}`}
    >
      <button type="button" onClick={() => onSetAnimateLock?.(['a'], !animateLocks?.a)}>toggle</button>
      <button type="button" onClick={() => onSetSelection(new Set(['a']), 'a')}>select-a</button>
    </div>
  ),
}));
vi.mock('./page/LedMapEditor', () => ({ LedMapEditor: () => null }));
vi.mock('./page/RightPaneTabs', () => ({ RightPaneTabs: () => null }));
vi.mock('./page/EffectTab', () => ({ EffectTab: () => null }));
vi.mock('../../../components/common/ViewHeader/ViewHeader', () => ({ ViewHeader: () => null }));
vi.mock('../../../components/views/ServiceRequired', () => ({ ServiceRequired: () => null }));
vi.mock('../../../components/common/DeviceCanvas/DeviceCanvas', () => ({ DeviceCanvas: () => null }));

vi.mock('../../../api/lighting', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../api/lighting')>();
  return {
    ...actual,
    fetchCurrentSync: vi.fn(() => Promise.resolve({ sync: 'fire' })),
    // The animate side remembers a different effect; it must not win in static.
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
    stopLighting: vi.fn(() => Promise.resolve(null)),
    setMusicReactive: vi.fn(() => Promise.resolve(null)),
    setAnimateDeviceLock: vi.fn(() => Promise.resolve(true)),
    fetchAnimateDeviceLocks: vi.fn(() => Promise.resolve({})),
    fetchStaticDeviceLooks: vi.fn(() => Promise.reject(new Error('offline'))),
  };
});

const serviceState = { cooling: null, lighting: null, panel: null } as never;

const renderPage = () => render(
  <UiSettingsProvider>
    <LightingPage serviceOnline serviceState={serviceState} activeProfileId="p1" />
  </UiSettingsProvider>,
);

describe('LightingPage animation lock', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('nexus_settings', JSON.stringify({ general: { lightingDashboardMode: 'advanced', coolingDashboardMode: 'advanced' } }));
    vi.mocked(setAnimateDeviceLock).mockClear();
    vi.mocked(setAnimateDeviceLock).mockImplementation(() => Promise.resolve(true));
    vi.mocked(fetchAnimateDeviceLocks).mockImplementation(() => Promise.resolve({}));
    vi.mocked(startAnimate).mockClear();
    topicHandlers.lighting.length = 0;
  });

  it('offers locking in Animate and locks onto the running effect, optimistically', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('rail').dataset.lockable).toBe('true'));
    await waitFor(() => expect(screen.getByTestId('grid-effect').textContent).toBe('fire'));

    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('rail').dataset.lock).toBe('fire');
    expect(setAnimateDeviceLock).toHaveBeenCalledWith('a', 'fire');
    expect(screen.getByTestId('grid-locks').textContent).toBe('fire=Fan A');

    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('rail').dataset.lock).toBe('');
    expect(setAnimateDeviceLock).toHaveBeenLastCalledWith('a', null);
  });

  it('puts the lock back when the service refuses', async () => {
    vi.mocked(setAnimateDeviceLock).mockImplementation(() => Promise.resolve(false));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('rail').dataset.lockable).toBe('true'));
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('rail').dataset.lock).toBe('fire');
    await waitFor(() => expect(screen.getByTestId('rail').dataset.lock).toBe(''));
  });

  it('reads the locks on mount and again on the lighting broadcast', async () => {
    vi.mocked(fetchAnimateDeviceLocks).mockImplementation(() => Promise.resolve({ a: 'aurora' }));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('rail').dataset.lock).toBe('aurora'));

    vi.mocked(fetchAnimateDeviceLocks).mockImplementation(() => Promise.resolve({}));
    topicHandlers.lighting.forEach(cb => cb());
    await waitFor(() => expect(screen.getByTestId('rail').dataset.lock).toBe(''));
  });

  it('keeps what it has when the locks are unreadable', async () => {
    vi.mocked(fetchAnimateDeviceLocks).mockImplementation(() => Promise.resolve({ a: 'aurora' }));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('rail').dataset.lock).toBe('aurora'));
    vi.mocked(fetchAnimateDeviceLocks).mockClear();
    vi.mocked(fetchAnimateDeviceLocks).mockImplementation(() => Promise.resolve(null));
    topicHandlers.lighting.forEach(cb => cb());
    await waitFor(() => expect(fetchAnimateDeviceLocks).toHaveBeenCalled());
    expect(screen.getByTestId('rail').dataset.lock).toBe('aurora');
  });

  it('gives a locked device the locked effect for its strip when it is not the running one', async () => {
    vi.mocked(fetchAnimateDeviceLocks).mockImplementation(() => Promise.resolve({ a: 'aurora' }));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('rail').dataset.pick).toBe('aurora'));
  });

  it('lights the locked animation on the grid for a selected locked device, and ignores a different pick', async () => {
    vi.mocked(fetchAnimateDeviceLocks).mockImplementation(() => Promise.resolve({ a: 'aurora' }));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('rail').dataset.lock).toBe('aurora'));
    // The page seeds its selection with the only device, so the grid follows the lock.
    await waitFor(() => expect(screen.getByTestId('grid-effect').textContent).toBe('aurora'));

    // Mount hydration restarts the running effect; only what follows the click counts.
    vi.mocked(startAnimate).mockClear();
    fireEvent.click(screen.getByText('select-a'));
    await waitFor(() => expect(screen.getByTestId('grid-effect').textContent).toBe('aurora'));
    expect(startAnimate).not.toHaveBeenCalled();

    expect(screen.getByTestId('rail').dataset.flash).toBe('0:');
    fireEvent.click(screen.getByTestId('grid-effect'));
    await waitFor(() => expect(screen.getByTestId('rail').dataset.flash).toBe('1:a'));
    await waitFor(() => expect(screen.getByText('lighting.animate.lockedNoticeTitle')).toBeTruthy());
    expect(startAnimate).not.toHaveBeenCalled();
    expect(screen.getByTestId('grid-effect').textContent).toBe('aurora');
  });

  it('keeps a lock request in flight against a lighting frame that predates it', async () => {
    let resolve: (ok: boolean) => void = () => {};
    vi.mocked(setAnimateDeviceLock).mockImplementation(() => new Promise<boolean>(r => { resolve = r; }));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('rail').dataset.lockable).toBe('true'));
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('rail').dataset.lock).toBe('fire');

    vi.mocked(fetchAnimateDeviceLocks).mockClear();
    vi.mocked(fetchAnimateDeviceLocks).mockImplementation(() => Promise.resolve({}));
    topicHandlers.lighting.forEach(cb => cb());
    await waitFor(() => expect(fetchAnimateDeviceLocks).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 0));
    expect(screen.getByTestId('rail').dataset.lock).toBe('fire');

    resolve(true);
    await new Promise(r => setTimeout(r, 0));
    expect(screen.getByTestId('rail').dataset.lock).toBe('fire');
  });

  it('shows and edits the dock effect in fullscreen, and explains the arrows under a lock', async () => {
    vi.mocked(fetchAnimateDeviceLocks).mockImplementation(() => Promise.resolve({ a: 'aurora' }));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('grid-effect').textContent).toBe('aurora'));
    fireEvent.click(screen.getByRole('button', { name: 'lighting.fullscreen' }));
    const fs = screen.getByTestId('fullscreen');
    expect(fs.dataset.effect).toBe('aurora');

    fireEvent.click(screen.getByText('fs-prev'));
    await waitFor(() => expect(within(fs).getByText('lighting.animate.lockedNoticeTitle')).toBeTruthy());
    expect(fs.dataset.effect).toBe('aurora');
  });
});
