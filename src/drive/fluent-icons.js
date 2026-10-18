/* Drive Explorer — our own Windows 11 (Fluent-like) file-type icons, 32×32.
   Drawn from scratch (no third-party artwork). */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});

  const page = (accent) => `
    <path d="M7.5 2.5h11l7 7v18a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-23a2 2 0 0 1 2-2z" fill="#fff" stroke="#9a9a9a"/>
    <path d="M18.5 2.5v5a2 2 0 0 0 2 2h5" fill="#eaeaea" stroke="#9a9a9a" stroke-linejoin="round"/>
    ${accent || ''}`;
  const badge = (color, inner) => `<rect x="3" y="15" width="15" height="12" rx="2" fill="${color}"/>${inner}`;
  const lines = (c, x = 20, ys = [14, 17, 20, 23]) => ys.map((y) => `<path d="M${x} ${y}h4" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>`).join('');

  const SVG = {
    folder: `
      <path d="M2.5 7.5a2 2 0 0 1 2-2h7l3 3h13a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2h-23a2 2 0 0 1-2-2z" fill="#E8A21A"/>
      <path d="M2.5 11.5a2 2 0 0 1 2-2h23a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-23a2 2 0 0 1-2-2z" fill="#FFCA3A"/>
      <path d="M2.5 11.5a2 2 0 0 1 2-2h23a2 2 0 0 1 2 2v1h-27z" fill="#FFD966"/>`,
    doc: page(badge('#2B7CD3', '<path d="M6 18.5l1.4 5.5 1.6-4.5 1.6 4.5 1.4-5.5" fill="none" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/>') + lines('#2B7CD3')),
    sheet: page(badge('#1F9D55', '<path d="M6.5 18.5l4 5.5M10.5 18.5l-4 5.5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>') +
      '<path d="M19.5 13.5h5v11h-5zM19.5 17.2h5M19.5 20.8h5M22 13.5v11" fill="none" stroke="#1F9D55" stroke-width="1"/>'),
    slide: page(badge('#D35230', '<path d="M7 18.5v6M7 18.5h2.6a1.8 1.8 0 0 1 0 3.6H7" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>') +
      '<rect x="19.5" y="13.5" width="5.5" height="5" rx="1" fill="none" stroke="#D35230"/>' + lines('#D35230', 20, [22, 25])),
    pdf: page(badge('#D7262B', '<text x="10.5" y="24" font-family="Segoe UI,Arial,sans-serif" font-size="6.2" font-weight="700" fill="#fff" text-anchor="middle">PDF</text>') + lines('#D7262B')),
    image: page('<rect x="7" y="12" width="17" height="13" rx="1.5" fill="#E7F1FB" stroke="#4A90D9"/><circle cx="19.5" cy="15.8" r="1.7" fill="#F4B400"/><path d="M7.5 24.5l5-6 3.5 4 2.5-2.5 5 4.5" fill="#43A047" stroke="#2E7D32" stroke-width=".8" stroke-linejoin="round"/>'),
    video: page('<rect x="7" y="12" width="17" height="13" rx="1.5" fill="#EDE7F6" stroke="#7E57C2"/><path d="M13.5 15.5v6l5-3z" fill="#7E57C2"/>'),
    audio: page('<path d="M14 23.5v-9l7-1.8v9" fill="none" stroke="#E65100" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12.3" cy="23.5" r="2" fill="#E65100"/><circle cx="19.3" cy="21.7" r="2" fill="#E65100"/>'),
    zip: page('<rect x="11.5" y="3" width="3.5" height="15" fill="#F2C94C"/><path d="M11.5 5h3.5M11.5 8h3.5M11.5 11h3.5M11.5 14h3.5" stroke="#9A7B1B" stroke-width="1"/><rect x="10.5" y="17.5" width="5.5" height="6" rx="1" fill="#9A7B1B"/>'),
    text: page(lines('#7a7a7a', 9, [13, 16, 19, 22, 25]).replace(/h4/g, 'h14')),
    file: page(),
    binEmpty: `
      <path d="M8 9.5h16l-1.6 18a2 2 0 0 1-2 1.8h-8.8a2 2 0 0 1-2-1.8z" fill="#E3EEF9" stroke="#5B8DC9"/>
      <path d="M6.5 8.5h19" stroke="#5B8DC9" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M13 6.5h6" stroke="#5B8DC9" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M13 13l.6 12M19 13l-.6 12M16 13v12" stroke="#9DBDE3" stroke-width="1"/>`,
    binFull: `
      <path d="M10 9.5l3-4.5 4 2 3-3 2.5 5.5" fill="#fff" stroke="#9a9a9a"/>
      <path d="M11.5 9l4.5-2.5 3.5 2.5" fill="#FFE08A" stroke="#C9A227"/>
      <path d="M8 9.5h16l-1.6 18a2 2 0 0 1-2 1.8h-8.8a2 2 0 0 1-2-1.8z" fill="#E3EEF9" stroke="#5B8DC9"/>
      <path d="M6.5 9.5h19" stroke="#5B8DC9" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M13 13l.6 12M19 13l-.6 12M16 13v12" stroke="#9DBDE3" stroke-width="1"/>`,
  };
  DXE.ICONS = {
    kinds: Object.keys(SVG).filter((k) => !k.startsWith('bin')),
    svg: (kind, size = 32) => `<svg viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true" focusable="false">${SVG[kind] || SVG.file}</svg>`,
  };
})();
