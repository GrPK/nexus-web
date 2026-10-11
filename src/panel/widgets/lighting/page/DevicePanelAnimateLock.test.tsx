import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DevicePanel } from './DevicePanel';
import type { LightingDevice } from '../../../../api/lighting';

vi.mock('../../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    language: 'en',
  }),
}));

const device = (id: string, name: string): LightingDevice => ({
  id, name, ledsOn: true, ledCount: 10,
  canvasX: 0, canvasY: 0, canvasW: 1, canvasH: 1, canvasRotation: 0,
});

const devices = [device('d1', 'One'), device('d2', 'Two'), device('d3', 'Three')];

function renderRail(over: Partial<React.ComponentProps<typeof DevicePanel>> = {}) {
  const onSetAnimateLock = vi.fn();
  const onSetLock = vi.fn();
  render(
    <DevicePanel
      devices={devices}
      selectedIds={new Set(['d1', 'd2', 'd3'])}
      onSetSelection={() => {}}
      onTogglePower={() => {}}
      onSetPower={() => {}}
      onToggleControlled={() => {}}
      onSetControlled={() => {}}
      lightingOff={false}
      onOpenSettings={() => {}}
      onSetLock={onSetLock}
      onSetAnimateLock={onSetAnimateLock}
      {...over}
    />,
  );
  return { onSetAnimateLock, onSetLock };
}

const openFirstMenu = () => fireEvent.click(screen.getAllByRole('button', { name: 'lighting.devices.moreActions' })[0]);

describe('DevicePanel animation lock bulk rows', () => {
  it('locks only the unlocked members', () => {
    const { onSetAnimateLock } = renderRail({ animateLockable: true, animateLocks: { d3: 'plasma' } });
    openFirstMenu();
    fireEvent.click(screen.getByText('lighting.devices.lockAnimationCount.other:{"count":2}'));
    expect(onSetAnimateLock).toHaveBeenCalledWith(['d1', 'd2'], true);
  });

  it('unlocks only the locked members', () => {
    const { onSetAnimateLock } = renderRail({ animateLockable: true, animateLocks: { d3: 'plasma' } });
    openFirstMenu();
    fireEvent.click(screen.getByText('lighting.devices.unlockAnimationCount.one:{"count":1}'));
    expect(onSetAnimateLock).toHaveBeenCalledWith(['d3'], false);
  });

  it('offers no Lock row outside Animate, but still offers Unlock', () => {
    renderRail({ animateLockable: false, animateLocks: { d3: 'plasma' } });
    openFirstMenu();
    expect(screen.queryByText(/\.lockAnimationCount/)).toBeNull();
    expect(screen.getByText('lighting.devices.unlockAnimationCount.one:{"count":1}')).toBeTruthy();
  });

  it('leaves a static-locked member out of the animation lock count', () => {
    renderRail({
      animateLockable: true,
      devicePicks: { d1: { key: 'red', slot: 0, hex: '#ff0000', locked: true } },
    });
    openFirstMenu();
    expect(screen.getByText('lighting.devices.lockAnimationCount.other:{"count":2}')).toBeTruthy();
  });

  it('offers no static lock on an animation-locked member', () => {
    renderRail({
      lockable: true,
      animateLocks: { d1: 'plasma', d2: 'plasma' },
      devicePicks: {
        d1: { key: 'plasma', slot: 0, hex: '' },
        d2: { key: 'plasma', slot: 0, hex: '' },
        d3: { key: 'red', slot: 0, hex: '#ff0000' },
      },
    });
    openFirstMenu();
    expect(screen.queryByText('lighting.devices.lockLookCount.one:{"count":1}')).not.toBeNull();
    expect(screen.queryByText(/lockLookCount\.other/)).toBeNull();
  });
});
