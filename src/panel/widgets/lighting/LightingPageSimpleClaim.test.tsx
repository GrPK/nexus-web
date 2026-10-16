import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UiSettingsProvider } from '../../../hooks/useUiSettings';
import { LightingPage } from './LightingPage';
import * as lightingApi from '../../../api/lighting';

vi.mock('../../../hooks/useLightingSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../hooks/useLightingSync')>()),
  useLightingSync: () => ({ mode: 'static', setMode: vi.fn(), rawSync: '', setRawSync: vi.fn(), synced: true, paused: false }),
}));
vi.mock('../../../hooks/useLightingFrames', () => ({ useLightingFrames: () => ({ connected: false, live: false }) }));
vi.mock('../../../hooks/useUsbDevices', () => ({ useUsbDevices: () => ({ devices: [] }) }));
vi.mock('../../../hooks/useAudioState', () => ({ useAudioState: () => ({ current: null }) }));
vi.mock('../../../hooks/useMultiplexSocket', () => ({ useTopicCallback: vi.fn(), useTopic: vi.fn(() => null) }));
vi.mock('../../../lib/controlSync', () => ({ publishControlSync: vi.fn(), subscribeControlSync: vi.fn(() => () => {}) }));

vi.mock('../../../components/views/ServiceRequired', () => ({ ServiceRequired: () => null }));

const DEVICE = {
  id: 'openrgb-0', name: 'Strip', ledsOn: false, ledCount: 8, controlled: false,
  canvasX: 0, canvasY: 0, canvasW: 1, canvasH: 1, canvasRotation: 0,
};

vi.mock('../../../api/lighting', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../api/lighting')>();
  return {
    ...actual,
    fetchCurrentSync: vi.fn(() => Promise.resolve({ sync: '' })),
    fetchAnimateDefaults: vi.fn(() => Promise.resolve(null)),
    cachedAnimateDefaults: vi.fn(() => null),
    fetchAnimateSettings: vi.fn(() => Promise.resolve(null)),
    fetchStaticColor: vi.fn(() => Promise.resolve({ r: 0, g: 0, b: 0 })),
    fetchStaticSettings: vi.fn(() => Promise.resolve(null)),
    fetchMusicReactive: vi.fn(() => Promise.resolve({ enabled: false })),
    fetchScreenEffect: vi.fn(() => Promise.resolve({ hue: 0, colorize: 0, saturation: 1, contrast: 1 })),
    fetchMediaEffect: vi.fn(() => Promise.resolve({ hue: 0, colorize: 0, saturation: 1, contrast: 1 })),
    fetchLightingDevices: vi.fn(() => Promise.resolve({ isInit: true, devices: [DEVICE] })),
    fetchLedMap: vi.fn(() => Promise.resolve(null)),
    fetchAvailableMappings: vi.fn(() => Promise.resolve(null)),
    fetchLayoutPresets: vi.fn(() => Promise.resolve(null)),
    setLightingDeviceControlled: vi.fn(() => Promise.resolve(null)),
    setLightingDevicePower: vi.fn(() => Promise.resolve(null)),
    setPins: vi.fn(() => Promise.resolve(true)),
    fetchPins: vi.fn(() => Promise.resolve({})),
    stopLighting: vi.fn(() => Promise.resolve(null)),
    startStatic: vi.fn(() => Promise.resolve(null)),
    startAnimate: vi.fn(() => Promise.resolve(null)),
  };
});

function renderSimple() {
  localStorage.setItem('nexus_settings', JSON.stringify({ general: { lightingDashboardMode: 'simple' } }));
  return render(
    <UiSettingsProvider>
      <LightingPage serviceOnline serviceState={{ cooling: null, lighting: null, panel: null }} activeProfileId="p" />
    </UiSettingsProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(lightingApi.fetchLightingDevices).mockImplementation(() => Promise.resolve({ isInit: true, devices: [DEVICE] } as never));
  vi.mocked(lightingApi.fetchPins).mockImplementation(() => Promise.resolve({}));
});

describe('LightingPage simple mode device claiming', () => {
  it('leaves devices alone until the user asks for something', async () => {
    renderSimple();
    await screen.findByRole('tab');

    // Arriving on the page is not a decision about which devices Nexus drives.
    await waitFor(() => expect(lightingApi.fetchLightingDevices).toHaveBeenCalled());
    expect(lightingApi.setLightingDeviceControlled).not.toHaveBeenCalled();
    expect(lightingApi.setLightingDevicePower).not.toHaveBeenCalled();
  });

  it('leaves an uncontrolled device uncontrolled when the user presses off', async () => {
    renderSimple();
    fireEvent.click(await screen.findByRole('tab'));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /lighting\.mode\.off/ }));

    await waitFor(() => expect(lightingApi.stopLighting).toHaveBeenCalled());
    expect(lightingApi.setLightingDeviceControlled).not.toHaveBeenCalled();
  });

  it('sets the global color without retaking an uncontrolled device', async () => {
    const { container } = renderSimple();
    await waitFor(() => expect(lightingApi.fetchLightingDevices).toHaveBeenCalled());

    const swatch = container.querySelector('[data-palette-id="red-3"]') as HTMLButtonElement;
    fireEvent.click(swatch);

    await waitFor(() => expect(lightingApi.startStatic).toHaveBeenCalled());
    expect(vi.mocked(lightingApi.startStatic).mock.calls.at(-1)?.[8]).toMatch(/^#[0-9a-f]{6}$/i);
    expect(lightingApi.setLightingDeviceControlled).not.toHaveBeenCalled();
    expect(lightingApi.setLightingDevicePower).not.toHaveBeenCalled();
  });

  it('powers on a controlled dark device on a pick', async () => {
    vi.mocked(lightingApi.fetchLightingDevices).mockImplementation(
      () => Promise.resolve({ isInit: true, devices: [{ ...DEVICE, controlled: true }] } as never),
    );
    const { container } = renderSimple();
    await waitFor(() => expect(lightingApi.fetchLightingDevices).toHaveBeenCalled());
    fireEvent.click(container.querySelector('[data-palette-id="red-3"]') as HTMLButtonElement);
    await waitFor(() => expect(lightingApi.setLightingDevicePower).toHaveBeenCalledWith('openrgb-0', true));
    expect(lightingApi.setLightingDeviceControlled).not.toHaveBeenCalled();
  });

  it('offers Control all devices while a device is uncontrolled, and claims on click', async () => {
    renderSimple();
    fireEvent.click(await screen.findByRole('button', { name: /lighting\.controlAllDevices/ }));
    await waitFor(() => expect(lightingApi.setLightingDeviceControlled).toHaveBeenCalledWith('openrgb-0', true));
    expect(lightingApi.setLightingDevicePower).toHaveBeenCalledWith('openrgb-0', true);
  });

  it('shows no Control all devices when every device is controlled', async () => {
    vi.mocked(lightingApi.fetchLightingDevices).mockImplementation(
      () => Promise.resolve({ isInit: true, devices: [{ ...DEVICE, controlled: true, ledsOn: true }] } as never),
    );
    renderSimple();
    await screen.findByText('lighting.simple.controlledOf.one');
    expect(screen.queryByRole('button', { name: /lighting\.controlAllDevices/ })).toBeNull();
  });

});

describe('LightingPage simple mode and pins', () => {
  const pinned = () => vi.mocked(lightingApi.fetchPins).mockImplementation(
    () => Promise.resolve({ 'openrgb-0': { kind: 'animate', effect: 'aurora' } }),
  );
  const driven = () => vi.mocked(lightingApi.fetchLightingDevices).mockImplementation(
    () => Promise.resolve({ isInit: true, devices: [{ ...DEVICE, controlled: true, ledsOn: true }] } as never),
  );

  it('leaves pins alone on arrival and on Off', async () => {
    pinned();
    renderSimple();
    await waitFor(() => expect(lightingApi.fetchPins).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('tab'));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /lighting\.mode\.off/ }));
    await waitFor(() => expect(lightingApi.stopLighting).toHaveBeenCalled());
    expect(lightingApi.setPins).not.toHaveBeenCalled();
  });

  it('unpins every device on a palette pick', async () => {
    pinned();
    const { container } = renderSimple();
    await waitFor(() => expect(lightingApi.fetchPins).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: /lighting\.controlAllDevices/ })).toBeTruthy());
    fireEvent.click(container.querySelector('[data-palette-id="red-3"]') as HTMLButtonElement);
    await waitFor(() => expect(lightingApi.setPins).toHaveBeenCalledWith(['openrgb-0'], null));
  });

  it('counts a pinned device as not controlled, and Control all unpins it', async () => {
    pinned();
    driven();
    renderSimple();
    const button = await screen.findByRole('button', { name: /lighting\.simple\.controlAll/ });
    fireEvent.click(button);
    await waitFor(() => expect(lightingApi.setPins).toHaveBeenCalledWith(['openrgb-0'], null));
    expect(lightingApi.setLightingDeviceControlled).not.toHaveBeenCalled();
  });

  it('offers no Control all once every driven device follows', async () => {
    driven();
    renderSimple();
    // The singular count renders only once the one device has loaded.
    await screen.findByText('lighting.simple.controlledOf.one');
    expect(screen.queryByRole('button', { name: /lighting\.simple\.controlAll/ })).toBeNull();
  });
});
