/* Drive Explorer — frame helper (all_frames). If Drive renders the details
   pane body inside a cross-origin iframe on drive/docs.google.com, the top
   page cannot read it directly; it asks this script via postMessage and gets
   the label/value pairs back. Does nothing in the top frame. */
(() => {
  'use strict';
  if (window.top === window) return;
  const DXE = globalThis.DXE;
  if (!DXE || !DXE.scrapeCore || DXE.frameScrape) return;
  DXE.frameScrape = true;
  const PARENTS = /^https:\/\/drive\.google\.com$/;
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.__dxe !== 'scrape' || e.source !== window.parent || !PARENTS.test(e.origin)) return;
    let result;
    try { result = DXE.scrapeCore.scrapeRoot(document.body || document.documentElement); } catch (err) { result = { pairs: [], error: String(err) }; }
    window.parent.postMessage({ __dxe: 'scrape-result', id: d.id, result, href: location.host + location.pathname.replace(/[A-Za-z0-9_-]{20,}/g, '<id>') }, e.origin);
  });
})();
