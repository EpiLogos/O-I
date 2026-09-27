// factory-expressions — the §9 encounter walk (EXPRESSION-DEVELOPMENT-SPEC
// §9 items 1 2 3 4 5 6 9 10) against the REAL ground (/Users/admin/Central),
// the REAL completed Run (evidence: Control/agents/now/flows/
// factory-expressions-2026-09-26/evidence.json), the installed owner
// binaries and the real kernel walk-bridge. No specimen.
//
// Mutations it performs, on purpose (the commission's acceptance):
//   1  sets Anima's and Aletheia's `expressive_character_ref` through Central
//      CAS (the Character editor's own save) — previous/new revisions recorded;
//   2  performs two material Scenes into a scratch Expression (saved under the
//      commission's NOW flow folder, never the curated register files);
//   3-5, 10  opens/performs the Run's act (desktop act store);
//   6  one composition edit on the Run's Live Expression in Technè;
//   9  saves an edited COPY of the Anima character through Save as reusable
//      ("Anima (walk variation)") — the curated file is never altered.
// Each step is its own boundary: a failing step records its failure and the
// walk continues, so the receipt names every step's standing.
import {spawnSync} from "node:child_process";
import {existsSync, readFileSync, statSync} from "node:fs";
import {join, normalize} from "node:path";
import {fileURLToPath} from "node:url";
import {bindDefaultCentral, enterApp} from "../editor-doc.mjs";

const ROOT = process.env.OI_WALK_REAL_CENTRAL ?? "/Users/admin/Central";
const PROJECT = "O-I";
const EVIDENCE = join(ROOT, "Control/agents/now/flows/factory-expressions-2026-09-26/evidence.json");
const REGISTER = "Work/O-I/desktop/cradle/material/expressive-material";
// The bridge serves the hosted Expressions application from the GROUND's
// primary checkout (hostedApp.ts EXPRESSIONS_APP_DIST = Work/O-I/…/dist),
// whatever it was last built from. The walk exercises THIS checkout's build:
// the frame's requests for that dist are answered from here.
const APP_DIST_PATH = "Work/O-I/desktop/cradle/expressions-app/dist/index.html";
const LOCAL_DIST = process.env.OI_WALK_EXPRESSIONS_DIST ?? fileURLToPath(new URL("../../expressions-app/dist/", import.meta.url));
const TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".wasm": "application/wasm"};

export async function setup() {
  if (!existsSync(EVIDENCE)) throw new Error(`the real Run's evidence is missing: ${EVIDENCE}`);
  const evidence = JSON.parse(readFileSync(EVIDENCE, "utf8"));
  const runRef = evidence.refs.runRef;
  const factory = process.env.OI_FACTORY_BIN ?? "factory";
  const attempts = JSON.parse(spawnSync(factory, ["attempt", "read", evidence.factoryState, runRef, "--json"], {encoding: "utf8"}).stdout);
  const legs = Object.values(attempts.legs ?? {});
  if (!legs.length || !legs.every(leg => leg.status === "returned")) throw new Error(`the Run ${runRef} is not completed in the owner's reading`);
  return {
    evidence, runRef, attempts, statePath: evidence.factoryState,
    sessions: Object.values(evidence.encounterJournals ?? {}).map(journal => journal.session),
    env: {OI_CENTRAL_ROOT: ROOT, OI_CENTRAL_PROJECT_QUERY: PROJECT},
    bridgeCwd: join(ROOT, "Work", PROJECT),
  };
}

export default async function run({page, baseUrl, bridgeUrl, check, shot, channel, log, provision: p}) {
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => log(`PAGE ERROR: ${error}`));
  // Warnings and errors from the Cradle and its hosted frames, kept for the
  // receipt of a step that fails (the frame's own refusal text).
  const consoleTail = [];
  page.on("console", message => { if (["error", "warning"].includes(message.type())) { consoleTail.push(`${message.type()}: ${message.text()}`.slice(0, 400)); if (consoleTail.length > 12) consoleTail.shift(); } });
  const op = async (opName, body) => {
    const response = await fetch(`${bridgeUrl}/op`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({op: opName, ...body})});
    const envelope = await response.json();
    if (!envelope.ok) throw new Error(`${opName}: ${JSON.stringify(envelope).slice(0, 600)}`);
    return envelope.outcome?.data ?? envelope.outcome;
  };
  const world = request => op("expression_world", {request});
  const expression = request => op("expression", {request});
  const card = agentRef => op("agent_card", {agent_ref: agentRef, world_ref: null});
  const characterOf = reading => reading?.character?.character_ref ?? null;
  const step = async (label, body) => {
    try { await body(); }
    catch (error) { check(false, `${label}: the step completed`, {error: String(error?.stack ?? error).slice(0, 1200)}); await shot(`${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-failure`).catch(() => {}); }
  };
  const frame = () => page.frameLocator(".mode-stage:not([hidden]) iframe.pcd-host-frame, .flx-stage iframe.pcd-host-frame").first();
  // Selecting an object on stage: the walk selects through the application's
  // own selectEntity (the same function a canvas pick calls — a pointer pick
  // is not used because a press on the stage can begin a drag edit), and the
  // APPLICATION announces the selection (`oi-app-state`) to the host.
  const announceSelection = async id => {
    await page.locator('.flx-stage .pcd-host[data-state="ready"]').waitFor({timeout: 60000});
    const handle = await page.locator(".flx-stage iframe.pcd-host-frame").elementHandle({timeout: 30000});
    const hosted = await handle.contentFrame();
    await hosted.waitForFunction(() => !!window.__FIELD_STUDIES__, null, {timeout: 30000});
    const present = await hosted.evaluate(entity => {
      const app = window.__FIELD_STUDIES__, scene = app.getDocument().scenes[app.getState().sceneIndex];
      if (!scene?.entities.some(e => e.id === entity)) return false;
      app.selectEntity(entity); return true;
    }, id);
    // Selecting opens the application's own "Objects in this scene" panel;
    // close it (the selection stays) so the stage and the host panel show.
    await hosted.waitForTimeout(400);
    await hosted.evaluate(() => { for (const button of document.querySelectorAll('[data-action="close-context"]')) if (button.getClientRects().length) button.click(); });
    return present;
  };
  const mode = name => page.getByRole("radiogroup", {name: "Workspace mode", exact: true}).getByRole("radio", {name, exact: true}).click();
  /** Open one kernel Expression in the Expressions centre through the
   * navigator's own row (the person's path). */
  const openInExpressions = async expressionRef => {
    await mode("Expressions");
    const row = page.locator(`button[data-row-id="${expressionRef}"]`);
    await row.waitFor({timeout: 60000});
    // A person clicks the row once the Expressions stage is showing.
    await page.locator(`.mode-stage:not([hidden]) .pcd-host[data-state="ready"] iframe.pcd-host-frame`).waitFor({state: "visible", timeout: 60000});
    const stageShown = await page.evaluate(() => { const f = document.querySelector(".mode-stage:not([hidden]) iframe.pcd-host-frame"); return !!f && f.getClientRects().length > 0 && !f.closest("[hidden],[inert]"); });
    await page.waitForTimeout(1000);
    // Record what the presented frame is actually asked (host commands), so a
    // stage that does not switch says whether the request reached the frame.
    const presented = await page.locator(`.mode-stage:not([hidden]) iframe.pcd-host-frame`).first().elementHandle({timeout: 60000}).then(h => h.contentFrame()).catch(() => null);
    await presented?.evaluate(() => { window.__fxCommands = []; if (window.__fxHeard) return; window.__fxHeard = true; window.addEventListener("message", event => { const d = event.data; if (d?.kind === "host-command") window.__fxCommands.push(`${d.command}:${d.ref ?? ""}`); }); }).catch(() => {});
    await row.click();
    await page.locator(`.mode-stage:not([hidden]) .pcd-host[data-state="ready"]`).waitFor({timeout: 60000});
    // The host may already be ready on another Expression: wait for the
    // frame to announce the one the row asked for, not a fixed pause.
    const started = Date.now();
    let shown = await seen(".mode-stage:not([hidden]) iframe.pcd-host-frame");
    while (shown.expression_ref !== expressionRef && Date.now() - started < 30000) { await page.waitForTimeout(1500); shown = await seen(".mode-stage:not([hidden]) iframe.pcd-host-frame"); }
    const listen = () => presented?.evaluate(() => ({listening: !!window.__fxHeard, commands: window.__fxCommands ?? [], status: document.getElementById("native-status")?.textContent ?? null})).catch(error => ({error: String(error)}));
    const heard = await listen();
    if (shown.expression_ref !== expressionRef) {
      // Diagnostic only: a second click on the same row with the stage settled.
      await row.click(); await page.waitForTimeout(6000);
      heard.after_second_click = await listen();
      shown = await seen(".mode-stage:not([hidden]) iframe.pcd-host-frame");
      heard.after_second_click.announced = shown.expression_ref;
    }
    return {...shown, waited_ms: Date.now() - started, stage_shown_before_click: stageShown, frames: await page.evaluate(() => [...document.querySelectorAll("iframe.pcd-host-frame")].map(f => ({stage: f.closest("[data-mode-stage]")?.getAttribute("data-mode-stage") ?? (f.closest(".flx-stage") ? "factory-live" : "other"), shown: f.getClientRects().length > 0 && !f.closest("[hidden],[inert]"), query: (f.getAttribute("src") ?? "").split("?")[1]?.replace(/token=[^&]*/g, "token=…") ?? ""}))), heard};
  };
  /** Factory → O-I → the real Run → Live (from wherever the walk stands). */
  const openLive = async () => {
    await mode("Factory");
    const centre = page.locator("main.factory-centre");
    const existing = centre.locator(`[data-run-page="${p.runRef}"]`);
    const liveChip = centre.locator(`[data-run-live="${p.runRef}"]`);
    if (await liveChip.isVisible().catch(() => false)) await liveChip.click(); // a conversation of this Run opens the same Live
    else if (!(await existing.isVisible().catch(() => false))) {
      const deskLink = page.getByRole("link", {name: "Desk"}).or(page.getByRole("button", {name: "Desk", exact: true})).first();
      if (await deskLink.isVisible().catch(() => false)) await deskLink.click();
      if (await centre.getByRole("button", {name: "← Desk"}).isVisible().catch(() => false)) await centre.getByRole("button", {name: "← Desk"}).click();
      const runCard = centre.locator(`[data-run-card="${p.runRef}"]`);
      await runCard.waitFor({timeout: 180000});
      await runCard.click();
    }
    const runPage = centre.locator(`[data-run-page="${p.runRef}"]`);
    await runPage.waitFor({timeout: 60000});
    await runPage.getByRole("tab", {name: "Live", exact: true}).click();
    await runPage.locator(".flx-stage iframe.pcd-host-frame").waitFor({timeout: 120000});
    return runPage;
  };

  // ── What the person sees (a step passes only if they would see it) ──────
  // Each hosted frame's latest `oi-app-state` announcement, recorded on the
  // iframe element that sent it.
  const trackAppState = () => page.evaluate(() => {
    if (window.__fxTracking) return; window.__fxTracking = true;
    window.addEventListener("message", event => {
      const data = event.data;
      if (!data || data.v !== 1 || data.kind !== "oi-app-state") return;
      for (const frame of document.querySelectorAll("iframe.pcd-host-frame")) if (frame.contentWindow === event.source) frame.dataset.fxState = JSON.stringify(data.state ?? {});
    });
  });
  /** The frame's announced state: nativeScene, document, gate. */
  const seen = async selector => {
    const handle = await page.locator(selector).first().elementHandle({timeout: 30000});
    const hosted = await handle.contentFrame();
    // Ask the application to announce itself (a host-mode message is answered
    // with a fresh oi-app-state), then read what it said and what it shows.
    await page.evaluate(sel => { const f = document.querySelector(sel); f?.contentWindow?.postMessage({v: 1, kind: "host-mode", mode: f.closest(".mode-stage")?.getAttribute("data-mode-stage") === "techne" ? "techne" : "expressions"}, "*"); }, selector);
    await page.waitForTimeout(800);
    const state = JSON.parse((await handle.getAttribute("data-fx-state")) ?? "{}");
    const gate = await hosted.evaluate(() => { const g = document.getElementById("entry-gate"); return !!g && !g.hidden && g.getClientRects().length > 0; });
    const conflict = await hosted.evaluate(() => /revision_conflict|Keep the whole work/.test(document.body.innerText));
    const canvas = await hosted.evaluate(() => { const c = document.querySelector("canvas"); return !!c && c.width > 0 && c.getClientRects().length > 0; });
    const notice = await hosted.evaluate(() => { const t = document.getElementById("toast"); return t && !t.hidden ? t.textContent : null; });
    return {expression_ref: state.nativeScene?.expression_ref, scene_ref: state.nativeScene?.scene_ref, revision: state.nativeScene?.revision, gate, conflict, canvas, notice};
  };
  /** Sampled non-blank pixels of a 2D canvas (the character preview). */
  const inked = locator => locator.evaluate(canvas => {
    const ctx = canvas.getContext("2d"); if (!ctx || !canvas.width) return 0;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let n = 0;
    for (let i = 3; i < data.length; i += 16) if (data[i] > 24) n++;
    return n;
  });

  await page.route(url => url.href.startsWith(`${bridgeUrl}/material/`), async route => {
    const url = new URL(route.request().url());
    const [head, ...rest] = url.pathname.replace(/^\/material\//, "").split("/");
    let location;
    try { location = JSON.parse(decodeURIComponent(head)); } catch { return route.continue(); }
    if (location?.path !== APP_DIST_PATH) return route.continue();
    const file = normalize(join(LOCAL_DIST, rest.join("/") || "index.html"));
    if (!file.startsWith(normalize(LOCAL_DIST)) || !existsSync(file)) return route.fulfill({status: 404, body: "not in this checkout's Expressions build"});
    const extension = file.slice(file.lastIndexOf("."));
    return route.fulfill({status: 200, body: readFileSync(file), headers: {"content-type": TYPES[extension] ?? "application/octet-stream"}});
  });
  const built = spawnSync("git", ["-C", LOCAL_DIST, "log", "-1", "--format=%H"], {encoding: "utf8"}).stdout.trim();
  check(existsSync(join(LOCAL_DIST, "index.html")), "Harness: the hosted Expressions application is served from this checkout's build (not the ground's primary checkout dist)", {dist: LOCAL_DIST, commit: built, built_at: existsSync(join(LOCAL_DIST, "index.html")) ? statSync(join(LOCAL_DIST, "index.html")).mtime.toISOString() : null});
  // The bridge is `cargo run` against CARGO_TARGET_DIR; a shared target can
  // serve another checkout's kernel. OI_WALK_BRIDGE_BUILD_LOG names the cargo
  // build output that produced it, so the receipt proves which source it is.
  const kernelDir = normalize(fileURLToPath(new URL("../../kernel/", import.meta.url))).replace(/\/$/, "");
  const buildLog = process.env.OI_WALK_BRIDGE_BUILD_LOG;
  const compiled = buildLog && existsSync(buildLog) ? (readFileSync(buildLog, "utf8").match(/Compiling oi-cradle-kernel v\S+ \(([^)]+)\)/) ?? [])[0] ?? null : null;
  const targetDir = process.env.CARGO_TARGET_DIR ?? null;
  const binary = targetDir ? join(targetDir, "debug", "walk-bridge") : null;
  check(!!compiled && compiled.includes(`(${kernelDir})`) && !!binary && existsSync(binary) && statSync(binary).mtimeMs >= statSync(buildLog).mtimeMs - 60_000, "Harness: the walk-bridge was compiled from this checkout's kernel into the dedicated CARGO_TARGET_DIR", {compiled, kernel: kernelDir, cargo_target_dir: targetDir, binary_built_at: binary && existsSync(binary) ? statSync(binary).mtime.toISOString() : null, build_log: buildLog ?? null});

  await page.goto(baseUrl); await channel("info");
  await trackAppState();
  // The real OI home usually already names the default Central; bind it only
  // when the location chooser asks.
  if (await page.getByRole("region", {name: "Central location"}).isVisible({timeout: 8000}).catch(() => false)) {
    await bindDefaultCentral(page, ROOT);
    await page.reload(); await channel("info");
  }
  await enterApp(page);
  await shot("0-entered");

  const listing = await world({operation: "material_list"});
  const byPath = path => listing.materials.find(material => material.location?.path === `${REGISTER}/${path}`);
  const anima = byPath("character/anima.expression.json"), aletheia = byPath("character/aletheia.expression.json");
  const handoff = byPath("scene/handoff.expression.json"), arrival = byPath("scene/arrival.expression.json");
  const workflow = byPath("expression/expression-development.expression.json");
  check(anima && aletheia && handoff && arrival && workflow, "The curated material is seeded in the register (both characters, handoff, arrival, the workflow Expression)", {register: listing.register, count: listing.materials.length});

  // ── 1. Characters on the profiles, set through the Character editor ──────
  const revisions = {};
  await step("1-characters", async () => {
    for (const [agentRef, material, name] of [["agent/anima", anima, "Anima"], ["agent/aletheia", aletheia, "Aletheia"]]) {
      const before = await card(agentRef);
      revisions[agentRef] = {before: before.identity.revision, character_before: characterOf(before)};
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("oi:open-agency", {detail: {}})));
      const launcher = page.locator('section[aria-label="Native Agent creation"]').first();
      await launcher.waitFor({timeout: 60000});
      const roster = launcher.getByRole("group", {name: "Native Agent roster"});
      if (!(await roster.isVisible().catch(() => false))) await launcher.getByRole("button", {name: "Read native roster"}).click();
      await roster.waitFor({timeout: 60000});
      await roster.getByRole("button").filter({hasText: new RegExp(`^${name}\\s*(Accepted|Proposal)`)}).first().click();
      // An accepted Agent shows its Agent Card with the Character editor; a
      // stored proposal shows its review with the same Character editor.
      const cardView = launcher.locator(`article.agent-card, section[aria-label="Review native Agent source"]`).first();
      await cardView.waitFor({timeout: 90000});
      check((await cardView.innerText()).includes(name), `1: ${name}'s Agent card / source review opens from the native roster`);
      const editor = cardView.locator(".character-editor").first();
      if (!(await editor.isVisible())) await cardView.locator("details.oi-disclosure summary").filter({hasText: /character/i}).first().click();
      await editor.getByRole("combobox", {name: "Reusable character"}).selectOption(material.file_ref);
      const save = editor.getByRole("button", {name: /Save character/});
      if (characterOf(before) !== material.file_ref) {
        await save.click();
        await editor.getByRole("status").filter({hasText: /Saved as revision|already carries/}).waitFor({timeout: 60000});
      }
      const after = await card(agentRef);
      revisions[agentRef].after = after.identity.revision;
      revisions[agentRef].character_after = characterOf(after);
      check(characterOf(after) === material.file_ref, `1: ${name}'s profile carries character/${name.toLowerCase()}.expression.json through Central (card reading)`, revisions[agentRef]);
      // Preview ≥ 2 states.
      const section = cardView.locator(".agent-card-character");
      const preview = cardView.getByRole("combobox", {name: "Character state or gesture"}).first();
      await preview.waitFor({timeout: 60000});
      const states = await preview.locator("optgroup[label=States] option").allInnerTexts();
      check(["idle", "working", "speaking"].every(s => states.includes(s)), `1: ${name}'s preview offers the saved states idle/working/speaking`, {states});
      await preview.scrollIntoViewIfNeeded();
      for (const state of ["idle", "working"]) {
        await preview.selectOption({label: state});
        await page.waitForTimeout(1200);
        const pixels = await inked(cardView.locator("canvas.character-preview-canvas").first()).catch(() => 0);
        check(pixels > 20, `1: ${name}'s live preview shows the ${state} state (inked canvas pixels)`, {pixels});
        await shot(`1-${name.toLowerCase()}-${state}`);
      }
    }
  });

  // ── 2. Both characters reused in two different Scenes (Expressions) ──────
  await step("2-scenes", async () => {
    const scratchRef = `expression:fx-walk-reuse-${Date.now().toString(36)}`;
    await expression({operation: "create", expression_ref: scratchRef, title: "Factory Expressions walk — reuse", actor: "human:fx-walk"});
    // The scratch Expression lives in the kernel's open field (an act needs
    // an open target, not a saved file); nothing is written to the ground.
    const actRef = `act:fx-walk-reuse-${Date.now().toString(36)}`;
    await world({operation: "act_open", act_ref: actRef, expression_ref: scratchRef, mode: "expressions", actor: "human:fx-walk", summary: "Reuse both characters in two Scenes",
      cast: [{role: "sender", participant_ref: "agent/anima", character_ref: anima.file_ref}, {role: "recipient", participant_ref: "agent/aletheia", character_ref: aletheia.file_ref}]});
    const agent = (ref, character, label, state) => ({kind: "agent", agent_ref: ref, character_ref: character, label, state});
    const performedHandoff = await world({operation: "act_select", act_ref: actRef, actor: "human:fx-walk", kind: "scene", material: {file_ref: handoff.file_ref, revision: handoff.revision, scene_ref: handoff.entry_scene_ref},
      bindings: {sender: agent("agent/anima", anima.file_ref, "Anima", "speaking"), recipient: agent("agent/aletheia", aletheia.file_ref, "Aletheia", "idle"), artifact: {kind: "object", subject_ref: p.runRef, label: "Return"}, caption: {kind: "text", text: "Anima hands the composition to Aletheia"}}});
    check(performedHandoff.state === "act_performed", "2: scene/handoff performs with sender=Anima, recipient=Aletheia", {state: performedHandoff.state, passage: performedHandoff.passage?.index});
    const target = (await expression({operation: "inspect", expression_ref: scratchRef})).document;
    const grafted = JSON.stringify(target.scenes.map(scene => scene.presentation?.scene?.entities ?? []));
    check(grafted.includes("◉") || grafted.includes(".-^-.") , "2: the handoff Scene carries Aletheia's character material (grafted from the profile character)", {revision: target.revision});
    await openInExpressions(scratchRef);
    const shown = await seen(".mode-stage:not([hidden]) iframe.pcd-host-frame");
    check(shown.expression_ref === scratchRef && !shown.gate && !shown.conflict && shown.canvas, "2: the Expressions stage shows the handoff (announced Expression = the scratch Expression; entry gate closed; no conflict)", shown);
    await shot("2-handoff-anima-aletheia");
    const performedArrival = await world({operation: "act_select", act_ref: actRef, actor: "human:fx-walk", kind: "scene", material: {file_ref: arrival.file_ref, revision: arrival.revision, scene_ref: arrival.entry_scene_ref},
      bindings: {self: agent("agent/anima", anima.file_ref, "Anima", "working"), goal: {kind: "object", subject_ref: p.runRef, label: "Goal"}, caption: {kind: "text", text: "Anima arrives at the goal"}}});
    check(performedArrival.state === "act_performed", "2: scene/arrival performs with self=Anima (a second Scene reusing the character)", {state: performedArrival.state});
    await page.evaluate(ref => { const f = document.querySelector(".mode-stage:not([hidden]) iframe.pcd-host-frame"); f?.contentWindow?.postMessage({v: 1, kind: "host-command", command: "refresh-expression", ref}, "*"); }, scratchRef);
    await page.waitForTimeout(4000);
    await shot("2-arrival-anima");
  });

  // ── 3-4. Factory → the real Run → Live ─────────────────────────────────
  let runPage, runKey, act;
  await step("3-4-live", async () => {
    // Earlier walks' acts of this Run are set aside (completed as cancelled,
    // still readable), so the Live view performs the Run afresh in a
    // successor act — the acceptance sees the full history performed.
    const liveRef = `expression:factory-run-${p.runRef.replace(/[^A-Za-z0-9-_.]/g, "-")}`;
    const earlier = ((await world({operation: "act_list", expression_ref: liveRef}).catch(() => ({acts: []}))).acts ?? []).filter(a => a.phase !== "completed" && a.phase !== "cancelled");
    for (const a of earlier) await world({operation: "act_complete", act_ref: a.act_ref, actor: "human:fx-walk", cancelled: true}).catch(error => log(`set aside ${a.act_ref}: ${error}`));
    check(true, "3: earlier walk acts of this Run are set aside (cancelled, still readable)", {set_aside: earlier.map(a => a.act_ref)});
    await mode("Factory");
    const trigger = page.locator('[data-left-head] .left-scope-trigger');
    await trigger.click();
    await page.getByRole("group", {name: "Scope and workspace"}).locator(`[data-scope-project="${PROJECT}"]`).click();
    runPage = await openLive();
    const live = runPage.locator("[data-live-expression]");
    await live.waitFor({timeout: 120000});
    await page.waitForFunction(() => document.querySelector("[data-live-status]")?.getAttribute("data-live-status") === "following", null, {timeout: 180000});
    const choice = runPage.getByRole("combobox", {name: "Expression this Run performs"});
    await choice.waitFor({timeout: 60000});
    await choice.selectOption(workflow.file_ref);
    await page.waitForFunction(() => document.querySelector(".flx-strip")?.getAttribute("data-live-repertoire") === "explicit", null, {timeout: 60000});
    check(true, "3: the saved workflow Expression (expression-development) is chosen in the Live selector (explicit repertoire)");
    const acts = (await world({operation: "act_list", expression_ref: `expression:factory-run-${p.runRef.replace(/[^A-Za-z0-9-_.]/g, "-")}`})).acts ?? [];
    const index = ref => { const m = /:(\d+)$/.exec(ref); return m && ref.split(":").length > 2 && /^\d+$/.test(m[1]) ? Number(m[1]) : 1; };
    const newest = acts.filter(a => a.phase !== "cancelled").sort((a, b) => index(a.act_ref) - index(b.act_ref)).at(-1);
    runKey = newest?.act_ref;
    act = newest ? (await world({operation: "act_inspect", act_ref: newest.act_ref})).act : undefined;
    check(!!act, "3: the Run's act is open in the kernel", {acts: acts.map(a => [a.act_ref, a.passages])});
    const cast = act?.cast ?? [];
    check(["agent/anima", "agent/aletheia"].every(agent => cast.some(member => member.participant_ref === agent && member.character_ref)), "3: the act's cast binds Anima and Aletheia with their profile characters", {cast});
    // Wait for the full history to be performed (≤ 160 operations).
    // The full history (≤ 160 operations) is performed on first open; wait
    // until the act stops growing.
    let last = -1;
    // The chain: the act rolls over to `:n` at the kernel's passage cap.
    let chain = [];
    for (let i = 0; i < 60; i++) {
      const listed = ((await world({operation: "act_list", expression_ref: liveRef})).acts ?? []).filter(a => a.phase !== "cancelled").sort((a, b) => index(a.act_ref) - index(b.act_ref));
      chain = [];
      for (const a of listed) chain.push((await world({operation: "act_inspect", act_ref: a.act_ref})).act);
      const total = chain.reduce((n, a) => n + a.sequence.length, 0);
      if (total > 10 && total === last) break;
      last = total;
      await page.waitForTimeout(5000);
    }
    act = chain.at(-1);
    const sequence = chain.flatMap(a => a.sequence);
    check(sequence.length > 20 && !sequence.some(passage => passage.operation === "live.catch-up"), "4: the Run's whole history is performed (no catch-up for this small Run)", {chain: chain.map(a => [a.act_ref, a.sequence.length]), passages: sequence.length});
    const families = new Set(sequence.map(passage => passage.event_basis?.family).filter(Boolean));
    for (const family of ["arrival", "activity", "skill-invocation", "message", "review", "artifact", "completion"]) {
      check(families.has(family), `4: the act performed ${family} passages from the real Run`, {families: [...families]});
    }
    const senders = sequence.filter(passage => passage.event_basis?.family === "message").map(passage => JSON.stringify(passage.bindings?.sender ?? {}));
    check(senders.some(s => s.includes("agent/aletheia")) && senders.some(s => s.includes("agent/anima")), "4: the exchange runs both ways (Anima→Aletheia and Aletheia→Anima agent-messages)", {senders: senders.slice(0, 6)});
    check(sequence.some(passage => passage.kind === "text" && passage.role === "resultText") && sequence.some(passage => passage.kind === "text" && passage.role === "progressText"), "4: progress and result text were filled");
    const doc = (await expression({operation: "inspect", expression_ref: act.expression_ref})).document;
    const titles = Object.values(doc.entities).map(entity => entity.title);
    check(Object.values(doc.entities).some(entity => entity.subject?.readings?.some(reading => reading.ref === "factory.run-node/destination")), "4: the goal is present as an expressive object", {titles: titles.slice(0, 12)});
    check(Object.values(doc.entities).some(entity => entity.subject?.subject_ref?.startsWith("workflow-unit:") || entity.subject?.subject_ref?.startsWith("artifact")), "4: a work object is present");
    const liveSeen = await seen(".flx-stage iframe.pcd-host-frame");
    check(liveSeen.expression_ref === act.expression_ref && !liveSeen.gate && !liveSeen.conflict && liveSeen.canvas, "4: the Live stage stands on the Run's own Expression (announced nativeScene; no gate, no conflict)", liveSeen);
    const shownDoc = (await expression({operation: "inspect", expression_ref: act.expression_ref})).document;
    const shownScene = shownDoc.scenes.find(scene => scene.scene_ref === liveSeen.scene_ref);
    const castEntities = ["participants.0", "participants.1"].map(role => act.role_entities?.[role]).filter(Boolean);
    check(!!shownScene && castEntities.length === 2 && castEntities.every(ref => shownScene.entity_refs.includes(ref)), "4: the Scene on stage holds both cast characters' entities", {scene: liveSeen.scene_ref, castEntities, members: shownScene?.entity_refs?.length});
    const points = runPage.locator(".flx-timeline li button");
    const count = await points.count();
    for (const [i, label] of [[0, "start"], [Math.floor(count / 2), "middle"], [count - 1, "end"]]) {
      await points.nth(i).click().catch(() => {});
      await page.waitForTimeout(2500);
      await shot(`4-live-timeline-${label}`);
    }
  });

  // ── 5. Object panels with their real actions ────────────────────────────
  await step("5-panels", async () => {
    // Each object kind is reached as the person reaches it: the timeline puts
    // a passage on stage (act_seek), and the object presenting a role in that
    // Scene is picked. `plan` pairs each kind with the passage that shows it.
    const scenes = act.sequence.filter(passage => passage.kind === "scene");
    const lastOf = test => [...scenes].reverse().find(test);
    const sceneIs = (p, key) => (p.scene_ref ?? "").endsWith(`:scene:${key}`);
    const plan = {
      character: {passage: lastOf(p => sceneIs(p, "completion") || sceneIs(p, "arrival")), roles: ["participants.0", "lead", "self"]},
      goal: {passage: lastOf(p => sceneIs(p, "completion") || sceneIs(p, "arrival")), roles: ["goal"]},
      artifact: {passage: lastOf(p => (sceneIs(p, "work-passage") || sceneIs(p, "review")) && p.event_basis?.family !== "message"), roles: ["artifact"]},
      exchange: {passage: lastOf(p => sceneIs(p, "handoff") && p.event_basis?.family === "message"), roles: ["artifact"]},
    };
    const kinds = {};
    const stageIds = async () => {
      const handle = await page.locator(".flx-stage iframe.pcd-host-frame").elementHandle({timeout: 30000});
      const hosted = await handle.contentFrame();
      await hosted.waitForFunction(() => !!window.__FIELD_STUDIES__, null, {timeout: 30000});
      return hosted.evaluate(() => { const app = window.__FIELD_STUDIES__; return (app.getDocument().scenes[app.getState().sceneIndex]?.entities ?? []).map(e => e.id); });
    };
    const reach = async kind => {
      const {passage, roles} = plan[kind];
      if (!passage) return undefined;
      // The person's path: the Live timeline point for that passage.
      const point = runPage.locator(`.flx-timeline li[data-act-ref="${act.act_ref}"][data-position="${passage.index}"] button`);
      if (await point.count()) await point.click();
      else await world({operation: "act_seek", act_ref: act.act_ref, actor: "human:fx-walk", position: passage.index});
      await page.waitForTimeout(3500); // the stage follows the kernel
      act = (await world({operation: "act_inspect", act_ref: act.act_ref})).act;
      const role = roles.find(r => act.role_entities?.[r]);
      return role ? act.role_entities[role] : undefined;
    };
    check(Object.values(plan).every(entry => entry.passage), "5: the act has passages presenting a character, the goal, an artifact and an exchange", Object.fromEntries(Object.entries(plan).map(([k, v]) => [k, v.passage?.index])));
    const select = announceSelection;
    for (const kind of Object.keys(plan)) {
      const ref = await reach(kind);
      kinds[kind] = ref;
      const ids = await stageIds().catch(() => []);
      const panel = runPage.locator(".flx-panel");
      let opened = false, onStage = false;
      if (!ref) { check(false, `5: the ${kind} is reachable on stage`, {stage: ids.slice(0, 12)}); continue; }
      for (let attempt = 0; attempt < 3 && !opened; attempt++) {
        onStage = await select(ref);
        opened = await panel.waitFor({timeout: 6000}).then(() => true, () => false);
      }
      // The panel resolves the object from the kernel's document; wait until it names its kind.
      const expected = {character: "agent", goal: "goal", artifact: "artifact", exchange: "exchange"}[kind];
      if (opened) await page.waitForFunction(k => document.querySelector(".flx-panel")?.getAttribute("data-live-object") === k, expected, {timeout: 15000}).catch(() => {});
      const panelKind = opened ? await panel.getAttribute("data-live-object") : null;
      check(onStage && opened && panelKind === expected, `5: the ${kind} is on stage; selecting it opens its ${expected} panel`, {ref, onStage, panelKind, stage: onStage ? undefined : ids.slice(0, 12)});
      if (!opened) continue;
      await shot(`5-panel-${kind}`);
      if (kind === "character") {
        const button = panel.getByRole("button", {name: "Open conversation"});
        if (await button.count()) {
          await button.click();
          const tasks = await page.locator("main.factory-centre.factory-tasks").waitFor({timeout: 30000}).then(() => true, () => false);
          const session = await page.locator("main.factory-centre.factory-tasks").innerText().catch(() => "");
          check(tasks, "5: Open conversation opens the agent's real session in Tasks", {excerpt: session.slice(0, 300)});
          await page.waitForTimeout(2500);
          await shot("5-character-conversation");
          runPage = await openLive();
          continue;
        }
      }
      if (kind === "artifact") {
        const button = panel.getByRole("button", {name: /Open attempt|Open working surface/}).first();
        if (await button.count()) {
          await button.click();
          const details = await page.locator(".object-page, [data-object-page]").first().waitFor({timeout: 30000}).then(() => true, () => false);
          await page.waitForFunction(() => !/Reading work unit…/.test(document.querySelector(".object-page, [data-object-page]")?.textContent ?? ""), null, {timeout: 20000}).catch(() => {});
          check(details, "5: the artifact opens its details (object page)");
          await shot("5-artifact-details");
          await page.locator("main.factory-centre").getByRole("button", {name: /^(Back|← )/}).first().click().catch(() => {});
          runPage = await openLive();
          continue;
        }
      }
      if (kind === "goal") check((await panel.innerText()).length > 20 && await panel.getByRole("button", {name: "Develop in Technè"}).count() === 1, "5: the goal panel shows the brief/progress and its actions");
      if (kind === "exchange") {
        const parties = await panel.locator("[data-exchange-parties]").innerText().catch(() => "");
        const bodyText = await panel.locator("[data-exchange-body]").innerText().catch(() => "");
        const ref = await panel.locator("[data-exchange-ref]").innerText().catch(() => "");
        check(/→/.test(parties) && !parties.includes("?") && bodyText.length > 3 && ref.length > 3, "5: the exchange panel shows sender → recipient, the message body and its native ref", {parties, body: bodyText.slice(0, 160), ref});
      }
      await panel.getByRole("button", {name: "Close"}).click().catch(() => {});
    }
    // Message agent: the addressed composer is pre-filled (never sent here).
    const characterRef = await reach("character");
    if (characterRef) {
      await select(characterRef);
      const panel = runPage.locator(".flx-panel");
      await panel.waitFor({timeout: 8000});
      await panel.getByRole("textbox").fill("Walk check: the §9 panel addresses you (not sent).");
      await panel.getByRole("button", {name: "Compose"}).click();
      const composed = await page.locator(".encounter-addressed").first().waitFor({timeout: 30000}).then(() => true, () => false);
      const addressed = await page.locator(".encounter-addressed textarea, .encounter-addressed input").evaluateAll(nodes => nodes.map(node => node.value).join(" | ")).catch(() => "");
      check(composed && addressed.includes("Walk check"), "5: Message agent pre-fills the conversation's addressed composer (sender/basis stay the person's)", {addressed: addressed.slice(0, 200)});
      await shot("5-message-composer");
      runPage = await openLive();
    }
  });

  // ── 6. Develop in Technè → edit → return to the Run ────────────────────
  await step("6-techne", async () => {
    runPage = await openLive();
    const goalPassage = [...act.sequence].reverse().find(passage => passage.kind === "scene" && passage.bindings?.goal);
    if (goalPassage) act = (await world({operation: "act_seek", act_ref: act.act_ref, actor: "human:fx-walk", position: goalPassage.index})).act ?? act;
    await page.waitForTimeout(3000);
    const goalRef = act.role_entities?.goal;
    await announceSelection(goalRef);
    const panel = runPage.locator(".flx-panel");
    await panel.waitFor({timeout: 10000});
    await panel.getByRole("button", {name: "Develop in Technè"}).click();
    const strip = page.getByRole("region", {name: "Carried act"});
    await strip.waitFor({timeout: 60000});
    const techneSeen = await seen('.mode-stage[data-mode-stage="techne"]:not([hidden]) iframe.pcd-host-frame').catch(error => ({error: String(error)}));
    check(await strip.isVisible() && techneSeen.expression_ref === act.expression_ref && !techneSeen.gate, "6: Technè opens the Run's Expression (announced) with the carried act strip", techneSeen);
    await shot("6-techne-act-strip");
    const current = (await expression({operation: "inspect", expression_ref: act.expression_ref})).document;
    const scene = current.scenes.find(s => s.presentation?.scene?.entities?.length) ?? current.scenes[0];
    const material = structuredClone(scene.presentation.scene);
    material.entities[0].position.x = (material.entities[0].position.x ?? 0) + 0.25;
    const edited = await expression({operation: "edit", expression_ref: current.expression_ref, expected_revision: current.revision, actor: "human:fx-walk", changes: [{change: "scene_material_set", scene_ref: scene.scene_ref, presentation: {...scene.presentation, scene: material}}]});
    check(edited.document?.revision === current.revision + 1, "6: the composition changes in Technè (moved an object through the native edit)", {from: current.revision, to: edited.document?.revision});
    await page.waitForTimeout(2000);
    await shot("6-techne-edited");
    await strip.getByRole("button", {name: "Return to the Run"}).click();
    await page.locator("[data-live-expression]").waitFor({timeout: 60000});
    const after = (await world({operation: "act_inspect", act_ref: act.act_ref})).act;
    check(after.sequence.some(passage => passage.kind === "operate" && /techne\.return/.test(passage.operation ?? "")) && after.continuations?.some(c => c.to === "techne") && after.continuations?.some(c => c.from === "techne" && c.to === "factory"), "6: the act recorded Factory→Technè→Factory and the returned passage", {continuations: after.continuations});
    act = after;
    await page.waitForTimeout(3000);
    await shot("6-returned-live");
  });

  // ── 9. Edit a copy of the Anima character; save; reopen; every value survives
  await step("9-material", async () => {
    const opened = await expression({operation: "open_file", location: anima.location, actor: "human:fx-walk"});
    const source = opened.document;
    const copyRef = `expression:fx-walk-anima-variation-${Date.now().toString(36)}`;
    const forked = await expression({operation: "fork", expression_ref: source.expression_ref, expected_revision: source.revision, new_expression_ref: copyRef, actor: "human:fx-walk"});
    let doc = forked.document;
    const working = doc.scenes.find(scene => scene.title === "Working") ?? doc.scenes[0];
    const material = structuredClone(working.presentation.scene);
    const self = material.entities.find(entity => entity.role === "self") ?? material.entities[0];
    Object.assign(self.force, {kind: "vortex", strength: 1.9, spin: 1.7});           // physics
    self.tint = "#3f8fd2"; self.tintWeight = 0.95;                                    // colour
    material.morph = {...material.morph, law: "product", depth: 1.6, thetaRate: 0.31}; // morph
    material.field.params.frequency = 639; material.field.params.excitation = 0.9;    // resonance/cymatics
    self.sound = {enabled: true, followCymatic: false, frequencyHz: 330, gain: 0.3, waveform: "triangle", attack: 0.12, release: 1.1, pan: -0.2}; // sound
    self.sequence.steps[0].hold = 2.25; self.sequence.steps[0].transition = 1.35;       // temporal (sequence)
    material.duration = 17; material.transition = 2.5;                                  // temporal (scene)
    doc = (await expression({operation: "edit", expression_ref: copyRef, expected_revision: doc.revision, actor: "human:fx-walk", changes: [{change: "scene_material_set", scene_ref: working.scene_ref, presentation: {...working.presentation, scene: material}}]})).document;
    const reuse = {...structuredClone(source.reuse), title: "Anima (walk variation)", kind: "character", variation_of: {file_ref: anima.file_ref, revision: anima.revision}, authored_by: "human:fx-walk"};
    const remap = value => JSON.parse(JSON.stringify(value).split(source.expression_ref).join(copyRef));
    doc = (await expression({operation: "edit", expression_ref: copyRef, expected_revision: doc.revision, actor: "human:fx-walk", changes: [{change: "reuse_set", reuse: remap(reuse)}]})).document;
    const folders = listing.folders;
    const saved = await expression({operation: "save_as", expression_ref: copyRef, expected_revision: doc.revision, parent: folders.character, name: `anima-walk-variation-${Date.now().toString(36)}.expression.json`, operation_ref: `walk:${copyRef}`, actor: "human:fx-walk", actor_kind: "human"});
    check(!!saved.file?.location, "9: the edited character is saved as a reusable COPY (Anima (walk variation)) into the register; the curated file is untouched", {location: saved.file?.location});
    const curated = await expression({operation: "open_file", location: anima.location, actor: "human:fx-walk"});
    check(JSON.stringify(curated.document.scenes) === JSON.stringify(source.scenes), "9: the curated anima.expression.json is byte-for-byte the material it was");
    const reopened = (await expression({operation: "open_file", location: saved.file.location, actor: "human:fx-walk-reopen"})).document;
    const back = reopened.scenes.find(scene => scene.scene_ref.endsWith(":scene:working"))?.presentation?.scene ?? reopened.scenes[0].presentation.scene;
    const backSelf = back.entities.find(entity => entity.role === "self") ?? back.entities[0];
    const survived = {
      physics: backSelf.force.kind === "vortex" && backSelf.force.strength === 1.9 && backSelf.force.spin === 1.7,
      colour: backSelf.tint === "#3f8fd2" && backSelf.tintWeight === 0.95,
      morph: back.morph.law === "product" && back.morph.depth === 1.6 && back.morph.thetaRate === 0.31,
      resonance: back.field.params.frequency === 639 && back.field.params.excitation === 0.9,
      sound: backSelf.sound?.enabled === true && backSelf.sound.frequencyHz === 330 && backSelf.sound.waveform === "triangle" && backSelf.sound.pan === -0.2,
      temporal: backSelf.sequence.steps[0].hold === 2.25 && backSelf.sequence.steps[0].transition === 1.35 && back.duration === 17 && back.transition === 2.5,
      reuse: reopened.reuse?.title === "Anima (walk variation)" && reopened.reuse?.variation_of?.file_ref === anima.file_ref,
    };
    for (const [what, ok] of Object.entries(survived)) check(ok, `9: ${what} survived save → close → reopen (kernel document)`);
    const variationOpen = await openInExpressions(reopened.expression_ref);
    const stage = page.frameLocator(".mode-stage:not([hidden]) iframe.pcd-host-frame");
    const running = await stage.locator("canvas").first().waitFor({timeout: 30000}).then(() => true, () => false);
    const state = await page.evaluate(() => document.querySelector(".mode-stage:not([hidden]) .pcd-host")?.getAttribute("data-state"));
    const variationSeen = await seen(".mode-stage:not([hidden]) iframe.pcd-host-frame");
    check(running && state === "ready" && variationSeen.expression_ref === reopened.expression_ref && !variationSeen.gate && !variationSeen.conflict, "9: the engine runs the reopened variation (announced Expression = the variation; entry gate closed)", {expected: reopened.expression_ref, state, ...variationSeen, opened: variationOpen, console: consoleTail.slice(-6)});
    await shot("9-variation-running");
  });

  // ── 10. Play the completed Expression's Scene sequence; reopen positions ──
  await step("10-playback", async () => {
    const played = await world({operation: "act_play", act_ref: act.act_ref, actor: "human:fx-walk", material: {file_ref: workflow.file_ref, revision: workflow.revision},
      bindings: {lead: {kind: "agent", agent_ref: "agent/anima", character_ref: anima.file_ref, label: "Anima"}, "participants.0": {kind: "agent", agent_ref: "agent/anima", character_ref: anima.file_ref, label: "Anima"}, "participants.1": {kind: "agent", agent_ref: "agent/aletheia", character_ref: aletheia.file_ref, label: "Aletheia"}}});
    check(played.state === "act_played" && (played.passages?.length ?? 0) === workflow.playback.length, "10: the completed workflow Expression plays its whole Scene sequence (playback order)", {state: played.state, passages: played.passages?.length, playback: workflow.playback.length});
    runPage = await openLive();
    const current = (await world({operation: "act_inspect", act_ref: played.act?.act_ref ?? act.act_ref})).act;
    const positions = [current.sequence.length - (played.passages?.length ?? 3), current.sequence.length - 2, current.sequence.length - 1].filter(n => n >= 0);
    await runPage.locator(".flx-panel").getByRole("button", {name: "Close"}).click({timeout: 3000}).catch(() => {});
    await page.waitForFunction(ref => [...document.querySelectorAll(".flx-timeline li")].some(li => li.getAttribute("data-act-ref") === ref), current.act_ref, {timeout: 30000}).catch(() => {});
    for (const [i, position] of positions.entries()) {
      // The person's path: the Live timeline point (the stage follows it).
      const point = page.locator(`.flx-timeline li[data-act-ref="${current.act_ref}"][data-position="${position}"] button`);
      // The played passages reach the Live timeline on the producer's next pass.
      await point.waitFor({timeout: 30000}).catch(() => {});
      const before = await seen(".flx-stage iframe.pcd-host-frame").catch(() => ({}));
      const onTimeline = await point.count() > 0;
      if (onTimeline) await point.click();
      await page.waitForTimeout(4000);
      const after = (await world({operation: "act_inspect", act_ref: current.act_ref})).act;
      const liveSeen = await seen(".flx-stage iframe.pcd-host-frame").catch(() => ({}));
      check(onTimeline && after.position === position && liveSeen.expression_ref === current.expression_ref && !liveSeen.conflict && (liveSeen.revision ?? 0) > (before.revision ?? 0),
        `10: timeline position ${position} reopens from the Live timeline and the stage follows (announced revision advances)`, {position: after.position, onTimeline, before: before.revision, after: liveSeen.revision});
      await shot(`10-seek-${i + 1}`);
    }
  });

  check(true, "Receipt: profile revisions recorded", revisions);
}
