import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newTask, type Task } from '../db';
import { rankToday } from '../lib/pick';
import { dayKey, dayLabel } from '../lib/time';
import { Empty, Tick, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { useEditors } from '../App';
import { saveTask, setDone } from '../components/TaskEditor';
import { SwipeRow } from '../components/SwipeRow';
import { addDays } from 'date-fns';

type Group = { key: string; title: string; tasks: Task[] };

export function Tasks() {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];
  const { openTask } = useEditors();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [title, setTitle] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);
  const today = dayKey();

  if (!tasks) return null;
  const match = (t: Task) => !q || t.title.toLowerCase().includes(q.toLowerCase());
  const open = tasks.filter((t) => !t.done && match(t));
  const groups: Group[] = [
    { key: 'today', title: 'Today', tasks: rankToday(open, today) },
    { key: 'next', title: 'Coming up', tasks: open.filter((t) => t.due && t.due > today).sort((a, b) => (a.due! < b.due! ? -1 : 1)) },
    { key: 'someday', title: 'Someday', tasks: open.filter((t) => !t.due).sort((a, b) => b.createdAt - a.createdAt) }
  ];
  const done = tasks.filter((t) => t.done && match(t)).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  const goalName = (id: string | null) => goals.find((g) => g.id === id)?.title;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await saveTask(newTask({ title: title.trim(), due: today }));
    setTitle('');
  };
  const toggle = (t: Task) => {
    if (t.done) { setDone(t, false); return; }
    setLeaving(t.id);
    setTimeout(async () => {
      await setDone(t, true);
      setLeaving(null);
      toast({ title: `Done: ${t.title}`, actions: [{ label: 'Undo', run: () => setDone({ ...t, done: true }, false) }] });
    }, 320);
  };

  const later = async (t: Task) => {
    const prev = t.due;
    await saveTask({ ...t, due: dayKey(addDays(new Date(), 1)) });
    toast({ title: 'Moved to tomorrow', actions: [{ label: 'Undo', run: () => saveTask({ ...t, due: prev }) }] });
  };
  const swipeDone = async (t: Task) => {
    await setDone(t, true);
    toast({ title: `Done: ${t.title}`, actions: [{ label: 'Undo', run: () => setDone({ ...t, done: true }, false) }] });
  };
  const row = (t: Task) => t.done ? rowInner(t, 'li') : (
    <SwipeRow key={t.id} onDone={() => swipeDone(t)} onLater={() => later(t)}>{rowInner(t, 'div')}</SwipeRow>
  );
  const rowInner = (t: Task, Tag: 'li' | 'div') => (
    <Tag key={t.id} className={`item${t.done ? ' done' : ''}${leaving === t.id ? ' leaving' : ''}`}>
      <Tick checked={t.done || leaving === t.id} label={`Mark ${t.title} ${t.done ? 'not done' : 'done'}`} onToggle={() => toggle(t)} />
      <span className="grow">
        <button className="title" onClick={() => openTask(t)}>{t.title}</button>
        <span className="meta">
          {[
            t.due ? (t.due < today && !t.done ? `From ${dayLabel(t.due).toLowerCase()}` : dayLabel(t.due)) : null,
            t.dueTime,
            `${t.estimateMin} min`,
            t.steps.length ? `${t.steps.filter((s) => s.done).length}/${t.steps.length} steps` : null,
            goalName(t.goalId)
          ].filter(Boolean).join(', ')}
        </span>
      </span>
      {!t.done && <a className="icon-btn" href={`#/focus/${t.id}`} aria-label={`Focus on ${t.title}`} data-tip="Start focus"><Icon name="play" size={18} /></a>}
    </Tag>
  );

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Tasks</h1>
          <p>{open.length} open. Only today’s list matters right now.</p>
        </div>
        <div className="row">
          <label htmlFor="task-search" className="sr-only">Search tasks</label>
          <input id="task-search" className="input" type="search" placeholder="Search tasks ( / )" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
          <button className="btn primary" onClick={() => openTask({ due: today })}><Icon name="plus" size={18} /> New task</button>
        </div>
      </header>

      <form className="row" onSubmit={add} style={{ marginBottom: 24 }}>
        <label htmlFor="quick-task" className="sr-only">Quick add a task for today</label>
        <input id="quick-task" className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Add a task for today" value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" />
        <button className="btn" type="submit" disabled={!title.trim()}>Add for today</button>
      </form>

      <div style={{ display: 'grid', gap: 16 }}>
        {groups.map((g) => (
          <section key={g.key} className="panel" aria-labelledby={`g-${g.key}`}>
            <div className="panel-head"><h2 id={`g-${g.key}`}>{g.title}<span className="chip">{g.tasks.length}</span></h2></div>
            {g.tasks.length ? <ul className="rows">{g.tasks.map(row)}</ul> : (
              <Empty text={g.key === 'today' ? (q ? 'No match for today.' : 'Nothing for today yet. Add one small thing above.') : g.key === 'next' ? 'Nothing scheduled ahead.' : 'Ideas without a date land here.'} />
            )}
          </section>
        ))}
        <section className="panel" aria-labelledby="g-done">
          <div className="panel-head">
            <h2 id="g-done">Done<span className="chip">{done.length}</span></h2>
            <button className="btn small quiet" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>{showDone ? 'Hide' : 'Show'}</button>
          </div>
          {showDone && (done.length ? <ul className="rows">{done.slice(0, 50).map(row)}</ul> : <Empty text="Finished tasks show up here." />)}
        </section>
      </div>
    </>
  );
}
