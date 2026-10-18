/* Drive Explorer — the Windows 11 style context menu (UI only).
   Rendered in a shadow root so Drive's CSS can't touch it (and vice versa).
   Items call DXE.native.perform(), which drives Drive's real actions.       */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  const SEL = DXE.SEL;

  const STR = {
    en: {
      open: 'Open', openNewTab: 'Open in new tab', download: 'Download', rename: 'Rename',
      copyLink: 'Copy link', share: 'Share', move: 'Move', addShortcut: 'Add shortcut',
      star: 'Add / remove star', makeCopy: 'Make a copy', info: 'File information', delete: 'Delete',
      driveMenu: 'Show Drive menu', driveMenuHint: '', properties: 'Properties',
      linkCopied: 'Link copied', failed: 'Drive Explorer could not run “{0}” — try “Show Drive menu”.',
      items: '{0} items',
    },
    ja: {
      open: '開く', openNewTab: '新しいタブで開く', download: 'ダウンロード', rename: '名前の変更',
      copyLink: 'リンクをコピー', share: '共有', move: '移動', addShortcut: 'ショートカットを追加',
      star: 'スターを付ける / 外す', makeCopy: 'コピーを作成', info: 'ファイル情報', delete: '削除',
      driveMenu: 'ドライブのメニューを表示', driveMenuHint: '', properties: 'プロパティ',
      linkCopied: 'リンクをコピーしました', failed: '「{0}」を実行できませんでした。「ドライブのメニューを表示」をお試しください。',
      items: '{0} 個の項目',
    },
  };
  const t = (k, ...a) => (STR[SEL.uiLang()][k] || STR.en[k] || k).replace(/\{(\d)\}/g, (_, i) => a[i]);

  /* 16px line icons (Fluent-ish), stroke = currentColor */
  const P = {
    open: '<path d="M2 4.5V12a1 1 0 0 0 1 1h9.2a1 1 0 0 0 .95-.68L14.5 8H5.3a1 1 0 0 0-.95.68L2.6 13"/><path d="M2 4.5V3.5a1 1 0 0 1 1-1h2.6l1.5 1.5H12a1 1 0 0 1 1 1V8"/>',
    openNewTab: '<path d="M9.5 2.5h4v4"/><path d="M13.5 2.5 7.5 8.5"/><path d="M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/>',
    download: '<path d="M8 2.5v8"/><path d="M4.5 7 8 10.5 11.5 7"/><path d="M3 13.5h10"/>',
    rename: '<path d="M2.5 13.5h2.2l7.6-7.6a1.56 1.56 0 0 0-2.2-2.2L2.5 11.3z"/><path d="M9.2 4.6l2.2 2.2"/>',
    copyLink: '<path d="M6.5 9.5l3-3"/><path d="M7.2 4.8l.9-.9a2.6 2.6 0 0 1 3.7 3.7l-.9.9"/><path d="M8.8 11.2l-.9.9a2.6 2.6 0 0 1-3.7-3.7l.9-.9"/>',
    share: '<path d="M9 2.5 14 7l-5 4.5V9C5.6 9 3.6 10.3 2 13c.4-4 2.6-6.6 7-6.9z"/>',
    move: '<path d="M2 4V3.5a1 1 0 0 1 1-1h2.6l1.5 1.5H13a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z"/><path d="M6 9h4.5"/><path d="M9 7.2 10.8 9 9 10.8"/>',
    addShortcut: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M6 10l4-4"/><path d="M6.5 6H10v3.5"/>',
    star: '<path d="M8 2.2l1.75 3.6 3.95.55-2.86 2.8.68 3.95L8 11.25 4.48 13.1l.68-3.95L2.3 6.35l3.95-.55z"/>',
    makeCopy: '<rect x="5.5" y="5" width="8" height="9" rx="1.2"/><path d="M3.5 11V3.2c0-.4.3-.7.7-.7H10"/>',
    info: '<circle cx="8" cy="8" r="6"/><path d="M8 7.2v4"/><path d="M8 4.9v.1" stroke-width="1.6"/>',
    delete: '<path d="M2.5 4.5h11"/><path d="M6.2 4.5V3.2c0-.4.3-.7.7-.7h2.2c.4 0 .7.3.7.7v1.3"/><path d="M4 4.5l.7 8.4c.05.6.5 1.1 1.1 1.1h4.4c.6 0 1.05-.5 1.1-1.1l.7-8.4"/><path d="M6.8 7v4.5M9.2 7v4.5"/>',
    properties: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M5 5.5h6M5 8h6M5 10.5h3.5"/>',
    driveMenu: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M5.5 8h.1M8 8h.1M10.5 8h.1" stroke-width="1.8"/>',
  };
  const icon = (id) => `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[id] || ''}</svg>`;

  const GROUPS = [
    [['open', 'Enter'], ['openNewTab'], ['download']],
    [['rename', 'F2'], ['copyLink'], ['share', 'Ctrl+Alt+A']],
    [['move', 'Ctrl+Alt+M'], ['addShortcut'], ['star'], ['makeCopy']],
    [['info']],
    [['delete', 'Del']],
    [['driveMenu', '§']],
    [['properties', 'Alt+Enter']],
  ];

  const CSS = `
  :host { all: initial; }
  .menu {
    --bg: rgba(249,249,249,0.97); --fg: #1b1b1b; --hint: #5f5f5f; --hover: rgba(0,0,0,0.05);
    --press: rgba(0,0,0,0.035); --sep: rgba(0,0,0,0.08); --border: rgba(0,0,0,0.09);
    --shadow: 0 8px 16px rgba(0,0,0,0.14), 0 0 2px rgba(0,0,0,0.06); --dis: rgba(0,0,0,0.36); --accent: #005fb8;
    position: fixed; z-index: 2147483646; min-width: 248px; max-width: 360px; box-sizing: border-box;
    padding: 4px; border-radius: 8px; background: var(--bg); color: var(--fg);
    border: 1px solid var(--border); box-shadow: var(--shadow);
    -webkit-backdrop-filter: blur(30px) saturate(1.25); backdrop-filter: blur(30px) saturate(1.25);
    font: 400 13.5px/1.2 "Segoe UI Variable Text","Segoe UI","Yu Gothic UI","Meiryo UI",-apple-system,"Hiragino Sans","Noto Sans JP","Noto Sans CJK JP",system-ui,sans-serif;
    user-select: none; outline: none; opacity: 0; transform: translateY(-6px);
    transition: opacity 110ms cubic-bezier(0,0,0,1), transform 160ms cubic-bezier(0,0,0,1);
  }
  .menu.up { transform: translateY(6px); }
  .menu.show { opacity: 1; transform: none; }
  .menu.dark {
    --bg: rgba(44,44,44,0.97); --fg: #ffffff; --hint: #c8c8c8; --hover: rgba(255,255,255,0.065);
    --press: rgba(255,255,255,0.04); --sep: rgba(255,255,255,0.09); --border: rgba(255,255,255,0.08);
    --shadow: 0 8px 16px rgba(0,0,0,0.36), 0 0 2px rgba(0,0,0,0.4); --dis: rgba(255,255,255,0.36); --accent: #60cdff;
  }
  .head { padding: 6px 12px 4px; font-size: 12px; color: var(--hint); }
  .item {
    display: flex; align-items: center; gap: 12px; height: 32px; padding: 0 12px 0 12px;
    border-radius: 4px; cursor: default; position: relative; white-space: nowrap;
  }
  .item .ic { width: 16px; height: 16px; flex: 0 0 16px; display: flex; color: var(--fg); }
  .item .lb { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; }
  .item .kb { flex: 0 0 auto; margin-left: 24px; font-size: 12px; color: var(--hint); }
  .item:hover, .item.focus { background: var(--hover); }
  .item:active { background: var(--press); }
  .item.focus::before {
    content: ""; position: absolute; left: 0; top: 9px; bottom: 9px; width: 3px; border-radius: 2px; background: var(--accent);
  }
  .item[aria-disabled="true"] { color: var(--dis); }
  .item[aria-disabled="true"] .ic { color: var(--dis); }
  .item[aria-disabled="true"]:hover { background: transparent; }
  .sep { height: 1px; background: var(--sep); margin: 4px -4px; }
  .toast {
    position: fixed; z-index: 2147483647; left: 24px; bottom: 24px; padding: 10px 16px; border-radius: 6px;
    background: #2b2b2b; color: #fff; font: 13px/1.3 "Segoe UI",system-ui,sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,.3);
    opacity: 0; transition: opacity 150ms; pointer-events: none;
  }
  .toast.show { opacity: 1; }
  @media (prefers-reduced-motion: reduce) { .menu { transition: none; } }
  `;

  let host = null, root = null, menuEl = null, ctx = null, focusIdx = -1;

  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = 'dxe-menu-host';
    host.setAttribute('data-dxe-ui', '');
    host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483646;';
    root = host.attachShadow({ mode: 'open' });
    const st = document.createElement('style');
    st.textContent = CSS;
    root.appendChild(st);
    document.documentElement.appendChild(host);
  }

  const enabledItems = () => [...menuEl.querySelectorAll('.item:not([aria-disabled="true"])')];
  const setFocus = (i) => {
    const items = enabledItems();
    if (!items.length) return;
    focusIdx = (i + items.length) % items.length;
    menuEl.querySelectorAll('.item.focus').forEach((n) => n.classList.remove('focus'));
    items[focusIdx].classList.add('focus');
  };

  function build(c) {
    const sel = SEL.selectedItems();
    const count = sel.includes(c.item) ? sel.length : 1;
    const m = document.createElement('div');
    m.className = 'menu' + (DXE.theme && DXE.theme() === 'dark' ? ' dark' : '');
    m.setAttribute('role', 'menu');
    m.setAttribute('lang', SEL.uiLang());
    m.setAttribute('data-dxe-ui', '');
    m.tabIndex = -1;
    if (count > 1) {
      const h = document.createElement('div');
      h.className = 'head';
      h.textContent = t('items', count);
      m.appendChild(h);
    }
    if (c.custom) {
      // generic menu: c.custom = [[{ id, label, hint, svg, run }...], ...]
      c.custom.forEach((g, gi) => {
        if (gi) { const s = document.createElement('div'); s.className = 'sep'; s.setAttribute('role', 'separator'); m.appendChild(s); }
        for (const e of g) {
          const it = document.createElement('div');
          it.className = 'item'; it.setAttribute('role', 'menuitem'); it.dataset.action = e.id;
          it.innerHTML = `<span class="ic">${e.svg ? `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${e.svg}</svg>` : icon(e.id)}</span><span class="lb"></span><span class="kb"></span>`;
          it.querySelector('.lb').textContent = e.label;
          it.querySelector('.kb').textContent = e.hint || '';
          m.appendChild(it);
        }
      });
    } else GROUPS.forEach((g, gi) => {
      if (gi) { const s = document.createElement('div'); s.className = 'sep'; s.setAttribute('role', 'separator'); m.appendChild(s); }
      for (const [id, kb] of g) {
        const spec = SEL.ACTIONS[id] || {};
        const it = document.createElement('div');
        it.className = 'item';
        it.setAttribute('role', 'menuitem');
        it.dataset.action = id;
        const disabled = spec.single && count > 1;
        if (disabled) it.setAttribute('aria-disabled', 'true');
        const hint = kb === '§' ? t('driveMenuHint') : kb || '';
        it.innerHTML = `<span class="ic">${icon(id)}</span><span class="lb"></span><span class="kb"></span>`;
        it.querySelector('.lb').textContent = t(id);
        it.querySelector('.kb').textContent = hint;
        m.appendChild(it);
      }
    });
    m.addEventListener('mousemove', (e) => {
      const it = e.target.closest('.item');
      if (it && !it.classList.contains('focus')) { const i = enabledItems().indexOf(it); if (i >= 0) setFocus(i); }
    });
    m.addEventListener('mousedown', (e) => e.preventDefault()); // keep Drive's focus/selection
    m.addEventListener('click', (e) => {
      const it = e.target.closest('.item');
      if (it && it.getAttribute('aria-disabled') !== 'true') run(it.dataset.action);
    });
    m.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); });
    return m;
  }

  function place(m, x, y) {
    const vw = innerWidth, vh = innerHeight;
    const r = m.getBoundingClientRect();
    let left = x, top = y;
    if (left + r.width > vw - 4) left = Math.max(4, x - r.width);
    if (top + r.height > vh - 4) {
      top = y - r.height >= 4 ? y - r.height : Math.max(4, vh - r.height - 4);
      m.classList.add('up');
    }
    m.style.left = left + 'px';
    m.style.top = top + 'px';
  }

  function show(c) {
    hide();
    ensureHost();
    ctx = c;
    menuEl = build(c);
    menuEl.style.left = '-9999px';
    menuEl.style.top = '0px';
    root.appendChild(menuEl);
    let { x, y } = c;
    if (!x && !y && c.item) { const r = c.item.getBoundingClientRect(); x = r.left + 16; y = r.top + Math.min(r.height, 60); }
    place(menuEl, x, y);
    requestAnimationFrame(() => menuEl && menuEl.classList.add('show'));
    focusIdx = -1;
    if (c.keyboard) setFocus(0);
    shownAt = performance.now();
    addGlobal();
    DXE.log('menu shown', c.custom ? '(custom)' : 'for ' + SEL.itemId(c.item).slice(0, 8) + '…', c);
  }

  function hide() {
    if (!menuEl) return;
    menuEl.remove();
    menuEl = null;
    removeGlobal();
  }

  async function run(action) {
    const c = ctx;
    hide();
    if (!c) return;
    if (c.custom) {
      const e = c.custom.flat().find((x) => x.id === action);
      if (e && e.run) e.run();
      return;
    }
    // Explorer-style open for files (new tab / window) — see open-files.js
    if (action === 'open' && DXE.openFiles && DXE.openFiles.tryOpen(c.item)) return;
    const ok = await DXE.native.perform(action, c);
    if (!ok) toast(t('failed', t(action)));
  }

  /* ---- global listeners while open ---- */
  const onPointerDown = (e) => { if (!e.composedPath().includes(host)) hide(); };
  const onKey = (e) => {
    if (!menuEl) return;
    const k = e.key;
    const handled = ['Escape', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Tab'].includes(k);
    if (!handled) { if (k.length === 1 || k === 'F2' || k === 'Delete') e.preventDefault(), e.stopImmediatePropagation(); return; }
    e.preventDefault();
    e.stopImmediatePropagation();
    if (k === 'Escape' || k === 'Tab') hide();
    else if (k === 'ArrowDown') setFocus(focusIdx + 1);
    else if (k === 'ArrowUp') setFocus(focusIdx < 0 ? -1 : focusIdx - 1);
    else if (k === 'Home') setFocus(0);
    else if (k === 'End') setFocus(-1);
    else if ((k === 'Enter' || k === ' ') && focusIdx >= 0) run(enabledItems()[focusIdx].dataset.action);
  };
  let shownAt = 0;
  // focus()/scrollIntoView right after the right-click must not close the menu
  const onScroll = (e) => { if (e.type === 'scroll' && performance.now() - shownAt < 400) return; if (!e.composedPath().includes(host)) hide(); };
  const onBlur = () => hide();
  function addGlobal() {
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('wheel', onScroll, { capture: true, passive: true });
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onBlur, true);
    window.addEventListener('blur', onBlur, true);
  }
  function removeGlobal() {
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('wheel', onScroll, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onBlur, true);
    window.removeEventListener('blur', onBlur, true);
  }

  let toastTimer = 0;
  function toast(msg) {
    ensureHost();
    let el = root.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.lang = SEL.uiLang(); el.setAttribute('role', 'status'); root.appendChild(el); }
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  DXE.menu = { show, hide, toast, t, isOpen: () => !!menuEl };
})();
