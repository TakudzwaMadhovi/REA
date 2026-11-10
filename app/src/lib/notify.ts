import { db, getSetting, setSetting, uid, type Reminder, type Task } from '../db';
import { format } from 'date-fns';
import { occurrencesAll } from './recurrence';

export interface Alert { key: string; title: string; body: string; reminderId: string | null; link: Reminder['link'] }

type Listener = (a: Alert) => void;
const listeners = new Set<Listener>();
export const onAlert = (fn: Listener) => (listeners.add(fn), () => listeners.delete(fn));

export const NAG_EVERY_MS = 5 * 60_000;
const LOOKBACK_MS = 6 * 3600_000; // missed reminders from the last 6 h still fire once

/** Everything that should alert at `now` and has not alerted yet. Pure apart from DB reads. */
export async function collectDue(now = Date.now()): Promise<Alert[]> {
  const out: Alert[] = [];
  const rems = await db.reminders.where('at').belowOrEqual(now).toArray();
  for (const r of rems) {
    if (r.done || r.at < now - LOOKBACK_MS) continue;
    out.push({ key: `rem|${r.id}|${r.at}`, title: r.title, body: r.nag ? 'Reminder (repeats until done)' : 'Reminder', reminderId: r.id, link: r.link });
  }
  const events = await db.events.toArray();
  for (const o of occurrencesAll(events, now - LOOKBACK_MS, now + 24 * 3600_000)) {
    const rm = o.event.remindMin;
    if (rm == null) continue;
    const fireAt = o.start - rm * 60_000;
    if (fireAt > now || fireAt < now - LOOKBACK_MS || o.start < now - 10 * 60_000) continue;
    const when = format(o.start, 'HH:mm');
    out.push({
      key: `evt|${o.event.id}|${o.start}`,
      title: o.event.title,
      body: rm === 0 ? `Starts now (${when})` : `Starts at ${when}, in ${rm} min`,
      reminderId: null,
      link: { type: 'event', id: o.event.id }
    });
  }
  // routines: once a day at their usual time, unless already all ticked
  const day = format(now, 'yyyy-MM-dd');
  for (const r of await db.routines.toArray()) {
    if (!r.time || !r.items.length) continue;
    const [h, m] = r.time.split(':').map(Number);
    const at = new Date(now); at.setHours(h, m, 0, 0);
    if (at.getTime() > now || at.getTime() < now - LOOKBACK_MS) continue;
    const ticked = await db.ticks.where('day').equals(day).filter((t) => t.routineId === r.id).count();
    if (ticked >= r.items.length) continue;
    out.push({ key: `rtn|${r.id}|${day}`, title: `${r.name} routine`, body: `${r.items.length - ticked} small steps. Start with: ${r.items[0].title}`, reminderId: null, link: { type: 'routine', id: r.id } });
  }
  const fired = new Set((await db.fired.bulkGet(out.map((a) => a.key))).filter(Boolean).map((f) => f!.id));
  return out.filter((a) => !fired.has(a.key));
}

export async function relayActive() {
  return Boolean(await getSetting<string>('relayUrl', '')) && Boolean(await getSetting<boolean>('relaySubscribed', false));
}

async function showSystem(a: Alert) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker?.getRegistration();
  const opts: NotificationOptions & { actions?: { action: string; title: string }[] } = {
    body: a.body,
    tag: a.key,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { reminderId: a.reminderId, link: a.link, title: a.title },
    requireInteraction: true,
    actions: [
      { action: 'snooze', title: 'Snooze 15 min' },
      { action: 'done', title: 'Done' }
    ]
  };
  if (reg) await reg.showNotification(a.title, opts);
  else new Notification(a.title, opts);
}

export async function tick(now = Date.now()) {
  const due = await collectDue(now);
  if (!due.length) return;
  const viaRelay = await relayActive();
  for (const a of due) {
    await db.fired.put({ id: a.key, at: now });
    listeners.forEach((fn) => fn(a));
    // With the relay on, the server sends the push; showing it here too would double it.
    if (!viaRelay) await showSystem(a);
    if (a.reminderId) {
      const r = await db.reminders.get(a.reminderId);
      if (r?.nag && !r.done) await db.reminders.update(r.id, { at: now + NAG_EVERY_MS });
    }
  }
  await db.fired.where('at').below(now - 3 * 86_400_000).delete();
}

let timer: number | undefined;
export function startReminderLoop() {
  if (timer) return;
  const run = () => tick().catch(console.error);
  run();
  timer = window.setInterval(run, 15_000);
  document.addEventListener('visibilitychange', run);
}

export async function snooze(alert: Pick<Alert, 'reminderId' | 'title' | 'link'>, minutes: number) {
  const at = Date.now() + minutes * 60_000;
  if (alert.reminderId) await db.reminders.update(alert.reminderId, { at, done: false });
  else await db.reminders.put({ id: uid(), title: alert.title, at, link: alert.link, nag: false, done: false });
  scheduleRelaySync();
}

export async function dismiss(reminderId: string | null) {
  if (reminderId) await db.reminders.update(reminderId, { done: true });
  scheduleRelaySync();
}

/** Keep the reminder that mirrors a task's remindAt in step with the task. */
export async function syncTaskReminder(t: Task) {
  const id = `task:${t.id}`;
  if (!t.remindAt || t.done) await db.reminders.delete(id);
  else {
    const prev = await db.reminders.get(id);
    await db.reminders.put({ id, title: t.title, at: t.remindAt, link: { type: 'task', id: t.id }, nag: prev?.nag ?? false, done: false });
  }
  scheduleRelaySync();
}

export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission === 'default' ? Notification.requestPermission() : Notification.permission;
}

/* ---------- optional push relay ---------- */

export async function upcomingForRelay(now = Date.now()) {
  const horizon = now + 7 * 86_400_000;
  const list: { id: string; title: string; body: string; at: number }[] = [];
  for (const r of await db.reminders.where('at').between(now, horizon).toArray())
    if (!r.done) list.push({ id: `rem|${r.id}|${r.at}`, title: r.title, body: 'Reminder', at: r.at });
  for (const o of occurrencesAll(await db.events.toArray(), now, horizon)) {
    if (o.event.remindMin == null) continue;
    const at = o.start - o.event.remindMin * 60_000;
    if (at >= now) list.push({ id: `evt|${o.event.id}|${o.start}`, title: o.event.title, body: `Starts in ${o.event.remindMin} min`, at });
  }
  return list.sort((a, b) => a.at - b.at);
}

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

export async function connectRelay(url: string) {
  const base = url.replace(/\/$/, '');
  const perm = await requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in your browser settings, then try again.');
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await (await fetch(`${base}/vapid`)).json();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
  const res = await fetch(`${base}/subscribe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub) });
  if (!res.ok) throw new Error(`The relay answered ${res.status}. Check the address and that the relay is running.`);
  const { id } = await res.json();
  await setSetting('relayUrl', base);
  await setSetting('relayId', id);
  await setSetting('relaySubscribed', true);
  await syncRelay();
}

export async function disconnectRelay() {
  await setSetting('relaySubscribed', false);
}

export async function syncRelay() {
  if (!(await relayActive())) return;
  const base = await getSetting<string>('relayUrl', '');
  const id = await getSetting<string>('relayId', '');
  await fetch(`${base}/reminders/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reminders: await upcomingForRelay() })
  });
}

let syncTimer: ReturnType<typeof setTimeout> | undefined;
export function scheduleRelaySync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncRelay().catch(() => {}), 1500);
}
