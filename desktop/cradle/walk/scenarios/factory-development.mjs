// factory-development (queue cell 3 + cell B, the 6D consumer): Factory's
// own developmental reads as first-class rows — the project read's journey
// registry renders as journey rows, each expanding through the owner's
// journey read into its run rows, each run expanding into the Trajectory
// presentation (chronological execution rows in owner order, expandable
// verbatim detail) with the execution-telemetry read whose unavailability
// renders in the owner's own words; the re-pinned build view
// (`build snapshot <state> <project-ref> <run-ref>` — the old
// `build discover`/`--binding` grammar is gone from the installed cut)
// reaches the owner and renders its refusal verbatim on the specimen;
// Workcell's placement status renders beside them; nothing reads before the
// explicit act.
//
// The developmental state is seeded through the owner's own generator
// (`factory conformance developmental-state`) — the owner publishes the
// specimen, the walk only names its path.
import {execFileSync} from "node:child_process";
import {join} from "node:path";
import {mkdirSync} from "node:fs";
import {setup as sourceSetup} from "./editor.mjs";

export async function setup(args) {
  const source = await sourceSetup(args);
  const factory = process.env.OI_FACTORY_BIN ?? "factory";
  const statePath = join(source.root, "factory", "developmental-state.json");
  mkdirSync(join(source.root, "factory"), {recursive: true});
  const out = execFileSync(factory, ["conformance", "developmental-state", statePath], {encoding: "utf8"});
  if (!out.includes("Provider state")) throw new Error(`state generator refused: ${out.slice(0, 200)}`);
  // The generator itself names the specimen's project — the walk uses the
  // owner's own disclosure, never a desktop-derived ref.
  const projectRef = (out.match(/^Project:\s*(\S+)$/m) ?? [])[1] ?? null;
  if (!projectRef) throw new Error(`the generator disclosed no project ref: ${out.slice(0, 200)}`);
  return {...source, env: {...source.env, OI_FACTORY_BIN: factory}, statePath, projectRef, cleanup: source.cleanup};
}

export default async function run({page, baseUrl, check, shot, channel, log, provision: p}) {
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  await page.goto(baseUrl);await channel("info");
  const nav = page.getByRole("complementary", {name: "World navigator"});
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await page.getByRole("button", {name: "Open project wiki", exact: true}).waitFor({timeout: 20000});

  // Open the factory surface through its real navigator entry.
  await page.getByRole("button", {name: "Factory development", exact: true}).click();
  const main = page.locator("main.factory-development");
  await main.waitFor();

  // At rest nothing reads: no owner payload is present before the explicit act.
  check(await main.locator("[data-owner-payload]").count() === 0, "At rest nothing reads — no owner payload exists before the explicit act");

  // A nonexistent state path: the OWNER'S refusal renders verbatim.
  await page.getByRole("textbox", {name: "Developmental state path", exact: true}).fill(join(p.root, "factory", "missing-state.json"));
  await page.getByRole("button", {name: "Read project", exact: true}).click();
  await page.locator('[data-reading-refused="true"]').waitFor({timeout: 30000});
  const refusal = await main.locator('[data-reading-refused="true"] p').innerText();
  check(refusal.includes("No such file or directory") || refusal.includes("refused"), `The owner's own refusal renders verbatim (${refusal.slice(0, 80)}…)`);

  // The real seeded state: the project read renders the owner's contract
  // verbatim, with the project ref the owner itself discloses.
  await page.getByRole("textbox", {name: "Developmental state path", exact: true}).fill(p.statePath);
  await page.getByRole("textbox", {name: "Project ref", exact: true}).fill(p.projectRef);
  await page.getByRole("button", {name: "Read project", exact: true}).click();
  const projectPanel = main.locator('[data-contract="factory.project-reading/v1"]');
  await projectPanel.waitFor({timeout: 30000});
  const projectPayload = JSON.parse(await projectPanel.locator("[data-owner-payload]").first().innerText());
  check(projectPayload.contract === "factory.project-reading/v1", "The project read carries the owner's own contract verbatim");
  check(typeof projectPayload.projectRef === "string" && projectPayload.projectRef.startsWith("project:"), "The owner's project ref renders as the owner names it");
  check(Array.isArray(projectPayload.journeys), "The project reading discloses the owner's journey registry");

  // The workflow-units read renders the owner's units with source bases.
  await page.getByRole("button", {name: "Read workflow units", exact: true}).click();
  const unitsPanel = main.locator('[data-contract="factory.workflow-unit-list-reading/v1"]');
  await unitsPanel.waitFor({timeout: 30000});
  const unitsPayload = JSON.parse(await unitsPanel.locator("[data-owner-payload]").first().innerText());
  check(unitsPayload.contract === "factory.workflow-unit-list-reading/v1" && Array.isArray(unitsPayload.units), "The workflow-units read carries the owner's contract with its units");
  await shot("factory-development-readings");

  // The journey registry renders as first-class rows carrying the owner's
  // own journeyRef/frontier/status verbatim.
  const journeyPayload = projectPayload.journeys[0];
  const journeyRow = main.locator(`[data-journey-row="${journeyPayload.journeyRef}"]`);
  await journeyRow.waitFor({timeout: 10000});
  check((await journeyRow.innerText()).includes(journeyPayload.frontier), "The journey row renders the owner's frontier verbatim", journeyPayload);
  check((await journeyRow.getAttribute("data-journey-row")) === journeyPayload.journeyRef, "The journey row's identity is the owner's journeyRef");

  // Expanding the journey is an explicit act: the owner's journey read
  // renders verbatim and its runRefs become run rows.
  await journeyRow.locator("summary").first().click();
  const journeyPanel = journeyRow.locator('[data-contract="factory.journey-reading/v1"]');
  await journeyPanel.waitFor({timeout: 30000});
  const journeyReading = JSON.parse(await journeyPanel.locator("[data-owner-payload]").first().innerText());
  check(journeyReading.journeyRef === journeyPayload.journeyRef && journeyReading.frontier === journeyPayload.frontier, "The journey read carries the owner's identity and frontier verbatim");
  const runRows = journeyRow.locator("[data-run-row]");
  check(await runRows.count() === journeyPayload.runRefs.length, "The journey's runRefs render as run rows, one per owner ref", journeyPayload.runRefs);

  // Expanding a run: the Trajectory presentation — the owner's executions as
  // chronological rows in owner order, each expandable into verbatim detail.
  const runRef = journeyPayload.runRefs[0];
  const runRow = journeyRow.locator(`[data-run-row="${runRef}"]`);
  await runRow.locator("summary").first().click();
  await runRow.locator('.factory-run-facts').waitFor({timeout: 30000});
  const runPanel = runRow.locator('[data-contract="factory.run-reading/v1"]');
  check(await runPanel.count() === 1, "The run read carries the owner's run-reading contract");
  // The full reading lives inside a closed <details>; textContent reaches it.
  const runReading = JSON.parse(await runPanel.locator("[data-owner-payload]").first().textContent());
  const ownerExecutions = runReading.executions ?? [];
  check(await runRow.locator("[data-execution-row]").count() === ownerExecutions.length, "The executions band renders one row per owner execution in owner order", ownerExecutions.map(e => e.executionRef));
  if (ownerExecutions.length) {
    await runRow.locator("[data-execution-row]").first().locator("summary").first().click();
    const detail = await runRow.locator('[data-owner-payload="execution"]').first().innerText();
    const detailPayload = JSON.parse(detail);
    check(detailPayload.executionRef === ownerExecutions[0].executionRef, "The expanded execution detail is the owner's own payload verbatim", detailPayload);
  }

  // Execution telemetry: the owner's unavailability renders verbatim —
  // the specimen carries no telemetry and the desktop invents no observations.
  await runRow.getByRole("button", {name: "Read execution telemetry", exact: true}).click();
  const telemetryRefusal = runRow.locator(".factory-telemetry [data-owner-refusal]");
  await telemetryRefusal.waitFor({timeout: 30000});
  const telemetryText = await telemetryRefusal.getAttribute("data-owner-refusal");
  check(telemetryText.includes("ExecutionTelemetryNotFound") || telemetryText.includes("refused") || telemetryText.includes("error"), "The owner's telemetry refusal renders verbatim", telemetryText?.slice(0, 120));

  // The re-pinned build view: the new grammar reaches the owner; on this
  // specimen the owner's build provider errors, and the refusal renders
  // verbatim — nothing fabricated, no stale desktop payload.
  await page.getByRole("textbox", {name: "Run ref for build view", exact: true}).fill(runRef);
  await page.getByRole("button", {name: "Read build view", exact: true}).click();
  const buildPanel = main.locator('.factory-development-build [data-reading-refused="true"], .factory-development-build [data-contract="factory.build-view/v1"]');
  await buildPanel.waitFor({timeout: 30000});
  const buildText = await buildPanel.first().innerText();
  check(buildText.includes("refused") || buildText.includes("factory.build-view/v1"), "The re-pinned build-view route reaches the owner and discloses its answer verbatim", buildText.slice(0, 140));
  await shot("factory-trajectory-rows");

  // Workcell's placement status: the owner's own fields verbatim.
  await page.getByRole("button", {name: "Read Workcell status", exact: true}).click();
  await page.locator(".factory-development-status dl").waitFor({timeout: 30000});
  const statusText = await main.locator(".factory-development-status").innerText();
  check(statusText.includes("workcell:local")||statusText.includes("healthy")||statusText.includes("unavailable"), "Workcell placement status renders the owner's own reading");
  await shot("workcell-status-beside-factory");
}
