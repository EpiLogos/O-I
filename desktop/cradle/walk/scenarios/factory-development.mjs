// factory-development (queue cell 3 + cell B): the standing walk now drives
// the DESK — Factory's centre since the 2026-09-18 spatial model (handoff
// §10/§11): DeskBoard (the live whole-Run board) → the Factory view toggle →
// Tasks (the full-canvas chat) → back to the Desk with its scope intact —
// and the RUN / AGENTS / CONTEXT surfaces restated over the real kernel legs
// (dossier docs/experience/HARNESS-SETTINGS-RESEARCH-2026-09-22.md §4, fix
// first 1; FACTORY-AGENCY.md §4/§5/§12; DESKTOP-LANGUAGE.md ruling 8). The
// fixture-world probes that used to stand in for these surfaces
// (walk/factory-sidebar-probe.mjs, walk/desk-probe.mjs,
// walk/desk-live-material-probe.mjs) are dev-only diagnostics with no
// acceptance standing; this scenario is where their acceptance moved.
//
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
//     the board's rows. The owner now SERVES build views for this specimen,
//     so each row renders as a whole-Run card carrying the owner's own
//     label, status and live world — asserted by content equality against
//     the owner's CLI answers captured in setup, never by presence.
//   - the Run detail's four depths read the owner for real over that build
//     view and run reading; the sidebar's Run plane reads the same real
//     selection, and Inspect receives the exact execution row — its raw
//     record behind a collapsed disclosure (spec 06 §7 L5).
//   - the Agents plane situates its SessionSpace roster read by the Factory
//     navigator's grounded project (this lane's wiring fix): the kernel's own
//     conversation renders as a real roster row, and no skill-proposal flow
//     is offered without native authority (the named gap, not a masquerade).
//   - a real conversation (AIKit SessionSpace, attached in setup) binds
//     through the Tasks chat's own chooser, and the exact-identity Run
//     binding law holds negatively: the conversation's session carried none
//     of the board's Runs, so the centre says "Direct conversation — no Run
//     carries this work" instead of guessing a label match.
//   - back to the Desk: the board's remembered search and project scope
//     survive the Tasks round-trip — the toggle changes the working view,
//     never the work.
import {execFileSync, spawnSync} from "node:child_process";
import {join} from "node:path";
import {mkdirSync} from "node:fs";
import {assertNoRawJson} from "../lib/read-model.mjs";
import {bindDefaultCentral} from "../editor-doc.mjs";
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

  // The owner's own build views for each named Run — the labels, statuses
  // and live-world rows the board cards, Run detail and sidebar Run plane
  // must render VERBATIM. Captured here from the owner's CLI: the expected
  // content of every content-equality check below is the owner's answer,
  // never a desktop-derived or UI-derived string.
  const runs = runRefs.map(runRef => {
    const build = ownerCall(factory, ["build", "snapshot", statePath, projectRef, runRef, "--json"]);
    if (!build.ok) throw new Error(`the owner refused a build view for ${runRef}: ${build.stderr.slice(0, 200)}`);
    const view = JSON.parse(build.stdout).view;
    if (view?.run?.runRef !== runRef) throw new Error(`the owner's build view answered a different Run for ${runRef}`);
    return {
      runRef,
      label: view.run.label,
      status: view.run.status,
      frontierTitle: view.frontier.title,
      agencies: (view.agencies ?? []).map(agency => ({ref: agency.agencyRef, label: agency.label})),
      executions: (view.executions ?? []).map(execution => ({
        ref: execution.executionRef, status: execution.status,
        harnessRef: execution.harnessRef ?? null, agencyRef: execution.agencyRef ?? null,
      })),
      claims: (view.claims ?? []).length,
      candidates: (view.candidates ?? []).length,
      humanRequests: (view.humanRequests ?? []).length,
    };
  });

  // The owner's run reading for the first Run — the Map depth's payload. The
  // map must render exactly the node/edge counts the owner's own reading
  // carries, and the Run's label must appear among the node labels.
  const runReadingRaw = ownerCall(factory, ["development", "run", statePath, runRefs[0], "--json"]);
  if (!runReadingRaw.ok) throw new Error(`the owner refused the run reading: ${runReadingRaw.stderr.slice(0, 200)}`);
  const runReading = JSON.parse(runReadingRaw.stdout);
  if (runReading.runRef !== runRefs[0]) throw new Error("the owner's run reading answered a different Run");
  const mapNodeCount = Object.keys(runReading.runMap?.nodes ?? {}).length;
  const mapEdgeCount = (runReading.runMap?.edges ?? []).length;

  // Capture the owner's own refusal words for the one honest refusal the
  // board still renders: a source whose state path does not exist. The
  // kernel serialises the owner's stderr into its error payload, so the
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
  const conversationTitle = "Factory desk walk conversation";
  apply(native("create", space, "--label", "Factory desk walk"));
  for (const intent of [
    {operation: "bind-project-context", binding: native("project-context")},
    {operation: "attach-agent-session", attachment: {agent_session: conversationRef, purpose: conversationTitle, provenance: ["Explicit real factory-development walk"]}},
  ]) apply(native("stage", "--space", space, "--intent-json", JSON.stringify(intent)));

  return {
    ...source,
    // The bridge kernels the suite route exactly as the installed desktop
    // does (`oi factory …` through OI_BIN): setting OI_FACTORY_BIN here
    // would exercise the kernel's direct-binary arm, which still prefixes
    // the product namespace a second time — a kernel-side seam named in the
    // walk's return, not papered over here.
    env: {...source.env, AIKIT_HOME: env.AIKIT_HOME, OI_AIKIT_BIN: aikit, OI_AIKIT_SESSION_SPACE_BIN: sessionSpace},
    statePath, projectRef, runRefs, runs, mapNodeCount, mapEdgeCount, missingState,
    refusals: {missing: refusalFragment(missing.stderr)},
    conversationRef, conversationTitle,
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
  const ownerLabels = p.runs.map(run => run.label);
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  await page.goto(baseUrl);await channel("info");
  // The boot law is explicit binding: an env-declared root is never
  // auto-recognised, so the walk's own ground is bound through the real UI
  // (the same pair the editor walk uses); the saved default composes the
  // workspace on the next launch, so the walk reloads before driving the
  // navigator.
  await bindDefaultCentral(page, p.root);
  await page.reload();await channel("info");
  const nav = page.getByRole("complementary", {name: "World navigator"});
  await nav.locator('[data-project-path="Work/Editor"]').click();
  // The composed workspace's rest page carries the project's wiki entry —
  // the marker that the Editor project is grounded (renamed from "Open
  // project wiki" by the landed W1 shell recovery, #427).
  await page.getByRole("button", {name: "Open wiki", exact: true}).waitFor({timeout: 20000});

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
  // runRefs become the board's rows — whole-Run cards now, because the owner
  // serves build views for this specimen. Every card is asserted against the
  // owner's own CLI answers captured in setup: titles, statuses and
  // placement by CONTENT EQUALITY, never by presence (dossier §4, negative
  // roster item 2).
  await addSource(p.statePath, "Factory-walk");
  const cards = board.locator(".desk-card");
  await waitForCount(cards, p.runRefs.length);
  const renderedTitles = (await board.locator(".desk-card-title").allInnerTexts()).map(title => title.trim()).sort();
  check(renderedTitles.join("|") === [...ownerLabels].sort().join("|"),
    "The board's card titles EQUAL the owner's declared run labels, run for run — no card invented, none missing",
    {ownerLabels, renderedTitles});
  check(await board.locator(".desk-board-refused").count() === 0,
    "Every Run the owner's reading named was served — no refused band, no fabricated row");
  const cardStates = await board.locator(".desk-card-state").allInnerTexts();
  check(cardStates.every(text => p.runs.some(run => text.includes(run.status))),
    "Each card carries the owner's own status word from its build view", {renderedStates: cardStates});
  const queuedCards = board.locator('section.desk-group[aria-label^="Queued"] .desk-card');
  check(await queuedCards.count() === p.runRefs.length
    && await board.locator('section.desk-group:not([aria-label^="Queued"]) .desk-card').count() === 0
    && await board.locator('section.desk-group[data-empty="true"]').count() === 3,
    "Placement follows the owner's own status — every served Run sits in Queued, the other groups render their honest emptiness");
  await assertNoRawJson({check}, board,
    "L5 · the Desk board's primary view renders readable rows — no raw record outside a collapsed disclosure (spec 06 §7 L5)");
  await shot("desk-real-source-coverage");

  // The board's real Needs-you read (receiving): its count line must equal
  // the rows it renders — this project has nothing pending, so the strip
  // says so instead of inventing an item.
  const receiving = board.locator("section.desk-receiving");
  await receiving.getByText("Nothing is waiting on you.").waitFor({timeout: 30000});
  check((await receiving.locator("h2").innerText()).toLowerCase().includes("0 waiting"),
    "The receiving strip's count line equals its rendered rows (kernel read: 0 waiting)");
  check(await receiving.locator(".desk-receiving-row").count() === 0,
    "With nothing pending, receiving renders no row and invents no item");

  // The board's own scope: a search fragment and the added source's project
  // scope label — remembered display preferences the Tasks round-trip must
  // not disturb.
  await board.locator('input[aria-label="Search Runs"]').fill(p.runRefs[0].slice(4, 16));
  const scope = board.locator('select[aria-label="Project scope"]');
  await scope.selectOption("Factory-walk");

  // Reads are explicit: Refresh re-runs the same honest reads — there is no
  // poll and no invented watch on this cut.
  await board.getByRole("button", {name: "Refresh", exact: true}).click();
  await waitForCount(cards, 1);
  check((await board.locator(".desk-card-title").allInnerTexts()).every(title => ownerLabels.includes(title.trim())),
    "An explicit Refresh reproduces the owner's Runs as cards — no poll, no invented watch");

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
  check((await context.locator(".factory-chat-context-project").innerText()).trim() === "Editor",
    "The Tasks context strip names the project actually grounded (content equality, not a placeholder)");

  // A real conversation binds through the chat's own chooser (the frame's
  // one start/read path). The exact-identity Run binding holds negatively:
  // this conversation's session carried none of the board's Runs, so the
  // centre marks it Direct rather than guessing a Run.
  await page.locator(".factory-chat-full").getByRole("button", {name: "History", exact: true}).click();
  const chat = page.locator(".factory-chat-full");
  const conversation = chat.locator(".chat-history-menu .encounter-row", {hasText: p.conversationTitle});
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
  // and the owner's Runs read exactly as before.
  await views.getByRole("radio", {name: "Desk", exact: true}).click();
  await page.locator('main.factory-centre[data-centre-view="desk"]').waitFor();
  await waitForCount(cards, 1);
  check(await board.locator('input[aria-label="Search Runs"]').inputValue() === p.runRefs[0].slice(4, 16),
    "Back on the Desk, the remembered search survived the Tasks round-trip");
  check(await scope.inputValue() === "Factory-walk", "Back on the Desk, the remembered project scope survived the Tasks round-trip");
  check((await board.locator(".desk-card-title").allInnerTexts()).every(title => ownerLabels.includes(title.trim())),
    "Back on the Desk, the owner's Runs are exactly what they were — the toggle changed no work");
  await shot("desk-back-preserves-scope");

  // ---------------------------------------------------------------------
  // The Run detail over the real build view (FACTORY-AGENCY §8): open the
  // first card — the detail reads the owner for real and its header, depths
  // and rows are asserted against the owner's own answers, not presence.
  // ---------------------------------------------------------------------
  const first = p.runs[0];
  await board.locator(".desk-card", {hasText: first.label}).locator(".desk-card-open").click();
  const detail = page.locator(".desk-detail");
  await detail.waitFor();
  const detailTitle = page.locator(".desk-detail-title h1");
  await detailTitle.waitFor({timeout: 30000});
  check(await detailTitle.textContent() === first.label,
    "The opened Run detail's header EQUALS the owner's declared run label (content equality)", {ownerLabel: first.label});
  const liveBasis = await detail.locator(".desk-detail-live-basis").innerText();
  check(/live · owner build revision/.test(liveBasis),
    "The live-follow strip discloses its real content basis: the owner's build revision", {basis: liveBasis.trim()});
  const depthLabels = (await page.locator(".desk-run-depths button").allTextContents()).map(text => text.trim());
  check(depthLabels.join("|") === "Trajectory|Reading|Live|Map", "The four depths of the Run view render");

  // Reading depth: the SSSF semantic reading, content-equal to the owner's
  // build view, with its honest zero counts rendered as words.
  await page.locator(".desk-run-depths button", {hasText: "Reading"}).click();
  await page.locator(".desk-run-frontier").waitFor({timeout: 30000});
  check((await page.locator(".desk-run-frontier h2").innerText()) === first.frontierTitle,
    "The Reading depth's frontier EQUALS the owner's declared frontier title", {ownerFrontier: first.frontierTitle});
  const readingText = await page.locator(".desk-run-depth.desk-run-reading").innerText();
  check(readingText.includes(`${first.candidates} possible realities`) && readingText.includes("No candidate is open for this Run.")
    && readingText.includes("No claim is recorded for this Run.") && readingText.includes("No durable human authorship request is open."),
    "The Reading depth renders the owner's zero counts honestly — no candidate, claim or request is invented",
    {ownerCounts: {candidates: first.candidates, claims: first.claims, humanRequests: first.humanRequests}});

  // Live depth: the live working world, row for row the owner's own reading.
  await page.locator(".desk-run-depths button", {hasText: "Live"}).click();
  await page.locator(".desk-run-live-grid article").first().waitFor({timeout: 30000});
  const expectedLive = first.agencies.length + first.executions.length;
  check(await page.locator(".desk-run-live-grid article").count() === expectedLive,
    "The Live depth renders exactly the agencies and executions the owner's build view carries", {expectedLive});
  if (first.agencies.length) {
    check((await page.locator(".desk-run-live-grid article h4").first().innerText()) === first.agencies[0].label,
      "The agency card names the owner's agency label verbatim", {ownerAgency: first.agencies[0].label});
  }
  if (first.executions.length) {
    const executionCard = page.locator(".desk-run-live-grid article", {hasText: first.executions[0].ref});
    check(await executionCard.count() === 1 && (await executionCard.innerText()).includes(first.executions[0].status),
      "The execution card carries the owner's execution identity and status verbatim",
      {executionRef: first.executions[0].ref, status: first.executions[0].status});
  }

  // Map depth: the owner's run reading, rendered at the counts the owner's
  // own payload carries, with the Run's label among the node labels.
  await page.locator(".desk-run-depths button", {hasText: "Map"}).click();
  const mapHead = page.locator(".factory-run-map-head p");
  await mapHead.waitFor({timeout: 60000});
  check((await mapHead.innerText()).trim() === `${p.mapNodeCount} ${p.mapNodeCount === 1 ? "node" : "nodes"} · ${p.mapEdgeCount} ${p.mapEdgeCount === 1 ? "relation" : "relations"}`,
    "The Run map renders exactly the owner's node and relation counts", {ownerCounts: {nodes: p.mapNodeCount, edges: p.mapEdgeCount}});
  const mapNodeLabels = await page.locator(".factory-run-map-nodes button span").allInnerTexts();
  check(mapNodeLabels.includes(first.label),
    "The Run map's node labels carry the owner's Run label", {ownerLabel: first.label, renderedNodeCount: mapNodeLabels.length});
  await shot("desk-detail-real-depths");
  await assertNoRawJson({check}, detail,
    "L5 · the Run detail renders readable rows — any raw record sits behind a collapsed disclosure (spec 06 §7 L5)");

  // ---------------------------------------------------------------------
  // The sidebar's RUN plane over the real selection (FACTORY-AGENCY §4,
  // Activity/Inspect): with the Desk's detail open, the panel's Run subject
  // is the Run the Desk actually read. The fixture probe accepted a
  // presence-only run header here; the acceptance is content equality.
  // ---------------------------------------------------------------------
  const panel = page.locator("section.agent-layer");
  await panel.locator(".agent-planes").getByRole("button", {name: "Run", exact: true}).click();
  const runPlane = page.locator('[data-extra-plane="run"] [data-plane="Run"]');
  await runPlane.waitFor();
  check(await runPlane.getAttribute("data-fixture") === null,
    "The Run plane carries no fixture standing — the walk bundle mounts no dev scenario");
  const runHead = runPlane.locator(".oi-side-run-head strong");
  await runHead.waitFor({timeout: 10000});
  check((await runHead.innerText()) === first.label,
    "The Run plane's run header EQUALS the owner's declared run label (was presence-only on the fixture)", {ownerLabel: first.label});
  check((await runPlane.locator(".oi-side-run-state").innerText()).includes(first.status),
    "The Run plane's state line carries the owner's own status word", {ownerStatus: first.status});
  // Steps: the real executions of the Run, row for row the owner's reading.
  const stepRows = runPlane.locator(".oi-side-steps > li");
  check(await stepRows.count() === first.executions.length,
    "The Run plane's step rows are exactly the executions the owner's build view carries", {ownerExecutions: first.executions.length});
  if (first.executions.length) {
    const stepRow = stepRows.first();
    check((await stepRow.locator(".oi-side-step-label").innerText()) === first.executions[0].agencyRef,
      "The step row names the owner's agency ref verbatim", {ownerAgencyRef: first.executions[0].agencyRef});
    check((await stepRow.locator(".oi-side-step-meta").innerText()).includes(first.executions[0].status),
      "The step row carries the owner's execution status verbatim", {ownerStatus: first.executions[0].status});
  }
  // No invented attention: this Run carries no human request and no claim,
  // so no Decisions or Checks group may render.
  check(await runPlane.locator('section[aria-label="Decisions"]').count() === 0
    && await runPlane.locator('section[aria-label="Checks"]').count() === 0,
    "No Decisions or Checks group is invented for a Run the owner reads as carrying none");

  // Inspect: the centre → panel hand-off on a real row. The readable
  // identity facts stay primary; the raw execution record sits behind a
  // collapsed disclosure (owner ruling 2 + spec L5).
  await runPlane.getByRole("button", {name: "Inspect", exact: true}).click();
  const handed = panel.locator(".agent-inspect-handed");
  await handed.waitFor({timeout: 10000});
  check(await handed.getAttribute("data-inspect-ref") === first.executions[0].ref,
    "Inspect opens the exact execution the Run plane handed over", {executionRef: first.executions[0].ref});
  const disclosure = handed.locator("details.oi-disclosure");
  check(await disclosure.count() === 1 && await disclosure.getAttribute("open") === null,
    "The handed execution's raw record sits behind a COLLAPSED disclosure in the primary view (spec L5)");
  await assertNoRawJson({check}, panel,
    "L5 · the panel's Inspect presentation keeps the primary view readable — the payload is disclosure-only");

  // ---------------------------------------------------------------------
  // The sidebar's AGENTS plane over the real kernel read (FACTORY-AGENCY
  // §2/§4): the real roster rows are the project's conversations, read
  // through AIKit's SessionSpace reading. The rendered rows must EQUAL that
  // kernel read, title by title with counts — the fixture probe accepted
  // invented Merediths here; this acceptance reads the kernel.
  // ---------------------------------------------------------------------
  await panel.locator(".agent-planes").getByRole("button", {name: "Agents", exact: true}).click();
  const agentsPlane = page.locator('[data-extra-plane="agents"] [data-plane="Agents"]');
  await agentsPlane.waitFor();
  check(await agentsPlane.getAttribute("data-fixture") === null,
    "The Agents plane carries no fixture standing");
  const reading = await channel("invoke.kernel_op", [{op: "agency_read", project: "Editor"}]);
  const outcome = reading.data?.outcome;
  if (!reading.ok || outcome?.result !== "agency_reading") {
    throw new Error(`the kernel's SessionSpace reading refused: ${JSON.stringify(reading).slice(0, 200)}`);
  }
  const kernelTitles = (outcome.spaces ?? []).flatMap(space =>
    Object.entries(space.agent_sessions ?? {}).map(([ref, attachment]) => attachment.purpose || space.label || ref));
  check(kernelTitles.includes(p.conversationTitle),
    "The kernel's own SessionSpace reading names the conversation this walk provisioned", {kernelTitles});
  // The plane situates its roster read by the mode's own grounded project
  // (the Factory navigator picker — this lane's wiring fix): the sidebar
  // grammar pass wired the grounded project into the Agents plane, whose
  // canvas subject carries none in Factory mode. The rendered roster must
  // therefore EQUAL the kernel's SessionSpace reading — the provisioned
  // conversation appears as a real row, by content equality.
  const conversationsSection = agentsPlane.locator('section[aria-label="Project conversations"]');
  await conversationsSection.waitFor({timeout: 30000});
  const rosterRow = conversationsSection.locator(".encounter-row", {hasText: p.conversationTitle});
  await rosterRow.waitFor({timeout: 60000});
  check(await rosterRow.count() === 1,
    "The Agents plane situates its roster read by the Factory navigator's grounded project: the kernel's conversation renders as a real roster row (the former Choose-a-project wiring gap, closed)",
    {kernelTitles, conversationTitle: p.conversationTitle});
  check((await rosterRow.innerText()).includes(p.conversationTitle),
    "The roster row names the conversation by its real SessionSpace purpose — no invented title");
  // The durable-worker roster has no native read on this cut: the plane
  // renders its honest emptiness and names the gap — no invented agents.
  check(await agentsPlane.getByText("No agents yet.").count() === 1,
    "The durable roster renders its honest emptiness — no invented agents");
  check(await agentsPlane.locator('section[aria-label="Product Guardians"] li').count() === 6
    && (await agentsPlane.locator('section[aria-label="Product Guardians"]').innerText()).includes("Roster read not exposed at the desktop seam yet."),
    "The guardians render as navigation with the named roster gap (FACTORY-AGENCY §2: say what is not exposed)");
  // The skill-proposal flow (FACTORY-AGENCY §4: "Native resolution turns
  // that intent into a proposed definition") has no native seam on this
  // cut — the plane must not masquerade one (§12: unsupported controls do
  // not masquerade as callable capabilities). The fixture probe's
  // suggest→apply skill-delta acceptance is retired with the fixture; it
  // returns here when the native AIKit search seam lands.
  check(await agentsPlane.getByRole("button", {name: "Suggest skills"}).count() === 0
    && await agentsPlane.locator(".oi-side-proposal").count() === 0
    && await agentsPlane.getByRole("button", {name: "Apply selected"}).count() === 0,
    "No skill-proposal flow is offered without native authority — the fixture's suggest/apply pair has no real counterpart on this cut");

  // ---------------------------------------------------------------------
  // Ruling 7 (DESKTOP-LANGUAGE.md, 2026-09-22): NOTHING in the app says
  // "returns". The walked surfaces' VISIBLE text is scanned line by line —
  // the Desk centre (board and detail) and the panel's planes. The arrived
  // material itself renders through the roster rows, the desk's receiving
  // strip and the Inspect hand-offs; the word renders nowhere.
  // ---------------------------------------------------------------------
  const assertNoReturnsText = async (root, label) => {
    const lines = (await root.innerText()).split("\n").map(line => line.trim()).filter(line => /returns/i.test(line));
    check(lines.length === 0, label, {offendingLines: lines.slice(0, 5)});
  };
  await assertNoReturnsText(centre, "L7 · the Factory centre's visible text never says \"returns\" — the Desk strip and detail render the material itself");
  await assertNoReturnsText(panel, "L7 · the panel's visible text never says \"returns\" — the planes render the material itself");

  // ---------------------------------------------------------------------
  // The sidebar's CONTEXT plane (owner direction 2026-09-20: the Context
  // plane IS the canvas): honest empty state on this cut, no raw record.
  // ---------------------------------------------------------------------
  await panel.locator(".agent-planes").getByRole("button", {name: "Context", exact: true}).click();
  const contextPlane = page.locator('[data-extra-plane="factory-context"]');
  await contextPlane.waitFor();
  check((await contextPlane.innerText()).includes("Nothing active yet"),
    "The Context plane renders its genuine no-active-panes state — no invented context");
  await assertNoRawJson({check}, contextPlane,
    "L5 · the Context plane renders readable panes only — no raw record in the primary view");

  // Back to the Desk: the detail round-trip leaves the board's remembered
  // scope intact and the owner's cards on it.
  await detail.locator(".desk-detail-head button.oi-action", {hasText: "Back to Desk"}).click();
  await board.waitFor({timeout: 30000});
  await waitForCount(cards, 1);
  check(await scope.inputValue() === "Factory-walk"
    && (await board.locator(".desk-card-title").allInnerTexts()).every(title => ownerLabels.includes(title.trim())),
    "Back from the Run detail, the board keeps its remembered scope and the owner's Runs");
  await shot("desk-back-from-detail");
}
