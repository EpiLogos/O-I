/* An edit in a hosted page, told to its host — page side (DLW manual §17.8 Document, Autosave: "Saves a short time after you stop";
 * §17.4 Canvas: "a short time after a gesture"). A Central document's face learns what its page holds only by its own bounded read of
 * the page's island (document/frame.ts useDocumentHostRead), so it never heard that the person was writing: its draft fact came from a
 * poll every 2.5 s. Autosave saves a short time after the last edit (after VS Code's files.autoSave afterDelay: files.autoSaveDelay,
 * 1000 ms, scheduled again on every change), so the host must hear each edit as it happens. Every hosted document frame carries this
 * script (document/frame.ts useDocumentFrame), as it carries document-find.js and document-save-key.js: on the window, capturing, it hears
 * the person's gestures in the page — an input (typing, a paste, a cut, a drop, a field changed) or a press (a click, a pointer let go:
 * a page's own buttons edit too) — and when the page loses the focus (Save timing: when you leave the page). It tells its host only
 * which of these happened. It carries no word of the page and takes nothing from the host: what the page holds the host still learns
 * only by its own read, and the host never writes into the page. A page opened by itself, with no host, says nothing. */
(() => {
  if (window.__OI_DOCUMENT_EDIT__ || window.parent === window) return;
  window.__OI_DOCUMENT_EDIT__ = true;
  const tell = gesture => window.parent.postMessage({type: 'oi:document-edit', gesture}, '*');
  for (const type of ['input', 'change', 'paste', 'cut', 'drop']) window.addEventListener(type, () => tell('input'), true);
  for (const type of ['click', 'pointerup']) window.addEventListener(type, () => tell('press'), true);
  window.addEventListener('blur', () => tell('leave'));
})();
