/* Drive Explorer — "Medium icons" view.
   We never replace Drive's DOM: we only tag Drive's own grid elements with
   data-dxe-* attributes and let drive.css (scoped by html.dxe-medium) restyle
   them. Sorting, selection, double-click, drag & drop stay Drive's own.     */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  const SEL = DXE.SEL;

  const ATTRS = ['data-dxe-tile', 'data-dxe-hasthumb', 'data-dxe-sel', 'data-dxe-chain', 'data-dxe-o',
    'data-dxe-part', 'data-dxe-iconwrap', 'data-dxe-thumbchain', 'data-dxe-cell', 'data-dxe-row', 'data-dxe-rows'];

  const stats = (DXE.tileStats = {
    scans: 0, items: 0, tiles: 0, listRows: 0, noName: 0, withThumb: 0,
    rows: 0, rowsParents: 0, nameStrategy: {}, thumbStrategy: {}, containerStrategy: {},
  });

  let seen = new WeakMap(); // tile -> { name, thumb } last analysis

  const childOn = (parent, node) => {
    let c = node;
    while (c && c.parentElement !== parent) c = c.parentElement;
    return c;
  };

  const clearTags = (root) => {
    root.querySelectorAll('[data-dxe-chain],[data-dxe-o],[data-dxe-part],[data-dxe-iconwrap],[data-dxe-thumbchain]')
      .forEach((el) => ['data-dxe-chain', 'data-dxe-o', 'data-dxe-part', 'data-dxe-iconwrap', 'data-dxe-thumbchain']
        .forEach((a) => el.removeAttribute(a)));
  };

  function tagTile(tile) {
    const prev = seen.get(tile);
    if (prev && prev.name && prev.name.isConnected && tile.contains(prev.name) &&
        (!prev.thumb || (prev.thumb.isConnected && tile.contains(prev.thumb))) &&
        !(prev.thumb === null && tile.querySelector('img:not([data-dxe-part])') && prev.imgCount !== tile.querySelectorAll('img').length)) {
      return prev;
    }
    const a = SEL.analyzeTile(tile);
    a.imgCount = tile.querySelectorAll('img').length;
    seen.set(tile, a);
    stats.nameStrategy[a.strategy.name] = (stats.nameStrategy[a.strategy.name] || 0) + 1;
    if (a.strategy.thumb) stats.thumbStrategy[a.strategy.thumb] = (stats.thumbStrategy[a.strategy.thumb] || 0) + 1;
    if (!a.name) { stats.noName++; DXE.warn('tile without detectable name', tile); return a; }

    clearTags(tile);
    tile.setAttribute('data-dxe-tile', '');
    tile.toggleAttribute('data-dxe-hasthumb', !!a.thumb);
    a.name.setAttribute('data-dxe-part', 'name');

    // Chain = ancestors of the name up to the tile; each becomes a centred column.
    const chain = [];
    for (let p = a.name.parentElement; p && p !== tile; p = p.parentElement) chain.push(p);
    chain.forEach((p) => p.setAttribute('data-dxe-chain', ''));

    // Order children of tile + chain elements: thumb/icon (1), name (2), rest (3).
    for (const P of [tile, ...chain]) {
      for (const c of P.children) {
        if (c.contains(a.name)) c.setAttribute('data-dxe-o', 'name');
        else if (a.thumb && c.contains(a.thumb)) c.setAttribute('data-dxe-o', 'thumb');
        else if (a.more && c.contains(a.more)) c.setAttribute('data-dxe-o', 'more');
        else if (a.icon && c.contains(a.icon)) c.setAttribute('data-dxe-o', 'icon');
        else if (c.querySelector('[role="checkbox"]') || c.matches('[role="checkbox"]')) c.setAttribute('data-dxe-o', 'check');
        else c.setAttribute('data-dxe-o', 'other');
      }
    }
    if (a.name.getAttribute('data-dxe-o') === null && a.name.parentElement === tile) a.name.setAttribute('data-dxe-o', 'name');

    if (a.icon) {
      a.icon.setAttribute('data-dxe-part', 'icon');
      for (let p = a.icon.parentElement; p && p !== tile && !p.hasAttribute('data-dxe-chain'); p = p.parentElement) {
        p.setAttribute('data-dxe-iconwrap', '');
      }
    }
    if (a.thumb) {
      stats.withThumb++;
      a.thumb.setAttribute('data-dxe-part', 'thumb');
      for (let p = a.thumb.parentElement; p && p !== tile && !p.hasAttribute('data-dxe-chain'); p = p.parentElement) {
        p.setAttribute('data-dxe-thumbchain', '');
      }
    }
    if (a.more) a.more.setAttribute('data-dxe-part', 'more');
    DXE.log('tile tagged', SEL.itemId(tile).slice(0, 6) + '…', a.strategy, tile);
    return a;
  }

  function tagContainers(tile) {
    const c = SEL.tileContainers(tile);
    stats.containerStrategy[c.strategy] = (stats.containerStrategy[c.strategy] || 0) + 1;
    if (c.cell) c.cell.setAttribute('data-dxe-cell', '');
    if (c.row && !c.row.hasAttribute('data-dxe-row')) { c.row.setAttribute('data-dxe-row', ''); }
    if (c.rowsParent && !c.rowsParent.hasAttribute('data-dxe-rows')) c.rowsParent.setAttribute('data-dxe-rows', '');
  }

  function syncSelection(tile) {
    tile.toggleAttribute('data-dxe-sel', SEL.isSelected(tile));
  }

  let enabled = false;
  function scan() {
    if (!enabled) return;
    stats.scans++;
    const items = SEL.allItems();
    let tiles = 0, rows = 0;
    for (const item of items) {
      if (!SEL.isGridTile(item)) { rows++; continue; }
      tiles++;
      tagTile(item);
      tagContainers(item);
      syncSelection(item);
    }
    stats.items = items.length;
    stats.tiles = tiles;
    stats.listRows = rows;
    stats.rows = document.querySelectorAll('[data-dxe-row]').length;
    stats.rowsParents = document.querySelectorAll('[data-dxe-rows]').length;
    if (DXE.settings.debug && (stats.scans < 5 || stats.scans % 50 === 0)) {
      DXE.log(`scan #${stats.scans}: ${items.length} items, ${tiles} grid tiles, ${rows} list rows, ` +
        `${stats.rows} rows, ${stats.rowsParents} row containers`, JSON.parse(JSON.stringify(stats)));
    }
  }

  let pending = false, last = 0;
  const schedule = () => {
    if (pending) return;
    pending = true;
    const wait = Math.max(0, 120 - (performance.now() - last));
    setTimeout(() => requestAnimationFrame(() => { pending = false; last = performance.now(); try { scan(); } catch (e) { console.error('[DriveExplorer] scan failed', e); } }), wait);
  };

  let observer = null;
  DXE.tiles = {
    enable() {
      enabled = true;
      document.documentElement.classList.add('dxe-medium');
      if (!observer) {
        observer = new MutationObserver((muts) => {
          for (const m of muts) {
            const t = m.target;
            if (m.type === 'attributes' && t.closest && t.closest('[data-dxe-tile]') && m.attributeName !== 'aria-selected' && m.attributeName !== 'aria-checked') continue;
            schedule();
            return;
          }
        });
        observer.observe(document.body, {
          childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-checked', 'src', 'role'],
        });
      }
      schedule();
      DXE.log('medium icons: enabled');
    },
    disable() {
      enabled = false;
      document.documentElement.classList.remove('dxe-medium');
      if (observer) { observer.disconnect(); observer = null; }
      ATTRS.forEach((a) => document.querySelectorAll('[' + a + ']').forEach((el) => el.removeAttribute(a)));
      seen = new WeakMap();
      DXE.log('medium icons: disabled');
    },
    rescan: scan,
  };
})();
