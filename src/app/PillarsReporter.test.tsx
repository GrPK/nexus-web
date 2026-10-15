import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PillarsReporter } from './PillarsReporter';

const state = vi.hoisted(() => ({ hydrated: false, settled: false, cooling: true }));
vi.mock('../hooks/useUiSettings', () => ({
  useFeatureFlags: () => ({ lighting: true, cooling: state.cooling, monitoring: true, diagnostics: true }),
  useUiSettingsHydrated: () => state.hydrated,
  useUiSettingsSettled: () => state.settled,
}));

describe('PillarsReporter', () => {
  beforeEach(() => Object.assign(state, { hydrated: false, settled: false, cooling: true }));

  it('reports nothing while the preferences read has no outcome', () => {
    const on = vi.fn();
    render(<PillarsReporter onPillars={on} generation={1} />);
    expect(on).not.toHaveBeenCalled();
  });

  it('reports the hydrated values', () => {
    Object.assign(state, { hydrated: true, settled: true, cooling: false });
    const on = vi.fn();
    render(<PillarsReporter onPillars={on} generation={1} />);
    expect(on).toHaveBeenCalledWith({ lighting: true, cooling: false, monitoring: true, diagnostics: true });
  });

  it('reports unknown values (null) when the read failed, so a gate is not stuck', () => {
    Object.assign(state, { hydrated: false, settled: true });
    const on = vi.fn();
    render(<PillarsReporter onPillars={on} generation={1} />);
    expect(on).toHaveBeenCalledWith(null);
  });

  it('reports again on a new onboarding read', () => {
    Object.assign(state, { hydrated: true, settled: true });
    const on = vi.fn();
    const view = render(<PillarsReporter onPillars={on} generation={1} />);
    view.rerender(<PillarsReporter onPillars={on} generation={2} />);
    expect(on).toHaveBeenCalledTimes(2);
  });
});
