import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RateCapSelect } from './RateCapSelect';

vi.mock('../../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

const api = vi.hoisted(() => ({ setLightingMaxRate: vi.fn() }));
vi.mock('../../../../api/lighting', () => ({ setLightingMaxRate: api.setLightingMaxRate }));

describe('RateCapSelect', () => {
  it('shows Off when no cap is stored and lists the Hz options', () => {
    render(<RateCapSelect id="d1" value={null} onFail={vi.fn()} />);
    const trigger = screen.getByRole('button');
    expect(trigger.textContent).toContain('lighting.ledMap.rateCapOff');
    fireEvent.click(trigger);
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual([
      'lighting.ledMap.rateCapOff',
      ...[30, 20, 15, 10, 5, 1].map(hz => `lighting.ledMap.rateCapHz:{"hz":${hz}}`),
    ]);
  });

  it('posts the chosen rate and keeps it', async () => {
    api.setLightingMaxRate.mockResolvedValue({ error: false, msg: '' });
    render(<RateCapSelect id="d1" value={null} onFail={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: 'lighting.ledMap.rateCapHz:{"hz":10}' }));
    expect(api.setLightingMaxRate).toHaveBeenCalledWith('d1', 10);
    await waitFor(() => expect(screen.getByRole('button').textContent).toContain('"hz":10'));
  });

  it('posts null for Off and reverts with a failure callback on error', async () => {
    api.setLightingMaxRate.mockResolvedValue({ error: true, msg: 'x' });
    const onFail = vi.fn();
    render(<RateCapSelect id="d1" value={15} onFail={onFail} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: 'lighting.ledMap.rateCapOff' }));
    expect(api.setLightingMaxRate).toHaveBeenCalledWith('d1', null);
    await waitFor(() => expect(onFail).toHaveBeenCalled());
    expect(screen.getByRole('button').textContent).toContain('"hz":15');
  });
});
