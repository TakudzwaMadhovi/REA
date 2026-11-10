# Rea

A personal focus hub for people with ADHD: tasks, reminders, a calendar, goals and routines in one place. It runs in the browser, installs as an app (PWA), works offline, and keeps your data on your device. No account is needed.

## What it does

| Screen | What you get |
|---|---|
| **Today** | Only *the one thing now* in large type, with its next small step and a **Start focus** button. Also a shrinking disc showing the time left before bedtime, your day as a timeline bar, and what's coming up. |
| **Focus** | One task, a visual countdown disc (5/15/25/45 min) and its steps. **I'm stuck** opens the task breakdown. |
| **Inbox** | A brain dump. Press **N** anywhere, type, press Enter. Sort later with one tap: *Do today*, *Make a task*, *Schedule*, *Make a goal*. |
| **Tasks** | Grouped into Today, Coming up and Someday, with time estimates, the energy each task needs, an optional "When ___, I will ___" plan, and small steps. |
| **Calendar** | Week and month views. Events can repeat every day, weekday, week or month, and each can have its own reminder. |
| **Goals** | Each goal has its "why", a target date, linked next actions and a progress bar. |
| **Routines** | Morning and evening checklists. Progress shows as "3 of 7 days this week", with no streak to lose. |
| **Settings** | Your name, day start and bedtime, theme, notifications, push relay, Claude API key, backup and restore. |

### Why it works this way (evidence)
- **Time and the next action stay on screen.** In Barkley's model, ADHD is a deficit of executive function. His advice is to make information, time and motivation visible at the point of performance (Barkley, *Taking Charge of Adult ADHD*).
- **Time is drawn as a shrinking disc.** A 2022 meta-analysis found that adults with ADHD estimate time less accurately than controls (Zheng et al., *Neurosci. Biobehav. Rev.*).
- **"When ___, I will ___" fields.** These are implementation intentions. A meta-analysis of 94 tests found a d = 0.65 effect on reaching goals (Gollwitzer & Sheeran, 2006), and they have been tested in ADHD samples (Gawrilow & Gollwitzer, 2008).
- **Small steps.** Breaking tasks down and planning them is a core part of CBT for adult ADHD, which was tested in an RCT (Safren et al., *JAMA*, 2010).
- **Ticking an item off gives instant feedback, and missed days are never punished.** People with ADHD show delay aversion and a stronger preference for immediate rewards (Sonuga-Barke, 2002).
- **The font is Atkinson Hyperlegible Next.** The Braille Institute designed it so that easily confused letters stay distinct.

## Run it

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests: recurrence, picking the "one thing", reminders, triage
npm run build && npm run preview   # production build on http://localhost:4173
npm run e2e        # end-to-end check (needs the preview running)
npm run e2e:mobile # iPhone 15 / SE / 13 mini emulation: swipes, sheets, tap sizes
```

Open `http://localhost:4173/?demo` to load example data. This only happens when the app is empty.

To install it on your phone, open the deployed site and use **Add to Home Screen** (iPhone: Share, then Add to Home Screen). Any static host works for the `app/dist` folder: Vercel, Netlify, Cloudflare Pages or GitHub Pages.

## On iPhone

Rea is built phone-first for iPhone. On a phone you get:
- a bottom tab bar, with the capture button in the middle where your thumb reaches;
- editing panels that slide up from the bottom (drag the handle down to close them);
- swipe gestures on tasks: swipe right for done, left for tomorrow, with Undo;
- a "Sort" sheet for inbox items;
- a 7-day strip in Calendar.

**Install it.** Open the site in Safari, then tap Share → **Add to Home Screen** → **Add**, and open Rea from its icon. iPhone needs this step for two reasons:
- **Notifications.** Web push on iOS works only for Home Screen web apps (iOS 16.4+).
- **Your data.** Safari can delete site data after 7 days without use, but Home Screen apps are exempt.

**Reminders on iPhone.** iOS pauses web apps that are not on screen. While Rea is open, reminders appear at once. At any other time they need the push relay (see below), hosted somewhere that stays awake. iOS shows no buttons on web notifications, so tapping one opens Rea on a sheet with **Start it now**, **Mark done** and **Snooze 5 min / 15 min / 1 h**.

**Check it on your phone.** These parts could only be tested in an emulator, not on a real iPhone:
1. Safari shows the "Add Rea to your Home Screen" card; after installing, it disappears.
2. From the Home Screen icon, Settings → Turn on notifications shows the iOS permission prompt.
3. With the relay connected, lock the phone and set a reminder 2 minutes ahead: a notification arrives, and tapping it opens the reminder sheet.
4. In Focus, start the timer: the screen stays on (iOS 18.4+ in Home Screen apps).
5. Tap the + tab: the keyboard opens straight away.

## Reminders and notifications

- **With Rea open, or in a background tab:** reminders appear as system notifications with **Snooze 15 min** and **Done** buttons, and as an in-app banner. You can set a reminder to repeat every 5 minutes until it's done.
- **With Rea fully closed:** browsers cannot schedule a notification on their own; the Notification Triggers API was abandoned. For this you need the optional push relay in [`relay/`](relay/README.md). It stores only reminder titles and times. On iPhone, web push works only for apps added to the Home Screen (iOS 16.4 and later).

## Your data

Everything is stored in IndexedDB in your browser. Clearing site data deletes it, so use **Settings, then Download backup** now and then. Settings shows the date of your last backup.

## Optional: task breakdown with Claude

Paste your Anthropic API key in Settings. **Break it down with Claude** then turns a task into 3 to 7 steps of under 10 minutes each. The key stays on your device and is sent only to `api.anthropic.com`.
