import { useState } from 'react';
import { format } from 'date-fns';
import { db, type CalEvent } from '../db';
import { scheduleRelaySync } from '../lib/notify';
import { SlideOver, useConfirm, useToast } from './ui';
import { Icon } from './Icon';

export function EventEditor({ event, isNew, onClose }: { event: CalEvent; isNew: boolean; onClose: () => void }) {
  const [e, setE] = useState(event);
  const [err, setErr] = useState('');
  const [confirm, confirmNode] = useConfirm();
  const toast = useToast();
  const set = (p: Partial<CalEvent>) => setE((x) => ({ ...x, ...p }));

  const save = async () => {
    if (!e.title.trim()) { setErr('Give the event a name.'); return; }
    await db.events.put({ ...e, title: e.title.trim() });
    scheduleRelaySync();
    toast({ title: isNew ? 'Event added' : 'Event saved' });
    onClose();
  };

  const dateStr = format(e.start, 'yyyy-MM-dd');
  const timeStr = format(e.start, 'HH:mm');
  const setStart = (d: string, t: string) => {
    const ms = new Date(`${d}T${t || '00:00'}`).getTime();
    if (!Number.isNaN(ms)) set({ start: ms });
  };

  return (
    <SlideOver
      title={isNew ? 'New event' : 'Event'}
      onClose={onClose}
      footer={
        <>
          {!isNew ? (
            <button className="btn quiet" onClick={() => confirm('event', e.title, async () => {
              await db.events.delete(e.id);
              scheduleRelaySync();
              toast({ title: 'Event deleted' });
              onClose();
            })}><Icon name="trash" size={18} /> Delete event</button>
          ) : <span />}
          <div className="row">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save}>{isNew ? 'Add event' : 'Save event'}</button>
          </div>
        </>
      }
    >
      <label className="field"><span>What is it?</span>
        <input className="input" data-autofocus value={e.title} aria-invalid={Boolean(err)} aria-describedby="ev-err"
          onChange={(x) => { setErr(''); set({ title: x.target.value }); }}
          onBlur={() => setErr(e.title.trim() ? '' : 'Give the event a name.')} placeholder="e.g. Doctor’s appointment" />
        {err && <span id="ev-err" className="err">{err}</span>}
      </label>
      <div className="grid2">
        <label className="field"><span>Day</span>
          <input className="input" type="date" value={dateStr} onChange={(x) => setStart(x.target.value, timeStr)} />
        </label>
        <label className="field"><span>Starts</span>
          <input className="input" type="time" value={timeStr} disabled={e.allDay} onChange={(x) => setStart(dateStr, x.target.value)} />
        </label>
      </div>
      <div className="grid2">
        <label className="field"><span>Length</span>
          <select className="input" value={e.durationMin} disabled={e.allDay} onChange={(x) => set({ durationMin: Number(x.target.value) })}>
            {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}
          </select>
        </label>
        <label className="field"><span>Repeats</span>
          <select className="input" value={e.repeat} onChange={(x) => set({ repeat: x.target.value as CalEvent['repeat'] })}>
            <option value="none">Does not repeat</option>
            <option value="daily">Every day</option>
            <option value="weekdays">Every weekday</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
          </select>
        </label>
      </div>
      <label className="row" style={{ gap: 10 }}>
        <input type="checkbox" checked={e.allDay} onChange={(x) => set({ allDay: x.target.checked, start: new Date(dateStr + 'T00:00').getTime() })} style={{ width: 20, height: 20 }} />
        All day
      </label>
      <label className="field"><span>Remind me</span>
        <select className="input" value={e.remindMin ?? ''} onChange={(x) => set({ remindMin: x.target.value === '' ? null : Number(x.target.value) })}>
          <option value="">No reminder</option>
          <option value="0">When it starts</option>
          {[5, 10, 15, 30, 60, 120, 1440].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min before` : m < 1440 ? `${m / 60} h before` : '1 day before'}</option>)}
        </select>
        <span className="hint">Tip: 15 min or more gives you time to switch tasks and get there.</span>
      </label>
      <label className="field"><span>Notes</span>
        <textarea className="input" value={e.notes} onChange={(x) => set({ notes: x.target.value })} />
      </label>
      {confirmNode}
    </SlideOver>
  );
}
