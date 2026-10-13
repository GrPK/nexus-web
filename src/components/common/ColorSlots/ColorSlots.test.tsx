import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorSlots } from './ColorSlots';

const label = (i: number) => `Color ${i + 1}`;

describe('ColorSlots', () => {
  it('marks the active slot and selects on click', () => {
    const onSelect = vi.fn();
    render(<ColorSlots colors={['#000000', '#ff0000']} activeIndex={1} onSelect={onSelect} slotLabel={label} />);
    expect(screen.getByRole('radio', { name: 'Color 2' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Color 1' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('radio', { name: 'Color 1' }));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('moves focus with the arrow keys', () => {
    render(<ColorSlots colors={['#000000', '#ff0000']} activeIndex={0} onSelect={() => {}} slotLabel={label} />);
    const first = screen.getByRole('radio', { name: 'Color 1' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Color 2' })).toHaveFocus();
  });
});
