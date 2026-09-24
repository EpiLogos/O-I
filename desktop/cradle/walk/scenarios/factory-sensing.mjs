// Factory sensing through the real kernel and native Factory CLI, on the
// disposable Factory specimen. Source collection is owner-native; the UI
// performs reads only and is compared with independent CLI readings.
import {createHash} from "node:crypto";
import {copyFileSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {ownerJson} from "../lib/factory-specimen.mjs";
import {chooseProject, factoryGround, recordOps} from "../lib/factory-ground.mjs";

const digest = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const todayInLondon = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {timeZone:"Europe/London", year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export async function setup(args) {
  const ground = await factoryGround(args);
  try {
    const {factory, specimen} = ground;
    const statePath = specimen.statePath;
    const before = ownerJson(factory, ["telemetry", "field", statePath, "--json"]);
    const policyPath = join(specimen.projectRoot, "ProjectCentral", "user", "factory-policy.json");
    mkdirSync(join(specimen.projectRoot, "ProjectCentral", "user"), {recursive:true});
    writeFileSync(policyPath, JSON.stringify({
      schema:"factory.sensing-policy/v1", version:1, project_world_ref:before.project_world_ref,
      repositories:[], sources:[{id:"specimen-native", provider:"factory", scope:before.project_world_ref,
        source_ref:`factory:developmental-state:${specimen.projectRef}`, arguments:{kind:"correlations"}}],
      workflows:{collect:{enabled:true, sources:["specimen-native"]}}, skill_prompts:{}, worktree:{},
    }, null, 2));
    const collected = ownerJson(factory, ["telemetry", "collect", statePath, "--policy", policyPath, "--json"]);
    const field = ownerJson(factory, ["telemetry", "field", statePath, "--json"]);
    if (!field.signals.length) throw new Error("native Factory collection produced no specimen signal");
    const signal = ownerJson(factory, ["telemetry", "signal", statePath, field.signals[0].signal_ref, "--json"]);
    const lookback = ownerJson(factory, ["telemetry", "lookback", statePath, "--json"]);
    // The disposable Central ground needs the owner's recognised civil-time
    // policy for a Day read; copy the actual root source, not a guessed zone.
    const civilPolicy = join(ground.root, "Control", "user", "civil-time-policy.json");
    mkdirSync(join(ground.root, "Control", "user"), {recursive:true});
    const ownerCentral = process.env.OI_WALK_REAL_CENTRAL ?? process.env.OI_CENTRAL_ROOT ?? "/Users/admin/Central";
    copyFileSync(join(ownerCentral, "Control", "user", "civil-time-policy.json"), civilPolicy);
    const day = todayInLondon();
    const dayRead = ownerJson(factory, ["telemetry", "day", statePath, "--day", day, "--json"]);
    const humanDigest = ownerJson(factory, ["telemetry", "digest", statePath, "--json"]);
    // Optional native held-decision replay: copy an owner-produced state into
    // this disposable Central, register its Project scope, and read it through
    // the same CLI. The normal walk remains self-contained.
    let held;
    if (process.env.OI_WALK_HELD_DECISION_CENTRAL) {
      const sourceProject = join(process.env.OI_WALK_HELD_DECISION_CENTRAL, "Work", "Factory");
      const targetProject = join(ground.root, "Work", "Factory");
      mkdirSync(targetProject, {recursive:true});
      ground.call("projectcentral.init", {project:"Factory", project_id:"factory-held-walk"});
      mkdirSync(join(targetProject, ".factory"), {recursive:true});
      mkdirSync(join(targetProject, "ProjectCentral", "user"), {recursive:true});
      for (const file of ["project.json", "development-state.json"]) copyFileSync(join(sourceProject, ".factory", file), join(targetProject, ".factory", file));
      copyFileSync(join(sourceProject, "ProjectCentral", "user", "factory-policy.json"), join(targetProject, "ProjectCentral", "user", "factory-policy.json"));
      const heldState = ownerJson(factory, ["project", "locate", targetProject, "--json"]).statePath;
      const heldDigest = ownerJson(factory, ["telemetry", "digest", heldState, "--json"]);
      if (heldDigest.signals.length !== 1 || !heldDigest.signals[0].decision_needed) throw new Error("The native held-decision source did not retain one human question");
      held = {statePath:heldState, digest:heldDigest, stateDigest:digest(heldState)};
    }
    return {...ground, statePath, collected, field, signal, lookback, day, dayRead, humanDigest, stateDigest:digest(statePath), held};
  } catch (error) { ground.cleanup(); throw error; }
}

export default async function run({page, baseUrl, bridgeUrl, check, shot, channel, log, provision:p}) {
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  const ops = recordOps(page);
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  await page.reload(); await channel("info");
  await page.getByRole("radiogroup", {name:"Workspace mode", exact:true}).getByRole("radio", {name:"Factory", exact:true}).click();
  await chooseProject(page, "Specimen");
  const panel = page.locator(".fsense-source[data-sensing-source='Specimen']");
  await panel.waitFor({timeout:60000});
  await panel.locator(`[data-signal-ref="${p.field.signals[0].signal_ref}"]`).waitFor({timeout:60000});

  const rows = await panel.locator("[data-signal-ref]").evaluateAll(nodes => nodes.map(node => ({ref:node.getAttribute("data-signal-ref"), words:node.textContent})));
  check(rows.length === p.field.signals.length && rows.every((row,index) => row.ref === p.field.signals[index].signal_ref && row.words.includes(p.field.signals[index].summary)),
    "Signals: every visible signal equals the native Factory field reading", {rows:rows.map(row => row.ref)});
  const coverage = await panel.locator("[data-coverage-state]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-coverage-state")));
  check(JSON.stringify(coverage) === JSON.stringify(p.field.coverage.map(row => row.state)), "Health: source coverage states equal the native collection", {coverage});
  const partial = p.field.coverage.find(row => row.state === "truncated" && row.reason);
  check(!!partial && p.field.signals.length > 0 && (await panel.locator('[data-coverage-state="truncated"]').innerText()).includes(partial.reason),
    "Partial source: the UI carries Factory's exact reason for incomplete interval coverage alongside retained signals");

  await panel.locator(`[data-signal-ref="${p.signal.signal.signal_ref}"]`).click();
  const inspection = panel.locator(`[data-signal-detail="${p.signal.signal.signal_ref}"]`);
  await inspection.getByText(p.signal.signal.observation.summary, {exact:true}).waitFor({timeout:60000});
  check((await inspection.innerText()).includes(p.signal.signal.observation.source_ref), "Signal drill: the original observation and source ref equal native telemetry signal");
  await inspection.getByRole("button", {name:"Read Factory source"}).click();
  await inspection.locator(`[data-native-source="${p.signal.signal.observation.source_ref}"]`).waitFor({timeout:60000});
  check((await inspection.locator("[data-native-source]").innerText()).includes(p.signal.signal.observation.source_ref),
    "Source drill: the exact telemetry ref resolves through Factory's native inspection");
  await shot("factory-sensing-signal");
  await inspection.getByRole("button", {name:"Open source Run"}).click();
  const sourceRun = page.locator(`[data-run-page="${p.specimen.runs.A.runRef}"]`);
  await sourceRun.waitFor({timeout:60000});
  const ancestry = sourceRun.locator("[data-signal-ancestry]");
  await ancestry.getByRole("button", {name:p.signal.summary.summary}).waitFor({timeout:60000});
  check(await ancestry.getByRole("button", {name:p.signal.summary.summary}).count() === 1,
    "Work drill: native telemetry inspection links its recorded Run back to the source signal");
  await ancestry.getByRole("button", {name:p.signal.summary.summary}).click();
  await inspection.waitFor({timeout:60000});
  check(await panel.locator(`[data-signal-detail="${p.signal.signal.signal_ref}"]`).count() === 1,
    "Run return: back-navigation reopens the exact source signal in the Desk");

  const digestPanel = panel.locator("[data-digest-readonly='true']");
  await page.waitForFunction(() => document.querySelector("[data-digest-readonly]") && !document.querySelector("[data-digest-readonly]").textContent.includes("Reading the human digest"), null, {timeout:60000});
  check(p.humanDigest.signals.length === 0 && await digestPanel.getByText(/no decision returned; source coverage is incomplete/i).count() === 1,
    "Decisions: unclassified source signals are not promoted into human decisions; incomplete coverage is explicit");
  check(await digestPanel.locator("button").count() === 0, "Digest: no mutation control appears without an owner decision");

  await panel.getByRole("button", {name:"Look back"}).click();
  await panel.locator('[data-history-schema="factory.telemetry-lookback/v1"]').waitFor({timeout:60000});
  check((await panel.locator(".fsense-history-row").count()) === p.lookback.patterns.length,
    "History: grouped boundaries equal the native lookback reading");
  await panel.locator("[data-history-schema='factory.telemetry-lookback/v1']").getByRole("button", {name:p.signal.signal.signal_ref}).click();
  await inspection.waitFor({timeout:60000});
  check(await panel.locator(`[data-signal-detail="${p.signal.signal.signal_ref}"]`).count() === 1,
    "History: a pattern signal ref drills back to the exact native observation");
  await panel.getByLabel("History Day for Specimen").fill(p.day);
  await panel.getByRole("button", {name:"Read Day"}).click();
  await panel.locator('[data-history-schema="factory.telemetry-day/v1"]').waitFor({timeout:60000});
  check((await panel.locator(".fsense-history-row").count()) === p.dayRead.patterns.length,
    "Day: grouped boundaries equal the native civil-Day reading");
  const historyReadsBefore = ops.filter(op => op.kind === "telemetry-lookback" || op.kind === "telemetry-day").length;
  await panel.getByRole("button", {name:"Look back"}).click();
  await panel.getByRole("button", {name:"Read Day"}).click();
  for (let elapsed = 0; elapsed < 60000 && ops.filter(op => op.kind === "telemetry-lookback" || op.kind === "telemetry-day").length < historyReadsBefore + 2; elapsed += 100) await page.waitForTimeout(100);
  check(ops.filter(op => op.kind === "telemetry-lookback" || op.kind === "telemetry-day").length >= historyReadsBefore + 2
    && await panel.locator('[data-history-schema="factory.telemetry-day/v1"]').count() === 1,
    "History: after two real overlapping owner reads, the latest requested Day remains selected");
  const signalReadsBeforeRefresh = ops.filter(op => op.kind === "telemetry-signal" && op.result === "factory_development_reading").length;
  await panel.getByRole("button", {name:"Refresh sensing for Specimen"}).click();
  await page.waitForFunction(() => document.querySelector(".fsense-source[data-sensing-source='Specimen'] .fsense-source-head small")?.textContent?.includes("hot projection unavailable"), null, {timeout:60000});
  check((await panel.locator(".fsense-source-head small").innerText()).includes("Factory native"),
    "Current refresh: an unavailable hot projection falls back to the owner-native field with explicit basis");
  for (let elapsed = 0; elapsed < 60000 && ops.filter(op => op.kind === "telemetry-signal" && op.result === "factory_development_reading").length <= signalReadsBeforeRefresh; elapsed += 100) await page.waitForTimeout(100);
  check(ops.filter(op => op.kind === "telemetry-signal" && op.result === "factory_development_reading").length > signalReadsBeforeRefresh,
    "Selected signal: refreshing the owner field rereads its detail, even when the signal ref is unchanged");
  await shot("factory-sensing-day");

  const readKinds = new Set(ops.filter(op => op.op === "factory_owner" && op.result === "factory_development_reading").map(op => op.kind));
  check(["telemetry-field","telemetry-current","telemetry-signal","telemetry-inspect","telemetry-digest","telemetry-lookback","telemetry-day"].every(kind => readKinds.has(kind)),
    "Kernel: source, current and temporal sensing reads reached their owners through the real bridge", {readKinds:[...readKinds]});
  check(!ops.some(op => op.op === "factory_owner" && /collect|classify|commission|return/.test(op.kind ?? "")),
    "UI: no sensing mutation was dispatched");
  const mismatched = await fetch(`${bridgeUrl}/op`, {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({
    op:"factory_owner", request:{kind:"telemetry-current", state_path:p.statePath, project_world_ref:"project:another-world"},
  })}).then(response => response.json());
  check(mismatched.ok === false && String(mismatched.error).includes("Factory state belongs to another ProjectWorld"),
    "Kernel: a hot request for another ProjectWorld is refused against the owner state source");
  check(digest(p.statePath) === p.stateDigest, "UI: the owner state is byte-identical after all sensing reads");
  if (p.held) {
    await chooseProject(page, "Factory");
    const heldPanel = page.locator(".fsense-source[data-sensing-source='Factory']");
    await heldPanel.waitFor({timeout:60000});
    const decision = p.held.digest.signals[0];
    await heldPanel.getByText(decision.decision_needed, {exact:true}).waitFor({timeout:60000});
    check(await heldPanel.getByText(decision.decision_needed, {exact:true}).count() === 1,
      "Held decision: the exact owner-native human question appears once in the Decisions queue");
    await heldPanel.locator(`[data-decision-signal="${decision.signal_ref}"]`).click();
    await heldPanel.locator(`[data-signal-detail="${decision.signal_ref}"]`).waitFor({timeout:60000});
    check(await heldPanel.locator(`[data-signal-detail="${decision.signal_ref}"]`).count() === 1,
      "Held decision: its source-qualified signal remains drillable without a mutation control");
    await shot("factory-sensing-held-decision");
    check(digest(p.held.statePath) === p.held.stateDigest, "Held decision: the owner state remains byte-identical after UI reads");
  }
}
