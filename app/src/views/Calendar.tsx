import { useRef, useState } from 'react';
import { useIsPhone } from '../lib/platform';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, isWeekend, startOfMonth, startOfWeek } from 'date-fns';
import { db, uid, type CalEvent } from '../db';
import { occurrencesAll, type Occurrence } from '../lib/recurrence';
import { dayKey, dayLabel } from '../lib/time';
import { Empty } from '../components/ui';
import { Icon } from '../components/Icon';
import { useNow } from '../components/TimeDisc';
import { useEditors } from '../App';

const START_H = 6, END_H = 24, HOUR_PX = 48;

export function blankEvent(start: Date): CalEvent {
  return { id: uid(), title: '', start: start.getTime(), durationMin: 60, allDay: false, repeat: 'none', remindMin: 15, notes: '' };
}

export function Calendar() {
  const now = useNow(60_000);
  const [mode, setMode] = useState<'month' | 'week'>('week');
  const phone = useIsPhone();
  const swipeX = useRef<number | null>(null);
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(dayKey());
  const events = useLiveQuery(() => db.events.toArray(), []) ?? [];
  const tasks = useLiveQuery(() => db.tasks.filter((t) => !t.done && !!t.due).toArray(), []) ?? [];
  const { openEvent, openTask } = useEditors();

  const range =
    mode === 'month'
      ? { from: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), to: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }) }
      : { from: startOfWeek(cursor, { weekStartsOn: 1 }), to: endOfWeek(cursor, { weekStartsOn: 1 }) };
  const days: Date[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) days.push(d);
  const occ = occurrencesAll(events, range.from.getTime(), addDays(range.to, 1).getTime());
  const byDay = (d: Date) => occ.filter((o) => dayKey(o.start) === dayKey(d));
  const tasksOn = (d: Date) => tasks.filter((t) => t.due === dayKey(d));
  const step = (n: number) => {
    setCursor((c) => (mode === 'month' ? addMonths(c, n) : addDays(c, 7 * n)));
    // keep the selected day inside the week that is now on screen
    if (mode === 'week') setSelected((s) => dayKey(addDays(new Date(s + 'T00:00'), 7 * n)));
  };
  const title = mode === 'month' ? format(cursor, 'MMMM yyyy') : `${format(range.from, 'd MMM')} to ${format(range.to, 'd MMM yyyy')}`;

  const newAt = (d: Date, hour = 9) => { const s = new Date(d); s.setHours(hour, 0, 0, 0); openEvent(blankEvent(s), true); };

  const selDate = new Date(selected + 'T00:00');
  const agenda = (d: Date) => {
    const o = byDay(d), t = tasksOn(d);
    return (
      <section className="panel agenda-day" aria-labelledby={`ag-${dayKey(d)}`}>
        <div className="panel-head">
          <h2 id={`ag-${dayKey(d)}`}>{dayLabel(dayKey(d))}{dayLabel(dayKey(d)).length < 10 ? `, ${format(d, 'd MMM')}` : ''}</h2>
          <button className="btn small" onClick={() => newAt(d)}><Icon name="plus" size={16} /> Add event</button>
        </div>
        {o.length + t.length === 0 ? <Empty text="Nothing planned. A free day is fine." /> : (
          <ul className="rows">
            {o.map((x) => (
              <li key={x.event.id + x.start} className="item">
                <span className="chip num" style={{ minWidth: 64, justifyContent: 'center' }}>{x.event.allDay ? 'All day' : format(x.start, 'HH:mm')}</span>
                <span className="grow"><button className="title" onClick={() => openEvent(x.event)}>{x.event.title}</button>
                  <span className="meta">{x.event.allDay ? '' : `${x.event.durationMin} min`}{x.event.repeat !== 'none' ? `, repeats ${x.event.repeat}` : ''}</span></span>
              </li>
            ))}
            {t.map((x) => (
              <li key={x.id} className="item">
                <span className="chip" style={{ minWidth: 64, justifyContent: 'center' }}>Task</span>
                <span className="grow"><button className="title" onClick={() => openTask(x)}>{x.title}</button><span className="meta">{x.estimateMin} min{x.dueTime ? `, ${x.dueTime}` : ''}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Calendar</h1>
          <p>{title}</p>
        </div>
        <div className="row">
          <div className="seg" role="group" aria-label="View">
            <button aria-pressed={mode === 'week'} onClick={() => setMode('week')}>Week</button>
            <button aria-pressed={mode === 'month'} onClick={() => setMode('month')}>Month</button>
          </div>
          <div className="row" style={{ gap: 4 }}>
            <button className="icon-btn" aria-label={`Previous ${mode}`} data-tip={`Previous ${mode}`} onClick={() => step(-1)}><Icon name="left" /></button>
            <button className="btn small" onClick={() => { setCursor(new Date()); setSelected(dayKey()); }}>Today</button>
            <button className="icon-btn" aria-label={`Next ${mode}`} data-tip={`Next ${mode}`} onClick={() => step(1)}><Icon name="right" /></button>
          </div>
          <button className="btn primary" onClick={() => newAt(selDate, new Date().getHours() + 1)}><Icon name="plus" size={18} /> New event</button>
        </div>
      </header>

      {mode === 'month' ? (
        <>
          <div className="cal-month" role="grid" aria-label={format(cursor, 'MMMM yyyy')}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
            {days.map((d) => {
              const o = byDay(d), t = tasksOn(d), all = [...o.map((x) => ({ k: x.event.id + x.start, label: x.event.allDay ? x.event.title : `${format(x.start, 'HH:mm')} ${x.event.title}`, task: false })), ...t.map((x) => ({ k: x.id, label: x.title, task: true }))];
              const key = dayKey(d);
              return (
                <button key={key} role="gridcell" aria-selected={selected === key}
                  aria-label={`${format(d, 'EEEE d MMMM')}, ${o.length} events, ${t.length} tasks`}
                  className={`cal-cell${isSameMonth(d, cursor) ? '' : ' out'}${key === dayKey(now) ? ' today' : ''}${isWeekend(d) ? ' wknd' : ''}`}
                  style={selected === key ? { outline: '2px solid var(--text)', outlineOffset: -2 } : undefined}
                  onClick={() => setSelected(key)}>
                  <span className="d">{format(d, 'd')}</span>
                  {all.slice(0, 3).map((x) => <span key={x.k} className={`cal-pill${x.task ? ' task' : ''}`}>{x.label}</span>)}
                  {all.length > 3 && <span className="cal-more">{all.length - 3} more</span>}
                  {all.length > 0 && <span className="dots" aria-hidden="true">{all.slice(0, 3).map((x) => <i key={x.k} />)}</span>}
                </button>
              );
            })}
          </div>
          {agenda(selDate)}
        </>
      ) : (
        phone ? (
          <>
            <div className="daystrip" role="group" aria-label="Days this week"
              onPointerDown={(e) => { swipeX.current = e.clientX; }}
              onPointerUp={(e) => {
                const dx = swipeX.current === null ? 0 : e.clientX - swipeX.current;
                swipeX.current = null;
                if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
              }}>
              {days.map((d) => {
                const key = dayKey(d);
                return (
                  <button key={key} aria-pressed={selected === key} aria-label={format(d, 'EEEE d MMMM')} onClick={() => setSelected(key)}>
                    <span>{format(d, 'EEEEE')}</span><b>{format(d, 'd')}</b>
                    {byDay(d).length + tasksOn(d).length > 0 && <i className="dot" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            {agenda(selDate)}
          </>
        ) : <WeekGrid days={days} byDay={byDay} tasksOn={tasksOn} now={now} onSlot={newAt} onEvent={(e) => openEvent(e)} agenda={agenda} />
      )}
    </>
  );
}

function WeekGrid({ days, byDay, tasksOn, now, onSlot, onEvent, agenda }: {
  days: Date[]; byDay: (d: Date) => Occurrence[]; tasksOn: (d: Date) => unknown[]; now: number;
  onSlot: (d: Date, h: number) => void; onEvent: (e: CalEvent) => void; agenda: (d: Date) => JSX.Element;
}) {
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
  return (
    <div className="panel" style={{ background: 'var(--ground)', padding: 0 }}>
      <div className="week-head">
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className={dayKey(d) === dayKey(now) ? 'today' : ''}>
            {format(d, 'EEE d')}
            {tasksOn(d).length > 0 && <span className="chip" style={{ marginLeft: 6 }}>{tasksOn(d).length} tasks</span>}
          </div>
        ))}
      </div>
      <div className="week" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <div className="week-hours">{hours.map((h) => <div key={h}>{String(h).padStart(2, '0')}:00</div>)}</div>
        {days.map((d) => {
          const isToday = dayKey(d) === dayKey(now);
          const nowTop = ((new Date(now).getHours() + new Date(now).getMinutes() / 60) - START_H) * HOUR_PX;
          return (
            <div key={d.toISOString()} className={`week-day${isWeekend(d) ? ' wknd' : ''}`}>
              {hours.map((h) => (
                <div key={h} className="hr" role="button" tabIndex={-1} aria-label={`Add event ${format(d, 'EEE d')} at ${h}:00`} onClick={() => onSlot(d, h)} />
              ))}
              {byDay(d).filter((o) => !o.event.allDay).map((o) => {
                const s = new Date(o.start);
                const top = (s.getHours() + s.getMinutes() / 60 - START_H) * HOUR_PX;
                const h = Math.max(22, ((o.end - o.start) / 3_600_000) * HOUR_PX - 2);
                return (
                  <button key={o.event.id + o.start} className="week-ev" style={{ top: Math.max(0, top), height: h }} onClick={() => onEvent(o.event)}>
                    <b>{format(o.start, 'HH:mm')}</b> {o.event.title}
                  </button>
                );
              })}
              {isToday && nowTop > 0 && <div className="week-now" style={{ top: nowTop }} aria-hidden="true" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
