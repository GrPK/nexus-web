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

const box = () => screen.getByRole('switch', { name: 'monitoring.events.enableLabel', hidden: true }).closest('[aria-disabled]');

describe('MonitoringEventsSettings pillar dimming', () => {
  afterEach(() => { state.monitoring = true; state.eventsEnabled = true; });

  it('is interactive while Monitoring is on', () => {
    render(<MonitoringEventsSettings />);
    expect(box()).toBeNull();
  });

  it('dims as a whole when Monitoring is off, without dimming the rows a second time', () => {
    state.monitoring = false;
    render(<MonitoringEventsSettings />);
    expect(box()).toHaveAttribute('aria-disabled', 'true');
    const kindSwitches = screen.getAllByRole('switch', { hidden: true }).slice(1);
    for (const sw of kindSwitches) expect(sw).not.toBeDisabled();
  });
});
