// factory-development (queue cell 3, the first 6D consumer): Factory's own
// developmental reads — project and workflow-units — render the owner's
// contracts verbatim; Workcell's placement status renders beside them; a
// nonexistent state path renders the OWNER'S refusal verbatim; nothing reads
// before the explicit act.
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

  // Workcell's placement status: the owner's own fields verbatim.
  await page.getByRole("button", {name: "Read Workcell status", exact: true}).click();
  await page.locator(".factory-development-status dl").waitFor({timeout: 30000});
  const statusText = await main.locator(".factory-development-status").innerText();
  check(statusText.includes("workcell:local")||statusText.includes("healthy")||statusText.includes("unavailable"), "Workcell placement status renders the owner's own reading");
  await shot("workcell-status-beside-factory");
}
