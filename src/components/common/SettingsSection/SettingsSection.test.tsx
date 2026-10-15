import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsSection } from './SettingsSection';

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
