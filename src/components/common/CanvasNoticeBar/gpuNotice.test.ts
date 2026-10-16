import { describe, expect, it } from 'vitest';
import { canvasSoftwareFlag, gpuNotice } from './gpuNotice';

describe('gpuNotice', () => {
  it('says nothing once a context exists', () => {
    expect(gpuNotice('ready', true)).toBeNull();
  });

  it('separates a card that is still coming up from one that is missing', () => {
    // Both render black on the devices; only one is the user's to fix.
    expect(gpuNotice('initializing', false)).toEqual({ key: 'lighting.gpuInitializingNotice', tone: 'wait' });
    expect(gpuNotice('unavailable', false)).toEqual({ key: 'lighting.gpuUnavailableNotice', tone: 'fault' });
  });

  it('falls back to the boolean when the service predates gpuState', () => {
    expect(gpuNotice(undefined, false)?.key).toBe('lighting.gpuUnavailableNotice');
    expect(gpuNotice(undefined, true)).toBeNull();
    expect(gpuNotice(undefined, undefined)).toBeNull();
  });

  it('warns about CPU rendering only when the service reports software rendering', () => {
    expect(gpuNotice('ready', true, true)).toEqual({ key: 'lighting.gpuSoftwareNotice', tone: 'fault' });
    expect(gpuNotice('ready', true, false)).toBeNull();
    // Older services omit the field.
    expect(gpuNotice('ready', true, undefined)).toBeNull();
  });

  it('keeps the unavailable notice ahead of the software one', () => {
    expect(gpuNotice('unavailable', false, true)?.key).toBe('lighting.gpuUnavailableNotice');
  });

  it('suppresses the canvas notice when the user chose software', () => {
    expect(canvasSoftwareFlag(true, false)).toBe(true);
    expect(canvasSoftwareFlag(true, undefined)).toBe(true);
    expect(canvasSoftwareFlag(true, true)).toBe(false);
    expect(canvasSoftwareFlag(false, false)).toBe(false);
    expect(canvasSoftwareFlag(undefined, undefined)).toBe(false);
  });
});
