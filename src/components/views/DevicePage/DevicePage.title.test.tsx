import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DevicePage } from './DevicePage';
import type { UnifiedDevice } from '../../../hooks/useUnifiedDevices';

const unifiedState: { unified: UnifiedDevice[] } = { unified: [] };
vi.mock('../../../hooks/useUnifiedDevices', () => ({
  useUnifiedDevices: () => ({ unified: unifiedState.unified, controlDevice: vi.fn(), turnedOffMonitorKeys: new Set<string>() }),
}));

vi.mock('../../common/Toast/Toast', () => ({
  useToast: () => ({ push: vi.fn() }),
}));

const t = (key: string) => key;
vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t }),
}));

describe('DevicePage title', () => {
  it('reports the name of the device it resolved for the key', async () => {
    unifiedState.unified = [{ key: 'panel-stream:rec-1', shortName: 'ASUS Ryujin LCD', connected: false } as UnifiedDevice];
    const onTitleChange = vi.fn();
    render(<DevicePage deviceKey="panel-stream:rec-1" serviceOnline connectionState="online" onTitleChange={onTitleChange} />);
    await waitFor(() => expect(onTitleChange).toHaveBeenLastCalledWith('panel-stream:rec-1', 'ASUS Ryujin LCD'));
  });

  it('reports no name for a key its list does not hold', async () => {
    unifiedState.unified = [];
    const onTitleChange = vi.fn();
    render(<DevicePage deviceKey="panel-stream:rec-1" serviceOnline connectionState="online" onTitleChange={onTitleChange} />);
    await waitFor(() => expect(onTitleChange).toHaveBeenLastCalledWith('panel-stream:rec-1', undefined));
  });
});
