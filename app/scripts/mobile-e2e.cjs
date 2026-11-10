// Phone checks with Chromium emulating iPhones (WebKit is not available here).
const { chromium, devices } = require('playwright');
const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
const BASE = process.env.BASE || 'http://localhost:4173';

async function swipe(p, sel, dx) {
  await p.evaluate(({ sel, dx }) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    const y = r.top + r.height / 2, x0 = r.left + 40;
    const ev = (type, x) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true }));
    ev('pointerdown', x0);
    for (let i = 1; i <= 10; i++) ev('pointermove', x0 + (dx * i) / 10);
    ev('pointerup', x0 + dx);
  }, { sel, dx });
}

(async () => {
  const b = await chromium.launch();
  for (const name of ['iPhone 15', 'iPhone SE (3rd gen)', 'iPhone 13 Mini']) {
    console.log('---', name);
    const ctx = await b.newContext({ ...devices[name] });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + '/?demo#/today'); await p.waitForTimeout(900);

    ok(await p.locator('.tabbar').isVisible(), 'bottom tab bar visible');
    ok(await p.getByRole('heading', { name: 'Add Rea to your Home Screen' }).isVisible(), 'install guide shows in iPhone Safari');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll on Today');

    // swipe the first "After that" task right = done
    const first = await p.locator('.swipe .title').first().textContent();
    await swipe(p, '.swipe .item', 260); await p.waitForTimeout(500);
    ok(await p.getByText(`Done: ${first}`).isVisible(), `swipe right marks "${first}" done`);
    await p.getByRole('button', { name: 'Undo' }).first().click(); await p.waitForTimeout(300);
    ok(await p.locator('.swipe .title', { hasText: first }).count() === 1, 'Undo brings it back');
    // swipe left = tomorrow
    await swipe(p, '.swipe .item', -260); await p.waitForTimeout(500);
    ok(await p.getByText('Moved to tomorrow').isVisible(), 'swipe left moves to tomorrow');
    // short swipe does nothing
    const before = await p.locator('.swipe').count();
    await swipe(p, '.swipe .item', 60); await p.waitForTimeout(400);
    ok(await p.locator('.swipe').count() === before, 'a short swipe does nothing');

    // bottom sheet: opens, closes on drag down, focus returns
    await p.locator('.swipe .title').first().click(); await p.waitForTimeout(400);
    const box = await p.locator('.sheet').boundingBox();
    ok(box && Math.round(box.y + box.height) >= (await p.evaluate(() => innerHeight)) - 1 && box.width >= (await p.evaluate(() => innerWidth)) - 1, 'task opens as a bottom sheet');
    ok(await p.evaluate(() => !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)), 'opening a task does not pop the keyboard');
    await p.evaluate(() => {
      const g = document.querySelector('.sheet .grab');
      const r = g.getBoundingClientRect();
      const ev = (t, y) => g.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 9, pointerType: 'touch', clientX: r.left + 20, clientY: y }));
      ev('pointerdown', r.top + 10); ev('pointermove', r.top + 120); ev('pointermove', r.top + 260); ev('pointerup', r.top + 260);
    });
    await p.waitForTimeout(400);
    ok(await p.locator('.sheet').count() === 0, 'dragging the sheet down closes it');

    // capture sheet focuses its field (keyboard) and sits at the bottom
    await p.locator('.tab-capture').tap(); await p.waitForTimeout(400);
    ok(await p.evaluate(() => document.activeElement?.id === 'cap'), 'capture focuses its text field');
    await p.keyboard.type('Call mum'); await p.keyboard.press('Enter');
    await p.getByRole('button', { name: 'Done', exact: true }).tap(); await p.waitForTimeout(300);

    // inbox sort sheet
    await p.goto(BASE + '/#/inbox'); await p.waitForTimeout(500);
    await p.getByRole('button', { name: 'Sort' }).first().tap(); await p.waitForTimeout(300);
    ok(await p.getByRole('button', { name: 'Schedule it' }).isVisible(), 'inbox Sort opens an action sheet');
    await p.keyboard.press('Escape');

    // calendar day strip
    await p.goto(BASE + '/#/calendar'); await p.waitForTimeout(500);
    ok(await p.locator('.daystrip button').count() === 7, 'calendar shows a 7-day strip');

    // tap targets: every visible button/link at least 44px (inline text links excluded)
    for (const v of ['today', 'focus', 'inbox', 'tasks', 'calendar', 'goals', 'routines', 'settings']) {
      await p.goto(BASE + '/#/' + v); await p.waitForTimeout(400);
      const small = await p.evaluate(() => [...document.querySelectorAll('button, a.btn, a.icon-btn, .tabbar a, [role=checkbox]')]
        .filter((e) => e.offsetParent !== null && !e.closest('.grab'))
        .map((e) => ({ t: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30), r: e.getBoundingClientRect() }))
        .filter((x) => x.r.height < 40 || x.r.width < 40).map((x) => `${x.t} ${Math.round(x.r.width)}x${Math.round(x.r.height)}`));
      ok(small.length === 0, `${v}: tap targets >= 40px ${small.slice(0, 4).join('; ')}`);
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${v}: no horizontal scroll`);
    }
    ok(errs.length === 0, 'no page errors ' + errs.join('; '));
    await ctx.close();
  }
  await b.close();
})();
