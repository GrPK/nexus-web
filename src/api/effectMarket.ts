// Marketplace lighting effects: Shader Studio recipes published under an
// account's username. Every call goes through the local service, which holds
// the account session and forwards to the cloud listing.

import { authFetchWithStatus } from './service';

export interface EffectListing {
  id: string;
  name: string;
  /** The publishing account's username. */
  author: string;
  /** A Shader Studio recipe; unchecked until parsed against this build's block catalog. */
  recipe: unknown;
  audio: boolean;
  /** Distinct accounts that downloaded it, the author excluded. */
  downloads: number;
  createdAt: string;
  updatedAt: string;
}

export interface EffectPage {
  items: EffectListing[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export type EffectSort = 'popular' | 'new';

export interface EffectQuery {
  sort?: EffectSort;
  author?: string;
  q?: string;
  page?: number;
  limit?: number;
}

/** `sign_in_required` means no account is linked or its session was refused. */
export type EffectMarketError = 'sign_in_required' | 'unavailable' | 'not_found' | 'listing_limit' | 'duplicate' | 'name_not_allowed' | 'failed';

export type EffectMarketResult<T> = { ok: true; value: T } | { ok: false; error: EffectMarketError };

const BASE = '/lighting/effect-market';

function errorFor(status: number, body: { msg?: unknown; message?: unknown } | null): EffectMarketError {
  const reason = typeof body?.msg === 'string' ? body.msg : typeof body?.message === 'string' ? body.message : '';
  if (reason === 'sign_in_required') return 'sign_in_required';
  if (reason === 'listing_limit') return 'listing_limit';
  if (reason === 'name_not_allowed') return 'name_not_allowed';
  if (reason === 'duplicate' || status === 409) return 'duplicate';
  if (status === 404) return 'not_found';
  if (status === 0 || status === 503 || reason === 'market_unavailable') return 'unavailable';
  return 'failed';
}

async function call<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: unknown): Promise<EffectMarketResult<T>> {
  const { response, status } = await authFetchWithStatus(path, { method, body, cache: method === 'GET' ? 'no-store' : undefined });
  if (!response) return { ok: false, error: errorFor(status, null) };
  if (response.status === 204) return { ok: true, value: undefined as T };
  const json = await response.json().catch(() => null) as (T & { error?: unknown; msg?: unknown; message?: unknown }) | null;
  if (!response.ok || !json || json.error === true) return { ok: false, error: errorFor(response.status, json) };
  return { ok: true, value: json };
}

export function listEffects(query: EffectQuery = {}): Promise<EffectMarketResult<EffectPage>> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') q.set(k, String(v));
  const qs = q.toString();
  return call<EffectPage>(qs ? `${BASE}?${qs}` : BASE);
}

export function getEffect(id: string): Promise<EffectMarketResult<EffectListing>> {
  return call<EffectListing>(`${BASE}/${encodeURIComponent(id)}`);
}

/** Records the download against the signed-in account and returns the listing with its recipe. */
export function downloadEffect(id: string): Promise<EffectMarketResult<EffectListing>> {
  return call<EffectListing>(`${BASE}/${encodeURIComponent(id)}/download`, 'POST', {});
}

export interface EffectPublishBody {
  name: string;
  recipe: unknown;
}

export function publishEffect(body: EffectPublishBody): Promise<EffectMarketResult<EffectListing>> {
  return call<EffectListing>(BASE, 'POST', body);
}

export function updateEffect(id: string, body: EffectPublishBody): Promise<EffectMarketResult<EffectListing>> {
  return call<EffectListing>(`${BASE}/${encodeURIComponent(id)}`, 'PUT', body);
}

export function unpublishEffect(id: string): Promise<EffectMarketResult<void>> {
  return call<void>(`${BASE}/${encodeURIComponent(id)}`, 'DELETE');
}
