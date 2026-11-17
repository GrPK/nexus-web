import { useMemo } from 'react';
import { useTranslation } from '../../../lib/i18n';
import styles from './MiniMonth.module.scss';

export interface MiniMonthProps {
  /** Any local-time instant inside the month to show. */
  month: number;
  /** Local-midnight day marked as selected. */
  selected: number;
  /** Local-midnight day marked as today. */
  today: number;
  /** 0 = Sunday first, 1 = Monday first. */
  weekStart: 0 | 1;
  /** Tint the whole row of the selected day (week-based views). */
  highlightWeek?: boolean;
  onSelect: (day: number) => void;
  /** -1 / +1 from the header arrows. */
  onMonthChange: (delta: number) => void;
}

const dayStart = (y: number, m: number, d: number) => new Date(y, m, d).getTime();

/** An always-open month grid: header with arrows, weekday initials, day cells. DatePicker's popup look without the popup. */
export function MiniMonth({ month, selected, today, weekStart, highlightWeek, onSelect, onMonthChange }: MiniMonthProps) {
  const { t, language } = useTranslation();
  const view = new Date(month);
  const year = view.getFullYear();
  const monthIndex = view.getMonth();

  const weeks = useMemo(() => {
    const first = new Date(year, monthIndex, 1);
    const lead = (first.getDay() - weekStart + 7) % 7;
    const rows: number[][] = [];
    for (let w = 0; w < 6; w++) {
      const row = Array.from({ length: 7 }, (_, i) => dayStart(year, monthIndex, 1 - lead + w * 7 + i));
      if (w > 0 && new Date(row[0]).getMonth() !== monthIndex) break;
      rows.push(row);
    }
    return rows;
  }, [year, monthIndex, weekStart]);

  const initials = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(language, { weekday: 'narrow' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + weekStart + i)));
  }, [language, weekStart]);
  const title = useMemo(() => new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(month), [language, month]);
  const dayNumber = useMemo(() => new Intl.DateTimeFormat(language, { day: 'numeric' }), [language]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button type="button" className={styles.nav} onClick={() => onMonthChange(-1)} aria-label={t('datepicker.prevMonth')}>‹</button>
        <div className={styles.title}>{title}</div>
        <button type="button" className={styles.nav} onClick={() => onMonthChange(1)} aria-label={t('datepicker.nextMonth')}>›</button>
      </div>
      <div className={styles.weekdays}>
        {initials.map((w, i) => <span key={i}>{w}</span>)}
      </div>
      {weeks.map(row => {
        const selectedRow = highlightWeek === true && row.includes(selected);
        return (
          <div key={row[0]} className={`${styles.row} ${selectedRow ? styles.rowSelected : ''}`}>
            {row.map(day => {
              const out = new Date(day).getMonth() !== monthIndex;
              const cls = [styles.cell, out ? styles.out : '', day === today ? styles.today : '', day === selected ? styles.selected : '']
                .filter(Boolean).join(' ');
              return (
                <button key={day} type="button" className={cls} onClick={() => onSelect(day)} aria-pressed={day === selected}>
                  {dayNumber.format(day)}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
