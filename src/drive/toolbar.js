/* Drive Explorer — Explorer-style command bar above the list:
   ← → ↑ ⟳ | address bar (/path from Drive's breadcrumbs) | view switch.
   Alt+↑ / Backspace = up. Inserted into Drive's main area (re-attached if
   Drive re-renders). */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  const SEL = DXE.SEL;

  const STR = {
    en: { back: 'Back (Alt+Left)', fwd: 'Forward (Alt+Right)', up: 'Up to parent folder (Alt+Up)', refresh: 'Refresh (F5)', medium: 'Medium icons', list: 'List',
      address: 'Address', home: 'Home', trash: 'Recycle Bin', noLayout: 'Drive’s layout button wasn’t found.', root: 'My Drive' },
    ja: { back: '戻る (Alt+←)', fwd: '進む (Alt+→)', up: '1 つ上のフォルダーへ (Alt+↑)', refresh: '最新の情報に更新 (F5)', medium: '中アイコン', list: '一覧',
      address: 'アドレス', home: 'ホーム', trash: 'ごみ箱', noLayout: 'ドライブのレイアウト切り替えボタンが見つかりません。', root: 'マイドライブ' },
  };
  const t = (k) => STR[SEL.uiLang()][k] || STR.en[k];

  /* ---------- parent map (learned while navigating) ---------- */
  const PKEY = 'dxe-parents';
  let parents = {};
  try { parents = JSON.parse(sessionStorage.getItem(PKEY) || '{}'); } catch (e) { parents = {}; }
  let pending = null;
  window.addEventListener('dblclick', (e) => {
    const item = SEL.findItem(e.target);
    if (!item || !SEL.isFolder(item)) return;
    const n = item.querySelector('[data-dxe-part="name"]');
    pending = { id: SEL.itemId(item), n: SEL.norm(n ? n.textContent : (SEL.analyzeTile(item).name || {}).textContent || ''),
      p: SEL.currentFolderId() || (SEL.NAV.myDrivePath.test(location.pathname) ? 'root' : null) };
  }, true);
  const learn = () => {
    const id = SEL.currentFolderId();
    if (pending && id === pending.id) {
      parents[id] = { p: pending.p, n: pending.n };
      try { sessionStorage.setItem(PKEY, JSON.stringify(parents)); } catch (e) { /* ignore */ }
      pending = null;
    }
  };

  /* ---------- navigation ---------- */
  function navCrumb(c) {
    const before = location.href;
    DXE.native.activate(c.el);
    setTimeout(() => {
      if (location.href !== before) return;
      if (c.root === 'myDrive') location.assign(SEL.myDriveUrl());
      else if (c.id) location.assign(SEL.folderUrl(c.id));
    }, 900);
  }
  function upTarget() {
    const crumbs = SEL.breadcrumbs();
    if (crumbs && crumbs.length >= 2) return { crumb: crumbs[crumbs.length - 2] };
    const id = SEL.currentFolderId();
    if (id) { const p = parents[id]; return { url: p && p.p && p.p !== 'root' ? SEL.folderUrl(p.p) : SEL.myDriveUrl() }; }
    return null;
  }
  function up() {
    const u = upTarget();
    if (!u) return false;
    DXE.log('up →', u.crumb ? 'breadcrumb ' + u.crumb.label : u.url);
    if (u.crumb) navCrumb(u.crumb); else location.assign(u.url);
    return true;
  }

  /** Address model: [{label, go?}] + display text */
  function pathModel() {
    const crumbs = SEL.breadcrumbs();
    const segs = [];
    if (crumbs && crumbs.length) {
      const last = crumbs.length - 1;
      crumbs.forEach((c, i) => {
        const go = i === last ? null : () => navCrumb(c);
        if (i === 0 && c.root === 'myDrive') segs.push({ label: '/', go, root: true });
        else if (i === 0) segs.push({ label: c.label, go, root: true, named: true });
        else segs.push({ label: c.label, go });
      });
      return { segs, via: 'breadcrumbs' };
    }
    const p = location.pathname;
    if (SEL.NAV.myDrivePath.test(p)) return { segs: [{ label: '/', root: true }], via: 'url' };
    if (SEL.NAV.trashPath.test(p)) return { segs: [{ label: t('trash'), root: true, named: true }], via: 'url' };
    if (SEL.NAV.homePath.test(p)) return { segs: [{ label: t('home'), root: true, named: true }], via: 'url' };
    const id = SEL.currentFolderId();
    if (id) {
      const chain = [];
      let cur = id, guard = 0, rooted = false;
      while (cur && parents[cur] && guard++ < 40) { chain.unshift({ id: cur, n: parents[cur].n }); if (parents[cur].p === 'root') { rooted = true; break; } cur = parents[cur].p; }
      if (!chain.length) chain.push({ id, n: SEL.norm(document.title.replace(/\s+[-–]\s+Google (Drive|ドライブ)\s*$/i, '')) || '…' });
      segs.push({ label: rooted ? '/' : '…', root: true, go: rooted ? () => location.assign(SEL.myDriveUrl()) : null });
      chain.forEach((c, i) => segs.push({ label: c.n, go: i === chain.length - 1 ? null : () => location.assign(SEL.folderUrl(c.id)) }));
      return { segs, via: 'learned' };
    }
    return { segs: [{ label: SEL.norm(document.title.replace(/\s+[-–]\s+Google (Drive|ドライブ)\s*$/i, '')) || '/', root: true, named: true }], via: 'title' };
  }
  DXE.pathText = () => {
    const m = pathModel();
    if (m.segs[0].named) return m.segs.map((s) => s.label).join('/');
    return '/' + m.segs.slice(1).map((s) => s.label).join('/');
  };

  /* ---------- UI ---------- */
  const I = {
    back: '<path d="M12.5 8h-9M7 4.5 3.5 8 7 11.5"/>',
    fwd: '<path d="M3.5 8h9M9 4.5l3.5 3.5L9 11.5"/>',
    up: '<path d="M8 12.5v-9M4.5 7 8 3.5 11.5 7"/>',
    refresh: '<path d="M13 8a5 5 0 1 1-1.5-3.55"/><path d="M11.8 2.2v2.6H9.2"/>',
    medium: '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>',
    list: '<path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><path d="M2.5 4h.1M2.5 8h.1M2.5 12h.1" stroke-width="1.8"/>',
    folder: '<path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" fill="#FFCA3A" stroke="#C99A1A"/>',
  };
  const svg = (p) => `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

  const CSS = `
  :host { all: initial; display: block; }
  .bar { --fg:#1b1b1b; --sub:#5f5f5f; --hover:rgba(0,0,0,.05); --press:rgba(0,0,0,.08); --field:#fff; --border:rgba(0,0,0,.12); --accent:#005fb8; --sel:rgba(0,95,184,.10);
    display:flex; align-items:center; gap:4px; height:40px; padding:0 4px; box-sizing:border-box; color:var(--fg);
    font:400 13px/1 "Segoe UI Variable Text","Segoe UI","Yu Gothic UI","Meiryo UI",-apple-system,"Hiragino Sans","Noto Sans JP","Noto Sans CJK JP",system-ui,sans-serif; }
  .bar.dark { --fg:#fff; --sub:#c5c5c5; --hover:rgba(255,255,255,.07); --press:rgba(255,255,255,.1); --field:#2d2d2d; --border:rgba(255,255,255,.1); --accent:#60cdff; --sel:rgba(96,205,255,.12); }
  button { all: unset; box-sizing:border-box; display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:4px; color:var(--fg); cursor:default; flex:0 0 auto; }
  button:hover { background:var(--hover); } button:active { background:var(--press); }
  button[disabled] { opacity:.38; background:transparent; }
  button:focus-visible { outline:2px solid var(--fg); outline-offset:-2px; }
  .addr { flex:1 1 auto; min-width:120px; height:30px; display:flex; align-items:center; gap:2px; padding:0 8px; margin:0 6px; border:1px solid var(--border); border-radius:4px; background:var(--field); overflow:hidden; white-space:nowrap; }
  .addr .fi { display:flex; margin-right:4px; flex:0 0 auto; }
  .seg { padding:4px 4px; border-radius:3px; cursor:default; overflow:hidden; text-overflow:ellipsis; max-width:220px; }
  .seg.link:hover { background:var(--hover); }
  .slash { color:var(--sub); padding:0 1px; }
  .view { display:flex; gap:2px; padding-left:4px; border-left:1px solid var(--border); margin-left:2px; }
  .view button[aria-pressed="true"] { background:var(--sel); color:var(--accent); }
  `;

  let host = null, root = null, bar = null;
  function anchor() {
    const main = SEL.scopeEl();
    if (!main || main === document.body) return null;
    const cs = getComputedStyle(main);
    const rowish = (cs.display.includes('flex') && !cs.flexDirection.startsWith('column')) || cs.display.includes('grid');
    if (!rowish) return { parent: main, before: main.firstChild };
    const p = main.parentElement, pcs = p && getComputedStyle(p);
    if (p && !(pcs.display.includes('flex') && !pcs.flexDirection.startsWith('column')) && !pcs.display.includes('grid')) return { parent: p, before: main };
    return { parent: main, before: main.firstChild, fullRow: true };
  }

  function build() {
    host = document.createElement('div');
    host.id = 'dxe-toolbar-host';
    host.setAttribute('data-dxe-ui', '');
    host.style.cssText = 'display:block;width:100%;flex:0 0 100%;order:-1;box-sizing:border-box;position:relative;z-index:3;';
    root = host.attachShadow({ mode: 'open' });
    const st = document.createElement('style'); st.textContent = CSS; root.appendChild(st);
    bar = document.createElement('div');
    bar.className = 'bar';
    bar.setAttribute('role', 'toolbar');
    const mk = (id, fn) => { const b = document.createElement('button'); b.dataset.id = id; b.innerHTML = svg(I[id]); b.addEventListener('click', fn); return b; };
    bar.append(
      mk('back', () => history.back()), mk('fwd', () => history.forward()), mk('up', () => up()), mk('refresh', () => location.reload()),
    );
    const addr = document.createElement('div'); addr.className = 'addr'; addr.setAttribute('role', 'navigation');
    bar.appendChild(addr);
    const view = document.createElement('div'); view.className = 'view';
    view.append(mk('medium', () => setView('grid')), mk('list', () => setView('list')));
    bar.appendChild(view);
    bar.addEventListener('mousedown', (e) => { if (e.target.closest && !e.target.closest('.addr')) e.preventDefault(); });
    root.appendChild(bar);
  }

  function setView(v) {
    if (v === 'grid' && !DXE.settings.mediumIcons) DXE.saveSetting('mediumIcons', true);
    const b = SEL.findLayoutButton(v === 'grid' ? SEL.NAV.gridLayout : SEL.NAV.listLayout);
    if (b) DXE.native.activate(b);
    else if (!((v === 'grid' && DXE.tileStats.tiles) || (v === 'list' && DXE.tileStats.listRows && !DXE.tileStats.tiles))) DXE.menu.toast(t('noLayout'));
    setTimeout(render, 400);
  }

  let lastSig = '';
  function render() {
    if (!host) return;
    learn();
    bar.className = 'bar' + (DXE.theme && DXE.theme() === 'dark' ? ' dark' : '');
    bar.setAttribute('lang', SEL.uiLang());
    bar.querySelectorAll('button[data-id]').forEach((b) => { b.title = t(b.dataset.id); b.setAttribute('aria-label', t(b.dataset.id)); });
    bar.querySelector('[data-id="up"]').disabled = !upTarget();
    const grid = DXE.tileStats && DXE.tileStats.tiles > 0, list = DXE.tileStats && DXE.tileStats.listRows > 0 && !grid;
    bar.querySelector('[data-id="medium"]').setAttribute('aria-pressed', String(!!grid));
    bar.querySelector('[data-id="list"]').setAttribute('aria-pressed', String(!!list));
    const m = pathModel();
    const sig = m.segs.map((s) => s.label + (s.go ? '>' : '')).join('|') + location.pathname;
    if (sig === lastSig) return;
    lastSig = sig;
    const addr = bar.querySelector('.addr');
    addr.textContent = '';
    addr.setAttribute('aria-label', t('address'));
    const fi = document.createElement('span'); fi.className = 'fi'; fi.innerHTML = svg(I.folder); addr.appendChild(fi);
    m.segs.forEach((s, i) => {
      if (i > 0 && !(i === 1 && m.segs[0].label === '/')) { const sl = document.createElement('span'); sl.className = 'slash'; sl.textContent = '/'; addr.appendChild(sl); }
      const el = document.createElement('span');
      el.className = 'seg' + (s.go ? ' link' : '');
      el.textContent = s.label;
      if (s.go) { el.setAttribute('role', 'link'); el.tabIndex = 0; el.addEventListener('click', s.go); el.addEventListener('keydown', (e) => { if (e.key === 'Enter') s.go(); }); }
      addr.appendChild(el);
    });
    addr.title = DXE.pathText();
    DXE.log('address', DXE.pathText(), 'via', m.via);
  }

  function ensure() {
    if (!DXE.settings.explorerToolbar) { if (host) host.remove(); return; }
    if (!host) build();
    if (!host.isConnected) {
      const a = anchor();
      if (!a) return;
      a.parent.insertBefore(host, a.before);
      lastSig = '';
    }
    render();
  }

  let pend = 0, lastHref = location.href;
  const schedule = () => { if (pend) return; pend = setTimeout(() => { pend = 0; try { ensure(); } catch (e) { console.error('[DriveExplorer] toolbar', e); } }, 250); };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(() => { if (location.href !== lastHref) { lastHref = location.href; lastSig = ''; schedule(); } }, 300);
  window.addEventListener('popstate', schedule);
  document.addEventListener('dxe-theme', () => { lastSig = ''; schedule(); });

  // Alt+↑ / Backspace = up
  window.addEventListener('keydown', (e) => {
    if (!DXE.settings.explorerToolbar || !e.isTrusted) return;
    const altUp = e.key === 'ArrowUp' && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
    const bs = e.key === 'Backspace' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
    if (!altUp && !bs) return;
    const a = document.activeElement;
    if (a && a.closest && (a.closest(SEL.editable) || a.closest('[role="dialog"],' + SEL.menu))) return;
    if ((DXE.menu && DXE.menu.isOpen()) || (DXE.props && DXE.props.isOpen())) return;
    if ([...document.querySelectorAll('[role="dialog"]')].some((d) => SEL.isShown(d))) return;
    if (!upTarget()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    up();
  }, true);

  DXE.toolbar = { apply: schedule, up, pathModel, render: () => { lastSig = ''; render(); } };
})();
