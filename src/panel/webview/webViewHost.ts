import {
  CAPS_TIMEOUT_MS,
  HEARTBEAT_MS,
  WEBVIEW_PROTOCOL_VERSION,
  detectTransport,
  parseInbound,
  type WebViewCommandName,
  type WebViewInbound,
  type WebViewLoadState,
  type WebViewOutbound,
  type WebViewRect,
  type WebViewSyncView,
  type WebViewTransport,
} from './webViewProtocol';
import { computeVisible } from './webViewVisibility';

export type WebViewHostStatus = 'idle' | 'pending' | 'supported' | 'unsupported';

export interface WebViewViewState {
  state: WebViewLoadState;
  code?: string;
  canGoBack: boolean;
}

export interface WebViewHostSnapshot {
  status: WebViewHostStatus;
  interactive: boolean;
  maxViews: number;
  views: Readonly<Record<string, WebViewViewState>>;
}

export interface WebViewClaimInput {
  /** Widget instance id. The tile and the immersive view of one widget share it. */
  id: string;
  /** The configured url, never the view's current location. */
  url: string;
  /** The placeholder element whose rect the native view takes. */
  element: HTMLElement;
  /** The immersive claim owns the rect and the input while it exists. */
  immersive: boolean;
}

export interface WebViewClaimHandle {
  setUrl: (url: string) => void;
  release: () => void;
}

interface ClaimRecord extends WebViewClaimInput {
  key: number;
}

// How long layout keeps being re-measured after a transition or animation
// starts, so a sliding overlay carries the native view with it.
const BURST_MS = 600;

const EMPTY_KEY = JSON.stringify([null, []]);

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * The single owner of the native web-view bridge for the whole panel page.
 * Widget instances register claims; the host turns the set of claims into the
 * declarative `sync` stream. One native view exists per widget id: the tile
 * and the immersive view are two claims on the same id, and the sync is
 * derived from the claim set at flush time, so swapping one claim for the
 * other never produces a message without the id.
 */
export class WebViewHost {
  private claims = new Map<number, ClaimRecord>();
  private nextKey = 1;
  private transport: WebViewTransport | null = null;
  private status: WebViewHostStatus = 'idle';
  private interactive = false;
  private maxViews = 0;
  private viewStates: Record<string, WebViewViewState> = {};
  private snapshot: WebViewHostSnapshot = { status: 'idle', interactive: false, maxViews: 0, views: {} };
  private listeners = new Set<() => void>();
  private suppressed = false;
  private pageHidden = false;
  private seq = 0;
  private lastKey: string | null = null;
  private rafPending = false;
  private burstUntil = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private capsTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private teardown: Array<() => void> = [];

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  readonly getSnapshot = (): WebViewHostSnapshot => this.snapshot;

  register(input: WebViewClaimInput): WebViewClaimHandle {
    if (this.status === 'idle') this.start();
    const rec: ClaimRecord = { ...input, key: this.nextKey++ };
    this.claims.set(rec.key, rec);
    this.resizeObserver?.observe(rec.element);
    this.ensureHeartbeat();
    this.schedule();
    return {
      setUrl: (url: string) => {
        if (rec.url === url) return;
        rec.url = url;
        this.schedule();
      },
      release: () => {
        if (!this.claims.delete(rec.key)) return;
        this.resizeObserver?.unobserve(rec.element);
        this.schedule();
      },
    };
  }

  /** Edit or drag mode: every native view hides while true. */
  setSuppressed(value: boolean): void {
    if (this.suppressed === value) return;
    this.suppressed = value;
    this.schedule();
  }

  sendCommand(id: string, command: WebViewCommandName): void {
    if (!this.transport || this.status !== 'supported') return;
    this.transport.post({ type: 'nexus.webview.command', id, command });
    if (command === 'reload') {
      this.viewStates = { ...this.viewStates, [id]: { state: 'loading', canGoBack: this.viewStates[id]?.canGoBack ?? false } };
      this.emit();
      this.schedule();
    }
  }

  /** Detaches every listener and timer. Tests and hot reload only. */
  dispose(): void {
    for (const off of this.teardown) off();
    this.teardown = [];
    this.stopHeartbeat();
    if (this.capsTimer) clearTimeout(this.capsTimer);
    this.capsTimer = null;
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.resizeObserver = null;
    this.mutationObserver = null;
    this.claims.clear();
    this.listeners.clear();
  }

  private start(): void {
    this.transport = detectTransport();
    if (!this.transport) {
      this.status = 'unsupported';
      this.emit();
      return;
    }
    this.status = 'pending';
    this.attachListeners();
    this.transport.post({ type: 'nexus.webview.hello', version: WEBVIEW_PROTOCOL_VERSION });
    // A late caps still upgrades the status, so the timeout only picks the
    // placeholder shown meanwhile.
    this.capsTimer = setTimeout(() => {
      this.capsTimer = null;
      if (this.status === 'pending') {
        this.status = 'unsupported';
        this.emit();
      }
    }, CAPS_TIMEOUT_MS);
    this.emit();
  }

  private on<K extends keyof WindowEventMap>(
    target: Window, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions | boolean,
  ): void {
    target.addEventListener(type, fn, opts);
    this.teardown.push(() => target.removeEventListener(type, fn, opts));
  }

  private attachListeners(): void {
    const nudge = () => this.schedule();
    // A burst-worthy event: layout may keep moving for a while after it.
    const burst = () => { this.burstUntil = Date.now() + BURST_MS; this.schedule(); };

    const onCustom = (e: Event) => this.handleInbound((e as CustomEvent).detail);
    window.addEventListener('nexus-webview', onCustom);
    this.teardown.push(() => window.removeEventListener('nexus-webview', onCustom));

    const wv2 = (window as unknown as { chrome?: { webview?: EventTarget } }).chrome?.webview;
    if (wv2 && typeof wv2.addEventListener === 'function') {
      const onMsg = (e: Event) => this.handleInbound((e as MessageEvent).data);
      wv2.addEventListener('message', onMsg);
      this.teardown.push(() => wv2.removeEventListener('message', onMsg));
    }

    this.on(window, 'resize', nudge);
    this.on(window, 'orientationchange', burst);
    this.on(window, 'scroll', nudge, { capture: true, passive: true });
    this.on(window, 'transitionrun', burst, true);
    this.on(window, 'transitionend', burst, true);
    this.on(window, 'animationstart', burst, true);
    this.on(window, 'animationend', burst, true);
    this.on(window, 'pagehide', () => this.onPageHide());
    this.on(window, 'pageshow', () => this.onPageShow());
    const onVisibility = () => this.flush(false);
    document.addEventListener('visibilitychange', onVisibility);
    this.teardown.push(() => document.removeEventListener('visibilitychange', onVisibility));

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(nudge);
    }
    if (typeof MutationObserver !== 'undefined' && document.body) {
      // Overlays are added to the DOM; childList is enough to notice them.
      this.mutationObserver = new MutationObserver(nudge);
      this.mutationObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  private handleInbound(raw: unknown): void {
    const msg: WebViewInbound | null = parseInbound(raw);
    if (!msg) return;
    if (msg.type === 'nexus.webview.caps') {
      if (this.capsTimer) { clearTimeout(this.capsTimer); this.capsTimer = null; }
      this.status = msg.supported ? 'supported' : 'unsupported';
      this.interactive = msg.interactive;
      this.maxViews = msg.maxViews;
      this.emit();
      if (this.status === 'supported') this.flush(true);
      return;
    }
    this.viewStates = {
      ...this.viewStates,
      [msg.id]: { state: msg.state, code: msg.code, canGoBack: msg.canGoBack },
    };
    this.emit();
    // An error or crash hides the native view, so the placeholder shows.
    this.schedule();
  }

  private onPageHide(): void {
    this.pageHidden = true;
    if (this.transport && this.status === 'supported') {
      this.send([]);
    }
    this.lastKey = EMPTY_KEY;
  }

  private onPageShow(): void {
    if (!this.pageHidden) return;
    this.pageHidden = false;
    this.lastKey = null;
    this.flush(true);
  }

  private ensureHeartbeat(): void {
    if (this.heartbeat || !this.transport) return;
    this.heartbeat = setInterval(() => this.flush(true), HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  // rAF-throttled: any number of triggers in a frame produce one measurement.
  private schedule(): void {
    if (this.rafPending || !this.transport) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.flush(false);
      if (Date.now() < this.burstUntil) this.schedule();
    });
  }

  private emit(): void {
    this.snapshot = {
      status: this.status,
      interactive: this.interactive,
      maxViews: this.maxViews,
      views: this.viewStates,
    };
    for (const l of [...this.listeners]) l();
  }

  private buildViews(): WebViewSyncView[] {
    const supported = this.status === 'supported';
    const documentVisible = document.visibilityState !== 'hidden';
    const hit = (x: number, y: number) => document.elementFromPoint(x, y);
    const winners = new Map<string, ClaimRecord>();
    for (const c of this.claims.values()) {
      const cur = winners.get(c.id);
      if (!cur || (c.immersive && !cur.immersive)) winners.set(c.id, c);
    }
    const views: WebViewSyncView[] = [];
    for (const c of winners.values()) {
      const r = c.element.getBoundingClientRect();
      const rect: WebViewRect = { x: round1(r.left), y: round1(r.top), w: round1(r.width), h: round1(r.height) };
      const st = this.viewStates[c.id]?.state;
      views.push({
        id: c.id,
        url: c.url,
        rect,
        interactive: c.immersive && this.interactive,
        visible: computeVisible({
          supported,
          documentVisible,
          suppressed: this.suppressed,
          connected: c.element.isConnected,
          loadFailed: st === 'error' || st === 'crashed',
          rect,
          el: c.element,
          hit,
        }),
      });
    }
    return views;
  }

  private flush(force: boolean): void {
    if (!this.transport || this.status !== 'supported' || this.pageHidden) return;
    const views = this.buildViews();
    if (views.length === 0 && this.lastKey === null) return;
    const viewport = { w: window.innerWidth, h: window.innerHeight };
    const key = JSON.stringify([viewport, views]);
    if (views.length === 0) {
      if (this.lastKey !== EMPTY_KEY) this.send([]);
      this.lastKey = EMPTY_KEY;
      this.stopHeartbeat();
      return;
    }
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    this.ensureHeartbeat();
    this.send(views);
  }

  private send(views: WebViewSyncView[]): void {
    if (!this.transport) return;
    const msg: WebViewOutbound = {
      type: 'nexus.webview.sync',
      seq: ++this.seq,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      views,
    };
    this.transport.post(msg);
  }
}

export const webViewHost = new WebViewHost();
