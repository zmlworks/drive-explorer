// Headless test harness: injects the content scripts into the local mock pages
// (with a tiny chrome.* shim), runs functional checks, writes screenshots.
// Usage: node test/run-screenshots.mjs <outDir>
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_CORE || '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core';
const { chromium } = require(PW);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, '..', 'out', 'screenshots'));
fs.mkdirSync(OUT, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const driveJs = manifest.content_scripts.filter((c) => c.matches[0].startsWith('https://drive')).flatMap((c) => c.js);
const driveCss = manifest.content_scripts.flatMap((c) => (c.matches[0].startsWith('https://drive') && c.css) || []);
const docsCs = manifest.content_scripts.find((c) => c.matches[0].startsWith('https://docs'));

const shim = (settings) => `
  (() => {
    const store = ${JSON.stringify(settings)}; const ls = [];
    globalThis.chrome = {
      storage: { sync: {
        get(d, cb) { cb(Object.assign({}, d, store)); },
        set(o) { const ch = {}; for (const k in o) { ch[k] = { oldValue: store[k], newValue: o[k] }; store[k] = o[k]; } ls.forEach((f) => f(ch, 'sync')); },
      }, onChanged: { addListener(f) { ls.push(f); } } },
      runtime: { onMessage: { addListener() {} } },
    };
  })();`;

const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok, extra }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  — ' + extra : '')); };

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--font-render-hinting=none'] });

async function openDrive(params, settings) {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 760 }, deviceScaleFactor: 1, colorScheme: params.theme === 'dark' ? 'dark' : 'light' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  page.on('console', (m) => { if (process.env.VERBOSE) console.log('console', m.text()); });
  await page.goto('file://' + path.join(ROOT, 'test', 'mock-drive.html') + '?' + new URLSearchParams(params));
  await page.addScriptTag({ content: shim(settings) });
  for (const css of driveCss) await page.addStyleTag({ content: fs.readFileSync(path.join(ROOT, css), 'utf8') });
  for (const js of driveJs) await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, js), 'utf8') });
  await page.waitForTimeout(500);
  return { ctx, page };
}

const tileByName = (page, text) => page.locator('[data-id]', { hasText: text }).first();
const lastAction = (page) => page.evaluate(() => window.__actions.slice(-1)[0] || '');
const actionsSince = (page, n) => page.evaluate((n) => window.__actions.slice(n), n);
const count = (page) => page.evaluate(() => window.__actions.length);
const menuItem = (page, id) => page.locator(`#dxe-menu-host >> .item[data-action="${id}"]`);

for (const lang of ['en', 'ja']) {
  for (const theme of ['light', 'dark']) {
    const tag = `${lang}-${theme}`;
    // Reference: Drive as-is (extension features off)
    if (theme === 'light') {
      const { ctx, page } = await openDrive({ hl: lang, theme, nolog: 1 }, { mediumIcons: false, contextMenu: false });
      await page.screenshot({ path: path.join(OUT, `00-original-drive-mock-${tag}.png`) });
      await ctx.close();
    }
    const { ctx, page } = await openDrive({ hl: lang, theme, nolog: 1 }, { mediumIcons: true, contextMenu: true, debug: true });
    const stats = await page.evaluate(() => DXE.tileStats);
    check(`[${tag}] tiles detected`, stats.tiles === 15, JSON.stringify({ tiles: stats.tiles, thumbs: stats.withThumb, name: stats.nameStrategy, cont: stats.containerStrategy }));
    // name below thumbnail
    const geo = await page.evaluate(() => {
      const t = [...document.querySelectorAll('[data-dxe-tile][data-dxe-hasthumb]')][0];
      const n = t.querySelector('[data-dxe-part=name]').getBoundingClientRect();
      const th = t.querySelector('[data-dxe-part=thumb]').getBoundingClientRect();
      const r = t.getBoundingClientRect();
      return { nameTop: n.top, thumbBottom: th.bottom, w: r.width, h: r.height, thumbW: th.width, thumbH: th.height };
    });
    check(`[${tag}] name below thumbnail, compact tile`, geo.nameTop >= geo.thumbBottom - 1 && geo.w <= 100 && geo.h <= 130, JSON.stringify(geo));

    // selection + hover screenshot
    await tileByName(page, lang === 'ja' ? '写真' : 'Photos').click();
    await tileByName(page, 'beach.png').click({ modifiers: ['Control'] });
    await page.waitForTimeout(200);
    await tileByName(page, 'mountains.jpg').hover();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, `01-medium-icons-${tag}.png`) });

    // context menu
    const target = tileByName(page, 'IMG_20261012_143355.jpg');
    await target.click();
    await target.click({ button: 'right', position: { x: 40, y: 40 } });
    await page.waitForTimeout(250);
    const shown = await page.evaluate(() => DXE.menu.isOpen());
    const nativeVisible = await page.evaluate(() => DXE.SEL.visibleMenus().length);
    check(`[${tag}] Win11 menu shown, native hidden`, shown && nativeVisible === 0);
    await menuItem(page, 'rename').hover();
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(OUT, `02-context-menu-${tag}.png`) });

    // Esc closes
    await page.keyboard.press('Escape');
    check(`[${tag}] Esc closes menu`, !(await page.evaluate(() => DXE.menu.isOpen())));

    // Actions routed to Drive's real menu
    const L = lang === 'ja'
      ? { rename: 'MENU 名前を変更', download: 'MENU ダウンロード', makeCopy: 'MENU コピーを作成', copyLink: 'MENU リンクをコピー', share: 'MENU 共有', move: 'MENU 移動', addShortcut: 'MENU ショートカットを追加', star: 'MENU スターを付ける', info: 'MENU 詳細', delete: 'MENU ゴミ箱に移動' }
      : { rename: 'MENU Rename', download: 'MENU Download', makeCopy: 'MENU Make a copy', copyLink: 'MENU Copy link', share: 'MENU Share', move: 'MENU Move', addShortcut: 'MENU Add shortcut', star: 'MENU Add to starred', info: 'MENU Details', delete: 'MENU Move to trash' };
    if (theme === 'light') {
      for (const [id, expect] of Object.entries(L)) {
        const n0 = await count(page);
        await target.click({ button: 'right', position: { x: 40, y: 40 } });
        await page.waitForTimeout(120);
        await menuItem(page, id).click();
        await page.waitForTimeout(1600);
        const acts = await actionsSince(page, n0);
        const left = await page.evaluate(() => DXE.SEL.visibleMenus().length);
        check(`[${tag}] action ${id} → Drive "${expect.slice(5)}"`, acts.includes(expect) && left === 0, acts.join(' | '));
      }
      // open (dblclick)
      let n0 = await count(page);
      await target.click({ button: 'right', position: { x: 40, y: 40 } });
      await menuItem(page, 'open').click();
      await page.waitForTimeout(1500);
      check(`[${tag}] action open → dblclick`, (await actionsSince(page, n0)).some((a) => a.startsWith('OPEN ')), (await actionsSince(page, n0)).join(' | '));
      // open in new tab
      const popupP = ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null);
      await target.click({ button: 'right', position: { x: 40, y: 40 } });
      await menuItem(page, 'openNewTab').click();
      const pop = await popupP;
      if (pop) await pop.waitForURL(/drive\.google\.com/, { timeout: 3000 }).catch(() => {});
      check(`[${tag}] open in new tab`, !!pop && /drive\.google\.com\/open\?id=/.test(pop.url()), pop && pop.url());
      if (pop) await pop.close();
      // F2
      n0 = await count(page);
      await target.click();
      await page.keyboard.press('F2');
      await page.waitForTimeout(1500);
      check(`[${tag}] F2 → rename`, (await actionsSince(page, n0)).includes(L.rename));
      // Drive menu fallback (visible)
      await target.click({ button: 'right', position: { x: 40, y: 40 } });
      await menuItem(page, 'driveMenu').click();
      await page.waitForTimeout(700);
      const vis = await page.evaluate(() => DXE.SEL.visibleMenus().map((m) => getComputedStyle(m).opacity));
      check(`[${tag}] "Show Drive menu" shows native menu visibly`, vis.length === 1 && vis[0] === '1', JSON.stringify(vis));
      await page.screenshot({ path: path.join(OUT, `03-drive-menu-fallback-${tag}.png`) });
      await page.keyboard.press('Escape');
      // Shift+right-click → native
      await target.click({ button: 'right', modifiers: ['Shift'], position: { x: 40, y: 40 } });
      await page.waitForTimeout(200);
      check(`[${tag}] Shift+right-click → native menu`, (await page.evaluate(() => DXE.SEL.visibleMenus().length)) === 1 && !(await page.evaluate(() => DXE.menu.isOpen())));
      await page.keyboard.press('Escape');
      // toggle off restores
      await page.evaluate(() => chrome.storage.sync.set({ mediumIcons: false }));
      await page.waitForTimeout(300);
      const left = await page.evaluate(() => document.querySelectorAll('[data-dxe-tile]').length + (document.documentElement.classList.contains('dxe-medium') ? 1 : 0));
      check(`[${tag}] toggle off removes restyle`, left === 0);
      await page.evaluate(() => chrome.storage.sync.set({ mediumIcons: true }));
      await page.waitForTimeout(400);
      check(`[${tag}] toggle on again`, (await page.evaluate(() => document.querySelectorAll('[data-dxe-tile]').length)) === 15);
      // diagnostics report
      const rep = await page.evaluate(() => DXE.report());
      check(`[${tag}] diagnostics report`, rep.counts.items === 15 && !!rep.sampleTile && !JSON.stringify(rep).includes('beach.png'));
      if (lang === 'en') fs.writeFileSync(path.join(OUT, 'diagnostics-sample.json'), JSON.stringify(rep, null, 2));
    }
    await ctx.close();
  }
}

// list view: items detected as rows, not restyled; menu still works
{
  const { ctx, page } = await openDrive({ hl: 'en', view: 'list', nolog: 1 }, { mediumIcons: true, contextMenu: true });
  const st = await page.evaluate(() => DXE.tileStats);
  check('[list] list rows untouched by medium icons', st.tiles === 0 && st.listRows === 15);
  const row = page.locator('[data-id]', { hasText: 'budget.xlsx' }).first();
  await row.click({ button: 'right' });
  await page.locator('#dxe-menu-host >> .item[data-action="star"]').click();
  await page.waitForTimeout(1500);
  check('[list] star via menu in list view', (await page.evaluate(() => window.__actions)).includes('MENU Add to starred'));
  await row.click({ button: 'right' });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, '04-context-menu-list-view-en-light.png') });
  await ctx.close();
}

// Docs dark mode
for (const on of [false, true]) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 600 } });
  const page = await ctx.newPage();
  await page.goto('file://' + path.join(ROOT, 'test', 'mock-docs.html'));
  // emulate docs.google.com/document path detection by patching pathname check
  await page.addScriptTag({ content: shim({ darkDocs: on }) });
  await page.addStyleTag({ content: fs.readFileSync(path.join(ROOT, docsCs.css[0]), 'utf8') });
  let js = fs.readFileSync(path.join(ROOT, 'src/docs/docs-dark.js'), 'utf8').replace('const path = location.pathname;', "const path = '/document/d/mock/edit';");
  await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'src/common/settings.js'), 'utf8') });
  await page.addScriptTag({ content: js });
  await page.waitForTimeout(300);
  const cls = await page.evaluate(() => document.documentElement.classList.contains('dxe-docs-dark'));
  check(`[docs] dark ${on ? 'on' : 'off'}`, cls === on);
  await page.screenshot({ path: path.join(OUT, `05-docs-dark-${on ? 'on' : 'off'}.png`) });
  await ctx.close();
}

// Popup render (light + dark), with a chrome shim
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 364, height: 560 }, colorScheme: theme });
  const page = await ctx.newPage();
  const msgs = JSON.parse(fs.readFileSync(path.join(ROOT, '_locales', theme === 'dark' ? 'ja' : 'en', 'messages.json'), 'utf8'));
  await page.addInitScript(`(() => { const M = ${JSON.stringify(msgs)}; const store = { darkDocs: true };
    globalThis.chrome = { i18n: { getMessage: (k) => (M[k] || {}).message || '', getUILanguage: () => '${theme === 'dark' ? 'ja' : 'en'}' },
      runtime: { getManifest: () => ({ version: '0.1.0' }) },
      storage: { sync: { get(d, cb) { cb(Object.assign({}, d, store)); }, set() {} }, onChanged: { addListener() {} } }, tabs: {} }; })();`);
  await page.goto('file://' + path.join(ROOT, 'popup', 'popup.html'));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `06-popup-${theme === 'dark' ? 'ja-dark' : 'en-light'}.png`), fullPage: true });
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
fs.writeFileSync(path.join(OUT, 'test-results.txt'), results.map((r) => (r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.extra ? '  — ' + r.extra : '')).join('\n') + `\n\n${results.length - failed.length}/${results.length} checks passed\n`);
process.exit(failed.length ? 1 : 0);
