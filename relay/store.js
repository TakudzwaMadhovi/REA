import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

/**
 * Tiny JSON-file store. Per subscription it keeps only the push endpoint and a list of
 * { id, title, body, at } reminders. No tasks, notes or anything else ever reaches the relay.
 */
export class Store {
  constructor(file) {
    this.file = file;
    this.data = file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { subs: {} };
  }
  save() {
    if (!this.file) return;
    writeFileSync(this.file + '.tmp', JSON.stringify(this.data));
    renameSync(this.file + '.tmp', this.file);
  }
  subscribe(sub) {
    const existing = Object.entries(this.data.subs).find(([, s]) => s.sub.endpoint === sub.endpoint);
    if (existing) { existing[1].sub = sub; this.save(); return existing[0]; }
    const id = randomUUID();
    this.data.subs[id] = { sub, reminders: [], sent: [] };
    this.save();
    return id;
  }
  setReminders(id, reminders) {
    const s = this.data.subs[id];
    if (!s) return false;
    s.reminders = reminders
      .filter((r) => r && typeof r.id === 'string' && Number.isFinite(r.at))
      .slice(0, 500)
      .map((r) => ({ id: r.id.slice(0, 200), title: String(r.title ?? '').slice(0, 200), body: String(r.body ?? '').slice(0, 300), at: r.at }));
    this.save();
    return true;
  }
  /** Reminders due at `now` that were not sent yet, across all subscriptions. */
  due(now) {
    const out = [];
    for (const [id, s] of Object.entries(this.data.subs)) {
      const sent = new Set(s.sent);
      for (const r of s.reminders) if (r.at <= now && r.at > now - 6 * 3600_000 && !sent.has(r.id)) out.push({ subId: id, sub: s.sub, r });
    }
    return out;
  }
  markSent(subId, rid, now) {
    const s = this.data.subs[subId];
    if (!s) return;
    s.sent.push(rid);
    s.sent = s.sent.slice(-1000);
    s.reminders = s.reminders.filter((r) => r.at > now - 6 * 3600_000);
    this.save();
  }
  remove(subId) { delete this.data.subs[subId]; this.save(); }
}
