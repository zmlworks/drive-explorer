/* Drive Explorer — Drive's details side panel ("Details" / "ファイル情報").
   - tags the panel column with data-dxe-details (CSS hides it when
     html.dxe-hide-details or html.dxe-props-busy is set);
   - read(item): opens the panel invisibly for an item, scrapes label/value
     pairs, restores the previous state.                                   */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  const SEL = DXE.SEL;
  const D = SEL.DETAILS;
  const norm = SEL.norm;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const stats = (DXE.detailsStats = { tagged: 0, strategy: null, lastScrape: null });

  let panel = null;
  let prevListWidth = null; // list width before the last user action
  function tag(useSide) {
    if (panel && panel.isConnected && panel.hasAttribute('data-dxe-details')) return panel;
    let p = SEL.findDetailsPanel();
    if (!p && useSide !== false) p = SEL.findSidePanel(prevListWidth);
    if (p && p !== panel) {
      if (panel) panel.removeAttribute('data-dxe-details');
      p.setAttribute('data-dxe-details', '');
      panel = p;
      stats.tagged++;
      stats.strategy = SEL.lastDetailsStrategy;
      DXE.log('details panel found via', SEL.lastDetailsStrategy, p);
      // A hidden panel must not keep keyboard focus.
      if (hidden() && p.contains(document.activeElement)) {
        const sel = SEL.selectedItems()[0];
        if (sel && sel.focus) sel.focus({ preventScroll: true }); else document.activeElement.blur();
      }
    }
    return p;
  }
  const hidden = () => document.documentElement.matches('.dxe-hide-details,.dxe-props-busy');

  // Cheap first: only do geometry work when tabs/complementary nodes changed.
  let last = 0, timer = 0;
  const check = () => {
    const now = performance.now();
    if (now - last < 60) { clearTimeout(timer); timer = setTimeout(check, 70); return; }
    last = now;
    try { tag(); } catch (e) { console.error('[DriveExplorer] details', e); }
  };
  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1 && (n.matches('[role="tab"],[role="tablist"],[role="complementary"],aside') ||
            n.querySelector('[role="tab"],[role="complementary"],aside'))) { check(); return; }
      }
    }
    if (panel && !panel.isConnected) { panel = null; check(); }
  }).observe(document.documentElement, { childList: true, subtree: true });

  /* ---------- scraping (pane itself + iframes inside it) ---------- */
  const { scrapeRoot } = DXE.scrapeCore;
  let reqId = 0;
  const pending = new Map();
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.__dxe !== 'scrape-result' || !/^https:\/\/(drive|docs)\.google\.com$/.test(e.origin)) return;
    const f = pending.get(d.id);
    if (f) { pending.delete(d.id); f(d); }
  });
  const askFrame = (win) => new Promise((resolve) => {
    const id = 'dxe' + (++reqId);
    pending.set(id, resolve);
    try { win.postMessage({ __dxe: 'scrape', id }, '*'); } catch (e) { pending.delete(id); resolve(null); return; }
    setTimeout(() => { if (pending.delete(id)) resolve(null); }, 900);
  });
  /** Frames inside the pane: [{ el, doc|null, crossOrigin, src }] */
  function framesOf(p) {
    return [...p.querySelectorAll('iframe')].map((el) => {
      let doc = null;
      try { doc = el.contentDocument; } catch (e) { doc = null; }
      let src = '';
      try { const u = new URL(el.src || 'about:blank', location.href); src = u.host + u.pathname.replace(/[A-Za-z0-9_-]{20,}/g, '<id>'); } catch (e) { src = '?'; }
      return { el, doc: doc && doc.body ? doc : null, src };
    });
  }
  async function scrapePanel(p) {
    const results = [{ via: 'pane', ...scrapeRoot(p) }];
    for (const f of framesOf(p)) {
      if (f.doc) results.push({ via: 'iframe(same-origin) ' + f.src, ...scrapeRoot(f.doc.body) });
      else if (f.el.contentWindow) {
        const r = await askFrame(f.el.contentWindow);
        if (r && r.result) results.push({ via: 'iframe(helper) ' + (r.href || f.src), ...r.result });
        else results.push({ via: 'iframe(unreadable) ' + f.src, pairs: [], strategy: 'none', title: '' });
      }
    }
    const score = (r) => r.pairs.filter((x) => x.key).length * 10 + r.pairs.length;
    const best = results.sort((x, y) => score(y) - score(x))[0];
    best.sources = results.map((r) => r.via + ':' + r.pairs.length);
    const hdr = SEL.detailsHeader(p);
    best.header = hdr;
    if (!best.title) best.title = hdr.name;
    return best;
  }
  /** sync variant for diagnostics (pane + same-origin frames only) */
  function scrape(p) {
    const r = scrapeRoot(p);
    for (const f of framesOf(p)) if (f.doc) { const x = scrapeRoot(f.doc.body); if (x.pairs.length > r.pairs.length) Object.assign(r, x); }
    return r;
  }

  const itemName = (item) => {
    const n = item && item.querySelector('[data-dxe-part="name"]');
    return norm(n ? n.textContent : ((item && SEL.analyzeTile(item).name) || {}).textContent || '');
  };
  const sameName = (a, b) => !!a && !!b && (a === b || a.startsWith(b) || b.startsWith(a));

  /* ---------- read(item) ---------- */
  async function read(ctx, { timeout = 5000 } = {}) {
    const html = document.documentElement;
    const wasOpen = SEL.detailsPanelOpen(tag(false));
    prevListWidth = SEL.listWidth();
    html.classList.add('dxe-props-busy');
    const want = itemName(ctx.item);
    const res = { ok: false, pairs: [], why: '', opened: false, wasOpen };
    try {
      if (!SEL.isSelected(ctx.item)) DXE.native.selectItem(ctx.item);
      // Drive's pane follows the selection: if it is already open (it usually
      // is while we keep it hidden), no need to go through the menu.
      if (!wasOpen) res.opened = await DXE.native.perform('info', ctx);
      const end = performance.now() + timeout;
      let prevSig = '', stable = 0, tabClicked = false, best = null, toolbarTried = false, header = null;
      const t0 = performance.now();
      while (performance.now() < end) {
        await sleep(140);
        const p = tag();
        if (!p || !SEL.detailsPanelOpen(p)) {
          if (!toolbarTried && performance.now() - t0 > 1500) {
            toolbarTried = true;
            const b = SEL.findToolbarButton(SEL.ACTIONS.info.toolbar) || SEL.findToolbarButton(D.toolbarDetails);
            DXE.log('details panel not open yet; toolbar button', b ? 'clicked' : 'not found');
            if (b) DXE.native.activate(b);
          }
          continue;
        }
        header = SEL.detailsHeader(p);
        // wait (a while) until the pane shows the right item
        if (want && header.name && !sameName(header.name, want) && performance.now() - t0 < timeout * 0.7) continue;
        const tab = SEL.detailsTab(p);
        if (tab && tab.getAttribute('aria-selected') === 'false' && !tabClicked) { DXE.native.activate(tab); tabClicked = true; continue; }
        const s = await scrapePanel(p);
        // body only in frames we cannot read: don't wait for the full timeout
        if (!s.pairs.length && header.name && (s.sources || []).some((x) => x.startsWith('iframe(unreadable)')) && performance.now() - t0 > 2200) { best = best || s; break; }
        const known = s.pairs.filter((x) => x.key).length;
        if (!best || s.pairs.length >= best.pairs.length) best = s;
        const sig = s.pairs.map((x) => x.label + '=' + x.value).join('|');
        if (known >= 2 && sig === prevSig) { if (++stable >= 2) break; } else stable = 0;
        prevSig = sig;
      }
      if (best && best.pairs.length) {
        res.ok = true;
        Object.assign(res, best);
      } else if (header && (header.name || header.type)) {
        // pane body unreadable, but the header tells name + type
        res.ok = true;
        res.partial = true;
        res.title = header.name;
        res.pairs = header.type ? [{ label: SEL.uiLang() === 'ja' ? '種類' : 'Type', value: header.type, key: 'type' }] : [];
        res.strategy = 'header-only';
        res.sources = best ? best.sources : [];
        res.why = 'pane body not readable (' + ((best && best.sources) || []).join(', ') + ')';
      } else res.why = panel ? 'panel found but no fields recognised' : 'details panel did not open';
      if (header) res.header = header;
      stats.lastScrape = { ok: res.ok, partial: !!res.partial, strategy: res.strategy, sources: res.sources, fields: res.pairs.map((x) => x.key || '?'),
        why: res.why, panelStrategy: stats.strategy, wasOpen, nameMatched: header ? sameName(header.name, want) : null };
      DXE.log('details scrape', stats.lastScrape, res.pairs);
      return res;
    } finally {
      if (!wasOpen && panel && panel.isConnected) {
        const close = SEL.findDetailsClose(panel) || SEL.findToolbarButton(D.hideToolbar);
        if (close) DXE.native.activate(close);
        DXE.log('details panel closed again via', close ? (close.getAttribute('aria-label') || 'button') : 'nothing (left hidden)');
      }
      setTimeout(() => html.classList.remove('dxe-props-busy'), 350);
    }
  }

  // Drive may keep the pane in the DOM and only toggle its size/visibility,
  // which adds no nodes: re-check after user input and periodically.
  const soon = () => { setTimeout(check, 40); setTimeout(check, 350); setTimeout(check, 900); };
  const measure = () => { if (!panel || !panel.isConnected) prevListWidth = SEL.listWidth(); };
  window.addEventListener('pointerdown', measure, true);
  window.addEventListener('keydown', measure, true);
  window.addEventListener('pointerup', soon, true);
  window.addEventListener('keyup', soon, true);

  // aria-label based hiding, pure CSS (works even before we detect anything)
  const css = document.createElement('style');
  css.setAttribute('data-dxe-ui', '');
  const hideRule = 'position:fixed!important;top:0!important;right:0!important;left:auto!important;width:360px!important;max-width:360px!important;' +
    'min-width:0!important;height:100vh!important;margin:0!important;opacity:0!important;pointer-events:none!important;z-index:-1!important;transition:none!important;animation:none!important;';
  try {
    const sel = SEL.panelAriaSelector();
    css.textContent = `html.dxe-hide-details ${sel}, html.dxe-props-busy ${sel} {${hideRule}}`;
  } catch (e) { /* :has unsupported */ }
  (document.head || document.documentElement).appendChild(css);
  setInterval(() => { if (!panel || !panel.isConnected) check(); }, 1500);

  DXE.details = {
    read,
    scrape,
    scrapePanel,
    framesOf,
    tag,
    setSuppressed(on) {
      document.documentElement.classList.toggle('dxe-hide-details', !!on);
      if (on) tag();
      DXE.log('details panel suppression', on ? 'ON' : 'off');
    },
  };
  check();
})();
