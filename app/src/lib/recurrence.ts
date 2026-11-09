import { addDays, addMonths, addWeeks, isWeekend, startOfDay } from 'date-fns';
import type { CalEvent } from '../db';

export interface Occurrence { event: CalEvent; start: number; end: number }

/**
 * Every occurrence of `event` that overlaps [from, to).
 * Recurring events repeat forever from their first start.
 */
export function occurrences(event: CalEvent, from: number, to: number): Occurrence[] {
  const dur = Math.max(event.durationMin, event.allDay ? 24 * 60 : 1) * 60_000;
  const out: Occurrence[] = [];
  const push = (s: number) => {
    if (s < to && s + dur > from) out.push({ event, start: s, end: s + dur });
  };

  if (event.repeat === 'none') {
    push(event.start);
    return out;
  }

  const first = new Date(event.start);
  // jump close to `from` so long-running series stay cheap
  let cursor = first;
  if (event.start < from) {
    const days = Math.floor((startOfDay(from).getTime() - startOfDay(first).getTime()) / 86_400_000);
    if (event.repeat === 'daily' || event.repeat === 'weekdays') cursor = addDays(first, Math.max(0, days - 1));
    else if (event.repeat === 'weekly') cursor = addWeeks(first, Math.max(0, Math.floor(days / 7) - 1));
    else if (event.repeat === 'monthly') {
      const months =
        (new Date(from).getFullYear() - first.getFullYear()) * 12 + new Date(from).getMonth() - first.getMonth();
      cursor = addMonths(first, Math.max(0, months - 1));
    }
  }

  let guard = 0;
  while (cursor.getTime() < to && guard++ < 1000) {
    if (!(event.repeat === 'weekdays' && isWeekend(cursor))) push(cursor.getTime());
    cursor =
      event.repeat === 'weekly'
        ? addWeeks(cursor, 1)
        : event.repeat === 'monthly'
          ? addMonths(first, monthsBetween(first, cursor) + 1)
          : addDays(cursor, 1);
  }
  return out;
}

function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
}

export function occurrencesAll(events: CalEvent[], from: number, to: number) {
  return events.flatMap((e) => occurrences(e, from, to)).sort((a, b) => a.start - b.start);
}
