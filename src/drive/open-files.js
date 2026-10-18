/* Drive Explorer — open files (Docs/Sheets/Slides/PDF/any preview) in a new
   tab or window instead of in place. Folders keep navigating in place.
   Setting openFilesIn: 'tab' | 'window' | 'drive' (= Drive default).      */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  const SEL = DXE.SEL;
  const mode = () => DXE.settings.openFilesIn || 'tab';

  const nameOf = (item) => {
    const n = item.querySelector('[data-dxe-part="name"]');
    return SEL.norm(n ? n.textContent : (SEL.analyzeTile(item).name || {}).textContent || '');
  };
  /** Only intercept when we're reasonably sure it's NOT a folder. */
  function isFile(item) {
    if (!item || SEL.isFolder(item)) return false;
    const k = SEL.fileKind(item, nameOf(item));
    if (k.kind === 'folder') return false;
    if (k.confident) return true;
    const a = SEL.analyzeTile(item);
    return !!(a.thumb || (a.icon && a.icon.tagName === 'IMG'));
  }

  let lastOpen = 0, lastKey = '';
  function open(items) {
    const urls = items.slice(0, 10).map(SEL.openUrl);
    const now = performance.now(), key = urls.join(' ');
    if (key === lastKey && now - lastOpen < 700) return true; // dedupe dblclick + Enter etc. on the same items
    lastOpen = now;
    lastKey = key;
    const m = mode();
    DXE.log('open files in', m, urls);
    const fallback = () => urls.forEach((u) => window.open(u, '_blank', m === 'window' ? 'noopener,popup' : 'noopener'));
    try {
      chrome.runtime.sendMessage({ type: 'dxe-open', urls, mode: m }, (r) => {
        if (chrome.runtime.lastError || !r || !r.ok) fallback();
      });
    } catch (e) { fallback(); }
    return true;
  }

  /** Used by our menu "Open" and Enter: true if handled. */
  function tryOpen(item) {
    if (mode() === 'drive' || !isFile(item)) return false;
    const sel = SEL.selectedItems();
    const list = sel.length > 1 && sel.includes(item) ? sel.filter(isFile) : [item];
    return open(list);
  }

  // Double-click interception (capture, before Drive). The 2nd mousedown/click
  // of a double-click is swallowed too, so Drive can't open it in place.
  const handler = (e) => {
    if (mode() === 'drive' || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    if (!e.isTrusted && e.type !== 'dblclick') return;
    if (SEL.isOurs(e.target) || (e.target.closest && e.target.closest(SEL.editable + ',[aria-haspopup]'))) return;
    const item = SEL.findItem(e.target);
    if (!item || !isFile(item)) return;
    if (e.type === 'dblclick' || e.detail >= 2) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.type === 'dblclick') open([item]);
    }
  };
  ['mousedown', 'mouseup', 'click', 'dblclick'].forEach((t) => window.addEventListener(t, handler, true));

  // Enter on selected files
  window.addEventListener('keydown', (e) => {
    if (mode() === 'drive' || e.key !== 'Enter' || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !e.isTrusted) return;
    if ((DXE.menu && DXE.menu.isOpen()) || (DXE.props && DXE.props.isOpen())) return;
    const a = document.activeElement;
    if (a && a.closest && (a.closest(SEL.editable) || SEL.isOurs(a) || a.closest(SEL.menu + ',[role="dialog"]'))) return;
    const sel = SEL.selectedItems();
    if (!sel.length || !sel.every(isFile)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    open(sel);
  }, true);

  DXE.openFiles = { tryOpen, isFile };
})();
