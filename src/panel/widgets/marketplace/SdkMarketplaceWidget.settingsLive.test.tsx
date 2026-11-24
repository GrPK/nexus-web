// A running SDK tile follows settings changes: a local panel save through the shared bridge, and a
// cross-device `app-settings/{instanceId}` broadcast. Equal documents must not re-push.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { MultiplexContext, type MultiplexContextValue } from '../../../hooks/useMultiplexSocket';

vi.mock('../../../api/service', () => ({
  postService: async () => ({ error: false }),
  fetchService: async () => ({ values: { color: 'red' } }),
  resolveHttp: (p: string) => p,
  loopbackFetchInit: {},
}));
vi.mock('../../../api/auth', () => ({ getToken: async () => null, handleUnauthorized: async () => null }));
vi.mock('./useSdkBundle', () => ({
  useSdkBundle: () => ({ entryUrl: 'blob:entry', failed: false }),
  useSdkRuntime: () => ({ runtimeUrl: 'blob:rt', failed: false }),
}));
vi.mock('../common/PanelPreviewContext', () => ({ usePanelPreview: () => false }));

const seen: Array<Record<string, unknown> | undefined> = [];
vi.mock('../../../sandbox/SandboxedWidget', () => ({
  SandboxedWidget: (p: { settings?: Record<string, unknown> }) => { seen.push(p.settings); return null; },
}));

import { SdkMarketplaceWidget } from './SdkMarketplaceWidget';
import { WidgetSettingsBridge, settingsEqual } from '../../../widgets/settingsBridge';

const listing = { id: 'com.example.app', name: 'Demo', capabilities: {} } as never;
const listeners = new Map<string, (d: unknown) => void>();
const ctx = {
  connected: true,
  subscribe: (t: string, l: (d: unknown) => void) => { listeners.set(t, l); },
  unsubscribe: (t: string) => { listeners.delete(t); },
} as unknown as MultiplexContextValue;

const mount = () => render(
  <MultiplexContext.Provider value={ctx}>
    <SdkMarketplaceWidget listing={listing} instanceId="inst-1" size="2x2" />
  </MultiplexContext.Provider>,
);
const last = () => seen[seen.length - 1];

beforeEach(() => { seen.length = 0; listeners.clear(); WidgetSettingsBridge._resetSharedForTests(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('SDK tile live settings', () => {
  it('picks up a settings-panel save through the shared bridge', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ widgetId: 'x', values: { color: 'blue' } }) })));
    mount();
    await act(async () => {});
    expect(last()).toEqual({ color: 'red' });
    // The panel resolves the same instance through for(), not a private copy.
    await act(async () => { await WidgetSettingsBridge.for('inst-1').patch({ set: { color: 'blue' } }); });
    expect(last()).toEqual({ color: 'blue' });
  });

  it('applies a broadcast frame', async () => {
    mount();
    await act(async () => {});
    act(() => listeners.get('app-settings/inst-1')!({ settings: { color: 'green' } }));
    expect(last()).toEqual({ color: 'green' });
  });

  it('ignores malformed frames and does not re-push an equal document', async () => {
    mount();
    await act(async () => {});
    const before = seen.length;
    act(() => listeners.get('app-settings/inst-1')!({ settings: { color: 'red' } }));
    act(() => listeners.get('app-settings/inst-1')!({ nope: true }));
    act(() => listeners.get('app-settings/inst-1')!(null));
    expect(seen.length).toBe(before);
  });
});

describe('settingsEqual', () => {
  it('compares structurally, ignoring key order', () => {
    expect(settingsEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(settingsEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(settingsEqual({ a: [] }, { a: {} })).toBe(false);
  });
});
