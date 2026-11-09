const { chromium } = require('playwright');
const ok = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['notifications'], { origin: 'http://localhost:4173' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:4173/#/today'); await p.waitForTimeout(800);

  // capture with N, triage to task for today
  await p.keyboard.press('n');
  await p.fill('#cap', 'Buy stamps'); await p.keyboard.press('Enter'); await p.keyboard.press('Escape');
  await p.goto('http://localhost:4173/#/inbox'); await p.waitForTimeout(300);
  ok(await p.getByText('Buy stamps').isVisible(), 'captured thought is in inbox');
  await p.getByRole('button', { name: 'Do today' }).first().click(); await p.waitForTimeout(700);
  await p.goto('http://localhost:4173/#/today'); await p.waitForTimeout(400);
  ok((await p.locator('.now-title').textContent()) === 'Buy stamps', 'triaged task is the one thing now');

  // focus timer
  await p.getByRole('link', { name: 'Start focus' }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /Start 25 min/ }).click(); await p.waitForTimeout(2200);
  const t = await p.locator('.disc-read .big').textContent();
  ok(/^24:5\d$/.test(t), `timer counts down (${t})`);
  await p.getByRole('button', { name: 'Pause' }).click();

  // calendar event
  await p.goto('http://localhost:4173/#/calendar'); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'New event' }).click();
  await p.getByLabel('What is it?').fill('Dentist');
  await p.getByRole('button', { name: 'Add event', exact: true }).click(); await p.waitForTimeout(300);
  ok(await p.locator('.week-ev', { hasText: 'Dentist' }).count() === 1, 'event shows in week view');

  // routine
  await p.goto('http://localhost:4173/#/routines'); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Add a morning routine' }).click(); await p.waitForTimeout(300);
  await p.getByRole('checkbox', { name: 'Drink a glass of water' }).click(); await p.waitForTimeout(200);
  ok(await p.getByText('1 of 3 done today').isVisible(), 'routine step ticks');

  // task editor: slide-over focus trap + Esc restores focus
  await p.goto('http://localhost:4173/#/tasks'); await p.waitForTimeout(300);
  const opener = p.locator('.item button.title', { hasText: 'Buy stamps' });
  await opener.click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.activeElement?.closest('[role=dialog]') != null), 'focus moves into slide-over');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.activeElement?.textContent === 'Buy stamps'), 'focus returns to opener on close');

  // persistence
  await p.reload(); await p.waitForTimeout(800);
  await p.goto('http://localhost:4173/#/today'); await p.waitForTimeout(400);
  ok((await p.locator('.now-title').textContent()) === 'Buy stamps', 'data survives reload');

  // delete confirm names the item
  await p.goto('http://localhost:4173/#/inbox');
  await p.fill('#inbox-add', 'Temp thought'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  await p.getByRole('button', { name: 'Delete “Temp thought”' }).click();
  ok(await p.getByText('Delete “Temp thought”?').isVisible(), 'delete confirmation names the item');
  await p.getByRole('button', { name: 'Delete thought' }).click();

  // relay connect
  await p.goto('http://localhost:4173/#/settings'); await p.waitForTimeout(300);
  await p.getByLabel(/Push relay address/).fill('http://localhost:8787');
  await p.getByRole('button', { name: 'Connect relay' }).click(); await p.waitForTimeout(4000);
  const relayText = await p.locator('section[aria-label="Notifications"]').innerText();
  // Playwright's Chromium cannot create push subscriptions, so this checks that a failure is explained, not hidden.
  ok(/Connected|Allow them in your browser settings|Couldn’t reach the relay/.test(relayText), 'relay connect gives a clear result');
  ok(errs.length === 0, 'no page errors ' + errs.join(';'));
  await b.close();
})();
