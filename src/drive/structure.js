/* Drive Explorer — "Copy page structure": a sanitized DOM skeleton of the
   current Drive page for bug reports. Keeps tags, roles, aria-* NAMES,
   data-* NAMES, class names, jsname/jscontroller, rects, child counts.
   Text and aria-label values are kept only for UI chrome that matches our
   label tables or sits in tabs/buttons/menuitems/headings outside file items;
   everything else becomes a placeholder. File names / IDs / emails redacted. */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  const SEL = DXE.SEL;
  const norm = SEL.norm;

  const UI_ROLES = '[role="tab"],[role="button"],button,[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="heading"],h1,h2,h3,h4,[role="radio"],[role="link"],[role="option"]';

  function collectNames() {
    const names = new Set();
    for (const it of SEL.allItems()) {
      const a = it.querySelector('[data-dxe-part="name"]');
      const n = norm(a ? a.textContent : '') || norm((SEL.analyzeTile(it).name || {}).textContent);
      if (n && n.length > 1) names.add(n);
    }
    const crumbs = SEL.breadcrumbs && SEL.breadcrumbs();
    (crumbs || []).forEach((c) => { if (!c.root && c.label.length > 1) names.add(c.label); });
    const title = norm(document.title.replace(/\s+[-–]\s+Google (Drive|ドライブ)\s*$/i, ''));
    if (title && !SEL.keepUiText(title)) names.add(title);
    return [...names].sort((a, b) => b.length - a.length);
  }

  function makeRedactor(names) {
    return (t) => {
      let x = t;
      for (const n of names) if (x.includes(n)) x = x.split(n).join('‹name›');
      x = x.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '‹email›')
        .replace(/(Google (Account|アカウント)\s*[:：]).*/i, '$1 ‹redacted›')
        .replace(/[A-Za-z0-9_-]{20,}/g, '‹id›');
      return x;
    };
  }

  const SKIP_SILENT = 'script,style,link,meta,noscript';
  const nameOfFrame = (f) => {
    try { const u = new URL(f.getAttribute('src') || 'about:blank', location.href); return u.host + u.pathname.replace(/[A-Za-z0-9_-]{20,}/g, '‹id›').slice(0, 60); } catch (e) { return '?'; }
  };
  /* label-like text inside the details pane: the first of exactly two
     text-bearing siblings, short, no digits / @ / path separators */
  const looksLikeLabel = (el, t) => {
    if (SEL.labelKey(t)) return true;
    if (t.length > 30 || /[\d@\/\\:.]/.test(t)) return false;
    let box = el;
    for (let i = 0; i < 4 && box && box.parentElement; i++, box = box.parentElement) {
      const sib = [...box.parentElement.children].filter((k) => norm(k.textContent));
      if (sib.length === 2) {
        // never keep a person row (avatar / e-mail next to it)
        if (sib[0] !== box || /@/.test(sib[1].textContent) || box.parentElement.querySelector('img')) return false;
        return true;
      }
      if (sib.length > 2) return false;
    }
    return false;
  };

  function makeWalker({ red, push, state }) {
    const keepText = (el, t, c) => {
      if (!t) return '';
      if (c.inItem) return `‹text:${t.length}›`;
      if (SEL.keepUiText(t)) return JSON.stringify(red(t));
      if (c.inPanel) return looksLikeLabel(el, t) && !el.closest('[data-target="open"]') ? JSON.stringify(red(t)) : `‹text:${t.length}›`;
      if (c.strict && !el.closest('[role="toolbar"],[role="menu"],[role="tablist"]')) return `‹text:${t.length}›`;
      if (el.closest(UI_ROLES) && t.length <= 40) return JSON.stringify(red(t));
      return `‹text:${t.length}›`;
    };
    function describe(el, c) {
      const tag = el.tagName.toLowerCase();
      const parts = [tag];
      const role = el.getAttribute('role');
      if (role) parts.push(`role=${role}`);
      const aria = [], data = [];
      for (const a of el.attributes) {
        const n = a.name;
        if (n.startsWith('aria-')) {
          if (n === 'aria-label') {
            const v = norm(a.value);
            // pane: people (gridcells / avatars) and "<file name> を開く" links must never leak
            const panelHide = c.inPanel && !SEL.keepUiText(v) && !SEL.labelKey(v) &&
              !(role && /^(button|heading|region|listbox|grid|tablist|tab|complementary|main|status|toolbar|radiogroup|radio)$/.test(role) && v.length <= 60 && !/@/.test(v));
            const hide = c.inItem || el.hasAttribute('data-id') || panelHide ||
              (c.strict && !SEL.keepUiText(v) && !el.closest('[role="toolbar"],[role="menu"],[role="tablist"]') && !(role && /button|link|heading/.test(role) && SEL.keepUiText(v)));
            parts.push(hide ? `aria-label=‹${v.length}›` : `aria-label=${v.length <= 80 ? JSON.stringify(red(v)) : '‹' + v.length + '›'}`);
          } else if (/^aria-(selected|expanded|checked|pressed|haspopup|hidden|disabled|level|current|orientation|modal|live)$/.test(n)) aria.push(`${n}=${a.value}`);
          else aria.push(n);
        } else if (n.startsWith('data-')) {
          if (n === 'data-target' || n === 'data-view-type' || n === 'data-display-mode' || n.startsWith('data-dxe')) data.push(`${n}=${a.value.slice(0, 20)}`);
          else data.push(n);
        } else if (n === 'jsname' || n === 'jscontroller' || n === 'jsmodel') parts.push(`${n}=${a.value.slice(0, 16)}`);
        else if (n === 'jsaction') parts.push('jsaction=[' + a.value.split(';').map((x) => norm(x).split(':')[0]).filter(Boolean).slice(0, 8).join(',') + ']');
        else if (n === 'id') parts.push(`id=${red(a.value).slice(0, 30)}`);
        else if (n === 'tabindex' || n === 'draggable' || n === 'type') parts.push(`${n}=${a.value}`);
        else if (n === 'src' || n === 'href') { try { parts.push(`${n}=‹${new URL(a.value, location.href).host}›`); } catch (e) { parts.push(`${n}=‹?›`); } }
        else if (n === 'alt') parts.push(c.inItem || ((c.inPanel || c.strict) && !SEL.keepUiText(norm(a.value))) ? `alt=‹${a.value.length}›` : `alt=${JSON.stringify(red(a.value).slice(0, 40))}`); // avatars carry people's names
      }
      if (aria.length) parts.push('aria[' + aria.join(' ') + ']');
      if (data.length) parts.push('data[' + data.join(' ') + ']');
      const cls = [...el.classList].slice(0, 6);
      if (cls.length) parts.push('.' + cls.join('.'));
      const r = el.getBoundingClientRect();
      parts.push(`@${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)}`);
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => norm(n.nodeValue)).filter(Boolean).join(' ');
      if (own) parts.push('text=' + keepText(el, own, c));
      if (el.children.length) parts.push(`#${el.children.length}`);
      return { line: parts.join(' '), r };
    }
    function walk(el, depth, c) {
      if (state.truncated) return;
      const ind = '  '.repeat(depth);
      if (el.matches(SKIP_SILENT)) { state.skipped++; return; }
      if (el.tagName === 'TEMPLATE') { push(ind + `template (content ${el.content ? el.content.querySelectorAll('*').length : 0} nodes)`); return; }
      if (el.tagName === 'IFRAME') {
        let doc = null; try { doc = el.contentDocument; } catch (e) { doc = null; }
        const r = el.getBoundingClientRect();
        push(ind + `iframe src=‹${nameOfFrame(el)}› sameOrigin=${!!doc} ${[...el.classList].length ? '.' + [...el.classList].slice(0, 4).join('.') + ' ' : ''}@${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)}`);
        state.iframes++;
        if (doc && doc.body && depth < c.maxDepth) walk(doc.body, depth + 1, c);
        return;
      }
      if (el.id === 'dxe-menu-host' || el.id === 'dxe-props-host') { push(ind + `[Drive Explorer UI: ${el.id}]`); return; }
      state.nodes++;
      const isItem = el.hasAttribute('data-id');
      const cc = isItem && !c.inItem ? { ...c, inItem: true } : c;
      const { line, r } = describe(el, cc);
      if (!push(ind + line)) return;
      if (el.namespaceURI === 'http://www.w3.org/2000/svg') return;
      if (r.width === 0 && r.height === 0 && el.children.length && !c.showHidden) { push(ind + '  ' + `… hidden subtree (${el.querySelectorAll('*').length} nodes)`); return; }
      if (depth - (c.base || 0) >= c.maxDepth) { if (el.children.length) push(ind + '  ' + `… depth limit (${el.querySelectorAll('*').length} nodes)`); return; }
      const kids = [...el.children];
      let itemsShown = 0, itemsSkipped = 0, sameRun = 0, prevSig = '';
      for (let i = 0; i < kids.length; i++) {
        const k = kids[i];
        if (k.hasAttribute('data-id')) {
          if (itemsShown >= (c.items || 2)) { itemsSkipped++; continue; }
          itemsShown++;
        }
        const sig = k.tagName + '|' + (k.getAttribute('role') || '') + '|' + k.className;
        sameRun = sig === prevSig ? sameRun + 1 : 0;
        prevSig = sig;
        if (sameRun >= 12 && !k.hasAttribute('data-id')) {
          let n = 0; while (i < kids.length && (kids[i].tagName + '|' + (kids[i].getAttribute('role') || '') + '|' + kids[i].className) === sig) { n++; i++; }
          i--;
          push(ind + '  ' + `… ${n} more similar <${k.tagName.toLowerCase()}> siblings`);
          continue;
        }
        walk(k, depth + 1, cc);
      }
      if (itemsSkipped) push(ind + '  ' + `… ${itemsSkipped} more file items (same structure)`);
    }
    return { walk, describe };
  }

  /** header block(s) above role=main in the same column (real Drive: .S630me) */
  function headerBlocks(main) {
    const out = [];
    if (!main || main === document.body) return out;
    const mr = main.getBoundingClientRect();
    for (let a = main, i = 0; a && a !== document.body && i < 4; a = a.parentElement, i++) {
      for (let s = a.previousElementSibling; s; s = s.previousElementSibling) {
        if (SEL.isOurs(s) || s.matches('[role="banner"],[role="navigation"],nav')) continue;
        const r = s.getBoundingClientRect();
        if (r.height > 0 && r.bottom <= mr.top + 4 && r.width >= mr.width * 0.6 && r.left >= mr.left - 12 && !out.some((o) => o.contains(s))) out.push(s);
      }
      if (out.length) break;
    }
    return out;
  }

  /** small sanitized tree of one element (used for native menu snapshots) */
  function tree(el, { maxDepth = 14, maxLines = 200 } = {}) {
    const out = [];
    const state = { truncated: false, nodes: 0, skipped: 0, iframes: 0 };
    const push = (s) => { if (out.length >= maxLines) { state.truncated = true; return false; } out.push(s); return true; };
    const { walk } = makeWalker({ red: makeRedactor(collectNames()), push, state });
    walk(el, 0, { maxDepth, showHidden: false });
    return out.join('\n');
  }

  function dump({ maxDepth = 12, maxBytes = 260000 } = {}) {
    const names = collectNames();
    const red = makeRedactor(names);
    const vw = innerWidth, vh = innerHeight;
    const out = [];
    const state = { truncated: false, nodes: 0, skipped: 0, iframes: 0 };
    let bytes = 0;
    const push = (s) => { if (bytes > maxBytes) { state.truncated = true; return false; } out.push(s); bytes += s.length + 1; return true; };
    const { walk, describe } = makeWalker({ red, push, state });
    const main = SEL.scopeEl();

    const crumbs = SEL.breadcrumbs && SEL.breadcrumbs();
    push(`# Drive Explorer ${DXE.VERSION} page structure — selectors ${SEL.revision}`);
    push(`# ${new Date().toISOString()}  ${navigator.userAgent}`);
    push(`# page ${red(location.pathname)}  viewport ${vw}x${vh}  lang=${document.documentElement.lang}  theme=${DXE.theme && DXE.theme()}  display-mode=${['standalone', 'window-controls-overlay', 'minimal-ui', 'browser'].find((m) => matchMedia(`(display-mode: ${m})`).matches)}`);
    push(`# items=${SEL.allItems().length} selected=${SEL.selectedItems().length} gridTiles=${(DXE.tileStats || {}).tiles} listRows=${(DXE.tileStats || {}).listRows} detailsTagged=${!!document.querySelector('[data-dxe-details]')} (${(DXE.detailsStats || {}).strategy}) breadcrumbs=${crumbs ? crumbs.map((c) => c.root ? c.label : '‹name›').join(' > ') + ' (' + SEL.lastBreadcrumbStrategy + ')' : 'not found'}`);
    // detection summary
    try {
      const st = DXE.settings || {};
      push(`# settings: ${Object.keys(st).filter((k) => typeof st[k] === 'boolean').map((k) => k + '=' + (st[k] ? 1 : 0)).join(' ')} openFilesIn=${st.openFilesIn}`);
      const lb = SEL.findLayoutButton(SEL.NAV.listLayout), gb = SEL.findLayoutButton(SEL.NAV.gridLayout);
      const lab = (b) => b ? JSON.stringify(red(norm(b.getAttribute('aria-label') || b.textContent))) + (b.getAttribute('aria-checked') || b.getAttribute('aria-pressed') ? '(' + (b.getAttribute('aria-checked') || b.getAttribute('aria-pressed')) + ')' : '') : 'none';
      push(`# layout buttons: list=${lab(lb)} grid=${lab(gb)}  toolbar=${JSON.stringify(DXE.toolbarStats || {})}`);
      const tb = [...document.querySelectorAll('[role="toolbar"]')].filter((t) => !SEL.isOurs(t) && SEL.isShown(t));
      tb.forEach((t, i) => {
        const bl = [...t.querySelectorAll('[role="button"],button,[role="menuitem"]')].filter((b) => SEL.isShown(b)).map((b) => red(norm(b.getAttribute('aria-label') || b.getAttribute('data-tooltip') || b.textContent)).slice(0, 40) || '∅');
        push(`# native toolbar ${i + 1} (${[...t.classList].slice(0, 3).join('.')}): ${bl.length ? bl.map((x) => JSON.stringify(x)).join(', ') : '(no visible buttons)'}`);
      });
      const sg = document.querySelectorAll('[data-dxe-sugg]');
      push(`# suggestions tagged: ${sg.length}${[...sg].slice(0, 4).map((e) => ' ' + describe(e, { inItem: true }).line.slice(0, 120)).join(' |')}`);
      const p = document.querySelector('[data-dxe-details]');
      if (p) {
        const h = SEL.detailsHeader(p);
        const fr = DXE.details && DXE.details.framesOf ? DXE.details.framesOf(p) : [];
        push(`# details pane: open(Drive layout)=${SEL.detailsPanelOpen(p)} headerType=${JSON.stringify(h.type)} nameShown=${!!h.name} iframes=${fr.length}${fr.map((f) => ' [' + f.src + (f.doc ? ' same-origin' : ' cross-origin') + ']').join('')} lastScrape=${JSON.stringify((DXE.detailsStats || {}).lastScrape)}`);
      }
    } catch (e) { push('# summary error: ' + e); }
    push(`# legend: tag role=… aria-label=… aria[names] data[names] .classes @x,y,wxh text=… #children`);
    push('');

    // 1) details pane, deep, label texts kept / values stripped
    const tagged = document.querySelector('[data-dxe-details]') || SEL.findDetailsPanel();
    push('## details pane (deep; label texts kept, values stripped)');
    if (tagged) walk(tagged, 0, { maxDepth: 40, inPanel: true, showHidden: true }); else push('(none found)');
    push('');

    // 2) native menus: visible now + the last ones we opened invisibly
    const menus = SEL.visibleMenus().filter((m) => !SEL.isOurs(m));
    push(`## visible native menus (${menus.length})`);
    menus.forEach((m) => walk(m, 0, { maxDepth: 25 }));
    const snaps = (DXE.native && DXE.native.menuSnaps) || [];
    push(`## last native menus opened by Drive Explorer (${snaps.length})`);
    snaps.forEach((sn) => {
      push(`# ${sn.at} via ${sn.via} found=${sn.found}${sn.items ? ' items=' + sn.items.map((i) => JSON.stringify(red(i.label)) + (i.popup ? '▸' : '') + (i.disabled ? '(disabled)' : '')).join(', ') : ''}`);
      if (sn.tree) sn.tree.split('\n').forEach((l) => push('  ' + l));
    });
    push('');

    // 3) header above the list (breadcrumbs, layout switch, selection toolbar)
    const hbs = headerBlocks(main);
    push(`## header above role=main (${hbs.length}; deep, unknown texts stripped)`);
    hbs.forEach((h) => walk(h, 0, { maxDepth: 30, strict: true }));
    push('');

    // 4) path from main to the first file item + first items deep
    const items = SEL.allItems();
    push(`## path from role=main to the first file item (${items.length} items)`);
    if (items[0] && main && main.contains(items[0])) {
      const chain = [];
      for (let a = items[0].parentElement; a && a !== main.parentElement; a = a.parentElement) chain.unshift(a);
      chain.forEach((a, i) => push('  '.repeat(i) + describe(a, {}).line));
      push('## first file items (deep)');
      items.slice(0, 3).forEach((it) => walk(it, 0, { maxDepth: 25, inItem: true }));
      const sel = SEL.selectedItems()[0];
      if (sel && items.indexOf(sel) > 2) { push('## selected item (deep)'); walk(sel, 0, { maxDepth: 25, inItem: true }); }
    } else push('(no items)');
    push('');

    // 5) other right-side columns
    const side = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (side.size >= 3) break;
      const r = el.getBoundingClientRect();
      if (r.left >= vw * 0.55 && r.width >= 200 && r.width <= 560 && r.height >= vh * 0.5 && !SEL.isOurs(el) && !(tagged && (tagged.contains(el) || el.contains(tagged))) &&
          !el.querySelector('[role="main"],[role="grid"] [data-id]') && ![...side].some((s) => s.contains(el) || el.contains(s))) {
        if (!el.parentElement || el.parentElement.getBoundingClientRect().width > 560) side.add(el);
      }
    }
    push(`## other right-side column candidates (${side.size})`);
    side.forEach((el) => walk(el, 0, { maxDepth }));
    push('');
    push('## document body');
    walk(document.body, 0, { maxDepth });
    if (state.truncated) out.push(`# … truncated at ${maxBytes} bytes`);
    out.push(`# nodes=${state.nodes} iframes=${state.iframes} skippedScriptStyle=${state.skipped} bytes≈${bytes} redactedNames=${names.length}`);
    return out.join('\n');
  }

  DXE.structure = { dump, tree };
})();
