import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { InfoTooltip } from './InfoTooltip';
import { TOOLTIP_OPEN_DELAY_MS } from '../tooltipDelay';

// Rendered outside I18nProvider, so t() falls back to raw keys.

// The sequence Chromium fires for one tap: the compatibility mousedown focuses the button before the click.
function tap(el: Element) {
  fireEvent.pointerDown(el, { pointerType: 'touch' });
  fireEvent.pointerUp(el, { pointerType: 'touch' });
  fireEvent.mouseDown(el);
  fireEvent.focus(el);
  fireEvent.mouseUp(el);
  fireEvent.click(el);
}

describe('InfoTooltip', () => {
  it('a tap opens the tooltip and a second tap closes it', () => {
    render(<InfoTooltip message="Hello" ariaLabel="Info" />);
    const btn = screen.getByRole('button', { name: 'Info' });
    tap(btn);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Hello');
    tap(btn);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('keyboard focus opens the tooltip', () => {
    render(<InfoTooltip message="Hello" ariaLabel="Info" />);
    fireEvent.focus(screen.getByRole('button', { name: 'Info' }));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('keyboard focus still opens the tooltip after a touch that was cancelled', () => {
    render(<InfoTooltip message="Hello" ariaLabel="Info" />);
    const btn = screen.getByRole('button', { name: 'Info' });
    fireEvent.pointerDown(btn, { pointerType: 'touch' });
    fireEvent.pointerCancel(btn, { pointerType: 'touch' });
    fireEvent.focus(btn);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('mouse hover opens the tooltip after its delay', () => {
    vi.useFakeTimers();
    try {
      render(<InfoTooltip message="Hello" ariaLabel="Info" />);
      fireEvent.pointerEnter(screen.getByRole('button', { name: 'Info' }), { pointerType: 'mouse' });
      act(() => { vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY_MS); });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Escape closes an open tooltip', () => {
    render(<InfoTooltip message="Hello" ariaLabel="Info" />);
    fireEvent.focus(screen.getByRole('button', { name: 'Info' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  describe('action', () => {
    it('renders no button unless an action is passed', () => {
      render(<InfoTooltip message="Hello" ariaLabel="Info" />);
      fireEvent.focus(screen.getByRole('button', { name: 'Info' }));
      expect(within(screen.getByRole('tooltip')).queryByRole('button')).toBeNull();
    });

    it('renders the action and fires it on click, closing the bubble', () => {
      const onClick = vi.fn();
      render(<InfoTooltip message="Hello" ariaLabel="Info" action={{ label: 'Remove', onClick }} />);
      fireEvent.focus(screen.getByRole('button', { name: 'Info' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Hello')).toBeNull();
    });

    it('stays open while the pointer travels from the icon into the bubble', () => {
      vi.useFakeTimers();
      try {
        render(<InfoTooltip message="Hello" ariaLabel="Info" action={{ label: 'Remove', onClick: () => {} }} />);
        const icon = screen.getByRole('button', { name: 'Info' });
        fireEvent.pointerEnter(icon, { pointerType: 'mouse' });
        act(() => { vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY_MS); });
        fireEvent.pointerLeave(icon, { pointerType: 'mouse' });
        const bubble = () => screen.getByText('Hello').parentElement!;
        fireEvent.pointerEnter(bubble(), { pointerType: 'mouse' });
        act(() => { vi.advanceTimersByTime(500); });
        expect(screen.getByText('Hello')).toBeInTheDocument();
        fireEvent.pointerLeave(bubble(), { pointerType: 'mouse' });
        act(() => { vi.advanceTimersByTime(500); });
        expect(screen.queryByText('Hello')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('moves focus from the icon to the action on Tab, and back on Shift+Tab', () => {
      render(<InfoTooltip message="Hello" ariaLabel="Info" action={{ label: 'Remove', onClick: () => {} }} />);
      const icon = screen.getByRole('button', { name: 'Info' });
      icon.focus();
      fireEvent.focus(icon);
      fireEvent.keyDown(icon, { key: 'Tab' });
      const action = screen.getByRole('button', { name: 'Remove' });
      expect(action).toHaveFocus();
      fireEvent.keyDown(action, { key: 'Tab', shiftKey: true });
      expect(icon).toHaveFocus();
    });

    it('a tap opens the bubble and it stays open until an outside press', () => {
      render(<InfoTooltip message="Hello" ariaLabel="Info" action={{ label: 'Remove', onClick: () => {} }} />);
      tap(screen.getByRole('button', { name: 'Info' }));
      expect(screen.getByText('Hello')).toBeInTheDocument();
      fireEvent.mouseDown(document.body);
      expect(screen.queryByText('Hello')).toBeNull();
    });

    it('is not a tooltip role, so the button is announced as a button', () => {
      render(<InfoTooltip message="Hello" ariaLabel="Info" action={{ label: 'Remove', onClick: () => {} }} />);
      fireEvent.focus(screen.getByRole('button', { name: 'Info' }));
      expect(screen.queryByRole('tooltip')).toBeNull();
      expect(screen.getByRole('button', { name: 'Info' })).toHaveAttribute('aria-describedby', screen.getByText('Hello').id);
    });

    it('Escape with the action focused closes the bubble and returns focus to the icon', () => {
      render(<InfoTooltip message="Hello" ariaLabel="Info" action={{ label: 'Remove', onClick: () => {} }} />);
      const icon = screen.getByRole('button', { name: 'Info' });
      icon.focus();
      fireEvent.focus(icon);
      fireEvent.keyDown(icon, { key: 'Tab' });
      expect(screen.getByRole('button', { name: 'Remove' })).toHaveFocus();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByText('Hello')).toBeNull();
      expect(icon).toHaveFocus();
    });
  });
});
