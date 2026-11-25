import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { TextInput } from '../../../common/TextInput/TextInput';
import { ACTION_MIME } from './MouseIllustration';
import styles from './ActionLibrary.module.scss';

export interface LibraryItem {
  value: string;
  label: string;
}

export interface LibraryGroup {
  key: string;
  title: string;
  icon: ReactNode;
  items: readonly LibraryItem[];
}

export interface ActionLibraryProps {
  groups: readonly LibraryGroup[];
  /** The selected button's binding, highlighted in the list. */
  currentValue: string | null;
  disabled: boolean;
  title: string;
  hint: string;
  searchLabel: string;
  emptyLabel: string;
  onPick: (value: string) => void;
}

/**
 * The action list next to the mouse, like the vendor app's assignment panel: groups that fold, a search
 * box across all of them, and items that are clicked onto the selected button or dragged onto any button.
 */
export function ActionLibrary({ groups, currentValue, disabled, title, hint, searchLabel, emptyLabel, onPick }: ActionLibraryProps) {
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set(groups.slice(2).map(g => g.key)));
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => groups
      .map(g => ({ ...g, items: q ? g.items.filter(i => i.label.toLowerCase().includes(q)) : g.items }))
      .filter(g => g.items.length > 0),
    [groups, q],
  );

  const toggle = (key: string) => setClosed(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <aside className={styles.library} aria-label={title}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        <span className={styles.hint}>{hint}</span>
        <TextInput size="sm" type="search" ariaLabel={searchLabel} placeholder={searchLabel} value={query} onInput={setQuery} />
      </div>
      <div className={styles.groups}>
        {shown.length === 0 && <div className={styles.empty}>{emptyLabel}</div>}
        {shown.map(g => {
          const open = q !== '' || !closed.has(g.key);
          return (
            <section key={g.key} className={styles.group}>
              <button type="button" className={styles.groupHead} aria-expanded={open} onClick={() => toggle(g.key)}>
                {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                <span className={styles.groupIcon}>{g.icon}</span>
                <span className={styles.groupTitle}>{g.title}</span>
                <span className={styles.count}>{g.items.length}</span>
              </button>
              {open && (
                <div className={styles.items}>
                  {g.items.map(item => (
                    <button
                      type="button"
                      key={item.value}
                      className={`${styles.item} ${item.value === currentValue ? styles.current : ''}`}
                      draggable
                      disabled={disabled}
                      aria-pressed={item.value === currentValue}
                      onDragStart={e => {
                        e.dataTransfer.setData(ACTION_MIME, item.value);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => onPick(item.value)}
                    >
                      <GripVertical size={12} className={styles.grip} aria-hidden />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
