import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Minimize2 } from 'lucide-react';
import type { AudioSnapshot } from '../../../../hooks/useAudioState';
import type { EffectState, EffectTemplateBundle } from '../../../../types/lighting';
import { useShaderRenderer } from '../../../../hooks/useShaderRenderer';
import { useTranslation } from '../../../../lib/i18n';
import { CanvasNoticeBar } from '../../../../components/common/CanvasNoticeBar';
import { gpuNotice, type GpuState } from '../../../../components/common/CanvasNoticeBar/gpuNotice';
import { AnimateDrawer } from './AnimateDrawer';
import styles from './FullscreenShader.module.scss';

interface FullscreenShaderProps {
  effect: string;
  state: EffectState;
  bundle: EffectTemplateBundle;
  canReset: boolean;
  audioRef?: React.RefObject<AudioSnapshot | null>;
  onTemplateSelect: (idx: number) => void;
  onChange: (patch: Partial<EffectState>, commit?: boolean) => void;
  onCommit: () => void;
  onReset: () => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** Preset slots used as a background by ≥1 panel (panel badge). */
  panelSlots?: Set<number> | null;
  gpuAvailable?: boolean;
  gpuState?: GpuState;
  gpuSoftware?: boolean;
  /** Freezes the shader clock so fullscreen holds the same frame the paused
   *  lighting engine and the main canvas preview are holding. */
  paused?: boolean;
}

export function FullscreenShader({
  effect, state, bundle, canReset, audioRef,
  onTemplateSelect, onChange, onCommit, onReset, onClose, onPrev, onNext, panelSlots, gpuAvailable, gpuState, gpuSoftware, paused,
}: FullscreenShaderProps) {
  const { t } = useTranslation();
  const notice = gpuNotice(gpuState, gpuAvailable, gpuSoftware);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const onCloseRef = useRef(onClose);
  // Sync mutable refs synchronously (pre-paint) so the WebGL render loop and
  // fullscreenchange handler always read the latest props without re-creating
  // the renderer subscription on every state tick.
  useLayoutEffect(() => {
    stateRef.current = state;
    onCloseRef.current = onClose;
  });

  const { loading, error } = useShaderRenderer(canvasRef, effect, stateRef, audioRef, undefined, paused);

  const [closeVisible, setCloseVisible] = useState(false);
  const hideTimerRef = useRef(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const closeDrawer = useCallback(() => {
    if (drawerOpen) setDrawerClosing(true);
  }, [drawerOpen]);
  const finishDrawerClose = () => { setDrawerClosing(false); setDrawerOpen(false); };

  const handleMouseMove = useCallback(() => {
    setCloseVisible(true);
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setCloseVisible(false), 2000);
  }, []);

  const handleCanvasClick = useCallback(() => {
    if (drawerOpen && !drawerClosing) {
      closeDrawer();
    } else if (!drawerOpen) {
      setDrawerClosing(false);
      setDrawerOpen(true);
    }
  }, [drawerOpen, drawerClosing, closeDrawer]);

  useEffect(() => {
    containerRef.current?.requestFullscreen?.().catch(() => {});
    const handleFsChange = () => {
      if (!document.fullscreenElement) onCloseRef.current();
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      window.clearTimeout(hideTimerRef.current);
      document.removeEventListener('fullscreenchange', handleFsChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.container} onMouseMove={handleMouseMove}>
      <canvas ref={canvasRef} className={styles.canvas} onClick={handleCanvasClick} />
      <CanvasNoticeBar visible={notice != null} message={notice ? t(notice.key) : ''}
        tone={notice?.tone} />
      {loading && <div className={styles.overlay}>{t('lighting.fullscreen.loadingShader')}</div>}
      {error && <div className={styles.overlay}>{error}</div>}
      <button type="button" aria-label={t('lighting.fullscreen.prevEffect')} className={`${styles.navZone} ${styles.navZoneLeft}`} onClick={onPrev}>
        <ChevronLeft className={styles.navArrow} strokeWidth={1.5} />
      </button>
      <button type="button" aria-label={t('lighting.fullscreen.nextEffect')} className={`${styles.navZone} ${styles.navZoneRight}`} onClick={onNext}>
        <ChevronRight className={styles.navArrow} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        aria-label={t('lighting.fullscreen.exit')}
        className={`${styles.closeBtn} ${closeVisible ? styles.closeBtnVisible : ''}`}
        onClick={() => document.exitFullscreen?.().catch(() => onClose())}
      >
        <Minimize2 size={14} strokeWidth={1.5} />
      </button>
      {drawerOpen && (
        <AnimateDrawer
          effect={effect}
          state={state}
          bundle={bundle}
          onTemplateSelect={onTemplateSelect}
          canReset={canReset}
          onChange={onChange}
          onCommit={onCommit}
          onReset={onReset}
          onClose={closeDrawer}
          closing={drawerClosing}
          onAnimationEnd={finishDrawerClose}
          panelSlots={panelSlots}
        />
      )}
    </div>
  );
}
