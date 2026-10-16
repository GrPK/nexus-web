import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResendVerification } from './ResendVerification';
import { RESEND_COOLDOWN_SECONDS } from './resendCooldown';

vi.mock('../../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      let text = key;
      if (params) for (const [k, v] of Object.entries(params)) text += ` ${k}=${v}`;
      return text;
    },
  }),
}));

describe('ResendVerification', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('is disabled with the remaining seconds, then sends once and re-arms the cooldown', async () => {
    const resendVerification = vi.fn().mockResolvedValue(true);
    render(<ResendVerification backend={{ resendVerification } as never} email="a@b.com" />);

    const waiting = screen.getByRole('button', { name: `account.verify.resendWait seconds=${RESEND_COOLDOWN_SECONDS}` });
    expect((waiting as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(waiting);
    expect(resendVerification).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(RESEND_COOLDOWN_SECONDS * 1000); });
    const ready = screen.getByRole('button', { name: 'account.verify.resend' });
    expect((ready as HTMLButtonElement).disabled).toBe(false);

    await act(async () => { fireEvent.click(ready); });
    expect(resendVerification).toHaveBeenCalledWith('a@b.com');
    expect(screen.getByText('account.verify.resendSent')).toBeTruthy();
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the generic error when the request fails', async () => {
    const resendVerification = vi.fn().mockResolvedValue(false);
    render(<ResendVerification backend={{ resendVerification } as never} email="a@b.com" />);
    act(() => { vi.advanceTimersByTime(RESEND_COOLDOWN_SECONDS * 1000); });

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'account.verify.resend' })); });

    expect(screen.getByRole('alert').textContent).toBe('account.error.generic');
  });
});
