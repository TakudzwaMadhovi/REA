import type { Task } from '../db';

/**
 * The one task to show as "now". Order:
 * 1. overdue, oldest due first
 * 2. due today with a time, earliest first
 * 3. due today without a time, smallest estimate first (an easy start lowers the barrier)
 * 4. nothing else: Someday tasks never jump in by themselves.
 */
export function pickNow(tasks: Task[], today: string): Task | null {
  return rankToday(tasks, today)[0] ?? null;
}

export function rankToday(tasks: Task[], today: string): Task[] {
  const open = tasks.filter((t) => !t.done && t.due && t.due <= today);
  return open.sort((a, b) => {
    const ao = a.due! < today ? 0 : 1;
    const bo = b.due! < today ? 0 : 1;
    if (ao !== bo) return ao - bo;
    if (a.due !== b.due) return a.due! < b.due! ? -1 : 1;
    if (a.dueTime && b.dueTime) return a.dueTime < b.dueTime ? -1 : 1;
    if (a.dueTime) return -1;
    if (b.dueTime) return 1;
    if (a.estimateMin !== b.estimateMin) return a.estimateMin - b.estimateMin;
    return a.createdAt - b.createdAt;
  });
}

export function nextStep(t: Task) {
  return t.steps.find((s) => !s.done) ?? null;
}
