import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HydroShift2RingSettings } from './HydroShift2RingSettings';
import type { HydroShift2Lighting } from '../../../api/hydroshift2';

/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));

const mockGet = vi.fn();
const mockSet = vi.fn();

vi.mock('../../../api/hydroshift2', () => ({
  getHydroShift2Lighting: (...args: any[]) => mockGet(...args),
  setHydroShift2Lighting: (...args: any[]) => mockSet(...args),
}));

const lighting: HydroShift2Lighting = {
  mode: 'meteor',
  effectMode: 'meteor',
  speed: 2,
  direction: 0,
  brightness: 4,
  colors: ['#111111'],
  modes: [
    { key: 'rainbow', colors: 0, hasDirection: true, hasSpeed: true, hasBrightness: true },
    { key: 'static', colors: 1, hasDirection: false, hasSpeed: false, hasBrightness: true },
    { key: 'meteor', colors: 4, hasDirection: true, hasSpeed: true, hasBrightness: true },
  ],
};

async function renderSettings(data: HydroShift2Lighting = lighting) {
  mockGet.mockResolvedValue(data);
  await act(async () => {
    render(<HydroShift2RingSettings />);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSet.mockResolvedValue({});
});

describe('HydroShift2RingSettings', () => {
  it('lists the pump head effects by their localized names', async () => {
    await renderSettings();
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    const options = await screen.findAllByRole('option');
    expect(options.map(o => o.textContent)).toEqual([
      'devices.lianliEffect.rainbow', 'devices.lianliEffect.static', 'devices.lianliEffect.meteor',
    ]);
  });

  it('fills an effect palette from the pump head defaults past the colours set', async () => {
    await renderSettings();
    const inputs = screen.getAllByLabelText('common.hexColor') as HTMLInputElement[];
    expect(inputs.map(i => i.value)).toEqual(['#111111', '#0000FF', '#00FF00', '#FFFF00']);
    expect(screen.getByText('devices.lianli.lightingDirection')).toBeInTheDocument();
  });

  it('a single-colour effect without speed shows one picker and no speed or direction', async () => {
    await renderSettings({ ...lighting, mode: 'static', effectMode: 'static' });
    expect(screen.getAllByLabelText('common.hexColor')).toHaveLength(1);
    expect(screen.queryByText('devices.lianli.lightingSpeed')).not.toBeInTheDocument();
    expect(screen.queryByText('devices.lianli.lightingDirection')).not.toBeInTheDocument();
  });

  it('handing the ring to the Lighting page stores the canvas mode', async () => {
    await renderSettings();
    fireEvent.click(screen.getByRole('switch', { name: 'devices.lightingPage.use' }));
    expect(mockSet).toHaveBeenLastCalledWith({ mode: 'canvas' });
  });

  it('taking it back restores the remembered effect', async () => {
    await renderSettings({ ...lighting, mode: 'canvas', effectMode: 'rainbow' });
    fireEvent.click(screen.getByRole('switch', { name: 'devices.lightingPage.use' }));
    expect(mockSet).toHaveBeenLastCalledWith({ mode: 'rainbow' });
  });

  it('reports whether the Lighting page drives it, once read and on a change', async () => {
    const onLightingPage = vi.fn();
    mockGet.mockResolvedValue(lighting);
    await act(async () => {
      render(<HydroShift2RingSettings onLightingPage={onLightingPage} />);
    });
    expect(onLightingPage).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('switch', { name: 'devices.lightingPage.use' }));
    expect(onLightingPage).toHaveBeenLastCalledWith(true);
  });

  it('under Sync all locks its look and the Lighting page switch, and says it follows Sync all', async () => {
    mockGet.mockResolvedValue(lighting);
    await act(async () => {
      render(<HydroShift2RingSettings syncedAll />);
    });
    expect(screen.getByText('devices.lianli-hub.followsSyncAll')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'devices.lightingPage.use' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'devices.lianli.lightingMode' })).toBeDisabled();
  });

  it('under Sync all still lets the Lighting page switch go off', async () => {
    mockGet.mockResolvedValue({ ...lighting, mode: 'canvas', effectMode: 'rainbow' });
    await act(async () => {
      render(<HydroShift2RingSettings syncedAll />);
    });
    const lightingPage = screen.getByRole('switch', { name: 'devices.lightingPage.use' });
    expect(lightingPage).not.toBeDisabled();
    fireEvent.click(lightingPage);
    expect(mockSet).toHaveBeenLastCalledWith({ mode: 'rainbow' });
  });
});

describe('HydroShift2RingSettings on the OLED Curved edge', () => {
  const curveGet = vi.fn();
  const curveSet = vi.fn();
  const api = { get: curveGet, set: curveSet };
  const edge: HydroShift2Lighting = {
    mode: 'runway',
    effectMode: 'runway',
    speed: 3,
    direction: 0,
    brightness: 4,
    maxLevel: 4,
    colors: ['#111111'],
    modes: [
      { key: 'rainbow', colors: 0, hasDirection: true, hasSpeed: true, hasBrightness: true, defaultColors: [] },
      { key: 'static', colors: 1, hasDirection: false, hasSpeed: false, hasBrightness: true, defaultColors: ['#ff0000'] },
      {
        key: 'runway', colors: 6, hasDirection: false, hasSpeed: true, hasBrightness: true,
        defaultColors: ['#ff0000', '#ff8000', '#ffff00', '#00ff00', '#0000ff', '#8000ff'],
      },
    ],
  };

  async function renderEdge(data: HydroShift2Lighting = edge) {
    curveGet.mockResolvedValue(data);
    curveSet.mockResolvedValue({});
    await act(async () => {
      render(<HydroShift2RingSettings api={api} />);
    });
  }

  it('reads and saves through the edge endpoints, not the pump ring', async () => {
    await renderEdge();
    expect(curveGet).toHaveBeenCalledTimes(1);
    expect(mockGet).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('devices.lianli.lightingMode'));
    fireEvent.click(await screen.findByRole('option', { name: 'devices.lianliEffect.static' }));
    expect(curveSet).toHaveBeenLastCalledWith({ mode: 'static' });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('shows as many pickers as the effect uses, filled from its own defaults past the colours set', async () => {
    await renderEdge();
    const inputs = screen.getAllByLabelText('common.hexColor') as HTMLInputElement[];
    expect(inputs.map(i => i.value.toLowerCase())).toEqual(['#111111', '#ff8000', '#ffff00', '#00ff00', '#0000ff', '#8000ff']);
    expect(screen.queryByText('devices.lianli.lightingDirection')).not.toBeInTheDocument();
  });

  it('saves all six colours when one changes', async () => {
    await renderEdge();
    fireEvent.change(screen.getAllByLabelText('common.hexColor')[5], { target: { value: '#abcdef' } });
    expect(curveSet).toHaveBeenLastCalledWith({ colors: ['#111111', '#ff8000', '#ffff00', '#00ff00', '#0000ff', '#abcdef'] });
  });

  it('an effect that draws its own colours shows no pickers', async () => {
    await renderEdge({ ...edge, mode: 'rainbow', effectMode: 'rainbow' });
    expect(screen.queryAllByLabelText('common.hexColor')).toHaveLength(0);
    expect(screen.getByText('devices.lianli.lightingDirection')).toBeInTheDocument();
  });

  it('places the speed and brightness sliders on the levels the service reports', async () => {
    await renderEdge({ ...edge, maxLevel: 2, speed: 1, brightness: 2 });
    expect((screen.getByRole('slider', { name: 'devices.lianli.lightingSpeedAria' }) as HTMLInputElement).value).toBe('50');
    expect((screen.getByRole('slider', { name: 'devices.lianli.lightingBrightnessAria' }) as HTMLInputElement).value).toBe('100');
  });

  it('follows the Lighting page with the canvas mode', async () => {
    await renderEdge();
    fireEvent.click(screen.getByRole('switch', { name: 'devices.lightingPage.use' }));
    expect(curveSet).toHaveBeenLastCalledWith({ mode: 'canvas' });
  });
});
