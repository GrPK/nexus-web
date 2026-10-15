import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsBlock, SettingsSection } from './SettingsSection';
import styles from './SettingsSection.module.scss';

describe('SettingsSection pillarOff', () => {
  it('swaps the rows for one notice that carries the hidden rows\' search anchors', () => {
    render(
      <SettingsSection title="T" pillarOff={{ message: 'Turn it on', anchors: ['a', 'b'] }}>
        <button type="button">go</button>
      </SettingsSection>,
    );
    expect(screen.queryByRole('button', { name: 'go' })).toBeNull();
    const notice = screen.getByText('Turn it on').closest('[data-search-fallback]');
    expect(notice?.getAttribute('data-search-fallback')).toBe('a b');
  });

  it('renders the rows when the pillar is on', () => {
    render(<SettingsSection title="T"><button type="button">go</button></SettingsSection>);
    expect(screen.getByRole('button', { name: 'go' })).toBeInTheDocument();
  });
});

// The gap below a section is CSS (jsdom applies none), so it is verified by
// measuring a real render, not here. These tests pin the slots the component
// owns inside the section, so the enforced gap always follows them.
describe('SettingsSection slots', () => {
  it('renders the description in the header before the box, and the footer after it', () => {
    const { container } = render(
      <SettingsSection title="Levels" description="Short intro" footer={<button type="button">Manage</button>}>
        <div>row</div>
      </SettingsSection>,
    );
    const kids = Array.from(container.querySelector('section')?.children ?? []);
    expect(kids).toHaveLength(3);
    expect(kids[0]?.contains(screen.getByText('Short intro'))).toBe(true);
    expect(kids[1]?.contains(screen.getByText('Short intro'))).toBe(false);
    expect(kids[2]?.contains(screen.getByRole('button', { name: 'Manage' }))).toBe(true);
  });

  it('omits the slots when they are empty', () => {
    const { container } = render(
      <SettingsSection title="Levels" footer={undefined}>
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
