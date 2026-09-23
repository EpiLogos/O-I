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

/** Reach a surface's saving chrome (Save / Refresh / the status line). The
 *  pane-footer law it once named is gone: an editor footer no longer opens
 *  on hover — pane footers FOLLOW FOCUS (cradle.css), a focused pane's
 *  footer drops fully, and the pane's bottom-right dot pins it up
 *  ([data-footer-up]) for as long as it is pressed. A walk pins the footer
 *  the way a reader does: press the owning pane's dot. */
export async function openChrome(page, scope = '') {
  const footer = page.locator(`${scope} .editor-footer`.trim()).first();
  if (await footer.count()) {
    const pane = page.locator('.pane.group').filter({ has: footer }).first();
    const dot = pane.locator('[data-pane-footer-dot]');
    if (await dot.count()) {
      await dot.click();
      await page.waitForTimeout(450);
    } else {
      await footer.hover().catch(() => {});
    }
  }
}

/** The workspace strip is the same auto-opening edge at the bottom of the
 *  canvas (`.workspace-footer-edge`): the workspace selector, the arrangement
 *  state and the workspace-actions menu only become reachable once a reader
 *  puts the pointer on it. */
export async function openWorkspaceStrip(page) {
  await page.locator('.workspace-footer-edge').first().hover();
  await page.locator('.canvas-arrangement').first().waitFor({ state: 'visible' });
}

/** Bind the walk's temp ground as the default Central through the real UI.
 *  The boot law is explicit binding (BOOT-02/03): while no ground is bound
 *  and no surface is open, the boot gate renders the chooser on the Rest
 *  surface — recognition and binding happen right there, the same path
 *  BOOT-03 walks. (The System page carries the same chooser under its
 *  Config rail item; going through the boot gate keeps this helper usable
 *  before any surface exists.) */
export async function bindDefaultCentral(page, root) {
  const chooser = page.getByRole('region', { name: 'Central location' });
  const input = chooser.getByRole('textbox', { name: 'Existing Central path' });
  await input.fill(root);
  await chooser.getByRole('button', { name: 'Recognize', exact: true }).click();
  // The recognition outcome renders twice in the DOM — the status line and
  // the "What was recognised" facts list (closed details). Read the STATUS
  // line, anchored to the outcome's start, not the bare text.
  await chooser.getByRole('status').filter({ hasText: /^recognized/ }).first().waitFor();
  await chooser.getByRole('button', { name: 'Use as default Central' }).click();
  await chooser.getByText(/Default Central saved/).waitFor();
}

/** The site redesign's welcome field plays over a cold boot; clicking its
 *  enter control dismisses it. No-op when the gate is absent (already
 *  entered, or a surface opened past it). */
export async function enterApp(page) {
  const enter = page.locator(".oi-welcome-enter");
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await enter.waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
  }
}


/** The workspace lives in the scope menu's footer (10-SIDEBARS §3.6 rule 5):
 *  open the menu from the left head (showing the left region first). */
export async function scopeMenu(page) {
  const trigger = page.locator('[data-left-head] .left-scope-trigger');
  if (!await trigger.isVisible().catch(() => false)) await page.keyboard.press('Meta+b');
  await trigger.click();
  const menu = page.getByRole('group', { name: 'Scope and workspace' });
  await menu.waitFor();
  return menu;
}

/** New workspace (scope menu footer → New), named and created. */
export async function newWorkspace(page, name) {
  const menu = await scopeMenu(page);
  await menu.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('textbox', { name: 'Workspace name' }).fill(name);
  await page.getByRole('button', { name: 'Create workspace' }).click();
}

/** Rename the current workspace (scope menu footer → Rename). */
export async function renameWorkspace(page, name) {
  const menu = await scopeMenu(page);
  await menu.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByRole('textbox', { name: 'Workspace name' }).fill(name);
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
}

/** Switch workspace (scope menu footer → Switch…): by id, by {label}, or
 *  {index} in the book's order. */
export async function switchWorkspace(page, which) {
  const menu = await scopeMenu(page);
  await menu.getByRole('button', { name: 'Switch…' }).click();
  const list = menu.getByRole('group', { name: 'Workspaces' });
  const target = typeof which === 'string' ? list.locator(`[data-workspace-id="${which}"]`)
    : which.label !== undefined ? list.getByRole('menuitemradio', { name: which.label, exact: true })
    : list.getByRole('menuitemradio').nth(which.index ?? 0);
  await target.click();
}

/** The current workspace's name, as the scope menu names it. */
export async function currentWorkspaceName(page) {
  const menu = await scopeMenu(page);
  const name = (await menu.locator('[data-current-workspace]').innerText()).trim();
  await page.keyboard.press('Escape');
  return name;
}

/** Recover arrangement (scope menu footer). */
export async function recoverArrangement(page) {
  const menu = await scopeMenu(page);
  await menu.getByRole('button', { name: 'Recover arrangement' }).click();
}

/** A left conversation row opens in the right panel's Chat (10-SIDEBARS
 *  §3.5, D4). A walk that works the conversation in the centre's encounter
 *  view takes the row's own "Open in centre" action — the route the row
 *  offers — instead of the plain click. */
export async function openConversationInCentre(page, title) {
  const row = page.locator('[data-region="left"] .left-conversation')
    .filter({ has: page.locator('.left-conversation-title', { hasText: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first();
  await row.waitFor({ timeout: 30000 });
  await row.hover();
  await row.getByRole('button', { name: `Actions for ${title}`, exact: true }).click();
  await row.getByRole('menuitem', { name: 'Open in centre', exact: true }).click();
}
