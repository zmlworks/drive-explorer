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
      }, local: { _s: {}, get(k, cb) { cb({ [k]: this._s[k] }); }, set(o) { Object.assign(this._s, o); } },
      onChanged: { addListener(f) { ls.push(f); } } },
      runtime: { onMessage: { addListener() {} }, lastError: null,
        sendMessage(m, cb) { (window.__sent = window.__sent || []).push(m); cb && cb({ ok: true }); } },
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
    const { ctx, page } = await openDrive({ hl: lang, theme, nolog: 1 }, { mediumIcons: true, contextMenu: true, debug: true, openFilesIn: 'drive' });
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

// ---------------- 0.2.0: details panel suppression + Properties dialog ----------------
const propsState = (page) => page.evaluate(() => {
  const r = document.getElementById('dxe-props-host')?.shadowRoot;
  const w = r && r.querySelector('.win');
  if (!w) return null;
  return { title: w.querySelector('.ttl').textContent, body: w.querySelector('.body').innerText, rect: w.getBoundingClientRect().toJSON(),
    loading: !!w.querySelector('.spin'), failed: !!w.querySelector('.msg.err') };
});
const waitProps = async (page, ms = 7000) => {
  const end = Date.now() + ms;
  let st;
  while (Date.now() < end) { st = await propsState(page); if (st && !st.loading) return st; await page.waitForTimeout(150); }
  return st;
};
const panelInfo = (page) => page.evaluate(() => {
  const p = document.querySelector('[data-dxe-details]');
  const mn = document.querySelector('[role=main]').getBoundingClientRect().width;
  return { open: window.__details.isOpen(), tagged: !!p, opacity: p ? getComputedStyle(p).opacity : null, mainWidth: Math.round(mn) };
});

for (const lang of ['en', 'ja']) {
  for (const theme of ['light', 'dark']) {
    const tag = `${lang}-${theme}`;
    // A) suppression ON: Drive opens the pane on click (autodetails) → it stays invisible
    {
      const { ctx, page } = await openDrive({ hl: lang, theme, nolog: 1, autodetails: 1 }, { suppressDetails: true });
      const w0 = (await panelInfo(page)).mainWidth;
      const t = tileByName(page, 'mountains.jpg');
      await t.click();
      await page.waitForTimeout(700);
      const pi = await panelInfo(page);
      check(`[${tag}] details pane opened by Drive is suppressed`, pi.open && pi.tagged && pi.opacity === '0' && pi.mainWidth === w0, JSON.stringify(pi));
      if (theme === 'light') await page.screenshot({ path: path.join(OUT, `07-details-pane-suppressed-${tag}.png`) });
      // Properties while the pane is (hidden-)open: must stay open+hidden afterwards
      await t.click({ button: 'right', position: { x: 30, y: 30 } });
      await menuItem(page, 'properties').click();
      const st = await waitProps(page);
      check(`[${tag}] Properties with pane already open`, st && !st.failed && /Image|画像/.test(st.body) && (await panelInfo(page)).open, st && st.title);
      await ctx.close();
    }
    // B) Properties: menu → hidden pane → scrape → pane closed again
    {
      const { ctx, page } = await openDrive({ hl: lang, theme, nolog: 1 }, { suppressDetails: true });
      const t = tileByName(page, lang === 'ja' ? '議事録' : 'Meeting notes');
      await t.click();
      await t.click({ button: 'right', position: { x: 30, y: 30 } });
      await page.waitForTimeout(150);
      if (lang === 'ja' && theme === 'light') await page.screenshot({ path: path.join(OUT, `08-context-menu-with-properties-${tag}.png`) });
      if (lang === 'en' && theme === 'dark') await page.screenshot({ path: path.join(OUT, `08-context-menu-with-properties-${tag}.png`) });
      await menuItem(page, 'properties').click();
      const st = await waitProps(page);
      const want = lang === 'ja' ? ['種類', 'サイズ', '使用容量', '場所', '所有者', '更新日時', '最終閲覧', '作成日時', 'アクセス', '2 人と共有', 'ラベル'] : ['Type', 'Size', 'Storage used', 'Location', 'Owner', 'Modified', 'Opened', 'Created', 'Access', 'Shared with 2 people', 'Labels'];
      const miss = want.filter((w) => !st.body.includes(w));
      const titleOk = lang === 'ja' ? /^議事録 2026-10-15\.docx のプロパティ$/.test(st.title) : /^Meeting notes 2026-10-15 Properties$/.test(st.title);
      check(`[${tag}] Properties dialog fields (known + unknown label)`, st && !st.failed && !miss.length && titleOk, 'missing=' + miss.join(',') + ' title=' + st.title);
      await page.waitForTimeout(500);
      check(`[${tag}] details pane closed again after reading`, !(await panelInfo(page)).open && !(await page.evaluate(() => document.documentElement.classList.contains('dxe-props-busy'))));
      await page.screenshot({ path: path.join(OUT, `09-properties-${tag}.png`) });
      if (theme === 'light') {
        await page.locator('#dxe-props-host >> .tab >> nth=1').click();
        await page.waitForTimeout(100);
        await page.screenshot({ path: path.join(OUT, `10-properties-details-tab-${tag}.png`) });
        // drag by title bar
        const r0 = (await propsState(page)).rect;
        await page.mouse.move(r0.x + 80, r0.y + 15); await page.mouse.down();
        await page.mouse.move(r0.x + 180, r0.y + 75, { steps: 5 }); await page.mouse.up();
        const r1 = (await propsState(page)).rect;
        check(`[${tag}] dialog draggable by title bar`, Math.abs(r1.x - r0.x - 100) < 3 && Math.abs(r1.y - r0.y - 60) < 3, `${r0.x},${r0.y} → ${r1.x},${r1.y}`);
        await page.keyboard.press('Escape');
        check(`[${tag}] Esc closes Properties`, !(await propsState(page)));
        // Alt+Enter on the selection
        await tileByName(page, 'budget.xlsx').click();
        await page.keyboard.press('Alt+Enter');
        const st2 = await waitProps(page);
        check(`[${tag}] Alt+Enter opens Properties`, st2 && /budget\.xlsx/.test(st2.title) && !st2.failed, st2 && st2.title);
        await page.locator('#dxe-props-host >> .btn.primary').click();
        check(`[${tag}] OK closes Properties`, !(await propsState(page)));
      }
      await ctx.close();
    }
  }
}
// C) suppression OFF: pane shows normally; Properties keeps it invisible while reading
{
  const { ctx, page } = await openDrive({ hl: 'en', nolog: 1 }, { suppressDetails: false });
  const t = tileByName(page, 'sunset.jpg');
  await t.click();
  await page.evaluate(() => window.__details.open());
  await page.waitForTimeout(600);
  const pi = await panelInfo(page);
  check('[off] details pane visible when suppression is off', pi.open && pi.opacity === '1', JSON.stringify(pi));
  await page.screenshot({ path: path.join(OUT, '07-details-pane-visible-when-off-en-light.png') });
  await page.evaluate(() => window.__details.close());
  await page.waitForTimeout(200);
  // sample pane opacity while Properties reads it
  await page.evaluate(() => { window.__maxOpacity = 0; const tick = () => { const p = document.querySelector('.dp'); if (p) window.__maxOpacity = Math.max(window.__maxOpacity, +getComputedStyle(p).opacity); if (!window.__stopTick) requestAnimationFrame(tick); }; tick(); });
  await t.click({ button: 'right', position: { x: 30, y: 30 } });
  await menuItem(page, 'properties').click();
  const st = await waitProps(page);
  await page.waitForTimeout(600);
  const maxOp = await page.evaluate(() => { window.__stopTick = true; return window.__maxOpacity; });
  check('[off] pane opened for Properties never visible, closed afterwards', st && !st.failed && maxOp === 0 && !(await panelInfo(page)).open, 'maxOpacity=' + maxOp);
  await ctx.close();
}
// D) fallbacks: menu "Details" broken → toolbar (i) button; no pane at all → message
{
  const { ctx, page } = await openDrive({ hl: 'en', nolog: 1, nomenudetails: 1 }, {});
  const t = tileByName(page, 'README.txt');
  await t.click();
  await t.click({ button: 'right', position: { x: 30, y: 30 } });
  await menuItem(page, 'properties').click();
  const st = await waitProps(page);
  check('[fallback] Properties via toolbar details button', st && !st.failed && /Text/.test(st.body), st && st.body.slice(0, 60));
  await ctx.close();
}
for (const lang of ['en', 'ja']) {
  const { ctx, page } = await openDrive({ hl: lang, nolog: 1, nodetails: 1 }, {});
  const t = tileByName(page, 'README.txt');
  await t.click();
  await t.click({ button: 'right', position: { x: 30, y: 30 } });
  await menuItem(page, 'properties').click();
  const st = await waitProps(page, 9000);
  check(`[fallback-${lang}] graceful message when the pane can't be read`, st && st.failed, st && st.body.slice(0, 80));
  await page.screenshot({ path: path.join(OUT, `11-properties-failed-${lang}-light.png`) });
  await ctx.close();
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

// ---------------- 0.3.0: Explorer features ----------------
const tbState = (page) => page.evaluate(() => {
  const r = document.getElementById('dxe-toolbar-host')?.shadowRoot;
  if (!r) return null;
  const b = (id) => r.querySelector(`button[data-id="${id}"]`);
  return { addr: r.querySelector('.addr').innerText.replace(/\s+/g, ''), path: DXE.pathText(), upDisabled: b('up').disabled,
    medium: b('medium').getAttribute('aria-pressed'), list: b('list').getAttribute('aria-pressed') };
});
for (const lang of ['en', 'ja']) {
  for (const theme of ['light', 'dark']) {
    const tag = `${lang}-${theme}`;
    // toolbar + address bar from breadcrumbs, status bar, fluent icons
    {
      const { ctx, page } = await openDrive({ hl: lang, theme, nolog: 1, crumbs: lang === 'ja' ? 'プロジェクト資料/2026年' : 'Project files/2026' }, {});
      await page.waitForTimeout(400);
      const tb = await tbState(page);
      const want = lang === 'ja' ? '/プロジェクト資料/2026年' : '/Project files/2026';
      check(`[${tag}] address bar /path from breadcrumbs`, tb && tb.path === want && !tb.upDisabled, JSON.stringify(tb));
      const fic = await page.evaluate(() => [...document.querySelectorAll('[data-dxe-ficon]')].map((e) => e.dataset.kind));
      check(`[${tag}] Fluent icons for items without thumbnails`, fic.filter((k) => k === 'folder').length === 5 && fic.length === 5, fic.join(','));
      await tileByName(page, 'beach.png').click();
      await tileByName(page, 'sunset.jpg').click({ modifiers: ['Control'] });
      await page.waitForTimeout(400);
      const sb = await page.evaluate(() => DXE.statusText);
      const sbWant = lang === 'ja' ? '15 個の項目2 個の項目を選択' : '15 items2 items selected';
      check(`[${tag}] status bar counts`, sb === sbWant, sb);
      await page.locator('#dxe-toolbar-host >> button[data-id="up"]').hover();
      await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(OUT, `12-explorer-toolbar-statusbar-${tag}.png`) });
      if (theme === 'light') {
        // ↑ button → previous breadcrumb segment
        let n0 = await count(page);
        await page.locator('#dxe-toolbar-host >> button[data-id="up"]').click();
        await page.waitForTimeout(300);
        const up1 = lang === 'ja' ? 'CRUMB プロジェクト資料' : 'CRUMB Project files';
        check(`[${tag}] ↑ goes to parent via breadcrumb`, (await actionsSince(page, n0)).includes(up1), (await actionsSince(page, n0)).join(' | '));
        // Alt+Up and Backspace (not while typing)
        await tileByName(page, 'beach.png').click();
        n0 = await count(page);
        await page.keyboard.press('Alt+ArrowUp');
        await page.waitForTimeout(200);
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(200);
        const a = await actionsSince(page, n0);
        check(`[${tag}] Alt+↑ and Backspace go up`, a.filter((x) => x === up1).length === 2, a.join(' | '));
        // view switch → Drive's layout radio
        n0 = await count(page);
        await page.locator('#dxe-toolbar-host >> button[data-id="list"]').click();
        await page.waitForTimeout(200);
        check(`[${tag}] view switch clicks Drive's layout button`, (await actionsSince(page, n0)).includes('LAYOUT list'));
        // segment click
        n0 = await count(page);
        await page.locator('#dxe-toolbar-host >> .seg.link >> nth=0').click();
        await page.waitForTimeout(200);
        check(`[${tag}] address segment "/" navigates to My Drive breadcrumb`, (await actionsSince(page, n0)).includes('CRUMB ' + (lang === 'ja' ? 'マイドライブ' : 'My Drive')));
      }
      await ctx.close();
    }
  }
  // at My Drive root: '/', up disabled
  {
    const { ctx, page } = await openDrive({ hl: lang, nolog: 1, crumbs: 'root' }, {});
    await page.waitForTimeout(400);
    const tb = await tbState(page);
    check(`[${lang}] My Drive root shows "/" and ↑ disabled`, tb && tb.path === '/' && tb.upDisabled && tb.medium === 'true', JSON.stringify(tb));
    await ctx.close();
  }
  // suggestions hidden on Home (+ Gemini chip); list kept
  for (const hide of [true, false]) {
    const { ctx, page } = await openDrive({ hl: lang, nolog: 1, page: 'home' }, { hideSuggestions: hide });
    await page.waitForTimeout(900);
    const st = await page.evaluate(() => ({
      sugg: [...document.querySelectorAll('.sgw,.gem')].filter((e) => e.getBoundingClientRect().height > 0).length,
      tiles: [...document.querySelectorAll('#grid [data-dxe-tile]')].filter((e) => e.getBoundingClientRect().height > 0).length,
      gridVisible: document.getElementById('grid').getBoundingClientRect().height > 0,
    }));
    check(`[${lang}] suggestions ${hide ? 'hidden' : 'shown'} on Home, main list intact`, (hide ? st.sugg === 0 : st.sugg === 3) && st.gridVisible && st.tiles === 15, JSON.stringify(st));
    await page.screenshot({ path: path.join(OUT, `13-home-suggestions-${hide ? 'hidden' : 'shown'}-${lang}-light.png`) });
    await ctx.close();
  }
}

// open files in a new tab (dblclick / Enter / menu Open); folders in place
{
  const { ctx, page } = await openDrive({ hl: 'en', nolog: 1 }, { openFilesIn: 'tab' });
  const sent = () => page.evaluate(() => (window.__sent || []).filter((m) => m.type === 'dxe-open'));
  let n0 = await count(page);
  await tileByName(page, 'beach.png').dblclick();
  await page.waitForTimeout(300);
  let s = await sent();
  check('[open] dblclick on a file → background opens a new tab (Drive not opening in place)', s.length === 1 && s[0].mode === 'tab' && /drive\.google\.com/.test(s[0].urls[0]) && !(await actionsSince(page, n0)).some((a) => a.startsWith('OPEN')), JSON.stringify(s));
  n0 = await count(page);
  await tileByName(page, 'Photos').dblclick();
  await page.waitForTimeout(300);
  check('[open] dblclick on a folder → Drive navigates in place', (await actionsSince(page, n0)).some((a) => a.startsWith('OPEN Photos')) && (await sent()).length === 1);
  await tileByName(page, 'README.txt').click();
  await page.waitForTimeout(700);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  check('[open] Enter on a selected file → new tab', (await sent()).length === 2);
  await tileByName(page, 'budget.xlsx').click({ button: 'right', position: { x: 30, y: 30 } });
  await menuItem(page, 'open').click();
  await page.waitForTimeout(800);
  check('[open] menu "Open" on a file → new tab', (await sent()).length === 3);
  await page.evaluate(() => chrome.storage.sync.set({ openFilesIn: 'window' }));
  await page.waitForTimeout(700);
  await tileByName(page, 'mountains.jpg').dblclick();
  await page.waitForTimeout(300);
  check('[open] "new window" mode', (await sent()).slice(-1)[0].mode === 'window');
  // Ctrl+C = copy link
  n0 = await count(page);
  await tileByName(page, 'beach.png').click();
  await page.keyboard.press('Control+c');
  await page.waitForTimeout(1600);
  check('[keys] Ctrl+C → Drive "Copy link"', (await actionsSince(page, n0)).includes('MENU Copy link'), (await actionsSince(page, n0)).join(' | '));
  await ctx.close();
}

// Recycle Bin: drop → Drive delete, icon full, context menu
for (const lang of ['en', 'ja']) {
  for (const theme of ['light', 'dark']) {
    const tag = `${lang}-${theme}`;
    const { ctx, page } = await openDrive({ hl: lang, theme, nolog: 1 }, {});
    const bin = page.locator('#dxe-bin-host >> .bin');
    const state0 = await bin.getAttribute('data-state');
    const t = tileByName(page, 'README.txt');
    await t.click();
    await page.waitForTimeout(300);
    const n0 = await count(page);
    const tb = await t.boundingBox(), bb = await bin.boundingBox();
    await page.mouse.move(tb.x + 40, tb.y + 40);
    await page.mouse.down();
    await page.mouse.move(tb.x + 80, tb.y + 60, { steps: 4 });
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 12 });
    await page.waitForTimeout(120);
    if (theme === 'light') await page.screenshot({ path: path.join(OUT, `14-recycle-bin-drag-over-${tag}.png`) });
    await page.mouse.up();
    await page.waitForTimeout(1800);
    const acts = await actionsSince(page, n0);
    const del = lang === 'ja' ? 'MENU ゴミ箱に移動' : 'MENU Move to trash';
    const state1 = await bin.getAttribute('data-state');
    check(`[${tag}] drop on Recycle Bin → Drive "${del.slice(5)}", icon full`, acts.filter((a) => a === del).length === 1 && state0 === 'empty' && state1 === 'full', acts.join(' | ') + ` ${state0}→${state1}`);
    await page.screenshot({ path: path.join(OUT, `15-recycle-bin-full-toast-${tag}.png`) });
    await bin.click({ button: 'right' });
    await page.waitForTimeout(200);
    const items = await page.evaluate(() => [...document.getElementById('dxe-menu-host').shadowRoot.querySelectorAll('.item')].map((i) => i.dataset.action));
    check(`[${tag}] Recycle Bin context menu`, items.join() === 'binOpen,binEmpty', items.join());
    await page.screenshot({ path: path.join(OUT, `16-recycle-bin-menu-${tag}.png`) });
    await page.keyboard.press('Escape');
    await ctx.close();
  }
}

// details pane without tabs → right-column heuristic (geometry + list shrink)
{
  const { ctx, page } = await openDrive({ hl: 'en', nolog: 1, autodetails: 1, dpnotabs: 1 }, { suppressDetails: true });
  await tileByName(page, 'mountains.jpg').click();
  await page.waitForTimeout(1300);
  const pi = await page.evaluate(() => { const p = document.querySelector('[data-dxe-details]'); return { open: window.__details.isOpen(), tagged: !!p, isDp: !!(p && p.classList.contains('dp')), opacity: p ? getComputedStyle(p).opacity : null, strategy: DXE.detailsStats && DXE.detailsStats.strategy, grid: getComputedStyle(document.getElementById('grid')).opacity }; });
  check('[heuristic] tab-less right pane hidden via side-heuristic, list untouched', pi.open && pi.isDp && pi.opacity === '0' && pi.grid === '1', JSON.stringify(pi));
  await page.screenshot({ path: path.join(OUT, '17-side-heuristic-pane-hidden-en-light.png') });
  // page structure dump (with the pane open)
  const dump = await page.evaluate(() => DXE.structure.dump());
  const leaks = ['beach.png', 'mountains.jpg', 'Meeting notes', 'README', '1AbC'].filter((x) => dump.includes(x));
  check('[structure] sanitized dump: no names/ids, has roles, right panel, <200KB', !leaks.length && /role=grid/.test(dump) && /## right-side column candidates \([1-9]/.test(dump) && dump.length < 210000 && /"Move to trash"/.test(dump), 'leaks=' + leaks.join(',') + ' len=' + dump.length);
  fs.writeFileSync(path.join(OUT, 'page-structure-sample.txt'), dump);
  await ctx.close();
}
// toggles off → no toolbar/status/bin/ficons
{
  const { ctx, page } = await openDrive({ hl: 'en', nolog: 1 }, { explorerToolbar: false, statusBar: false, recycleBin: false, fluentIcons: false });
  const st = await page.evaluate(() => ['dxe-toolbar-host', 'dxe-status-host', 'dxe-bin-host'].filter((i) => document.getElementById(i)).length + document.querySelectorAll('[data-dxe-ficon]').length);
  check('[toggles] Explorer extras all off', st === 0, String(st));
  await page.evaluate(() => chrome.storage.sync.set({ explorerToolbar: true, statusBar: true, recycleBin: true, fluentIcons: true }));
  await page.waitForTimeout(900);
  const st2 = await page.evaluate(() => ['dxe-toolbar-host', 'dxe-status-host', 'dxe-bin-host'].filter((i) => document.getElementById(i)).length + ':' + document.querySelectorAll('[data-dxe-ficon]').length);
  check('[toggles] … and on again live', st2 === '3:5', st2);
  await ctx.close();
}

// Popup render (light + dark), with a chrome shim
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 364, height: 900 }, colorScheme: theme });
  const page = await ctx.newPage();
  const msgs = JSON.parse(fs.readFileSync(path.join(ROOT, '_locales', theme === 'dark' ? 'ja' : 'en', 'messages.json'), 'utf8'));
  await page.addInitScript(`(() => { const M = ${JSON.stringify(msgs)}; const store = { darkDocs: true };
    globalThis.chrome = { i18n: { getMessage: (k) => (M[k] || {}).message || '', getUILanguage: () => '${theme === 'dark' ? 'ja' : 'en'}' },
      runtime: { getManifest: () => ({ version: '${manifest.version}' }) },
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
