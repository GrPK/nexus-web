import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadEffect, listEffects, publishEffect, unpublishEffect } from './effectMarket';

const authFetchWithStatus = vi.fn();
vi.mock('./service', () => ({ authFetchWithStatus: (...a: unknown[]) => authFetchWithStatus(...a) }));

const reply = (status: number, body?: unknown) => ({
  response: new Response(body === undefined ? null : JSON.stringify(body), { status }),
  status,
});

describe('effectMarket', () => {
  beforeEach(() => authFetchWithStatus.mockReset());

  it('sends only the query keys that are set', async () => {
    authFetchWithStatus.mockResolvedValue(reply(200, { items: [], page: 1, limit: 24, hasMore: false }));
    const res = await listEffects({ sort: 'new', author: 'alice', q: '' });
    expect(res.ok).toBe(true);
    expect(authFetchWithStatus.mock.calls[0][0]).toBe('/lighting/effect-market?sort=new&author=alice');
  });

  it('reads the service and cloud refusals', async () => {
    authFetchWithStatus.mockResolvedValueOnce(reply(403, { error: true, msg: 'sign_in_required' }));
    expect(await downloadEffect('id1')).toEqual({ ok: false, error: 'sign_in_required' });
    authFetchWithStatus.mockResolvedValueOnce(reply(403, { statusCode: 403, message: 'listing_limit', error: 'Forbidden' }));
    expect(await publishEffect({ name: 'a', recipe: {} })).toEqual({ ok: false, error: 'listing_limit' });
    authFetchWithStatus.mockResolvedValueOnce(reply(503, { error: true, msg: 'market_unavailable' }));
    expect(await listEffects()).toEqual({ ok: false, error: 'unavailable' });
    authFetchWithStatus.mockResolvedValueOnce(reply(404, { statusCode: 404, message: 'Not Found' }));
    expect(await downloadEffect('gone')).toEqual({ ok: false, error: 'not_found' });
    authFetchWithStatus.mockResolvedValueOnce({ response: null, status: 0 });
    expect(await listEffects()).toEqual({ ok: false, error: 'unavailable' });
  });

  it('treats an empty 204 as success', async () => {
    authFetchWithStatus.mockResolvedValue(reply(204));
    expect(await unpublishEffect('id1')).toEqual({ ok: true, value: undefined });
    expect(authFetchWithStatus.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  });
});
