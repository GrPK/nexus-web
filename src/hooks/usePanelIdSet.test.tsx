import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelIdSet, type PanelSelectionField } from './usePanelIdSet';
import { PanelDeviceIdProvider } from '../panel/widgets/common/PanelDeviceIdContext';

// The service's panel records, by panel id.
const records = vi.hoisted(() => ({ current: {} as Record<string, Record<string, string[]>> }));
vi.mock('../api/panel', () => ({
  fetchPanelDevice: vi.fn(async (id: string) => (records.current[id] ? { id, ...records.current[id] } : null)),
  patchPanelDevice: vi.fn(async (id: string, patch: Record<string, string[]>) => {
    records.current[id] = { ...records.current[id], ...patch };
    return { id, ...records.current[id] };
  }),
}));

const KEYS: Record<PanelSelectionField, string> = {
  lightingSelection: 'nexus.lighting.pinSelection',
  coolingSelection: 'nexus.cooling.selectedFans',
};

const inPanel = (panelId: string | null) =>
  ({ children }: { children: ReactNode }) => <PanelDeviceIdProvider value={panelId}>{children}</PanelDeviceIdProvider>;

const mount = (panelId: string | null, field: PanelSelectionField) =>
  renderHook(() => usePanelIdSet(KEYS[field], field), { wrapper: inPanel(panelId) });

describe.each(['lightingSelection', 'coolingSelection'] as const)('usePanelIdSet (%s)', field => {
  beforeEach(() => {
    records.current = {};
    localStorage.clear();
  });

  it('desktop: writes through to localStorage and restores from it on a fresh mount', () => {
    const first = mount(null, field);
    act(() => first.result.current[1](new Set(['a', 'b'])));
    expect(JSON.parse(localStorage.getItem(KEYS[field])!)).toEqual(['a', 'b']);
    first.unmount();

    const second = mount(null, field);
    expect([...second.result.current[0]]).toEqual(['a', 'b']);
    expect(records.current).toEqual({});
  });

  it('desktop: restores a selection that only storage holds, as after a restart', () => {
    localStorage.setItem(KEYS[field], JSON.stringify(['x']));
    expect([...mount(null, field).result.current[0]]).toEqual(['x']);
  });

  it('keeps each panel and the desktop independent', async () => {
    const a = mount('panel-a', field);
    const b = mount('panel-b', field);
    const desktop = mount(null, field);
    act(() => a.result.current[1](new Set(['one'])));
    act(() => b.result.current[1](new Set(['two', 'three'])));
    act(() => desktop.result.current[1](new Set(['four'])));

    expect([...a.result.current[0]]).toEqual(['one']);
    expect([...b.result.current[0]]).toEqual(['two', 'three']);
    expect([...desktop.result.current[0]]).toEqual(['four']);
    await waitFor(() => expect(records.current['panel-b'][field]).toEqual(['two', 'three']));
    expect(records.current['panel-a'][field]).toEqual(['one']);
  });

  it('reopening restores the panel selection from the service when local storage is gone', async () => {
    const first = mount('panel-a', field);
    act(() => first.result.current[1](new Set(['one', 'two'])));
    await waitFor(() => expect(records.current['panel-a'][field]).toEqual(['one', 'two']));
    first.unmount();
    localStorage.clear();

    const second = mount('panel-a', field);
    await waitFor(() => expect([...second.result.current[0]]).toEqual(['one', 'two']));
  });

  it('an empty selection is remembered as empty', async () => {
    records.current['panel-a'] = { [field]: ['one'] };
    const first = mount('panel-a', field);
    await waitFor(() => expect([...first.result.current[0]]).toEqual(['one']));
    act(() => first.result.current[1](new Set()));
    await waitFor(() => expect(records.current['panel-a'][field]).toEqual([]));
    first.unmount();
    localStorage.clear();

    const second = mount('panel-a', field);
    await waitFor(() => expect(records.current['panel-a'][field]).toEqual([]));
    expect(second.result.current[0].size).toBe(0);
  });

  it('a change made before the record arrives is not overwritten by it', async () => {
    const { fetchPanelDevice } = await import('../api/panel');
    let release: () => void = () => {};
    vi.mocked(fetchPanelDevice).mockImplementationOnce(() => new Promise(resolve => {
      release = () => resolve({ id: 'panel-a', [field]: ['old'] } as never);
    }));
    const view = mount('panel-a', field);
    act(() => view.result.current[1](new Set(['fresh'])));
    await act(async () => { release(); });
    expect([...view.result.current[0]]).toEqual(['fresh']);
  });

  it('prunes gone ids only after the record has landed, and writes the pruned set back', async () => {
    records.current['panel-a'] = { [field]: ['one', 'ghost'] };
    const view = renderHook(() => usePanelIdSet(KEYS[field], field, new Set(['one', 'two'])), { wrapper: inPanel('panel-a') });
    await waitFor(() => expect([...view.result.current[0]]).toEqual(['one']));
    await waitFor(() => expect(records.current['panel-a'][field]).toEqual(['one']));
  });

  it('keeps writes in order when taps come fast', async () => {
    const { patchPanelDevice } = await import('../api/panel');
    vi.mocked(patchPanelDevice).mockClear();
    const view = mount('panel-a', field);
    act(() => view.result.current[1](new Set(['a'])));
    act(() => view.result.current[1](new Set(['a', 'b'])));
    await waitFor(() => expect(patchPanelDevice).toHaveBeenCalledTimes(2));
    expect(vi.mocked(patchPanelDevice).mock.calls.map(c => c[1])).toEqual([{ [field]: ['a'] }, { [field]: ['a', 'b'] }]);
  });

  it('a write that changes nothing does not hit the service', async () => {
    const { patchPanelDevice } = await import('../api/panel');
    vi.mocked(patchPanelDevice).mockClear();
    const view = mount('panel-a', field);
    act(() => view.result.current[1](prev => prev));
    act(() => view.result.current[1](new Set()));
    expect(patchPanelDevice).not.toHaveBeenCalled();
  });
});
