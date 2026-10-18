/* Drive Explorer — label/value scraping shared by the top page (details.js)
   and the frame helper (frame-scrape.js, for a details pane rendered inside
   an iframe). Pure DOM reading; no Drive-specific selectors besides SEL.DETAILS. */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  if (DXE.scrapeCore) return;
  const SEL = DXE.SEL;
  const D = SEL.DETAILS;
  const norm = SEL.norm;

  const isUiButton = (el) => {
    const b = el.closest('button,[role="button"]');
    if (!b) return false;
    if (b.matches(D.hooks.title)) return false; // the file name in the pane header is a button
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
      if (n.matches('[aria-hidden="true"],script,style,svg,[role="tooltip"],[role="status"]') || isUiButton(n)) return;
      if (n.tagName === 'IMG') { if (n.alt) alts.push(norm(n.alt)); return; }
      for (const c of n.childNodes) walk(c);
    };
    walk(el);
    const txt = parts.join(' ').replace(/\s+/g, ' ').trim();
    return txt || (alt ? alts.join(', ') : '');
  }

  /** Scrape label/value pairs under root (an element or a document body). */
  function scrapeRoot(p) {
    const cands = [];
    for (const el of p.querySelectorAll('*')) {
      if (el.closest('[role="tablist"],[role="tab"],[role="tooltip"]')) continue;
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
    p.querySelectorAll('dt').forEach((dt) => {
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName === 'DD') cands.push({ el: dt, label: textOf(dt), value: textOf(dd), key: SEL.labelKey(textOf(dt)) });
    });
    // aria-label="Label: value" / "ラベル：値" on single elements (Material lists)
    p.querySelectorAll('[aria-label]').forEach((el) => {
      const m = norm(el.getAttribute('aria-label')).match(/^([^:：]{1,30})[:：]\s*(.{1,300})$/);
      if (m && SEL.labelKey(m[1])) cands.push({ el, label: m[1], value: m[2], key: SEL.labelKey(m[1]), aria: true });
    });
    // Section heading + body (real Drive odp/embed pane, 2026-10):
    //   h2 "アクセスできるユーザー" + people grid (td role=gridcell aria-label="共有していません" / names)
    //   h2 > span "セキュリティの制限" + div "適用されている制限はありません"
    p.querySelectorAll('h1,h2,h3,h4,[role="heading"]').forEach((h) => {
      const label = textOf(h, false);
      const key = SEL.labelKey(label);
      if (!key || cands.some((c) => c.key === key)) return;
      const parts = [];
      for (let n = h.nextElementSibling, i = 0; n && i < 3; n = n.nextElementSibling, i++) {
        if (n.matches('h1,h2,h3,h4,[role="heading"]')) break;
        let v = textOf(n);
        if (!v) v = [...n.querySelectorAll('[role="gridcell"][aria-label],[role="img"][aria-label],[data-tooltip][aria-label]')].map((x) => norm(x.getAttribute('aria-label'))).filter(Boolean).join(', ');
        if (v && !D.ignoreText.test(v)) parts.push(v);
      }
      const value = parts.join(' — ').slice(0, 400);
      if (value) cands.push({ el: h.parentElement || h, label, value, key, heading: true });
    });
    let pairs = cands.filter((c) => c.aria || c.heading || !cands.some((o) => o !== c && !o.aria && !o.heading && c.el.contains(o.el)));
    let strategy = 'structure';
    if (pairs.filter((x) => x.key).length < 2) {
      const lines = (p.innerText || p.textContent || '').split('\n').map(norm).filter(Boolean);
      const viaLines = [];
      for (let i = 0; i < lines.length - 1; i++) {
        const k = SEL.labelKey(lines[i]);
        if (k && !SEL.labelKey(lines[i + 1])) viaLines.push({ label: lines[i], value: lines[i + 1], key: k });
      }
      if (viaLines.length > pairs.filter((x) => x.key).length) { pairs = viaLines; strategy = 'lines'; }
    }
    const seen = new Set();
    // same label twice is real (e.g. two "サイズ" rows for an image); drop exact duplicates only
    pairs = pairs.filter((x) => { const k = x.label.toLowerCase() + '\u0000' + x.value; if (seen.has(k)) return false; seen.add(k); return true; })
      .map(({ label, value, key }) => ({ label, value, key }));
    let title = '';
    const h = p.querySelector(D.hooks.title) || p.querySelector('[role="heading"],h1,h2');
    if (h) title = norm(h.textContent);
    return { pairs, strategy, title };
  }

  DXE.scrapeCore = { textOf, scrapeRoot, isUiButton };
})();
