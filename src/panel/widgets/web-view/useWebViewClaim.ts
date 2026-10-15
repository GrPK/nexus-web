import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { webViewHost, type WebViewHostSnapshot } from '../../webview/webViewHost';

/**
 * Registers the returned element as the rect of this widget's native view.
 * `ref` goes on the placeholder; with `enabled` false nothing is registered
 * and the host is never touched.
 */
export function useWebViewClaim(opts: { id: string; url: string | null; immersive: boolean; enabled: boolean }) {
  const { id, url, immersive, enabled } = opts;
  const [element, setElement] = useState<HTMLElement | null>(null);
  const snapshot: WebViewHostSnapshot = useSyncExternalStore(webViewHost.subscribe, webViewHost.getSnapshot);
  const urlRef = useRef(url);
  urlRef.current = url;
  const handleRef = useRef<ReturnType<typeof webViewHost.register> | null>(null);

  useEffect(() => {
    if (!enabled || !element || !urlRef.current) return;
    const handle = webViewHost.register({ id, url: urlRef.current, element, immersive });
    handleRef.current = handle;
    return () => {
      handleRef.current = null;
      handle.release();
    };
  }, [enabled, element, id, immersive]);

  useEffect(() => {
    if (url) handleRef.current?.setUrl(url);
  }, [url]);

  return { ref: setElement, snapshot };
}
