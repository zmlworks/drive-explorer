/* Drive Explorer — entry point on drive.google.com. */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  const SEL = DXE.SEL;
  if (DXE.mainStarted) return;
  DXE.mainStarted = true;

  /* ---------- right-click interception ---------- */
  function onContextMenu(e) {
    if (!DXE.settings.contextMenu || DXE.native.isBypassing()) return;
    if (e.shiftKey) { DXE.log('Shift+right-click → native menu'); return; } // escape hatch
    const t = e.target;
    if (SEL.isOurs(t)) { e.preventDefault(); return; }
    if (t.closest && t.closest(SEL.editable)) return;
    const item = SEL.findItem(t);
    if (!item) { DXE.log('contextmenu outside any item → native', t); return; }
    e.preventDefault();
    e.stopImmediatePropagation();
    const keyboard = e.button !== 2 && e.clientX === 0 && e.clientY === 0;
    ensureSelected(item, t);
    DXE.menu.show({ item, target: t, x: keyboard ? null : e.clientX, y: keyboard ? null : e.clientY, keyboard });
  }

  /* Right-clicking an unselected item selects it (Explorer + Drive behaviour).
     Drive usually already did this on mousedown; this is a safety net.      */
  function ensureSelected(item, target) {
    if (SEL.isSelected(item)) return;
    const el = target && !target.closest('button,[role="button"],[aria-haspopup]') && item.contains(target) ? target : item;
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, composed: true, view: window, button: 0, clientX: r.left + 4, clientY: r.top + 4 };
    el.dispatchEvent(new MouseEvent('mousedown', { ...o, buttons: 1 }));
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.dispatchEvent(new MouseEvent('click', o));
    DXE.log('ensureSelected → synthetic click; selected now:', SEL.isSelected(item));
  }

  /* ---------- F2 = rename (Explorer habit) ---------- */
  function onKeyDown(e) {
    if (!DXE.settings.contextMenu || e.key !== 'F2' || e.ctrlKey || e.altKey || e.metaKey) return;
    if (DXE.menu.isOpen()) return;
    const a = document.activeElement;
    if (a && a.closest && a.closest(SEL.editable)) return;
    const focused = a && SEL.findItem(a);
    const sel = SEL.selectedItems();
    const item = focused && SEL.isSelected(focused) ? focused : sel[0];
    if (!item || sel.length > 1) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    DXE.native.perform('rename', { item, target: item });
  }

  /* ---------- diagnostics for bug reports (no file names / ids) ---------- */
  function skeleton(el, depth = 0, max = 7) {
    if (!el || depth > max) return null;
    const attrs = {};
    for (const a of el.attributes) {
      if (/^(role|data-target|aria-selected|aria-haspopup|aria-checked|tabindex|draggable|jsaction)$/.test(a.name)) attrs[a.name] = a.name === 'jsaction' ? '…' : a.value;
      else if (/^(aria-label|data-tooltip|title|data-id|src|alt)$/.test(a.name)) attrs[a.name] = '<' + a.value.length + ' chars>';
      else if (a.name.startsWith('data-dxe')) attrs[a.name] = a.value;
    }
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(), attrs, size: Math.round(r.width) + 'x' + Math.round(r.height),
      text: el.children.length ? undefined : (el.textContent || '').trim().length,
      children: [...el.children].slice(0, 8).map((c) => skeleton(c, depth + 1, max)).filter(Boolean),
    };
  }

  function report() {
    const items = SEL.allItems();
    const bySelector = {};
    SEL.item.forEach((s) => { bySelector[s] = document.querySelectorAll(s).length; });
    const tile = items.find(SEL.isGridTile);
    const row = items.find((i) => !SEL.isGridTile(i));
    return {
      extension: 'drive-explorer ' + DXE.VERSION, selectorsRevision: SEL.revision,
      when: new Date().toISOString(), userAgent: navigator.userAgent,
      page: location.pathname.replace(/[A-Za-z0-9_-]{20,}/g, '<id>'), lang: document.documentElement.lang, uiLang: SEL.uiLang(),
      theme: DXE.theme && DXE.theme(), settings: DXE.settings,
      counts: {
        items: items.length, bySelector, grids: document.querySelectorAll('[role="grid"]').length,
        rows: document.querySelectorAll('[role="row"]').length, gridcells: document.querySelectorAll('[role="gridcell"]').length,
        selected: SEL.selectedItems().length, visibleNativeMenus: SEL.visibleMenus().length,
      },
      tiles: DXE.tileStats,
      lastActions: DXE.native.lastResults,
      sampleTile: tile ? skeleton(tile) : null,
      sampleTileContainers: tile ? (() => { const c = SEL.tileContainers(tile); return { strategy: c.strategy, row: c.row && skeleton(c.row, 0, 1), rowsParent: c.rowsParent && skeleton(c.rowsParent, 0, 0) }; })() : null,
      sampleListRow: row ? skeleton(row, 0, 4) : null,
    };
  }
  DXE.report = report;

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
      if (msg && msg.type === 'dxe-report') { reply(report()); }
      return false;
    });
  }

  /* ---------- settings ---------- */
  function apply() {
    if (DXE.settings.mediumIcons) DXE.tiles.enable(); else DXE.tiles.disable();
    if (!DXE.settings.contextMenu) DXE.menu.hide();
    DXE.detectTheme();
  }

  DXE.handlers = DXE.handlers || {};
  DXE.handlers.contextmenu = onContextMenu;
  DXE.handlers.keydown = onKeyDown;
  if (!DXE.earlyListeners) {
    window.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('keydown', onKeyDown, true);
  }
  DXE.settingsReady.then(() => {
    apply();
    DXE.log('started', { version: DXE.VERSION, selectors: SEL.revision, settings: DXE.settings, uiLang: SEL.uiLang() });
  });
  DXE.onSettingsChanged((diff) => {
    if ('mediumIcons' in diff || 'contextMenu' in diff) apply();
    if ('debug' in diff && diff.debug) console.log('[DriveExplorer] debug on. Report:', report());
  });
})();
