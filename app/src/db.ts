import Dexie, { type Table } from 'dexie';

export type Energy = 'low' | 'medium' | 'high';
export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface Step { id: string; title: string; done: boolean }

export interface InboxItem { id: string; text: string; createdAt: number }

export interface Task {
  id: string;
  title: string;
  notes: string;
  goalId: string | null;
  /** yyyy-MM-dd, or null for "someday" */
  due: string | null;
  /** HH:mm, optional time on the due day */
  dueTime: string | null;
  estimateMin: number;
  energy: Energy;
  ifThen: string;
  steps: Step[];
  remindAt: number | null;
  done: boolean;
  doneAt: number | null;
  createdAt: number;
}

export interface CalEvent {
  id: string;
  title: string;
  /** epoch ms of the first occurrence */
  start: number;
  durationMin: number;
  allDay: boolean;
  repeat: Repeat;
  /** minutes before start; null = no reminder */
  remindMin: number | null;
  notes: string;
}

export interface Goal { id: string; title: string; why: string; target: string | null; createdAt: number; archived: boolean }

export interface Routine { id: string; name: string; time: string; items: Step[]; ifThen: string; order: number }

/** one row per routine item ticked on a day: id = `${routineId}|${itemId}|${day}` */
export interface RoutineTick { id: string; routineId: string; day: string }

export interface Reminder {
  id: string;
  title: string;
  at: number;
  link: { type: 'task' | 'event' | 'routine'; id: string } | null;
  nag: boolean;
  done: boolean;
}

export interface Setting { key: string; value: unknown }

class ReaDB extends Dexie {
  inbox!: Table<InboxItem, string>;
  tasks!: Table<Task, string>;
  events!: Table<CalEvent, string>;
  goals!: Table<Goal, string>;
  routines!: Table<Routine, string>;
  ticks!: Table<RoutineTick, string>;
  reminders!: Table<Reminder, string>;
  fired!: Table<{ id: string; at: number }, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super('rea');
    this.version(1).stores({
      inbox: 'id, createdAt',
      tasks: 'id, due, goalId, done, createdAt',
      events: 'id, start',
      goals: 'id, createdAt',
      routines: 'id, order',
      ticks: 'id, routineId, day',
      reminders: 'id, at, done',
      fired: 'id, at',
      settings: 'key'
    });
  }
}

export const db = new ReaDB();

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));

export function newTask(partial: Partial<Task> = {}): Task {
  return {
    id: uid(),
    title: '',
    notes: '',
    goalId: null,
    due: null,
    dueTime: null,
    estimateMin: 15,
    energy: 'medium',
    ifThen: '',
    steps: [],
    remindAt: null,
    done: false,
    doneAt: null,
    createdAt: Date.now(),
    ...partial
  };
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}

const TABLES = ['inbox', 'tasks', 'events', 'goals', 'routines', 'ticks', 'reminders', 'settings'] as const;

export async function exportAll() {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) out[t] = await db.table(t).toArray();
  return { app: 'rea', version: 1, exportedAt: new Date().toISOString(), data: out };
}

export async function importAll(json: { app?: string; data?: Record<string, unknown[]> }) {
  if (json?.app !== 'rea' || !json.data) throw new Error('This file is not a Rea backup.');
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      const rows = json.data![t];
      if (Array.isArray(rows)) await db.table(t).bulkPut(rows);
    }
  });
}
