import { Globe, RotateCw } from 'lucide-react';
import { Button } from '../../../components/common/Button/Button';
import { useTranslation } from '../../../lib/i18n';
import { webViewHost } from '../../webview/webViewHost';
import { usePanelPreview } from '../common/PanelPreviewContext';
import type { WidgetProps } from '../types';
import { normalizeWebViewUrl, webViewHostName } from './webViewUrl';
import { useWebViewClaim } from './useWebViewClaim';
import styles from './WebViewWidget.module.scss';

interface WebViewSurfaceProps extends Pick<WidgetProps, 'widget' | 'surface' | 'editorPreview'> {
  immersive: boolean;
}

/**
 * The placeholder the native view is laid over. Its rect is the native rect;
 * what it shows is only seen while the native view is hidden, not yet loaded,
 * failed, or absent on this display.
 */
export function WebViewSurface({ widget, surface, editorPreview, immersive }: WebViewSurfaceProps) {
  const { t } = useTranslation();
  const preview = usePanelPreview();
  const url = normalizeWebViewUrl(widget.config?.url);
  // The catalog, the editor canvas and the embedded desktop dashboard never talk to a native host.
  const native = !preview && !editorPreview && surface !== 'desktop' && url !== null;
  const { ref, snapshot } = useWebViewClaim({ id: widget.id, url, immersive, enabled: native });

  const view = snapshot.views[widget.id];
  const failed = native && (view?.state === 'error' || view?.state === 'crashed');
  const unsupported = native && snapshot.status === 'unsupported';

  let title: string;
  let hint: string | undefined;
  if (url === null) {
    title = t('panel.widget.web-view.setUrl');
  } else if (unsupported) {
    title = t('panel.widget.web-view.unsupported');
    hint = webViewHostName(url);
  } else if (failed) {
    title = view?.state === 'crashed' ? t('panel.widget.web-view.crashed') : t('panel.widget.web-view.error');
    hint = webViewHostName(url);
  } else {
    title = webViewHostName(url);
    hint = native && view?.state !== 'loaded' ? t('panel.widget.web-view.loading') : undefined;
  }

  return (
    <div ref={ref} className={styles.surface} data-immersive={immersive ? 'true' : undefined}>
      <div className={styles.message}>
        <Globe size={28} strokeWidth={1.5} aria-hidden />
        <span className={styles.title}>{title}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
        {failed && immersive && (
          <Button size="sm" icon={<RotateCw size={14} />} onClick={() => webViewHost.sendCommand(widget.id, 'reload')}>
            {t('panel.widget.web-view.retry')}
          </Button>
        )}
      </div>
    </div>
  );
}
