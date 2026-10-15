import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsSection } from './SettingsSection';

describe('SettingsSection', () => {
  it('renders the footnote inside the section, after the box', () => {
    const { container } = render(
      <SettingsSection title="Levels" footnote="Short note">
        <div>row</div>
      </SettingsSection>,
    );
    const section = container.querySelector('section');
    const note = screen.getByText('Short note');
    expect(section?.contains(note)).toBe(true);
    expect(section?.lastElementChild).toBe(note);
  });

  it('omits the footnote element when none is given', () => {
    const { container } = render(
      <SettingsSection title="Levels">
        <div>row</div>
      </SettingsSection>,
    );
    expect(container.querySelector('section')?.children).toHaveLength(2);
  });
});

// jsdom does not apply CSS modules, so the spacing rule is asserted on the
// stylesheet source: the enforced bottom gap must exist, use a spacing token,
// and exceed the title-to-box gap.
describe('SettingsSection spacing rule', () => {
  const css = readFileSync(join(__dirname, 'SettingsSection.module.scss'), 'utf8');

  it('adds a tokenized bottom gap to every section that is not the last child', () => {
    expect(css).toMatch(/&:not\(:last-child\)\s*\{\s*margin-bottom:\s*var\(--space-xl\);/);
  });

  it('keeps the title-to-box gap smaller than the bottom gap', () => {
    const inner = /\.section\s*\{[^}]*?\bgap:\s*([\d.]+)rem/.exec(css);
    expect(inner).not.toBeNull();
    // --space-xl is 24px; 1rem is 16px.
    expect(Number(inner![1]) * 16).toBeLessThan(24);
  });
});
