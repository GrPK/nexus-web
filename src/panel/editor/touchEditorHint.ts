import type { AppMetadata } from '../widgets/types';
import type { PanelSurface } from '../types';

/** The notice key an app wants above its settings on any surface but the desktop dashboard, or null when none applies. */
export function touchEditorHintFor(meta: Pick<AppMetadata, 'touchEditorHintKey'> | undefined, surface: PanelSurface): string | null {
  if (!meta?.touchEditorHintKey) return null;
  return surface === 'desktop' ? null : meta.touchEditorHintKey;
}
