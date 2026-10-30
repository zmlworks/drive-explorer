/* Drive Explorer — desktop-style Recycle Bin tile (bottom-right).
   Double-click → Drive's Trash. Drop items on it → Drive's own "Move to
   trash" action (undo with Ctrl+Z / Drive's Undo toast). The full/empty icon
   uses a local, approximate counter (chrome.storage.local) that resyncs when
   you visit Trash. "Empty Recycle Bin" only opens the Trash page — it never
   deletes anything by itself. */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  const SEL = DXE.SEL;
  const KEY = 'dxeBinCount';
  const STR = {
    en: { name: 'Recycle Bin', open: 'Open', empty: 'Empty Recycle Bin', moved: (n) => `Moved ${n} item${n === 1 ? '' : 's'} to the Recycle Bin — Ctrl+Z or Drive’s “Undo” restores`,
      unverified: (n) => `Sent “delete” for ${n} item${n === 1 ? '' : 's'} to Drive — not confirmed. Check the result in Drive`,
      aborted: 'The selection changed, so nothing was moved to the Recycle Bin.', inTrash: 'Dropping is disabled inside Trash.',
      drop: 'Move to Recycle Bin', emptyHint: 'Opening Trash — use Drive’s “Empty trash” button there.', tip: (n) => n ? `About ${n} item${n === 1 ? '' : 's'} (approximate)` : 'Empty' },
    ja: { name: 'ごみ箱', open: '開く', empty: 'ごみ箱を空にする', moved: (n) => `${n} 個の項目をごみ箱に移動しました — Ctrl+Z またはドライブの「元に戻す」で戻せます`,
      unverified: (n) => `${n} 個の項目の削除をドライブに送りました（未確認）。ドライブで結果を確認してください`,
      aborted: '選択が変わったため、ごみ箱への移動を中止しました。', inTrash: 'ゴミ箱の中ではドロップできません。',
      drop: 'ごみ箱へ移動', emptyHint: 'ゴミ箱を開きます。そこでドライブの「ゴミ箱を空にする」を使ってください。', tip: (n) => n ? `約 ${n} 個の項目 (概算)` : '空' },
  };
  const L = () => STR[SEL.uiLang()];

  let count = 0;
  const store = chrome.storage && chrome.storage.local;
  const setCount = (n) => {
    n = Math.max(0, Math.min(99999, n | 0));
    if (n === count) return;
    count = n;
    if (store) store.set({ [KEY]: n });
    render();
  };
  if (chrome.storage && chrome.storage.onChanged) chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch[KEY]) { count = ch[KEY].newValue || 0; render(); } });
  document.addEventListener('dxe-deleted', (e) => setCount(count + (e.detail || 1)));

  const CSS = `
  :host { all: initial; }
  .bin { position: fixed; right: 18px; bottom: 34px; z-index: 2147482000; width: 84px; height: 92px; box-sizing: border-box;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 4px; padding: 6px 4px 4px; border-radius: 6px;
    border: 1px solid transparent; color: #1b1b1b; cursor: default; user-select: none; outline: none;
    font: 400 12px/16px "Segoe UI Variable Text","Segoe UI","Yu Gothic UI","Meiryo UI",-apple-system,"Hiragino Sans","Noto Sans JP",system-ui,sans-serif;
    background: rgba(255,255,255,.55); backdrop-filter: blur(8px); box-shadow: 0 2px 8px rgba(0,0,0,.08); transition: background .1s, transform .1s; }
  .bin.dark { color: #fff; background: rgba(44,44,44,.6); box-shadow: 0 2px 8px rgba(0,0,0,.3); }
  .bin:hover { background: rgba(0,0,0,.05); }
  .bin.dark:hover { background: rgba(255,255,255,.08); }
  .bin.sel, .bin:focus-visible { background: rgba(0,95,184,.12); border-color: rgba(0,95,184,.35); }
  .bin.dark.sel, .bin.dark:focus-visible { background: rgba(96,205,255,.14); border-color: rgba(96,205,255,.4); }
  .bin.over { background: rgba(0,95,184,.22); border-color: #005fb8; transform: scale(1.06); }
  .bin.dark.over { background: rgba(96,205,255,.24); border-color: #60cdff; }
  .ic { width: 48px; height: 48px; display: flex; pointer-events: none; }
  .lb { text-align: center; pointer-events: none; }
  .tip { position: absolute; bottom: 100%; right: 0; margin-bottom: 6px; white-space: nowrap; padding: 4px 8px; border-radius: 4px; font-size: 12px;
    background: #005fb8; color: #fff; opacity: 0; transition: opacity .1s; pointer-events: none; }
  .bin.over .tip { opacity: 1; }
  `;
  let host, el;
  function build() {
    host = document.createElement('div');
    host.id = 'dxe-bin-host';
    host.setAttribute('data-dxe-ui', '');
    const root = host.attachShadow({ mode: 'open' });
    const st = document.createElement('style'); st.textContent = CSS; root.appendChild(st);
    el = document.createElement('div');
    el.className = 'bin';
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.innerHTML = '<div class="ic"></div><div class="lb"></div><div class="tip"></div>';
    root.appendChild(el);
    el.addEventListener('click', () => el.classList.add('sel'));
    el.addEventListener('blur', () => el.classList.remove('sel'));
    el.addEventListener('dblclick', openTrash);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); openTrash(); } });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault(); e.stopPropagation();
      el.classList.add('sel');
      const binSvg = (k) => DXE.ICONS.svg(k, 16);
      DXE.menu.show({ x: e.clientX, y: e.clientY, custom: [
        [{ id: 'binOpen', label: L().open, run: openTrash }],
        [{ id: 'binEmpty', label: L().empty, svg: binSvg('binEmpty'), run: () => { DXE.menu.toast(L().emptyHint); setTimeout(openTrash, 600); } }],
      ] });
    });
    // HTML5 drag & drop (if Drive uses it)
    el.addEventListener('dragenter', (e) => { if (drag.item && !inTrash()) { e.preventDefault(); el.classList.add('over'); } });
    el.addEventListener('dragover', (e) => { if (drag.item && !inTrash()) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; el.classList.add('over'); } });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', (e) => { if (drag.item) { e.preventDefault(); e.stopPropagation(); dropNow('html5'); } });
  }

  function openTrash() {
    const link = [...document.querySelectorAll('a[href*="/trash"]')].find((a) => SEL.isShown(a) && !SEL.isOurs(a));
    DXE.log('recycle bin → trash', link ? '(left-nav link)' : '(url)');
    if (link) { DXE.native.activate(link); setTimeout(() => { if (!SEL.NAV.trashPath.test(location.pathname)) location.assign(SEL.trashUrl()); }, 900); }
    else location.assign(SEL.trashUrl());
  }

  function render() {
    if (!DXE.settings || !DXE.settings.recycleBin) { if (host) host.remove(); return; }
    if (!host) build();
    if (!host.isConnected) document.documentElement.appendChild(host);
    el.classList.toggle('dark', DXE.theme && DXE.theme() === 'dark');
    el.lang = SEL.uiLang();
    el.querySelector('.ic').innerHTML = DXE.ICONS.svg(count > 0 ? 'binFull' : 'binEmpty', 48);
    el.querySelector('.lb').textContent = L().name;
    el.querySelector('.tip').textContent = L().drop;
    el.title = L().name + ' — ' + L().tip(count);
    el.setAttribute('aria-label', el.title);
    el.dataset.state = count > 0 ? 'full' : 'empty';
    // sit inside the main list area (clear of Drive's right-hand side-panel rail and our status bar)
    const main = SEL.scopeEl();
    if (main && main !== document.body) {
      const r = main.getBoundingClientRect();
      if (r.width > 300) {
        el.style.right = Math.max(8, Math.round(innerWidth - r.right + 16)) + 'px';
        el.style.bottom = Math.max(8, Math.round(innerHeight - Math.min(r.bottom, innerHeight) + (DXE.settings.statusBar ? 32 : 16))) + 'px';
      }
    }
  }

  /* ---- drag tracking (HTML5 + mouse-based fallback) ---- */
  const drag = { item: null, x: 0, y: 0, moving: false, done: false };
  // 0.3.3: no drop inside Trash (there, Drive's Delete means "delete forever")
  const inTrash = () => SEL.isTrashView();
  const inBin = (x, y) => { if (!el || !host.isConnected) return false; const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
  window.addEventListener('dragstart', (e) => { const it = SEL.findItem(e.target); if (it && DXE.settings.recycleBin) Object.assign(drag, { item: it, moving: true, done: false }); }, true);
  window.addEventListener('dragend', () => { if (el) el.classList.remove('over'); setTimeout(() => { drag.item = null; drag.moving = false; }, 50); }, true);
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !DXE.settings.recycleBin || SEL.isOurs(e.target)) return;
    const it = SEL.findItem(e.target);
    Object.assign(drag, { item: it, x: e.clientX, y: e.clientY, moving: false, done: false });
  }, true);
  window.addEventListener('mousemove', (e) => {
    if (!drag.item || !(e.buttons & 1)) return;
    if (!drag.moving && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) drag.moving = true;
    if (drag.moving && el) el.classList.toggle('over', !inTrash() && inBin(e.clientX, e.clientY));
  }, true);
  const onUp = (e) => {
    if (drag.item && drag.moving && inBin(e.clientX, e.clientY)) dropNow('mouse');
    if (el) el.classList.remove('over');
    if (e.type === 'mouseup') { drag.item = null; drag.moving = false; }
  };
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('mouseup', onUp, true);

  async function dropNow(via) {
    if (drag.done || !drag.item) return;
    drag.done = true;
    const item = drag.item;
    el.classList.remove('over');
    if (inTrash()) { DXE.menu.toast(L().inTrash); return; }
    const sel = SEL.selectedItems();
    // what the user dropped: the whole selection if they dragged a selected item, else just that item
    const expect = SEL.isSelected(item) && sel.length ? sel : [item];
    const n = expect.length;
    DXE.log('recycle bin drop via', via, 'items', n);
    // let Drive finish its own drag (it cancels when dropped outside a folder)
    await new Promise((r) => setTimeout(r, 120));
    if (!SEL.isSelected(item)) DXE.native.selectItem(item, item);
    // 0.3.3: before acting on Drive's selection, make sure it is still exactly what was dropped
    const why = DXE.native.selectionMismatch({ item, expect });
    if (why) {
      DXE.log('recycle bin drop aborted:', why);
      DXE.menu.toast(L().aborted);
      return;
    }
    const ok = await DXE.native.perform('delete', { item, target: item, expect });
    if (ok === DXE.native.UNVERIFIED) {
      // keyboard fallback: success only if the items actually left the list
      await new Promise((r) => setTimeout(r, 1200));
      if (expect.every((it) => !it.isConnected)) { setCount(count + n); DXE.menu.toast(L().moved(n)); }
      else DXE.menu.toast(L().unverified(n));
      return;
    }
    DXE.menu.toast(ok ? L().moved(n) : DXE.menu.t('failed', DXE.menu.t('delete')));
  }

  /* Delete key (Drive's own handler) → bump the approximate counter */
  window.addEventListener('keydown', (e) => {
    if (!e.isTrusted || (e.key !== 'Delete' && !(e.key === '#' && e.shiftKey)) || e.ctrlKey || e.altKey || e.metaKey) return;
    const a = document.activeElement;
    if (a && a.closest && (a.closest(SEL.editable) || SEL.isOurs(a))) return;
    if (SEL.NAV.trashPath.test(location.pathname)) return;
    const n = SEL.selectedItems().length;
    if (n) setTimeout(() => { if (SEL.selectedItems().length === 0 || !document.contains(SEL.selectedItems()[0])) setCount(count + n); }, 900);
  }, true);

  /* On the Trash page the real number is visible → resync */
  let trashSince = 0;
  function syncTrash() {
    if (!SEL.NAV.trashPath.test(location.pathname)) { trashSince = 0; return; }
    if (!trashSince) trashSince = Date.now();
    const n = SEL.allItems().length;
    if (n > 0 || Date.now() - trashSince > 4000) setCount(n);
  }

  let pend = 0;
  const schedule = () => { if (pend) return; pend = setTimeout(() => { pend = 0; try { render(); syncTrash(); } catch (e) { console.error('[DriveExplorer] bin', e); } }, 500); };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('dxe-theme', schedule);
  window.addEventListener('resize', schedule);

  if (store) store.get(KEY, (v) => { count = (v && v[KEY]) || 0; render(); });

  DXE.bin = { apply: () => { render(); schedule(); }, count: () => count, setCount, openTrash };
})();
