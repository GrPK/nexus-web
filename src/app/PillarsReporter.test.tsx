import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PillarsReporter } from './PillarsReporter';

const state = vi.hoisted(() => ({ settled: false, cooling: true }));
vi.mock('../hooks/useUiSettings', () => ({
  useFeatureFlags: () => ({ lighting: true, cooling: state.cooling, monitoring: true, diagnostics: true }),
  useUiSettingsSettled: () => state.settled,
}));

describe('PillarsReporter', () => {
  beforeEach(() => Object.assign(state, { settled: false, cooling: true }));

  it('reports nothing while the preferences read has no outcome', () => {
    const on = vi.fn();
    render(<PillarsReporter onPillars={on} />);
    expect(on).not.toHaveBeenCalled();
  });

  it('reports the values once settled', () => {
    Object.assign(state, { settled: true, cooling: false });
    const on = vi.fn();
    render(<PillarsReporter onPillars={on} />);
    expect(on).toHaveBeenCalledWith({ lighting: true, cooling: false, monitoring: true, diagnostics: true });
  });
});
