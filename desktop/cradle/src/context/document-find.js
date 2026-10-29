/* Find in the page — page side (DLW manual §18.4 "The line anywhere": ⌘F "in a pane … finds in the instrument in front, as VS Code's
 * ⌘F finds in the file in front"). Every hosted Central document carries it (document/frame.ts useDocumentFrame): the Day, a Flow, a
 * Being, a Thing. The host asks; this marks the matches with the CSS Custom Highlight API — no node of the page is added, moved or
 * changed, so the page's payload, its draft and its selection stay as they are — and answers how many there are and which one is in
 * front. Nothing here reads or writes an owner, and the page gains nothing.
 *
 * The rules are VS Code's find widget's (1.141; O-I campaign-evidence/2026-10-29-vscode-workbench-re/DECODE.md): it finds as you type,
 * case-insensitive, the words as typed; a match begins after the last one ends; Next and Previous wrap round (editor.find.loop:
 * true); the first match is the one at or after the selection; the search is seeded from a one-line selection
 * (seedSearchStringFromSelection); at most 19999 matches are marked (title.matchesCountLimit); ⌘G and ⇧⌘G step from the page;
 * Escape closes. Text the reader cannot see (display: none, a hidden face of the die) is not found: there is nothing to show. The marks
 * are the system's own colours — every match in Mark, the one in front in Highlight, as VS Code draws the current match apart: the page
 * is paper of its own, which the shell's theme tokens do not reach. */
(() => {
  if (window.__OI_DOCUMENT_FIND__) return;
  const LIMIT = 19999;
  const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /** The [start, end] offsets of each match of `query` in `flat`, in order. Pure. */
  const matches = (flat, query) => {
    const found = [];
    if (typeof flat !== 'string' || typeof query !== 'string' || !query) return found;
    const pattern = new RegExp(escape(query), 'giu');
    for (let match = pattern.exec(flat); match && found.length < LIMIT; match = pattern.exec(flat)) found.push([match.index, match.index + match[0].length]);
    return found;
  };

  // ---- the page's words, as one text: each visible text node, a line break between blocks
  const shown = element => typeof element.checkVisibility === 'function' ? element.checkVisibility({visibilityProperty: true}) : element.getClientRects().length > 0;
  const collect = () => {
    const pieces = [], blocks = new Map();
    const blockOf = element => {
      for (let node = element; node && node !== document.body; node = node.parentElement) {
        let block = blocks.get(node);
        if (block === undefined) { const display = getComputedStyle(node).display; block = !display.startsWith('inline') && display !== 'contents'; blocks.set(node, block); }
        if (block) return node;
      }
      return document.body;
    };
    let flat = '', last = null;
    if (!document.body) return {flat, pieces};
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {acceptNode: node => {
      const parent = node.parentElement;
      if (!parent || !node.data || parent.closest('script,style,noscript,template,textarea,[data-oi-context-ui]')) return NodeFilter.FILTER_REJECT;
      return shown(parent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }});
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const block = blockOf(node.parentElement);
      if (last !== null && block !== last) flat += '\n';
      last = block;
      pieces.push({node, start: flat.length});
      flat += node.data;
    }
    return {flat, pieces};
  };
  /** The text node and offset of a flat offset: a start in the piece it begins, an end in the piece it closes. */
  const locate = (pieces, offset, end) => {
    const wanted = end ? offset - 1 : offset;
    let low = 0, high = pieces.length - 1;
    while (low < high) { const middle = (low + high + 1) >> 1; if (pieces[middle].start <= wanted) low = middle; else high = middle - 1; }
    return [pieces[low].node, offset - pieces[low].start];
  };

  // ---- the marks
  const marking = () => typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight === 'function';
  let style = null;
  const paint = () => {
    if (!marking()) return;
    if (!style) { style = document.createElement('style'); style.dataset.oiContextUi = ''; style.textContent = '::highlight(oi-find){background-color:Mark;color:MarkText}::highlight(oi-find-current){background-color:Highlight;color:HighlightText}'; }
    if (!style.isConnected) (document.head || document.documentElement).append(style);
    const all = new Highlight();
    for (const range of ranges) all.add(range);
    CSS.highlights.set('oi-find', all);
    if (ranges[current]) CSS.highlights.set('oi-find-current', new Highlight(ranges[current])); else CSS.highlights.delete('oi-find-current');
  };
  const unpaint = () => { if (marking()) { CSS.highlights.delete('oi-find'); CSS.highlights.delete('oi-find-current'); } };
  const reveal = range => {
    const box = range.getBoundingClientRect();
    if (box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth) return;
    range.startContainer.parentElement?.scrollIntoView({block: 'center', inline: 'nearest'});
  };

  // ---- the find
  let ranges = [], current = -1, query = '', open = false, observer = null, again = 0;
  const selected = () => { const selection = getSelection(); return selection && selection.rangeCount && !selection.isCollapsed ? selection.getRangeAt(0) : null; };
  const firstFrom = () => {
    const from = selected();
    if (from) { const at = ranges.findIndex(range => range.compareBoundaryPoints(Range.START_TO_START, from) >= 0); return at === -1 ? 0 : at; }
    const at = ranges.findIndex(range => range.getBoundingClientRect().bottom >= 0);
    return at === -1 ? 0 : at;
  };
  const run = (keep) => {
    const {flat, pieces} = collect();
    ranges = matches(flat, query).map(([start, end]) => {
      const range = document.createRange();
      const [startNode, startOffset] = locate(pieces, start, false), [endNode, endOffset] = locate(pieces, end, true);
      range.setStart(startNode, startOffset); range.setEnd(endNode, endOffset);
      return range;
    });
    current = !ranges.length ? -1 : keep ? Math.min(Math.max(current, 0), ranges.length - 1) : firstFrom();
    paint();
    if (!keep && ranges[current]) reveal(ranges[current]);
  };
  const answer = request => parent.postMessage({type: 'oi:document-find-result', request, query, count: ranges.length, current: current + 1,
    limited: ranges.length >= LIMIT, marked: marking()}, '*');
  // The page moves while the find stands (an entry arrives, the person types in it): find again, keeping the match in front.
  const watch = () => {
    if (observer || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(() => {
      clearTimeout(again);
      again = setTimeout(() => { if (open && query) { run(true); answer(null); } }, 160);
    });
    observer.observe(document.documentElement, {subtree: true, childList: true, characterData: true});
  };
  const close = () => { open = false; query = ''; ranges = []; current = -1; unpaint(); clearTimeout(again); observer?.disconnect(); observer = null; };
  const step = by => { if (!ranges.length) return; current = (current + by + ranges.length) % ranges.length; paint(); reveal(ranges[current]); };
  /** What a ⌘F seeds the find with: the selection, when it is one line. */
  const seed = () => { const range = selected(); const text = range ? range.toString() : ''; return text && !/[\r\n]/.test(text) && text.length <= 1024 ? text : ''; };

  window.__OI_DOCUMENT_FIND__ = {matches, LIMIT};
  window.addEventListener('message', event => {
    if (parent === window || event.source !== parent || event.data?.type !== 'oi:document-find') return;
    const {request, op, query: words} = event.data;
    if (typeof request !== 'string' || request.length > 128) return;
    if (op === 'open') { parent.postMessage({type: 'oi:document-find-result', request, seed: seed(), query, count: ranges.length, current: current + 1, limited: ranges.length >= LIMIT, marked: marking()}, '*'); return; }
    if (op === 'find' && typeof words === 'string' && words.length <= 1024) { open = true; query = words; watch(); if (query) run(false); else { ranges = []; current = -1; unpaint(); } }
    else if (op === 'next') step(1);
    else if (op === 'previous') step(-1);
    else if (op === 'close') close();
    else return;
    answer(request);
  });
  // ⌘F typed inside the page opens its pane's find (the host's window never hears a key the page holds); ⌘G and ⇧⌘G step it; Escape
  // closes it. The page's own keys are left alone otherwise.
  document.addEventListener('keydown', event => {
    if (parent === window || event.isComposing) return;
    const chord = (event.metaKey || event.ctrlKey) && !event.altKey, key = (event.key || '').toLowerCase();
    if (chord && !event.shiftKey && key === 'f') { event.preventDefault(); parent.postMessage({type: 'oi:document-find-key', key: 'open', seed: seed()}, '*'); return; }
    if (chord && key === 'g' && open && query) { event.preventDefault(); step(event.shiftKey ? -1 : 1); answer(null); return; }
    if (event.key === 'Escape' && open) parent.postMessage({type: 'oi:document-find-key', key: 'close'}, '*');
  }, true);
})();
