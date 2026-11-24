import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CoolingPage } from './CoolingPage';
import type { ServiceState } from '../../../hooks/useServiceState';
import { UiSettingsProvider } from '../../../hooks/useUiSettings';
import { resetOnboardingHintSession } from '../../../hooks/useOnboardingHint';

// Rendered outside I18nProvider, so t() falls back to raw keys.

let fans: Array<Record<string, unknown>> = [];
let dismissedHints: string[] | null = [];

const fan = (over: Record<string, unknown> = {}) => ({
  id: 'fan-cpu', name: 'CPU Fan', dutyPercent: 42, rpm: 1180, mode: 'Auto',
  classification: 'Controllable', calibrated: true, ...over,
});

vi.mock('../../../api/cooling', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../api/cooling')>();
  return {
    ...original,
    fetchFanChannels: vi.fn(async () => ({ channels: fans })),
    fetchTemperatureSources: vi.fn(async () => ({ sources: [] })),
    fetchCurves: vi.fn(async () => ({ globalSpeedModifier: 1, curves: [] })),
    fetchProfiles: vi.fn(async () => ({ profiles: [], active: 'balanced' })),
    fetchCalibrationResults: vi.fn(async () => ({ results: [] })),
    startCalibration: vi.fn(async () => ({ error: false })),
  };
});

vi.mock('../../../api/onboarding', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../api/onboarding')>();
  return {
    ...original,
    fetchOnboardingStatus: vi.fn(async () => (dismissedHints ? { completed: true, dismissedHints } : null)),
    dismissOnboardingHint: vi.fn(async (id: string) => ({ status: 200, body: { completed: true, dismissedHints: [id] } })),
  };
});

// The real bubble needs layout; a stub exposes the props the page passes.
vi.mock('../../../components/common/Coachmark/Coachmark', () => ({
  Coachmark: (p: { hintId: string; target: string; onDismiss: () => void }) => (
    <div data-testid="coachmark" data-hint-id={p.hintId} data-target={p.target}>
      <button onClick={p.onDismiss}>coachmark-x</button>
    </div>
  ),
}));

import { dismissOnboardingHint } from '../../../api/onboarding';
import { allowSlowAsyncUtils } from '../../../__tests__/slowAsyncUtils';

allowSlowAsyncUtils();

function renderPage(calibrating = false) {
  const serviceState = { cooling: { calibrating } } as unknown as ServiceState;
  return render(
    <UiSettingsProvider>
      <CoolingPage serviceOnline serviceState={serviceState} />
    </UiSettingsProvider>,
  );
}

const settle = () => screen.findByRole('button', { name: /cooling\.calibrate\.button/ });

const dead = () => fan({ id: 'fan-dead', name: 'Dead Fan', rpm: 0, classification: 'Unresponsive' });
const hiddenFansBubble = () => document.querySelector('[data-hint-id="cooling-hidden-fans"]');

function rightClick(name: string) {
  fireEvent.contextMenu(screen.getByText(name));
}

describe('CoolingPage hide unresponsive fans from the fan menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOnboardingHintSession();
    localStorage.clear();
    fans = [fan(), dead()];
    // The load-time unresponsive hint is out of the way so only this hint can show.
    dismissedHints = ['cooling-unresponsive'];
    localStorage.setItem('nexus_settings', JSON.stringify({ general: { coolingDashboardMode: 'advanced' } }));
  });

  it('offers the entry on an unresponsive fan only', async () => {
    renderPage();
    await settle();
    rightClick('CPU Fan');
    expect(screen.queryByText('cooling.fan.menuHideUnresponsive')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    rightClick('Dead Fan');
    expect(screen.getByText('cooling.fan.menuHideUnresponsive')).toBeInTheDocument();
  });

  it('turns the filter on and points at the eye when it was never toggled', async () => {
    renderPage();
    await settle();
    await waitFor(() => expect(screen.getByLabelText('cooling.hidden.hide')).toBeInTheDocument());
    rightClick('Dead Fan');
    fireEvent.click(screen.getByText('cooling.fan.menuHideUnresponsive'));
    await waitFor(() => expect(screen.queryByText('Dead Fan')).toBeNull());
    expect(screen.getByLabelText('cooling.hidden.show')).toBeInTheDocument();
    await waitFor(() => expect(hiddenFansBubble()).not.toBeNull());
    const selector = hiddenFansBubble()?.getAttribute('data-target') ?? '';
    expect(document.querySelector(selector)).toBe(screen.getByLabelText('cooling.hidden.show'));
  });

  it('waits while a calibration runs, then shows once it ends', async () => {
    const view = renderPage(true);
    await settle();
    await waitFor(() => expect(screen.getByLabelText('cooling.hidden.hide')).toBeInTheDocument());
    rightClick('Dead Fan');
    fireEvent.click(screen.getByText('cooling.fan.menuHideUnresponsive'));
    await waitFor(() => expect(screen.queryByText('Dead Fan')).toBeNull());
    expect(hiddenFansBubble()).toBeNull();
    view.rerender(
      <UiSettingsProvider>
        <CoolingPage serviceOnline serviceState={{ cooling: { calibrating: false } } as unknown as ServiceState} />
      </UiSettingsProvider>,
    );
    await waitFor(() => expect(hiddenFansBubble()).not.toBeNull());
  });

  it('shows no bubble when the eye was toggled before', async () => {
    dismissedHints = ['cooling-unresponsive', 'cooling-hidden-fans'];
    renderPage();
    await settle();
    await waitFor(() => expect(screen.getByLabelText('cooling.hidden.hide')).toBeInTheDocument());
    rightClick('Dead Fan');
    fireEvent.click(screen.getByText('cooling.fan.menuHideUnresponsive'));
    await waitFor(() => expect(screen.queryByText('Dead Fan')).toBeNull());
    expect(hiddenFansBubble()).toBeNull();
  });

  it('marks the hint seen when the eye is pressed, so a later menu use shows nothing', async () => {
    renderPage();
    await settle();
    fireEvent.click(screen.getByLabelText('cooling.hidden.hide'));
    expect(dismissOnboardingHint).toHaveBeenCalledWith('cooling-hidden-fans');
    fireEvent.click(screen.getByLabelText('cooling.hidden.show'));
    await waitFor(() => expect(screen.getByText('Dead Fan')).toBeInTheDocument());
    rightClick('Dead Fan');
    fireEvent.click(screen.getByText('cooling.fan.menuHideUnresponsive'));
    await waitFor(() => expect(screen.queryByText('Dead Fan')).toBeNull());
    expect(hiddenFansBubble()).toBeNull();
  });

  it('shows once: closing the bubble records it and later menu use shows nothing', async () => {
    renderPage();
    await settle();
    await waitFor(() => expect(screen.getByLabelText('cooling.hidden.hide')).toBeInTheDocument());
    rightClick('Dead Fan');
    fireEvent.click(screen.getByText('cooling.fan.menuHideUnresponsive'));
    await waitFor(() => expect(hiddenFansBubble()).not.toBeNull());
    fireEvent.click(screen.getByText('coachmark-x'));
    expect(dismissOnboardingHint).toHaveBeenCalledWith('cooling-hidden-fans');
    expect(hiddenFansBubble()).toBeNull();
  });
});
