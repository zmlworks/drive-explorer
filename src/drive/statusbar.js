/* Drive Explorer — Explorer status bar: "N 個の項目 | M 個の項目を選択". */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  const SEL = DXE.SEL;
  const STR = {
    en: { items: (n) => `${n} item${n === 1 ? '' : 's'}`, sel: (n) => `${n} item${n === 1 ? '' : 's'} selected`, more: '+' },
    ja: { items: (n) => `${n} 個の項目`, sel: (n) => `${n} 個の項目を選択`, more: '+' },
  };
  const CSS = `
  :host { all: initial; }
  .sb { position: fixed; z-index: 2147483000; height: 24px; box-sizing: border-box; display: flex; align-items: center; gap: 0;
    padding: 0 12px; font: 400 12px/24px "Segoe UI Variable Text","Segoe UI","Yu Gothic UI","Meiryo UI",-apple-system,"Hiragino Sans","Noto Sans JP",system-ui,sans-serif;
    color: #1b1b1b; background: rgba(243,243,243,.94); border-top: 1px solid rgba(0,0,0,.08); pointer-events: none; white-space: nowrap; }
  .sb.dark { color: #fff; background: rgba(32,32,32,.94); border-top-color: rgba(255,255,255,.08); }
  .sep { display: inline-block; width: 1px; height: 12px; background: currentColor; opacity: .35; margin: 0 10px; }
  `;
  let host, bar, last = '';
  function build() {
    host = document.createElement('div');
    host.id = 'dxe-status-host';
    host.setAttribute('data-dxe-ui', '');
    const root = host.attachShadow({ mode: 'open' });
    const st = document.createElement('style'); st.textContent = CSS; root.appendChild(st);
    bar = document.createElement('div'); bar.className = 'sb'; bar.setAttribute('role', 'status');
    root.appendChild(bar);
  }
  function render() {
    if (!DXE.settings.statusBar) { if (host) host.remove(); document.documentElement.classList.remove('dxe-statusbar'); return; }
    if (!host) build();
    if (!host.isConnected) document.documentElement.appendChild(host);
    document.documentElement.classList.add('dxe-statusbar');
    const main = SEL.scopeEl();
    const r = main && main !== document.body ? main.getBoundingClientRect() : { left: 0, width: innerWidth };
    const left = Math.max(0, Math.round(r.left)), width = Math.round(Math.min(r.width, innerWidth - left));
    const items = SEL.allItems().filter((i) => !i.closest('[data-dxe-sugg]'));
    const sel = items.filter(SEL.isSelected).length;
    const L = STR[SEL.uiLang()];
    const sig = [left, width, items.length, sel, SEL.uiLang(), DXE.theme && DXE.theme()].join('|');
    if (sig === last) return;
    last = sig;
    bar.className = 'sb' + (DXE.theme && DXE.theme() === 'dark' ? ' dark' : '');
    bar.lang = SEL.uiLang();
    bar.style.left = left + 'px';
    bar.style.width = width + 'px';
    bar.style.bottom = '0px';
    bar.innerHTML = '';
    const a = document.createElement('span'); a.textContent = L.items(items.length); bar.appendChild(a);
    if (sel) {
      const s = document.createElement('span'); s.className = 'sep'; bar.appendChild(s);
      const b = document.createElement('span'); b.textContent = L.sel(sel); bar.appendChild(b);
    }
    DXE.statusText = bar.textContent;
  }
  let pend = 0;
  const schedule = () => { if (pend) return; pend = setTimeout(() => { pend = 0; try { render(); } catch (e) { console.error('[DriveExplorer] status', e); } }, 150); };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-checked', 'class'] });
  ['pointerup', 'keyup', 'resize'].forEach((t) => window.addEventListener(t, schedule, true));
  document.addEventListener('dxe-theme', schedule);
  DXE.statusbar = { apply: () => { last = ''; schedule(); }, render };
})();
