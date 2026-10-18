/* Drive Explorer — hide "Suggested folders / files", "Suggested", quick
   access carousels and Gemini/Workspace suggestion chips (Home + My Drive).
   Tags sections with data-dxe-sugg; CSS (html.dxe-hide-sugg) hides them.  */
(() => {
  'use strict';
  const DXE = (globalThis.DXE = globalThis.DXE || {});
  const SEL = DXE.SEL;
  const G = SEL.SUGGEST;
  const norm = SEL.norm;
  const stats = (DXE.suggStats = { hidden: 0, via: {} });

  const isSuggHeading = (el) => G.headings.test(norm(el.textContent));
  const isOtherHeading = (el) => !isSuggHeading(el) && !!norm(el.textContent);

  /** climb from a heading to its section without swallowing other content */
  function sectionOf(h, main) {
    let best = h.parentElement && h.parentElement !== main ? h.parentElement : h;
    const grids = (el) => [...el.querySelectorAll('[role="grid"],[role="list"],[role="listbox"]')];
    for (let p = best.parentElement; p && p !== main && p !== document.body; p = p.parentElement) {
      if (SEL.headingEls(p).some(isOtherHeading)) break;
      // don't swallow a list/grid that lives outside the current section
      if (grids(p).some((g) => !best.contains(g) && g.querySelector('[data-id]'))) break;
      if (p.contains(SEL.scopeEl().querySelector('[data-dxe-rows]')) && !best.contains(SEL.scopeEl().querySelector('[data-dxe-rows]'))) break;
      best = p;
    }
    return best;
  }

  function mark(el, via) {
    if (!el || el.hasAttribute('data-dxe-sugg') || el.matches('[role="main"],body,html') || SEL.isOurs(el)) return;
    // never hide the main file list
    const all = SEL.allItems().length;
    const inside = el.querySelectorAll('[data-id]').length;
    if (all > 0 && inside === all && !SEL.NAV.homePath.test(location.pathname) && el.querySelectorAll('[data-dxe-tile],[role="row"][data-id]').length > 6) return;
    el.setAttribute('data-dxe-sugg', via);
    stats.hidden++;
    stats.via[via] = (stats.via[via] || 0) + 1;
    DXE.log('suggestions: hiding', via, el);
    if (DXE.tiles && DXE.tiles.refresh) DXE.tiles.refresh();
  }

  function scan() {
    // always tag (so Medium icons leaves these carousels alone); CSS hides only when the option is on
    const main = SEL.scopeEl();
    // 1. headings (role=heading / h*) and short leaf texts that read like headings
    const heads = SEL.headingEls(main).filter(isSuggHeading);
    for (const el of main.querySelectorAll('div,span')) {
      if (el.children.length || el.closest('[data-id],[data-dxe-sugg]') || SEL.isOurs(el)) continue;
      const t = norm(el.textContent);
      if (t.length && t.length < 30 && G.headings.test(t) && !el.closest('button,[role="button"],[role="tab"],[role="menuitem"]')) heads.push(el);
    }
    heads.forEach((h) => { if (!h.closest('[data-dxe-sugg]')) mark(sectionOf(h, main), 'heading'); });
    // 2. regions / carousels labelled as suggestions or quick access
    document.querySelectorAll('[aria-label]').forEach((el) => {
      if (el.closest('[data-dxe-sugg]') || el.closest('[data-id]') || SEL.isOurs(el)) return;
      const al = norm(el.getAttribute('aria-label'));
      if (G.headings.test(al) && el.matches('[role="region"],[role="list"],[role="listbox"],[role="grid"],section,div')) mark(el, 'aria-region');
      else if (G.chips.test(al) && el.matches('[role="button"],button,[role="link"],[role="region"],[role="toolbar"],[role="listbox"],[role="list"]') && !el.closest('[role="dialog"],' + SEL.menu)) mark(el, 'chip');
    });
  }

  let t = 0;
  const schedule = () => {
    if (t) return; // throttle (Drive mutates constantly)
    t = setTimeout(() => { t = 0; try { scan(); } catch (e) { console.error('[DriveExplorer] suggestions', e); } }, 400);
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });

  DXE.suggestions = {
    apply(on) {
      document.documentElement.classList.toggle('dxe-hide-sugg', !!on);
      if (on) schedule();
    },
    scan,
  };
})();
