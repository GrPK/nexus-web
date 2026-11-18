import { useMemo, useState, type KeyboardEvent } from 'react';
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
  /** -1 / +1 from the header arrows in the day grid, -12 / +12 in the year view. */
  onMonthChange: (delta: number) => void;
  /** A month picked in the year view (local midnight of its first day). The grid returns to days. */
  onSelectMonth?: (monthStart: number) => void;
}

const dayStart = (y: number, m: number, d: number) => new Date(y, m, d).getTime();

/**
 * An always-open month grid: header with arrows, weekday initials, day cells. DatePicker's popup look without the popup.
 * The title drills up to a year view of twelve months; Escape or the title again returns.
 */
export function MiniMonth({ month, selected, today, weekStart, highlightWeek, onSelect, onMonthChange, onSelectMonth }: MiniMonthProps) {
  const { t, language } = useTranslation();
  const [yearView, setYearView] = useState(false);
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
  const monthNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(language, { month: 'short' });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2023, i, 1)));
  }, [language]);
  const dayNumber = useMemo(() => new Intl.DateTimeFormat(language, { day: 'numeric' }), [language]);

  const thisMonth = new Date(today);
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && yearView) {
      e.stopPropagation();
      setYearView(false);
    }
  };

  return (
    <div className={styles.root} onKeyDown={onKeyDown}>
      <div className={styles.header}>
        <button type="button" className={styles.nav} onClick={() => onMonthChange(yearView ? -12 : -1)} aria-label={t(yearView ? 'datepicker.prevYear' : 'datepicker.prevMonth')}>‹</button>
        <button type="button" className={styles.titleButton} onClick={() => setYearView(v => !v)} aria-expanded={yearView} aria-label={t(yearView ? 'datepicker.showMonths' : 'datepicker.showYear')}>
          {yearView ? String(year) : title}
        </button>
        <button type="button" className={styles.nav} onClick={() => onMonthChange(yearView ? 12 : 1)} aria-label={t(yearView ? 'datepicker.nextYear' : 'datepicker.nextMonth')}>›</button>
      </div>
      {yearView ? (
        <div className={styles.months}>
          {monthNames.map((name, i) => {
            const current = i === thisMonth.getMonth() && year === thisMonth.getFullYear();
            const cls = [styles.monthCell, current ? styles.today : '', i === monthIndex ? styles.selected : ''].filter(Boolean).join(' ');
            return (
              <button
                key={i}
                type="button"
                className={cls}
                aria-pressed={i === monthIndex}
                onClick={() => { setYearView(false); onSelectMonth?.(new Date(year, i, 1).getTime()); }}
              >
                {name}
              </button>
            );
          })}
        </div>
      ) : (<>
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
      </>)}
    </div>
  );
}
