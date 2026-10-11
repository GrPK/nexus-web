import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceLedStrip } from './DeviceLedStrip';
import { clearLedFrame, publishLedFrame } from '../../../../lib/ledFrameStore';
import type { LightingDevice } from '../../../../api/lighting';

vi.mock('../../../../hooks/useEffectThumbnail', () => ({
  useEffectThumbnail: () => null,
}));

// jsdom ships no canvas backend, so the draw calls are the observable
// behaviour: putImageData means "sampled the shared frame", fillRect means
// "painted this device's own colour", clearRect alone means "showed nothing".
const ctx = {
  fillStyle: '', globalAlpha: 1, imageSmoothingEnabled: true,
  fillRect: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(),
  putImageData: vi.fn(),
  createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
};

const device: LightingDevice = {
  id: 'a', name: 'Strip', ledsOn: true, ledCount: 4,
  canvasX: 0, canvasY: 0, canvasW: 1000, canvasH: 600, canvasRotation: 0,
};

function publishRed() {
  const px = new Uint8Array(3 * 4);
  for (let i = 0; i < 4; i++) px[i * 3] = 255;
  publishLedFrame(px, 2, 2);
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
  ctx.fillRect.mockClear();
  ctx.clearRect.mockClear();
  ctx.putImageData.mockClear();
});
afterEach(() => { clearLedFrame(); vi.restoreAllMocks(); });

describe('DeviceLedStrip', () => {
  it('samples the shared canvas by default', () => {
    publishRed();
    render(<DeviceLedStrip device={device} fullscreen />);
    expect(ctx.putImageData).toHaveBeenCalled();
  });

  // Static assigns per device: a card with no assignment of its own is showing
  // nothing in particular. The shared frame is retained at module scope, so
  // sampling it would paint a colour the device is not wearing - and frozen,
  // since a per-device surface publishes no further frames.
  it('stays blank with no pick when the surface is per-device', () => {
    publishRed();
    render(<DeviceLedStrip device={device} fullscreen pickOnly />);
    expect(ctx.putImageData).not.toHaveBeenCalled();
    expect(ctx.clearRect).toHaveBeenCalled();
  });

  it('still paints the device its own pick when there is one', () => {
    publishRed();
    const pick = { key: 'flat:blue-3', hex: '#0000ff', slot: 0, version: '1' };
    render(<DeviceLedStrip device={device} fullscreen pickOnly pick={pick} />);
    expect(ctx.putImageData).not.toHaveBeenCalled();
    expect(ctx.fillStyle).toBe('#0000ff');
  });

  describe('live device bytes (animation-locked)', () => {
    const locked: LightingDevice = { ...device, frameIndex: 7 };
    // 4 LEDs: red, green, blue, white.
    const bytes = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
    const lastImage = () => ctx.putImageData.mock.calls.at(-1)![0].data as Uint8ClampedArray;

    it('paints the strip from the device bytes in LED order', () => {
      publishLedFrame(new Uint8Array(3 * 4), 2, 2, new Map([[7, bytes]]));
      render(<DeviceLedStrip device={locked} live />);
      expect([...lastImage()]).toEqual([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
    });

    it('applies the device brightness', () => {
      publishLedFrame(null, 0, 0, new Map([[7, bytes]]));
      render(<DeviceLedStrip device={{ ...locked, brightness: 50 }} live />);
      expect(lastImage()[0]).toBe(128);
    });

    it('falls back to sampling the canvas when the frame has no bytes for it', () => {
      publishRed();
      render(<DeviceLedStrip device={locked} live />);
      expect([...lastImage().slice(0, 4)]).toEqual([255, 0, 0, 255]);
    });

    it('falls back when the device has no frame index', () => {
      publishLedFrame(new Uint8Array(3 * 4).fill(9), 2, 2, new Map([[7, bytes]]));
      render(<DeviceLedStrip device={device} live />);
      expect([...lastImage().slice(0, 3)]).toEqual([9, 9, 9]);
    });

    it('leaves an unlocked device on the canvas even when bytes exist', () => {
      publishLedFrame(new Uint8Array(3 * 4).fill(9), 2, 2, new Map([[7, bytes]]));
      render(<DeviceLedStrip device={locked} />);
      expect([...lastImage().slice(0, 3)]).toEqual([9, 9, 9]);
    });
  });
});
