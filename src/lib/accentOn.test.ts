// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { deriveAccentOnVars, deriveAccentVars } from './settings';

// The "on" state of a toggle must stand out from the control surface on any accent.
describe('accent on-state fill', () => {
  it('keeps the accent when it contrasts with the surface', () => {
    const dark = deriveAccentOnVars('#2563eb', 'dark');
    expect(dark['--accent-on']).toBe(deriveAccentVars('#2563eb', 'dark')['--accent']);
    expect(dark['--accent-on-text']).toBe(deriveAccentVars('#2563eb', 'dark')['--accent-text']);
    const light = deriveAccentOnVars('#242324', 'light');
    expect(light['--accent-on']).toBe(deriveAccentVars('#242324', 'light')['--accent']);
  });

  it('falls back to the theme foreground when a near-black accent would vanish in dark theme', () => {
    const v = deriveAccentOnVars('#242324', 'dark');
    expect(v['--accent-on']).toBe('#f5f5f5');
    expect(v['--accent-on-text']).toBe('#111111');
  });

  it('falls back to the dark foreground when a near-white accent would vanish in light theme', () => {
    const v = deriveAccentOnVars('#f2f2f2', 'light');
    expect(v['--accent-on']).toBe('#1a1a2e');
    expect(v['--accent-on-text']).toBe('#ffffff');
  });

  it('a mid-gray accent takes the fallback in both themes', () => {
    expect(deriveAccentOnVars('#777777', 'dark')['--accent-on']).toBe('#f5f5f5');
    expect(deriveAccentOnVars('#777777', 'light')['--accent-on']).toBe('#1a1a2e');
  });
});
