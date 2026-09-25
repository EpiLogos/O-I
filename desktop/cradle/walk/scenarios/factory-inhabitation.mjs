// factory-inhabitation (WORLD-INHABITATION-V1 §3/§4; CROSSWALK §8/§15; O-I
// #65 #220, Factory #195), LIVE and READ-ONLY against the owner's REAL
// Central ground and the INSTALLED owners (aikit gateway who / whoami /
// refocus; factory development inhabitation / current-work): the O-I Project
// World's nine Positions and the Factory Guardian's real custody of
// EpiLogos/Factory#261.
//
// Every value the apertures show is asserted EQUAL to the owners' own
// readings, taken by the walk from the same installed binaries in setup:
//   Desk     — the Guardian's run card is "Held by" the handle Central defines
//              for the Position Factory holds in custody; no ambiguity is
//              drawn where Factory's current work is one; no "couldn't be
//              read" line where the owners answered.
//   Agents   — one row per Position of the population reading; occupancy as
//              the owner states it (● exactly when occupied and active); the
//              run's custody Position leads "On this run"; current work names
//              the owner's run by its Desk title, else its work ref as given
//              (a null run ref is never guessed).
//   Position — the joined whoami facets from their value objects (current
//              work from Factory's reading, not the installed summary text),
//              plus Factory's own current-work reading.
//   Live     — Positions with Factory's custody; no attempt names them yet.
//   Context  — the Refocus trace hop by hop with the owner's gaps; prepared
//              context and child NOW as the owner states them; root NOW.
// Nothing is started, claimed, assigned or written: the walk asserts the O-I
// Factory state is byte-identical before and after. The kernel's suite
// binding stays isolated (a temp OI_HOME); only the Central root is real.
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {chooseProject, recordOps} from "../lib/factory-ground.mjs";

const ROOT = process.env.OI_WALK_REAL_CENTRAL ?? "/Users/admin/Central";
const PROJECT = "O-I";
const which = name => {
  const found = spawnSync("sh", ["-c", `command -v ${name}`], {encoding: "utf8"}).stdout.trim();
  if (!found) throw new Error(`${name} is not on PATH — the live walk reads the installed owner`);
  return found;
};
const owner = (bin, args, cwd) => {
  const done = spawnSync(bin, args, {encoding: "utf8", cwd});
  if (done.status !== 0) throw new Error(`${bin} ${args.join(" ")}: ${done.stderr || done.stdout}`);
  const document = JSON.parse(done.stdout);
  return document && typeof document.ok === "boolean" && "data" in document ? document.data : document;
};
const digest = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const tail = ref => (ref ?? "").split(/[:/]/).filter(Boolean).pop();
const plane = (page, name) => page.locator('[aria-label="Right region planes"]').getByRole("button", {name, exact: true});
const firstSentence = text => { const t = text.trim().replace(/\s+/g, " "); const m = /^(.+?[.!?])(?=\s+[A-Z0-9"“(])/.exec(t); return (m ? m[1] : t).replace(/[.]$/, ""); };

export async function setup() {
  const aikit = process.env.OI_AIKIT_BIN ?? which("aikit");
  const factory = process.env.OI_FACTORY_BIN ?? which("factory");
  const projectDir = join(ROOT, "Work", PROJECT);
  const location = owner(factory, ["project", "locate", projectDir, "--json"]);
  const statePath = location.statePath;
  const population = owner(aikit, ["gateway", "who", "--project-world", `project:${PROJECT}`, "--json"], projectDir);
  const inhabitation = owner(factory, ["development", "inhabitation", statePath, "--json"]);
  const custodyRun = inhabitation.runs.find(run => (run.positions ?? []).some(position => position.in_custody));
  if (!custodyRun) throw new Error("no run in the O-I Factory state holds a Position in custody — the live walk needs the real custody");
  const custodyPosition = custodyRun.positions.find(position => position.in_custody).position_ref;
  const currentWork = owner(factory, ["development", "current-work", statePath, "--position", custodyPosition, "--json"]);
  const whoami = owner(aikit, ["whoami", "--position", custodyPosition, "--full", "--json"], projectDir);
  const refocus = owner(aikit, ["refocus", "--position", custodyPosition, "--json"], projectDir);
  const journeyRef = custodyRun.journey_refs?.[0];
  const journey = journeyRef ? owner(factory, ["development", "journey", statePath, journeyRef, "--json"]) : null;
  const home = mkdtempSync(join(tmpdir(), "oi-cradle-inhabitation-live-home-"));
  return {
    root: ROOT, projectDir, statePath, population, inhabitation, custodyRun, custodyPosition, currentWork, whoami, refocus, journey,
    stateDigest: digest(statePath), versions: {aikit: spawnSync(aikit, ["--version"], {encoding: "utf8"}).stdout.trim(), factory: spawnSync(factory, ["--version"], {encoding: "utf8"}).stdout.trim()},
    env: {OI_CENTRAL_ROOT: ROOT, OI_HOME: home, OI_AIKIT_BIN: aikit, OI_FACTORY_BIN: factory},
    cleanup: () => rmSync(home, {recursive: true, force: true}),
  };
}

export default async function run({page, baseUrl, check, shot, channel, log, provision: p}) {
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  const ops = recordOps(page);
  log(`installed owners: ${p.versions.aikit}; ${p.versions.factory}`);
  const positions = p.population.positions;
  const byRef = Object.fromEntries(positions.map(position => [position.position_ref, position]));
  const custody = byRef[p.custodyPosition];
  const runRef = p.custodyRun.run_ref;

  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  await page.reload(); await channel("info");
  await page.getByRole("radiogroup", {name: "Workspace mode", exact: true}).getByRole("radio", {name: "Factory", exact: true}).click();
  const centre = page.locator("main.factory-centre");
  await centre.waitFor({timeout: 60000});
  await chooseProject(page, PROJECT);
  const desk = centre.locator(".fdesk");
  const card = desk.locator(`[data-run-card="${runRef}"]`);
  await card.waitFor({timeout: 180000});
  await page.waitForFunction(() => document.querySelector(".fdesk")?.getAttribute("data-desk-state") === "read", null, {timeout: 180000});

  // ---- Desk
  const expectedTitle = p.journey?.commission?.purpose ? firstSentence(p.journey.commission.purpose) : undefined;
  const title = (await card.locator("[data-card-title]").innerText()).trim();
  const heldBy = (await card.locator("[data-card-owner]").innerText().catch(() => "")).trim();
  check(heldBy === `Held by ${custody.handle}`, "LIVE Desk: the card is held by the handle Central defines for the Position Factory holds in custody", {heldBy, custodyPosition: p.custodyPosition, handle: custody.handle, title, expectedTitle});
  check(!expectedTitle || title === expectedTitle, "LIVE Desk: the card title EQUALS the Journey's commission purpose", {title, expectedTitle});
  const ambiguous = await card.locator("[data-card-ambiguous]").count();
  check(p.currentWork.outcome !== "ambiguous" && ambiguous === 0 && await card.evaluate(node => node.closest("[data-column]")?.getAttribute("data-column")) !== "needs-you" || p.currentWork.outcome === "ambiguous" && ambiguous === 1,
    "LIVE Desk: the ambiguity mark EQUALS Factory's current-work outcome for the Position in custody", {outcome: p.currentWork.outcome, ambiguous});
  check(await desk.locator('[data-desk-owners="unavailable"]').count() === 0, "LIVE Desk: the owners answered — no \"couldn't be read\" line");
  const inhabitationOps = ops.filter(op => op.op === "factory_owner" && (op.kind === "inhabitation" || op.kind === "current-work"));
  check(inhabitationOps.length >= 2 && inhabitationOps.every(op => op.result === "factory_development_reading"), "LIVE Desk: Factory's inhabitation and current-work reads went to the installed owner through the kernel and returned readings", {ops: inhabitationOps.map(op => `${op.kind}:${op.result ?? op.error}`)});
  await shot("desk");

  // ---- Agents (with the custody run selected)
  await card.click();
  const runPage = centre.locator(`[data-run-page="${runRef}"]`);
  await runPage.waitFor({timeout: 60000});
  await plane(page, "Agents").click();
  const agents = page.locator("[data-agents-tab]");
  await agents.waitFor({timeout: 30000});
  await page.waitForFunction(count => document.querySelector("[data-agents-tab]")?.getAttribute("data-population-state") === "read"
    && document.querySelectorAll("[data-agents-tab] .fagent-row[data-position]").length >= count, positions.length, {timeout: 60000});
  const rows = await agents.locator(".fagent-row[data-position]").evaluateAll(nodes => nodes.map(node => ({
    ref: node.getAttribute("data-position"), occupancy: node.getAttribute("data-occupancy"), work: node.getAttribute("data-work"),
    section: node.closest("section")?.getAttribute("aria-label"), mark: node.querySelector(".fpos-mark")?.textContent,
    name: node.querySelector("strong")?.childNodes[0]?.textContent?.trim(), workWords: node.querySelector("[data-work-words]")?.textContent?.trim()})));
  check(JSON.stringify(rows.map(row => row.ref).sort()) === JSON.stringify(positions.map(position => position.position_ref).sort()), "LIVE Agents: one row per Position of the owner's population reading — no more, no fewer", {rows: rows.map(row => row.ref)});
  check(rows.every(row => row.occupancy === byRef[row.ref].occupancy.state && row.name === (byRef[row.ref].label ?? byRef[row.ref].handle)), "LIVE Agents: each row's name and occupancy EQUAL the owner's", {rows});
  const present = rows.map(row => ({ref: row.ref, drawn: row.mark === "●", owner: byRef[row.ref].occupancy.state === "occupied" && byRef[row.ref].occupancy.presence === "active"}));
  check(present.every(row => row.drawn === row.owner), "LIVE Agents: a Position is drawn present (●) exactly when the owner states an occupied, active occupant", {present});
  const custodyRow = rows.find(row => row.ref === p.custodyPosition);
  check(custodyRow?.section === "On this run" && rows.filter(row => row.section === "On this run").length === p.custodyRun.positions.length, "LIVE Agents: the Positions Factory holds on the selected run lead \"On this run\"", {custodyRow});
  // The run the population names is titled as the Desk titles it; with no
  // run ref the owner's work ref is named as given (never a guessed run).
  const workRun = custody.current_work.run_ref;
  const expectedWork = custody.current_work.outcome !== "one" ? undefined
    : workRun === runRef ? `Working on ${title}` : `Working on ${tail(custody.current_work.work_ref ?? workRun)}`;
  check(custodyRow?.work === custody.current_work.outcome && (!expectedWork || custodyRow.workWords === expectedWork), "LIVE Agents: the Position's current work EQUALS the population reading (its run by title, else its work ref as given)", {workWords: custodyRow?.workWords, expectedWork, owner: custody.current_work});
  await shot("agents");

  // ---- Position page
  await agents.locator(`.fagent-row[data-position="${p.custodyPosition}"]`).click();
  const positionPage = centre.locator('.object-page[data-object-kind="factory-position"]');
  await positionPage.locator(".object-fields dt").first().waitFor({timeout: 60000});
  const fields = await positionPage.evaluate(node => Object.fromEntries([...node.querySelectorAll(".object-fields > dt")].map(dt => [dt.textContent.trim(), dt.nextElementSibling?.textContent?.trim()])));
  const facet = name => p.whoami.facets[name];
  const record = facet("position")?.value?.record ?? {};
  check(fields.Handle === record.handle && fields.Purpose === record.purpose, "LIVE Position page: handle and purpose EQUAL the Position record in the joined reading", {handle: fields.Handle, purpose: fields.Purpose});
  check(fields.Occupancy === (facet("occupancy").state === "present" ? fields.Occupancy : `${facet("occupancy").state} — ${facet("occupancy").reason}`), "LIVE Position page: occupancy is the facet's standing and reason", {occupancy: fields.Occupancy, facet: facet("occupancy")});
  check(fields["Prepared context"] === `${facet("prepared_context").state} — ${facet("prepared_context").reason}` || facet("prepared_context").state === "present", "LIVE Position page: prepared context as the owner states it", {prepared: fields["Prepared context"]});
  const workField = fields["Current work"] ?? "";
  check(!workField.includes(facet("current_work").summary ?? "\u0000") && workField.includes(tail(p.currentWork.current?.node_ref ?? "")), "LIVE Position page: current work read from the facet's value object (Factory's reading), not the summary text", {workField, summary: facet("current_work").summary});
  check((fields["Factory current work"] ?? "").startsWith(`${p.currentWork.outcome}`) && (fields["Factory current work"] ?? "").includes(p.currentWork.basis), "LIVE Position page: Factory's own current-work reading, with its basis", {factory: fields["Factory current work"]});
  check(await positionPage.locator(".object-relations .object-link", {hasText: "Root NOW"}).count() === (facet("root_now").state === "present" ? 1 : 0), "LIVE Position page: the root NOW relation exists exactly when the facet is present");
  await shot("position-page");
  await centre.getByRole("button", {name: "Back"}).click();

  // ---- Run → Live → Positions
  await runPage.waitFor({timeout: 30000});
  await runPage.getByRole("tab", {name: "Live", exact: true}).click();
  const livePositions = runPage.locator('[data-positions="read"]');
  await livePositions.waitFor({timeout: 60000});
  const liveRows = await livePositions.locator(".fpos-row[data-position]").evaluateAll(nodes => nodes.map(node => ({ref: node.getAttribute("data-position"), custody: node.querySelector("[data-position-custody]")?.textContent, occupants: node.querySelector("[data-position-occupants]")?.getAttribute("data-position-occupants")})));
  const factoryPosition = p.custodyRun.positions.find(position => position.position_ref === p.custodyPosition);
  const custodyWords = `custody: ${factoryPosition.custody.map(entry => `${entry.state.replace(/-/g, " ")} · ${tail(entry.work_ref)}`).join("; ")}`;
  check(JSON.stringify(liveRows.map(row => row.ref)) === JSON.stringify(p.custodyRun.positions.map(position => position.position_ref)) && liveRows[0]?.custody === custodyWords, "LIVE Run → Live: the Positions and custody EQUAL Factory's inhabitation reading", {liveRows, custodyWords});
  check((p.custodyRun.occupants ?? []).length > 0 || liveRows.every(row => row.occupants === "none"), "LIVE Run → Live: no occupant relation is drawn where Factory records no attempt", {occupants: (p.custodyRun.occupants ?? []).length});
  await shot("run-live");

  // ---- Context → Prepared context
  await plane(page, "Context").click();
  const prepared = page.locator("[data-prepared-basis]");
  await prepared.waitFor({timeout: 30000});
  await prepared.locator("[data-refocus-chain] li").first().waitFor({timeout: 60000});
  const links = await prepared.locator("[data-refocus-chain] li").evaluateAll(nodes => nodes.map(node => ({state: node.getAttribute("data-link-state"), text: node.textContent.trim()})));
  const hops = p.refocus.chain;
  check(links.length === hops.length && hops.every((hop, index) => hop.gap && !hop.ref ? links[index].state === "gap" && links[index].text.includes(hop.gap) : links[index].state === "present"), "LIVE Context: the Refocus trace hop by hop, the owner's gaps in its own words", {links, hops});
  const basis = await prepared.locator(".fprep-basis").evaluate(node => Object.fromEntries([...node.querySelectorAll("dt")].map(dt => [dt.textContent.trim(), dt.nextElementSibling?.textContent?.trim()])));
  const child = facet("child_now");
  check(basis["Prepared context"] === (facet("prepared_context").state === "present" ? basis["Prepared context"] : `${facet("prepared_context").state} — ${facet("prepared_context").reason}`)
    && (child.state === "present" || basis["Child NOW"] === `${child.state} — ${child.reason}`), "LIVE Context: prepared context and child NOW as the owner states them", {basis});
  await prepared.scrollIntoViewIfNeeded();
  await shot("context");

  check(ops.filter(op => op.op === "inhabitation_read").every(op => op.result === "inhabitation_reading"), "LIVE: every AIKit inhabitation read answered through the kernel", {ops: ops.filter(op => op.op === "inhabitation_read").map(op => op.result ?? op.error)});
  check(digest(p.statePath) === p.stateDigest, "LIVE: read-only — the O-I Factory state is byte-identical after the walk");
}
