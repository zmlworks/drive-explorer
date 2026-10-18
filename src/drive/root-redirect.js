/* Drive Explorer — "My Drive is root": when Drive is launched as an installed
   app window (or, optionally, in a normal tab) and lands on Home, go to My
   Drive once. Runs at document_start, before Drive boots. */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  const KEY = 'dxe-root-redirect-done';
  const isApp = () => ['standalone', 'window-controls-overlay', 'minimal-ui', 'fullscreen']
    .some((m) => matchMedia(`(display-mode: ${m})`).matches) ||
    !!(navigator.windowControlsOverlay && navigator.windowControlsOverlay.visible);
  DXE.isAppWindow = isApp;

  const m = location.pathname.match(/^\/drive(?:\/u\/(\d+))?\/?(home)?\/?$/);
  const landing = location.pathname === '/' || !!m;
  if (!landing) return;
  let done = false;
  try { done = sessionStorage.getItem(KEY) === '1'; } catch (e) { /* ignore */ }
  if (done) return;

  DXE.settingsReady.then((s) => {
    const app = isApp();
    if (!(app ? s.rootRedirectApp : s.rootRedirectTabs)) return;
    try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ }
    const u = m && m[1] != null ? `/drive/u/${m[1]}` : '/drive';
    const target = location.origin + u + '/my-drive' + location.search + location.hash;
    DXE.log('root redirect (' + (app ? 'app window' : 'tab') + ') →', target);
    location.replace(target);
  });
})();
