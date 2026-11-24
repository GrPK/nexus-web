import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LightingPageSwitch } from './LightingPageSwitch';
import { Notice } from '../../common/Notice/Notice';

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/** The setting row an element sits in: its nearest ancestor that holds a switch. */
function rowOf(el: HTMLElement): HTMLElement | null {
  let n: HTMLElement | null = el;
  while (n && !n.querySelector('[role="switch"]')) n = n.parentElement;
  return n;
}

describe('LightingPageSwitch', () => {
  it('always renders the link to the Lighting page so the row keeps its height', () => {
    const { rerender } = render(<LightingPageSwitch on={false} onChange={vi.fn()} onSectionNavigate={vi.fn()} />);
    const link = screen.getByText('smartLights.colorOnLightingPage');
    expect(link.closest('span[aria-hidden]')?.className).toContain('linkHidden');
    expect(screen.queryByRole('button', { name: 'smartLights.colorOnLightingPage' })).not.toBeInTheDocument();
    rerender(<LightingPageSwitch on onChange={vi.fn()} onSectionNavigate={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'smartLights.colorOnLightingPage' })).not.toBeDisabled();
  });

  it('opens the Lighting page from the link when on', () => {
    const navigate = vi.fn();
    render(<LightingPageSwitch on onChange={vi.fn()} onSectionNavigate={navigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'smartLights.colorOnLightingPage' }));
    expect(navigate).toHaveBeenCalledWith('lighting');
  });

  it('has no link without a navigator', () => {
    render(<LightingPageSwitch on onChange={vi.fn()} />);
    expect(screen.queryByText('smartLights.colorOnLightingPage')).not.toBeInTheDocument();
  });

  it('puts Sync mode on right after the label text, led by the warning icon', () => {
    render(<LightingPageSwitch on={false} onChange={vi.fn()} disabled controlledBySyncAll onSectionNavigate={vi.fn()} />);
    const pill = screen.getByText('devices.lianli-hub.syncActive');
    expect(pill.className).toContain('syncPill');
    // On the label's line, inside the label, ahead of the (hidden) Lighting page link.
    const label = screen.getByText('devices.lightingPage.use');
    expect(label).toContainElement(pill);
    expect(pill.compareDocumentPosition(screen.getByText('smartLights.colorOnLightingPage')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The warning notice's triangle, first, sized to the text.
    const icon = pill.firstElementChild;
    expect(icon?.tagName.toLowerCase()).toBe('svg');
    expect(icon).toHaveAttribute('width', '1em');
    const { container: notice } = render(<Notice tone="warning">x</Notice>);
    expect(icon?.innerHTML).toBe(notice.querySelector('svg')?.innerHTML);
    // The hint stays below the label.
    expect(label.parentElement).toHaveTextContent('devices.lightingPage.useHint');
  });

  it('under Sync all locks only the switch, so the row with its pill stays readable', () => {
    render(<LightingPageSwitch on={false} onChange={vi.fn()} disabled controlledBySyncAll />);
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(rowOf(screen.getByText('devices.lianli-hub.syncActive'))?.className).not.toContain('disabled');
  });

  it('dims a disabled row as before, with no pill, unless Sync all drives the light', () => {
    render(<LightingPageSwitch on={false} onChange={vi.fn()} disabled />);
    expect(screen.queryByText('devices.lianli-hub.syncActive')).not.toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(rowOf(screen.getByText('devices.lightingPage.use'))?.className).toContain('disabled');
  });
});
