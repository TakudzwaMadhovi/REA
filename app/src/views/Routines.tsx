import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, format, startOfWeek } from 'date-fns';
import { db, uid, type Routine, type RoutineTick } from '../db';
import { dayKey } from '../lib/time';
import { Empty, Tick, useConfirm } from '../components/ui';
import { Icon } from '../components/Icon';

/** Days this week (Mon–Sun) on which every item of the routine was ticked. No streaks to lose. */
export function daysComplete(r: Routine, ticks: RoutineTick[], today = new Date()) {
  const mon = startOfWeek(today, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => {
    const d = dayKey(addDays(mon, i));
    const n = ticks.filter((t) => t.routineId === r.id && t.day === d).length;
    return { day: d, complete: r.items.length > 0 && n >= r.items.length };
  });
}

const TEMPLATES: Record<string, string[]> = {
  Morning: ['Drink a glass of water', 'Take medication', 'Look at today’s one thing'],
  Evening: ['Put keys, wallet and phone in one spot', 'Check tomorrow’s first event', 'Capture anything still in your head']
};

export function Routines() {
  const routines = useLiveQuery(() => db.routines.orderBy('order').toArray(), []);
  const mon = dayKey(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const ticks = useLiveQuery(() => db.ticks.where('day').aboveOrEqual(mon).toArray(), [mon]) ?? [];
  const today = dayKey();

  if (!routines) return null;
  const addRoutine = async (name: string) => {
    const t = TEMPLATES[name];
    await db.routines.add({ id: uid(), name, time: name === 'Evening' ? '21:30' : '07:30', ifThen: '', order: routines.length, items: (t ?? []).map((title) => ({ id: uid(), title, done: false })) });
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Routines</h1>
          <p>The same few steps at the same time, so you don’t have to decide. Missed days don’t reset anything.</p>
        </div>
        <div className="row">
          {!routines.some((r) => r.name === 'Morning') && <button className="btn" onClick={() => addRoutine('Morning')}><Icon name="plus" size={18} /> Morning routine</button>}
          {!routines.some((r) => r.name === 'Evening') && <button className="btn" onClick={() => addRoutine('Evening')}><Icon name="plus" size={18} /> Evening routine</button>}
          <button className="btn primary" onClick={() => addRoutine('New routine')}><Icon name="plus" size={18} /> New routine</button>
        </div>
      </header>
      {routines.length === 0 ? (
        <section className="panel"><Empty text="No routines yet. Start with a morning routine of three small steps." action={<button className="btn primary" onClick={() => addRoutine('Morning')}>Add a morning routine</button>} /></section>
      ) : (
        <div className="grid12">
          {routines.map((r) => <RoutineCard key={r.id} r={r} ticks={ticks} today={today} />)}
        </div>
      )}
    </>
  );
}

function RoutineCard({ r, ticks, today }: { r: Routine; ticks: RoutineTick[]; today: string }) {
  const [item, setItem] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirm, confirmNode] = useConfirm();
  const week = daysComplete(r, ticks);
  const doneDays = week.filter((d) => d.complete).length;
  const isTicked = (itemId: string) => ticks.some((t) => t.id === `${r.id}|${itemId}|${today}`);
  const toggle = async (itemId: string) => {
    const id = `${r.id}|${itemId}|${today}`;
    if (isTicked(itemId)) await db.ticks.delete(id);
    else await db.ticks.put({ id, routineId: r.id, day: today });
  };
  const ticked = r.items.filter((i) => isTicked(i.id)).length;

  return (
    <section className="panel s6" aria-labelledby={`r-${r.id}`} style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
      <div className="panel-head" style={{ marginBottom: 0 }}>
        {editing ? (
          <label className="sr-only" htmlFor={`rn-${r.id}`}>Routine name</label>
        ) : null}
        {editing ? (
          <input id={`rn-${r.id}`} className="input" style={{ maxWidth: 260 }} value={r.name} onChange={(e) => db.routines.update(r.id, { name: e.target.value })} />
        ) : (
          <h2 id={`r-${r.id}`}>{r.name}<span className="chip num">{r.time}</span></h2>
        )}
        <button className="btn small quiet" onClick={() => setEditing((v) => !v)} aria-pressed={editing}>{editing ? 'Done editing' : 'Edit'}</button>
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="weekdots" role="img" aria-label={`${doneDays} of 7 days complete this week`}>
          {week.map((d) => <i key={d.day} className={`${d.complete ? 'on' : ''}${d.day === today ? ' today' : ''}`} title={format(new Date(d.day + 'T00:00'), 'EEE')} />)}
        </span>
        <span className="small muted num">{doneDays} of 7 days this week</span>
      </div>

      {r.items.length ? (
        <ul className="rows">
          {r.items.map((i) => (
            <li key={i.id} className={`item${isTicked(i.id) ? ' done' : ''}`}>
              <Tick checked={isTicked(i.id)} label={i.title} onToggle={() => toggle(i.id)} />
              <span className="grow title">{i.title}</span>
              {editing && <button className="icon-btn" aria-label={`Remove ${i.title}`} data-tip="Remove step" onClick={() => db.routines.update(r.id, { items: r.items.filter((x) => x.id !== i.id) })}><Icon name="close" size={18} /></button>}
            </li>
          ))}
        </ul>
      ) : <Empty text="Add two or three steps you can do half-asleep." />}
      <p className="small muted num" aria-live="polite">{ticked === r.items.length && r.items.length ? 'All done for today.' : `${ticked} of ${r.items.length} done today`}</p>

      {editing && (
        <div style={{ display: 'grid', gap: 12 }}>
          <form className="row" onSubmit={async (e) => { e.preventDefault(); if (!item.trim()) return; await db.routines.update(r.id, { items: [...r.items, { id: uid(), title: item.trim(), done: false }] }); setItem(''); }}>
            <label className="sr-only" htmlFor={`ri-${r.id}`}>New step</label>
            <input id={`ri-${r.id}`} className="input" style={{ flex: 1, minWidth: 160 }} placeholder="New step" value={item} onChange={(e) => setItem(e.target.value)} />
            <button className="btn" type="submit" disabled={!item.trim()}>Add step</button>
          </form>
          <div className="grid2">
            <label className="field"><span>Usual time</span>
              <input className="input" type="time" value={r.time} onChange={(e) => db.routines.update(r.id, { time: e.target.value })} />
            </label>
            <div className="field"><span>&nbsp;</span>
              <button className="btn quiet" onClick={() => confirm('routine', r.name, () => db.routines.delete(r.id))}><Icon name="trash" size={18} /> Delete routine</button>
            </div>
          </div>
        </div>
      )}
      {confirmNode}
    </section>
  );
}
