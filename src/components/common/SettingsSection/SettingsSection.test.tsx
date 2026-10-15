import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsSection } from './SettingsSection';

describe('SettingsSection disabled', () => {
  it('marks the box inert and aria-disabled, keeping the contents rendered', () => {
    render(<SettingsSection title="T" disabled><button type="button">go</button></SettingsSection>);
    const box = screen.getByRole('button', { name: 'go', hidden: true }).parentElement!;
    expect(box).toHaveAttribute('aria-disabled', 'true');
    expect(box.hasAttribute('inert')).toBe(true);
  });

  it('leaves the box interactive by default', () => {
    render(<SettingsSection title="T"><button type="button">go</button></SettingsSection>);
    const box = screen.getByRole('button', { name: 'go' }).parentElement!;
    expect(box.hasAttribute('aria-disabled')).toBe(false);
    expect(box.hasAttribute('inert')).toBe(false);
  });
});
