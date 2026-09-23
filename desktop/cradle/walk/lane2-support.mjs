/** Shared walk support for the right-panel scenarios (lane 2).
 *
 *  `restoreScope` stands the walk in a scope the way a restart does: the
 *  active workspace's saved scope (`oi-cradle.workspaces.v1`, the workspace
 *  is the scope's owner — workspace/scope.ts) is written, then the app
 *  reloads and restores it. It never touches the owner's real state — the
 *  walk browser profile is disposable. The scope menu (10-SIDEBARS §3.6) is
 *  the person's route; this is the restore route the same store serves. */
export async function restoreScope(page, project) {
  // Applied at the next document start, BEFORE the app reads its book (the
  // app flushes its own book on unload, so a write made now would be lost).
  if (!page.__lane2ScopeScript) {
    page.__lane2ScopeScript = true;
    await page.addInitScript(() => {
      try {
        const wanted = sessionStorage.getItem("lane2.walk.scope");
        if (wanted === null) return;
        sessionStorage.removeItem("lane2.walk.scope");
        const key = "oi-cradle.workspaces.v1";
        const book = JSON.parse(localStorage.getItem(key) ?? "null");
        if (!book) return;
        book.workspaces = book.workspaces.map(workspace => workspace.id === book.active ? {...workspace, project: wanted || undefined, allProjects: undefined} : workspace);
        localStorage.setItem(key, JSON.stringify(book));
      } catch { /* opaque frames have no storage */ }
    });
  }
  // The book writes 250 ms after a change; let the pending write land first.
  await page.waitForTimeout(800);
  await page.evaluate(project => sessionStorage.setItem("lane2.walk.scope", project ?? ""), project);
  await page.reload();
}

/** Record every kernel op the page issues (op, encounter action, result),
 *  in request order; the result fills in when the response lands. */
export function recordCalls(page) {
  const calls = [];
  const pending = new Map();
  page.on("request", request => {
    if (!request.url().endsWith("/op")) return;
    let body;
    try { body = request.postDataJSON(); } catch { return; }
    const entry = {op: body?.op, action: body?.request?.action, result: null, error: null};
    calls.push(entry); pending.set(request, entry);
  });
  page.on("response", async response => {
    const entry = pending.get(response.request());
    if (!entry) return;
    pending.delete(response.request());
    try { const reply = await response.json(); entry.result = reply.outcome?.result ?? null; entry.error = reply.error ?? null; } catch { /* consumed */ }
  });
  return calls;
}

/** Make sure the right panel is open (the toggle flips it; the walk only
 *  clicks when it is actually closed). Returns the panel region. */
export async function openPanel(page) {
  const panel = page.getByRole("region", {name: "Accompanying agent"});
  const settled = async () => {
    // The region animates open: wait until its width holds still.
    let last = -1;
    for (let i = 0; i < 40; i++) {
      const width = (await panel.boundingBox())?.width ?? 0;
      if (width > 0 && Math.abs(width - last) < 0.5) return;
      last = width; await page.waitForTimeout(60);
    }
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try { await panel.waitFor({state: "visible", timeout: 2500}); await settled(); return panel; } catch { /* closed */ }
    await page.getByRole("button", {name: "Toggle right region", exact: true}).click();
  }
  await panel.waitFor({state: "visible", timeout: 10000});
  await settled();
  return panel;
}

/** The panel's tab row (a nav of plain buttons). */
export const planeButton = (panel, name) => panel.getByRole("navigation", {name: "Right region planes"}).getByRole("button", {name, exact: true});
export async function planeLabels(panel) {
  return (await panel.getByRole("navigation", {name: "Right region planes"}).locator(".panel-tab > span:first-child").allInnerTexts()).map(text => text.trim());
}
/** How many message composers the whole window holds. */
export const textareaCount = page => page.locator('textarea[aria-label="Message"]').count();
/** The centre region is not inert (usable). */
export const sameCentre = page => page.evaluate(() => document.querySelector(".desktop-centre")?.inert !== true);
/** The aikit binary under test: this lane's ai-kit branch build when present. */
export const LANE_AIKIT = "/Users/admin/Central/worktrees/ui-build/target-aikit/debug/aikit";
