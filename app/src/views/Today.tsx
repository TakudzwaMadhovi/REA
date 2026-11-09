import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, format } from 'date-fns';
import { db, getSetting, type Task } from '../db';
import { nextStep, rankToday } from '../lib/pick';
import { occurrencesAll } from '../lib/recurrence';
import { atToday, dayKey, dayLabel, duration, greeting } from '../lib/time';
import { DayRibbon, TimeDisc, useNow } from '../components/TimeDisc';
import { Empty, Tick, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { useEditors } from '../App';
import { setDone } from '../components/TaskEditor';

export function Today() {
  const now = useNow(30_000);
  const today = dayKey(now);
  const { openTask, openEvent, capture } = useEditors();
  const toast = useToast();
  const [leaving, setLeaving] = useState<string | null>(null);

  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const events = useLiveQuery(() => db.events.toArray(), []) ?? [];
  const inbox = useLiveQuery(() => db.inbox.count(), [], 0);
  const routines = useLiveQuery(() => db.routines.toArray(), []) ?? [];
  const ticks = useLiveQuery(() => db.ticks.where('day').equals(today).count(), [today], 0);
  const name = useLiveQuery(() => getSetting('name', ''), [], '');
  const wake = useLiveQuery(() => getSetting('wake', '07:00'), [], '07:00')!;
  const bed = useLiveQuery(() => getSetting('bed', '22:30'), [], '22:30')!;

  const ranked = rankToday(tasks, today);
  const now1 = ranked[0] ?? null;
  const rest = ranked.slice(1);
  const doneToday = tasks.filter((t) => t.done && t.doneAt && dayKey(t.doneAt) === today);
  const routineItems = routines.reduce((n, r) => n + r.items.length, 0);
  const upcoming = occurrencesAll(events, now, addDays(now, 3).getTime()).slice(0, 6);
  const suggestions = tasks.filter((t) => !t.done && (!t.due || t.due > today)).sort((a, b) => a.estimateMin - b.estimateMin).slice(0, 3);

  let dayStart = atToday(wake), dayEnd = atToday(bed);
  if (dayEnd <= dayStart) dayEnd += 86_400_000;
  const dayLeft = Math.max(0, dayEnd - now);
  const dayFrac = dayLeft / (dayEnd - dayStart);

  const complete = async (t: Task) => {
    setLeaving(t.id);
    setTimeout(async () => {
      await setDone(t, true);
      setLeaving(null);
      toast({ title: `Done: ${t.title}`, actions: [{ label: 'Undo', run: () => setDone({ ...t, done: true }, false) }] });
    }, 320);
  };
  const notToday = async (t: Task) => {
    await db.tasks.update(t.id, { due: dayKey(addDays(new Date(), 1)) });
    toast({ title: 'Moved to tomorrow', body: 'Choosing what not to do is part of the plan.', actions: [{ label: 'Undo', run: () => db.tasks.update(t.id, { due: t.due }) }] });
  };
  const doToday = (t: Task) => db.tasks.update(t.id, { due: today });

  const step = now1 ? nextStep(now1) : null;
  const late = now1?.due && now1.due < today;

  return (
    <>
      <h1 className="greet">{greeting(new Date(now).getHours())}{name ? `, ${name}` : ''}.</h1>
      <p className="greet-sub">
        {format(now, 'EEEE d MMMM')}.{' '}
        {dayLeft > 0 ? `${duration(dayLeft)} left before ${bed}.` : 'Your day is over. Rest counts too.'}
      </p>

      <div className="grid12 today-top">
        <section className="panel s9 now" aria-labelledby="now-h">
          <h2 id="now-h" className="now-label" style={{ fontWeight: 400, fontSize: 16 }}>The one thing now</h2>
          {now1 ? (
            <>
              <div className={`row${leaving === now1.id ? ' item leaving' : ''}`} style={{ alignItems: 'flex-start', gap: 8, background: 'none', border: 0, padding: 0, minHeight: 0 }}>
                <Tick checked={leaving === now1.id} label={`Mark ${now1.title} done`} onToggle={() => complete(now1)} />
                <div className="grow" style={{ flex: 1, minWidth: 0 }}>
                  <p className="now-title">{now1.title}</p>
                  <p className="muted num" style={{ marginTop: 8 }}>
                    About {now1.estimateMin} min
                    {now1.dueTime ? `, due at ${now1.dueTime}` : ''}
                    {now1.steps.length ? `, ${now1.steps.filter((s) => s.done).length} of ${now1.steps.length} steps done` : ''}
                    {late && <span className="chip late" style={{ marginLeft: 8 }}>From {dayLabel(now1.due!).toLowerCase()}</span>}
                  </p>
                </div>
              </div>
              {now1.ifThen && <p>{now1.ifThen}</p>}
              {step ? (
                <div className="now-step"><span className="chip time">Next step</span><b>{step.title}</b></div>
              ) : (
                <div className="now-step"><span className="muted">No steps yet. What’s the first thing you’d physically do?</span></div>
              )}
              <div className="row">
                <a className="btn primary" href={`#/focus/${now1.id}`}><Icon name="play" size={18} /> Start focus</a>
                <button className="btn" onClick={() => openTask(now1)}>Open task</button>
                <button className="btn quiet" onClick={() => notToday(now1)}>Not today</button>
              </div>
            </>
          ) : (
            <div className="empty" style={{ padding: 0 }}>
              <p className="now-title">Nothing is due today.</p>
              <p className="muted">Pick one small thing to do, or empty your head into the inbox first.</p>
              {suggestions.length > 0 && (
                <ul className="rows" style={{ width: '100%' }}>
                  {suggestions.map((t) => (
                    <li key={t.id} className="item">
                      <span className="grow" style={{ paddingLeft: 8 }}><span className="title">{t.title}</span><span className="meta">{t.estimateMin} min, {t.due ? dayLabel(t.due) : 'Someday'}</span></span>
                      <button className="btn small" onClick={() => doToday(t)}>Do today</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="row">
                <button className="btn primary" onClick={() => openTask({ due: today })}><Icon name="plus" size={18} /> Add a task for today</button>
                <button className="btn" onClick={capture}>Capture a thought</button>
              </div>
            </div>
          )}
        </section>

        <section className="panel s3 daybox" aria-labelledby="day-h">
          <h2 id="day-h" style={{ fontWeight: 400, fontSize: 16 }} className="muted">Time left today</h2>
          <TimeDisc frac={dayFrac} label={`${duration(dayLeft)} left before ${bed}`} />
          <p style={{ fontSize: 24 }} className="num">{dayLeft > 0 ? duration(dayLeft) : 'Day done'}</p>
          <p className="small muted">The yellow shrinks as the day goes. Bedtime is {bed}; change it in Settings.</p>
        </section>

        <section className="panel s12" aria-labelledby="rib-h">
          <div className="panel-head">
            <h2 id="rib-h">Your day, {wake} to {bed}</h2>
            <button className="btn small" onClick={() => {
              const s = new Date(now); s.setMinutes(0, 0, 0); s.setHours(s.getHours() + 1);
              openEvent({ id: crypto.randomUUID(), title: '', start: s.getTime(), durationMin: 60, allDay: false, repeat: 'none', remindMin: 15, notes: '' }, true);
            }}>Add event</button>
          </div>
          <DayRibbon events={events} wake={wake} bed={bed} now={now} />
        </section>

        <a className="panel s3 kpi" href="#/inbox">
          <p className="label">Inbox to sort</p>
          <p className="value">{inbox}</p>
          <p className="cap">{inbox ? 'Sort when you have 5 minutes' : 'Head is clear'}</p>
        </a>
        <a className="panel s3 kpi" href="#/tasks">
          <p className="label">Left for today</p>
          <p className="value">{ranked.length}</p>
          <p className="cap">{ranked.reduce((m, t) => m + t.estimateMin, 0)} min of work, estimated</p>
        </a>
        <div className="panel s3 kpi">
          <p className="label">Done today</p>
          <p className="value">{doneToday.length}</p>
          <p className="cap">{doneToday.length ? 'Every one counts' : 'Ready when you are'}</p>
        </div>
        <a className="panel s3 kpi" href="#/routines">
          <p className="label">Routine steps</p>
          <p className="value">{ticks} <span className="muted" style={{ fontSize: 18 }}>of {routineItems}</span></p>
          <p className="cap">{routineItems ? 'Ticked today' : 'Set up a morning routine'}</p>
        </a>

        <section className="panel s6" aria-labelledby="list-h">
          <div className="panel-head">
            <h2 id="list-h">After that<span className="chip">{rest.length}</span></h2>
            <a className="small" href="#/tasks">All tasks</a>
          </div>
          {rest.length ? (
            <ul className="rows">
              {rest.slice(0, 6).map((t) => (
                <li key={t.id} className={`item${leaving === t.id ? ' leaving' : ''}`}>
                  <Tick checked={leaving === t.id} label={`Mark ${t.title} done`} onToggle={() => complete(t)} />
                  <span className="grow">
                    <button className="title" onClick={() => openTask(t)}>{t.title}</button>
                    <span className="meta">{t.estimateMin} min{t.dueTime ? `, ${t.dueTime}` : ''}{t.due! < today ? `, from ${dayLabel(t.due!)}` : ''}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Only the one thing today. That’s a good day." />
          )}
        </section>

        <section className="panel s6" aria-labelledby="up-h">
          <div className="panel-head">
            <h2 id="up-h">Coming up<span className="chip">next 3 days</span></h2>
            <a className="small" href="#/calendar">Calendar</a>
          </div>
          {upcoming.length ? (
            <ul className="rows">
              {upcoming.map((o) => (
                <li key={o.event.id + o.start} className="item">
                  <span className="chip num" style={{ minWidth: 64, justifyContent: 'center' }}>{o.event.allDay ? 'All day' : format(o.start, 'HH:mm')}</span>
                  <span className="grow">
                    <button className="title" onClick={() => openEvent(o.event)}>{o.event.title}</button>
                    <span className="meta">{dayLabel(dayKey(o.start))}{o.event.remindMin != null ? ', reminder on' : ''}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="No events in the next 3 days." />
          )}
        </section>
      </div>
    </>
  );
}
