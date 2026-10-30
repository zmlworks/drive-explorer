// 0.3.3 checks (mock Drive page, content scripts injected with a tiny chrome.* shim like run-screenshots.mjs):
// Delete-key fallback only with the expected selection, never in Trash, no drop in Trash,
// "unverified" result for key fallbacks, strict toolbar labels in shared views.
// Usage: node test/run-fixes-0.3.3.mjs   (PLAYWRIGHT_CORE=… to point at playwright-core)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_CORE || '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core';
const { chromium } = require(PW);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const driveJs = manifest.content_scripts.filter((c) => c.matches[0].startsWith('https://drive')).flatMap((c) => c.js);
const driveCss = manifest.content_scripts.flatMap((c) => (c.matches[0].startsWith('https://drive') && c.css) || []);
const shim = `(() => { const store = {}; const ls = [];
  globalThis.chrome = { storage: { sync: { get(d, cb) { cb(Object.assign({}, d, store)); }, set(o) { Object.assign(store, o); } },
    local: { _s: {}, get(k, cb) { cb({ [k]: this._s[k] }); }, set(o) { Object.assign(this._s, o); } }, onChanged: { addListener(f) { ls.push(f); } } },
    runtime: { onMessage: { addListener() {} }, lastError: null, sendMessage(m, cb) { cb && cb({ ok: true }); } } }; })();`;
const results = [];
const check = (n, ok, x = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  — ' + x : '')); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
async function openDrive(hl = 'en') {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 760 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('file://' + path.join(ROOT, 'test', 'mock-drive.html') + '?hl=' + hl + '&nolog=1');
  await page.addScriptTag({ content: shim });
  for (const css of driveCss) await page.addStyleTag({ content: fs.readFileSync(path.join(ROOT, css), 'utf8') });
  for (const js of driveJs) await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, js), 'utf8') });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__toasts = [];
    const t = DXE.menu.toast; DXE.menu.toast = (s) => { window.__toasts.push(s); return t(s); };
    DXE.SEL.ACTIONS.__del = { keys: DXE.SEL.ACTIONS.delete.keys, destructive: true };
    window.__item = (name) => [...document.querySelectorAll('[data-id]')].find((c) => c.dataset.mName === name);
  });
  return { ctx, page };
}
const tile = (page, text) => page.locator('[data-id]', { hasText: text }).first();
const acts = (page) => page.evaluate(() => window.__actions.slice());

{ // selection check + key fallback
  const { ctx, page } = await openDrive();
  await tile(page, 'README.txt').click(); await page.waitForTimeout(100);
  let r = await page.evaluate(() => [DXE.native.selectionMismatch({ item: __item('beach.png') }), DXE.native.selectionMismatch({ item: __item('README.txt') })]);
  check('selectionMismatch: unselected item → reason; selected → null', r[0] && r[1] === null, JSON.stringify(r));
  await tile(page, 'beach.png').click({ modifiers: ['Control'] }); await page.waitForTimeout(100);
  r = await page.evaluate(() => [DXE.native.selectionMismatch({ item: __item('README.txt') }), DXE.native.selectionMismatch({ item: __item('README.txt'), expect: [__item('README.txt'), __item('beach.png')] })]);
  check('selectionMismatch: extra selected item → reason; expected set → null', r[0] && r[1] === null, JSON.stringify(r));
  await tile(page, 'README.txt').click(); await page.waitForTimeout(100);
  const n0 = (await acts(page)).length;
  r = await page.evaluate(() => DXE.native.perform('__del', { item: __item('beach.png'), target: __item('beach.png') }));
  let a = (await acts(page)).slice(n0);
  check('Delete-key fallback aborted when the selection is not the item', r === false && !a.some((x) => x.startsWith('KEY Delete')), r + ' ' + a.join('|'));
  r = await page.evaluate(() => DXE.native.perform('__del', { item: __item('README.txt'), target: __item('README.txt') }));
  a = (await acts(page)).slice(n0);
  check('Delete-key fallback with matching selection → "unverified" (not success)', r === 'unverified' && a.some((x) => x.startsWith('KEY Delete on README.txt')), r + ' ' + a.join('|'));
  await page.evaluate(() => { DXE.SEL.isTrashView = () => true; });
  r = await page.evaluate(() => DXE.native.perform('__del', { item: __item('README.txt'), target: __item('README.txt') }));
  check('Delete-key fallback never runs on the Trash page', r === false, String(r));
  await ctx.close();
}
{ // no drop in Trash
  const { ctx, page } = await openDrive();
  await page.evaluate(() => { DXE.SEL.isTrashView = () => true; });
  const t = tile(page, 'README.txt'); await t.click(); await page.waitForTimeout(200);
  const n0 = (await acts(page)).length;
  const tb = await t.boundingBox(), bb = await page.locator('#dxe-bin-host >> .bin').boundingBox();
  await page.mouse.move(tb.x + 40, tb.y + 40); await page.mouse.down();
  await page.mouse.move(tb.x + 80, tb.y + 60, { steps: 4 }); await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 12 });
  const over = await page.evaluate(() => document.getElementById('dxe-bin-host').shadowRoot.querySelector('.bin').classList.contains('over'));
  await page.mouse.up(); await page.waitForTimeout(1500);
  const a = (await acts(page)).slice(n0);
  const toasts = await page.evaluate(() => window.__toasts);
  // (HTML5 drag: the bin does not accept the drop at all; mouse fallback: dropNow shows the "inside Trash" toast)
  check('Trash page: no drop highlight, no delete action', !over && !a.some((x) => /^(MENU|TOOLBAR|KEY)/.test(x)) && (!toasts.length || /Trash/.test(toasts.join())), JSON.stringify({ over, a, toasts }));
  await ctx.close();
}
{ // selection changed between drop and action → abort
  const { ctx, page } = await openDrive();
  const t = tile(page, 'README.txt'); await t.click(); await tile(page, 'beach.png').click({ modifiers: ['Control'] }); await page.waitForTimeout(200);
  const n0 = (await acts(page)).length;
  const tb = await t.boundingBox(), bb = await page.locator('#dxe-bin-host >> .bin').boundingBox();
  await page.mouse.move(tb.x + 40, tb.y + 40); await page.mouse.down();
  // the mock collapses the selection on mousedown; real Drive keeps it when dragging a selected item
  await page.evaluate(() => { __item('beach.png').setAttribute('aria-selected', 'true'); __item('README.txt').setAttribute('aria-selected', 'true'); });
  await page.mouse.move(tb.x + 80, tb.y + 60, { steps: 4 }); await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.evaluate(() => { __item('beach.png').setAttribute('aria-selected', 'false'); });
  await page.waitForTimeout(1500);
  const a = (await acts(page)).slice(n0);
  const toasts = await page.evaluate(() => window.__toasts);
  check('selection changed before the action → aborted, nothing deleted', !a.some((x) => /^(MENU|TOOLBAR|KEY)/.test(x)) && /selection changed/.test(toasts.join()), JSON.stringify({ a, toasts }));
  await ctx.close();
}
{ // shared views: strict toolbar labels
  const { ctx, page } = await openDrive('ja');
  const r = await page.evaluate(() => {
    const D = DXE.SEL.ACTIONS.delete;
    const seen = [];
    const f = DXE.SEL.findToolbarButton; DXE.SEL.findToolbarButton = (re) => { seen.push(String(re)); return null; };
    DXE.SEL.ACTIONS.__tb = { toolbar: D.toolbar, toolbarShared: D.toolbarShared };
    DXE.SEL.isSharedView = () => true;
    return DXE.native.perform('__tb', { item: __item('README.txt') }).then((ok) => {
      DXE.SEL.findToolbarButton = f;
      return { ok, seen, strict: String(D.toolbarShared), rm: ['Remove', '削除'].map((s) => D.toolbarShared.test(s)), trash: ['ゴミ箱に移動', 'Move to trash'].map((s) => D.toolbarShared.test(s)) };
    });
  });
  check('shared view: toolbar fallback uses strict trash labels (no "Remove" / 「削除」)', r.seen[0] === r.strict && !r.rm.some(Boolean) && r.trash.every(Boolean), JSON.stringify(r));
  const sv = await page.evaluate(() => { history.replaceState(null, '', location.href); return typeof DXE.SEL.isSharedView; });
  check('SEL.isSharedView exists', sv === 'function');
  await ctx.close();
}
await browser.close();
const fails = results.filter((x) => !x).length;
console.log(`\n${results.length - fails}/${results.length} 0.3.3 checks passed`);
process.exit(fails ? 1 : 0);
