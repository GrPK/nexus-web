import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('flips its checked state on click', () => {
    const onChange = vi.fn();
    render(<Toggle checked ariaLabel="Power" onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Power' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('announces mixed as a checkbox, not a switch, and a click sets all on', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} mixed ariaLabel="Power" onChange={onChange} />);
    // aria-checked="mixed" is invalid on a switch (read as off), so the role changes with it.
    expect(screen.queryByRole('switch')).toBeNull();
    const sw = screen.getByRole('checkbox', { name: 'Power' });
    expect(sw).toHaveAttribute('aria-checked', 'mixed');
    expect(sw).toHaveAttribute('data-on', 'mixed');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
