import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LightingFeatureSeed } from './LightingFeatureSeed';

const state = vi.hoisted(() => ({ lighting: true, hydrated: true }));
vi.mock('../hooks/useUiSettings', () => ({
  useFeatureFlags: () => ({ lighting: state.lighting, cooling: true, monitoring: true, diagnostics: true }),
  useUiSettingsHydrated: () => state.hydrated,
}));

describe('LightingFeatureSeed', () => {
  beforeEach(() => { state.lighting = true; state.hydrated = true; });

  it('reports Lighting off when the features step is not shown and Lighting is already off', () => {
    state.lighting = false;
    const onOff = vi.fn();
    render(<LightingFeatureSeed active onLightingOff={onOff} />);
    expect(onOff).toHaveBeenCalledTimes(1);
  });

  it('stays quiet while the features step still decides, while unhydrated, and when Lighting is on', () => {
    const onOff = vi.fn();
    state.lighting = false;
    const { rerender } = render(<LightingFeatureSeed active={false} onLightingOff={onOff} />);
    state.hydrated = false;
    rerender(<LightingFeatureSeed active onLightingOff={onOff} />);
    state.hydrated = true; state.lighting = true;
    rerender(<LightingFeatureSeed active onLightingOff={onOff} />);
    expect(onOff).not.toHaveBeenCalled();
  });
});
