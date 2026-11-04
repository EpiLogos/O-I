/* The point in the reading — page side (DLW manual §10.7 Going back: "You return to the same place, the same page and the same point in
 * the reading"; §23.5 Trail: Return "Returns to the same place, page and point in the reading"). Every hosted Central document carries it
 * (document/frame.ts useDocumentFrame), as it carries document-find.js, document-save-key.js and document-edit.js: the Day, a Flow, a
 * Being, a Thing.
 *
 * It tells its host where the reader stands once a scroll the reader made settles: the passage at the top of the view, as `¶N` — the Nth
 * block of the page's text in its order (a paragraph, a list item, a heading, a quotation …), every block counted whether it shows or not,
 * so a point names the same passage whichever part of the page shows (a die's other faces). A scroll the page makes itself — its form
 * drawing, a point its host sent — is no reading, and is not told: a scroll is the reader's when their hand was on the page (a wheel, a
 * touch, a key, a press) a moment before. A box within the page scrolling (a block of code, a dialog's preview) is not a move through it.
 *
 * Its host may send it a point (a walk on the trail, a page drawn again): that passage comes to the top of the view, and the scroll is
 * not told back. A point not yet drawn — the form still drawing, the pane concealed — is brought up once it is, unless the reader has
 * scrolled on before then. It tells a position and nothing of the page: no word, no title, no mark. A page opened by itself, with no
 * host, says nothing. */
(() => {
  if (window.__OI_DOCUMENT_POINT__ || window.parent === window) return;
  window.__OI_DOCUMENT_POINT__ = true;
  const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, dt, dd, figcaption';
  const POINT = /^¶([1-9]\d{0,5})$/;
  /** How long a scroll rests before the reader is taken to stand where it stopped; how long a hand on the page makes a scroll theirs. */
  const SETTLE_MS = 400, HAND_MS = 1000;
  const tell = message => window.parent.postMessage(message, '*');
  const shown = element => typeof element.checkVisibility === 'function' ? element.checkVisibility({visibilityProperty: true}) : element.getClientRects().length > 0;
  /** The page's text blocks in its order, shown or not. */
  const blocks = () => [...document.querySelectorAll(BLOCKS)].filter(element => (element.textContent || '').trim() !== '');

  let told = null, wanted = null, settle = 0, hand = -Infinity, view = null;
  /** Where the reader stands: the first shown block whose foot is below the top of the view the page scrolls in. */
  const pointNow = () => {
    const top = (view ? view.getBoundingClientRect().top : 0) + 4, list = blocks();
    for (let index = 0; index < list.length; index++) {
      if (shown(list[index]) && list[index].getBoundingClientRect().bottom > top) return `¶${index + 1}`;
    }
    return null;
  };
  const settled = () => {
    settle = 0;
    const point = pointNow();
    if (!point || point === told) return;
    told = point;
    tell({type: 'oi:document-point', position: point});
  };
  /** Bring the point the host sent to the top of the view, once it is drawn and the frame has a height to show it in. */
  const reach = () => {
    if (!wanted) return;
    const element = blocks()[Number(POINT.exec(wanted)[1]) - 1];
    if (!element || !window.innerHeight || !shown(element)) return;
    told = wanted;
    wanted = null;
    element.scrollIntoView({block: 'start'});
  };

  for (const type of ['wheel', 'touchmove', 'keydown', 'pointerdown']) window.addEventListener(type, () => { hand = Date.now(); }, true);
  window.addEventListener('scroll', event => {
    if (Date.now() - hand >= HAND_MS) return;
    const target = event.target, element = target && target.nodeType === 1 ? target : null;
    // A box within the page (a quoted block of code, a dialog's preview) scrolling is not the reader moving through the page: only the
    // page's own view counts — the document, or a scroller at least half the frame's height.
    if (element && element.clientHeight < window.innerHeight / 2) return;
    view = element;
    // The reader has moved on: a point sent and not yet reached is let go.
    wanted = null;
    clearTimeout(settle);
    settle = setTimeout(settled, SETTLE_MS);
  }, true);
  window.addEventListener('message', event => {
    const data = event.data;
    if (event.source !== window.parent || !data || data.type !== 'oi:document-point-go' || typeof data.position !== 'string' || !POINT.test(data.position)) return;
    wanted = data.position;
    reach();
  });
  // Not yet drawn, or concealed: tried again as the page draws, as it loads and as its frame takes a height.
  new MutationObserver(reach).observe(document, {childList: true, subtree: true});
  window.addEventListener('load', reach);
  window.addEventListener('resize', reach);
  tell({type: 'oi:document-point-ready'});
})();
