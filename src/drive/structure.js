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
  const SKIP = 'script,style,link,meta,noscript,template,iframe';

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

  function dump({ maxDepth = 12, maxBytes = 200000 } = {}) {
    const names = collectNames();
    const red = makeRedactor(names);
    const vw = innerWidth, vh = innerHeight;
    const out = [];
    let bytes = 0, truncated = false, nodes = 0;
    const push = (s) => { if (bytes > maxBytes) { truncated = true; return false; } out.push(s); bytes += s.length + 1; return true; };

    const keepText = (el, t, inItem) => {
      if (!t) return '';
      if (inItem) return `‹text:${t.length}›`;
      if (SEL.keepUiText(t) || (el.closest(UI_ROLES) && t.length <= 40)) return JSON.stringify(red(t));
      return `‹text:${t.length}›`;
    };

    function describe(el, inItem) {
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
            parts.push(inItem || el.hasAttribute('data-id') ? `aria-label=‹${v.length}›` : `aria-label=${v.length <= 80 ? JSON.stringify(red(v)) : '‹' + v.length + '›'}`);
          } else if (/^aria-(selected|expanded|checked|haspopup|hidden|disabled|level|current|orientation|modal|live)$/.test(n)) aria.push(`${n}=${a.value}`);
          else aria.push(n);
        } else if (n.startsWith('data-')) {
          if (n === 'data-target' || n.startsWith('data-dxe')) data.push(`${n}=${a.value.slice(0, 20)}`);
          else data.push(n);
        } else if (n === 'jsname' || n === 'jscontroller' || n === 'jsmodel') parts.push(`${n}=${a.value.slice(0, 16)}`);
        else if (n === 'jsaction') parts.push('jsaction=[' + a.value.split(';').map((x) => norm(x).split(':')[0]).filter(Boolean).slice(0, 8).join(',') + ']');
        else if (n === 'id') parts.push(`id=${red(a.value).slice(0, 30)}`);
        else if (n === 'tabindex' || n === 'draggable' || n === 'type') parts.push(`${n}=${a.value}`);
        else if (n === 'src' || n === 'href') { try { parts.push(`${n}=‹${new URL(a.value, location.href).host}›`); } catch (e) { parts.push(`${n}=‹?›`); } }
        else if (n === 'alt') parts.push(inItem ? `alt=‹${a.value.length}›` : `alt=${JSON.stringify(red(a.value).slice(0, 40))}`);
      }
      if (aria.length) parts.push('aria[' + aria.join(' ') + ']');
      if (data.length) parts.push('data[' + data.join(' ') + ']');
      const cls = [...el.classList].slice(0, 6);
      if (cls.length) parts.push('.' + cls.join('.'));
      const r = el.getBoundingClientRect();
      parts.push(`@${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)}`);
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => norm(n.nodeValue)).filter(Boolean).join(' ');
      if (own) parts.push('text=' + keepText(el, own, inItem));
      if (el.children.length) parts.push(`#${el.children.length}`);
      return { line: parts.join(' '), r };
    }

    function walk(el, depth, inItem) {
      if (truncated || el.matches(SKIP)) return;
      if (el.id === 'dxe-menu-host' || el.id === 'dxe-props-host') { push('  '.repeat(depth) + `[Drive Explorer UI: ${el.id}]`); return; }
      nodes++;
      const isItem = el.hasAttribute('data-id');
      const { line, r } = describe(el, inItem || isItem);
      if (!push('  '.repeat(depth) + line)) return;
      if (el.tagName === 'svg' || el.tagName === 'SVG' || el.namespaceURI === 'http://www.w3.org/2000/svg') return;
      if (r.width === 0 && r.height === 0 && el.children.length) { push('  '.repeat(depth + 1) + `… hidden subtree (${el.querySelectorAll('*').length} nodes)`); return; }
      if (depth >= maxDepth) { if (el.children.length) push('  '.repeat(depth + 1) + `… depth limit (${el.querySelectorAll('*').length} nodes)`); return; }
      const kids = [...el.children];
      let itemsShown = 0, itemsSkipped = 0, sameRun = 0, prevSig = '';
      for (let i = 0; i < kids.length; i++) {
        const k = kids[i];
        if (k.hasAttribute('data-id')) {
          if (itemsShown >= 2) { itemsSkipped++; continue; }
          itemsShown++;
        }
        const sig = k.tagName + '|' + (k.getAttribute('role') || '') + '|' + k.className;
        sameRun = sig === prevSig ? sameRun + 1 : 0;
        prevSig = sig;
        if (sameRun >= 12 && !k.hasAttribute('data-id')) {
          let n = 0; while (i < kids.length && (kids[i].tagName + '|' + (kids[i].getAttribute('role') || '') + '|' + kids[i].className) === sig) { n++; i++; }
          i--;
          push('  '.repeat(depth + 1) + `… ${n} more similar <${k.tagName.toLowerCase()}> siblings`);
          continue;
        }
        walk(k, depth + 1, inItem || isItem);
      }
      if (itemsSkipped) push('  '.repeat(depth + 1) + `… ${itemsSkipped} more file items (same structure)`);
    }

    const crumbs = SEL.breadcrumbs && SEL.breadcrumbs();
    push(`# Drive Explorer ${DXE.VERSION} page structure — selectors ${SEL.revision}`);
    push(`# ${new Date().toISOString()}  ${navigator.userAgent}`);
    push(`# page ${red(location.pathname)}  viewport ${vw}x${vh}  lang=${document.documentElement.lang}  theme=${DXE.theme && DXE.theme()}  display-mode=${['standalone', 'window-controls-overlay', 'minimal-ui', 'browser'].find((m) => matchMedia(`(display-mode: ${m})`).matches)}`);
    push(`# items=${SEL.allItems().length} selected=${SEL.selectedItems().length} gridTiles=${(DXE.tileStats || {}).tiles} detailsTagged=${!!document.querySelector('[data-dxe-details]')} (${(DXE.detailsStats || {}).strategy}) breadcrumbs=${crumbs ? crumbs.map((c) => c.root ? c.label : '‹name›').join(' > ') : 'not found'}`);
    push(`# legend: tag role=… aria-label=… aria[names] data[names] .classes @x,y,wxh text=… #children`);
    push('');
    // right-side panel(s) first so they survive the size limit
    const side = new Set();
    const tagged = document.querySelector('[data-dxe-details]');
    if (tagged) side.add(tagged);
    for (const el of document.querySelectorAll('body *')) {
      if (side.size >= 3) break;
      const r = el.getBoundingClientRect();
      if (r.left >= vw * 0.55 && r.width >= 200 && r.width <= 560 && r.height >= vh * 0.5 && !SEL.isOurs(el) &&
          !el.querySelector('[role="main"],[role="grid"] [data-id]') && ![...side].some((s) => s.contains(el) || el.contains(s))) {
        if (!el.parentElement || el.parentElement.getBoundingClientRect().width > 560) side.add(el);
      }
    }
    push(`## right-side column candidates (${side.size})`);
    side.forEach((el) => walk(el, 0, false));
    push('');
    push('## document body');
    walk(document.body, 0, false);
    if (truncated) out.push(`# … truncated at ${maxBytes} bytes`);
    out.push(`# nodes=${nodes} bytes≈${bytes} redactedNames=${names.length}`);
    return out.join('\n');
  }

  DXE.structure = { dump };
})();
