// factory-inhabitation (WORLD-INHABITATION-V1 §3/§4; CROSSWALK §8/§15; O-I
// #65 #220, Factory #195): the Cradle's World-inhabitation apertures over the
// disposable Factory ground (walk/lib/factory-ground.mjs), the REAL kernel
// and walk bridge, in two phases.
//
//   LIVE (installed owners, grade B): the owner verbs the apertures read —
//     `aikit gateway who|whoami|refocus`, `factory development
//     inhabitation|current-work` — are not published by the installed owners
//     yet. Every aperture must say so in the owner's own words and draw
//     nothing: the Desk names the unreadable owner Positions once and no card
//     claims an owner; the Agents aperture names the absence (Retry), shows no
//     Position row, keeps profiles reachable; Live → Positions and Context →
//     Prepared context name their absences.
//   CONTROLLED (typed fixtures, grade D): the walk writes the contract-shaped
//     fixtures (src/contributions/factory/fixtures/inhabitation.ts) joined to
//     the REAL specimen run refs and session; thin owner wrappers serve them
//     for exactly those verbs and exec the installed owner for everything
//     else. The same kernel ops and renderer paths then show: card owner line
//     and `?` ambiguity in Needs you; the population aperture (occupied /
//     vacant / unavailable, presence only as stated, inherited section,
//     undelivered count, named facet absence, run Positions leading); the
//     Position page (joined facets + Factory's current-work candidates); Live
//     → Positions with custody and occupant relations; Context → the nested
//     Refocus chain and prepared context.
//
// The receipt's grade is B (real kernel); the CONTROLLED checks are labelled
// "[fixture]" in their own words so the receipt never reads them as live.
import {spawnSync} from "node:child_process";
import {chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {enterFactory, factoryGround, recordOps} from "../lib/factory-ground.mjs";

const plane = (page, name) => page.getByRole("navigation", {name: "Right region planes"}).getByRole("button", {name, exact: true});
const which = name => {
  const found = spawnSync("sh", ["-c", `command -v ${name}`], {encoding: "utf8"}).stdout.trim();
  if (!found) throw new Error(`${name} is not on PATH — the walk needs the installed owner`);
  return found;
};

/** A thin controlled owner: serves a fixture for the named verbs ONLY when
 * the walk has written one, and records that it did; every other call is the
 * installed owner, exec'd unchanged. */
function wrapper(path, real, fixtures, log, cases) {
  writeFileSync(path, `#!/bin/sh
F="${fixtures}"
pos=""; prev=""; for a in "$@"; do [ "$prev" = "--position" ] && pos="$a"; prev="$a"; done
slug="\${pos##*:}"
f=""
case "$1 $2" in
${cases}
esac
if [ -n "$f" ] && [ -f "$f" ]; then printf '%s %s %s\\n' "$1" "$2" "$slug" >> "${log}"; cat "$f"; exit 0; fi
exec "${real}" "$@"
`);
  chmodSync(path, 0o755);
}

export async function setup(args) {
  const ground = await factoryGround(args);
  try {
    const dir = mkdtempSync(join(tmpdir(), "oi-inhabitation-owners-"));
    const fixtures = join(dir, "fixtures"), log = join(dir, "served.log");
    mkdirSync(fixtures);
    const aikit = join(dir, "aikit"), factory = join(dir, "factory");
    wrapper(aikit, process.env.OI_AIKIT_BIN ?? which("aikit"), fixtures, log, [
      `"gateway who") f="$F/population.json" ;;`,
      `whoami\\ *) f="$F/whoami-$slug.json" ;;`,
      `refocus\\ *) f="$F/refocus-$slug.json" ;;`,
    ].join("\n"));
    wrapper(factory, ground.factory.includes("/") ? ground.factory : which(ground.factory), fixtures, log, [
      `"development inhabitation") f="$F/factory-inhabitation.json" ;;`,
      `"development current-work") f="$F/current-work-$slug.json" ;;`,
    ].join("\n"));
    return {...ground, owners: {dir, fixtures, log},
      env: {...ground.env, OI_AIKIT_BIN: aikit, OI_FACTORY_BIN: factory, OI_INHABITATION_READ_TIMEOUT_MS: "15000"},
      cleanup: () => { rmSync(dir, {recursive: true, force: true}); ground.cleanup(); }};
  } catch (error) { ground.cleanup(); throw error; }
}

export default async function run({page, baseUrl, check, shot, channel, log, provision: p}) {
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  const ops = recordOps(page);
  const S = p.specimen, A = S.runs.A, B = S.runs.B;
  const reviewSession = S.readings.inspect.attempts.find(attempt => attempt.status === "active")?.body?.agentSessionRef;
  await page.goto(baseUrl); await channel("info");
  await enterFactory(page, {channel, bindDefaultCentral, root: p.root, project: "Specimen"});
  const centre = page.locator("main.factory-centre");
  const desk = centre.locator(".fdesk");
  await page.waitForFunction(() => document.querySelectorAll(".fdesk .fdesk-card").length >= 3, null, {timeout: 90000});

  // ================= LIVE: the installed owners do not publish the verbs ====
  const ownersLine = desk.locator('[data-desk-owners="unavailable"]');
  await ownersLine.waitFor({timeout: 30000});
  const ownersWords = (await ownersLine.innerText()).trim();
  check(/^Owner Positions couldn't be read — .+ \(factory development inhabitation\)\.$/.test(ownersWords) && /inhabitation/.test(ownersWords),
    "LIVE Desk: the unpublished Factory inhabitation read is named once above the board, in the owner's own words", {ownersWords});
  check(await desk.locator("[data-card-owner], [data-card-ambiguous]").count() === 0, "LIVE Desk: no card claims an owner Position or an ambiguity it was not given");
  const inhabitationOps = ops.filter(op => op.op === "factory_owner" && op.kind === "inhabitation");
  check(inhabitationOps.length >= 1 && inhabitationOps.every(op => !op.result && op.error), "LIVE Desk: the read went to the owner through the kernel and came back as a named error, never a reading", {inhabitationOps: inhabitationOps.slice(0, 2)});
  await shot("live-desk");

  // Agents: the population aperture names the absence; nothing is drawn.
  await centre.locator(`[data-run-card="${A.runRef}"]`).click();
  const runPage = centre.locator(`[data-run-page="${A.runRef}"]`);
  await runPage.waitFor({timeout: 30000});
  await plane(page, "Agents").click();
  const agents = page.locator("[data-agents-tab]");
  await agents.waitFor({timeout: 30000});
  await page.waitForFunction(() => document.querySelector("[data-agents-tab]")?.getAttribute("data-population-state") !== "reading", null, {timeout: 60000});
  const absence = (await agents.locator("[data-population-absence]").innerText().catch(() => "")).trim();
  check(await agents.getAttribute("data-population-state") === "unavailable" && /^Couldn't read who is here — .*unrecognized subcommand 'who'.*\(aikit gateway who\)\. Retry$/.test(absence.replace(/\s+/g, " ")),
    "LIVE Agents: the unpublished population read is named in AIKit's own words, with Retry — never an empty roster", {absence});
  check(await agents.locator(".fagent-row[data-position]").count() === 0, "LIVE Agents: no Position row is invented (OpenRig: an unknown is never drawn as present)");
  const runAbsence = (await agents.locator("[data-run-positions-absence]").innerText().catch(() => "")).trim();
  check(/^Positions on this run couldn't be read — /.test(runAbsence), "LIVE Agents: the selected run's Positions are named unreadable, not empty", {runAbsence});
  await agents.locator("[data-agent-profiles] > summary").click();
  await page.waitForFunction(() => !document.querySelector("[data-agent-profiles] [role=status]"), null, {timeout: 30000}).catch(() => {});
  check(!/Reading agent profiles/.test(await agents.locator("[data-agent-profiles]").innerText()), "LIVE Agents: the profile roster stays reachable as secondary detail");
  await shot("live-agents");

  // Live → Positions, and the current-only attempt rule.
  await runPage.getByRole("tab", {name: "Live", exact: true}).click();
  const livePositions = runPage.locator("[data-positions]");
  await livePositions.first().waitFor({timeout: 30000});
  check(await livePositions.first().getAttribute("data-positions") === "unavailable" && /couldn't be read — .*inhabitation/.test(await livePositions.first().innerText()),
    "LIVE Run → Live: Positions on this run are named unreadable with the owner's words", {text: await livePositions.first().innerText()});
  const ownerCurrent = Object.fromEntries(S.readings.inspect.attempts.filter(attempt => attempt.currentAttempt).map(attempt => [attempt.workflowUnitRef, attempt.attemptRef]));
  const openAttempt = await runPage.locator(".flive-row").evaluateAll(rows => Object.fromEntries(rows.map(row => [row.getAttribute("data-leg"), !![...row.querySelectorAll("button")].find(button => button.textContent === "Open attempt")])));
  check(Object.entries(openAttempt).every(([unit, has]) => has === (unit in ownerCurrent)), "LIVE Run → Live: a leg offers an attempt only where the owner marks one current — never the last attempt standing in", {openAttempt, ownerCurrent});
  await shot("live-run-live");

  // Context → Prepared context.
  await plane(page, "Context").click();
  const prepared = page.locator("[data-prepared-basis]");
  await prepared.waitFor({timeout: 30000});
  check(await prepared.locator('[data-prepared-absence="positions"]').count() === 1, "LIVE Context: the prepared-context basis says the run's Positions couldn't be read — it is not assembled from files", {text: await prepared.innerText()});
  await shot("live-context");

  // ================= CONTROLLED: contract-shaped fixtures, real run refs ====
  const F = await import("../../src/contributions/factory/fixtures/inhabitation.ts");
  const refs = {projectWorld: "project:specimen-walk", runA: A.runRef, runB: B.runRef, sessionA: reviewSession ?? "agent-session/specimen-review"};
  const slug = ref => ref.split(":").pop();
  const put = (name, value) => writeFileSync(join(p.owners.fixtures, name), JSON.stringify(value));
  put("population.json", F.populationFixture(refs));
  put("factory-inhabitation.json", F.factoryInhabitationFixture(refs));
  put(`whoami-${slug(F.POSITION.factory)}.json`, F.whoamiFixture(refs));
  put(`refocus-${slug(F.POSITION.factory)}.json`, F.refocusFixture(refs));
  put(`current-work-${slug(F.POSITION.factory)}.json`, {schema: "factory.current-work/v1", position_ref: F.POSITION.factory, outcome: "ambiguous",
    candidates: [{run_ref: A.runRef, custody_ref: "factory:custody:0001"}, {run_ref: B.runRef, custody_ref: "factory:custody:0003"}], considered: 3, basis: "two in-progress custodies name different runs"});

  await centre.getByRole("button", {name: "← Desk"}).click();
  await desk.getByRole("button", {name: "Refresh the Desk"}).click();
  await page.getByRole("menuitem", {name: "Read the Desk again"}).click();
  const cardA = desk.locator(`[data-run-card="${A.runRef}"]`);
  await cardA.locator("[data-card-owner]").waitFor({timeout: 60000});
  const owner = (await cardA.locator("[data-card-owner]").innerText()).trim();
  check(owner === "Held by @factory-guardian, @workcell-guardian", "[fixture] Desk: the card names the Positions holding the run, from Factory's inhabitation reading", {owner});
  const ambiguous = (await cardA.locator("[data-card-ambiguous]").innerText()).trim();
  const column = await cardA.evaluate(node => node.closest("[data-column]")?.getAttribute("data-column"));
  check(/@factory-guardian carries more than one current work/.test(ambiguous) && column === "needs-you" && (await cardA.locator(".fdesk-glyph").innerText()).trim() !== "●",
    "[fixture] Desk: an owner-stated ambiguity marks the card and puts it in Needs you", {ambiguous, column});
  check(await desk.locator(`[data-run-card="${B.runRef}"] [data-card-owner]`).count() === 0 && await desk.locator('[data-desk-owners="unavailable"]').count() === 0,
    "[fixture] Desk: a run Factory names no Position for carries no owner line; the absence line is gone once the owner answers");
  await shot("fixture-desk");

  // Agents: the population aperture.
  await cardA.click();
  await runPage.waitFor({timeout: 30000});
  await plane(page, "Agents").click();
  await agents.locator("[data-population-absence] button", {hasText: "Retry"}).click();
  // The run's Positions (Factory's reading) may stand before the population
  // lands; wait for the owner's population reading itself.
  await page.waitForFunction(() => document.querySelector("[data-agents-tab]")?.getAttribute("data-population-state") === "read"
    && document.querySelectorAll("[data-agents-tab] .fagent-row[data-position]").length >= 6, null, {timeout: 30000});
  const rows = await agents.locator(".fagent-row[data-position]").evaluateAll(nodes => nodes.map(node => ({
    ref: node.getAttribute("data-position"), occupancy: node.getAttribute("data-occupancy"), work: node.getAttribute("data-work"),
    section: node.closest("section")?.getAttribute("aria-label"), mark: node.querySelector(".fpos-mark")?.textContent,
    words: node.querySelector("[data-occupancy-words]")?.textContent?.trim(), undelivered: node.querySelector("[data-undelivered]")?.getAttribute("data-undelivered") ?? null})));
  const by = Object.fromEntries(rows.map(row => [row.ref, row]));
  check(JSON.stringify(rows.filter(row => row.section === "On this run").map(row => row.ref)) === JSON.stringify([F.POSITION.factory, F.POSITION.unlisted]),
    "[fixture] Agents: the Positions Factory holds on the selected run lead, in Factory's order — including one the population does not list", {rows});
  check(by[F.POSITION.unlisted]?.mark === "?" && by[F.POSITION.unlisted]?.occupancy === "unknown", "[fixture] Agents: a Position only Factory names has unknown occupancy, drawn `?` — not vacant, not present", by[F.POSITION.unlisted]);
  check(by[F.POSITION.root]?.mark === "●" && by[F.POSITION.root]?.undelivered === "2" && by[F.POSITION.root]?.section === "In this world", "[fixture] Agents: an occupied, active Position is `●` with its undelivered count", by[F.POSITION.root]);
  check(by[F.POSITION.anima]?.occupancy === "vacant" && by[F.POSITION.anima]?.mark === "○", "[fixture] Agents: a vacant Position is `○ Vacant`", by[F.POSITION.anima]);
  check(by[F.POSITION.aikit]?.occupancy === "unavailable" && by[F.POSITION.aikit]?.mark === "?", "[fixture] Agents: an unavailable occupancy is `?` with its reason", by[F.POSITION.aikit]);
  check(by[F.POSITION.central]?.section === "Inherited" && by[F.POSITION.central]?.mark !== "●" && /presence not reported/.test(by[F.POSITION.central]?.words ?? ""), "[fixture] Agents: an inherited root Position sits in its own section; occupied with no stated presence is never drawn present", by[F.POSITION.central]);
  check(by[F.POSITION.factory]?.work === "ambiguous", "[fixture] Agents: an ambiguous current work is carried as ambiguous, never one", by[F.POSITION.factory]);
  check(/the Gateway inbox for @anima-4 is unreachable/.test(await agents.locator("[data-population-absences]").innerText()), "[fixture] Agents: a facet the owner could not read is named, not dropped");
  await shot("fixture-agents");

  // Position page: joined facets + Factory's current-work candidates.
  await agents.locator(`.fagent-row[data-position="${F.POSITION.factory}"]`).click();
  const positionPage = centre.locator('.object-page[data-object-kind="factory-position"]');
  await positionPage.locator(".object-fields dt").first().waitFor({timeout: 30000});
  const fields = await positionPage.evaluate(node => Object.fromEntries([...node.querySelectorAll(".object-fields > dt")].map(dt => [dt.textContent.trim(), dt.nextElementSibling?.textContent?.trim()])));
  check(fields.Position?.startsWith("Software Factory Guardian") && fields.Authority === "unavailable — the authority reading timed out" && fields["Session"] === "absent — the occupant has no live AgentSession",
    "[fixture] Position page: every facet of the joined reading with its standing and reason", fields);
  check(/^ambiguous — .+; .+ \(two in-progress custodies name different runs\)$/.test(fields["Factory current work"] ?? ""), "[fixture] Position page: Factory's current-work candidates are all listed, never collapsed to one", {factoryCurrentWork: fields["Factory current work"]});
  check(await positionPage.locator(".object-relations .object-link", {hasText: "factory-guardian"}).count() === 1, "[fixture] Position page: the occupant's agent profile is reachable as a relation (secondary detail)");
  await shot("fixture-position-page");
  await centre.getByRole("button", {name: "Back"}).click();

  // Live → Positions.
  await runPage.waitFor({timeout: 30000});
  await runPage.getByRole("tab", {name: "Live", exact: true}).click();
  const positionsSection = runPage.locator('[data-positions="read"]');
  await positionsSection.waitFor({timeout: 30000});
  const livePos = await positionsSection.locator(".fpos-row").evaluateAll(nodes => nodes.map(node => ({ref: node.getAttribute("data-position"), custody: node.querySelector("[data-position-custody]")?.textContent, occupants: [...node.querySelectorAll("[data-occupant-relation]")].map(o => o.textContent)})));
  check(livePos.length === 2 && livePos[0].custody === "custody: in progress" && livePos[1].custody === "custody: blocked" && /attempt participant · factory-guardian · pi · deepseek-v4-pro · workcell local/.test(livePos[0].occupants[0] ?? ""),
    "[fixture] Run → Live: Positions with their custody and Factory's occupant relations", {livePos});
  check(/carries more than one current work/.test(await positionsSection.locator("[data-positions-ambiguous]").innerText()), "[fixture] Run → Live: the ambiguity is said on the run page too");
  await shot("fixture-run-live");

  // Context → Prepared context: the nested Refocus chain.
  await plane(page, "Context").click();
  const choice = prepared.locator('select[aria-label="Position whose context to show"]');
  await choice.waitFor({timeout: 30000});
  check((await choice.locator("option").allInnerTexts()).join("|") === "choose one…|@factory-guardian|@workcell-guardian", "[fixture] Context: two Positions hold the run — the person chooses whose context; none is picked for them");
  await choice.selectOption(F.POSITION.factory);
  const chain = prepared.locator("[data-refocus-chain] li");
  await chain.first().waitFor({timeout: 30000});
  const links = await chain.evaluateAll(nodes => nodes.map(node => node.textContent.trim()));
  check(links.length === 6 && links[0].startsWith("Current operation") && links[5].startsWith("ProjectCentral ground") && /Journey absent — the run names no Journey/.test(links[3]),
    "[fixture] Context: the Refocus chain, nested from the current operation out to the ProjectCentral ground, absences said", {links});
  check((await prepared.locator("[data-prepared-context]").innerText()).trim() === "prepared NOW context · revision r7", "[fixture] Context: the joined reading's prepared context with its revision");
  await shot("fixture-context");

  const served = spawnSync("cat", [p.owners.log], {encoding: "utf8"}).stdout.trim().split("\n").filter(Boolean);
  check(["gateway who", "development inhabitation", "whoami --position", "refocus --position", "development current-work"].every(prefix => served.some(line => line.startsWith(prefix))),
    "[fixture] every controlled read reached its owner executable through the kernel (none was answered in the renderer)", {served});
}
