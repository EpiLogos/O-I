/* ⌘S in a hosted page — page side (DLW manual §10.9: "Open a set, save it … ⌘O, ⌘S"; §17.8 Save: the Document saves through its
 * owner, and names the outcome). A Central document's own form takes ⌘S for its portable copy (ql-flow.html and ql-daily-die.html
 * exportCopy, the page templates' save()): a download, written inside the sandbox, that no owner hears. In a pane ⌘S is the pane's
 * Save, through Central, as the head's Save is. Every hosted document frame carries this script first in its <head>
 * (document/frame.ts useDocumentFrame), so its listener on the window, capturing, hears the chord before the form's own: it asks the
 * host to save and the form's handler never runs. The portable copy stays where the form puts it, in its own menu and buttons; ⇧⌘S
 * is left to the page. A page opened by itself, with no host, keeps its own ⌘S. Nothing here reads or writes an owner. */
(() => {
  if (window.__OI_DOCUMENT_SAVE_KEY__ || window.parent === window) return;
  window.__OI_DOCUMENT_SAVE_KEY__ = true;
  window.addEventListener('keydown', event => {
    if (event.isComposing || event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey)) return;
    if ((event.key || '').toLowerCase() !== 's') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.parent.postMessage({type: 'oi:document-save'}, '*');
  }, true);
})();
