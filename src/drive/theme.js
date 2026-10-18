/* Drive Explorer — light/dark detection for our tiles + menu on drive.google.com.
   Drive has its own dark theme (Settings > Appearance). We follow whatever Drive
   actually paints: luminance of the main background, falling back to the OS
   prefers-color-scheme. Result: <html data-dxe-theme="light|dark">.          */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  const mq = matchMedia('(prefers-color-scheme: dark)');

  const parseRGB = (c) => {
    const m = (c || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    if (p.length >= 4 && p[3] === 0) return null; // transparent
    return p.slice(0, 3);
  };
  const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  const pageBackground = () => {
    const probes = [DXE.SEL && DXE.SEL.scopeEl && DXE.SEL.scopeEl(), document.body, document.documentElement];
    for (let el of probes) {
      for (; el; el = el.parentElement) {
        const rgb = parseRGB(getComputedStyle(el).backgroundColor);
        if (rgb) return rgb;
      }
    }
    return null;
  };

  let current = null;
  DXE.theme = () => current;
  DXE.detectTheme = () => {
    const bg = pageBackground();
    const t = bg ? (lum(bg) < 0.45 ? 'dark' : 'light') : (mq.matches ? 'dark' : 'light');
    if (t !== current) {
      current = t;
      document.documentElement.setAttribute('data-dxe-theme', t);
      DXE.log('theme →', t, bg ? 'from background rgb(' + bg.join(',') + ')' : 'from prefers-color-scheme');
      document.dispatchEvent(new CustomEvent('dxe-theme', { detail: t }));
    }
    return t;
  };
  mq.addEventListener('change', DXE.detectTheme);
  new MutationObserver(DXE.detectTheme).observe(document.documentElement, {
    attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'dark'],
  });
  setInterval(DXE.detectTheme, 4000);
})();
