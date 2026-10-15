import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OnboardingNote } from './OnboardingNote';

describe('OnboardingNote', () => {
  it('renders its text as a paragraph with an optional extra class', () => {
    render(<OnboardingNote className="extra">Change this any time</OnboardingNote>);
    const el = screen.getByText('Change this any time');
    expect(el.tagName).toBe('P');
    expect(el.className).toContain('extra');
  });
});
