import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { collectDue, tick, upcomingForRelay } from '../lib/notify';

(globalThis as any).document = { visibilityState: 'visible' };
const NOW = new Date('2026-11-09T12:00').getTime();

beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });

describe('reminders', () => {
  it('fires a due reminder once, not again after it fired', async () => {
    await db.reminders.add({ id: 'r1', title: 'Pay rent', at: NOW - 60_000, link: null, nag: false, done: false });
    expect((await collectDue(NOW)).map((a) => a.title)).toEqual(['Pay rent']);
    await tick(NOW);
    expect(await collectDue(NOW + 30_000)).toHaveLength(0);
  });
  it('nag reminders come back 5 minutes later until done', async () => {
    await db.reminders.add({ id: 'r2', title: 'Meds', at: NOW, link: null, nag: true, done: false });
    await tick(NOW);
    expect((await db.reminders.get('r2'))!.at).toBe(NOW + 5 * 60_000);
    expect(await collectDue(NOW + 5 * 60_000)).toHaveLength(1);
  });
  it('ignores done and future reminders', async () => {
    await db.reminders.bulkAdd([
      { id: 'a', title: 'done', at: NOW - 1, link: null, nag: false, done: true },
      { id: 'b', title: 'later', at: NOW + 60_000, link: null, nag: false, done: false }
    ]);
    expect(await collectDue(NOW)).toHaveLength(0);
  });
  it('fires an event reminder before it starts but not for events long started', async () => {
    await db.events.bulkAdd([
      { id: 'soon', title: 'Dentist', start: NOW + 10 * 60_000, durationMin: 30, allDay: false, repeat: 'none', remindMin: 15, notes: '' },
      { id: 'past', title: 'Stand-up', start: NOW - 2 * 3600_000, durationMin: 30, allDay: false, repeat: 'none', remindMin: 10, notes: '' }
    ]);
    expect((await collectDue(NOW)).map((a) => a.title)).toEqual(['Dentist']);
  });
  it('sends only future reminders to the relay, soonest first', async () => {
    await db.reminders.bulkAdd([
      { id: 'x', title: 'B', at: NOW + 7200_000, link: null, nag: false, done: false },
      { id: 'y', title: 'A', at: NOW + 3600_000, link: null, nag: false, done: false },
      { id: 'z', title: 'old', at: NOW - 1, link: null, nag: false, done: false }
    ]);
    expect((await upcomingForRelay(NOW)).map((r) => r.title)).toEqual(['A', 'B']);
  });
});
