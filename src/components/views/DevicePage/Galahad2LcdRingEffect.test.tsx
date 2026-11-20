import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fitColors, Galahad2LcdRingEffectSection } from './Galahad2LcdRingEffect';

/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));

const mockGet = vi.fn();
const mockSet = vi.fn();
vi.mock('../../../api/lianli-galahad2-lcd', () => ({
  getGalahad2LcdRingEffect: (...args: any[]) => mockGet(...args),
  setGalahad2LcdRingEffect: (...args: any[]) => mockSet(...args),
}));

const effects = [
  { id: 'rainbowMorph', colors: 0 },
  { id: 'breathing', colors: 1 },
  { id: 'runway', colors: 2 },
  { id: 'meteor', colors: 4 },
];

function state(over: Record<string, unknown> = {}) {
  return {
    isConnected: true,
    effect: 'runway',
    speed: 2,
    brightness: 4,
    colors: ['#112233', '#445566'],
    nexusDriven: false,
    effects,
    ...over,
  };
}

async function mount() {
  await act(async () => { render(<Galahad2LcdRingEffectSection />); });
}

describe('fitColors', () => {
  it('trims and tops up to the count', () => {
    expect(fitColors(['#111111', '#222222', '#333333'], 2)).toEqual(['#111111', '#222222']);
    expect(fitColors(['#111111'], 3)).toEqual(['#111111', '#ff0000', '#ff0000']);
    expect(fitColors(['#111111'], 0)).toEqual([]);
  });
});

describe('Galahad2LcdRingEffectSection', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
    mockSet.mockResolvedValue({ error: false });
  });

  it('renders nothing when the pump is not connected', async () => {
    mockGet.mockResolvedValue(state({ isConnected: false }));
    await mount();
    expect(screen.queryByText('devices.q60.lightingFirmwareSection')).toBeNull();
  });

  it('shows one swatch per color the effect reads', async () => {
    mockGet.mockResolvedValue(state());
    await mount();
    expect(screen.getAllByRole('button', { name: /devices.nzxt-kraken.colorSlot/ })).toHaveLength(2);
  });

  it('shows the override notice only while Nexus drives the ring', async () => {
    mockGet.mockResolvedValue(state({ nexusDriven: true }));
    await mount();
    expect(screen.getByText('devices.galahad2Ring.overridden')).toBeTruthy();
  });

  it('disables the effect picker while Nexus drives the ring', async () => {
    mockGet.mockResolvedValue(state({ nexusDriven: true }));
    await mount();
    expect((screen.getByRole('button', { name: 'devices.fwAnimation.effect' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryAllByRole('button', { name: /devices.nzxt-kraken.colorSlot/ })).toHaveLength(0);
  });

  it('shows the override notice instead of a failure when a write is refused for it', async () => {
    mockGet.mockResolvedValueOnce(state());
    await mount();
    mockGet.mockResolvedValue(state({ nexusDriven: true }));
    mockSet.mockResolvedValue(null);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'devices.fwAnimation.effect' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: 'devices.galahad2Ring.meteor' }));
    });
    expect(screen.getByText('devices.galahad2Ring.overridden')).toBeTruthy();
    expect(screen.queryByText('devices.galahad2Ring.failed')).toBeNull();
  });

  it('writes the new effect at once with the color count it reads', async () => {
    mockGet.mockResolvedValue(state());
    await mount();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'devices.fwAnimation.effect' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: 'devices.galahad2Ring.meteor' }));
    });
    expect(mockSet).toHaveBeenCalledWith({
      effect: 'meteor',
      speed: 2,
      brightness: 4,
      colors: ['#112233', '#445566', '#ff0000', '#ff0000'],
    });
  });

  it('flags a failed write', async () => {
    mockGet.mockResolvedValue(state());
    mockSet.mockResolvedValue(null);
    await mount();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'devices.fwAnimation.effect' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: 'devices.galahad2Ring.rainbowMorph' }));
    });
    expect(screen.getByText('devices.galahad2Ring.failed')).toBeTruthy();
  });
});
