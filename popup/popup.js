(() => {
  'use strict';
  const DXE = globalThis.DXE;
  const msg = (k) => (chrome.i18n && chrome.i18n.getMessage(k)) || k;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = msg(el.dataset.i18n); });
  document.getElementById('ver').textContent = 'v' + chrome.runtime.getManifest().version;
  document.documentElement.lang = chrome.i18n.getUILanguage();

  const boxes = [...document.querySelectorAll('input[data-key]')];
  DXE.settingsReady.then((s) => {
    boxes.forEach((b) => {
      b.checked = !!s[b.dataset.key];
      b.addEventListener('change', () => DXE.saveSetting(b.dataset.key, b.checked));
    });
  });

  const status = document.getElementById('status');
  document.getElementById('diag').addEventListener('click', async () => {
    status.textContent = '';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.startsWith('https://drive.google.com/')) throw new Error('no drive tab');
      const report = await chrome.tabs.sendMessage(tab.id, { type: 'dxe-report' });
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      status.textContent = msg('diagCopied');
    } catch (e) {
      status.textContent = msg('diagNoTab');
    }
  });
})();
