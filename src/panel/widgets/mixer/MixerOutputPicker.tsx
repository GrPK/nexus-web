import { useEffect, useState } from 'react';
import { ArrowLeft, Check, GripVertical, Pencil } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { Button } from '../../../components/common/Button/Button';
import { Tabs, type TabDef } from '../../../components/common/Tabs/Tabs';
import { SortableList } from '../../../components/common/SortableList/SortableList';
import { PanelArrowButton } from '../../chrome/PanelArrowButton';
import type { AudioDevice, AudioSpatialState } from '../../../api/mixer';
import styles from './MixerWidget.module.scss';

// What a 4x4 tile fits under the docked tab row, without shrinking the rows
// below a touch target.
const ROWS_PER_PAGE = 5;

type Tab = 'output' | 'input' | 'spatial';
const TAB_ORDER: readonly Tab[] = ['output', 'input', 'spatial'];
const isTab = (key: string): key is Tab => (TAB_ORDER as readonly string[]).includes(key);

const TAB_LABEL: Record<Tab, string> = {
  output: 'panel.widget.mixer.output',
  input: 'panel.widget.mixer.input',
  spatial: 'panel.widget.mixer.spatial',
};

export interface MixerOutputPickerProps {
  outputs: AudioDevice[];
  inputs: AudioDevice[];
  /** Spatial sound on the default output; null hides its tab. */
  spatial: AudioSpatialState | null;
  /** Takes the new order of the visible devices of one direction. */
  onReorder: (direction: 'output' | 'input', orderedIds: string[]) => void;
  onSelectOutput: (deviceId: string) => void;
  onSelectInput: (deviceId: string) => void;
  onSelectSpatial: (formatId: string) => void;
  onClose: () => void;
}

type Row = { id: string; label: string; active: boolean; select: () => void };

export function MixerOutputPicker({
  outputs,
  inputs,
  spatial,
  onReorder,
  onSelectOutput,
  onSelectInput,
  onSelectSpatial,
  onClose,
}: MixerOutputPickerProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<Tab | null>(null);
  // Dragging needs rows that do not also select, so ordering is its own mode.
  const [editing, setEditing] = useState(false);

  // A category earns a tab only when it has something to list.
  const rowsByTab: Record<Tab, Row[]> = {
    output: disambiguate(outputs).map(({ device, label }): Row => ({
      id: device.id, label, active: device.isDefault, select: () => onSelectOutput(device.id),
    })),
    input: disambiguate(inputs).map(({ device, label }): Row => ({
      id: device.id, label, active: device.isDefault, select: () => onSelectInput(device.id),
    })),
    // Off leads so the list reads the way Windows' own picker does.
    spatial: spatial
      ? [{ id: '', label: t('panel.widget.mixer.spatialOff') }, ...spatial.formats.map(f => ({ id: f.id, label: f.name }))]
          .map(({ id, label }): Row => ({
            id, label, active: spatial.activeId === id, select: () => onSelectSpatial(id),
          }))
      : [],
  };
  const tabs = TAB_ORDER.filter(entry => rowsByTab[entry].length > 0);
  const tab = picked && tabs.includes(picked) ? picked : tabs[0] ?? null;
  const rows = tab ? rowsByTab[tab] : [];
  const reorderDirection = tab === 'output' || tab === 'input' ? tab : null;
  const reordering = editing && reorderDirection !== null && rows.length > 1;

  // A pick whose tab has gone (the default output moved to one without
  // spatial sound) is dropped, so the tab does not spring back on its own
  // when a later poll brings the category back.
  useEffect(() => {
    if (picked && !tabs.includes(picked)) setPicked(null);
  }, [picked, tabs]);

  const pages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * ROWS_PER_PAGE, current * ROWS_PER_PAGE + ROWS_PER_PAGE);

  const switchTab = (key: string) => {
    if (!isTab(key)) return;
    setPicked(key);
    setPage(0);
  };
  const tabDefs: TabDef[] = tabs.map(entry => ({ key: entry, label: t(TAB_LABEL[entry]) }));

  return (
    <>
    {/* Docked, not a list entry: it has to stay reachable on every page. */}
    <div className={styles.pickerTabs}>
      <Button
        tone="ghost"
        icon={<ArrowLeft size={18} strokeWidth={2.2} />}
        aria-label={t('panel.widget.mixer.aria.closePicker')}
        onClick={onClose}
      />
      {tab && (
        <Tabs
          fullWidth
          className={styles.pickerTabBar}
          tabs={tabDefs}
          activeKey={tab}
          onChange={switchTab}
          ariaLabel={t('panel.widget.mixer.aria.pickOutput')}
        />
      )}
      {reorderDirection && rows.length > 1 && (
        <Button
          tone="ghost"
          icon={editing ? <Check size={18} strokeWidth={2.2} /> : <Pencil size={18} strokeWidth={2.2} />}
          aria-pressed={editing}
          aria-label={t(editing ? 'panel.widget.mixer.aria.reorderDone' : 'panel.widget.mixer.aria.reorder')}
          onClick={() => setEditing(v => !v)}
        />
      )}
    </div>
    {reordering && reorderDirection ? (
      <div className={styles.pickerReorder}>
        <SortableList
          ids={rows.map(r => r.id)}
          onReorder={ids => onReorder(reorderDirection, ids)}
          renderRow={(id, a) => {
            const label = rows.find(r => r.id === id)?.label ?? '';
            return (
              <div
                ref={a.ref}
                style={a.style}
                className={`${styles.pickerReorderRow} ${a.isDragging ? a.placeholderClassName : ''}`}
              >
                <span
                  className={styles.pickerHandle}
                  {...a.attributes}
                  {...a.listeners}
                  aria-label={t('panel.widget.mixer.aria.moveDevice', { name: label })}
                >
                  <GripVertical size={18} strokeWidth={2} />
                </span>
                <span className={styles.pickerRowName}>{label}</span>
              </div>
            );
          }}
        />
      </div>
    ) : (
    <div className={styles.pickerStage} data-paged={pages > 1 ? 'true' : 'false'}>
      {pages > 1 && (
        <PanelArrowButton
          side="prev"
          className={styles.pickerArrow}
          disabled={current === 0}
          onClick={() => setPage(p => Math.max(0, p - 1))}
          ariaLabel={t('panel.widget.mixer.aria.prevPage')}
        />
      )}
      <div className={styles.pickerRows}>
        {visible.map(row => (
          <button
            key={row.id}
            type="button"
            className={styles.pickerRow}
            data-active={row.active ? 'true' : 'false'}
            aria-pressed={row.active}
            onClick={row.select}
          >
            <span className={styles.pickerRowName}>{row.label}</span>
          </button>
        ))}
      </div>
      {pages > 1 && (
        <PanelArrowButton
          side="next"
          className={styles.pickerArrow}
          disabled={current >= pages - 1}
          onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
          ariaLabel={t('panel.widget.mixer.aria.nextPage')}
        />
      )}
    </div>
    )}
    </>
  );
}

/**
 * Endpoints can share a name verbatim - a GPU exposing one HDMI audio device
 * per port reports the monitor's name for each. Two identical rows leave the
 * operator guessing which one they picked, so repeats get an ordinal.
 */
function disambiguate(devices: AudioDevice[]): Array<{ device: AudioDevice; label: string }> {
  const counts = new Map<string, number>();
  for (const d of devices) counts.set(d.name, (counts.get(d.name) ?? 0) + 1);
  const seen = new Map<string, number>();
  return devices.map(device => {
    if ((counts.get(device.name) ?? 0) < 2) return { device, label: device.name };
    const n = (seen.get(device.name) ?? 0) + 1;
    seen.set(device.name, n);
    return { device, label: `${device.name} (${n})` };
  });
}
