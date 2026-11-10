import http from 'node:http';
import webpush from 'web-push';
import { Store } from './store.js';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT = 'mailto:admin@example.com', PORT = 8787, DATA_FILE = './data.json', ALLOW_ORIGIN = '*' } = process.env;
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY. Run `npm run keys` to make a pair.');
  process.exit(1);
}
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const store = new Store(DATA_FILE);

const send = (res, code, body) => {
  res.writeHead(code, {
    'content-type': 'application/json',
    'access-control-allow-origin': ALLOW_ORIGIN,
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type'
  });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const readJson = (req) => new Promise((ok, fail) => {
  let s = '';
  req.on('data', (c) => { s += c; if (s.length > 256_000) { fail(new Error('too large')); req.destroy(); } });
  req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { fail(e); } });
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'OPTIONS') return send(res, 204);
    if (req.method === 'GET' && url.pathname === '/vapid') return send(res, 200, { publicKey: VAPID_PUBLIC_KEY });
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });
    if (req.method === 'POST' && url.pathname === '/subscribe') {
      const sub = await readJson(req);
      if (!sub?.endpoint || !sub?.keys?.p256dh) return send(res, 400, { error: 'Not a push subscription' });
      return send(res, 200, { id: store.subscribe(sub) });
    }
    const m = url.pathname.match(/^\/reminders\/([\w-]+)$/);
    if (req.method === 'PUT' && m) {
      const body = await readJson(req);
      if (!Array.isArray(body.reminders)) return send(res, 400, { error: 'reminders must be a list' });
      return store.setReminders(m[1], body.reminders) ? send(res, 200, { ok: true }) : send(res, 404, { error: 'Unknown subscription. Reconnect from Settings.' });
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) {
    send(res, 400, { error: String(e.message || e) });
  }
});

async function loop() {
  const now = Date.now();
  for (const { subId, sub, r } of store.due(now)) {
    try {
      await webpush.sendNotification(sub, JSON.stringify({ id: r.id, title: r.title, body: r.body }), { TTL: 3600, urgency: 'high' });
      store.markSent(subId, r.id, now);
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) store.remove(subId); // subscription gone
      else console.error('push failed', e.statusCode ?? e.message);
    }
  }
}
setInterval(loop, 20_000);
server.listen(PORT, () => console.log(`Rea relay on :${PORT}`));
