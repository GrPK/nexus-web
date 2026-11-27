import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UnifiedDevice } from '../../../hooks/useUnifiedDevices';
import { LogitechHubPage } from './LogitechHubPage';

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));
// Each mocked page shows the switcher in its tab row, as the real ones do.
vi.mock('./LogitechMouseDevicePage', async () => {
  const { useContext } = await import('react');
  const { DeviceSwitcherContext } = await import('./logitechHubContext');
  function LogitechMouseDevicePage() {
    return <div><span>mouse page</span>{useContext(DeviceSwitcherContext)}</div>;
  }
  return { LogitechMouseDevicePage };
});
vi.mock('./LogitechKeyboardDevicePage', async () => {
  const { useContext } = await import('react');
  const { DeviceSwitcherContext } = await import('./logitechHubContext');
  function LogitechKeyboardDevicePage() {
    return <div><span>keyboard page</span>{useContext(DeviceSwitcherContext)}</div>;
  }
  return { LogitechKeyboardDevicePage };
});
vi.mock('./LogitechSpeakerDevicePage', async () => {
  const { useContext } = await import('react');
  const { DeviceSwitcherContext } = await import('./logitechHubContext');
  function LogitechSpeakerDevicePage() {
    return <div><span>speaker page</span>{useContext(DeviceSwitcherContext)}</div>;
  }
  return { LogitechSpeakerDevicePage };
});

const member = (id: string, shortName: string) => ({
  key: `curated-${id}`,
  curatedId: id,
  shortName,
  name: shortName,
  subtitle: 'mouse',
  category: 'mouse',
  iconSrc: '/assets/devices/logitech.svg',
  connected: true,
  kind: 'curated',
  navigable: true,
  nexusControlEnabled: true,
  supportsNexusControl: true,
  experimental: true,
  requiresBeta: false,
  groupKey: 'logitech',
}) as UnifiedDevice;

describe('LogitechHubPage', () => {
  it('shows a tab per Logitech device, named without the brand, and opens its whole page', () => {
    render(<LogitechHubPage members={[member('logitech-speaker', 'Logitech G560'), member('logitech-mouse', 'Logitech G502 X PLUS')]} />);

    // The mouse comes first, as in G HUB.
    expect(screen.getByText('mouse page')).toBeTruthy();
    expect(screen.queryByText('speaker page')).toBeNull();
    expect(screen.queryByText('Logitech G560')).toBeNull();

    fireEvent.click(screen.getByText('G560'));
    expect(screen.getByText('speaker page')).toBeTruthy();
    expect(screen.queryByText('mouse page')).toBeNull();
  });

  it('has no tab for a device that is not connected', () => {
    render(<LogitechHubPage members={[member('logitech-keyboard', 'Logitech G915 X'), member('logitech-speaker', 'Logitech G560')]} />);
    expect(screen.queryByText('G502 X PLUS')).toBeNull();
    expect(screen.getByText('keyboard page')).toBeTruthy();
  });
});
