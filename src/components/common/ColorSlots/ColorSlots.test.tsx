import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorSlots } from './ColorSlots';

const label = (i: number) => `Color ${i + 1}`;
const COLORS = ['#000000', '#ff0000', '#00ff00'];

function mount(activeIndex = 0, onSelect: (i: number) => void = () => {}) {
  render(<ColorSlots colors={COLORS} activeIndex={activeIndex} onSelect={onSelect} slotLabel={label} />);
  return (i: number) => screen.getByRole('radio', { name: label(i) });
}

describe('ColorSlots', () => {
  it('marks the active slot and selects on click', () => {
    const onSelect = vi.fn();
    const slot = mount(1, onSelect);
    expect(slot(1)).toHaveAttribute('aria-checked', 'true');
    expect(slot(0)).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(slot(0));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('keeps one tab stop, on the active slot', () => {
    const slot = mount(2);
    expect([0, 1, 2].map(i => slot(i).tabIndex)).toEqual([-1, -1, 0]);
  });

  it('falls back to the first slot as the tab stop when the active index is out of range', () => {
    const slot = mount(7);
    expect([0, 1, 2].map(i => slot(i).tabIndex)).toEqual([0, -1, -1]);
  });

  it('moves focus forward and wraps past the last slot', () => {
    const slot = mount(0);
    slot(2).focus();
    fireEvent.keyDown(slot(2), { key: 'ArrowRight' });
    expect(slot(0)).toHaveFocus();
    fireEvent.keyDown(slot(0), { key: 'ArrowDown' });
    expect(slot(1)).toHaveFocus();
  });

  it('moves focus backward and wraps before the first slot', () => {
    const slot = mount(0);
    slot(0).focus();
    fireEvent.keyDown(slot(0), { key: 'ArrowLeft' });
    expect(slot(2)).toHaveFocus();
    fireEvent.keyDown(slot(2), { key: 'ArrowUp' });
    expect(slot(1)).toHaveFocus();
  });
});
