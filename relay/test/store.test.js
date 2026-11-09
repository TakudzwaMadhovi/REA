import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../store.js';

test('due reminders are sent once', () => {
  const s = new Store(null);
  const id = s.subscribe({ endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } });
  s.setReminders(id, [{ id: 'a', title: 'A', at: 1000 }, { id: 'b', title: 'B', at: 5000 }]);
  assert.deepEqual(s.due(2000).map((d) => d.r.id), ['a']);
  s.markSent(id, 'a', 2000);
  assert.deepEqual(s.due(6000).map((d) => d.r.id), ['b']);
});

test('re-subscribing the same endpoint keeps one id', () => {
  const s = new Store(null);
  const sub = { endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } };
  assert.equal(s.subscribe(sub), s.subscribe(sub));
});

test('only id, title, body and time are stored', () => {
  const s = new Store(null);
  const id = s.subscribe({ endpoint: 'e', keys: { p256dh: 'k', auth: 'a' } });
  s.setReminders(id, [{ id: 'a', title: 'T', at: 1, notes: 'secret' }, { bad: true }]);
  assert.deepEqual(s.data.subs[id].reminders, [{ id: 'a', title: 'T', body: '', at: 1 }]);
});
