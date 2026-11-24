// Host-side settings facade for the widget bridge. Talks to
// `/apps-api/installed/{id}/settings` and broadcasts changes to
// subscribers (the Tier 2 worker host and the in-host settings form).

import { fetchService, loopbackFetchInit, resolveHttp } from '../api/service';
import { getToken, handleUnauthorized } from '../api/auth';

export interface WidgetSettingsDocument {
  widgetId: string;
  values: Record<string, unknown>;
}

export interface WidgetSettingsPatch {
  set?: Record<string, unknown>;
  reset?: string[];
}

export type WidgetSettingsListener = (values: Record<string, unknown>) => void;

/** Structural equality for JSON-shaped settings values (key order ignored). */
export function settingsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  const ob = b as Record<string, unknown>;
  return ka.every((k) => k in ob && settingsEqual((a as Record<string, unknown>)[k], ob[k]));
}

/** Multiplex topic the service broadcasts a full settings document on after every write. */
export function appSettingsTopic(instanceId: string): string {
  return `app-settings/${instanceId}`;
}

const shared = new Map<string, WidgetSettingsBridge>();

/**
 * Lazy-loaded, cached settings document with a subscriber list. One instance
 * per widget surfaced by the dashboard. The Tier 2 worker host (read via
 * `nexus.settings.get()`) and the in-host React settings form (read + patch)
 * both talk to this.
 */
export class WidgetSettingsBridge {
  /** Placement id, NOT the widget type - config is per-instance. */
  private readonly instanceId: string;
  private values: Record<string, unknown> = {};
  private loaded = false;
  private readonly listeners = new Set<WidgetSettingsListener>();

  constructor(instanceId: string) { this.instanceId = instanceId; }

  /** One bridge per placement id, so the settings panel and the running tile see each other's writes. */
  static for(instanceId: string): WidgetSettingsBridge {
    let b = shared.get(instanceId);
    if (!b) { b = new WidgetSettingsBridge(instanceId); shared.set(instanceId, b); }
    return b;
  }

  /** Test hook: drops every shared instance. */
  static _resetSharedForTests(): void { shared.clear(); }

  /** Adopts a full settings document from elsewhere (a broadcast). No-op when equal to the cache. */
  apply(values: Record<string, unknown>): void {
    if (this.loaded && settingsEqual(this.values, values)) return;
    this.values = values;
    this.loaded = true;
    this.fire();
  }

  /** Returns the cached values. Triggers a load on first call. */
  get(): Record<string, unknown> {
    if (!this.loaded) {
      // Fire-and-forget initial load; subscribers receive a `changed` event
      // when it lands. Synchronous callers see `{}` until then.
      void this.load();
    }
    return this.values;
  }

  async load(): Promise<Record<string, unknown>> {
    const doc = await fetchService<WidgetSettingsDocument>(
      `/apps-api/instance/${encodeURIComponent(this.instanceId)}/settings`,
    );
    if (doc?.values) this.apply(doc.values);
    return this.values;
  }

  async patch(patch: WidgetSettingsPatch): Promise<Record<string, unknown>> {
    const token = await getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    let res = await fetch(resolveHttp(`/apps-api/instance/${encodeURIComponent(this.instanceId)}/settings`), {
      ...loopbackFetchInit, method: 'PATCH', headers, body: JSON.stringify(patch),
    });
    if (res.status === 401) {
      const next = await handleUnauthorized();
      if (next) {
        headers['Authorization'] = `Bearer ${next}`;
        res = await fetch(resolveHttp(`/apps-api/instance/${encodeURIComponent(this.instanceId)}/settings`), {
          ...loopbackFetchInit, method: 'PATCH', headers, body: JSON.stringify(patch),
        });
      }
    }
    if (!res.ok) return this.values;
    const doc = (await res.json()) as WidgetSettingsDocument;
    this.apply(doc.values ?? {});
    return this.values;
  }

  onChange(listener: WidgetSettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private fire(): void {
    for (const l of this.listeners) {
      try { l(this.values); } catch { /* listener bug, swallow */ }
    }
  }
}
