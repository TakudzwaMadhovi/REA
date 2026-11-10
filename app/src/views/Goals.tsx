import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { db, newTask, uid, type Goal } from '../db';
import { dayLabel } from '../lib/time';
import { go } from '../lib/router';
import { Empty, Tick, useConfirm, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { useEditors } from '../App';
import { saveTask, setDone } from '../components/TaskEditor';

export function progress(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : 0;
}

export function Goals({ selected }: { selected: string | null }) {
  const goals = useLiveQuery(() => db.goals.orderBy('createdAt').filter((g) => !g.archived).toArray(), []);
  const tasks = useLiveQuery(() => db.tasks.filter((t) => !!t.goalId).toArray(), []) ?? [];
  const [title, setTitle] = useState('');
  const { openTask } = useEditors();

  if (!goals) return null;
  const current = goals.find((g) => g.id === selected) ?? goals[0] ?? null;
  const stats = (g: Goal) => {
    const ts = tasks.filter((t) => t.goalId === g.id);
    return { total: ts.length, done: ts.filter((t) => t.done).length };
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const id = uid();
    await db.goals.add({ id, title: title.trim(), why: '', target: null, createdAt: Date.now(), archived: false });
    setTitle('');
    go(`goals/${id}`);
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Goals</h1>
          <p>What the tasks are for. Keep two or three; more becomes noise.</p>
        </div>
      </header>
      <div className="split">
        <section className="panel" aria-labelledby="gl-h">
          <div className="panel-head"><h2 id="gl-h">Your goals<span className="chip">{goals.length}</span></h2></div>
          <ul className="rows">
            {goals.map((g) => {
              const s = stats(g);
              return (
                <li key={g.id}>
                  <a className="goal-btn" href={`#/goals/${g.id}`} aria-current={current?.id === g.id ? 'true' : undefined}>
                    <span className="title" style={{ fontWeight: 600 }}>{g.title}</span>
                    <span className="meta small muted num">{s.done} of {s.total} tasks done{g.target ? `, by ${format(new Date(g.target), 'd MMM')}` : ''}</span>
                    <div className="bar" aria-hidden="true"><i style={{ width: `${progress(s.done, s.total)}%` }} /></div>
                  </a>
                </li>
              );
            })}
          </ul>
          <form onSubmit={add} className="row" style={{ marginTop: 12 }}>
            <label htmlFor="goal-add" className="sr-only">New goal</label>
            <input id="goal-add" className="input" style={{ flex: 1, minWidth: 160 }} placeholder="A new goal" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button className="btn" type="submit" disabled={!title.trim()}>Add goal</button>
          </form>
        </section>

        {current ? <GoalDetail key={current.id} goal={current} openTask={openTask} /> : (
          <section className="panel"><Empty text="No goals yet. Add one on the left, like “Move to a new flat by March”." /></section>
        )}
      </div>
    </>
  );
}

function GoalDetail({ goal, openTask }: { goal: Goal; openTask: ReturnType<typeof useEditors>['openTask'] }) {
  const tasks = useLiveQuery(() => db.tasks.where('goalId').equals(goal.id).toArray(), [goal.id]) ?? [];
  const [g, setG] = useState(goal);
  const [task, setTask] = useState('');
  const [confirm, confirmNode] = useConfirm();
  const toast = useToast();
  const set = (p: Partial<Goal>) => { const n = { ...g, ...p }; setG(n); if (n.title.trim()) db.goals.put(n); };
  const open = tasks.filter((t) => !t.done), done = tasks.filter((t) => t.done);

  return (
    <section className="panel" aria-labelledby="gd-h" style={{ display: 'grid', gap: 18 }}>
      <h2 id="gd-h" className="sr-only">{g.title}</h2>
      <label className="field"><span>Goal</span>
        <input className="input" value={g.title} onChange={(e) => set({ title: e.target.value })} style={{ fontSize: 22, fontWeight: 600 }} />
      </label>
      <div className="grid2">
        <label className="field"><span>Why it matters to you</span>
          <input className="input" value={g.why} onChange={(e) => set({ why: e.target.value })} placeholder="So that…" />
        </label>
        <label className="field"><span>Target date <span className="hint">(optional)</span></span>
          <input className="input" type="date" value={g.target ?? ''} onChange={(e) => set({ target: e.target.value || null })} />
        </label>
      </div>
      <div>
        <p className="num" style={{ fontSize: 32 }}>{progress(done.length, tasks.length)}%<span className="muted small" style={{ marginLeft: 10 }}>{done.length} of {tasks.length} tasks done</span></p>
        <div className="bar" aria-hidden="true"><i style={{ width: `${progress(done.length, tasks.length)}%` }} /></div>
      </div>

      <div>
        <h3 style={{ marginBottom: 10 }}>Next actions</h3>
        {open.length ? (
          <ul className="rows">
            {open.map((t) => (
              <li key={t.id} className="item">
                <Tick checked={false} label={`Mark ${t.title} done`} onToggle={() => setDone(t, true)} />
                <span className="grow"><button className="title" onClick={() => openTask(t)}>{t.title}</button><span className="meta">{t.due ? dayLabel(t.due) : 'Someday'}, {t.estimateMin} min</span></span>
              </li>
            ))}
          </ul>
        ) : <Empty text="No next action. What’s one small thing that moves this forward?" />}
        <form className="row" style={{ marginTop: 12 }} onSubmit={async (e) => { e.preventDefault(); if (!task.trim()) return; await saveTask(newTask({ title: task.trim(), goalId: goal.id })); setTask(''); }}>
          <label htmlFor="goal-task" className="sr-only">Add a next action</label>
          <input id="goal-task" className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Add a next action" value={task} onChange={(e) => setTask(e.target.value)} />
          <button className="btn" type="submit" disabled={!task.trim()}>Add action</button>
        </form>
      </div>
      {done.length > 0 && <p className="small muted">Done: {done.map((t) => t.title).join(', ')}</p>}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn quiet" onClick={() => { db.goals.update(g.id, { archived: true }); toast({ title: 'Goal archived', actions: [{ label: 'Undo', run: () => db.goals.update(g.id, { archived: false }) }] }); go('goals'); }}>Archive goal</button>
        <button className="btn quiet" onClick={() => confirm('goal', g.title, async () => { await db.goals.delete(g.id); await db.tasks.where('goalId').equals(g.id).modify({ goalId: null }); go('goals'); })}>
          <Icon name="trash" size={18} /> Delete goal
        </button>
      </div>
      {confirmNode}
    </section>
  );
}
