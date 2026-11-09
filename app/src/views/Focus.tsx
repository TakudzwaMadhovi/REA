import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting, setSetting, type Task } from '../db';
import { nextStep, rankToday } from '../lib/pick';
import { scheduleRelaySync } from '../lib/notify';
import { clock, dayKey } from '../lib/time';
import { go } from '../lib/router';
import { TimeDisc, useNow } from '../components/TimeDisc';
import { Empty, Tick, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { useEditors } from '../App';
import { saveTask, setDone } from '../components/TaskEditor';

interface Timer { taskId: string | null; mode: 'focus' | 'break'; lengthMs: number; endsAt: number | null; pausedLeft: number | null }
const LENGTHS = [5, 15, 25, 45];
const TIMER_REMINDER = 'focus-timer';

async function writeTimer(t: Timer | null, title = '') {
  await setSetting('timer', t);
  if (t?.endsAt) {
    await db.reminders.put({
      id: TIMER_REMINDER, at: t.endsAt, nag: false, done: false,
      title: t.mode === 'focus' ? `Focus time is up${title ? `: ${title}` : ''}` : 'Break is over',
      link: t.taskId ? { type: 'task', id: t.taskId } : null
    });
  } else await db.reminders.delete(TIMER_REMINDER);
  scheduleRelaySync();
}

export function Focus({ taskId }: { taskId: string | null }) {
  const now = useNow(1000);
  const { openTask } = useEditors();
  const toast = useToast();
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const timer = useLiveQuery(() => getSetting<Timer | null>('timer', null), [], undefined);
  const defaultLen = useLiveQuery(() => getSetting('focusMin', 25), [], 25)!;
  const ended = useRef<number | null>(null);

  const today = dayKey(now);
  const ranked = tasks ? rankToday(tasks, today) : [];
  const id = taskId ?? timer?.taskId ?? ranked[0]?.id ?? null;
  const task = tasks?.find((t) => t.id === id) ?? null;

  const len = timer?.lengthMs ?? defaultLen * 60_000;
  const running = Boolean(timer?.endsAt);
  const left = timer?.endsAt ? timer.endsAt - now : timer?.pausedLeft ?? len;
  const frac = Math.max(0, left) / len;

  // when the time runs out while this screen is open
  useEffect(() => {
    if (!timer?.endsAt || left > 0 || ended.current === timer.endsAt) return;
    ended.current = timer.endsAt;
    const wasFocus = timer.mode === 'focus';
    writeTimer({ ...timer, endsAt: null, pausedLeft: 0 });
    if (wasFocus) {
      toast({
        title: 'Time’s up. Nice work.', body: 'A 5 minute break helps the next round.', sticky: true,
        actions: [
          { label: 'Take a break', run: () => writeTimer({ taskId: timer.taskId, mode: 'break', lengthMs: 5 * 60_000, endsAt: Date.now() + 5 * 60_000, pausedLeft: null }) },
          { label: 'Keep going', run: () => writeTimer({ ...timer, mode: 'focus', endsAt: Date.now() + timer.lengthMs, pausedLeft: null }, task?.title) }
        ]
      });
    }
  }, [left, timer]);

  if (tasks === undefined || timer === undefined) return null;

  const start = (ms = len) => writeTimer({ taskId: task?.id ?? null, mode: timer?.mode ?? 'focus', lengthMs: ms, endsAt: Date.now() + (timer?.pausedLeft && ms === len ? timer.pausedLeft : ms), pausedLeft: null }, task?.title);
  const pause = () => writeTimer({ ...timer!, endsAt: null, pausedLeft: Math.max(0, left) });
  const reset = (ms: number) => writeTimer({ taskId: task?.id ?? null, mode: 'focus', lengthMs: ms, endsAt: null, pausedLeft: null });

  const step = task ? nextStep(task) : null;
  const toggleStep = (sid: string) => task && saveTask({ ...task, steps: task.steps.map((s) => (s.id === sid ? { ...s, done: !s.done } : s)) });
  const finish = async (t: Task) => {
    await setDone(t, true);
    await writeTimer(null);
    toast({ title: `Done: ${t.title}`, body: 'That’s one off your plate.' });
    const next = rankToday((await db.tasks.toArray()), today)[0];
    go(next ? `focus/${next.id}` : 'today');
  };

  const isBreak = timer?.mode === 'break';
  return (
    <div className="focus">
      <div className="disc-wrap">
        <TimeDisc frac={frac} label={`${clock(left)} ${isBreak ? 'of break' : 'of focus'} left`} />
        <div className="disc-read" aria-live="off">
          <span className="big">{clock(left)}</span>
          <span className="lbl">{isBreak ? 'Break' : running ? 'Focus' : timer?.pausedLeft ? 'Paused' : 'Ready'}</span>
        </div>
      </div>

      <section style={{ display: 'grid', gap: 22, alignContent: 'start' }} aria-label="Current task">
        {task ? (
          <>
            <p className="muted">{isBreak ? 'On a break from' : 'Only this, for now'}</p>
            <h1>{task.title}</h1>
            {task.ifThen && <p>{task.ifThen}</p>}
          </>
        ) : (
          <>
            <h1>Focus</h1>
            <p className="muted">No task picked. The timer works on its own too.</p>
          </>
        )}

        <div className="row">
          {running ? (
            <button className="btn primary" onClick={pause}><Icon name="pause" size={18} /> Pause</button>
          ) : (
            <button className="btn primary" onClick={() => start()}><Icon name="play" size={18} /> {timer?.pausedLeft ? 'Resume' : `Start ${Math.round(len / 60_000)} min`}</button>
          )}
          <div className="seg" role="group" aria-label="Timer length">
            {LENGTHS.map((m) => (
              <button key={m} aria-pressed={len === m * 60_000 && !isBreak} onClick={() => { reset(m * 60_000); setSetting('focusMin', m); }}>{m}</button>
            ))}
          </div>
        </div>

        {task && (
          <>
            {task.steps.length > 0 ? (
              <ul className="rows" aria-label="Steps">
                {task.steps.map((s) => (
                  <li key={s.id} className={`item${s.done ? ' done' : ''}`} style={s === step ? { borderColor: 'var(--text)' } : undefined}>
                    <Tick checked={s.done} label={`Step: ${s.title}`} onToggle={() => toggleStep(s.id)} />
                    <span className="grow title">{s.title}</span>
                    {s === step && <span className="chip time">Now</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Tip: name the first tiny action out loud, then do only that.</p>
            )}
            <div className="row">
              <button className="btn" onClick={() => finish(task)}><Icon name="check" size={18} /> Mark task done</button>
              <button className="btn quiet" onClick={() => openTask(task)}>I’m stuck: break it down</button>
            </div>
          </>
        )}

        {!task && ranked.length > 0 && (
          <div>
            <h2 style={{ marginBottom: 10 }}>Or pick one</h2>
            <ul className="rows">
              {ranked.slice(0, 4).map((t) => (
                <li key={t.id} className="item">
                  <span className="grow" style={{ paddingLeft: 8 }}><span className="title">{t.title}</span><span className="meta">{t.estimateMin} min</span></span>
                  <a className="btn small" href={`#/focus/${t.id}`}>Focus on this</a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!task && ranked.length === 0 && <Empty text="Nothing due today. Use the timer for anything, or add a task first." />}
      </section>
    </div>
  );
}
