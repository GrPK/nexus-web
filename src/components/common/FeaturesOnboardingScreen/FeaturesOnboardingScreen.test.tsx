import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeaturesOnboardingScreen } from './FeaturesOnboardingScreen';
import { completeFeaturesOnboarding, completeLightingOnboarding } from '../../../api/onboarding';
import { savePreferences } from '../../../api/profiles';

vi.mock('../../../api/onboarding', () => ({
  completeFeaturesOnboarding: vi.fn(),
  completeLightingOnboarding: vi.fn(),
}));

vi.mock('../../../api/profiles', () => ({ savePreferences: vi.fn() }));

const mockUpdate = vi.fn();
const current = vi.hoisted(() => ({ lighting: true, cooling: true, monitoring: true, diagnostics: true, hydrated: true }));
vi.mock('../../../hooks/useUiSettings', () => ({
  useUiSettingsUpdateSafe: () => mockUpdate,
  useFeatureFlags: () => ({ lighting: current.lighting, cooling: current.cooling, monitoring: current.monitoring, diagnostics: current.diagnostics }),
  useUiSettingsHydrated: () => current.hydrated,
}));

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(current, { lighting: true, cooling: true, monitoring: true, diagnostics: true, hydrated: true });
  vi.mocked(savePreferences).mockResolvedValue({} as never);
});

describe('FeaturesOnboardingScreen', () => {
  it('defaults every pillar to on', () => {
    render(<FeaturesOnboardingScreen open onComplete={vi.fn()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(4);
    for (const box of checkboxes) expect(box).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles a pillar off on click', () => {
    render(<FeaturesOnboardingScreen open onComplete={vi.fn()} />);
    const lightingCard = screen.getByRole('checkbox', { name: /lighting.title/ });
    fireEvent.click(lightingCard);
    expect(lightingCard).toHaveAttribute('aria-checked', 'false');
  });

  it('Continue with everything on posts an explicit all-true patch, completes onboarding, and calls onComplete', async () => {
    vi.mocked(completeFeaturesOnboarding).mockResolvedValue({ completed: true, featuresCompleted: true });
    const onComplete = vi.fn();
    render(<FeaturesOnboardingScreen open onComplete={onComplete} />);

    fireEvent.click(screen.getByText('featuresOnboarding.continue'));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ lighting: true, cooling: true, monitoring: true, diagnostics: true }));
    expect(mockUpdate).toHaveBeenCalledWith({
      featureLightingEnabled: true,
      featureCoolingEnabled: true,
      featureMonitoringEnabled: true,
      featureDiagnosticsEnabled: true,
    });
    expect(completeLightingOnboarding).not.toHaveBeenCalled();
  });

  it('Continue with a pillar off patches all four fields explicitly, overriding any stale server state', async () => {
    vi.mocked(completeFeaturesOnboarding).mockResolvedValue({ completed: true, featuresCompleted: true });
    const onComplete = vi.fn();
    render(<FeaturesOnboardingScreen open onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /cooling.title/ }));
    fireEvent.click(screen.getByText('featuresOnboarding.continue'));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(mockUpdate).toHaveBeenCalledWith({
      featureLightingEnabled: true,
      featureCoolingEnabled: false,
      featureMonitoringEnabled: true,
      featureDiagnosticsEnabled: true,
    });
  });

  it('turning lighting off also posts lighting-complete, so a reload does not resurrect the device-selection step', async () => {
    vi.mocked(completeFeaturesOnboarding).mockResolvedValue({ completed: true, featuresCompleted: true });
    vi.mocked(completeLightingOnboarding).mockResolvedValue({ completed: true, lightingCompleted: true });
    const onComplete = vi.fn();
    render(<FeaturesOnboardingScreen open onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /lighting.title/ }));
    fireEvent.click(screen.getByText('featuresOnboarding.continue'));

    await waitFor(() => expect(completeLightingOnboarding).toHaveBeenCalled());
    expect(onComplete).toHaveBeenCalledWith({ lighting: false, cooling: true, monitoring: true, diagnostics: true });
  });

  it('shows an error and stays open when the completion write fails', async () => {
    vi.mocked(completeFeaturesOnboarding).mockResolvedValue(null);
    const onComplete = vi.fn();
    render(<FeaturesOnboardingScreen open onComplete={onComplete} />);

    fireEvent.click(screen.getByText('featuresOnboarding.continue'));

    await waitFor(() => expect(screen.getByText('welcome.error')).toBeInTheDocument());
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<FeaturesOnboardingScreen open={false} onComplete={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sends the chosen pillars to the service, and waits for that write, before completing features onboarding', async () => {
    let finishSave!: () => void;
    vi.mocked(savePreferences).mockReturnValue(new Promise<object>(r => { finishSave = () => r({}); }) as never);
    vi.mocked(completeFeaturesOnboarding).mockResolvedValue({ completed: true, featuresCompleted: true });
    render(<FeaturesOnboardingScreen open onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /cooling.title/ }));
    fireEvent.click(screen.getByText('featuresOnboarding.continue'));

    await waitFor(() => expect(savePreferences).toHaveBeenCalledWith({
      features: { lighting: true, cooling: false, monitoring: true, diagnostics: true },
    }));
    expect(completeFeaturesOnboarding).not.toHaveBeenCalled();
    finishSave();
    await waitFor(() => expect(completeFeaturesOnboarding).toHaveBeenCalled());
  });

  it('shows the error and does not complete features onboarding when the pillars could not be saved', async () => {
    vi.mocked(savePreferences).mockResolvedValue(null as never);
    const onComplete = vi.fn();
    render(<FeaturesOnboardingScreen open onComplete={onComplete} />);

    fireEvent.click(screen.getByText('featuresOnboarding.continue'));

    await waitFor(() => expect(savePreferences).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('featuresOnboarding.continue')).toBeInTheDocument());
    expect(completeFeaturesOnboarding).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('on a replay starts from the current pillars, so Continue alone keeps them', async () => {
    Object.assign(current, { cooling: false, diagnostics: false });
    vi.mocked(completeFeaturesOnboarding).mockResolvedValue({ completed: true, featuresCompleted: true });
    const onComplete = vi.fn();
    render(<FeaturesOnboardingScreen open fromCurrent onComplete={onComplete} />);

    expect(screen.getByRole('checkbox', { name: /cooling.title/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('checkbox', { name: /lighting.title/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByText('featuresOnboarding.continue'));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ lighting: true, cooling: false, monitoring: true, diagnostics: false }));
    expect(savePreferences).toHaveBeenCalledWith({
      features: { lighting: true, cooling: false, monitoring: true, diagnostics: false },
    });
  });

  it('on a fresh install ignores the stored pillars and starts all on', () => {
    Object.assign(current, { cooling: false });
    render(<FeaturesOnboardingScreen open onComplete={vi.fn()} />);
    for (const box of screen.getAllByRole('checkbox')) expect(box).toHaveAttribute('aria-checked', 'true');
  });

  it('on a replay blocks Continue until the preferences are hydrated, then uses the hydrated pillars', async () => {
    Object.assign(current, { hydrated: false });
    vi.mocked(completeFeaturesOnboarding).mockResolvedValue({ completed: true, featuresCompleted: true });
    const onComplete = vi.fn();
    const { rerender } = render(<FeaturesOnboardingScreen open fromCurrent onComplete={onComplete} />);

    const cont = screen.getByText('featuresOnboarding.continue').closest('button')!;
    expect(cont).toBeDisabled();
    fireEvent.click(cont);
    expect(savePreferences).not.toHaveBeenCalled();

    Object.assign(current, { hydrated: true, monitoring: false });
    rerender(<FeaturesOnboardingScreen open fromCurrent onComplete={onComplete} />);
    expect(screen.getByRole('checkbox', { name: /nav.monitoring/ })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByText('featuresOnboarding.continue'));

    await waitFor(() => expect(savePreferences).toHaveBeenCalledWith({
      features: { lighting: true, cooling: true, monitoring: false, diagnostics: true },
    }));
  });

  it('on a replay ignores Enter until the preferences are hydrated', () => {
    Object.assign(current, { hydrated: false });
    render(<FeaturesOnboardingScreen open fromCurrent onComplete={vi.fn()} />);

    fireEvent.keyDown(document, { key: 'Enter' });

    expect(savePreferences).not.toHaveBeenCalled();
  });

  it('keeps untouched pillars following the current values after another is toggled', () => {
    Object.assign(current, { cooling: false });
    const { rerender } = render(<FeaturesOnboardingScreen open fromCurrent onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /lighting.title/ }));

    Object.assign(current, { cooling: true });
    rerender(<FeaturesOnboardingScreen open fromCurrent onComplete={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: /lighting.title/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('checkbox', { name: /cooling.title/ })).toHaveAttribute('aria-checked', 'true');
  });
});
