# Rea push relay (optional)

This relay sends Rea's reminders as Web Push notifications while the app is closed. It stores only each device's push subscription and its upcoming reminders as `{ id, title, body, time }`. Tasks, notes and goals never leave your device.

## Run

```bash
cd relay
npm install
npm run keys                      # prints VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
export VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...
export VAPID_SUBJECT=mailto:you@example.org   # contact address the push services require
export ALLOW_ORIGIN=https://your-rea-site     # the address your app is served from
npm start                         # listens on PORT (default 8787)
```

Deploy it on any host that keeps a Node process running and keeps the data file on disk, such as Render, Fly.io, Railway or a small VPS. Set `DATA_FILE` to a path on a persistent disk. The relay must be served over HTTPS for browsers to use it.

Then, in Rea, go to **Settings, Notifications**, paste the relay's address and press **Connect relay**.

## API

| Method | Path | Body |
|---|---|---|
| `GET` | `/vapid` | returns `{ publicKey }` |
| `POST` | `/subscribe` | a `PushSubscription` and returns `{ id }` |
| `PUT` | `/reminders/:id` | `{ reminders: [{ id, title, body, at }] }`, replacing the whole list |

Every 20 seconds the relay sends any reminder that is due. Each reminder is sent once. Subscriptions that the push service reports as gone (HTTP 404 or 410) are deleted.

```bash
npm test
```
