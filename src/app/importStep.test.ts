import { describe, expect, it } from 'vitest';
import { importStepOffered } from './importStep';

describe('importStepOffered', () => {
  it('offers FanControl while Cooling is on', () => {
    expect(importStepOffered(false, true, true)).toBe(true);
  });

  it('skips the step when only FanControl remains and Cooling is off', () => {
    expect(importStepOffered(false, true, false)).toBe(false);
  });

  it('keeps the step for Nexus 2 whatever the pillars', () => {
    expect(importStepOffered(true, true, false)).toBe(true);
  });

  it('skips the step when nothing is pending', () => {
    expect(importStepOffered(false, false, true)).toBe(false);
  });
});
