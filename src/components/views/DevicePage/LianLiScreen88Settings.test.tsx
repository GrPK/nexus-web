import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LianLiScreen88PageGate, LianLiScreen88Settings } from './LianLiScreen88Settings';
import { resetScreen88PendingMode, useLianLiScreen88Screen } from './useLianLiScreen88Screen';
import type { LConnectVideos, LianLiScreen88MediaItem, LianLiScreen88Settings as Settings } from '../../../api/lianliScreen88';
import { MultiplexContext } from '../../../hooks/useMultiplexSocket';

/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));

vi.mock('../../common/MediaCropper/MediaCropper', () => ({
  MediaCropper: ({ onConfirm, aspect }: any) => (
    <button type="button" onClick={() => onConfirm({ x: 0.1, y: 0.2, w: 0.5, h: 0.4 })}>
      {`cropper:${aspect.toFixed(3)}`}
    </button>
  ),
}));

const mockGetSettings = vi.fn();
const mockSetSettings = vi.fn();
const mockGetMedia = vi.fn();
const mockUpload = vi.fn();
const mockDelete = vi.fn();
const mockGetLConnect = vi.fn();
const mockImport = vi.fn();

vi.mock('../../../api/lianliScreen88', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../api/lianliScreen88')>()),
  getLianLiScreen88Settings: (...a: any[]) => mockGetSettings(...a),
  setLianLiScreen88Settings: (...a: any[]) => mockSetSettings(...a),
  getLianLiScreen88Media: (...a: any[]) => mockGetMedia(...a),
  uploadLianLiScreen88Media: (...a: any[]) => mockUpload(...a),
  deleteLianLiScreen88Media: (...a: any[]) => mockDelete(...a),
  getLianLiScreen88LConnectVideos: (...a: any[]) => mockGetLConnect(...a),
  importLianLiScreen88LConnectVideos: (...a: any[]) => mockImport(...a),
}));

function Harness({ title }: { title?: string }) {
  const screen88 = useLianLiScreen88Screen(true);
  return <LianLiScreen88Settings screen={screen88} title={title} />;
}

// The service's push channel: the page reads the settings again on these frames, never on a timer.
const topicListeners = new Map<string, Set<(data: unknown) => void>>();
const mux = {
  subscribe: (topic: string, listener: (data: unknown) => void) => {
    if (!topicListeners.has(topic)) topicListeners.set(topic, new Set());
    topicListeners.get(topic)!.add(listener);
  },
  unsubscribe: (topic: string, listener: (data: unknown) => void) => { topicListeners.get(topic)?.delete(listener); },
  connected: true,
} as any;
const Mux = ({ children }: { children: React.ReactNode }) => (
  <MultiplexContext.Provider value={mux}>{children}</MultiplexContext.Provider>
);
async function push(topic = 'devices') {
  await act(async () => { topicListeners.get(topic)?.forEach(listener => listener({})); });
}

const settings: Settings = {
  connected: true,
  inWindowsDisplay: false,
  screenMode: 'nexus',
  screenSaverMinutes: 0,
  screenSaverBrightness: 50,
};

/** The glass in its own Windows display mode: no panel, the 1A86:AD21 identity present. */
const asWindows: Partial<Settings> = { connected: false, inWindowsDisplay: true };

const clip = (name: string, ready = true): LianLiScreen88MediaItem => ({ name, label: name, ready });

const lconnect: LConnectVideos = {
  folder: 'C:\\ProgramData\\Lian-Li\\L-Connect 3\\universal-screen-8.8-inch\\video',
  videos: [
    { file: '88001.mp4', label: 'L-Connect 88001', sizeBytes: 3 * 1024 * 1024, imported: true },
    { file: '88002.mp4', label: 'L-Connect 88002', sizeBytes: 2.5 * 1024 * 1024, imported: false },
    { file: '88003.mp4', label: 'L-Connect 88003', sizeBytes: 1024 * 1024, imported: false },
  ],
};

async function renderSettings(s: Partial<Settings> = {}, media: LianLiScreen88MediaItem[] = [], title?: string) {
  mockGetSettings.mockResolvedValue({ ...settings, ...s });
  mockGetMedia.mockResolvedValue(media);
  await act(async () => {
    render(<Harness title={title} />, { wrapper: Mux });
  });
}

const windowsSwitch = () => screen.getByRole('switch', { name: 'devices.lianliScreen88.windowsDisplay' });

beforeEach(() => {
  vi.clearAllMocks();
  resetScreen88PendingMode();
  mockSetSettings.mockResolvedValue(true);
  mockUpload.mockResolvedValue({ name: 'new.mp4' });
  mockDelete.mockResolvedValue(true);
  mockGetLConnect.mockResolvedValue(lconnect);
  mockImport.mockResolvedValue(['n2', 'n3']);
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LianLiScreen88Settings', () => {
  it('renders nothing while the glass is neither a panel nor a Windows display', async () => {
    await renderSettings({ connected: false, inWindowsDisplay: false });
    expect(screen.queryByText('devices.lianliCurve.screenSection')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('titles the screen section with the name it is given', async () => {
    await renderSettings({}, [], 'Lian Li Universal Screen 8.8');
    expect(screen.getByText('Lian Li Universal Screen 8.8')).toBeInTheDocument();
    expect(screen.queryByText('devices.lianliCurve.screenSection')).not.toBeInTheDocument();
  });

  it('hides the video library in Nexus panel mode', async () => {
    await renderSettings();
    expect(screen.queryByText('devices.lianliCurve.mediaUpload')).not.toBeInTheDocument();
    expect(screen.queryByText('devices.lianliScreen88.lconnectImport')).not.toBeInTheDocument();
  });

  it('switching the content select to video PUTs the mode', async () => {
    await renderSettings();
    fireEvent.click(screen.getByLabelText('devices.lianliCurve.screenContent'));
    fireEvent.click(await screen.findByRole('option', { name: 'devices.lianliCurve.screenModeVideo' }));
    await waitFor(() => expect(mockSetSettings).toHaveBeenCalledWith({ screenMode: 'video' }));
  });

  it('selecting a clip PUTs video mode with its name', async () => {
    await renderSettings({ screenMode: 'video' }, [clip('a.mp4'), clip('b.mp4')]);
    fireEvent.click(screen.getByText('b.mp4'));
    await waitFor(() =>
      expect(mockSetSettings).toHaveBeenCalledWith({ screenMode: 'video', video: 'b.mp4' }));
  });

  it('uploads the picked file with the confirmed crop at the glass aspect, then selects it', async () => {
    await renderSettings({ screenMode: 'video' });
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(await screen.findByText(`cropper:${(1920 / 480).toFixed(3)}`));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(file, { x: 0.1, y: 0.2, w: 0.5, h: 0.4 }, false));
    await waitFor(() =>
      expect(mockSetSettings).toHaveBeenCalledWith({ screenMode: 'video', video: 'new.mp4' }));
  });

  it('a portrait-mounted glass crops at 1:4 and sends that as the portrait crop', async () => {
    await renderSettings({ screenMode: 'video', videoPortrait: true, videoWidth: 480, videoHeight: 1920 });
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(await screen.findByText(`cropper:${(480 / 1920).toFixed(3)}`));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(file, { x: 0.1, y: 0.2, w: 0.5, h: 0.4 }, true));
  });

  it('reads the library again when the mount turns a quarter, for its new thumbnails', async () => {
    await renderSettings({ screenMode: 'video' }, [clip('a.mp4')]);
    const before = mockGetMedia.mock.calls.length;
    mockGetSettings.mockResolvedValue({ ...settings, screenMode: 'video', videoPortrait: true, videoWidth: 480, videoHeight: 1920 });
    await push('panel/device');
    expect(mockGetMedia.mock.calls.length).toBeGreaterThan(before);
  });

  it('shows the failure and selects nothing when an upload fails', async () => {
    mockUpload.mockResolvedValue(null);
    await renderSettings({ screenMode: 'video' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'c.mp4')] } });
    fireEvent.click(await screen.findByText(/^cropper:/));
    expect(await screen.findByRole('alert')).toHaveTextContent('devices.lianliCurve.mediaUploadFailed');
    expect(mockSetSettings).not.toHaveBeenCalled();
  });

  it('deletes a clip after confirming', async () => {
    await renderSettings({ screenMode: 'video' }, [clip('a.mp4')]);
    fireEvent.click(screen.getByLabelText('devices.lianliCurve.mediaDeleteAria'));
    fireEvent.click(await screen.findByRole('button', { name: 'common.delete' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('a.mp4'));
  });

  it('polls the library while a clip is still processing', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await renderSettings({ screenMode: 'video' }, [clip('a.mp4', false)]);
    expect(screen.getByRole('status')).toBeInTheDocument();
    const before = mockGetMedia.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(mockGetMedia.mock.calls.length).toBeGreaterThan(before);
  });

  it('PUTs the saver interval, video and brightness', async () => {
    await renderSettings({ screenSaverMinutes: 15, screenSaverVideo: 'a.mp4' }, [clip('a.mp4'), clip('b.mp4')]);
    fireEvent.click(screen.getByLabelText('devices.lianliCurve.saverInterval'));
    fireEvent.click(await screen.findByRole('option', { name: 'devices.lianliCurve.saverMinutes:{"n":"30"}' }));
    await waitFor(() => expect(mockSetSettings).toHaveBeenCalledWith({ screenSaverMinutes: 30 }));

    fireEvent.click(screen.getByLabelText('devices.lianliCurve.saverVideo'));
    fireEvent.click(await screen.findByRole('option', { name: 'b.mp4' }));
    await waitFor(() => expect(mockSetSettings).toHaveBeenCalledWith({ screenSaverVideo: 'b.mp4' }));

    const slider = screen.getByRole('slider', { name: 'devices.lianliCurve.saverBrightnessAria' });
    fireEvent.change(slider, { target: { value: '70' } });
    fireEvent.pointerUp(slider);
    await waitFor(() => expect(mockSetSettings).toHaveBeenCalledWith({ screenSaverBrightness: 70 }));
  });

  it('disables the saver video and brightness while the interval is off', async () => {
    await renderSettings({}, [clip('a.mp4')]);
    expect(screen.getByRole('slider', { name: 'devices.lianliCurve.saverBrightnessAria' })).toBeDisabled();
    expect(screen.getByLabelText('devices.lianliCurve.saverVideo')).toBeDisabled();
  });

  it('PUTs the offline mode toggle and shows null as off', async () => {
    await renderSettings({ offlineMode: null });
    const sw = screen.getByRole('switch', { name: 'devices.lianliCurve.offlineMode' });
    expect(sw).not.toBeChecked();
    fireEvent.click(sw);
    await waitFor(() => expect(mockSetSettings).toHaveBeenCalledWith({ offlineMode: true }));
  });
});

describe('LianLiScreen88Settings Windows display', () => {
  it('reads nothing on a timer, only on the service\'s pushes, and never writes the mode on its own', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await renderSettings(asWindows);
    const reads = mockGetSettings.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(mockGetSettings.mock.calls.length).toBe(reads);
    await push('devices');
    await push('panel/device');
    await push('lianli-screen88');
    expect(mockGetSettings.mock.calls.length).toBe(reads + 3);
    expect(mockSetSettings).not.toHaveBeenCalled();
  });

  it('as a Nexus screen, the switch is off; turning it on asks, then shows the Windows display at once', async () => {
    await renderSettings();
    expect(windowsSwitch()).not.toBeChecked();
    expect(screen.getByText('devices.lianliScreen88.windowsDisplayHint')).toBeInTheDocument();
    fireEvent.click(windowsSwitch());
    expect(mockSetSettings).not.toHaveBeenCalled();
    expect(await screen.findByText('devices.lianliScreen88.windowsDisplayOnMessage')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'devices.lianliScreen88.restartScreen' }));
    // On the press: the Windows display view, the switch on and locked while the glass restarts.
    expect(screen.getByText('devices.lianliScreen88.windowsDisplayActive')).toBeInTheDocument();
    expect(screen.queryByLabelText('devices.lianliCurve.screenContent')).not.toBeInTheDocument();
    expect(windowsSwitch()).toBeChecked();
    expect(windowsSwitch()).toBeDisabled();
    expect(screen.getByText('devices.lianliScreen88.restarting')).toBeInTheDocument();
    await waitFor(() => expect(mockSetSettings).toHaveBeenCalledWith({ windowsDisplay: true }));
    // The service's push settles it: the glass is a Windows display.
    mockGetSettings.mockResolvedValue({ ...settings, ...asWindows, windowsDisplay: true });
    await push('devices');
    expect(screen.queryByText('devices.lianliScreen88.restarting')).not.toBeInTheDocument();
    expect(windowsSwitch()).toBeChecked();
    expect(windowsSwitch()).not.toBeDisabled();
  });

  it('cancelling the question writes nothing', async () => {
    await renderSettings();
    fireEvent.click(windowsSwitch());
    fireEvent.click(await screen.findByRole('button', { name: 'confirm.cancel' }));
    expect(mockSetSettings).not.toHaveBeenCalled();
    expect(windowsSwitch()).not.toBeChecked();
  });

  it('shows a switch to Windows display that is still on its way', async () => {
    await renderSettings({ windowsDisplay: true });
    expect(windowsSwitch()).toBeChecked();
    expect(screen.getByText('devices.lianliScreen88.windowsDisplaySwitching')).toBeInTheDocument();
  });

  it('in Windows display mode explains it instead of "not connected", with only the switch back', async () => {
    await renderSettings(asWindows);
    expect(screen.getByText('devices.lianliScreen88.windowsDisplayActive')).toBeInTheDocument();
    expect(screen.getByText('devices.lianliScreen88.windowsDisplayActiveHint')).toBeInTheDocument();
    expect(windowsSwitch()).toBeChecked();
    expect(screen.queryByLabelText('devices.lianliCurve.screenContent')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'devices.lianliCurve.offlineMode' })).not.toBeInTheDocument();
    expect(mockGetMedia).not.toHaveBeenCalled();
    // Heading, then the notice, then the card holding only the switch.
    const notice = screen.getByText('devices.lianliScreen88.windowsDisplayActive');
    const card = windowsSwitch().closest('[class*="_box_"]');
    expect(card).not.toBeNull();
    expect(card!.contains(notice)).toBe(false);
    expect(notice.closest('section')).toBe(windowsSwitch().closest('section'));
  });

  it('turning it off asks first, then shows the restart at once and the panel once the service says so', async () => {
    await renderSettings(asWindows);
    fireEvent.click(windowsSwitch());
    expect(mockSetSettings).not.toHaveBeenCalled();
    expect(await screen.findByText('devices.lianliScreen88.windowsDisplayOffMessage')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'devices.lianliScreen88.restartScreen' }));
    // On the press: no notice, the switch off and locked while the glass restarts as a panel.
    expect(screen.queryByText('devices.lianliScreen88.windowsDisplayActive')).not.toBeInTheDocument();
    expect(windowsSwitch()).not.toBeChecked();
    expect(windowsSwitch()).toBeDisabled();
    expect(screen.getByText('devices.lianliScreen88.restarting')).toBeInTheDocument();
    await waitFor(() => expect(mockSetSettings).toHaveBeenCalledWith({ windowsDisplay: false }));
    mockGetSettings.mockResolvedValue({ ...settings, windowsDisplay: false });
    await push('panel/device');
    expect(screen.getByLabelText('devices.lianliCurve.screenContent')).toBeInTheDocument();
    expect(screen.queryByText('devices.lianliScreen88.restarting')).not.toBeInTheDocument();
  });

  it('the page follows a press made in its own section at once (the shared switch state)', async () => {
    mockGetSettings.mockResolvedValue(settings);
    mockGetMedia.mockResolvedValue([]);
    await act(async () => {
      render(<LianLiScreen88PageGate name="Lian Li Universal Screen 8.8" fallback={<Harness />} />, { wrapper: Mux });
    });
    expect(screen.getByLabelText('devices.lianliCurve.screenContent')).toBeInTheDocument();
    fireEvent.click(windowsSwitch());
    fireEvent.click(await screen.findByRole('button', { name: 'devices.lianliScreen88.restartScreen' }));
    // The page itself, not just the section, is the Windows display view now.
    expect(screen.getByText('Lian Li Universal Screen 8.8')).toBeInTheDocument();
    expect(screen.getByText('devices.lianliScreen88.windowsDisplayActive')).toBeInTheDocument();
    expect(screen.queryByLabelText('devices.lianliCurve.screenContent')).not.toBeInTheDocument();
  });

  it('a switch the glass never makes stops showing as restarting after a minute', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await renderSettings();
    fireEvent.click(windowsSwitch());
    fireEvent.click(screen.getByRole('button', { name: 'devices.lianliScreen88.restartScreen' }));
    expect(screen.getByText('devices.lianliScreen88.restarting')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(screen.queryByText('devices.lianliScreen88.restarting')).not.toBeInTheDocument();
  });

  it('turning it back on while the return is pending only drops the request', async () => {
    await renderSettings({ ...asWindows, windowsDisplay: false });
    fireEvent.click(windowsSwitch());
    await waitFor(() => expect(mockSetSettings).toHaveBeenCalledWith({ windowsDisplay: true }));
    expect(screen.queryByText('devices.lianliScreen88.windowsDisplayOffMessage')).not.toBeInTheDocument();
  });
});

describe('LianLiScreen88Settings L-Connect import', () => {
  async function openImport() {
    await renderSettings({ screenMode: 'video' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'devices.lianliScreen88.lconnectImport' }));
    });
  }

  it('lists the L-Connect videos, the ones already in the library ticked and locked', async () => {
    await openImport();
    expect(mockGetLConnect).toHaveBeenCalledTimes(1);
    const imported = screen.getByRole('checkbox', { name: /L-Connect 88001/ });
    expect(imported).toBeChecked();
    expect(imported).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /L-Connect 88002/ })).not.toBeChecked();
    expect(screen.getByText('devices.lianliScreen88.lconnectImportInLibrary:{"size":"3.0"}')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'devices.lianliScreen88.lconnectImportConfirm' })).toBeDisabled();
  });

  it('imports the picked videos and refreshes the library', async () => {
    await openImport();
    fireEvent.click(screen.getByRole('checkbox', { name: /L-Connect 88002/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /L-Connect 88003/ }));
    const before = mockGetMedia.mock.calls.length;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'devices.lianliScreen88.lconnectImportConfirm' }));
    });
    expect(mockImport).toHaveBeenCalledWith(['88002.mp4', '88003.mp4']);
    await waitFor(() => expect(mockGetMedia.mock.calls.length).toBeGreaterThan(before));
    expect(screen.queryByRole('checkbox', { name: /L-Connect 88002/ })).not.toBeInTheDocument();
  });

  it('select all picks every video not in the library yet', async () => {
    await openImport();
    fireEvent.click(screen.getByRole('checkbox', { name: 'devices.lianliScreen88.lconnectImportSelectAll' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'devices.lianliScreen88.lconnectImportConfirm' }));
    });
    expect(mockImport).toHaveBeenCalledWith(['88002.mp4', '88003.mp4']);
  });

  it('keeps the list open with a note when the import fails', async () => {
    mockImport.mockResolvedValue(null);
    await openImport();
    fireEvent.click(screen.getByRole('checkbox', { name: /L-Connect 88002/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'devices.lianliScreen88.lconnectImportConfirm' }));
    });
    expect(await screen.findByText('devices.lianliScreen88.lconnectImportFailed')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /L-Connect 88002/ })).toBeInTheDocument();
  });

  it('names the folder when L-Connect has no videos there', async () => {
    mockGetLConnect.mockResolvedValue({ folder: 'C:\\LC\\video', videos: [] });
    await openImport();
    expect(screen.getByText('devices.lianliScreen88.lconnectImportEmpty:{"folder":"C:\\\\LC\\\\video"}')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'devices.lianliScreen88.lconnectImportConfirm' })).not.toBeInTheDocument();
  });
});

describe('LianLiScreen88PageGate', () => {
  it('shows the Windows display view, not the fallback, while the glass is a Windows display', async () => {
    mockGetSettings.mockResolvedValue({ ...settings, ...asWindows });
    await act(async () => {
      render(<LianLiScreen88PageGate name="Lian Li Universal Screen 8.8" fallback={<p>not connected</p>} />);
    });
    expect(screen.getByText('Lian Li Universal Screen 8.8')).toBeInTheDocument();
    expect(screen.getByText('devices.lianliScreen88.windowsDisplayActive')).toBeInTheDocument();
    expect(screen.queryByText('not connected')).not.toBeInTheDocument();
  });

  it('shows the fallback when the glass is simply absent or the service has no answer', async () => {
    mockGetSettings.mockResolvedValue({ ...settings, connected: false, inWindowsDisplay: false });
    const view = render(<LianLiScreen88PageGate name="8.8" fallback={<p>not connected</p>} />);
    expect(await screen.findByText('not connected')).toBeInTheDocument();
    view.unmount();
    mockGetSettings.mockResolvedValue(null);
    render(<LianLiScreen88PageGate name="8.8" fallback={<p>not connected</p>} />);
    expect(await screen.findByText('not connected')).toBeInTheDocument();
  });
});
