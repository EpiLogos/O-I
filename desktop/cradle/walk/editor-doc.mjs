/** Read a CodeMirror document from the DOM the way CodeMirror renders it.
 *
 *  The source, file and Flow surfaces all render CodeMirror
 *  (`src/editor/TextEditor.tsx`). Its contenteditable is not an `<input>`, so
 *  it has no `.value`, and its `textContent` concatenates the line divs with
 *  no separators — neither is the document. CodeMirror renders one `.cm-line`
 *  per line, so joining those with newlines is the document as displayed.
 *  (Very long documents virtualise their line divs; every walk fixture here is
 *  well inside the rendered window.)
 */
// CodeMirror renders runs of spaces (and trailing spaces) as U+00A0 so the
// browser will not collapse them; the document itself holds ordinary spaces.
// Prefer the document CodeMirror actually holds (exposed by TextEditor as a
// read-only accessor on the editor host): the rendered line elements are
// virtualised, so a long document is only partly in the DOM. The line-div read
// stays as the fallback for any editor that has not mounted its accessor yet.
export const DOC_TEXT_FN = `el => {
  if (!el) return null;
  const host = el.closest('.text-editor')?.querySelector('.text-editor-host');
  if (host && typeof host.__oiDocument === 'function') return host.__oiDocument();
  return [...el.querySelectorAll('.cm-line')].map(l => l.textContent.replace(/\\u00a0/g, ' ')).join('\\n');
}`;

/** `docText(page)` → the focused/only editor's document. Pass a selector to
 *  name one editor among several. */
export function docText(page, selector = '.cm-content') {
  return page.evaluate(
    ([sel, fn]) => new Function('return ' + fn)()(document.querySelector(sel)),
    [selector, DOC_TEXT_FN],
  );
}

/** Wait until the named editor's document equals `content`. */
export function waitForDoc(page, content, selector = '.cm-content', timeout = 10000) {
  return page.waitForFunction(
    ([sel, want, fn]) => new Function('return ' + fn)()(document.querySelector(sel)) === want,
    [selector, content, DOC_TEXT_FN],
    { timeout },
  );
}

/** The saving chrome is a 3px edge that opens on hover or focus (cradle.css),
 *  so a walk reaches Save / Refresh / the status line the way a reader does:
 *  by putting the pointer on the footer first. */
export async function openChrome(page, scope = '') {
  const footer = page.locator(`${scope} .editor-footer`.trim()).first();
  if (await footer.count()) await footer.hover();
}

/** The workspace strip is the same auto-opening edge at the bottom of the
 *  canvas (`.workspace-footer-edge`): the workspace selector, the arrangement
 *  state and the workspace-actions menu only become reachable once a reader
 *  puts the pointer on it. */
export async function openWorkspaceStrip(page) {
  await page.locator('.workspace-footer-edge').first().hover();
  await page.locator('.canvas-arrangement').first().waitFor({ state: 'visible' });
}
