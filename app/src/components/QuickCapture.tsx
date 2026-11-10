import { useState } from 'react';
import { db, uid } from '../db';
import { Dialog, useToast } from './ui';

/** One field. Enter saves to the inbox. Nothing is required, nothing to decide now. */
export function QuickCapture({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [count, setCount] = useState(0);
  const toast = useToast();

  const save = async () => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const now = Date.now();
    await db.inbox.bulkAdd(lines.map((l, i) => ({ id: uid(), text: l, createdAt: now + i })));
    setCount((c) => c + lines.length);
    setText('');
  };

  const close = () => {
    if (count) toast({ title: count === 1 ? 'Saved to inbox' : `${count} thoughts saved to inbox` });
    onClose();
  };

  return (
    <Dialog label="Capture a thought" onClose={close}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label htmlFor="cap" style={{ display: 'block', fontWeight: 600, marginBottom: 10 }}>What’s on your mind?</label>
        <input id="cap" className="input capture-input" data-autofocus data-autofocus-touch enterKeyHint="enter" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
        <p className="small muted" style={{ marginTop: 10 }} aria-live="polite">
          {count ? `${count} saved. Keep going, or tap Done when your head is clear.` : 'Press return to save. Sort it later in Inbox.'}
        </p>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn quiet" onClick={close}>Done</button>
          <button type="submit" className="btn primary" disabled={!text.trim()}>Save to inbox</button>
        </div>
      </form>
    </Dialog>
  );
}
