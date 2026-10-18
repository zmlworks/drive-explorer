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
  function tag() {
    if (panel && panel.isConnected && panel.hasAttribute('data-dxe-details')) return panel;
    const p = SEL.findDetailsPanel();
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

  /* ---------- scraping ---------- */
  const isUiButton = (el) => {
    const b = el.closest('button,[role="button"]');
    if (!b) return false;
    const aria = norm(b.getAttribute('aria-label'));
    return D.ignoreText.test(aria || norm(b.textContent)) || D.closeButton.test(aria) ||
      (!!aria && !norm(b.textContent).replace(/[^\p{L}\p{N}]/gu, '')); // icon-only buttons (✕, ⋮)
  };
  /** visible-ish text of el, skipping UI buttons. alt=true: avatar alts are
      used when there is no other text (e.g. "Aiko, Ben"). */
  function textOf(el, alt = true) {
    const parts = [], alts = [];
    const walk = (n) => {
      if (n.nodeType === 3) { const t = norm(n.nodeValue); if (t) parts.push(t); return; }
      if (n.nodeType !== 1) return;
      if (n.matches('[aria-hidden="true"],script,style,svg') || isUiButton(n)) return;
      if (n.tagName === 'IMG') { if (n.alt) alts.push(norm(n.alt)); return; }
      for (const c of n.childNodes) walk(c);
    };
    walk(el);
    const txt = parts.join(' ').replace(/\s+/g, ' ').trim();
    return txt || (alt ? alts.join(', ') : '');
  }

  function scrape(p) {
    const cands = [];
    for (const el of p.querySelectorAll('*')) {
      if (el.closest('[role="tablist"],[role="tab"]')) continue;
      if (el.tagName === 'DL') continue; // handled below
      const kids = [...el.children].filter((k) => textOf(k));
      if (kids.length !== 2) continue;
      const label = textOf(kids[0], false);
      const value = textOf(kids[1]);
      if (!label || label.length > 40 || !value || value.length > 400) continue;
      if (D.headings.test(label) && !SEL.labelKey(label)) continue;
      if (kids[0].querySelector('button,[role="button"]') && !SEL.labelKey(label)) continue;
      cands.push({ el, label, value, key: SEL.labelKey(label) });
    }
    // dl/dt/dd
    p.querySelectorAll('dt').forEach((dt) => {
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName === 'DD') cands.push({ el: dt, label: textOf(dt), value: textOf(dd), key: SEL.labelKey(textOf(dt)) });
    });
    // keep leaf-most candidates
    let pairs = cands.filter((c) => !cands.some((o) => o !== c && c.el.contains(o.el)));
    let strategy = 'structure';
    // fallback: innerText lines, known labels followed by their value line
    if (pairs.filter((x) => x.key).length < 2) {
      const lines = (p.innerText || '').split('\n').map(norm).filter(Boolean);
      const viaLines = [];
      for (let i = 0; i < lines.length - 1; i++) {
        const k = SEL.labelKey(lines[i]);
        if (k && !SEL.labelKey(lines[i + 1])) viaLines.push({ label: lines[i], value: lines[i + 1], key: k });
      }
      if (viaLines.length > pairs.filter((x) => x.key).length) { pairs = viaLines; strategy = 'lines'; }
    }
    const seen = new Set();
    pairs = pairs.filter((x) => { const k = x.label.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .map(({ label, value, key }) => ({ label, value, key }));
    // panel title (file name): first heading-ish text before the tabs
    let title = '';
    const h = p.querySelector('[role="heading"],h1,h2');
    if (h) title = textOf(h);
    return { pairs, strategy, title };
  }

  /* ---------- read(item) ---------- */
  async function read(ctx, { timeout = 4500 } = {}) {
    const html = document.documentElement;
    const wasOpen = !!(tag() && SEL.isShown(panel));
    html.classList.add('dxe-props-busy');
    const res = { ok: false, pairs: [], why: '', opened: false };
    try {
      if (!wasOpen) {
        const ok = await DXE.native.perform('info', ctx);
        res.opened = ok;
      } else {
        // panel follows selection; make sure the item is selected
        if (!SEL.isSelected(ctx.item)) DXE.native.selectItem(ctx.item);
      }
      const end = performance.now() + timeout;
      let prevSig = '', stable = 0, tabClicked = false, best = null, toolbarTried = false;
      const t0 = performance.now();
      while (performance.now() < end) {
        await sleep(120);
        const p = tag();
        if (!p) {
          // menu route didn't open it → try the toolbar "View details" (i) button once
          if (!toolbarTried && performance.now() - t0 > 1500) {
            toolbarTried = true;
            const b = SEL.findToolbarButton(SEL.ACTIONS.info.toolbar);
            DXE.log('details panel not open yet; toolbar button', b ? 'clicked' : 'not found');
            if (b) DXE.native.activate(b);
          }
          continue;
        }
        const tab = SEL.detailsTab(p);
        if (tab && tab.getAttribute('aria-selected') === 'false' && !tabClicked) { DXE.native.activate(tab); tabClicked = true; continue; }
        const s = scrape(p);
        const known = s.pairs.filter((x) => x.key).length;
        if (!best || s.pairs.length >= best.pairs.length) best = s;
        const sig = s.pairs.map((x) => x.label + '=' + x.value).join('|');
        if (known >= 2 && sig === prevSig) { if (++stable >= 2) break; } else stable = 0;
        prevSig = sig;
      }
      if (best && best.pairs.length) {
        res.ok = true;
        Object.assign(res, best);
      } else res.why = panel ? 'panel found but no fields recognised' : 'details panel did not open';
      stats.lastScrape = { ok: res.ok, strategy: res.strategy, fields: res.pairs.map((x) => x.key || '?'), why: res.why, panelStrategy: stats.strategy };
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
  const soon = () => { setTimeout(check, 40); setTimeout(check, 350); };
  window.addEventListener('pointerup', soon, true);
  window.addEventListener('keyup', soon, true);
  setInterval(() => { if (!panel || !panel.isConnected) check(); }, 1500);

  DXE.details = {
    read,
    scrape,
    tag,
    setSuppressed(on) {
      document.documentElement.classList.toggle('dxe-hide-details', !!on);
      if (on) tag();
      DXE.log('details panel suppression', on ? 'ON' : 'off');
    },
  };
  check();
})();
