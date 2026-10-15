// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CONTROL_CENTER_BAND_MM,
  controlCenterBandPx,
  controlCenterGestureEnabled,
  inControlCenterBand,
  oppositeThemeMode,
  resolveSwipeRelease,
  type ControlCenterGateInput,
} from './controlCenterGesture';

const base: ControlCenterGateInput = {
  surface: 'y70',
  deviceTouch: true,
  kioskBehavior: true,
  immersiveOpen: false,
  sheetOpen: false,
  trayOpen: false,
  offline: false,
  rearranging: false,
  dragArmed: false,
  asleep: false,
};

describe('control center band', () => {
  it('sizes the band in millimeters plus the safe-area inset', () => {
    expect(controlCenterBandPx(10, 0)).toBe(CONTROL_CENTER_BAND_MM * 10);
    expect(controlCenterBandPx(10, 20)).toBe(CONTROL_CENTER_BAND_MM * 10 + 20);
    expect(controlCenterBandPx(10, -5)).toBe(CONTROL_CENTER_BAND_MM * 10);
  });

  it('arms a touch that lands a few px below the top and rejects one below the band', () => {
    const band = controlCenterBandPx(10, 0);
    expect(inControlCenterBand(0, band)).toBe(true);
    expect(inControlCenterBand(6, band)).toBe(true);
    expect(inControlCenterBand(band, band)).toBe(true);
    expect(inControlCenterBand(band + 1, band)).toBe(false);
    expect(inControlCenterBand(-1, band)).toBe(false);
  });
});

describe('controlCenterGestureEnabled', () => {
  it('is on for the Y70 and for a touch monitor', () => {
    expect(controlCenterGestureEnabled(base)).toBe(true);
    expect(controlCenterGestureEnabled({ ...base, surface: 'monitor', deviceTouch: true })).toBe(true);
  });

  it('is off for the paired phone, a monitor without touch, and display-only glass', () => {
    expect(controlCenterGestureEnabled({ ...base, surface: 'phone' })).toBe(false);
    expect(controlCenterGestureEnabled({ ...base, surface: 'monitor', deviceTouch: false })).toBe(false);
    expect(controlCenterGestureEnabled({ ...base, surface: 'q60' })).toBe(false);
  });

  it('is off outside a kiosk and while immersive, a sheet, the tray, offline, rearranging, drag-armed or asleep', () => {
    for (const patch of [
      { kioskBehavior: false }, { immersiveOpen: true }, { sheetOpen: true }, { trayOpen: true },
      { offline: true }, { rearranging: true }, { dragArmed: true }, { asleep: true },
    ]) {
      expect(controlCenterGestureEnabled({ ...base, ...patch })).toBe(false);
    }
  });
});

describe('resolveSwipeRelease', () => {
  it('commits on distance or on a flick, otherwise springs back', () => {
    expect(resolveSwipeRelease(120, 0, 100, 1)).toBe('commit');
    expect(resolveSwipeRelease(40, 2, 100, 1)).toBe('commit');
    expect(resolveSwipeRelease(40, 0.5, 100, 1)).toBe('cancel');
    expect(resolveSwipeRelease(100, 0, 100, 1)).toBe('cancel');
  });
});

describe('oppositeThemeMode', () => {
  it('flips what is showing', () => {
    expect(oppositeThemeMode('dark')).toBe('light');
    expect(oppositeThemeMode('light')).toBe('dark');
  });
});
