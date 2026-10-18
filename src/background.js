/* Drive Explorer — service worker. Only job: open Drive/Docs URLs in a new
   tab or window for the content script (no extra permissions needed). */
'use strict';
const ALLOWED = /^https:\/\/(drive|docs)\.google\.com\//;

async function openUrls(urls, mode, sender) {
  const tab = sender && sender.tab;
  if (mode === 'window') {
    await chrome.windows.create({ url: urls, focused: true, type: 'normal' });
    return;
  }
  let windowId, index;
  if (tab) {
    try {
      const w = await chrome.windows.get(tab.windowId);
      // installed-app / popup windows can't take extra tabs → use a normal window
      if (w.type === 'normal') { windowId = tab.windowId; index = tab.index + 1; }
    } catch (e) { /* ignore */ }
  }
  for (let i = 0; i < urls.length; i++) {
    const opts = { url: urls[i], active: i === 0 };
    if (windowId !== undefined) { opts.windowId = windowId; opts.index = index + i; opts.openerTabId = tab.id; }
    try { await chrome.tabs.create(opts); } catch (e) { await chrome.tabs.create({ url: urls[i], active: i === 0 }); }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.type !== 'dxe-open') return false;
  const urls = (msg.urls || []).filter((u) => typeof u === 'string' && ALLOWED.test(u)).slice(0, 10);
  if (!urls.length) { reply({ ok: false }); return false; }
  openUrls(urls, msg.mode, sender).then(() => reply({ ok: true }), (e) => reply({ ok: false, error: String(e) }));
  return true;
});
