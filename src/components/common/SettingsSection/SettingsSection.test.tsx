import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsSection } from './SettingsSection';

// The gap below a section is CSS (jsdom applies none), so it is verified by
// measuring a real render, not here. These tests pin the slots the component
// owns inside the section, so the enforced gap always follows them.
describe('SettingsSection slots', () => {
  it('renders actions then footnote inside the section, after the box', () => {
    const { container } = render(
      <SettingsSection title="Levels" actions={<button type="button">Manage</button>} footnote="Short note">
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
      <SettingsSection title="Levels" actions={undefined} footnote="">
        <div>row</div>
      </SettingsSection>,
    );
    expect(container.querySelector('section')?.children).toHaveLength(2);
  });
});
