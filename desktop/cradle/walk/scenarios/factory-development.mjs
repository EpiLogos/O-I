// factory-development (FACTORY-AGENCY §4/§5/§8/§12 on the 11-FACTORY pages):
// the standing walk of Factory mode as a whole, over the disposable Factory
// ground (walk/lib/factory-ground.mjs) and the real kernel. The Desk's own
// states are factory-desk's; the Run page's, factory-run's; this walk holds
// the mode together:
//   - the Desk is DISCOVERED (no source form on the board; the hand-named
//     fallback lives only in the ⟳ menu) and its cards EQUAL the owner's
//     journeys and runs;
//   - Desk ↔ Tasks: Tasks opens on its genuine new-conversation state; back
//     on the Desk the search and the board are as they were;
//   - the right panel answers about the selected run: the Run tab's header
//     EQUALS the run's title and its unit segments the owner's units; the
//     Agents tab lists real identities only (no hardcoded Guardians list, no
//     markdown dump); the Context tab keeps the canvas and offers Factory's
//     slice with no raw record in the primary view;
//   - ruling 7: no visible text says "returns".
import {bindDefaultCentral} from "../editor-doc.mjs";
import {assertNoRawJson} from "../lib/read-model.mjs";
import {enterFactory, factoryGround, recordOps} from "../lib/factory-ground.mjs";

export async function setup(args) { return factoryGround(args); }
const firstSentence = text => text.trim().replace(/\s+/g, " ").replace(/[.]$/, "");

export default async function run({page, baseUrl, check, shot, channel, log, provision: p}) {
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  const ops = recordOps(page);
  const S = p.specimen, A = S.runs.A;
  await page.goto(baseUrl); await channel("info");
  await enterFactory(page, {channel, bindDefaultCentral, root: p.root, project: "Specimen"});
  const centre = page.locator("main.factory-centre");
  const desk = centre.locator(".fdesk");
  await page.waitForFunction(() => document.querySelectorAll(".fdesk .fdesk-card").length >= 3, null, {timeout: 90000});
  check(await centre.getAttribute("data-centre-view") === "desk", "Factory's centre is the Desk");

  // Discovered, not typed.
  const locates = ops.filter(op => op.op === "factory_owner" && op.kind === "locate" && op.result === "factory_development_reading");
  check(locates.length >= 1 && await desk.locator("details.desk-addsource, input[placeholder^='/absolute']").count() === 0, "Sources are discovered with the owner's project locate; no source form sits on the board");
  await desk.getByRole("button", {name: "Refresh the Desk"}).click();
  const refreshMenu = (await page.getByRole("menuitem").allInnerTexts()).map(text => text.trim().split("\n")[0]);
  check(JSON.stringify(refreshMenu) === JSON.stringify(["Read the Desk again", "Add Factory source…"]), "The hand-named source survives only as the ⟳ menu's fallback", {refreshMenu});
  await page.keyboard.press("Escape");
  const ownerTitles = S.readings.projectReading.journeys.length ? [A.purpose, S.runs.B.purpose, S.runs.C.purpose].map(firstSentence).sort() : [];
  const titles = (await desk.locator("[data-card-title]").allInnerTexts()).map(text => text.trim()).sort();
  check(JSON.stringify(titles) === JSON.stringify(ownerTitles), "The board's cards EQUAL the owner's runs (by their commission purposes)", {titles});

  // Desk ↔ Tasks round trip keeps the Desk as it was.
  await desk.getByRole("textbox", {name: "Search runs"}).fill("Lint");
  const views = page.getByRole("radiogroup", {name: "Factory view", exact: true});
  await views.getByRole("radio", {name: "Tasks", exact: true}).click();
  await page.locator('main.factory-centre[data-centre-view="tasks"]').waitFor();
  check((await centre.locator(".ftasks-head").innerText()).trim() === "New conversation" && await page.locator(".factory-chat-host").count() === 1, "Tasks opens on its genuine new-conversation state with the shared chat");
  await views.getByRole("radio", {name: "Desk", exact: true}).click();
  await desk.waitFor();
  check(await desk.getByRole("textbox", {name: "Search runs"}).inputValue() === "Lint" && (await desk.locator("[data-card-title]").allInnerTexts()).map(text => text.trim()).join("|") === firstSentence(S.runs.B.purpose),
    "Back on the Desk the search and the board it filtered are as they were");
  await desk.getByRole("textbox", {name: "Search runs"}).fill("");

  // The right panel answers about the selected run.
  await desk.locator(`[data-run-card="${A.runRef}"]`).click();
  await centre.locator(`[data-run-page="${A.runRef}"]`).waitFor();
  const panel = page.locator(".agent-layer, [data-agent-layer]").first();
  const runTab = page.locator(`[data-run-tab="${A.runRef}"]`);
  await runTab.waitFor({timeout: 30000});
  const tabTitle = (await runTab.locator("[data-run-tab-title]").innerText()).trim();
  const segments = await runTab.locator(".fdesk-unit").count();
  check(tabTitle === firstSentence(A.purpose) && segments === S.readings.inspect.units.length, "Run tab: the compact header EQUALS the selected run's title, one segment per owner unit", {tabTitle, segments});
  await shot("run-tab");

  // Agents: real identities only.
  await page.getByRole("button", {name: "Agents", exact: true}).click().catch(() => page.getByRole("tab", {name: "Agents"}).click());
  const agents = page.locator("[data-agents-tab]");
  await agents.waitFor({timeout: 30000});
  const ownerAgents = new Set([...S.readings.inspect.attempts.map(attempt => attempt.participant?.agentRef), ...S.readings.inspect.units.flatMap(unit => unit.agentRequirements?.agentRefs ?? []), ...(S.readings.runReading.agencies ?? []).map(agency => agency.agentRef)].filter(Boolean));
  // The run's inspection lands after the Run page's own read; the roster
  // grows to it (never shrinks, never invents).
  await page.waitForFunction(count => document.querySelectorAll("[data-agents-tab] .fagent-row").length >= count, ownerAgents.size, {timeout: 60000}).catch(() => {});
  const rows = await agents.locator(".fagent-row").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-agent")));
  check(rows.length > 0 && rows.every(ref => ownerAgents.has(ref) || /-guardian$/.test(ref)) && [...ownerAgents].every(ref => rows.includes(ref)),
    "Agents: the run's own agents (from the owner's attempts and unit requirements) first, then Guardians from the roster — no hardcoded list", {rows, ownerAgents: [...ownerAgents]});
  check(await agents.locator("pre, .guardian-markdown").count() === 0, "Agents: no Guardian markdown is dumped into the panel");
  await shot("agents-tab");

  // Context: the preserved canvas plus Factory's slice, no raw record.
  await page.getByRole("button", {name: "Context", exact: true}).click().catch(() => page.getByRole("tab", {name: "Context"}).click());
  const contextPlane = page.locator('div[data-plane="factory-context"]');
  await contextPlane.waitFor();
  await contextPlane.locator(".fslice").waitFor({timeout: 30000}).catch(() => {});
  const slice = await contextPlane.locator(".fslice").innerText().catch(() => "");
  const returnFirst = (/^(.+?[.!?])(?=\s+[A-Z0-9"“(])/.exec(A.returnSummary.trim().replace(/\s+/g, " "))?.[1] ?? A.returnSummary).replace(/[.]$/, "");
  check(/run material/i.test(slice) && slice.includes(returnFirst), "Context offers Factory's slice: the selected run's returned material, in the owner's words", {slice: slice.slice(0, 200)});
  await assertNoRawJson({check}, contextPlane, "L5 · the Context plane renders readable material only — no raw record in the primary view");
  await shot("context-tab");

  // Ruling 7: nothing says "returns".
  for (const [root, label] of [[centre, "centre"], [page.locator("aside, .agent-layer").last(), "panel"]]) {
    const lines = (await root.innerText().catch(() => "")).split("\n").map(line => line.trim()).filter(line => /\breturns\b/i.test(line));
    check(lines.length === 0, `L7 · the Factory ${label}'s visible text never says "returns"`, {offendingLines: lines.slice(0, 5)});
  }
  void panel;
}
