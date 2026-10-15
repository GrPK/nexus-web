import { Globe } from 'lucide-react';
import type { AppManifest } from '../types';
import { WebViewWidget } from './WebViewWidget';
import { WebViewImmersive } from './WebViewImmersive';
import { WebViewSettings } from './WebViewSettings';

export const webViewApp: AppManifest = {
  meta: {
    type: 'web-view',
    i18nKey: 'panel.widget.web-view',
    icon: Globe,
    // 2x4 exists for the Q-series single tile; the framework has no per-surface
    // size list, so gridSizes keeps multi-widget panels to 4x4.
    sizes: ['2x4', '4x4'],
    gridSizes: ['4x4'],
    defaultSize: '4x4',
    supportsImmersive: { portrait: true, landscape: true },
    hasConfig: true,
    touch: false,
    // The native layer exists only on the on-device panel hosts.
    panelOnly: true,
  },
  Widget: WebViewWidget,
  Touch: WebViewImmersive,
  Settings: WebViewSettings,
};
