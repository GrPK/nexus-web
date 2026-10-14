import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PanelMixerSlider } from './PanelMixerSlider';

beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

function setup() {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  render(<PanelMixerSlider value={40} ariaLabel="Level" onChange={onChange} onCommit={onCommit} />);
  const track = screen.getByRole('slider');
  track.getBoundingClientRect = () => ({ x: 0, y: 100, top: 100, left: 0, right: 40, bottom: 200, width: 40, height: 100, toJSON: () => {} });
  const hitbox = track.parentElement as HTMLElement;
  return { hitbox, onChange, onCommit };
}

describe('PanelMixerSlider pointer end', () => {
  it('commits the release position on pointerup', () => {
    const { hitbox, onCommit } = setup();
    fireEvent.pointerDown(hitbox, { clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(hitbox, { clientY: 120, pointerId: 1 });
    expect(onCommit).toHaveBeenCalledWith(80);
  });

  it('a cancel with no moves commits the pointerdown value, not max', () => {
    const { hitbox, onChange, onCommit } = setup();
    fireEvent.pointerDown(hitbox, { clientY: 150, pointerId: 1 });
    fireEvent.pointerCancel(hitbox, { clientY: 0, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith(50);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(50);
  });

  it('a cancel after moves commits the last tracked move, not the cancel position', () => {
    const { hitbox, onCommit } = setup();
    fireEvent.pointerDown(hitbox, { clientY: 150, pointerId: 1 });
    fireEvent.pointerMove(hitbox, { clientY: 130, pointerId: 1 });
    fireEvent.pointerCancel(hitbox, { clientY: 0, pointerId: 1 });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(70);
  });
});
