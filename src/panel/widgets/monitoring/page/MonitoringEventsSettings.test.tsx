import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MonitoringEventsSettings } from './MonitoringEventsSettings';

const state = vi.hoisted(() => ({ monitoring: true, eventsEnabled: true }));

vi.mock('../../../../hooks/useUiSettings', () => ({
  useUiSettings: () => ({ settings: { monitoringEventsEnabled: state.eventsEnabled }, update: vi.fn() }),
  useFeatureFlags: () => ({ lighting: true, cooling: true, monitoring: state.monitoring, diagnostics: true }),
}));
vi.mock('./useEventKindVisibility', () => ({
  useEventKindVisibility: () => ({ isHidden: () => false, setKindHidden: vi.fn() }),
}));


describe('MonitoringEventsSettings pillar notice', () => {
  afterEach(() => { state.monitoring = true; state.eventsEnabled = true; });

  it('shows the rows while Monitoring is on', () => {
    render(<MonitoringEventsSettings />);
    expect(screen.getByRole('switch', { name: 'monitoring.events.enableLabel' })).toBeInTheDocument();
  });

  it('hides the rows behind a notice when Monitoring is off, and restores them when it turns on', () => {
    state.monitoring = false;
    const view = render(<MonitoringEventsSettings />);
    expect(screen.getByText('settings.pillarOff.monitoring')).toBeInTheDocument();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    state.monitoring = true;
    view.rerender(<MonitoringEventsSettings />);
    expect(screen.queryByText('settings.pillarOff.monitoring')).toBeNull();
    expect(screen.getAllByRole('switch').length).toBeGreaterThan(0);
  });
});
