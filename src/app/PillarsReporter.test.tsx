import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PillarsReporter } from './PillarsReporter';

const state = vi.hoisted(() => ({ settled: false, hydrated: false, cooling: true }));
vi.mock('../hooks/useUiSettings', () => ({
  useFeatureFlags: () => ({ lighting: true, cooling: state.cooling, monitoring: true, diagnostics: true }),
  useUiSettingsSettled: () => state.settled,
  useUiSettingsHydrated: () => state.hydrated,
}));

describe('PillarsReporter', () => {
  beforeEach(() => Object.assign(state, { settled: false, hydrated: false, cooling: true }));

  it('reports nothing while the preferences read has no outcome', () => {
    const on = vi.fn();
    render(<PillarsReporter onPillars={on} />);
    expect(on).not.toHaveBeenCalled();
  });

  it('reports the values once settled', () => {
    Object.assign(state, { settled: true, hydrated: true, cooling: false });
    const on = vi.fn();
    render(<PillarsReporter onPillars={on} />);
    expect(on).toHaveBeenCalledWith({ lighting: true, cooling: false, monitoring: true, diagnostics: true }, true);
  });

  it('says so when the values are only the local cache after a failed read', () => {
    Object.assign(state, { settled: true, hydrated: false });
    const on = vi.fn();
    render(<PillarsReporter onPillars={on} />);
    expect(on).toHaveBeenCalledWith(expect.any(Object), false);
  });
});
