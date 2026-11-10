import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newTask, type CalEvent, type Task } from './db';
import { go, useRoute } from './lib/router';
import { dismiss, onAlert, snooze, startReminderLoop, type Alert } from './lib/notify';
import { dayKey } from './lib/time';
import { Icon, Mark } from './components/Icon';
import { useToast } from './components/ui';
import { QuickCapture } from './components/QuickCapture';
import { ReminderSheet } from './components/ReminderSheet';
import { isStandalone, requestPersistence, useKeyboardOpen } from './lib/platform';
import { TaskEditor } from './components/TaskEditor';
import { EventEditor } from './components/EventEditor';
import { Today } from './views/Today';
import { Focus } from './views/Focus';
import { Inbox } from './views/Inbox';
import { Tasks } from './views/Tasks';
import { Calendar } from './views/Calendar';
import { Goals } from './views/Goals';
import { Routines } from './views/Routines';
import { Settings } from './views/Settings';

const MORE = ['focus', 'tasks', 'goals', 'routines', 'settings'];

interface Editors {
  openTask: (t?: Partial<Task> | Task) => void;
  openEvent: (e: CalEvent, isNew?: boolean) => void;
  capture: () => void;
}
const EditorCtx = createContext<Editors>(null!);
export const useEditors = () => useContext(EditorCtx);

const NAV = [
  { name: 'today', label: 'Today', icon: 'today', key: 'T' },
  { name: 'focus', label: 'Focus', icon: 'focus', key: 'F' },
  { name: 'inbox', label: 'Inbox', icon: 'inbox', key: 'I' },
  { name: 'tasks', label: 'Tasks', icon: 'tasks' },
  { name: 'calendar', label: 'Calendar', icon: 'calendar', key: 'C' },
  { name: 'goals', label: 'Goals', icon: 'goals' },
  { name: 'routines', label: 'Routines', icon: 'routines' },
  { name: 'settings', label: 'Settings', icon: 'settings' }
];

export function App() {
  const route = useRoute();
  const toast = useToast();
  const [task, setTask] = useState<Task | null>(null);
  const [event, setEvent] = useState<{ e: CalEvent; isNew: boolean } | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reminder, setReminder] = useState<Pick<Alert, 'reminderId' | 'title' | 'link'> | null>(null);
  const keyboard = useKeyboardOpen();

  // iOS opens the keyboard only for focus() inside the tap itself; this hidden field takes it until the sheet mounts.
  const startCapture = () => {
    document.getElementById('kbd-proxy')?.focus();
    setCapturing(true);
  };

  useEffect(() => { if (isStandalone()) requestPersistence(); }, []);
  const inboxCount = useLiveQuery(() => db.inbox.count(), [], 0);
  const todayCount = useLiveQuery(() => db.tasks.filter((t) => !t.done && !!t.due && t.due <= dayKey()).count(), [], 0);

  const editors: Editors = {
    openTask: (t) => setTask(t && 'id' in t && t.id ? (t as Task) : newTask(t ?? {})),
    openEvent: (e, isNew = false) => setEvent({ e, isNew }),
    capture: startCapture
  };

  // reminders: in-app toast + actions
  useEffect(() => {
    startReminderLoop();
    const off = onAlert((a: Alert) =>
      toast({
        title: a.title,
        body: a.body,
        sticky: true,
        actions: [
          { label: 'Snooze 15 min', run: () => snooze(a, 15) },
          { label: 'Done', run: () => handleDone(a) }
        ]
      })
    );
    return () => { off(); };
  }, [toast]);

  // actions pressed on a system notification
  useEffect(() => {
    const handle = (action: string, data: { reminderId?: string | null; key?: string; title?: string; link?: Alert['link'] }) => {
      const reminderId = data.reminderId ?? (data.key?.startsWith('rem|') ? data.key.split('|')[1] : null);
      const a = { reminderId, title: data.title ?? 'Reminder', link: data.link ?? null };
      if (action === 'snooze') snooze(a, 15).then(() => toast({ title: 'Snoozed for 15 min' }));
      else if (action === 'done') handleDone(a as Alert);
      // a plain tap (the only option on iPhone, which shows no buttons on web notifications)
      else if (!a.link && reminderId) db.reminders.get(reminderId).then((r) => setReminder({ ...a, link: r?.link ?? null }));
      else setReminder(a);
    };
    const onMsg = (e: MessageEvent) => e.data?.type === 'notification-action' && handle(e.data.action, e.data.data ?? {});
    navigator.serviceWorker?.addEventListener('message', onMsg);
    const q = new URLSearchParams(location.search);
    if (q.get('act')) {
      try { handle(q.get('act')!, JSON.parse(q.get('d') ?? '{}')); } catch { /* ignore malformed */ }
      history.replaceState(null, '', '/' + location.hash);
    }
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, [toast]);

  const handleDone = async (a: Pick<Alert, 'reminderId' | 'link'>) => {
    await dismiss(a.reminderId);
    if (a.link?.type === 'task') {
      const t = await db.tasks.get(a.link.id);
      if (t) await db.tasks.put({ ...t, done: true, doneAt: Date.now() });
    }
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest('input,textarea,select,[contenteditable],[role=dialog]')) return;
      const k = e.key.toLowerCase();
      if (k === 'n') { e.preventDefault(); startCapture(); }
      else if (k === 't') go('today');
      else if (k === 'f') go('focus');
      else if (k === 'i') go('inbox');
      else if (k === 'c') go('calendar');
      else if (k === '/') { e.preventDefault(); go('tasks'); setTimeout(() => document.getElementById('task-search')?.focus(), 50); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const views: Record<string, ReactNode> = {
    today: <Today />, focus: <Focus taskId={route.param} />, inbox: <Inbox />, tasks: <Tasks />,
    calendar: <Calendar />, goals: <Goals selected={route.param} />, routines: <Routines />, settings: <Settings />
  };
  const counts: Record<string, number> = { inbox: inboxCount ?? 0, today: todayCount ?? 0 };
  const current = NAV.find((n) => n.name === route.name) ?? NAV[0];

  return (
    <EditorCtx.Provider value={editors}>
      <a href="#main" className="sr-only">Skip to content</a>
      <div className="shell">
        <aside className="side" aria-label="Main">
          <a className="brand" href="#/today"><Mark /> Rea</a>
          <button className="btn primary side-capture" onClick={startCapture} aria-keyshortcuts="N">
            <Icon name="plus" size={20} /> Capture a thought
          </button>
          <nav className="nav" aria-label="Sections">
            {NAV.slice(0, 5).map((n) => (
              <a key={n.name} href={`#/${n.name}`} aria-current={route.name === n.name ? 'page' : undefined} aria-keyshortcuts={n.key}>
                <span className="row" style={{ gap: 10 }}><Icon name={n.icon} />{n.label}</span>
                {counts[n.name] ? <span className="count num">{counts[n.name]}</span> : null}
              </a>
            ))}
            <div className="nav-group">Plan ahead</div>
            {NAV.slice(5).map((n) => (
              <a key={n.name} href={`#/${n.name}`} aria-current={route.name === n.name ? 'page' : undefined}>
                <span className="row" style={{ gap: 10 }}><Icon name={n.icon} />{n.label}</span>
              </a>
            ))}
          </nav>
          <div className="spacer" />
          <p className="small muted" style={{ padding: '0 12px' }}>Press <b>N</b> anywhere to capture a thought.</p>
        </aside>

        <main className="main" id="main" tabIndex={-1}>
          <div className="topbar">
            <a className="brand" href="#/today" style={{ padding: 0 }}><Mark size={26} /> <span>Rea</span></a>
            <a className="icon-btn" href="#/settings" aria-label="Settings"><Icon name="settings" /></a>
          </div>
          <div className="col">{views[route.name] ?? <Today />}</div>
        </main>
      </div>

      <input id="kbd-proxy" aria-hidden="true" tabIndex={-1} style={{ position: 'fixed', top: 0, left: 0, opacity: 0, height: 1, width: 1, fontSize: 16, pointerEvents: 'none' }} />


      <nav className={`tabbar${keyboard ? ' hidden' : ''}`} aria-label="Sections">
        {['today', 'inbox', 'capture', 'calendar'].map((k) => k === 'capture' ? (
          <button key="capture" className="tab-capture" onClick={startCapture} aria-label="Capture a thought">
            <span><Icon name="plus" size={26} /></span>
          </button>
        ) : (() => { const n = NAV.find((x) => x.name === k)!; return (
          <a key={n.name} href={`#/${n.name}`} aria-current={route.name === n.name ? 'page' : undefined}>
            <Icon name={n.icon} size={22} />{n.label}{counts[n.name] ? ` ${counts[n.name]}` : ''}
          </a>
        ); })())}
        <button aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)} aria-current={MORE.includes(route.name) ? 'page' : undefined}>
          <Icon name="more" size={22} />More
        </button>
      </nav>
      {moreOpen && (
        <MoreSheet onClose={() => setMoreOpen(false)} current={route.name} />
      )}

      {capturing && <QuickCapture onClose={() => setCapturing(false)} />}
      {reminder && <ReminderSheet r={reminder} onClose={() => setReminder(null)} onDone={async () => { await handleDone(reminder); toast({ title: 'Done' }); }} />}
      {task && <TaskEditor task={task} onClose={() => setTask(null)} />}
      {event && <EventEditor event={event.e} isNew={event.isNew} onClose={() => setEvent(null)} />}
    </EditorCtx.Provider>
  );
}

function MoreSheet({ onClose, current }: { onClose: () => void; current: string }) {
  useEffect(() => {
    const on = () => onClose();
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} style={{ zIndex: 19 }} />
      <div className="panel" style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(80px + env(safe-area-inset-bottom))', zIndex: 21, background: 'var(--ground)', boxShadow: '0 10px 40px rgb(0 0 0 / .2)' }}>
        <nav className="nav" aria-label="More sections">
          {MORE.map((n) => {
            const item = NAV.find((x) => x.name === n)!;
            return (
              <a key={n} href={`#/${n}`} aria-current={current === n ? 'page' : undefined} style={{ height: 52 }}>
                <span className="row" style={{ gap: 12 }}><Icon name={item.icon} />{item.label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </>
  );
}
