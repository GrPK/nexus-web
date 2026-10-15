import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsBlock, SettingsSection } from './SettingsSection';
import styles from './SettingsSection.module.scss';

// The gap below a section is CSS (jsdom applies none), so it is verified by
// measuring a real render, not here. These tests pin the slots the component
// owns inside the section, so the enforced gap always follows them.
describe('SettingsSection slots', () => {
  it('renders footer then footnote inside the section, after the box', () => {
    const { container } = render(
      <SettingsSection title="Levels" footer={<button type="button">Manage</button>} footnote="Short note">
        <div>row</div>
      </SettingsSection>,
    );
    const section = container.querySelector('section');
    const kids = Array.from(section?.children ?? []);
    expect(section?.contains(screen.getByText('Short note'))).toBe(true);
    expect(kids[kids.length - 1]).toBe(screen.getByText('Short note'));
    expect(kids[kids.length - 2]?.contains(screen.getByRole('button', { name: 'Manage' }))).toBe(true);
  });

  it('omits the slots when they are empty', () => {
    const { container } = render(
      <SettingsSection title="Levels" footer={undefined} footnote="">
        <div>row</div>
      </SettingsSection>,
    );
    expect(container.querySelector('section')?.children).toHaveLength(2);
  });
});

// jsdom applies no CSS, so the always-on gap is guarded on the stylesheet source.
describe('SettingsSection gap', () => {
  const css = readFileSync(join(__dirname, 'SettingsSection.module.scss'), 'utf8');
  const rule = (name: string) => new RegExp(`\\.${name}\\s*\\{[^}]*margin-bottom:\\s*var\\(--space-[a-z]+\\)`);

  it('puts a token margin-bottom on the section and the block', () => {
    expect(css).toMatch(rule('section'));
    expect(css).toMatch(rule('block'));
  });

  it('wraps a non-section child in the block class', () => {
    const { container } = render(<SettingsBlock><span>note</span></SettingsBlock>);
    expect(container.firstElementChild?.className).toBe(styles.block);
  });
});
