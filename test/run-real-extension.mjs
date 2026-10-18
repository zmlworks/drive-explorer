// End-to-end smoke test with the REAL unpacked extension loaded into Chrome
// (CDP Extensions.loadUnpacked; branded Chrome ignores --load-extension).
// drive.google.com / docs.google.com requests are answered locally with the
// mock pages, so the manifest's content scripts inject exactly as on the real
// sites — no request leaves the machine.
// Usage: node test/run-real-extension.mjs <outDir>
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_CORE || '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core';
const { chromium } = require(PW);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || '/tmp/dxe-real');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (n, ok, x = '') => { results.push({ n, ok, x }); console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  — ' + x : '')); };

const ctx = await chromium.launchPersistentContext(fs.mkdtempSync('/tmp/dxe-prof-'), {
  executablePath: '/usr/bin/google-chrome', headless: true, viewport: { width: 1180, height: 760 },
  args: ['--no-sandbox', '--enable-unsafe-extension-debugging'], ignoreDefaultArgs: ['--disable-extensions'],
});
const mockDrive = fs.readFileSync(path.join(ROOT, 'test/mock-drive.html'), 'utf8');
const mockDocs = fs.readFileSync(path.join(ROOT, 'test/mock-docs.html'), 'utf8');
await ctx.route(/^https:\/\/(drive|docs)\.google\.com\//, (route) => {
  const u = route.request().url();
  if (u.startsWith('https://drive.google.com/drive/')) return route.fulfill({ contentType: 'text/html', body: mockDrive });
  if (u.startsWith('https://docs.google.com/document/')) return route.fulfill({ contentType: 'text/html', body: mockDocs });
  return route.fulfill({ status: 204, body: '' });
});
await ctx.route(/^https?:\/\/(?!(drive|docs)\.google\.com)/, (route) => route.abort()); // offline guard

const bs = await ctx.browser().newBrowserCDPSession();
const { id } = await bs.send('Extensions.loadUnpacked', { path: ROOT });
check('extension loads unpacked (manifest valid)', !!id, id);

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('https://drive.google.com/drive/my-drive?hl=en&nolog=1');
await page.waitForTimeout(1200);
const tagged = await page.evaluate(() => document.querySelectorAll('[data-dxe-tile]').length);
check('content scripts injected on drive.google.com (isolated world), tiles tagged', tagged === 15, 'tiles=' + tagged);
const tile = page.locator('[data-id]', { hasText: 'beach.png' }).first();
await tile.click(); // (mock's selection bar shifts layout on first selection)
await tile.click({ button: 'right', position: { x: 30, y: 30 } });
await page.waitForTimeout(250);
const hostShown = await page.evaluate(() => !!document.getElementById('dxe-menu-host')?.shadowRoot?.querySelector('.menu'));
check('Win11 menu shown from real content script', hostShown);
await page.screenshot({ path: path.join(OUT, 'real-extension-drive-menu.png') });
await page.locator('#dxe-menu-host >> .item[data-action="move"]').click();
await page.waitForTimeout(1600);
const acts = await page.evaluate(() => window.__actions);
check('Move routed to Drive native menu from isolated world', acts.includes('MENU Move'), acts.join(' | '));

// Properties through the real extension
await tile.click({ button: 'right', position: { x: 30, y: 30 } });
await page.locator('#dxe-menu-host >> .item[data-action="properties"]').click();
await page.waitForTimeout(3500);
const props = await page.evaluate(() => document.getElementById('dxe-props-host')?.shadowRoot?.querySelector('.body')?.innerText || '');
check('Properties dialog filled from Drive details pane (real extension)', /Type:\s*Image/.test(props) && /Size:/.test(props), props.replace(/\n/g, ' ').slice(0, 120));
await page.screenshot({ path: path.join(OUT, 'real-extension-properties.png') });
await page.keyboard.press('Escape');

// popup → storage → content script
const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${id}/popup/popup.html`);
await popup.waitForTimeout(300);
await popup.locator('input[data-key="mediumIcons"]').click();
await page.waitForTimeout(600);
check('popup toggle (mediumIcons off) reaches Drive tab via chrome.storage.sync',
  await page.evaluate(() => !document.documentElement.classList.contains('dxe-medium') && !document.querySelector('[data-dxe-tile]')));
await popup.locator('input[data-key="mediumIcons"]').click();
await popup.locator('input[data-key="darkDocs"]').click();
await popup.screenshot({ path: path.join(OUT, 'real-extension-popup.png') });
await page.bringToFront();
await page.waitForTimeout(600);
check('toggle back on', await page.evaluate(() => document.querySelectorAll('[data-dxe-tile]').length) === 15);

const rep = await popup.evaluate(async () => {
  const [t] = await chrome.tabs.query({ url: 'https://drive.google.com/*' });
  return chrome.tabs.sendMessage(t.id, { type: 'dxe-report' });
});
check('diagnostics report via popup → content script message', rep && rep.counts && rep.counts.items === 15, rep && JSON.stringify(rep.counts));
const docs = await ctx.newPage();
await docs.goto('https://docs.google.com/document/d/mock/edit');
await docs.waitForTimeout(800);
check('docs dark mode applied on docs.google.com/document', await docs.evaluate(() => document.documentElement.classList.contains('dxe-docs-dark')));
await docs.screenshot({ path: path.join(OUT, 'real-extension-docs-dark.png') });
check('no page errors', errors.length === 0, errors.join(' | '));
await ctx.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} real-extension checks passed`);
fs.writeFileSync(path.join(OUT, 'real-extension-results.txt'), results.map((r) => (r.ok ? 'PASS ' : 'FAIL ') + r.n + (r.x ? '  — ' + r.x : '')).join('\n') + `\n\n${results.length - failed}/${results.length} real-extension checks passed\n`);
process.exit(failed ? 1 : 0);
