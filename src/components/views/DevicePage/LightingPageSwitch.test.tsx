import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LightingPageSwitch } from './LightingPageSwitch';

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

  it('shows Follows Sync all as a pill in its own row, centred between the label and the switch', () => {
    render(<LightingPageSwitch on={false} onChange={vi.fn()} disabled followsSyncAll />);
    const pill = screen.getByText('devices.lianli-hub.followsSyncAll');
    expect(pill.className).toContain('syncPill');
    expect(pill.parentElement?.className).toContain('centerBadge');
    const row = rowOf(pill);
    expect(row).toContainElement(screen.getByText('devices.lightingPage.use'));
    // The pill sits between the label block and the switch.
    expect(screen.getByText('devices.lightingPage.use').compareDocumentPosition(pill) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pill.compareDocumentPosition(screen.getByRole('switch')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // A disabled row dims its label and switch, not the pill.
    expect(row?.className).toContain('hasCenterBadge');
    expect(row?.className).toContain('disabled');
  });

  it('has no pill unless Sync all drives the light', () => {
    render(<LightingPageSwitch on={false} onChange={vi.fn()} />);
    expect(screen.queryByText('devices.lianli-hub.followsSyncAll')).not.toBeInTheDocument();
  });
});
