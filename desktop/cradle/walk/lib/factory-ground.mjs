// The disposable Factory ground the 11-FACTORY walks stand on: the editor
// walk's temp Central ground (isolated OI_HOME, never the owner's) plus
//   - Work/Specimen — a real Factory source built entirely by the installed
//     owner CLI (walk/lib/factory-specimen.mjs): run A with a fork, a join, a
//     gate, a returned survey attempt awaiting Recognition and a running
//     review attempt; run B queued with no attempts; run C with no units;
//   - Work/Other — a Factory source set up with zero runs (the empty Desk);
//   - Work/Broken — a Factory source whose state the owner cannot read (the
//     partial Desk), its refusal words captured from the owner in setup.
import {execFileSync, spawnSync} from "node:child_process";
import {mkdirSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {setup as sourceSetup} from "../scenarios/editor.mjs";
import {makeFactorySpecimen} from "./factory-specimen.mjs";

export async function factoryGround(args, {sessionRef} = {}) {
  const source = await sourceSetup(args);
  try {
    const factory = process.env.OI_FACTORY_BIN ?? "factory";
    const specimen = await makeFactorySpecimen({root: source.root, project: "Specimen", factory, sessionRef});
    source.call("projectcentral.init", {project: "Specimen", project_id: "specimen-walk"});
    // Other: a Factory source with zero runs.
    try { source.call("projectcentral.init", {project: "Other", project_id: "other-walk"}); } catch { /* already a project */ }
    const other = JSON.parse(execFileSync(factory, ["project", "setup", join(source.root, "Work", "Other"), "central-project:Other", "--json"], {encoding: "utf8"}));
    // Broken: a Factory source whose developmental state is unreadable.
    mkdirSync(join(source.root, "Work", "Broken"), {recursive: true});
    source.call("projectcentral.init", {project: "Broken", project_id: "broken-walk"});
    const broken = JSON.parse(execFileSync(factory, ["project", "setup", join(source.root, "Work", "Broken"), "central-project:Broken", "--json"], {encoding: "utf8"}));
    writeFileSync(broken.statePath, "{\"schema\": \"broken\n");
    const refused = spawnSync(factory, ["project", "locate", join(source.root, "Work", "Broken"), "--json"], {encoding: "utf8"});
    if (refused.status === 0) throw new Error("the owner located a corrupted Factory state — the partial fixture is invalid");
    const brokenWords = String(refused.stderr).replace(/^factory:\s*/, "").trim();
    return {...source, factory, specimen, other, broken: {...broken, refusal: brokenWords}};
  } catch (error) { source.cleanup(); throw error; }
}

/** Bind the ground, enter Factory, and put a project in scope through the
 * Factory navigator's own project picker (the scope's writer is the
 * workspace; the Desk reads the published scope). */
export async function enterFactory(page, {channel, bindDefaultCentral, root, project}) {
  await bindDefaultCentral(page, root);
  await page.reload(); await channel("info");
  await page.getByRole("radiogroup", {name: "Workspace mode", exact: true}).getByRole("radio", {name: "Factory", exact: true}).click();
  await page.locator("main.factory-centre").waitFor();
  if (project) await chooseProject(page, project);
}

export async function chooseProject(page, project) {
  const picker = page.locator('nav.factory-navigator select[aria-label="Project"]');
  await picker.waitFor({timeout: 30000});
  await page.waitForFunction(name => [...document.querySelectorAll('nav.factory-navigator select[aria-label="Project"] option')].some(option => option.value === name), project, {timeout: 30000});
  await picker.selectOption(project);
}

/** Every op the page sends to the bridge, with its result — for asserting
 * which owner reads ran (and that no mutation ran where none may). */
export function recordOps(page) {
  const calls = [];
  page.on("response", async response => {
    if (!response.url().endsWith("/op")) return;
    try {
      const body = await response.json();
      const request = response.request().postDataJSON();
      calls.push({op: request.op, kind: request.request?.kind, read: request.read, result: body.outcome?.result, error: body.error});
    } catch { /* a closed handle at teardown */ }
  });
  return calls;
}

/** Two-sided geometry: |a − b| ≤ 0.5px. */
export const near = (a, b) => Math.abs(a - b) <= 0.5;

/** Screenshots at 1440/1000/760 in light and dark (common acceptance). */
export async function shotMatrix(page, shot, prefix, prepare) {
  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({colorScheme: scheme});
    for (const width of [1440, 1000, 760]) {
      await page.setViewportSize({width, height: 860});
      if (prepare) await prepare({scheme, width});
      await page.waitForTimeout(250);
      await shot(`${prefix}-${width}-${scheme}`);
    }
  }
  await page.emulateMedia({colorScheme: "light"});
  await page.setViewportSize({width: 1280, height: 820});
}
