import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPins, setPins, startScreenMirror } from './lighting';
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

const bodyOf = (fetchMock: ReturnType<typeof vi.fn>) => {
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
};

describe('setPins', () => {
  it('posts the ids and the pin, and resolves true on 200', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { error: false, msg: 'Ok' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(setPins(['d1', 'd2'], { kind: 'animate', effect: 'plasma' })).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/devices/lighting-devices/pins');
    expect(init.method).toBe('POST');
    expect(bodyOf(fetchMock)).toEqual({ ids: ['d1', 'd2'], pin: { kind: 'animate', effect: 'plasma' } });
  });

  it('sends a null pin to unpin', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { error: false, msg: 'Ok' }));
    vi.stubGlobal('fetch', fetchMock);
    await setPins(['d1'], null);
    expect(bodyOf(fetchMock)).toEqual({ ids: ['d1'], pin: null });
  });

  it.each([409, 400, 404])('resolves false on %i so the caller rolls back', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(status, { error: true, msg: 'no' })));
    await expect(setPins(['d1'], { kind: 'mirror' })).resolves.toBe(false);
  });
});

describe('fetchPins', () => {
  it('returns the pins map', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { pins: { d1: { kind: 'mirror' } } })));
    await expect(fetchPins()).resolves.toEqual({ d1: { kind: 'mirror' } });
  });

  it('is null from a service that predates the route', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => indexResponse()));
    await expect(fetchPins()).resolves.toBeNull();
  });
});

describe('startScreenMirror', () => {
  it('sends no monitor key when the caller is not choosing a screen, so the persisted one stays', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { error: false, msg: 'Ok' }));
    vi.stubGlobal('fetch', fetchMock);
    await startScreenMirror(1, 1, undefined, 0, 0);
    expect(bodyOf(fetchMock)).not.toHaveProperty('monitor');
  });

  it('sends the monitor the picker chose, including the explicit default screen', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { error: false, msg: 'Ok' }));
    vi.stubGlobal('fetch', fetchMock);
    await startScreenMirror(1, 1, 'DISPLAY2', 0, 0);
    expect(bodyOf(fetchMock).monitor).toBe('DISPLAY2');
    fetchMock.mockClear();
    await startScreenMirror(1, 1, '', 0, 0);
    expect(bodyOf(fetchMock).monitor).toBe('');
  });
});
