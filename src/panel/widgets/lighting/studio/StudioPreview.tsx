import { useEffect, useRef } from 'react';
import { useShaderRenderer } from '../../../../hooks/useShaderRenderer';
import type { AudioSnapshot } from '../../../../hooks/useAudioState';
import type { EffectState } from '../../../../types/lighting';
import { InlineError } from '../../../../components/common/InlineError/InlineError';
import styles from './ShaderStudio.module.scss';

const LED_OPTIONS = { maxDevicePixelRatio: 1 };

interface StudioPreviewProps {
  /** A key already primed with primeShaderSource. */
  effectKey: string;
  stateRef: React.RefObject<EffectState | null>;
  audioRef?: React.RefObject<AudioSnapshot | null>;
  /** Renders at the engine's LED canvas size, scaled up without smoothing. */
  led?: boolean;
  className?: string;
}

export function StudioPreview({ effectKey, stateRef, audioRef, led, className }: StudioPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { error } = useShaderRenderer(canvasRef, effectKey, stateRef, audioRef, led ? LED_OPTIONS : undefined);
  // Chromium caps live WebGL contexts per page and evicts the oldest (possibly the
  // lighting page's own canvas), so release this one on unmount instead of waiting
  // for GC. StrictMode and Fast Refresh re-run setup synchronously on the same
  // canvas, so the release waits past the commit and skips a canvas set up again.
  const liveRef = useRef(false);
  useEffect(() => {
    liveRef.current = true;
    const canvas = canvasRef.current;
    return () => {
      liveRef.current = false;
      queueMicrotask(() => {
        if (!liveRef.current) canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
      });
    };
  }, []);
  return (
    <div className={`${led ? styles.ledFrame : styles.previewFrame} ${className ?? ''}`}>
      <canvas ref={canvasRef} className={led ? styles.ledCanvas : styles.previewCanvas} />
      {error && <InlineError className={styles.previewError}>{error}</InlineError>}
    </div>
  );
}
