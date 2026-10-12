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

  it('announces mixed and a click sets all on', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} mixed ariaLabel="Power" onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Power' });
    expect(sw).toHaveAttribute('aria-checked', 'mixed');
    expect(sw).toHaveAttribute('data-on', 'mixed');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
