import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newTask, uid, type InboxItem } from '../db';
import { ago, dayKey } from '../lib/time';
import { Empty, useConfirm, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { useEditors } from '../App';
import { saveTask } from '../components/TaskEditor';

/** Pure triage rule, tested: turn an inbox line into a task. */
export function inboxToTask(item: InboxItem, today: string | null) {
  return newTask({ title: item.text, due: today, createdAt: item.createdAt });
}

export function Inbox() {
  const items = useLiveQuery(() => db.inbox.orderBy('createdAt').reverse().toArray(), []);
  const { openTask, openEvent, capture } = useEditors();
  const toast = useToast();
  const [confirm, confirmNode] = useConfirm();
  const [text, setText] = useState('');
  const [leaving, setLeaving] = useState<string | null>(null);

  const out = (id: string, then: () => Promise<unknown>) => {
    setLeaving(id);
    setTimeout(async () => { await then(); await db.inbox.delete(id); setLeaving(null); }, 320);
  };

  const toTask = (it: InboxItem, today: boolean) =>
    out(it.id, async () => {
      const t = inboxToTask(it, today ? dayKey() : null);
      await saveTask(t);
      toast({ title: today ? 'Added to today' : 'Added to tasks', actions: [{ label: 'Open', run: () => openTask(t) }] });
    });

  const toEvent = (it: InboxItem) => {
    const s = new Date(); s.setMinutes(0, 0, 0); s.setHours(s.getHours() + 1);
    openEvent({ id: uid(), title: it.text, start: s.getTime(), durationMin: 60, allDay: false, repeat: 'none', remindMin: 15, notes: '' }, true);
    db.inbox.delete(it.id);
  };

  const toGoal = (it: InboxItem) =>
    out(it.id, async () => {
      await db.goals.add({ id: uid(), title: it.text, why: '', target: null, createdAt: Date.now(), archived: false });
      toast({ title: 'Saved as a goal' });
    });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await db.inbox.add({ id: uid(), text: text.trim(), createdAt: Date.now() });
    setText('');
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Inbox</h1>
          <p>Everything you captured, waiting for a decision. Decide one at a time; nothing here is urgent.</p>
        </div>
      </header>

      <form className="row" onSubmit={add} style={{ marginBottom: 24 }}>
        <label htmlFor="inbox-add" className="sr-only">Add to inbox</label>
        <input id="inbox-add" className="input" style={{ flex: 1, minWidth: 200 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a thought and press Enter" autoComplete="off" />
        <button className="btn" type="submit" disabled={!text.trim()}>Add to inbox</button>
      </form>

      <section className="panel" aria-labelledby="inbox-h">
        <div className="panel-head"><h2 id="inbox-h">To sort<span className="chip">{items?.length ?? 0}</span></h2></div>
        {items && items.length === 0 ? (
          <Empty text="Inbox is clear. When something pops into your head, press N and let it go." action={<button className="btn" onClick={capture}>Capture a thought</button>} />
        ) : (
          <ul className="rows">
            {items?.map((it) => (
              <li key={it.id} className={`item${leaving === it.id ? ' leaving' : ''}`} style={{ flexWrap: 'wrap', paddingLeft: 16 }}>
                <span className="grow" style={{ minWidth: 200 }}>
                  <span className="title">{it.text}</span>
                  <span className="meta">{ago(it.createdAt)}</span>
                </span>
                <span className="row" style={{ gap: 6 }}>
                  <button className="btn small primary" onClick={() => toTask(it, true)}>Do today</button>
                  <button className="btn small" onClick={() => toTask(it, false)}>Make a task</button>
                  <button className="btn small" onClick={() => toEvent(it)}>Schedule</button>
                  <button className="btn small quiet" onClick={() => toGoal(it)}>Make a goal</button>
                  <button className="icon-btn" aria-label={`Delete “${it.text}”`} data-tip="Delete" onClick={() => confirm('thought', it.text, () => db.inbox.delete(it.id))}>
                    <Icon name="trash" size={18} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {confirmNode}
    </>
  );
}
