import { useMemo } from 'react';
import { AlignLeft, MapPin } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { Popover } from '../../../components/common/Popover/Popover';
import { addDays, eventsOnDay, startOfDay, type CalEvent } from './calendarEvents';
import { linkify } from './linkify';
import type { CalendarLook } from './useCalendarData';
import type { CalendarFormat } from './useCalendarFormat';
import styles from './CalendarEventPopover.module.scss';

function useAnchorRef(anchor: HTMLElement | null) {
  return useMemo(() => ({ current: anchor }), [anchor]);
}

interface EventProps {
  event: CalEvent | null;
  anchor: HTMLElement | null;
  fmt: CalendarFormat;
  look: CalendarLook;
  onClose: () => void;
}

/** Read-only detail for one event. Escape or an outside press closes it. */
export function CalendarEventPopover({ event, anchor, fmt, look, onClose }: EventProps) {
  const { t } = useTranslation();
  const anchorRef = useAnchorRef(anchor);
  if (!event) return null;

  let when: string;
  let date: string;
  if (event.allDay) {
    const last = addDays(event.end, -1);
    date = fmt.fullDate(event.start);
    when = last > event.start
      ? t('panel.widget.calendar.range', { start: fmt.monthDayLong(event.start), end: fmt.monthDayLong(last) })
      : t('panel.widget.calendar.allDay');
    if (last > event.start) date = '';
  } else {
    date = fmt.fullDate(event.start);
    when = t('panel.widget.calendar.range', { start: fmt.time(event.start), end: fmt.time(event.end) });
  }

  return (
    <Popover open onClose={onClose} anchorRef={anchorRef} portal placement="bottom-start" ariaLabel={event.title} className={styles.popover}>
      <div className={styles.head} style={{ ['--cal-color' as string]: look.color }}>
        <span className={styles.bar} />
        <div className={styles.title}>{event.title}</div>
      </div>
      <div className={styles.when}>
        {date && <div>{date}</div>}
        <div>{when}</div>
      </div>
      {look.name && (
        <div className={styles.calendar} style={{ ['--cal-color' as string]: look.color }}>
          <span className={styles.dot} />
          <span>{look.name}</span>
        </div>
      )}
      {event.location && (
        <div className={styles.line}><MapPin size={14} aria-hidden /><span>{event.location}</span></div>
      )}
      {event.notes && (
        <div className={styles.line}><AlignLeft size={14} aria-hidden /><span className={styles.notes}>
            {linkify(event.notes).map((part, i) => (part.href
              ? <a key={i} className={styles.link} href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a>
              : <span key={i}>{part.text}</span>))}
          </span></div>
      )}
    </Popover>
  );
}

interface MoreProps {
  day: number | null;
  anchor: HTMLElement | null;
  events: readonly CalEvent[];
  now: number;
  fmt: CalendarFormat;
  lookFor: (id: string) => CalendarLook;
  onPick: (ev: CalEvent, el: HTMLElement) => void;
  onClose: () => void;
}

/** Everything on one day, opened from a month cell's "+N more". */
export function CalendarMorePopover({ day, anchor, events, now, fmt, lookFor, onPick, onClose }: MoreProps) {
  const { t } = useTranslation();
  const anchorRef = useAnchorRef(anchor);
  if (day === null) return null;
  const list = eventsOnDay(events, day);
  const isToday = day === startOfDay(now);
  return (
    <Popover open onClose={onClose} anchorRef={anchorRef} portal placement="bottom-start" ariaLabel={fmt.fullDate(day)} className={`${styles.popover} ${styles.more}`}>
      <div className={`${styles.moreHead} ${isToday ? styles.moreToday : ''}`}>
        <span>{fmt.weekdayShort(day)}</span>
        <b>{fmt.dayNumber(day)}</b>
      </div>
      {[...list.allDay, ...list.timed].map(ev => (
        <button
          key={ev.id}
          type="button"
          className={styles.moreRow}
          style={{ ['--cal-color' as string]: lookFor(ev.calendarId).color }}
          onClick={e => onPick(ev, e.currentTarget)}
        >
          <span className={styles.rowBar} />
          <span className={styles.rowTime}>{ev.allDay ? t('panel.widget.calendar.allDay') : fmt.time(ev.start)}</span>
          <span className={styles.rowTitle}>{ev.title}</span>
        </button>
      ))}
    </Popover>
  );
}
