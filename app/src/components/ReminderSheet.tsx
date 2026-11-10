import { go } from '../lib/router';
import { snooze, type Alert } from '../lib/notify';
import { Dialog, useToast } from './ui';

const SNOOZES = [5, 15, 60];

/** Opened by tapping a notification. iPhone shows no buttons on web notifications, so they live here. */
export function ReminderSheet({ r, onClose, onDone }: { r: Pick<Alert, 'reminderId' | 'title' | 'link'>; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const target = r.link?.type === 'task' ? `focus/${r.link.id}` : r.link?.type === 'routine' ? 'routines' : r.link?.type === 'event' ? 'calendar' : null;
  return (
    <Dialog label={`Reminder: ${r.title}`} onClose={onClose}>
      <p className="muted">Reminder</p>
      <h2 style={{ fontSize: 24, marginTop: 4 }}>{r.title}</h2>
      <div className="action-list" style={{ marginTop: 20 }}>
        {target && <button className="btn primary" data-autofocus onClick={() => { go(target); onClose(); }}>{r.link?.type === 'task' ? 'Start it now' : 'Open it'}</button>}
        <button className="btn" onClick={() => { onDone(); onClose(); }}>Mark done</button>
        <div className="row" style={{ gap: 8 }}>
          {SNOOZES.map((m) => (
            <button key={m} className="btn" style={{ flex: 1 }} onClick={async () => {
              await snooze(r, m);
              toast({ title: `Snoozed for ${m < 60 ? `${m} min` : '1 hour'}` });
              onClose();
            }}>Snooze {m < 60 ? `${m} min` : '1 h'}</button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
