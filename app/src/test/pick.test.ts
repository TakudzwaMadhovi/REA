import { describe, expect, it } from 'vitest';
import { newTask } from '../db';
import { pickNow, rankToday } from '../lib/pick';
import { parseSteps } from '../lib/ai';
import { inboxToTask } from '../views/Inbox';
import { daysComplete } from '../views/Routines';
import { progress } from '../views/Goals';

const T = '2026-11-09';

describe('pickNow', () => {
  it('puts overdue first, then timed, then the shortest', () => {
    const a = newTask({ title: 'long', due: T, estimateMin: 60 });
    const b = newTask({ title: 'short', due: T, estimateMin: 5 });
    const c = newTask({ title: 'timed', due: T, dueTime: '15:00', estimateMin: 30 });
    const d = newTask({ title: 'late', due: '2026-11-07', estimateMin: 90 });
    expect(rankToday([a, b, c, d], T).map((t) => t.title)).toEqual(['late', 'timed', 'short', 'long']);
  });
  it('never picks someday, future or done tasks', () => {
    const tasks = [newTask({ title: 's', due: null }), newTask({ title: 'f', due: '2026-11-10' }), newTask({ title: 'd', due: T, done: true })];
    expect(pickNow(tasks, T)).toBeNull();
  });
});

describe('inbox triage', () => {
  it('turns a thought into a task keeping its text and time', () => {
    const t = inboxToTask({ id: 'i', text: 'Renew passport', createdAt: 42 }, T);
    expect(t).toMatchObject({ title: 'Renew passport', due: T, createdAt: 42, done: false });
  });
  it('without a day it becomes a someday task', () => {
    expect(inboxToTask({ id: 'i', text: 'x', createdAt: 1 }, null).due).toBeNull();
  });
});

describe('routines', () => {
  it('counts complete days this week without streak penalties', () => {
    const r = { id: 'r', name: 'Morning', time: '07:30', ifThen: '', order: 0, items: [{ id: 'a', title: 'a', done: false }, { id: 'b', title: 'b', done: false }] };
    const ticks = [
      { id: 'r|a|2026-11-09', routineId: 'r', day: '2026-11-09' }, { id: 'r|b|2026-11-09', routineId: 'r', day: '2026-11-09' },
      { id: 'r|a|2026-11-10', routineId: 'r', day: '2026-11-10' }
    ];
    const week = daysComplete(r, ticks, new Date('2026-11-11T12:00'));
    expect(week.filter((d) => d.complete).map((d) => d.day)).toEqual(['2026-11-09']);
  });
  it('goal progress handles zero tasks', () => {
    expect(progress(0, 0)).toBe(0);
    expect(progress(1, 4)).toBe(25);
  });
});

describe('AI step parsing', () => {
  it('reads a JSON array even with text around it', () => {
    expect(parseSteps('Here:\n["Open laptop", "Find form"]')).toEqual(['Open laptop', 'Find form']);
  });
  it('falls back to a bulleted list', () => {
    expect(parseSteps('1. Open laptop\n- Find form\n')).toEqual(['Open laptop', 'Find form']);
  });
});
