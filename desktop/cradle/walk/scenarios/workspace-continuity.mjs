// workspace-continuity — the Workspace/state-continuity lane of O:I #18/#65
// (SHARED-FIELD-STATE-DISCOVERY §2.2 + SF1 acceptance walk A; SHARED-FIELD-DESKTOP
// §12): one autosaved Workspace spans Project work, the Wiki page/Expression
// focus, global Explore and a SharedField Surface — and restores exactly
// across workspace switching and kill/relaunch. Shared state is ref-bound,
// never cloned; opening another World or SharedField never silently replaces
// the local Project context or the personal Agent relation; unavailable
// shared state degrades honestly while the local Workspace survives.
//
//   Project work (Editor project context, a source tab, the project wiki
//   graph, a node opened "in tab" as a page bound to its origin graph)
//   → open global Explore (no hosting target bound in this walk)
//   → the open field is honestly unavailable; local context untouched
//   → a SharedField Surface is opened through the desktop's real Explore
//     hand-off seam (`oi:open-explore`, the seam ShareProjection uses) with
//     a field ref; the absent field reads as an explicit absence
//   → return to the source tab: the exact valid local constellation
//   → kill/relaunch (renderer reload, same storage): the same constellation
//     restores by stable refs — including the knowledge page plane and its
//     origin graph, and Explore's remembered selection
//   → a second workspace switches away and back (D19) without rebuilding
//
// The live hosted SharedField encounter (real Presence, publishing, staged
// presentation) is explore-sf1's proof against a real target. This walk is
// deliberately self-contained: the hosting target is absent, and its absence
// must stay honest — which is exactly the degradation clause of the lane.
import {setup} from "./knowledge.mjs";
import {bindDefaultCentral, openWorkspaceStrip, newWorkspace, switchWorkspace} from "../editor-doc.mjs";
export {setup};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const workspaces = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("oi-cradle.workspaces.v1") ?? "null"));
const FIELD_REF = "oi:field:walk:workspace-continuity";

/** The local constellation as data: project context, agent relation, and
 * every open tab with the view state its kind restores from. Explore and
 * presentation tabs are listed too — the constellation spans them all. */
async function constellation(page, workspaceId = null) {
  return page.evaluate((id) => {
    const book = JSON.parse(localStorage.getItem("oi-cradle.workspaces.v1") ?? "null");
    const active = book.workspaces.find((w) => w.id === (id ?? book.active)) ?? book.workspaces[0];
    const tabs = [];
    const walk = (pane) => {
      if (!pane) return;
      if (pane.type === "group") tabs.push(...pane.tabs.map((t) => ({id: t, kind: active.layout.surfaces[t]?.kind, ref: active.layout.surfaces[t]?.ref ?? null, title: active.layout.surfaces[t]?.title, project: active.layout.surfaces[t]?.project ?? null, view: active.layout.surfaces[t]?.view ?? null, presentation: active.layout.surfaces[t]?.presentation ?? null})));
      else pane.children.forEach(walk);
    };
    walk(active.layout.root);
    return {project: active.project ?? null, accompanying: active.layout.accompanying ?? null, focusedGroupId: active.layout.focusedGroupId, tabs};
  }, workspaceId);
}
const sameConstellation = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** The lane law while a Surface journey OPENS new Surfaces: nothing that was
 * already there is replaced — the earlier tabs survive in place (the frame
 * appends), and the project context and Agent relation are untouched. */
const keepsConstellation = (before, after) => after.project === before.project && after.accompanying === before.accompanying && after.tabs.length >= before.tabs.length && JSON.stringify(after.tabs.slice(0, before.tabs.length)) === JSON.stringify(before.tabs);

async function kernelProject(page, channel) {
  const state = (await channel("read.state")).data;
  return state?.navigator?.project?.project?.name ?? null;
}
/** The kernel's project context follows the workspace asynchronously; wait
 * for the expected value rather than sampling a moving target once. */
async function kernelProjectSettles(page, channel, expected, timeoutMs = 10_000) {
  for (let deadline = Date.now() + timeoutMs; Date.now() < deadline; await sleep(150)) {
    if (await kernelProject(page, channel) === expected) return true;
  }
  return false;
}

export default async function run({page, baseUrl, check, shot, channel, log, provision: p}) {
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  const nav = page.getByRole("complementary", {name: "World navigator"});
  const showNav = async () => { if (!await nav.isVisible()) await page.keyboard.press("Meta+b"); };

  // ---- Project work: context, a source tab ----
  await showNav();
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button", {name: "Editor: files", exact: true}).click();
  const source = p.sources[0];
  await nav.locator(`[data-file-path="Work/Editor/${source.binding.path}"]`).click();
  await page.locator(`.cm-content[data-source-ref="${source.binding.ref}"]`).waitFor({timeout: 15000});
  check(await kernelProject(page, channel) === "Editor", "The kernel's project context is the local project", {project: await kernelProject(page, channel)});

  // ---- the Wiki: graph, then a node focused as a page bound to its origin ----
  await showNav();
  await nav.getByRole("button", {name: "Editor: wiki", exact: true}).click();
  await nav.getByRole("button", {name: "Editor neighbourhood", exact: true}).click();
  await page.getByRole("region", {name: "Knowledge surface"}).waitFor({timeout: 15000});
  await page.waitForFunction(() => document.querySelector(".knowledge-surface")?.getAttribute("aria-busy") === "false", null, {timeout: 20000});
  // The graph's node buttons are the accessibility layer over the canvas —
  // hit-tested clicks race the layout worker's placement, so the node is
  // opened the way a keyboard person opens it: focus, then Enter.
  const graphNode = page.locator(`[data-knowledge-ref="${p.wiki.ref}"]`);
  await graphNode.waitFor({timeout: 30000});
  await graphNode.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll(".knowledge-detail-footer button")].find((b) => /Open in tab/.test(b.textContent ?? ""));
    return button && !button.disabled;
  }, null, {timeout: 15000});
  await page.getByRole("button", {name: /Open in tab/}).click();
  await page.getByRole("article", {name: "Selected node content"}).waitFor({timeout: 15000});
  let book = await workspaces(page);
  const pageBinding = Object.values(book.workspaces.find((w) => w.id === book.active).layout.surfaces).find((b) => b.kind === "knowledge" && b.view?.knowledgePlane === "page");
  check(Boolean(pageBinding) && pageBinding.view.graphOrigin, "The wiki node opened as a page binding carrying its plane and origin graph", {binding: pageBinding ?? null});
  check(await page.getByRole("button", {name: "Release graph focus"}).count() === 1, "The page surface names its origin graph (the return-to-graph relation)", {});
  await shot("wiki-page-focus");

  const base = await constellation(page);
  check(base.project === "Editor" && base.accompanying === null, "Local work holds the project context and no AgentSession relation", {constellation: base});

  // ---- global Explore, with no hosting target: honest unavailability ----
  await showNav();
  await nav.getByRole("button", {name: "Open Explore", exact: true}).click();
  const explore = page.getByRole("region", {name: "Explore"});
  await explore.waitFor({timeout: 15000});
  await explore.locator('[data-field-state="unavailable"]').waitFor({timeout: 30000});
  const unavailableDetail = await explore.locator('[data-field-state="unavailable"] [role="status"]').innerText();
  check(unavailableDetail.includes("no SharedField target bound"), "With no target the open field says exactly what is absent", {detail: unavailableDetail});
  book = await workspaces(page);
  const exploreBinding = Object.values(book.workspaces.find((w) => w.id === book.active).layout.surfaces).find((b) => b.kind === "explore");
  check(Boolean(exploreBinding) && !exploreBinding.project, "The Explore binding is global — not scoped to the local project", {});
  const afterExplore = await constellation(page);
  check(keepsConstellation(base, afterExplore), "Opening Explore replaced nothing in the local constellation", {base: base.tabs.length, after: afterExplore});
  await shot("explore-unavailable-honest");

  // ---- a SharedField Surface through the desktop's real hand-off seam ----
  await page.evaluate((ref) => window.dispatchEvent(new CustomEvent("oi:open-explore", {detail: {ref, title: "Continuity field"}})), FIELD_REF);
  await page.waitForFunction((ref) => document.querySelector(".explore-surface")?.getAttribute("data-selected-ref") === ref, FIELD_REF, {timeout: 10000});
  await page.locator(".explore-absent, .presentation-body").first().waitFor({timeout: 15000});
  const fieldReading = await page.locator(".explore-absent").innerText().catch(() => "");
  check(fieldReading.includes("not in the caller-visible reading"), "The SharedField Surface is an explicit absence, not a cached clone", {reading: fieldReading});
  const afterField = await constellation(page);
  check(sameConstellation(afterField, afterExplore), "Opening a SharedField replaced nothing in the local constellation", {after: afterField});
  await shot("sharedfield-surface");

  // ---- return to local work: the exact valid constellation ----
  await page.locator(`.tab[data-surface-id="${base.tabs[0].id}"]`).click();
  await page.locator(`.cm-content[data-source-ref="${source.binding.ref}"]`).waitFor({timeout: 15000});
  check(sameConstellation(afterField, await constellation(page)), "Return to local work keeps the exact constellation of the whole journey", {});
  await page.locator(`.tab[data-surface-id="${pageBinding.id}"]`).click();
  await page.getByRole("article", {name: "Selected node content"}).waitFor({timeout: 15000});
  check(await page.getByRole("button", {name: "Release graph focus"}).count() === 1, "The wiki page still knows its origin graph after the Explore/SharedField journey", {});
  await page.locator(`.tab[data-surface-id="${base.tabs[0].id}"]`).click();
  await page.locator(`.cm-content[data-source-ref="${source.binding.ref}"]`).waitFor({timeout: 15000});
  await shot("returned-to-project");

  // ---- kill/relaunch: the same constellation restores by refs ----
  const beforeReload = await constellation(page);
  await page.reload(); await channel("info");
  await page.locator(`.cm-content[data-source-ref="${source.binding.ref}"]`).waitFor({timeout: 20000});
  const afterReload = await constellation(page);
  check(sameConstellation(beforeReload, afterReload), "Kill/relaunch restores the exact constellation, every tab by its stable ref", {after: afterReload});
  await page.locator(`.tab[data-surface-id="${pageBinding.id}"]`).click();
  await page.getByRole("article", {name: "Selected node content"}).waitFor({timeout: 15000});
  check(await page.getByRole("button", {name: "Release graph focus"}).count() === 1, "After relaunch the wiki page is still a page bound to its origin graph (not demoted to a graph)", {});
  const exploreTab = Object.values((await workspaces(page)).workspaces[0].layout.surfaces).find((b) => b.kind === "explore");
  await page.locator(`.tab[data-surface-id="${exploreTab.id}"]`).click();
  await page.waitForFunction((ref) => document.querySelector(".explore-surface")?.getAttribute("data-selected-ref") === ref, FIELD_REF, {timeout: 10000});
  await explore.locator('[data-field-state="unavailable"], .explore-absent').first().waitFor({timeout: 30000});
  check(true, "After relaunch Explore remembers the SharedField selection and degrades honestly again", {});
  const travel = await page.evaluate(() => JSON.parse(localStorage.getItem("oi-cradle.explore.v1") ?? "null"));
  check(travel?.visits.some((v) => v.selected === FIELD_REF) && !JSON.stringify(travel).includes("representation"), "Explore's remembered state is compact view state, never a cloned payload", {});
  await shot("restored-after-relaunch");

  // ---- workspace switching restores exactly (D19) ----
  await page.locator(`.tab[data-surface-id="${base.tabs[0].id}"]`).click();
  await page.locator(`.cm-content[data-source-ref="${source.binding.ref}"]`).waitFor({timeout: 15000});
  // The workspace verbs live in the scope menu's footer (10-SIDEBARS §3.6).
  await newWorkspace(page, "Second");
  await page.waitForFunction(() => {const book = JSON.parse(localStorage.getItem("oi-cradle.workspaces.v1") ?? "null");return book?.workspaces?.some((w) => w.name === "Second") && book.active === book.workspaces.find((w) => w.name === "Second")?.id;}, null, {timeout: 10000});
  check(await kernelProjectSettles(page, channel, null), "The fresh workspace holds no project context; the kernel followed it", {project: await kernelProject(page, channel)});
  await switchWorkspace(page, "root");
  await page.locator(`.cm-content[data-source-ref="${source.binding.ref}"]`).waitFor({timeout: 15000});
  check(sameConstellation(beforeReload, await constellation(page)), "Switching back to the first workspace restores its exact constellation", {});
  check(await kernelProjectSettles(page, channel, "Editor"), "The kernel's project context returns with the workspace (re-browsed by ref, not reminted)", {});
  await shot("switched-back");

  // ---- nothing semantic leaked into persisted state ----
  const stores = await page.evaluate(() => JSON.stringify({book: localStorage.getItem("oi-cradle.workspaces.v1"), explore: localStorage.getItem("oi-cradle.explore.v1")}));
  check(!["representation", "presentation_payload", "transcript"].some((needle) => stores.includes(needle)), "Persisted workspace state carries refs and compact view state only", {bytes: stores.length});
  log(`workspace-continuity: ${beforeReload.tabs.length} surfaces spanned, ${FIELD_REF} remembered, all restores exact`);
}
