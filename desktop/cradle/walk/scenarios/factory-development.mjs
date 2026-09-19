// factory-development (queue cell 3 + cell B): the standing walk now drives
// the DESK — Factory's centre since the 2026-09-18 spatial model (handoff
// §10/§11): DeskBoard (the live whole-Run board) → the Factory view toggle →
// Tasks (the full-canvas chat) → back to the Desk with its scope intact.
// The pre-Desk development console the old scenario drove survives only as a
// dev-only debug disclosure (`import.meta.env.DEV`), so the walk bundle — a
// production bundle — no longer mounts it; every leg below exercises a
// production surface.
//
// What the bridge provides, the walk drives for real:
//   - the board reads only what the person names. No source: the honest
//     empty state, nothing read. A source whose state path does not exist:
//     the OWNER'S refusal renders verbatim in the coverage line.
//   - a source seeded through the owner's own generator (`factory
//     conformance developmental-state`): the owner's project reading runs
//     through the kernel for real and its journey registry's runRefs become
//     the board's rows — each carrying the owner's per-Run build-view
//     refusal verbatim (this specimen serves `factory development …` but not
//     `factory build snapshot`; the owner's answer is rendered, never
//     padded into a healthy card), so partial coverage renders beside honest
//     empty groups — never an empty healthy board, never a fabricated card.
//   - a real conversation (AIKit SessionSpace, attached in setup) binds
//     through the Tasks chat's own chooser, and the exact-identity Run
//     binding law holds negatively: the conversation's session carried none
//     of the board's Runs, so the centre says "Direct conversation — no Run
//     carries this work" instead of guessing a label match.
//   - back to the Desk: the board's remembered search and project scope
//     survive the Tasks round-trip — the toggle changes the working view,
//     never the work.
//
// What the bridge cannot provide on this cut — the labelled fixture legs
// (board cards, the Run detail's four depths, produced material, the
// positive carried-conversation join) — the walk bundle cannot mount: the
// labelled dev scenarios live behind `import.meta.env.DEV` and a production
// build eliminates that door. Those legs are proven by `walk/desk-probe.mjs`
// against the dev bundle (fixture board) with the walk bridge and a real
// conversation whose ref the fixture Run's trajectory genuinely names. The
// workflow-units / execution-telemetry / Workcell-status reads of the old
// console have no Desk surface on this cut; the development read path they
// stood for is carried by the board's own project and build-view reads here.
import {execFileSync, spawnSync} from "node:child_process";
import {join} from "node:path";
import {mkdirSync} from "node:fs";
import {setup as sourceSetup} from "./editor.mjs";

/** Run one owner CLI command to completion, capturing stdout or the owner's
 * own stderr words — expected refusals are data here, not failures. */
function ownerCall(bin, args, env) {
  const done = spawnSync(bin, args, {encoding: "utf8", env: env ?? process.env});
  return {ok: done.status === 0, stdout: done.stdout, stderr: done.stderr};
}

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

  // The owner's own project reading names the journey registry's runs — the
  // refs the board's real read must render, taken from the owner's payload.
  const projectReading = ownerCall(factory, ["development", "project", statePath, projectRef, "--json"]);
  if (!projectReading.ok) throw new Error(`the owner's project reading refused: ${projectReading.stderr.slice(0, 300)}`);
  const journeys = JSON.parse(projectReading.stdout).journeys ?? [];
  const runRefs = [...new Set(journeys.flatMap(journey => Array.isArray(journey.runRefs) ? journey.runRefs : []))];
  if (!runRefs.length) throw new Error("the owner's project reading disclosed no runs");

  // Capture the owner's own refusal words for the two honest refusals the
  // board renders: a nonexistent state path, and this specimen's build view
  // (the developmental specimen does not serve `factory build snapshot`).
  // The kernel serialises the owner's stderr into its error payload, so the
  // fragment stays inside one JSON string: no quotes, nothing past the
  // specimen's line number.
  const refusalFragment = text => {
    const message = String(text).replace(/^factory:\s*/m, "").trim().split(/\s+at line/)[0].replace(/\n/g, " ").trim();
    const quoted = message.match(/"([^"]{4,})"/);
    return quoted ? quoted[1] : message;
  };
  const missingState = join(source.root, "factory", "missing-state.json");
  const missing = ownerCall(factory, ["development", "project", missingState, projectRef, "--json"]);
  if (missing.ok) throw new Error("the owner accepted a nonexistent state path — the refusal fixture is invalid");
  const build = ownerCall(factory, ["build", "snapshot", statePath, projectRef, runRefs[0], "--json"]);
  if (build.ok) throw new Error("the owner served a build view for the developmental specimen — the refusal fixture is stale");

  // A real conversation in the Editor project (the Tasks leg): the same
  // owner-side provisioning the addressed-dispatch walks use — aikit project
  // bind + SessionSpace create + attach, no provider started.
  const aikit = process.env.OI_AIKIT_BIN ?? "aikit";
  const sessionSpace = process.env.OI_AIKIT_SESSION_SPACE_BIN ?? "aikit-session-space";
  const env = {...process.env, ...source.env, AIKIT_HOME: join(source.root, ".aikit-home")};
  const bind = JSON.parse(execFileSync(aikit, ["--json", "-C", source.projectRoot, "project", "bind", "editor-walk", "--directory", source.projectRoot, "--no-default-skill-sets"], {encoding: "utf8", env}));
  if (!bind.ok) throw new Error(JSON.stringify(bind));
  const native = (...parts) => JSON.parse(execFileSync(sessionSpace, ["-C", source.projectRoot, ...parts], {encoding: "utf8", env}));
  const apply = preview => native("apply", "--preview-json", JSON.stringify(preview));
  const space = "session-space/factory-desk-walk";
  const conversationRef = "agent-session/factory-desk-walk";
  apply(native("create", space, "--label", "Factory desk walk"));
  for (const intent of [
    {operation: "bind-project-context", binding: native("project-context")},
    {operation: "attach-agent-session", attachment: {agent_session: conversationRef, purpose: "Factory desk walk conversation", provenance: ["Explicit real factory-development walk"]}},
  ]) apply(native("stage", "--space", space, "--intent-json", JSON.stringify(intent)));

  return {
    ...source,
    // The bridge kernels the suite route exactly as the installed desktop
    // does (`oi factory …` through OI_BIN): setting OI_FACTORY_BIN here
    // would exercise the kernel's direct-binary build-snapshot arm, which
    // still prefixes the product namespace a second time (`factory factory
    // build snapshot …`) — a kernel-side seam named in the walk's return,
    // not papered over here.
    env: {...source.env, AIKIT_HOME: env.AIKIT_HOME, OI_AIKIT_BIN: aikit, OI_AIKIT_SESSION_SPACE_BIN: sessionSpace},
    statePath, projectRef, runRefs, missingState,
    refusals: {missing: refusalFragment(missing.stderr), build: refusalFragment(build.stderr)},
    conversationRef,
    cleanup: source.cleanup,
  };
}

/** Wait until the locator resolves to at least `count` elements — the
 * board's per-Run reads land as they arrive, so honest rows stream in. The
 * bridge fronts every op with a real owner process spawn behind the one
 * serialised kernel queue (the session observer's poll included), so honest
 * latency here is tens of seconds, not fractions. */
async function waitForCount(locator, count, timeout = 90000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await locator.count() >= count) return;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${count} rows (${await locator.count()} present)`);
    await locator.first().waitFor({timeout: Math.max(1000, deadline - Date.now())}).catch(() => {});
  }
}

export default async function run({page, baseUrl, check, shot, channel, log, provision: p}) {
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  await page.goto(baseUrl);await channel("info");
  const nav = page.getByRole("complementary", {name: "World navigator"});
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await page.getByRole("button", {name: "Open project wiki", exact: true}).waitFor({timeout: 20000});

  // Open the Desk through its real entry: Factory is a mode, entered from
  // the navigator's mode strip, and the Desk board is its centre.
  await page.getByRole("radiogroup", {name: "Workspace mode", exact: true}).getByRole("radio", {name: "Factory", exact: true}).click();
  const centre = page.locator("main.factory-centre");
  await centre.waitFor();
  const board = centre.locator(".desk-board");
  await board.waitFor();
  // Ground the mode in the Editor project through its own picker — the
  // centre chat and the board's receiving strip read through it.
  const picker = page.locator('nav.factory-navigator select[aria-label="Project"]');
  await picker.waitFor({timeout: 20000});
  await picker.selectOption("Editor");
  await page.locator('.factory-space[data-bound="true"]').waitFor({timeout: 20000});
  check(await centre.getAttribute("data-centre-view") === "desk", "Factory's centre is the Desk board, not the old development console");

  // At rest nothing reads: no source is named, so no owner payload exists —
  // the board says so itself and invents neither a source nor a row.
  check(await board.locator(".desk-board-empty").count() === 1, "With no source named the board renders its honest empty state");
  check(await board.locator(".desk-card").count() === 0, "At rest the board renders no Run card");
  check(await board.locator(".desk-board-refused").count() === 0, "At rest nothing claims a refused read");
  check(await board.locator(".desk-board-fixture-note").count() === 0, "No labelled fixture stands behind this board in the walk bundle");

  // A source whose state path does not exist: the OWNER'S refusal renders
  // verbatim in the coverage line — the walk captured the owner's own words
  // in setup; the board may not soften or replace them.
  const addSource = async (statePath, scope) => {
    const form = board.locator("details.desk-addsource");
    await form.locator("summary").click();
    await form.getByLabel("Developmental state path").fill(statePath);
    await form.getByLabel("Factory Project ref").fill(p.projectRef);
    if (scope !== undefined) await form.getByLabel("Central Project scope (optional)").fill(scope);
    await form.getByRole("button", {name: "Add source", exact: true}).click();
    await page.waitForFunction(node => node instanceof HTMLDetailsElement && !node.open, await form.elementHandle(), {timeout: 10000});
  };
  await addSource(p.missingState);
  const refusedSource = board.locator('.desk-source-states p[data-source-state="refused"]');
  await refusedSource.waitFor({timeout: 30000});
  const refusedSourceText = await refusedSource.first().innerText();
  check(refusedSourceText.includes(p.projectRef) && refusedSourceText.includes(p.refusals.missing),
    `A source that cannot be read renders the owner's refusal verbatim (${refusedSourceText.slice(0, 90)}…)`,
    {ownerRefusal: p.refusals.missing});

  // The real seeded state, added through the same form: the owner's project
  // reading runs for real through the kernel, and its journey registry's
  // runRefs become the board's rows. On this specimen the per-Run build view
  // refuses — the owner's own words — so every row lands in the honest
  // "Could not be read" band: partial coverage, never an empty healthy
  // board, never a fabricated card.
  await addSource(p.statePath, "Factory-walk");
  const refusedRunCodes = board.locator(".desk-board-refused code");
  await waitForCount(refusedRunCodes, p.runRefs.length);
  const bandText = await board.locator(".desk-board-refused").innerText();
  const renderedRefs = await board.locator(".desk-board-refused code").allInnerTexts();
  check(p.runRefs.every(ref => renderedRefs.includes(ref)), "The owner's project reading enumerates its journey's Runs as the board's rows", p.runRefs);
  check(bandText.includes(p.refusals.build), "The per-Run build-view refusal renders the owner's own words verbatim", {ownerRefusal: p.refusals.build});
  check(await board.locator(".desk-card").count() === 0, "No Run card is fabricated from a refused build view");
  const groups = board.locator(".desk-group");
  check(await groups.count() === 4 && await groups.locator(".desk-group-empty").count() === 4,
    "All four display groups render their honest emptiness beside the refused band — never an empty healthy board");
  await shot("desk-real-source-coverage");

  // The board's own scope: a search fragment and the added source's project
  // scope label — remembered display preferences the Tasks round-trip must
  // not disturb.
  await board.locator('input[aria-label="Search Runs"]').fill(p.runRefs[0].slice(4, 16));
  const scope = board.locator('select[aria-label="Project scope"]');
  await scope.selectOption("Factory-walk");

  // Reads are explicit: Refresh re-runs the same honest reads and the same
  // refusals — there is no poll and no invented watch on this cut.
  await board.getByRole("button", {name: "Refresh", exact: true}).click();
  await board.locator(".desk-board-refused p[role=alert]").first().waitFor({timeout: 30000});
  check((await board.locator(".desk-board-refused code").allInnerTexts()).every(ref => p.runRefs.includes(ref)),
    "An explicit Refresh reproduces the owner's rows and refusals — no poll, no invented watch");

  // Tasks: the centre's other presentation — the full-canvas chat over the
  // shared conversation primitives. With nothing bound it is the genuine
  // new-conversation state, not a shrunk board.
  const views = page.getByRole("radiogroup", {name: "Factory view", exact: true});
  await views.getByRole("radio", {name: "Tasks", exact: true}).click();
  await page.locator('main.factory-centre[data-centre-view="tasks"]').waitFor();
  const context = page.locator(".factory-chat-context");
  await context.waitFor();
  check((await context.innerText()).includes("New conversation"), "Tasks opens on its genuine new-conversation state");
  check(await page.locator(".factory-chat-host").count() === 1, "The full-canvas chat hosts the shared conversation surface");

  // A real conversation binds through the chat's own chooser (the frame's
  // one start/read path). The exact-identity Run binding holds negatively:
  // this conversation's session carried none of the board's Runs, so the
  // centre marks it Direct rather than guessing a Run.
  await page.locator(".factory-chat-full").getByRole("button", {name: "History", exact: true}).click();
  const chat = page.locator(".factory-chat-full");
  const conversation = chat.locator(".chat-history-menu .encounter-row", {hasText: "Factory desk walk conversation"});
  // The bind is the frame's ordinary start/read pair over the one serialised
  // kernel queue — behind the board's reads and the session observer's poll
  // it can take a while, and a chooser row that re-renders under the pointer
  // can swallow a click. Poll for the landed binding and re-choose honestly
  // rather than racing one click.
  const directTexts = async () => (await context.locator(".factory-chat-context-direct").allInnerTexts().catch(() => []));
  let directText = "";
  for (let attempt = 0; attempt < 3 && !directText; attempt++) {
    if (attempt > 0) {
      if (await chat.locator(".chat-history-menu").count() === 0) await chat.getByRole("button", {name: "History", exact: true}).click();
      await conversation.waitFor({timeout: 10000});
      await conversation.click();
    } else {
      await conversation.waitFor({timeout: 30000});
      await conversation.click();
    }
    const deadline = Date.now() + 45000;
    for (;;) {
      const texts = await directTexts();
      if (texts.some(text => text.includes("no Run carries this work"))) { directText = texts.join(" "); break; }
      if (Date.now() > deadline) break;
      await page.waitForTimeout(500);
    }
  }
  check(directText.includes("Direct conversation") && directText.includes("no Run carries this work"),
    "The real conversation binds and the centre discloses the exact-identity negative: no Run carries this work");
  check(await context.getByRole("button", {name: /^Run · /}).count() === 0, "No Run link is invented for a conversation no Run carried");
  await shot("desk-tasks-direct-conversation");

  // Back to the Desk: the working view changes, the work does not — the
  // board's remembered search and project scope survived the round-trip,
  // and the owner's rows and refusals read exactly as before.
  await views.getByRole("radio", {name: "Desk", exact: true}).click();
  await page.locator('main.factory-centre[data-centre-view="desk"]').waitFor();
  await board.locator(".desk-board-refused p[role=alert]").first().waitFor({timeout: 90000});
  check(await board.locator('input[aria-label="Search Runs"]').inputValue() === p.runRefs[0].slice(4, 16),
    "Back on the Desk, the remembered search survived the Tasks round-trip");
  check(await scope.inputValue() === "Factory-walk", "Back on the Desk, the remembered project scope survived the Tasks round-trip");
  check((await board.locator(".desk-board-refused code").allInnerTexts()).every(ref => p.runRefs.includes(ref)),
    "Back on the Desk, the owner's rows and refusals are exactly what they were — the toggle changed no work");
  await shot("desk-back-preserves-scope");
}
