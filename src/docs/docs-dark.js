/* Drive Explorer — filter-based dark mode for Docs / Sheets / Slides editors.
   The editors draw text on <canvas>, so CSS recolouring can't work; instead the
   whole page is inverted (invert + hue-rotate keeps hues) and real imagery is
   inverted back (see docs-dark.css). Runs at document_start; the last state is
   cached in localStorage so the page doesn't flash white while storage loads. */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  const path = location.pathname;
  const app = /^\/(?:a\/[^/]+\/)?document\//.test(path) ? 'docs'
    : /^\/(?:a\/[^/]+\/)?spreadsheets\//.test(path) ? 'sheets'
    : /^\/(?:a\/[^/]+\/)?presentation\//.test(path) ? 'slides' : null;
  if (!app) return;
  const KEY = { docs: 'darkDocs', sheets: 'darkSheets', slides: 'darkSlides' }[app];
  const CACHE = 'dxe-dark-' + app;
  const html = document.documentElement;

  const set = (on) => {
    html.classList.toggle('dxe-docs-dark', !!on);
    html.setAttribute('data-dxe-app', app);
    try { localStorage.setItem(CACHE, on ? '1' : '0'); } catch (e) { /* ignore */ }
  };

  try { if (localStorage.getItem(CACHE) === '1') set(true); } catch (e) { /* ignore */ }

  DXE.settingsReady.then((s) => {
    set(s[KEY]);
    DXE.log('docs dark mode', app, s[KEY] ? 'ON' : 'off');
  });
  DXE.onSettingsChanged((diff) => { if (KEY in diff) set(diff[KEY]); });
})();
