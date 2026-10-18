/* Drive Explorer — shared settings + logging (content scripts and popup). */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  if (DXE.settingsReady) return;

  DXE.VERSION = '0.3.0';
  DXE.DEFAULTS = Object.freeze({
    mediumIcons: true,
    contextMenu: true,
    suppressDetails: true,
    fluentIcons: true,
    explorerToolbar: true,
    statusBar: true,
    hideSuggestions: true,
    recycleBin: true,
    ctrlCCopiesLink: true,
    openFilesIn: 'tab', // 'tab' | 'window' | 'drive'
    rootRedirectApp: true,
    rootRedirectTabs: false,
    darkDocs: false,
    darkSheets: false,
    darkSlides: false,
    debug: false,
  });
  DXE.settings = { ...DXE.DEFAULTS };

  const hasStorage = () => typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;

  DXE.settingsReady = new Promise((resolve) => {
    if (!hasStorage()) return resolve(DXE.settings);
    try {
      chrome.storage.sync.get(DXE.DEFAULTS, (v) => {
        Object.assign(DXE.settings, v || {});
        resolve(DXE.settings);
      });
    } catch (e) {
      resolve(DXE.settings);
    }
  });

  DXE.saveSetting = (key, value) => {
    DXE.settings[key] = value;
    if (hasStorage()) chrome.storage.sync.set({ [key]: value });
  };

  const listeners = [];
  DXE.onSettingsChanged = (fn) => listeners.push(fn);
  if (hasStorage() && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      const diff = {};
      for (const k of Object.keys(changes)) {
        DXE.settings[k] = changes[k].newValue;
        diff[k] = changes[k].newValue;
      }
      listeners.forEach((fn) => {
        try { fn(diff, DXE.settings); } catch (e) { console.error('[DriveExplorer]', e); }
      });
    });
  }

  const TAG = '%c[DriveExplorer]';
  const STYLE = 'color:#0078d4;font-weight:bold';
  DXE.log = (...a) => { if (DXE.settings.debug) console.log(TAG, STYLE, ...a); };
  DXE.warn = (...a) => { if (DXE.settings.debug) console.warn(TAG, STYLE, ...a); };
})();
