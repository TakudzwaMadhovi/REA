import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { occurrencesAll } from '../lib/recurrence';
import type { CalEvent } from '../db';
import { atToday, duration } from '../lib/time';

/** Wedge from 12 o'clock, clockwise, covering `frac` of the circle. */
function wedge(frac: number, r: number, c = 100) {
  const f = Math.min(Math.max(frac, 0), 0.99999);
  if (f <= 0) return '';
  const a = f * 2 * Math.PI;
  const x = c + r * Math.sin(a);
  const y = c - r * Math.cos(a);
  return `M${c} ${c} L${c} ${c - r} A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

/** The time disc: the yellow wedge is the time that is left, and it shrinks. */
export function TimeDisc({ frac, label, size }: { frac: number; label: string; size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={label}>
      <circle cx="100" cy="100" r="96" fill="var(--surface)" />
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * 2 * Math.PI;
        const long = i % 5 === 0;
        const r1 = long ? 80 : 86;
        return (
          <line key={i} x1={100 + r1 * Math.sin(a)} y1={100 - r1 * Math.cos(a)} x2={100 + 92 * Math.sin(a)} y2={100 - 92 * Math.cos(a)}
            stroke="var(--muted)" strokeWidth={long ? 2 : 1} opacity={long ? 0.8 : 0.4} />
        );
      })}
      {frac >= 0.9999 ? <circle cx="100" cy="100" r="76" fill="var(--time)" /> : <path d={wedge(frac, 76)} fill="var(--time)" style={{ transition: 'd 1s linear' }} />}
      <circle cx="100" cy="100" r="5" fill="var(--text)" />
    </svg>
  );
}

export function useNow(everyMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/** Today from wake to bedtime as one band: the grey part is gone, blocks are events, the line is now. */
export function DayRibbon({ events, wake, bed, now }: { events: CalEvent[]; wake: string; bed: string; now: number }) {
  const start = atToday(wake);
  let end = atToday(bed);
  if (end <= start) end += 86_400_000;
  const span = end - start;
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - start) / span) * 100));
  const occ = occurrencesAll(events, start, end).filter((o) => !o.event.allDay);
  const left = Math.max(0, end - now);
  const hours: number[] = [];
  const stepH = typeof window !== 'undefined' && window.innerWidth < 600 ? 6 : 3;
  for (let t = start; t <= end; t += stepH * 3600_000) hours.push(t);
  const fmt = (t: number) => format(t, 'HH:mm');
  return (
    <div>
      <div className="ribbon" role="img" aria-label={`${duration(left)} left before ${fmt(end)}. ${occ.length} events today.`}>
        <div className="past" style={{ width: `${pct(now)}%` }} />
        {occ.map((o) => (
          <div key={o.event.id + o.start} className="blk" style={{ left: `${pct(o.start)}%`, width: `max(6px, ${pct(o.end) - pct(o.start)}%)` }} title={`${fmt(o.start)} ${o.event.title}`}>
            {o.event.title}
          </div>
        ))}
        {now >= start && now <= end && <div className="nowline" style={{ left: `${pct(now)}%` }} />}
      </div>
      <div className="ribbon-scale" aria-hidden="true">
        {hours.map((h) => <span key={h}>{fmt(h)}</span>)}
      </div>
    </div>
  );
}
