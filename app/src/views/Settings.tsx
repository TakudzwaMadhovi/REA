import { Fragment, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { exportAll, getSetting, importAll, setSetting } from '../db';
import { connectRelay, disconnectRelay, requestPermission } from '../lib/notify';
import { useToast } from '../components/ui';

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="set-row" aria-label={title}>
      <div className="lbl"><h2>{title}</h2><p>{desc}</p></div>
      <div className="set-panel">{children}</div>
    </section>
  );
}

export function Settings() {
  const toast = useToast();
  const s = useLiveQuery(async () => ({
    name: await getSetting('name', ''),
    wake: await getSetting('wake', '07:00'),
    bed: await getSetting('bed', '22:30'),
    apiKey: await getSetting('apiKey', ''),
    relayUrl: await getSetting('relayUrl', ''),
    relayOn: await getSetting('relaySubscribed', false),
    lastBackup: await getSetting<number | null>('lastBackup', null),
    theme: await getSetting('theme', 'system')
  }), []);
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [relay, setRelay] = useState<string | null>(null);
  const [relayErr, setRelayErr] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  if (!s) return null;

  const backup = async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rea-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    await setSetting('lastBackup', Date.now());
    toast({ title: 'Backup downloaded' });
  };
  const restore = async (f: File) => {
    try {
      await importAll(JSON.parse(await f.text()));
      toast({ title: 'Backup restored' });
    } catch (e) {
      toast({ title: 'Could not restore', body: (e as Error).message || 'Choose a .json file exported from Rea.' });
    }
  };
  const theme = (v: string) => {
    setSetting('theme', v);
    if (v === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = v;
  };
  const daysSince = s.lastBackup ? Math.floor((Date.now() - s.lastBackup) / 86_400_000) : null;

  return (
    <>
      <header className="page-head"><div><h1>Settings</h1><p>Everything is saved on this device as you type.</p></div></header>

      <Row title="You and your day" desc="Your name goes in the greeting. Wake and bed times set the length of the day bar and the time-left disc on Today.">
        <label className="field"><span>Your name <span className="hint">(optional)</span></span>
          <input className="input" defaultValue={s.name} onBlur={(e) => setSetting('name', e.target.value.trim())} autoComplete="given-name" />
        </label>
        <div className="grid2">
          <label className="field"><span>Day starts</span><input className="input" type="time" defaultValue={s.wake} onChange={(e) => e.target.value && setSetting('wake', e.target.value)} /></label>
          <label className="field"><span>Bedtime</span><input className="input" type="time" defaultValue={s.bed} onChange={(e) => e.target.value && setSetting('bed', e.target.value)} /></label>
        </div>
        <label className="field"><span>Theme</span>
          <select className="input" value={s.theme} onChange={(e) => theme(e.target.value)}>
            <option value="system">Match this device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </Row>

      <Row title="Notifications" desc="Reminders show as system notifications while Rea is open or in a background tab. To get them with Rea fully closed, connect a push relay below.">
        <p>
          {perm === 'granted' && 'Notifications are on for this browser.'}
          {perm === 'denied' && 'Notifications are blocked. Allow them for this site in your browser’s site settings.'}
          {perm === 'default' && 'Notifications are off.'}
          {perm === 'unsupported' && 'This browser doesn’t support notifications. On iPhone, add Rea to your Home Screen first (Share, then Add to Home Screen).'}
        </p>
        {perm === 'default' && <div><button className="btn primary" onClick={async () => setPerm(await requestPermission())}>Turn on notifications</button></div>}
        <label className="field"><span>Push relay address <span className="hint">(optional)</span></span>
          <input className="input" type="url" placeholder="https://…" defaultValue={s.relayUrl} onChange={(e) => { setRelay(e.target.value); setRelayErr(''); }} aria-invalid={Boolean(relayErr)} aria-describedby="relay-help relay-err" />
          <span id="relay-help" className="hint">The relay stores only reminder titles and times, never your tasks or notes. Setup steps are in the relay’s README.</span>
          {relayErr && <span id="relay-err" className="err" role="alert">{relayErr}</span>}
        </label>
        <div className="row">
          <button className="btn" disabled={busy || !(relay ?? s.relayUrl)} onClick={async () => {
            setBusy(true);
            try { await connectRelay((relay ?? s.relayUrl).trim()); setPerm('granted'); toast({ title: 'Relay connected', body: 'Reminders will arrive with Rea closed.' }); }
            catch (e) { setRelayErr((e as Error).message.includes('fetch') ? 'Couldn’t reach the relay. Check the address and that it’s running.' : (e as Error).message); }
            finally { setBusy(false); }
          }}>{s.relayOn ? 'Reconnect relay' : 'Connect relay'}</button>
          {s.relayOn && <button className="btn quiet" onClick={() => { disconnectRelay(); toast({ title: 'Relay disconnected' }); }}>Disconnect relay</button>}
          {s.relayOn && <span className="chip">Connected</span>}
        </div>
      </Row>

      <Row title="Task breakdown with Claude" desc="Optional. With your own Anthropic API key, “Break it down” turns a task into small steps. The key stays on this device and is sent only to Anthropic.">
        <label className="field"><span>Anthropic API key</span>
          <input className="input" type="password" autoComplete="off" placeholder="sk-ant-…" defaultValue={s.apiKey} onBlur={(e) => { setSetting('apiKey', e.target.value.trim()); if (e.target.value.trim() !== s.apiKey) toast({ title: e.target.value.trim() ? 'API key saved' : 'API key removed' }); }} />
          <span className="hint">Create one at console.anthropic.com. Usage is billed to your Anthropic account.</span>
        </label>
      </Row>

      <Row title="Backup" desc="Your data lives only in this browser. Clearing site data deletes it, so download a backup now and then.">
        <p className="num">{s.lastBackup ? `Last backup ${format(s.lastBackup, 'd MMM yyyy')} (${daysSince === 0 ? 'today' : `${daysSince} days ago`}).` : 'No backup yet.'}</p>
        <div className="row">
          <button className="btn primary" onClick={backup}>Download backup</button>
          <button className="btn" onClick={() => file.current?.click()}>Restore from backup</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        </div>
        <span className="hint small muted">Restoring replaces everything on this device with the backup.</span>
      </Row>

      <Row title="Keyboard" desc="Shortcuts work anywhere outside a text field.">
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', margin: 0 }}>
          {[['N', 'Capture a thought'], ['T', 'Today'], ['F', 'Focus'], ['I', 'Inbox'], ['C', 'Calendar'], ['/', 'Search tasks'], ['Esc', 'Close a panel']].map(([k, v]) => (
            <Fragment key={k}><dt><kbd className="chip">{k}</kbd></dt><dd style={{ margin: 0 }}>{v}</dd></Fragment>
          ))}
        </dl>
      </Row>
    </>
  );
}
