/* Drive Explorer — registered at document_start so our capture-phase listeners
   run before any listener Drive adds to window later. Real handlers are
   installed by main.js (document_idle) into DXE.handlers. */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  if (DXE.earlyListeners) return;
  DXE.earlyListeners = true;
  DXE.handlers = DXE.handlers || {};
  window.addEventListener('contextmenu', (e) => DXE.handlers.contextmenu && DXE.handlers.contextmenu(e), true);
  window.addEventListener('keydown', (e) => DXE.handlers.keydown && DXE.handlers.keydown(e), true);
})();
