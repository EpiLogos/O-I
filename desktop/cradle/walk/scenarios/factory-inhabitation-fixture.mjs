// factory-inhabitation-fixture (WORLD-INHABITATION-V1 §3/§4), CONTROLLED —
// secondary to the live `factory-inhabitation` walk. It exercises the
// standings the real World does not hold yet (occupied/idle, an inherited
// root Position, a Position with no definition, an unread Gateway journal, an
// ambiguous current work, attempt occupants with body and placement NOW, an
// attempt naming no Position) and the refusal paths, on the disposable
// Factory specimen ground (walk/lib/factory-ground.mjs), the REAL kernel and
// walk bridge.
//
// Thin owner wrappers serve the typed fixtures — in the INSTALLED owners'
// shapes, AIKit's inside its --json envelope (src/contributions/factory/
// fixtures/inhabitation.ts) — for exactly the inhabitation verbs, and exec
// the installed owner for everything else. A fixture with a sibling
// `<name>.exit` answers with that exit status (a refusal). The receipt is
// graded D (controlled).
import {spawnSync} from "node:child_process";
import {chmodSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync} from "node:fs";
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

function wrapper(path, real, fixtures, log, cases) {
  writeFileSync(path, `#!/bin/sh
F="${fixtures}"
pos=""; prev=""; for a in "$@"; do [ "$prev" = "--position" ] && pos="$a"; prev="$a"; done
slug="\${pos##*:}"; slug="\${slug#@}"
f=""
case "$1 $2" in
${cases}
esac
if [ -n "$f" ] && [ -f "$f" ]; then printf '%s %s %s\\n' "$1" "$2" "$slug" >> "${log}"; cat "$f"; if [ -f "$f.exit" ]; then exit "$(cat "$f.exit")"; fi; exit 0; fi
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
      env: {...ground.env, OI_AIKIT_BIN: aikit, OI_FACTORY_BIN: factory},
      cleanup: () => { rmSync(dir, {recursive: true, force: true}); ground.cleanup(); }};
  } catch (error) { ground.cleanup(); throw error; }
}

export default async function run({page, baseUrl, check, shot, channel, log, provision: p}) {
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  const ops = recordOps(page);
  const F = await import("../../src/contributions/factory/fixtures/inhabitation.ts");
  const S = p.specimen, A = S.runs.A, B = S.runs.B;
  const reviewSession = S.readings.inspect.attempts.find(attempt => attempt.status === "active")?.body?.agentSessionRef;
  const refs = {projectWorld: "project:specimen-walk", runA: A.runRef, runB: B.runRef, sessionA: reviewSession ?? "agent-session/specimen-review"};
  const slug = ref => ref.split(":").pop();
  const put = (name, value, exit) => {
    writeFileSync(join(p.owners.fixtures, name), JSON.stringify(value));
    const exitFile = join(p.owners.fixtures, `${name}.exit`);
    if (exit !== undefined) writeFileSync(exitFile, String(exit)); else try { unlinkSync(exitFile); } catch { /* none */ }
  };
  // Refusals first: the owners' own refusal documents (AIKit envelope ok:false;
  // Factory factory.refusal/v1 on stdout, exit 2).
  put("population.json", {ok: false, schema: 1, data: null, error: {code: "position.world_unresolved", fact: "The Position World cannot be resolved.", consequence: "Nothing was listed.", action: "Run ctrl --json action run central.world '{}'."}}, 2);
  put("factory-inhabitation.json", {schema: "factory.refusal/v1", code: "factory.state.locked", fact: "The developmental state is locked by another writer.", consequence: "Nothing was read.", action: "Retry when the writer finishes."}, 2);

  await page.goto(baseUrl); await channel("info");
  await enterFactory(page, {channel, bindDefaultCentral, root: p.root, project: "Specimen"});
  const centre = page.locator("main.factory-centre");
  const desk = centre.locator(".fdesk");
  await page.waitForFunction(() => document.querySelectorAll(".fdesk .fdesk-card").length >= 3, null, {timeout: 90000});

  // ---- refusals, named in the owners' words
  const ownersLine = desk.locator('[data-desk-owners="unavailable"]');
  await ownersLine.waitFor({timeout: 30000});
  check((await ownersLine.innerText()).trim() === "Owner Positions couldn't be read — The developmental state is locked by another writer. Nothing was read. Retry when the writer finishes. (factory development inhabitation).",
    "[fixture] Desk: Factory's three-part refusal is named once above the board", {text: await ownersLine.innerText()});
  check(await desk.locator("[data-card-owner], [data-card-ambiguous]").count() === 0, "[fixture] Desk: no card claims an owner it was not given");
  await centre.locator(`[data-run-card="${A.runRef}"]`).click();
  const runPage = centre.locator(`[data-run-page="${A.runRef}"]`);
  await runPage.waitFor({timeout: 30000});
  await plane(page, "Agents").click();
  const agents = page.locator("[data-agents-tab]");
  await agents.waitFor({timeout: 30000});
  await page.waitForFunction(() => document.querySelector("[data-agents-tab]")?.getAttribute("data-population-state") === "unavailable", null, {timeout: 60000});
  const absence = (await agents.locator("[data-population-absence]").innerText()).replace(/\s+/g, " ").trim();
  check(absence === "Couldn't read who is here — The Position World cannot be resolved. Nothing was listed. Run ctrl --json action run central.world '{}'. (aikit gateway who). Retry",
    "[fixture] Agents: AIKit's ok:false envelope is named in its own three-part words, with Retry — never an empty roster", {absence});
  check(await agents.locator(".fagent-row[data-position]").count() === 0, "[fixture] Agents: no Position row is invented");
  await shot("refusals");

  // ---- the controlled standings
  put("population.json", F.aikitEnvelope(F.populationFixture(refs), [{code: "gateway.journal_behind", message: "the Gateway journal is 2 turns behind"}]));
  put("factory-inhabitation.json", F.factoryInhabitationFixture(refs));
  put(`current-work-${slug(F.POSITION.factory)}.json`, F.currentWorkFixture(refs));
  put(`whoami-${slug(F.POSITION.factory)}.json`, F.aikitEnvelope(F.whoamiFixture(refs)));
  put(`refocus-${slug(F.POSITION.factory)}.json`, F.aikitEnvelope(F.refocusFixture(refs)));

  await centre.getByRole("button", {name: "← Desk"}).click();
  // The Run page's own read may still land (it began under the refusals);
  // the checks below read the Desk only once its ⟳ read has completed.
  const before = ops.length;
  await desk.getByRole("button", {name: "Refresh the Desk"}).click();
  await page.getByRole("menuitem", {name: "Read the Desk again"}).click();
  for (let waited = 0; !ops.slice(before).some(op => op.op === "factory_owner" && op.kind === "locate") && waited < 60000; waited += 100) await page.waitForTimeout(100);
  await page.waitForFunction(() => document.querySelector(".fdesk")?.getAttribute("data-desk-state") === "read", null, {timeout: 120000});
  const cardA = desk.locator(`[data-run-card="${A.runRef}"]`);
  const owner = (await cardA.locator("[data-card-owner]").innerText()).trim();
  check(owner === "Held by @factory-guardian, workcell-guardian", "[fixture] Desk: Positions in custody, named by Central's handle — or by the ref's own words where the population has no row", {owner});
  const ambiguous = (await cardA.locator("[data-card-ambiguous]").innerText()).trim();
  const column = await cardA.evaluate(node => node.closest("[data-column]")?.getAttribute("data-column"));
  check(/^\? @factory-guardian carries more than one current work \(2 candidates\)$/.test(ambiguous) && column === "needs-you", "[fixture] Desk: Factory's ambiguous current work marks the card and puts it in Needs you", {ambiguous, column});
  check(await desk.locator(`[data-run-card="${B.runRef}"] [data-card-owner]`).count() === 0 && await desk.locator('[data-desk-owners="unavailable"]').count() === 0,
    "[fixture] Desk: a run Factory names no Position for carries no owner line; the refusal line is gone once the owner answers");
  await shot("desk");

  await cardA.click();
  await runPage.waitFor({timeout: 30000});
  await plane(page, "Agents").click();
  // The Desk's ⟳ re-read the scope's population (the one shared reading);
  // Retry is only needed if it still stands unread.
  if (await agents.locator("[data-population-absence] button").count()) await agents.locator("[data-population-absence] button", {hasText: "Retry"}).click();
  await page.waitForFunction(() => document.querySelector("[data-agents-tab]")?.getAttribute("data-population-state") === "read"
    && document.querySelectorAll("[data-agents-tab] .fagent-row[data-position]").length >= 7, null, {timeout: 30000});
  const rows = await agents.locator(".fagent-row[data-position]").evaluateAll(nodes => nodes.map(node => ({
    ref: node.getAttribute("data-position"), occupancy: node.getAttribute("data-occupancy"), work: node.getAttribute("data-work"),
    section: node.closest("section")?.getAttribute("aria-label"), mark: node.querySelector(".fpos-mark")?.textContent,
    words: node.querySelector("[data-occupancy-words]")?.textContent?.trim(), undelivered: node.querySelector("[data-undelivered]")?.getAttribute("data-undelivered") ?? null,
    definition: node.querySelector("[data-definition]")?.getAttribute("data-definition") ?? null})));
  const by = Object.fromEntries(rows.map(row => [row.ref, row]));
  check(JSON.stringify(rows.filter(row => row.section === "On this run").map(row => row.ref)) === JSON.stringify([F.POSITION.factory, F.POSITION.unlisted]), "[fixture] Agents: Factory's Positions on the selected run lead, in Factory's order", {rows});
  check(by[F.POSITION.unlisted]?.mark === "?" && by[F.POSITION.unlisted]?.occupancy === "unknown", "[fixture] Agents: a Position only Factory names has unknown occupancy, drawn `?`", by[F.POSITION.unlisted]);
  check(by[F.POSITION.root]?.mark === "●" && by[F.POSITION.root]?.undelivered === "2", "[fixture] Agents: an occupied, active Position is `●` with its undelivered count", by[F.POSITION.root]);
  check(by[F.POSITION.anima]?.occupancy === "vacant" && by[F.POSITION.anima]?.undelivered === null, "[fixture] Agents: vacant; an unread Gateway journal shows no count (never a zero)", by[F.POSITION.anima]);
  check(by[F.POSITION.aikit]?.mark === "?" && by[F.POSITION.aikit]?.occupancy === "unavailable", "[fixture] Agents: an unavailable occupancy is `?`", by[F.POSITION.aikit]);
  check(by[F.POSITION.undefinedPosition]?.definition === "absent", "[fixture] Agents: a Position with no Central definition says so", by[F.POSITION.undefinedPosition]);
  check(by[F.POSITION.central]?.section === "Inherited" && by[F.POSITION.central]?.mark !== "●" && /presence not reported/.test(by[F.POSITION.central]?.words ?? ""), "[fixture] Agents: inherited root Position in its own section; occupied without stated presence is never drawn present", by[F.POSITION.central]);
  const notes = (await agents.locator("[data-population-warnings]").innerText()) + (await agents.locator("[data-population-absences]").innerText());
  check(/the Gateway journal is 2 turns behind/.test(notes) && /the Gateway journal for @anima-4 is unreachable/.test(notes), "[fixture] Agents: the envelope's warnings and the reading's absences are named, not dropped", {notes});
  await shot("agents");

  await agents.locator(`.fagent-row[data-position="${F.POSITION.factory}"]`).click();
  const positionPage = centre.locator('.object-page[data-object-kind="factory-position"]');
  await positionPage.locator(".object-fields dt").first().waitFor({timeout: 30000});
  const fields = await positionPage.evaluate(node => Object.fromEntries([...node.querySelectorAll(".object-fields > dt")].map(dt => [dt.textContent.trim(), dt.nextElementSibling?.textContent?.trim()])));
  check(fields.Position === "Software Factory Guardian · @factory-guardian · r1" && fields.Occupancy === "occupied · generation 1 · initial · factory-guardian · idle" && fields.Authority === "unavailable — the authority reading timed out",
    "[fixture] Position page: facets from their value objects, standings and reasons as given", fields);
  check(/^ambiguous: Factory#261 \(run: .+\) \[in-progress\]; Factory#262 \(run: .+\) \[in-progress\] — /.test(fields["Factory current work"] ?? ""), "[fixture] Position page: every candidate of Factory's ambiguous current work", {factory: fields["Factory current work"]});
  check(await positionPage.locator(".object-relations .object-link", {hasText: "factory-guardian"}).count() === 1, "[fixture] Position page: the occupant's agent profile is a relation");
  await shot("position-page");
  await centre.getByRole("button", {name: "Back"}).click();

  await runPage.waitFor({timeout: 30000});
  await runPage.getByRole("tab", {name: "Live", exact: true}).click();
  const positionsSection = runPage.locator('[data-positions="read"]');
  await positionsSection.waitFor({timeout: 30000});
  const occupants = await positionsSection.locator("[data-occupant-attempt]").evaluateAll(nodes => nodes.map(node => ({attempt: node.getAttribute("data-occupant-attempt"), current: node.getAttribute("data-occupant-current"), row: node.closest(".fpos-row")?.getAttribute("data-position"), text: node.textContent})));
  check(occupants.length === 2 && occupants[0].row === F.POSITION.factory && occupants[0].current === "true" && /current attempt · active · factory-guardian · pi · deepseek-v4-pro · workcell local/.test(occupants[0].text)
    && occupants[1].row === "none" && /placement NOW: absent — the attempt was admitted without a placement NOW/.test(occupants[1].text),
    "[fixture] Run → Live: occupants by attempt under their Position; an attempt naming no Position is shown as such, with Factory's reasons", {occupants});
  check(/carries more than one current work/.test(await positionsSection.locator("[data-positions-ambiguous]").innerText()), "[fixture] Run → Live: the ambiguity is said on the run page too");
  await shot("run-live");

  await plane(page, "Context").click();
  const prepared = page.locator("[data-prepared-basis]");
  const choice = prepared.locator('select[aria-label="Position whose context to show"]');
  await choice.waitFor({timeout: 30000});
  check((await choice.locator("option").allInnerTexts()).join("|") === "choose one…|@factory-guardian|workcell-guardian", "[fixture] Context: two Positions hold the run — the person chooses; none is picked for them");
  await choice.selectOption(F.POSITION.factory);
  const chain = prepared.locator("[data-refocus-chain] li");
  await chain.first().waitFor({timeout: 30000});
  const links = await chain.evaluateAll(nodes => nodes.map(node => node.textContent.trim()));
  check(links.length === 6 && links[0].startsWith("Current operation") && links[5].startsWith("ProjectCentral ground") && links[3] === "Journey gap — no Journey or Commission is named by the current work or its Run",
    "[fixture] Context: the Refocus trace nested from the current operation to the ground, gaps in the owner's words", {links});
  await prepared.scrollIntoViewIfNeeded();
  await shot("context");

  const served = spawnSync("cat", [p.owners.log], {encoding: "utf8"}).stdout.trim().split("\n").filter(Boolean);
  check(["gateway who", "development inhabitation", "whoami --position", "refocus --position", "development current-work"].every(prefix => served.some(line => line.startsWith(prefix))),
    "[fixture] every controlled read reached its owner executable through the kernel (none was answered in the renderer)", {served});
}
