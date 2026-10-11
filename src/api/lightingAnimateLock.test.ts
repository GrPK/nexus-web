import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAnimateDeviceLocks, setAnimateDeviceLock } from './lighting';
import { setActiveTransport } from './service';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

// A service predating the route answers the SPA index: 200 with a body that is not JSON.
function indexResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError('Unexpected token <'); },
    text: async () => '<!doctype html>',
  } as unknown as Response;
}

beforeEach(() => {
  localStorage.setItem('nexus_token', 'test-token');
  setActiveTransport('lan');
});

afterEach(() => {
  vi.unstubAllGlobals();
  setActiveTransport(null);
});

describe('setAnimateDeviceLock', () => {
  it('posts the device and effect, and resolves true on 200', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { error: false, msg: 'Ok' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(setAnimateDeviceLock('d1', 'plasma')).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/devices/lighting-devices/animate-lock');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ id: 'd1', effect: 'plasma' });
  });

  it('sends a null effect to unlock', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { error: false, msg: 'Ok' }));
    vi.stubGlobal('fetch', fetchMock);
    await setAnimateDeviceLock('d1', null);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ id: 'd1', effect: null });
  });

  it.each([409, 400, 404])('resolves false on %i so the caller rolls back', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(status, { error: true, msg: 'no' })));
    await expect(setAnimateDeviceLock('d1', 'plasma')).resolves.toBe(false);
  });
});

describe('fetchAnimateDeviceLocks', () => {
  it('returns the locks map', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { locks: { d1: 'plasma' } })));
    await expect(fetchAnimateDeviceLocks()).resolves.toEqual({ d1: 'plasma' });
  });

  it('is null from a service that predates the route', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => indexResponse()));
    await expect(fetchAnimateDeviceLocks()).resolves.toBeNull();
  });
});
