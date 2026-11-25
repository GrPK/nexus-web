import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Crosshair, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '../../../common/Button/Button';
import { TextInput } from '../../../common/TextInput/TextInput';
import styles from './DpiTrack.module.scss';

export const DPI_MIN = 100;
export const DPI_MAX = 25600;
export const DPI_STEP = 50;
const TICKS = [100, 400, 800, 1600, 3200, 6400, 12800, 25600];
const LEVELS = 5;

// Octaves read better than a straight line: 800, 1600 and 3200 sit apart instead of in the first tenth.
const toPos = (dpi: number) => Math.log2(dpi / DPI_MIN) / Math.log2(DPI_MAX / DPI_MIN);
const fromPos = (pos: number) => DPI_MIN * Math.pow(DPI_MAX / DPI_MIN, Math.min(1, Math.max(0, pos)));
const snap = (dpi: number) => Math.min(DPI_MAX, Math.max(DPI_MIN, Math.round(dpi / DPI_STEP) * DPI_STEP));
const tickText = (t: number) => (t >= 1000 ? `${t / 1000}k` : String(t));

export interface DpiChange {
  dpi: number[];
  defaultDpiIndex: number;
  shiftDpiIndex: number;
}

/**
 * Sorts the used levels ascending (the DPI buttons step through them in order), keeps the start and
 * shift levels on the same values, and pads to five with zeros.
 */
export function normalizeDpi(levels: number[], def: number, shift: number): DpiChange {
  const used = levels.map((v, i) => ({ v, i })).filter(l => l.v > 0).sort((a, b) => a.v - b.v);
  const at = (old: number) => Math.max(0, used.findIndex(l => l.i === old));
  return {
    dpi: [...used.map(l => l.v), ...Array(LEVELS - used.length).fill(0)].slice(0, LEVELS),
    defaultDpiIndex: at(def),
    shiftDpiIndex: at(shift),
  };
}

export interface DpiTrackLabels {
  track: string;
  level: (n: number) => string;
  value: string;
  setDefault: string;
  setShift: string;
  remove: string;
  add: string;
  isDefault: string;
  isShift: string;
}

export interface DpiTrackProps {
  dpi: number[];
  defaultDpiIndex: number;
  shiftDpiIndex: number;
  busy: boolean;
  labels: DpiTrackLabels;
  onCommit: (change: DpiChange) => void;
}

/**
 * The vendor app's sensitivity strip: every DPI level a handle on one track that is dragged to its value,
 * the start level marked with a star and the DPI shift level with a crosshair. A drag only writes to the
 * mouse when it ends.
 */
export function DpiTrack({ dpi, defaultDpiIndex, shiftDpiIndex, busy, labels, onCommit }: DpiTrackProps) {
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ index: number; value: number } | null>(null);
  const [selected, setSelected] = useState(defaultDpiIndex);
  const [draft, setDraft] = useState<string | null>(null);
  const levels = dpi.map((v, i) => (drag?.index === i ? drag.value : v));
  // A level whose value label would touch the previous one's drops its label under the handle.
  const below = new Set<number>();
  levels.map((v, i) => ({ v, i })).filter(l => l.v > 0).sort((a, b) => a.v - b.v).forEach((l, k, all) => {
    if (k > 0 && !below.has(all[k - 1].i) && toPos(l.v) - toPos(all[k - 1].v) < 0.06) below.add(l.i);
  });
  const used = dpi.filter(v => v > 0).length;
  useEffect(() => { setDraft(null); }, [selected, dpi]);
  useEffect(() => { if (selected >= used) setSelected(Math.max(0, used - 1)); }, [selected, used]);

  const valueAt = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    return r ? snap(fromPos((clientX - r.left) / r.width)) : DPI_MIN;
  };
  const commitLevels = (next: number[], def = defaultDpiIndex, shift = shiftDpiIndex) => {
    const change = normalizeDpi(next, def, shift);
    onCommit(change);
    const movedTo = change.dpi.indexOf(next[selected] ?? -1);
    if (movedTo >= 0) setSelected(movedTo);
  };

  const handleLabel = (i: number, v: number) => labels.level(i + 1) + ': ' + String(v);

  const onDown = (index: number) => (e: ReactPointerEvent) => {
    if (busy) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelected(index);
    setDrag({ index, value: dpi[index] });
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, value: valueAt(e.clientX) });
  };
  const onUp = () => {
    if (!drag) return;
    const next = dpi.map((v, i) => (i === drag.index ? drag.value : v));
    setDrag(null);
    if (next[drag.index] !== dpi[drag.index]) commitLevels(next);
  };

  const typed = (text: string) => {
    const v = snap(Number(text));
    if (!Number.isFinite(Number(text)) || text.trim() === '') return;
    commitLevels(dpi.map((x, i) => (i === selected ? v : x)));
  };
  const remove = () => {
    if (used <= 1) return;
    commitLevels(dpi.map((x, i) => (i === selected ? 0 : x)),
      defaultDpiIndex === selected ? 0 : defaultDpiIndex, shiftDpiIndex === selected ? 0 : shiftDpiIndex);
  };
  const add = () => {
    if (used >= LEVELS) return;
    const top = Math.max(...dpi);
    const next = [...dpi];
    next[used] = snap(Math.min(DPI_MAX, top > 0 ? top * 2 : 800));
    commitLevels(next);
    setSelected(used);
  };

  return (
    <div className={styles.wrap}>
      <div
        ref={track}
        className={styles.track}
        role="group"
        aria-label={labels.track}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className={styles.rail} />
        {TICKS.map(t => (
          <div key={t} className={styles.tick} style={{ left: `${toPos(t) * 100}%` }}>
            <span className={styles.tickLabel}>{tickText(t)}</span>
          </div>
        ))}
        {levels.map((v, i) => (v > 0 ? (
          <button
            type="button"
            key={i}
            className={`${styles.handle} ${selected === i ? styles.selected : ''} ${drag?.index === i ? styles.dragging : ''} ${below.has(i) ? styles.below : ''}`}
            style={{ left: `${toPos(v) * 100}%` }}
            aria-label={handleLabel(i, v)}
            aria-pressed={selected === i}
            disabled={busy}
            onPointerDown={onDown(i)}
            onClick={() => setSelected(i)}
          >
            <span className={styles.value}>{v}</span>
            <span className={styles.knob}>{i + 1}</span>
            <span className={styles.marks}>
              {defaultDpiIndex === i && <Star size={12} className={styles.star} aria-label={labels.isDefault} />}
              {shiftDpiIndex === i && <Crosshair size={12} className={styles.shift} aria-label={labels.isShift} />}
            </span>
          </button>
        ) : null))}
      </div>
      <div className={styles.editor}>
        <span className={styles.editorTitle}>{labels.level(selected + 1)}</span>
        <div className={styles.valueField}>
          <TextInput
            type="number"
            size="sm"
            align="right"
            ariaLabel={labels.value}
            value={draft ?? String(dpi[selected] ?? '')}
            disabled={busy}
            onInput={setDraft}
            onSubmit={typed}
            onBlur={text => { if (draft !== null) typed(text); }}
          />
        </div>
        <Button size="sm" icon={<Star size={14} />} disabled={busy || defaultDpiIndex === selected}
          onClick={() => commitLevels(dpi, selected, shiftDpiIndex)}>{labels.setDefault}</Button>
        <Button size="sm" icon={<Crosshair size={14} />} disabled={busy || shiftDpiIndex === selected}
          onClick={() => commitLevels(dpi, defaultDpiIndex, selected)}>{labels.setShift}</Button>
        <Button size="sm" icon={<Trash2 size={14} />} disabled={busy || used <= 1} onClick={remove}>{labels.remove}</Button>
        <Button size="sm" icon={<Plus size={14} />} disabled={busy || used >= LEVELS} onClick={add}>{labels.add}</Button>
      </div>
    </div>
  );
}
