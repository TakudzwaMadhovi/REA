import { format, isToday, isTomorrow, isYesterday } from 'date-fns';

export const dayKey = (d: Date | number = new Date()) => format(d, 'yyyy-MM-dd');

/** "1 h 05 m", "18 min", "40 s" */
export function duration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, '0')} m` : `${h} h`;
}

/** mm:ss for a running timer */
export function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function ago(ts: number, now = Date.now()) {
  const m = Math.round((now - ts) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  if (isYesterday(ts)) return 'Yesterday';
  return format(ts, 'd MMM');
}

export function dayLabel(day: string) {
  const d = new Date(day + 'T00:00');
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE d MMM');
}

export function greeting(h = new Date().getHours()) {
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** today at HH:mm as epoch ms */
export function atToday(hhmm: string, base = new Date()) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}
