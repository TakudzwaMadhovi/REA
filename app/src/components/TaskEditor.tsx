import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, format } from 'date-fns';
import { db, getSetting, uid, type Task } from '../db';
import { syncTaskReminder } from '../lib/notify';
import { breakDown } from '../lib/ai';
import { dayKey } from '../lib/time';
import { go } from '../lib/router';
import { SlideOver, Tick, useConfirm, useToast } from './ui';
import { Icon } from './Icon';

const ESTIMATES = [5, 10, 15, 25, 45, 60, 90, 120];
const toLocalInput = (ms: number | null) => (ms ? format(ms, "yyyy-MM-dd'T'HH:mm") : '');

export async function saveTask(t: Task) {
  await db.tasks.put(t);
  await syncTaskReminder(t);
}

export async function setDone(t: Task, done: boolean) {
  const next = { ...t, done, doneAt: done ? Date.now() : null };
  await saveTask(next);
  return next;
}

export function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const [t, setT] = useState<Task>(task);
  const [titleErr, setTitleErr] = useState('');
  const [newStep, setNewStep] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const goals = useLiveQuery(() => db.goals.filter((g) => !g.archived).toArray(), []) ?? [];
  const apiKey = useLiveQuery(() => getSetting<string>('apiKey', ''), [], '');
  const [confirm, confirmNode] = useConfirm();
  const toast = useToast();

  // autosave: every change is written straight away once the task has a title
  const update = (patch: Partial<Task>) => {
    setT((prev) => {
      const next = { ...prev, ...patch };
      if (next.title.trim()) saveTask(next);
      return next;
    });
  };

  useEffect(() => setT(task), [task.id]);

  const today = dayKey();
  const tomorrow = dayKey(addDays(new Date(), 1));
  const whenMode = t.due === null ? 'someday' : t.due === today ? 'today' : t.due === tomorrow ? 'tomorrow' : 'date';

  const addStep = (title: string) => {
    if (!title.trim()) return;
    update({ steps: [...t.steps, { id: uid(), title: title.trim(), done: false }] });
  };

  const runAi = async () => {
    setAiErr('');
    setAiBusy(true);
    try {
      const steps = await breakDown(apiKey!, t.title, t.notes);
      update({ steps: [...t.steps, ...steps.map((s) => ({ id: uid(), title: s, done: false }))] });
    } catch (e) {
      setAiErr((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const close = () => {
    if (!t.title.trim() && !task.title) db.tasks.delete(t.id); // abandoned new task
    onClose();
  };

  return (
    <SlideOver
      title={task.title ? 'Task' : 'New task'}
      onClose={close}
      footer={
        <>
          {task.title ? (
            <button className="btn quiet" onClick={() => confirm('task', t.title, async () => {
              await db.tasks.delete(t.id);
              await db.reminders.delete(`task:${t.id}`);
              toast({ title: 'Task deleted' });
              onClose();
            })}>
              <Icon name="trash" size={18} /> Delete task
            </button>
          ) : <span />}
          <div className="row">
            <button className="btn" onClick={close}>Close</button>
            <button className="btn primary" disabled={!t.title.trim()} onClick={() => { onClose(); go(`focus/${t.id}`); }}>
              <Icon name="play" size={18} /> Start focus
            </button>
          </div>
        </>
      }
    >
      <label className="field">
        <span>What is it?</span>
        <input
          className="input" data-autofocus value={t.title} aria-invalid={Boolean(titleErr)} aria-describedby="title-err"
          onChange={(e) => { setTitleErr(''); update({ title: e.target.value }); }}
          onBlur={() => setTitleErr(t.title.trim() ? '' : 'Give the task a name so you can find it later.')}
          placeholder="e.g. Call the dentist"
        />
        {titleErr && <span id="title-err" className="err">{titleErr}</span>}
      </label>

      <div className="field">
        <span id="when-l">When</span>
        <div className="seg" role="group" aria-labelledby="when-l" style={{ flexWrap: 'wrap' }}>
          {(['today', 'tomorrow', 'date', 'someday'] as const).map((m) => (
            <button key={m} aria-pressed={whenMode === m} onClick={() =>
              update({ due: m === 'today' ? today : m === 'tomorrow' ? tomorrow : m === 'someday' ? null : t.due && t.due > tomorrow ? t.due : dayKey(addDays(new Date(), 2)) })
            }>
              {m === 'date' ? 'Pick a day' : m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {t.due !== null && (
        <div className="grid2">
          <label className="field"><span>Day</span>
            <input className="input" type="date" value={t.due} onChange={(e) => update({ due: e.target.value || today })} />
          </label>
          <label className="field"><span>Time <span className="hint">(optional)</span></span>
            <input className="input" type="time" value={t.dueTime ?? ''} onChange={(e) => update({ dueTime: e.target.value || null })} />
          </label>
        </div>
      )}

      <div className="grid2">
        <label className="field"><span>How long, roughly</span>
          <select className="input" value={t.estimateMin} onChange={(e) => update({ estimateMin: Number(e.target.value) })}>
            {ESTIMATES.map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}
          </select>
        </label>
        <label className="field"><span>Energy it needs</span>
          <select className="input" value={t.energy} onChange={(e) => update({ energy: e.target.value as Task['energy'] })}>
            <option value="low">Low: can do it tired</option>
            <option value="medium">Medium</option>
            <option value="high">High: needs a fresh head</option>
          </select>
        </label>
      </div>

      <div className="field">
        <span>Small steps</span>
        <ul className="rows">
          {t.steps.map((s, i) => (
            <li key={s.id} className={`item${s.done ? ' done' : ''}`} style={{ minHeight: 52 }}>
              <Tick checked={s.done} label={`Step: ${s.title}`} onToggle={() => update({ steps: t.steps.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })} />
              <span className="grow title">{s.title}{i === t.steps.findIndex((x) => !x.done) && <span className="chip time" style={{ marginLeft: 8 }}>Next</span>}</span>
              <button className="icon-btn" aria-label={`Remove step ${s.title}`} data-tip="Remove step" onClick={() => update({ steps: t.steps.filter((x) => x.id !== s.id) })}>
                <Icon name="close" size={18} />
              </button>
            </li>
          ))}
        </ul>
        <form className="row" onSubmit={(e) => { e.preventDefault(); addStep(newStep); setNewStep(''); }}>
          <label className="sr-only" htmlFor="new-step">New step</label>
          <input id="new-step" className="input" style={{ flex: 1, minWidth: 180 }} value={newStep} onChange={(e) => setNewStep(e.target.value)} placeholder="A step that takes under 10 minutes" />
          <button className="btn" type="submit" disabled={!newStep.trim()}>Add step</button>
        </form>
        {apiKey ? (
          <div className="row">
            <button className="btn" onClick={runAi} disabled={aiBusy || !t.title.trim()} aria-busy={aiBusy}>
              <Icon name="spark" size={18} /> {aiBusy ? 'Breaking it down…' : 'Break it down with Claude'}
            </button>
            {aiErr && <span className="err" role="alert">{aiErr}</span>}
          </div>
        ) : (
          <span className="hint small muted">Stuck on where to start? Write the very first physical action, like “Open the laptop”.</span>
        )}
      </div>

      <label className="field">
        <span>When ___, I will ___ <span className="hint">(optional)</span></span>
        <input className="input" value={t.ifThen} onChange={(e) => update({ ifThen: e.target.value })} placeholder="When I finish lunch, I will open the tax form" />
        <span className="hint">Linking a task to a moment in your day makes it more likely to happen.</span>
      </label>

      <label className="field"><span>Goal</span>
        <select className="input" value={t.goalId ?? ''} onChange={(e) => update({ goalId: e.target.value || null })}>
          <option value="">No goal</option>
          {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
      </label>

      <div className="grid2">
        <label className="field"><span>Remind me at</span>
          <input className="input" type="datetime-local" value={toLocalInput(t.remindAt)} onChange={(e) => update({ remindAt: e.target.value ? new Date(e.target.value).getTime() : null })} />
        </label>
        <NagSelect taskId={t.id} disabled={!t.remindAt} />
      </div>

      <label className="field"><span>Notes</span>
        <textarea className="input" value={t.notes} onChange={(e) => update({ notes: e.target.value })} />
      </label>
      {confirmNode}
    </SlideOver>
  );
}

function NagSelect({ taskId, disabled }: { taskId: string; disabled: boolean }) {
  const r = useLiveQuery(() => db.reminders.get(`task:${taskId}`), [taskId]);
  return (
    <label className="field"><span>Keep reminding</span>
      <select className="input" disabled={disabled || !r} value={r?.nag ? 'nag' : 'once'}
        onChange={(e) => db.reminders.update(`task:${taskId}`, { nag: e.target.value === 'nag' })}>
        <option value="once">Once</option>
        <option value="nag">Every 5 min until done</option>
      </select>
    </label>
  );
}
