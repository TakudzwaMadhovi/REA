import { describe, expect, it } from 'vitest';
import { occurrences } from '../lib/recurrence';
import type { CalEvent } from '../db';

const ev = (p: Partial<CalEvent>): CalEvent => ({ id: 'e', title: 'x', start: new Date('2026-11-02T09:30').getTime(), durationMin: 30, allDay: false, repeat: 'none', remindMin: null, notes: '', ...p });
const range = (a: string, b: string) => [new Date(a).getTime(), new Date(b).getTime()] as const;

describe('occurrences', () => {
  it('one-off event appears only in its own range', () => {
    expect(occurrences(ev({}), ...range('2026-11-02T00:00', '2026-11-03T00:00'))).toHaveLength(1);
    expect(occurrences(ev({}), ...range('2026-11-03T00:00', '2026-11-04T00:00'))).toHaveLength(0);
  });
  it('daily repeats every day, never before the first start', () => {
    expect(occurrences(ev({ repeat: 'daily' }), ...range('2026-11-01T00:00', '2026-11-09T00:00'))).toHaveLength(7);
  });
  it('weekdays skip Saturday and Sunday', () => {
    const o = occurrences(ev({ repeat: 'weekdays' }), ...range('2026-11-09T00:00', '2026-11-16T00:00'));
    expect(o).toHaveLength(5);
    expect(o.every((x) => ![0, 6].includes(new Date(x.start).getDay()))).toBe(true);
  });
  it('weekly lands on the same weekday and time, far in the future', () => {
    const o = occurrences(ev({ repeat: 'weekly' }), ...range('2027-06-01T00:00', '2027-07-01T00:00'));
    expect(o.length).toBe(4);
    expect(o.every((x) => new Date(x.start).getDay() === 1 && new Date(x.start).getHours() === 9)).toBe(true);
  });
  it('monthly keeps the day of month', () => {
    const o = occurrences(ev({ repeat: 'monthly', start: new Date('2026-01-15T08:00').getTime() }), ...range('2026-03-01T00:00', '2026-06-01T00:00'));
    expect(o.map((x) => new Date(x.start).getDate())).toEqual([15, 15, 15]);
  });
  it('includes an event already running at the range start', () => {
    expect(occurrences(ev({ durationMin: 120 }), ...range('2026-11-02T10:00', '2026-11-02T12:00'))).toHaveLength(1);
  });
});
