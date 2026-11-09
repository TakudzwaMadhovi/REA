import { addDays, setHours, setMinutes, startOfDay } from 'date-fns';
import { db, newTask, uid } from '../db';
import { dayKey } from './time';

/** Example data, loaded only with ?demo in the address and only into an empty app. */
export async function seedDemo() {
  if ((await db.tasks.count()) + (await db.events.count()) > 0) return;
  const today = dayKey();
  const tomorrow = dayKey(addDays(new Date(), 1));
  const yesterday = dayKey(addDays(new Date(), -1));
  const at = (d: number, h: number, m = 0) => setMinutes(setHours(startOfDay(addDays(new Date(), d)), h), m).getTime();
  const flat = uid(), health = uid();
  await db.goals.bulkAdd([
    { id: flat, title: 'Move into the new flat by March', why: 'A shorter commute and a room for the bike', target: dayKey(addDays(new Date(), 120)), createdAt: Date.now() - 9e8, archived: false },
    { id: health, title: 'Walk 30 minutes, five days a week', why: 'Better sleep and a calmer head', target: null, createdAt: Date.now() - 8e8, archived: false }
  ]);
  await db.tasks.bulkAdd([
    newTask({ title: 'Pay the electricity bill', due: yesterday, estimateMin: 10, energy: 'low', steps: [
      { id: uid(), title: 'Open the banking app', done: false }, { id: uid(), title: 'Find the bill email', done: false }, { id: uid(), title: 'Copy the reference and pay', done: false }] }),
    newTask({ title: 'Email the landlord about the viewing', due: today, dueTime: '11:00', estimateMin: 15, goalId: flat, ifThen: 'When I sit down with coffee, I will open the email draft' }),
    newTask({ title: 'Book a GP appointment', due: today, estimateMin: 10, energy: 'medium' }),
    newTask({ title: 'Pack boxes: books shelf', due: today, estimateMin: 45, goalId: flat, energy: 'high' }),
    newTask({ title: 'Walk around the park', due: today, estimateMin: 30, goalId: health, energy: 'low', done: false }),
    newTask({ title: 'Compare broadband deals', due: tomorrow, estimateMin: 25, goalId: flat }),
    newTask({ title: 'Return the library books', due: null, estimateMin: 20 }),
    newTask({ title: 'Walk to the shop instead of driving', due: yesterday, estimateMin: 30, goalId: health, done: true, doneAt: Date.now() - 864e5 }),
    newTask({ title: 'Measure the new bedroom', due: yesterday, estimateMin: 15, goalId: flat, done: true, doneAt: Date.now() - 8e7 })
  ]);
  await db.events.bulkAdd([
    { id: uid(), title: 'Team stand-up', start: at(0, 9, 30), durationMin: 30, allDay: false, repeat: 'weekdays', remindMin: 10, notes: '' },
    { id: uid(), title: 'Lunch with Sam', start: at(0, 13), durationMin: 60, allDay: false, repeat: 'none', remindMin: 30, notes: '' },
    { id: uid(), title: 'Therapy session', start: at(0, 17), durationMin: 50, allDay: false, repeat: 'weekly', remindMin: 60, notes: '' },
    { id: uid(), title: 'Flat viewing, 14 Elm Road', start: at(1, 10), durationMin: 45, allDay: false, repeat: 'none', remindMin: 60, notes: '' },
    { id: uid(), title: 'Gym class', start: at(2, 18, 30), durationMin: 60, allDay: false, repeat: 'none', remindMin: 30, notes: '' }
  ]);
  const morning = uid(), evening = uid();
  const mItems = ['Drink a glass of water', 'Take medication', 'Look at today’s one thing'].map((title) => ({ id: uid(), title, done: false }));
  await db.routines.bulkAdd([
    { id: morning, name: 'Morning', time: '07:30', ifThen: '', order: 0, items: mItems },
    { id: evening, name: 'Evening', time: '21:30', ifThen: '', order: 1, items: ['Put keys, wallet and phone in one spot', 'Check tomorrow’s first event', 'Capture anything still in your head'].map((title) => ({ id: uid(), title, done: false })) }
  ]);
  const ticks = [];
  for (let d = -3; d <= 0; d++) for (const it of mItems.slice(0, d === 0 ? 2 : 3)) ticks.push({ id: `${morning}|${it.id}|${dayKey(addDays(new Date(), d))}`, routineId: morning, day: dayKey(addDays(new Date(), d)) });
  await db.ticks.bulkAdd(ticks.filter((t) => t.day >= dayKey(addDays(new Date(), -6))));
  await db.inbox.bulkAdd([
    { id: uid(), text: 'Birthday present for Mum, 12th', createdAt: Date.now() - 36e5 * 5 },
    { id: uid(), text: 'Look into a standing desk', createdAt: Date.now() - 36e5 * 26 },
    { id: uid(), text: 'Renew passport before summer', createdAt: Date.now() - 6e5 }
  ]);
  await db.settings.put({ key: 'name', value: 'Alex' });
}
