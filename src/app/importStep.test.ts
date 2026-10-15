import { describe, expect, it } from 'vitest';
import { importStepOffered } from './importStep';

describe('importStepOffered', () => {
  it('offers FanControl while Cooling is on', () => {
    expect(importStepOffered(false, true, true, true)).toBe(true);
  });

  it('skips the step when only FanControl remains and Cooling is off', () => {
    expect(importStepOffered(false, true, true, false)).toBe(false);
  });

  it('keeps the step for Nexus 2 content outside the fan curves with Cooling off', () => {
    expect(importStepOffered(true, true, true, false)).toBe(true);
  });

  it('skips the step when Nexus 2 holds only fan curves and Cooling is off', () => {
    expect(importStepOffered(true, false, false, false)).toBe(false);
  });

  it('offers Nexus 2 with Cooling on whatever it holds', () => {
    expect(importStepOffered(true, false, false, true)).toBe(true);
  });

  it('skips the step when nothing is pending', () => {
    expect(importStepOffered(false, true, false, true)).toBe(false);
  });
});
