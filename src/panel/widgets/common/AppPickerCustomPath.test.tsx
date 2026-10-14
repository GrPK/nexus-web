import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/useMultiplexSocket', () => ({ useTopicCallback: vi.fn() }));
vi.mock('../../../api/service', () => ({
  fetchService: vi.fn(),
  fetchServiceBlob: vi.fn(),
}));

import { AppPicker } from './AppPicker';
import { fetchService, fetchServiceBlob } from '../../../api/service';

const SHORTCUTS = { shortcuts: [{ id: 'com.example.chrome', name: 'Google Chrome', path: '/c/chrome.exe', processName: 'chrome' }] };
const search = () => screen.getByPlaceholderText('panel.settings.searchApps');

describe('AppPicker custom launch path', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fetchService).mockResolvedValue(SHORTCUTS);
    vi.mocked(fetchServiceBlob).mockResolvedValue(null);
    globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof IntersectionObserver;
  });

  it('offers a use-this-path row for typed paths and selects it', async () => {
    const onUse = vi.fn();
    render(<AppPicker onSelect={vi.fn()} customPath={{ onUse }} />);
    await screen.findByText('Google Chrome');
    fireEvent.change(search(), { target: { value: '"C:\\Games\\OnceHuman\\launcher.exe"' } });
    fireEvent.click(screen.getByText('panel.settings.useThisPath'));
    expect(onUse).toHaveBeenCalledWith('C:\\Games\\OnceHuman\\launcher.exe');
  });

  it('accepts a URI and does not offer plain search text', async () => {
    const onUse = vi.fn();
    render(<AppPicker onSelect={vi.fn()} customPath={{ onUse }} />);
    await screen.findByText('Google Chrome');
    fireEvent.change(search(), { target: { value: 'chrome' } });
    expect(screen.queryByText('panel.settings.useThisPath')).toBeNull();
    fireEvent.change(search(), { target: { value: 'steam://rungameid/2139460' } });
    fireEvent.click(screen.getByText('panel.settings.useThisPath'));
    expect(onUse).toHaveBeenCalledWith('steam://rungameid/2139460');
  });

  it('rejects UNC paths and other URI schemes with a warning', async () => {
    const onUse = vi.fn();
    render(<AppPicker onSelect={vi.fn()} customPath={{ onUse }} />);
    await screen.findByText('Google Chrome');
    for (const v of ['\\\\host\\share\\a.exe', 'ftp://example.com/a', 'file:///C:/a.exe']) {
      fireEvent.change(search(), { target: { value: v } });
      expect(screen.queryByText('panel.settings.useThisPath')).toBeNull();
      expect(screen.getByRole('status').textContent).toBe('panel.settings.unsupportedLaunchPath');
    }
    expect(onUse).not.toHaveBeenCalled();
  });

  it('never offers typed paths without onUse (locked)', async () => {
    render(<AppPicker onSelect={vi.fn()} customPath={{}} />);
    await screen.findByText('Google Chrome');
    fireEvent.change(search(), { target: { value: 'C:\\x\\y.exe' } });
    expect(screen.queryByText('panel.settings.useThisPath')).toBeNull();
  });

  it('never offers typed paths for callers that did not opt in', async () => {
    render(<AppPicker onSelect={vi.fn()} />);
    await screen.findByText('Google Chrome');
    fireEvent.change(search(), { target: { value: 'C:\\x\\y.exe' } });
    expect(screen.queryByText('panel.settings.useThisPath')).toBeNull();
  });

  it('shows a stored custom path as selected by file name, even when locked', async () => {
    render(<AppPicker selectedId="C:\Games\OnceHuman\launcher.exe" onSelect={vi.fn()} customPath={{}} />);
    const row = (await screen.findByText('launcher.exe')).closest('button')!;
    expect(row.className).toMatch(/appRowSelected/);
  });

  it('applies a launchable Browse result and rejects a UNC one with the same notice', async () => {
    const onUse = vi.fn();
    const onBrowse = vi.fn().mockResolvedValueOnce('C:\\a\\b.exe').mockResolvedValueOnce('\\\\nas\\share\\a.exe');
    render(<AppPicker onSelect={vi.fn()} customPath={{ onUse, onBrowse }} />);
    await screen.findByText('Google Chrome');
    fireEvent.click(screen.getByText('panel.settings.deck.browse'));
    await waitFor(() => expect(onUse).toHaveBeenCalledWith('C:\\a\\b.exe'));
    fireEvent.click(screen.getByText('panel.settings.deck.browse'));
    await screen.findByRole('status');
    expect(onUse).toHaveBeenCalledTimes(1);
  });

  it('does not show a stored listed-style id as a custom row when the list failed to load', async () => {
    vi.mocked(fetchService).mockResolvedValue(null);
    render(<AppPicker selectedId="Pkg.Name!App" onSelect={vi.fn()} customPath={{}} />);
    await screen.findByText('panel.settings.connectForApps');
    expect(screen.queryByText('Pkg.Name!App')).toBeNull();
  });

  it('renders Browse only when onBrowse is given', async () => {
    const onBrowse = vi.fn();
    const { rerender } = render(<AppPicker onSelect={vi.fn()} customPath={{}} />);
    await screen.findByText('Google Chrome');
    expect(screen.queryByText('panel.settings.deck.browse')).toBeNull();
    rerender(<AppPicker onSelect={vi.fn()} customPath={{ onBrowse }} />);
    fireEvent.click(screen.getByText('panel.settings.deck.browse'));
    expect(onBrowse).toHaveBeenCalled();
  });
});
