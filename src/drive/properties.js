/* Drive Explorer — Windows 11 style "Properties" dialog.
   Data comes from Drive's own details panel (DXE.details.read), opened
   invisibly and closed again. Modeless, draggable, Esc closes.            */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  const SEL = DXE.SEL;

  const STR = {
    en: {
      title: '{0} Properties', general: 'General', details: 'Details', ok: 'OK', cancel: 'Cancel', close: 'Close',
      loading: 'Reading details from Google Drive…',
      failed: 'Couldn’t read the details from Google Drive.', failedHint: 'To see them in Drive: turn off “Hide Drive’s details side panel” in the extension popup, then use “Show Drive menu” → File information → Details. To help fix this: popup → “Copy page structure” (with the details pane open) and send it.',
      none: 'No fields were found.', property: 'Property', value: 'Value', id: 'ID',
      f: { type: 'Type', location: 'Location', size: 'Size', storage: 'Storage used', owner: 'Owner', modified: 'Modified',
        opened: 'Opened', created: 'Created', access: 'Access', download: 'Download permissions', description: 'Description', shared: 'Shared' },
    },
    ja: {
      title: '{0} のプロパティ', general: '全般', details: '詳細', ok: 'OK', cancel: 'キャンセル', close: '閉じる',
      loading: 'Google ドライブから情報を取得しています…',
      failed: 'Google ドライブから情報を取得できませんでした。', failedHint: 'ドライブ上で確認するには、拡張機能のポップアップで「ドライブの詳細パネルを表示しない」をオフにしてから「ドライブのメニューを表示」→ ファイル情報 → 詳細 を開いてください。改善のため、詳細パネルを開いた状態でポップアップの「ページ構造をコピー」を送ってください。',
      none: '項目が見つかりませんでした。', property: 'プロパティ', value: '値', id: 'ID',
      f: { type: '種類', location: '場所', size: 'サイズ', storage: '使用容量', owner: '所有者', modified: '更新日時',
        opened: '最終閲覧', created: '作成日時', access: 'アクセス', download: 'ダウンロード権限', description: '説明', shared: '共有日' },
    },
  };
  const L = () => STR[SEL.uiLang()];
  const t = (k, ...a) => (L()[k] || STR.en[k] || k).replace(/\{(\d)\}/g, (_, i) => a[i]);

  /* General tab layout, Explorer order; '-' = separator */
  const GENERAL = ['type', 'location', '-', 'size', 'storage', '-', 'created', 'modified', 'opened', '-', 'owner', 'access'];

  const CSS = `
  :host { all: initial; }
  .win {
    --bg: #f3f3f3; --card: #fbfbfb; --fg: #1b1b1b; --sub: #5d5d5d; --border: rgba(0,0,0,.14); --sep: rgba(0,0,0,.09);
    --accent: #005fb8; --accent-fg: #fff; --btn: #fdfdfd; --btn-border: rgba(0,0,0,.12); --hover: rgba(0,0,0,.04);
    --shadow: 0 32px 64px rgba(0,0,0,.18), 0 2px 21px rgba(0,0,0,.12); --field: #fff; --field-border: rgba(0,0,0,.14);
    position: fixed; z-index: 2147483645; width: 392px; max-width: calc(100vw - 16px); box-sizing: border-box;
    background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow);
    font: 400 12px/1.4 "Segoe UI Variable Text","Segoe UI","Yu Gothic UI","Meiryo UI",-apple-system,"Hiragino Sans","Noto Sans JP","Noto Sans CJK JP",system-ui,sans-serif;
    overflow: hidden; user-select: text; outline: none;
    animation: pop 140ms cubic-bezier(0,0,0,1);
  }
  @keyframes pop { from { opacity: 0; transform: scale(.98); } to { opacity: 1; transform: none; } }
  .win.dark {
    --bg: #202020; --card: #2b2b2b; --fg: #fff; --sub: #c5c5c5; --border: rgba(255,255,255,.12); --sep: rgba(255,255,255,.09);
    --accent: #60cdff; --accent-fg: #000; --btn: #373737; --btn-border: rgba(255,255,255,.09); --hover: rgba(255,255,255,.06);
    --shadow: 0 32px 64px rgba(0,0,0,.5), 0 2px 21px rgba(0,0,0,.4); --field: #2d2d2d; --field-border: rgba(255,255,255,.1);
  }
  .bar { display: flex; align-items: center; height: 32px; padding-left: 12px; gap: 8px; cursor: default; user-select: none; touch-action: none; }
  .bar .ttl { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar .x { width: 46px; height: 32px; border: 0; background: transparent; color: var(--fg); display: flex; align-items: center; justify-content: center; cursor: default; }
  .bar .x:hover { background: #c42b1c; color: #fff; }
  .tabs { display: flex; gap: 2px; padding: 4px 8px 0; user-select: none; }
  .tab { padding: 6px 12px 8px; border-radius: 4px 4px 0 0; cursor: default; position: relative; color: var(--sub); border: 0; background: transparent; font: inherit; }
  .tab:hover { background: var(--hover); }
  .tab[aria-selected="true"] { color: var(--fg); background: var(--card); }
  .tab[aria-selected="true"]::after { content: ""; position: absolute; left: 10px; right: 10px; bottom: 2px; height: 3px; border-radius: 2px; background: var(--accent); }
  .body { background: var(--card); margin: 0 8px; border: 1px solid var(--sep); border-radius: 0 4px 4px 4px; padding: 14px 16px; min-height: 300px; max-height: 60vh; overflow: auto; }
  .head { display: flex; align-items: center; gap: 14px; padding-bottom: 12px; }
  .bigicon { width: 40px; height: 40px; flex: 0 0 40px; display: flex; align-items: center; justify-content: center; }
  .bigicon > * { width: 36px !important; height: 36px !important; max-width: 40px; max-height: 40px; object-fit: contain; }
  .bigicon svg { fill: currentColor; }
  .name { flex: 1; min-width: 0; height: 26px; box-sizing: border-box; padding: 3px 8px; border-radius: 4px; border: 1px solid var(--field-border);
    border-bottom-color: rgba(0,0,0,.35); background: var(--field); color: var(--fg); font: inherit; }
  .win.dark .name { border-bottom-color: rgba(255,255,255,.4); }
  .sep { height: 1px; background: var(--sep); margin: 8px 0; }
  .row { display: grid; grid-template-columns: 104px 1fr; gap: 8px; padding: 3px 0; }
  .row .k { color: var(--fg); }
  .row .v { color: var(--fg); overflow-wrap: anywhere; }
  .msg { color: var(--sub); padding: 24px 4px; text-align: center; }
  .msg.err { color: var(--fg); text-align: left; }
  .msg .hint { color: var(--sub); margin-top: 8px; }
  .spin { width: 18px; height: 18px; margin: 0 auto 10px; border-radius: 50%; border: 2px solid var(--sep); border-top-color: var(--accent); animation: sp 0.8s linear infinite; }
  @keyframes sp { to { transform: rotate(360deg); } }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-weight: 400; color: var(--sub); padding: 4px 6px; border-bottom: 1px solid var(--sep); }
  td { padding: 4px 6px; vertical-align: top; overflow-wrap: anywhere; }
  td:first-child { width: 40%; }
  .foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 8px; }
  .btn { min-width: 80px; height: 30px; padding: 0 12px; border-radius: 4px; border: 1px solid var(--btn-border); background: var(--btn); color: var(--fg); font: inherit; cursor: default; }
  .btn:hover { filter: brightness(.97); }
  .btn.primary { background: var(--accent); color: var(--accent-fg); border-color: transparent; }
  .btn:focus-visible, .tab:focus-visible, .x:focus-visible { outline: 2px solid var(--fg); outline-offset: 1px; }
  `;

  let host = null, root = null, win = null, seq = 0;

  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = 'dxe-props-host';
    host.setAttribute('data-dxe-ui', '');
    host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483645;';
    root = host.attachShadow({ mode: 'open' });
    const st = document.createElement('style');
    st.textContent = CSS;
    root.appendChild(st);
    document.documentElement.appendChild(host);
  }

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function itemName(item) {
    const n = item.querySelector('[data-dxe-part="name"]');
    if (n) return SEL.norm(n.textContent);
    const a = SEL.analyzeTile(item);
    return a.name ? SEL.norm(a.name.textContent) : SEL.norm(item.getAttribute('aria-label')) || '';
  }
  function itemIcon(item) {
    const a = SEL.analyzeTile(item);
    const src = a.icon || item.querySelector('[data-dxe-part="icon"]') || a.thumb;
    if (!src) return null;
    const c = src.cloneNode(true);
    [c, ...c.querySelectorAll('*')].forEach((n) => { [...n.attributes].forEach((at) => { if (at.name.startsWith('data-dxe') || at.name === 'jsaction' || at.name === 'id') n.removeAttribute(at.name); }); });
    c.removeAttribute('style');
    // keep the colour Drive painted the icon with
    try { c.style.color = getComputedStyle(src).color; } catch (e) { /* ignore */ }
    return c;
  }

  function close() {
    if (!win) return;
    win.remove();
    win = null;
    window.removeEventListener('keydown', onKey, true);
  }
  const onKey = (e) => {
    if (!win || !e.isTrusted) return; // ignore our own synthetic keys sent to Drive
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    else if (e.key === 'Enter' && e.composedPath().includes(host) && !e.altKey) {
      const tgt = e.composedPath()[0];
      if (!(tgt && tgt.classList && (tgt.classList.contains('tab') || tgt.classList.contains('x')))) { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    }
  };

  function makeDraggable(bar) {
    let sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.x')) return;
      on = true; sx = e.clientX; sy = e.clientY;
      const r = win.getBoundingClientRect(); ox = r.left; oy = r.top;
      bar.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    bar.addEventListener('pointermove', (e) => {
      if (!on) return;
      const w = win.offsetWidth;
      const x = Math.min(Math.max(ox + e.clientX - sx, 40 - w), innerWidth - 40);
      const y = Math.min(Math.max(oy + e.clientY - sy, 0), innerHeight - 32);
      win.style.left = x + 'px'; win.style.top = y + 'px';
    });
    const end = (e) => { if (on) { on = false; try { bar.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ } } };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
  }

  function renderGeneral(body, data) {
    body.textContent = '';
    const head = el('div', 'head');
    const ic = el('div', 'bigicon');
    if (data.icon) ic.appendChild(data.icon.cloneNode(true));
    const name = el('input', 'name');
    name.readOnly = true; name.value = data.name; name.setAttribute('aria-label', 'name');
    head.append(ic, name);
    body.appendChild(head);
    body.appendChild(el('div', 'sep'));
    if (data.state === 'loading') {
      const m = el('div', 'msg'); m.append(el('div', 'spin'), el('div', '', t('loading'))); body.appendChild(m); return;
    }
    if (data.state === 'failed') {
      const m = el('div', 'msg err'); m.append(el('div', '', t('failed')), el('div', 'hint', t('failedHint')));
      if (data.why && DXE.settings.debug) m.append(el('div', 'hint', '(' + data.why + ')'));
      body.appendChild(m); return;
    }
    const byKey = {};
    data.pairs.forEach((p) => { if (p.key && !byKey[p.key]) byKey[p.key] = p.value; });
    let rows = 0, pendingSep = false;
    for (const k of GENERAL) {
      if (k === '-') { pendingSep = rows > 0; continue; }
      if (!byKey[k]) continue;
      if (pendingSep) { body.appendChild(el('div', 'sep')); pendingSep = false; }
      const r = el('div', 'row'); r.append(el('div', 'k', L().f[k] + ':'), el('div', 'v', byKey[k])); body.appendChild(r); rows++;
    }
    // unknown / other fields still shown generically
    const extra = data.pairs.filter((p) => !p.key || !GENERAL.includes(p.key));
    if (extra.length) {
      if (rows) body.appendChild(el('div', 'sep'));
      for (const p of extra) { const r = el('div', 'row'); r.append(el('div', 'k', (p.key ? L().f[p.key] : p.label) + ':'), el('div', 'v', p.value)); body.appendChild(r); rows++; }
    }
    if (!rows) body.appendChild(el('div', 'msg', t('none')));
  }

  function renderDetails(body, data) {
    body.textContent = '';
    if (data.state !== 'done') { renderGeneral(body, data); return; }
    const tb = el('table');
    const hr = el('tr'); hr.append(el('th', '', t('property')), el('th', '', t('value'))); tb.appendChild(hr);
    const add = (k, v) => { const r = el('tr'); r.append(el('td', '', k), el('td', '', v)); tb.appendChild(r); };
    add(SEL.uiLang() === 'ja' ? '名前' : 'Name', data.name);
    data.pairs.forEach((p) => add(p.label, p.value));
    if (data.id) add(t('id'), data.id);
    body.appendChild(tb);
  }

  async function show(ctx) {
    close();
    ensureHost();
    const my = ++seq;
    const data = { name: itemName(ctx.item), icon: itemIcon(ctx.item), id: SEL.itemId(ctx.item), state: 'loading', pairs: [] };
    win = el('div', 'win' + (DXE.theme && DXE.theme() === 'dark' ? ' dark' : ''));
    win.setAttribute('role', 'dialog');
    win.setAttribute('lang', SEL.uiLang());
    win.setAttribute('aria-label', t('title', data.name));
    win.tabIndex = -1;
    const bar = el('div', 'bar');
    const ttl = el('div', 'ttl', t('title', data.name));
    const x = el('button', 'x'); x.setAttribute('aria-label', t('close')); x.title = t('close');
    x.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1"/></svg>';
    x.addEventListener('click', close);
    bar.append(ttl, x);
    const tabs = el('div', 'tabs'); tabs.setAttribute('role', 'tablist');
    const tGen = el('button', 'tab', t('general')); tGen.setAttribute('role', 'tab'); tGen.setAttribute('aria-selected', 'true');
    const tDet = el('button', 'tab', t('details')); tDet.setAttribute('role', 'tab'); tDet.setAttribute('aria-selected', 'false');
    tabs.append(tGen, tDet);
    const body = el('div', 'body'); body.setAttribute('role', 'tabpanel');
    let current = 'general';
    const render = () => (current === 'general' ? renderGeneral : renderDetails)(body, data);
    const pick = (which) => { current = which; tGen.setAttribute('aria-selected', String(which === 'general')); tDet.setAttribute('aria-selected', String(which !== 'general')); render(); };
    tGen.addEventListener('click', () => pick('general'));
    tDet.addEventListener('click', () => pick('details'));
    const foot = el('div', 'foot');
    const ok = el('button', 'btn primary', t('ok')); ok.addEventListener('click', close);
    const cancel = el('button', 'btn', t('cancel')); cancel.addEventListener('click', close);
    foot.append(ok, cancel);
    win.append(bar, tabs, body, foot);
    win.addEventListener('contextmenu', (e) => e.stopPropagation());
    root.appendChild(win);
    // centre-ish over the viewport, slightly up (like Explorer)
    const w = win.offsetWidth, h = win.offsetHeight;
    win.style.left = Math.max(8, Math.round((innerWidth - w) / 2)) + 'px';
    win.style.top = Math.max(8, Math.round((innerHeight - h) / 2.6)) + 'px';
    makeDraggable(bar);
    window.addEventListener('keydown', onKey, true);
    render();
    ok.focus({ preventScroll: true });

    const res = await DXE.details.read(ctx);
    if (my !== seq || !win) return; // closed or replaced meanwhile
    if (res.ok) { data.state = 'done'; data.pairs = res.pairs; }
    else { data.state = 'failed'; data.why = res.why; }
    render();
  }

  DXE.props = { show, close, isOpen: () => !!win };
})();
