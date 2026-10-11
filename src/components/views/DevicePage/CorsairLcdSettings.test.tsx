import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CorsairLcdSettings } from './CorsairLcdSettings';

/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockState = vi.fn();
const mockMedia = vi.fn();
const mockSetScreen = vi.fn();
const mockUpload = vi.fn();

vi.mock('../../../api/corsair-lcd', () => ({
  getCorsairLcdState: (...a: any[]) => mockState(...a),
  getCorsairLcdMedia: (...a: any[]) => mockMedia(...a),
  setCorsairDeviceScreen: (...a: any[]) => mockSetScreen(...a),
  setCorsairLcd: vi.fn(),
  uploadCorsairLcdMedia: (...a: any[]) => mockUpload(...a),
}));

const base = { hasDevice: true, selectedMediaId: null, brightness: 50, rotation: 0, deviceMediaId: null };

beforeEach(() => {
  mockState.mockReset().mockResolvedValue(base);
  mockMedia.mockReset().mockResolvedValue({ items: [{ id: 'a1', name: 'Fire', type: 'animated' }] });
  mockSetScreen.mockReset().mockResolvedValue(null);
  mockUpload.mockReset();
});

async function renderSettings() {
  await act(async () => {
    render(<CorsairLcdSettings />);
  });
}

async function pick(label: string) {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'devices.corsair.deviceScreenLabel' })); });
  await act(async () => { fireEvent.click(screen.getByRole('option', { name: label })); });
}

describe('CorsairLcdSettings closed-screen setting', () => {
  it('lists the coolant screen and library items', async () => {
    await renderSettings();
    expect(screen.getByText('devices.corsair.deviceScreenSection')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'devices.corsair.deviceScreenLabel' })); });
    expect(screen.getByRole('option', { name: 'devices.corsair.deviceScreenCoolant' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Fire' })).toBeInTheDocument();
  });

  it('applies a library item immediately', async () => {
    await renderSettings();
    await pick('Fire');
    expect(mockSetScreen).toHaveBeenCalledWith('a1');
  });

  it('does not rewrite the cooler when the current choice is picked again', async () => {
    mockState.mockResolvedValue({ ...base, deviceMediaId: 'a1' });
    await renderSettings();
    await pick('Fire');
    expect(mockSetScreen).not.toHaveBeenCalled();
  });

  it('shows the generic failure when restoring the coolant screen is refused', async () => {
    mockState.mockResolvedValue({ ...base, deviceMediaId: 'a1' });
    mockSetScreen.mockResolvedValue(502);
    await renderSettings();
    await pick('devices.corsair.deviceScreenCoolant');
    expect(screen.getByText('devices.corsair.deviceScreenFailed')).toBeInTheDocument();
  });

  it('restores the coolant screen with null', async () => {
    mockState.mockResolvedValue({ ...base, deviceMediaId: 'a1' });
    await renderSettings();
    await pick('devices.corsair.deviceScreenCoolant');
    expect(mockSetScreen).toHaveBeenCalledWith(null);
  });

  it('shows a translated message per failure status', async () => {
    const cases: Array<[number, string]> = [
      [409, 'ErrNotConnected'], [404, 'ErrNotFound'], [413, 'ErrTooLarge'],
      [422, 'ErrUnreadable'], [502, 'ErrRefused'], [500, 'Failed'],
    ];
    for (const [status, key] of cases) {
      mockSetScreen.mockResolvedValue(status);
      const { unmount } = render(<CorsairLcdSettings />);
      await act(async () => { await Promise.resolve(); });
      await pick('Fire');
      expect(screen.getByRole('alert')).toHaveTextContent(`devices.corsair.deviceScreen${key}`);
      unmount();
    }
  });

  it('shows a stored-image option when the cooler holds an unlisted item', async () => {
    mockState.mockResolvedValue({ ...base, deviceMediaId: 'gone' });
    await renderSettings();
    expect(screen.getByRole('button', { name: 'devices.corsair.deviceScreenLabel' })).toHaveTextContent('devices.corsair.deviceScreenStored');
  });

  it('does not show the stored-image option for a listed item or the coolant screen', async () => {
    mockState.mockResolvedValue({ ...base, deviceMediaId: 'a1' });
    await renderSettings();
    expect(screen.getByRole('button', { name: 'devices.corsair.deviceScreenLabel' })).toHaveTextContent('Fire');
  });

  it('applies an uploaded item and shows a translated message when the upload fails', async () => {
    mockUpload.mockResolvedValueOnce({ id: 'n2', name: 'New', type: 'static' });
    await renderSettings();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(['x'], 'new.png', { type: 'image/png' })] } });
    });
    expect(mockSetScreen).toHaveBeenCalledWith('n2');

    mockUpload.mockResolvedValueOnce(null);
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(['x'], 'bad.png', { type: 'image/png' })] } });
    });
    expect(screen.getByRole('alert')).toHaveTextContent('devices.corsair.deviceScreenUploadFailed');
  });
});
