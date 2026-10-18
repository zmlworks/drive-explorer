/* Drive Explorer — performs Drive's REAL actions.
   Strategy per action (see SEL.ACTIONS):
     1. open Drive's native context menu invisibly (synthetic contextmenu on the
        item, or its ⋮ button as fallback), walk submenus by label, click item;
     2. click the matching button in Drive's selection action bar;
     3. dispatch Drive's keyboard shortcut;
     4. custom fallback (URL building, clipboard).                           */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  const SEL = DXE.SEL;
  const HIDE = 'dxe-native-hidden';

  let bypass = false;
  const lastResults = [];
  const record = (r) => { lastResults.unshift({ t: Date.now(), ...r }); lastResults.length = Math.min(lastResults.length, 15); };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, timeout = 700, step = 25) => {
    const end = performance.now() + timeout;
    do {
      const v = fn();
      if (v) return v;
      await sleep(step);
    } while (performance.now() < end);
    return null;
  };

  const center = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height / 2, 40)) };
  };

  const mouse = (el, type, x, y, extra = {}) => {
    const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
    const ev = new Ctor(type, {
      bubbles: !['mouseenter', 'mouseleave', 'pointerenter', 'pointerleave'].includes(type),
      cancelable: true, composed: true, view: window, clientX: x, clientY: y, screenX: x, screenY: y,
      pointerId: 1, pointerType: 'mouse', isPrimary: true, ...extra,
    });
    return el.dispatchEvent(ev);
  };

  const key = (el, k, type = 'keydown') => {
    const ev = new KeyboardEvent(type, {
      key: k.key, code: k.code, bubbles: true, cancelable: true, composed: true, view: window,
      shiftKey: !!k.shiftKey, ctrlKey: !!k.ctrlKey, altKey: !!k.altKey, metaKey: !!k.metaKey,
    });
    // Closure-based apps still read keyCode/which.
    for (const p of ['keyCode', 'which']) {
      try { Object.defineProperty(ev, p, { get: () => k.keyCode }); } catch (e) { /* ignore */ }
    }
    return el.dispatchEvent(ev);
  };
  const pressKey = (el, k) => { key(el, k, 'keydown'); if (k.key.length === 1) key(el, k, 'keypress'); key(el, k, 'keyup'); };

  /** Full pointer sequence on an element (menu item / button). Stops after
      mouseup if that already closed the menu, to avoid double activation. */
  const activate = (el) => {
    const { x, y } = center(el);
    const menu = el.closest(SEL.menu);
    mouse(el, 'pointerover', x, y); mouse(el, 'mouseover', x, y); mouse(el, 'mouseenter', x, y);
    mouse(el, 'mousemove', x, y);
    mouse(el, 'pointerdown', x, y, { button: 0, buttons: 1 }); mouse(el, 'mousedown', x, y, { button: 0, buttons: 1 });
    mouse(el, 'pointerup', x, y, { button: 0 }); mouse(el, 'mouseup', x, y, { button: 0 });
    if (menu && (!el.isConnected || !SEL.isShown(menu))) return 'mouseup';
    mouse(el, 'click', x, y, { button: 0 });
    return 'click';
  };

  const hide = (on) => document.documentElement.classList.toggle(HIDE, on);
  let unhideTimer = 0;
  const unhideSoon = (ms = 250) => { clearTimeout(unhideTimer); unhideTimer = setTimeout(() => hide(false), ms); };

  const closeMenus = async () => {
    for (let i = 0; i < 3 && SEL.visibleMenus().length; i++) {
      const m = SEL.visibleMenus().pop();
      pressKey(m, { key: 'Escape', code: 'Escape', keyCode: 27 });
      pressKey(document.activeElement || document.body, { key: 'Escape', code: 'Escape', keyCode: 27 });
      await sleep(40);
    }
  };

  /** Open Drive's native context menu for ctx (hidden unless visible=true). */
  async function openNativeMenu(ctx, { visible = false } = {}) {
    const before = new Set(SEL.visibleMenus());
    if (!visible) { clearTimeout(unhideTimer); hide(true); }
    const target = ctx.target && ctx.target.isConnected && ctx.item.contains(ctx.target) ? ctx.target : ctx.item;
    const p = ctx.x != null ? { x: ctx.x, y: ctx.y } : center(ctx.item);
    const fresh = () => SEL.visibleMenus().find((m) => !before.has(m) && SEL.menuItems(m).length);
    bypass = true;
    try {
      mouse(target, 'contextmenu', p.x, p.y, { button: 2, buttons: 2 });
    } finally { bypass = false; }
    let menu = await waitFor(fresh, 600);
    let via = 'contextmenu';
    if (!menu) {
      const more = SEL.findMoreButton(ctx.item);
      if (more) {
        activate(more);
        menu = await waitFor(fresh, 700);
        via = 'more-button';
      }
    }
    DXE.log('native menu', menu ? 'opened via ' + via : 'NOT found', menu ? SEL.menuItems(menu).map((i) => SEL.labelCandidates(i)[0]) : '');
    if (!menu && !visible) unhideSoon(0);
    return menu;
  }

  const findIn = (menu, re) => SEL.menuItems(menu).find((it) => SEL.matchesLabel(it, re));

  async function openSubmenu(item) {
    const before = new Set(SEL.visibleMenus());
    const fresh = () => SEL.visibleMenus().find((m) => !before.has(m) && SEL.menuItems(m).length);
    const { x, y } = center(item);
    mouse(item, 'pointerover', x, y); mouse(item, 'mouseover', x, y); mouse(item, 'mouseenter', x, y); mouse(item, 'mousemove', x, y);
    let sub = await waitFor(fresh, 450);
    if (!sub) { pressKey(item, { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }); sub = await waitFor(fresh, 300); }
    if (!sub) { activate(item); sub = await waitFor(fresh, 450); }
    return sub;
  }

  /** Walk one label path starting at `menu`. */
  async function runPath(menu, path) {
    let current = menu;
    for (let i = 0; i < path.length; i++) {
      const last = i === path.length - 1;
      const it = findIn(current, path[i]);
      if (!it) return { ok: false, why: 'no item ' + path[i] };
      if (SEL.isDisabled(it)) return { ok: false, why: 'disabled ' + path[i], disabled: true };
      if (last) {
        if (SEL.hasSubmenu(it)) return { ok: false, why: 'final item is a submenu ' + path[i] };
        const how = activate(it);
        return { ok: true, how, label: SEL.labelCandidates(it)[0] };
      }
      if (!SEL.hasSubmenu(it)) return { ok: false, why: 'not a submenu ' + path[i] };
      const sub = await openSubmenu(it);
      if (!sub) return { ok: false, why: 'submenu did not open ' + path[i] };
      current = sub;
    }
    return { ok: false, why: 'empty path' };
  }

  /* ---------- custom actions ---------- */
  const targets = (ctx) => {
    const sel = SEL.selectedItems();
    return sel.length && sel.includes(ctx.item) ? sel : [ctx.item];
  };

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through */ }
    const ta = document.createElement('textarea');
    ta.setAttribute('data-dxe-ui', '');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.documentElement.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  const CUSTOM = {
    async open(ctx) {
      const before = location.href;
      const dialogs = document.querySelectorAll('[role="dialog"]').length;
      const el = ctx.item.querySelector('[data-dxe-part="thumb"],[data-dxe-part="name"]') || ctx.item;
      const { x, y } = center(el);
      for (let i = 1; i <= 2; i++) {
        mouse(el, 'mousedown', x, y, { button: 0, buttons: 1, detail: i });
        mouse(el, 'mouseup', x, y, { button: 0, detail: i });
        mouse(el, 'click', x, y, { button: 0, detail: i });
      }
      mouse(el, 'dblclick', x, y, { button: 0, detail: 2 });
      // Not verifiable in general (Docs open in a new tab, files in an overlay),
      // and a second attempt (Enter) could open twice — so dblclick only.
      const changed = await waitFor(() => location.href !== before || document.querySelectorAll('[role="dialog"]').length > dialogs, 600);
      return { ok: true, how: 'dblclick', verified: !!changed };
    },
    async openNewTab(ctx) {
      const list = targets(ctx).slice(0, 10);
      list.forEach((it) => window.open(SEL.openUrl(it), '_blank', 'noopener'));
      return { ok: true, how: 'window.open x' + list.length };
    },
    async copyLinkFallback(ctx) {
      const links = targets(ctx).map(SEL.shareUrl).join('\n');
      const ok = await copyText(links);
      if (ok && DXE.menu) DXE.menu.toast(DXE.menu.t('linkCopied'));
      return { ok, how: 'clipboard (constructed link)' };
    },
    async driveMenu(ctx) {
      const m = await openNativeMenu(ctx, { visible: true });
      return { ok: !!m, how: 'native menu shown' };
    },
  };

  /** Perform an action id from SEL.ACTIONS for ctx = {item, target, x, y}. */
  async function perform(id, ctx) {
    const spec = SEL.ACTIONS[id];
    if (!spec) return false;
    const log = { action: id, steps: [] };
    try {
      if (id === 'driveMenu' || id === 'openNewTab') {
        const r = await CUSTOM[spec.custom](ctx);
        log.steps.push(r);
        return (log.ok = r.ok);
      }
      if (id === 'open') {
        const r = await CUSTOM.open(ctx);
        log.steps.push(r);
        return (log.ok = r.ok);
      }
      // 1. native context menu
      if (spec.paths) {
        const menu = await openNativeMenu(ctx);
        if (menu) {
          for (const path of spec.paths) {
            const r = await runPath(menu, path);
            log.steps.push({ via: 'menu', ...r, why: r.why && String(r.why) });
            if (r.ok) { await sleep(60); await closeMenus(); unhideSoon(); return (log.ok = true); }
            if (r.disabled) break;
            // a failed submenu attempt may have left submenus open
          }
          await closeMenus();
        } else log.steps.push({ via: 'menu', ok: false, why: 'native menu did not open' });
        unhideSoon(0);
      }
      // 2. selection toolbar
      if (spec.toolbar) {
        const b = SEL.findToolbarButton(spec.toolbar);
        log.steps.push({ via: 'toolbar', ok: !!b });
        if (b) { activate(b); return (log.ok = true); }
      }
      // 3. custom fallback (before keys for copy link: keys would not copy)
      if (spec.custom && CUSTOM[spec.custom] && id !== 'open') {
        const r = await CUSTOM[spec.custom](ctx);
        log.steps.push({ via: 'custom', ...r });
        if (r.ok) return (log.ok = true);
      }
      // 4. keyboard shortcut
      if (spec.keys) {
        const el = ctx.item.contains(document.activeElement) ? document.activeElement : ctx.item;
        if (el !== document.activeElement && el.focus) el.focus({ preventScroll: true });
        spec.keys.forEach((k) => pressKey(document.activeElement || el, k));
        log.steps.push({ via: 'keys', ok: true, keys: spec.keys.map((k) => k.key) });
        return (log.ok = true); // cannot verify
      }
      return (log.ok = false);
    } finally {
      record(log);
      DXE.log('action', id, log.ok ? 'OK' : 'FAILED', log.steps);
    }
  }

  DXE.native = {
    isBypassing: () => bypass,
    perform,
    openNativeMenu,
    lastResults,
    pressKey,
    activate,
  };
})();
