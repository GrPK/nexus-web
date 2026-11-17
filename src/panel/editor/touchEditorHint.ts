import type { AppMetadata } from '../widgets/types';
import { surfaceInputMode, type PanelSurface } from '../types';

/** The notice key an app wants above its settings on a touch surface, or null when none applies. */
export function touchEditorHintFor(meta: Pick<AppMetadata, 'touchEditorHintKey'> | undefined, surface: PanelSurface, deviceTouch?: boolean): string | null {
  if (!meta?.touchEditorHintKey) return null;
  return surfaceInputMode(surface, deviceTouch) === 'touch' ? meta.touchEditorHintKey : null;
}
