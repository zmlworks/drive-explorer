(() => {
  'use strict';
  const DXE = globalThis.DXE;
  const msg = (k) => (chrome.i18n && chrome.i18n.getMessage(k)) || k;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = msg(el.dataset.i18n); });
  document.getElementById('ver').textContent = 'v' + chrome.runtime.getManifest().version;
  document.documentElement.lang = chrome.i18n.getUILanguage();

  const boxes = [...document.querySelectorAll('input[data-key]')];
  const selects = [...document.querySelectorAll('select[data-key]')];
  DXE.settingsReady.then((s) => {
    boxes.forEach((b) => {
      b.checked = !!s[b.dataset.key];
      b.addEventListener('change', () => DXE.saveSetting(b.dataset.key, b.checked));
    });
    selects.forEach((sel) => {
      sel.value = s[sel.dataset.key];
      sel.addEventListener('change', () => DXE.saveSetting(sel.dataset.key, sel.value));
    });
  });

  const status = document.getElementById('status');
  async function driveTab() {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.startsWith('https://drive.google.com/')) {
      // e.g. popup opened from an installed-app window: use the last focused Drive tab
      const all = await chrome.tabs.query({ url: 'https://drive.google.com/*' });
      tab = all.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
    }
    if (!tab) throw new Error('no drive tab');
    return tab;
  }
  async function copy(type, toText, okKey) {
    status.textContent = '';
    try {
      const tab = await driveTab();
      const r = await chrome.tabs.sendMessage(tab.id, { type });
      const text = toText(r);
      await navigator.clipboard.writeText(text);
      status.textContent = msg(okKey).replace('$1', Math.round(text.length / 1024) + ' KB');
    } catch (e) {
      status.textContent = msg('diagNoTab');
    }
  }
  document.getElementById('diag').addEventListener('click', () => copy('dxe-report', (r) => JSON.stringify(r, null, 2), 'diagCopied'));
  document.getElementById('structure').addEventListener('click', () => copy('dxe-structure', (r) => {
    if (!r || !r.ok) throw new Error(r && r.error);
    return r.text;
  }, 'structureCopied'));
  document.getElementById('structureLater').addEventListener('click', async () => {
    status.textContent = '';
    try {
      const tab = await driveTab();
      await chrome.tabs.sendMessage(tab.id, { type: 'dxe-structure-later', delay: 5000 });
      status.textContent = msg('structureLaterArmed');
    } catch (e) { status.textContent = msg('diagNoTab'); }
  });
  document.getElementById('structureLast').addEventListener('click', async () => {
    status.textContent = '';
    const { dxeLastStructure: last } = await chrome.storage.local.get('dxeLastStructure');
    if (!last || !last.text) { status.textContent = msg('structureNone'); return; }
    await navigator.clipboard.writeText(last.text);
    status.textContent = msg('structureCopied').replace('$1', Math.round(last.text.length / 1024) + ' KB, ' + new Date(last.at).toLocaleTimeString());
  });
})();
