/*
 * Drive Explorer — ALL knowledge about Google Drive's DOM lives here.
 *
 * Drive's class names are obfuscated and change frequently, so this module only
 * relies on (comparatively) stable hooks: role=*, aria-*, data-id, data-target,
 * plus geometry/text heuristics. When Drive changes, this is the file to update.
 * Every lookup records which strategy matched, so the debug toggle / diagnostics
 * can tell you what to fix.
 */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});

  const S = (DXE.SEL = {
    revision: '2026-10-18b',

    /* Elements that represent one file/folder. Tried in order; the first
       selector whose closest() hits wins. Grid tiles and list rows both match. */
    item: [
      '[data-id][data-target="doc"]',
      '[role="gridcell"][data-id]',
      '[role="row"][data-id]',
      '[role="option"][data-id]',
      '[data-id][aria-selected]',
      '[data-id][tabindex]',
    ],
    /* Where items live. Items outside these (e.g. our own UI) are ignored. */
    scope: ['[role="main"]', 'main', 'body'],
    /* Drive's native popup menus and their items. */
    menu: '[role="menu"]',
    menuItem: '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]',
    /* Never hijack right-clicks inside editable things. */
    editable: 'input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"]',
    /* Per-item "More actions" (⋮) button — fallback for opening the native menu. */
    moreButton: [
      '[aria-label="More actions"]', '[aria-label^="More actions"]', '[aria-label="その他の操作"]',
      '[aria-label^="その他の操作"]', '[aria-label="More options"]', '[aria-label="その他のオプション"]',
    ],
    /* Images smaller than this are treated as file-type icons, not thumbnails. */
    iconMaxPx: 32,
    /* File-type icon URLs (e.g. drive-thirdparty.googleusercontent.com/16/type/...). */
    iconSrc: /\/\d+\/type\/|\/icons?\/|icon_|\/mimetype/i,
  });

  /* ---------- label dictionary (English + Japanese Drive UI) ----------------
     Matched against a menu item's aria-label, its first text line and every
     leaf text node (so trailing shortcut hints like "Ctrl+Alt+E" don't matter).
     Anchored, case-insensitive, whitespace-normalised, NFKC-normalised.        */
  const L = (S.LABELS = {
    OPEN_WITH: /^(open with|アプリで開く)$/i,
    DOWNLOAD: /^(download|ダウンロード)$/i,
    RENAME: /^(rename|名前を変更)$/i,
    MAKE_COPY: /^(make a copy|コピーを作成)$/i,
    SHARE: /^(share|共有)$/i,
    COPY_LINK: /^(copy link|リンクをコピー)$/i,
    ORGANIZE: /^(organi[sz]e|整理)$/i,
    MOVE: /^(move|移動)$/i,
    ADD_SHORTCUT: /^(add shortcut( to drive)?|(ドライブに)?ショートカットを追加)$/i,
    STAR: /^(add to starred|remove from starred|starred|スターを付ける|スターを外す|スター付きに追加|スター付きから削除)$/i,
    FILE_INFO: /^(file information|folder information|ファイル情報|フォルダ情報)$/i,
    DETAILS: /^(details|view details|詳細|詳細を表示)$/i,
    TRASH: /^(move to trash|move to bin|remove|ゴミ箱に移動|削除)$/i,
  });

  /* ---------- action table --------------------------------------------------
     paths:   label paths through the native context menu (submenus in between).
              Tried in order. The final step must NOT be a submenu parent.
     toolbar: aria-labels of buttons in Drive's selection action bar.
     keys:    Drive keyboard shortcuts dispatched as a last resort.          */
  S.ACTIONS = {
    open: { custom: 'open' },
    openNewTab: { custom: 'openNewTab', multi: true },
    download: {
      paths: [[L.DOWNLOAD]],
      toolbar: /^(download|ダウンロード)$/i,
    },
    rename: {
      paths: [[L.RENAME]],
      keys: [{ key: 'n', code: 'KeyN', keyCode: 78 }],
      single: true,
    },
    copyLink: {
      paths: [[L.SHARE, L.COPY_LINK], [L.COPY_LINK]],
      toolbar: /^(copy link|リンクをコピー)$/i,
      custom: 'copyLinkFallback',
    },
    share: {
      paths: [[L.SHARE, L.SHARE], [L.SHARE]],
      toolbar: /^(share|共有)$/i,
      keys: [{ key: '.', code: 'Period', keyCode: 190 }],
    },
    move: {
      paths: [[L.ORGANIZE, L.MOVE], [L.MOVE]],
      toolbar: /^(move|移動)$/i,
      keys: [{ key: 'z', code: 'KeyZ', keyCode: 90 }],
    },
    addShortcut: {
      paths: [[L.ORGANIZE, L.ADD_SHORTCUT], [L.ADD_SHORTCUT]],
      keys: [{ key: 'Z', code: 'KeyZ', keyCode: 90, shiftKey: true }],
    },
    star: {
      paths: [[L.ORGANIZE, L.STAR], [L.STAR]],
      keys: [{ key: 's', code: 'KeyS', keyCode: 83 }],
    },
    makeCopy: { paths: [[L.MAKE_COPY]] },
    info: {
      paths: [[L.FILE_INFO, L.DETAILS], [L.DETAILS]],
      toolbar: /^(view details|details|詳細を表示|詳細)$/i,
    },
    delete: {
      paths: [[L.TRASH]],
      toolbar: /^(move to trash|move to bin|remove|ゴミ箱に移動|削除)$/i,
      keys: [{ key: 'Delete', code: 'Delete', keyCode: 46 }],
    },
    driveMenu: { custom: 'driveMenu' },
    properties: { custom: 'properties', single: true },
  };

  /* ---------------- generic helpers ---------------- */
  const norm = (s) => (s || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  S.norm = norm;

  S.isShown = (el) => {
    if (!el || !el.isConnected) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  };

  S.isOurs = (el) => !!(el && el.closest && el.closest('#dxe-menu-host,#dxe-props-host,[data-dxe-ui]'));

  /* Label candidates of an element: aria-label, first line, every leaf text. */
  S.labelCandidates = (el) => {
    const out = new Set();
    const aria = norm(el.getAttribute('aria-label'));
    if (aria) out.add(aria);
    const first = norm((el.innerText || el.textContent || '').split('\n')[0]);
    if (first) out.add(first);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = norm(n.nodeValue);
      if (t) out.add(t);
    }
    return [...out];
  };
  S.matchesLabel = (el, re) => S.labelCandidates(el).some((c) => re.test(c));

  /* ---------------- items ---------------- */
  const scopeEl = () => {
    for (const sel of S.scope) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return document.body;
  };
  S.scopeEl = scopeEl;

  /** Item (file/folder element) containing `target`, or null. */
  S.findItem = (target) => {
    if (!target || !target.closest || S.isOurs(target)) return null;
    for (let i = 0; i < S.item.length; i++) {
      const el = target.closest(S.item[i]);
      if (el && el.getAttribute('data-id')) {
        DXE.log('findItem matched selector #' + i, S.item[i], el);
        return el;
      }
    }
    return null;
  };

  /** All item elements currently in the DOM (deduped: outermost data-id wins). */
  S.allItems = () => {
    const root = scopeEl();
    const set = new Set();
    for (const sel of S.item) root.querySelectorAll(sel).forEach((el) => set.add(el));
    return [...set].filter((el) => {
      const p = el.parentElement && el.parentElement.closest('[data-id]');
      return !(p && set.has(p) && p.getAttribute('data-id') === el.getAttribute('data-id'));
    });
  };

  S.itemId = (item) => (item && item.getAttribute('data-id')) || '';

  /** Grid tile (not a list-view row)? */
  S.isGridTile = (item) => {
    if (!item) return false;
    if (item.getAttribute('role') === 'row') return false; // list view row
    if (item.closest('[role="row"][data-id]') && item.closest('[role="row"][data-id]') !== item) return false;
    if (item.matches('[role="gridcell"]') || item.closest('[role="gridcell"]')) {
      // List view also has gridcells, but there the data-id sits on the row (caught above).
      return true;
    }
    // Geometry fallback: tiles are narrow, list rows span the view.
    const r = item.getBoundingClientRect();
    const parent = item.parentElement && item.parentElement.getBoundingClientRect();
    return r.width > 0 && r.width < 360 && (!parent || r.width < parent.width * 0.6);
  };

  S.isSelected = (item) => {
    if (!item) return false;
    if (item.getAttribute('aria-selected') === 'true') return true;
    const cell = item.closest('[aria-selected]');
    if (cell && cell.getAttribute('aria-selected') === 'true' && cell.contains(item)) return true;
    const own = item.querySelector('[aria-selected="true"],[role="checkbox"][aria-checked="true"]');
    return !!own;
  };

  S.selectedItems = () => S.allItems().filter(S.isSelected);

  S.isFolder = (item) => {
    if (!item) return false;
    if (item.closest('[data-mime-type="application/vnd.google-apps.folder"]')) return true;
    const labels = [item.getAttribute('aria-label') || ''];
    item.querySelectorAll('[aria-label]').forEach((n) => labels.push(n.getAttribute('aria-label') || ''));
    return labels.some((l) => /(^|\s)(shared )?folder\b|フォルダ/i.test(l));
  };

  S.findMoreButton = (item) => {
    for (const sel of S.moreButton) {
      const b = item.querySelector(sel);
      if (b) return b;
    }
    return item.querySelector('[aria-haspopup="true"],[aria-haspopup="menu"]');
  };

  /* ---------------- tile anatomy ----------------
     Returns { name, thumb, icon, more, layout, strategy } for a grid tile. */
  const area = (el) => {
    const r = el.getBoundingClientRect();
    return r.width * r.height;
  };

  const findName = (tile) => {
    // 1. element carrying the tooltip / title with the file name
    const aria = norm(tile.getAttribute('aria-label'));
    const textLeaves = [];
    const walker = document.createTreeWalker(tile, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = norm(n.nodeValue);
      const el = n.parentElement;
      if (!t || !el || el.closest('button,[role="button"],[role="checkbox"]')) continue;
      textLeaves.push({ el, t });
    }
    if (!textLeaves.length) return { el: null, strategy: 'none' };
    // 2. leaf text that is a prefix of the tile's aria-label ("name  Google Docs ...")
    if (aria) {
      const hit = textLeaves
        .filter((x) => x.t.length > 0 && aria.startsWith(x.t))
        .sort((a, b) => b.t.length - a.t.length)[0];
      if (hit) return { el: hit.el, strategy: 'aria-label-prefix' };
    }
    // 3. leaf with data-tooltip/title equal to its text
    const tip = textLeaves.find((x) => {
      const holder = x.el.closest('[data-tooltip],[title]');
      return holder && tile.contains(holder) &&
        norm(holder.getAttribute('data-tooltip') || holder.getAttribute('title')) === x.t;
    });
    if (tip) return { el: tip.el, strategy: 'tooltip' };
    // 4. longest leaf text
    const longest = textLeaves.sort((a, b) => b.t.length - a.t.length)[0];
    return { el: longest.el, strategy: 'longest-text' };
  };

  S.analyzeTile = (tile) => {
    const res = { tile, name: null, thumb: null, icon: null, more: null, strategy: {} };
    const nm = findName(tile);
    res.name = nm.el;
    res.strategy.name = nm.strategy;

    const imgs = [...tile.querySelectorAll('img,[role="img"],svg')].filter((el) => !el.closest('button,[role="button"]'));
    let best = null, bestA = 0;
    for (const el of imgs) {
      // an <svg> drawn inside a role=img wrapper is represented by the wrapper
      const wrap = el.tagName.toLowerCase() === 'svg' && el.parentElement && el.parentElement.closest('[role="img"]');
      if (wrap && tile.contains(wrap)) continue;
      const r = el.getBoundingClientRect();
      // Our own CSS resizes things, so remember earlier classification.
      const part = el.getAttribute('data-dxe-part');
      const src = el.tagName === 'IMG' ? (el.currentSrc || el.getAttribute('src') || '') : '';
      const iconBySrc = S.iconSrc.test(src);
      const unloaded = el.tagName === 'IMG' && r.width < 2 && !iconBySrc && src;
      const a = unloaded ? (el.naturalWidth * el.naturalHeight || 1) : r.width * r.height;
      const isSmall = part === 'icon' || iconBySrc ||
        (part !== 'thumb' && !unloaded && r.width <= S.iconMaxPx && r.height <= S.iconMaxPx);
      if (isSmall) {
        if (!res.icon && !(res.name && el.contains(res.name))) res.icon = el;
      } else if (el.tagName === 'IMG' || el.getAttribute('role') === 'img') {
        if (a > bestA) { best = el; bestA = a; }
      }
    }
    // Background-image thumbnails (fallback)
    if (!best) {
      for (const el of tile.querySelectorAll('div')) {
        if (/url\(/.test(el.style.backgroundImage || '') && area(el) > (S.iconMaxPx * S.iconMaxPx)) { best = el; break; }
      }
      if (best) res.strategy.thumb = 'background-image';
    } else res.strategy.thumb = best.tagName.toLowerCase();
    res.thumb = best;
    res.strategy.icon = res.icon ? res.icon.tagName.toLowerCase() : 'none';
    res.more = S.findMoreButton(tile);
    return res;
  };

  /* Row/grid structure for one tile: { cell, row, rowsParent } */
  S.tileContainers = (tile) => {
    const rowEl = tile.parentElement && tile.parentElement.closest('[role="row"]');
    const grid = tile.closest('[role="grid"],[role="listbox"],[role="list"]');
    if (rowEl && (!grid || grid.contains(rowEl))) {
      let cell = tile;
      while (cell.parentElement && cell.parentElement !== rowEl) cell = cell.parentElement;
      return { cell, row: rowEl, rowsParent: rowEl.parentElement, strategy: 'role=row' };
    }
    // No row wrapper: the tile's (gridcell) wrapper is the flex item.
    const cell = tile.closest('[role="gridcell"]') || tile;
    return { cell, row: null, rowsParent: cell.parentElement, strategy: 'parent' };
  };

  /* ---------------- native menus ---------------- */
  S.visibleMenus = () => [...document.querySelectorAll(S.menu)].filter((m) => !S.isOurs(m) && S.isShown(m));

  S.menuItems = (menu) => [...menu.querySelectorAll(S.menuItem)].filter((it) => S.isShown(it));

  S.isDisabled = (el) => el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled');

  S.hasSubmenu = (el) => {
    const hp = el.getAttribute('aria-haspopup');
    return (hp && hp !== 'false') || el.hasAttribute('aria-expanded');
  };

  /* Selection action bar buttons (outside items). */
  S.findToolbarButton = (re) => {
    const cands = document.querySelectorAll('[role="button"][aria-label],button[aria-label],[role="button"][data-tooltip]');
    for (const b of cands) {
      if (S.isOurs(b) || b.closest('[data-id]') || b.closest(S.menu)) continue;
      const lbl = norm(b.getAttribute('aria-label') || b.getAttribute('data-tooltip'));
      if (re.test(lbl) && S.isShown(b) && !S.isDisabled(b)) return b;
    }
    return null;
  };

  /* ---------------- URLs ---------------- */
  S.authUser = () => {
    const m = location.pathname.match(/\/u\/(\d+)\//);
    return m ? m[1] : null;
  };
  S.openUrl = (item) => {
    const id = encodeURIComponent(S.itemId(item));
    const u = S.authUser();
    if (S.isFolder(item)) return `https://drive.google.com/drive/${u !== null ? 'u/' + u + '/' : ''}folders/${id}`;
    return `https://drive.google.com/open?id=${id}${u !== null ? '&authuser=' + u : ''}`;
  };
  S.shareUrl = (item) => {
    const id = encodeURIComponent(S.itemId(item));
    return S.isFolder(item)
      ? `https://drive.google.com/drive/folders/${id}?usp=sharing`
      : `https://drive.google.com/file/d/${id}/view?usp=sharing`;
  };


  /* ---------------- details side panel ("Details" / "ファイル情報") ----------------
     Drive's right-hand pane. Found by its Details/Activity tabs (or a
     role=complementary column) plus geometry: a narrow column on the right that
     never contains the file list. */
  const D = (S.DETAILS = {
    tabDetails: /^(details|詳細)$/i,
    tabActivity: /^(activity|アクティビティ)$/i,
    closeButton: /^(close|close details|hide details|閉じる|詳細を閉じる|詳細を非表示|詳細パネルを閉じる)$/i,
    hideToolbar: /^(hide details|詳細を非表示)$/i,
    /* button texts that are UI, not values */
    ignoreText: /^(manage access|アクセスを管理|share|共有|edit|編集|add description|説明を追加|show more|もっと見る|さらに表示)$/i,
    /* section headings that are not label/value pairs */
    headings: /^(file details|folder details|ファイルの詳細|フォルダの詳細|details|詳細|activity|アクティビティ)$/i,
    maxWidthRatio: 0.5,
    /* label → field key (English + Japanese Drive UI) */
    labels: {
      type: /^(type|種類|ファイルの種類)$/i,
      size: /^(size|サイズ|ファイルサイズ)$/i,
      storage: /^(storage used|使用容量|使用済みの容量|ストレージ使用量|ストレージの使用量)$/i,
      location: /^(location|場所)$/i,
      owner: /^(owner|オーナー|所有者)$/i,
      modified: /^(modified|last modified|最終更新|最終更新日|更新日|更新日時)$/i,
      opened: /^(opened|opened by me|last opened|最終閲覧|最終閲覧日|自分が最後に開いた日|自分が開いた日|開いた日)$/i,
      created: /^(created|作成日|作成|作成日時)$/i,
      access: /^(who has access|has access|access|アクセスできるユーザー|アクセス権のあるユーザー|アクセス権|アクセス)$/i,
      download: /^(download permissions|ダウンロード権限|ダウンロードの権限)$/i,
      description: /^(description|説明)$/i,
      shared: /^(shared|共有日|共有)$/i,
    },
  });

  S.labelKey = (text) => {
    const t = norm(text);
    for (const k of Object.keys(D.labels)) if (D.labels[k].test(t)) return k;
    return null;
  };

  const tabMatches = (re) => [...document.querySelectorAll('[role="tab"]')].filter((t) => !S.isOurs(t) && S.matchesLabel(t, re));

  S.detailsTab = (panel) => [...(panel || document).querySelectorAll('[role="tab"]')].find((t) => S.matchesLabel(t, D.tabDetails));

  /** The details panel column, or null. Records strategy in S.lastDetailsStrategy. */
  S.findDetailsPanel = () => {
    const vw = innerWidth;
    const okColumn = (el) => {
      if (!el || S.isOurs(el) || el === document.body || el === document.documentElement) return false;
      // never the file list (or anything containing it)
      if (el.querySelector('[role="main"],[role="grid"],[role="grid"] [data-id]')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 120 && r.width <= Math.max(480, vw * D.maxWidthRatio) && r.height > 150 && r.left >= vw * 0.35;
    };
    const climb = (el) => {
      let best = null;
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        if (okColumn(p)) best = p; else if (best) break;
      }
      return best;
    };
    // 1. Details + Activity tabs side by side
    for (const tab of tabMatches(D.tabDetails)) {
      const list = tab.closest('[role="tablist"]') || tab.parentElement;
      if (!list || !tabMatches(D.tabActivity).some((a) => list.contains(a))) continue;
      const col = climb(list);
      if (col) { S.lastDetailsStrategy = 'tabs'; return col; }
    }
    // 2. complementary landmark on the right
    for (const c of document.querySelectorAll('[role="complementary"],aside')) {
      if (S.isOurs(c)) continue;
      const known = S.labelCandidates(c).filter((t) => S.labelKey(t)).length;
      if (known >= 2) { const col = climb(c); if (col) { S.lastDetailsStrategy = 'complementary'; return col; } }
    }
    return null;
  };

  S.findDetailsClose = (panel) => {
    for (const b of panel.querySelectorAll('[role="button"],button')) {
      const l = norm(b.getAttribute('aria-label') || b.getAttribute('data-tooltip') || b.textContent);
      if (D.closeButton.test(l)) return b;
    }
    return null;
  };

  S.uiLang = () => ((document.documentElement.lang || navigator.language || 'en').toLowerCase().startsWith('ja') ? 'ja' : 'en');
})();
