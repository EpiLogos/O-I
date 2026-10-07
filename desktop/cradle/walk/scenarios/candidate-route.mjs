#!/usr/bin/env node
// The CANDIDATE route, end to end, against the real Central ground: `scripts/candidate-launch.mjs --mode web --worlds-root …`
// (the real Cradle on vite, the kernel as the loopback walk bridge, the essay read from the INSTALLED World through the kernel — no edition
// server, no edition address), driven as a person would: first-run welcome, "Choose a corpus" listing the real projects, the Epi-Logos lens on,
// the packaged essay, a relation selected and opened as a tangent, an Expression played from the packaged renderer.
//
//   OI_WORLDS_ROOT=<root with the installed World> (default ~/.oi-candidates/worlds)  [OI_CANDIDATE_BIN=<oi>]  [FIELD_BRIDGE_BIN=<walk-bridge>]
//   node walk/scenarios/candidate-route.mjs [--url http://127.0.0.1:PORT/ --bridge http://127.0.0.1:PORT]   (default: launch the candidate itself)
//   OI_WALK_REAL_PROVIDER=1 node walk/scenarios/candidate-route.mjs --turn      ONE real companion turn on top (receipt: candidate-companion.json): the panel provisions the
//        Prime-QL body from the candidate's own AIKit home, Redis-prepared NOW context electing the live Kev is delivered, and `encounter-use` shows QL operations
//        + Kev + Redis. The model key comes only from this environment (ZAI_API_KEY); no retries.
//
// It launches the candidate with its own free ports and stops exactly the processes it started (the launcher's pid; the launcher stops its bridge
// and vite). The real ground is read, and the AIKit/Central state the field touches is the candidate profile's; nothing is written to the ground.
// Receipt: walk/artifacts/candidate-route.json (grade A: the real ground, the installed World, the real kernel).
import {execFileSync, spawn, spawnSync} from "node:child_process";
import {createServer} from "node:net";
import {existsSync, readFileSync} from "node:fs";
import {homedir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";
import {shotPath, writeReceipt} from "../lib/field-walk.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cradle = resolve(here, "../..");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const worldsRoot = process.env.OI_WORLDS_ROOT ?? join(homedir(), ".oi-candidates/worlds");
const turn = argv.includes("--turn");
const ground = resolve(process.env.OI_CENTRAL_ROOT ?? join(homedir(), "Central"));
const aikitHome = join(homedir(), ".oi-candidates/central-field/aikit-home");
const checks = [];
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 300) : ""}`); };
const freePort = () => new Promise((res, rej) => { const s = createServer(); s.listen(0, "127.0.0.1", () => { const {port} = s.address(); s.close(() => res(port)); }); s.on("error", rej); });
const waitHttp = async (url, label, ms = 60000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if ((await fetch(url)).ok) return; } catch { /* not yet */ } await new Promise(r => setTimeout(r, 250)); } throw new Error(`${label} did not answer at ${url}`); };

let launcherLog = "";
let launcher = null, appUrl = arg("url"), bridgeUrl = arg("bridge");
const record = {scenario: turn ? "candidate-companion" : "candidate-route", spec_ref: "docs/cradle/CENTRAL-FIELD-WORLD-PACKAGE.md §5 and scripts/candidate-launch.mjs (the owner's candidate route)", grade: "A", at: new Date().toISOString(), worlds_root: worldsRoot};
let browser, page, failed = false;
try {
  if (!appUrl) {
    if (!existsSync(join(worldsRoot, "epi-logos/confronting-the-limit/current.json"))) throw new Error(`no installed World under ${worldsRoot} (install one with site/essay-world.mjs install)`);
    const bridgePort = await freePort(), vitePort = await freePort();
    const args = [join(cradle, "scripts/candidate-launch.mjs"), "--mode", "web", "--worlds-root", worldsRoot, "--bridge-port", String(bridgePort), "--vite-port", String(vitePort), "--no-open"];
    if (process.env.OI_CANDIDATE_BIN) args.push("--oi", process.env.OI_CANDIDATE_BIN);
    launcher = spawn(process.execPath, args, {cwd: cradle, env: process.env, stdio: ["ignore", "pipe", "pipe"]});
    let log = ""; const take = d => { log += d; launcherLog += d; }; launcher.stdout.on("data", take); launcher.stderr.on("data", take);
    appUrl = `http://127.0.0.1:${vitePort}/`; bridgeUrl = `http://127.0.0.1:${bridgePort}`;
    await waitHttp(appUrl, "the Cradle dev server"); await waitHttp(`${bridgeUrl}/state`, "the kernel bridge");
    record.launch = {pid: launcher.pid, args: args.slice(1), app: appUrl, bridge: bridgeUrl, edition_server: /essay edition/.test(log) ? "started (unexpected)" : "none"};
    check(/installed under .*no edition server/.test(log) && !/essay edition\s+http/.test(log), "the candidate launched with the installed World and no edition server", log.split("\n").filter(l => /candidate:/.test(l)).slice(0, 3));
  }
  const system = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const executablePath = process.env.OI_CHROMIUM ?? (existsSync(chromium.executablePath()) ? undefined : existsSync(system) ? system : undefined);
  browser = await chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}});   // a fresh profile: nothing stored, so the first-run welcome is real
  // the one thing a walk adds: the read-only observation attribute the field exposes for walks (`data-encounter`); no storage, no edition, no bridge address
  await context.addInitScript(() => { try { window.__OI_FIELD_PROBE__ = true; } catch { /* opaque frame */ } });
  page = await context.newPage();
  const errors = [], responses = [], failures = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 240)); });
  page.on("response", r => responses.push({url: r.url(), status: r.status()}));
  page.on("requestfailed", r => failures.push({url: r.url().slice(0, 140), error: r.failure()?.errorText}));
  const settle = ms => page.waitForTimeout(ms);
  await page.goto(appUrl);
  await page.waitForSelector(".desktop-shell", {timeout: 60000});

  // 0 — first run: the welcome is real, and one click dismisses it
  const welcome = page.locator(".oi-welcome");
  check(await welcome.count() > 0, "a fresh profile shows the first-run welcome over the shell");
  await welcome.first().click({force: true});
  const gone = await page.waitForFunction(() => !document.querySelector(".oi-welcome"), null, {timeout: 15000}).then(() => true, () => false);
  check(gone, "one click dismisses the welcome (it fades out and leaves the shell)");

  // 1 — the field on the REAL ground: nothing is linked yet, and it says so, with the real projects to choose from
  await page.waitForSelector(".field-root", {timeout: 60000});
  await page.waitForFunction(() => /Choose a corpus/.test(document.querySelector(".field-root")?.innerText ?? ""), null, {timeout: 120000});
  const choose = await page.locator(".field-root").innerText();
  const projects = ["ACTUATION", "CENTRAL", "FACTORY", "O-I", "QUATERNAL-LOGIC", "AI-KIT"].filter(p => choose.toUpperCase().includes(p));
  check(/NOT CONNECTED/i.test(choose) && projects.length >= 4, "the field opens on 'Choose a corpus', listing the real ground's projects", projects);
  check(await page.locator('.futil__btn[data-util="scope"]').isVisible(), "the utility bar is there (scope, modes, companion, settings)", await page.evaluate(() => [...document.querySelectorAll("[data-util]")].map(e => e.getAttribute("data-util"))));
  await page.screenshot({path: shotPath("candidate-route-01-choose.png")});
  // the scope menu is how a person chooses a project from here: every item must be reachable (it used to open upward past the top of a short window)
  await page.locator('.futil__btn[data-util="scope"]').click(); await settle(300);
  const menuItems = await page.evaluate(() => [...document.querySelectorAll('.futil__menu[aria-label="Scope"] .futil__item')].map(e => { const r = e.getBoundingClientRect(); return {t: e.textContent.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom)}; }));
  const reachable = menuItems.length > 8 && menuItems.every(i => i.top >= 0 && i.bottom <= 900);
  check(reachable, "the scope menu opens with every item inside the window (Central, the projects, the Epi-Logos world)", {items: menuItems.length, first: menuItems[0], last: menuItems.at(-1)});
  if (turn) {
    await page.locator('.futil__menu[aria-label="Scope"] .futil__item', {hasText: /^O-I$/}).click(); await settle(2500);
    check(await page.locator('.futil__btn[data-util="scope"]').getAttribute("aria-label").then(l => /O-I/.test(l ?? "")), "the O-I project (which holds the essay) is the scope: the companion's conversation will belong to it");
  } else await page.keyboard.press("Escape");

  // 2 — the Epi-Logos lens on: the footer lens is revealed from the bottom edge (hover), then pressed
  const lens = page.locator('button[aria-label="Epi-Logos lens"]');
  await page.locator(".workspace-footer-edge").hover(); await settle(300);
  await lens.click({force: true});
  check(await page.locator(".left-lens-chip").count() > 0 && (await lens.getAttribute("aria-pressed")) === "true", "the Epi-Logos lens is on (the chip is shown, the lens is pressed)");
  // "Opening the field…" is the loading state and carries the same title class as the essay: wait for the essay itself
  const t0 = Date.now();
  await page.waitForFunction(() => { const h = document.querySelector(".field-root .ahead__title"); return h && !/^Opening the field/.test(h.textContent ?? "") && document.querySelectorAll(".graph-svg .gn").length > 0; }, null, {timeout: 180000});
  const openedMs = Date.now() - t0;
  const title = await page.locator(".field-root .ahead__title").first().innerText();
  const nodes = await page.locator(".graph-svg .gn").count();
  check(/Confronting the Limit/.test(title) && nodes > 0, "the packaged essay appears: its title and its graph", {title: title.slice(0, 90), graph_nodes: nodes, opened_after_ms: openedMs});
  await settle(1500);
  await page.screenshot({path: shotPath("candidate-route-02-essay.png")});

  // 3 — the manuscript at M16, a relation selected and opened as a tangent
  const search = page.getByRole("searchbox", {name: "Search"});
  await search.fill("The Return of Zero"); await settle(300); await search.press("Shift+Enter");
  await page.waitForFunction(() => document.querySelector(".article.fpane:not([hidden]) .ahead__eyebrow")?.textContent?.includes("Manuscript"), null, {timeout: 90000});
  await search.fill("");
  await page.locator(".mrail__t[data-span='M16']").click({force: true});
  await page.waitForFunction(() => document.querySelector(".field-root")?.getAttribute("data-encounter")?.includes('"span":"M16"'), null, {timeout: 60000});
  await settle(800);
  const enc = async () => JSON.parse(await page.locator(".field-root").getAttribute("data-encounter"));
  const e0 = await enc();
  check(/^central:source:project:Antykathera-Essay-Work:submission-package\/essay\//.test(e0.primary.ref) && e0.primary.span === "M16", "the field stands at M16, addressed by the World's native refs", {ref: e0.primary.ref, span: e0.primary.span});
  const clickNode = async ref => { const b = await page.locator(`.graph-svg .gn[data-ref="${ref}"] circle.hit`).first().boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const rel = await page.evaluate(() => [...document.querySelectorAll(".conn__g li[data-ref]")].map(l => l.dataset.ref).find(r => /\/arguments\//.test(decodeURIComponent(r)) && !/README/.test(decodeURIComponent(r))));
  const at = await clickNode(rel); await settle(400);
  const eSel = await enc();
  check(eSel.selected === rel && eSel.primary.span === "M16", "selecting a relation selects it without leaving the passage", {selected: eSel.selected?.split(":").pop().slice(-60)});
  await page.mouse.dblclick(...at);
  await page.waitForFunction(r => { try { return JSON.parse(document.querySelector(".field-root").getAttribute("data-encounter")).tangent?.ref === r; } catch { return false; } }, rel, {timeout: 60000}); await settle(800);
  const eT = await enc();
  const tangentBody = await page.locator(".article.fpane:not([hidden])").first().innerText().catch(() => "");
  check(eT.tangent?.ref === rel && eT.primary.span === "M16", "double-click opens the relation as a tangent beside the passage", {tangent: rel.split("/").pop(), generation: eT.generation});
  await page.screenshot({path: shotPath("candidate-route-03-tangent.png")});

  // 4 — an Expression, from the Library as the tangent with its scene, played by the renderer the World carries
  await page.getByRole("button", {name: /Library/}).first().click(); await settle(800);
  await page.waitForSelector(".library .xcard", {timeout: 60000});
  await page.locator(".xcolls button", {hasText: /^Here/}).click(); await settle(500);
  const card = page.locator('.library .xcard[data-x="expression:roz-room-02-return-of-zero"]');
  await card.locator(".xchip-s").nth(2).click();
  await page.waitForSelector("iframe.xframe", {timeout: 60000}); await settle(3500);
  const eX = await enc();
  check(eX.tangent?.kind === "expression" && eX.tangent.ref === "expression:roz-room-02-return-of-zero" && !!eX.scene?.scene_id, "an Expression opened as the tangent with its scene", {ref: eX.tangent?.ref, scene: eX.scene?.scene_id});
  const frame = page.frames().find(fr => /\/renderer\/expression\.html/.test(fr.url()));
  check(!!frame && frame.url().startsWith(`${bridgeUrl}/world/`) && /[?&]x=roz-room-02-return-of-zero/.test(frame.url()), "the frame is the packaged renderer, served by the bridge's /world/ route", frame?.url().replace(bridgeUrl, ""));
  const playing = frame ? await frame.evaluate(() => ({text: document.body.innerText.length, state: document.querySelector("[data-state]")?.getAttribute("data-state") ?? null, canvas: document.querySelectorAll("canvas").length})).catch(() => null) : null;
  check(playing && playing.text > 40 && playing.state === "ready" && playing.canvas > 0, "the Expression plays (state ready: the body was checked against the index digest)", playing);
  await page.screenshot({path: shotPath("candidate-route-04-expression.png")});


  // 6 — ONE real companion turn (opt-in: it spends plan quota)
  if (turn) {
    if (process.env.OI_WALK_REAL_PROVIDER !== "1") throw new Error("--turn spends plan quota: set OI_WALK_REAL_PROVIDER=1");
    const prime = JSON.parse(readFileSync(join(homedir(), ".prime/agent/settings.json"), "utf8"));
    if (prime.defaultProvider !== "zai" || prime.defaultModel !== "glm-5.3-flash") throw new Error(`refusing: Prime's configured model is ${prime.defaultProvider}/${prime.defaultModel}, not the walk law's zai/glm-5.3-flash`);
    record.model = {provider: prime.defaultProvider, model: prime.defaultModel, source: "~/.prime/agent/settings.json"};
    const aikit = join(homedir(), ".oi-candidates/central-field/aikit-bin/aikit");   // the verified copy the profile froze (the shared cargo target is not trusted)
    const projectDir = join(ground, "Work", "O-I");
    const turnEnv = {...process.env, AIKIT_HOME: aikitHome, OI_CENTRAL_ROOT: ground};
    const native = (...p) => JSON.parse(execFileSync(aikit, ["--json", "session-space", "-C", projectDir, ...p], {encoding: "utf8", env: turnEnv, maxBuffer: 64 * 1024 * 1024}));
    const BODY = "agent-body/epi-prime-ql";
    const spec = JSON.parse(readFileSync(join(cradle, "tests/fixtures/prime-kev-redis/candidates.json"), "utf8"));
    const kevAddress = JSON.parse(readFileSync(join(aikitHome, "decision-provider.json"), "utf8")).address;
    const kevRequests = async () => (await (await fetch(`http://${kevAddress}/v1/models`, {signal: AbortSignal.timeout(4000)})).json()).models?.find(m => m.name === "kev-latest")?.batches?.requests ?? null;
    const kevBefore = await kevRequests();
    const provisionOps = [];
    page.on("request", r => { if (r.url().endsWith("/op")) { try { const b = r.postDataJSON(); if (b?.op === "encounter_provision") provisionOps.push({project: b.project, preferred_body_ref: b.preferred_body_ref}); } catch { /* not json */ } } });
    // the companion's context: the person's choice about the field is "present, not prepared" until they ask for it to follow them
    await page.locator('.futil [data-util="companion"]').click();
    await page.locator('.futil__menu[aria-label="Companion"] .futil__item', {hasText: "Follows the active locus"}).click(); await settle(300);
    await page.keyboard.press("Escape"); await settle(500);
    await page.getByRole("button", {name: "Toggle right region"}).click(); await settle(800);
    const panel = page.locator('[data-region="right"]');
    const message = panel.getByRole("textbox", {name: "Message", exact: true});
    await message.waitFor({timeout: 60000});
    check(/First send opens it in O-I/.test(await panel.innerText()), "the panel says where the first send opens the conversation: in O-I");
    await message.fill(spec.message);
    await page.waitForFunction(() => !document.querySelector(".agent-chat .chat-send")?.disabled, undefined, {timeout: 60000});
    await panel.getByRole("button", {name: "Send", exact: true}).click();
    await page.waitForFunction(() => !!document.querySelector(".agent-layer")?.dataset.agentSessionRef, null, {timeout: 180000});
    const ref = await page.evaluate(() => document.querySelector(".agent-layer")?.dataset.agentSessionRef);
    record.agent_session = ref;
    check(provisionOps.length === 1 && provisionOps[0].project === "O-I" && provisionOps[0].preferred_body_ref === BODY, "the panel's provision asked for the Epi-Logos Prime-QL body (the lens selects it)", provisionOps);
    const request = (action, fields = {}) => { const r = native("encounter", "--request-json", JSON.stringify({action, agent_session: ref, ...fields})); if (r.ok === false) throw new Error(JSON.stringify(r)); return r.data; };
    const status = request("status");
    const row = JSON.parse(readFileSync(join(aikitHome, "state/encounter-providers/epi-prime-ql.json"), "utf8"));
    check(status.provider?.id === "epi-prime-ql" && status.provider?.body_ref === BODY && row.argv.includes("--extension") && row.argv.includes("--installation") && !row.argv.includes("--no-extensions"), "the conversation runs on the candidate home's Prime-QL row: new launcher, explicit extension, verified installation", {id: status.provider?.id, body_revision: status.provider?.body_revision, launcher: row.argv[0].replace(homedir(), "~")});
    record.provider = {id: status.provider?.id, body_ref: status.provider?.body_ref, body_revision: status.provider?.body_revision, native_session_id: status.native_session_id};
    // the turn is over when the journal says so (the model does not always write the closing marker it was asked for)
    const readTurn = () => { const r = spawnSync(aikit, ["session-space", "-C", projectDir, "encounter-use", "--agent-session", ref], {encoding: "utf8", env: turnEnv, maxBuffer: 64 * 1024 * 1024}); try { return JSON.parse(r.stdout)?.turn?.outcome ?? null; } catch { return null; } };
    const turnDeadline = Date.now() + 25 * 60 * 1000;
    let outcome = null;
    while (Date.now() < turnDeadline) { await settle(20000); outcome = readTurn(); if (outcome && outcome !== "open") break; }
    record.turn_outcome = outcome;
    await settle(2500);
    await page.screenshot({path: shotPath("candidate-companion-turn.png")});
    record.chat_tail = (await panel.innerText()).slice(-2400);
    const events = request("read", {after: 0, limit: 4000}).events.map(r => r.event);
    const userText = JSON.stringify(events.find(e => e?.kind === "user-message") ?? {});
    check(/field-encounter|field generation/.test(userText), "the delivered turn carried the field's own item (the reader's place), through the prepared-context seam", {chars: userText.length});
    const use = spawnSync(aikit, ["session-space", "-C", projectDir, "encounter-use", "--agent-session", ref, "--faculty-config", join(aikitHome, "faculty/faculty.json"), "--redis-config", join(aikitHome, "services/redis-now/redis-now.json")], {encoding: "utf8", env: turnEnv, maxBuffer: 64 * 1024 * 1024});
    record.encounter_use = {exit: use.status, raw: use.stdout || use.stderr};
    console.log("---- encounter-use (raw) ----\n" + record.encounter_use.raw + "\n---- end ----");
    let reading = null; try { reading = JSON.parse(use.stdout); } catch { /* raw kept */ }
    const delivered = reading?.prepared_context?.delivered ?? [], receipt = delivered[0]?.receipt, faculty = reading?.ql_operations ?? {};
    check(reading?.prepared_context?.state === "delivered" && (reading?.prepared_context?.degraded ?? []).length === 0, "Redis-prepared NOW context was delivered to the turn, with no degradation", reading?.prepared_context?.state);
    check(receipt?.participant_ref === "agent/o-i-chat" && !!receipt?.jev_invocation_ref && !!receipt?.decision_provider, "the delivery names the Kev decision invocation and provider identity behind the view", {participant: receipt?.participant_ref, invocation: receipt?.jev_invocation_ref});
    check(reading?.decision?.selection_readback?.read === true && reading.decision.selection_readback.view_is_the_delivered_one === true && (reading.decision.selection_readback.selected_source_refs ?? []).length > 0, "the Redis readback is the delivered view and lists the sources Kev selected", reading?.decision?.selection_readback?.selected_source_refs?.length);
    const kevAfter = await kevRequests();
    check((kevAfter ?? -1) > (kevBefore ?? 1e9), "Kev's own counters moved", {before: kevBefore, after: kevAfter});
    const qlCalls = (faculty.tool_calls ?? []).length + (faculty.python_faculty_calls ?? []).length;
    check(qlCalls > 0 && (faculty.faculty_receipts ?? []).length > 0 && (faculty.faculty_receipts ?? []).every(r => r.success === true), "the body made QL operations and the owner filed their faculty receipts (all successful)", {tool_calls: (faculty.tool_calls ?? []).map(c => c.tool), python: (faculty.python_faculty_calls ?? []).map(c => c.function), receipts: (faculty.faculty_receipts ?? []).map(r => `${r.operation}:${r.success}`)});
    const all = await panel.innerText();
    record.done_marker_seen = all.includes(spec.done_marker);
    check(!!outcome && outcome !== "open" && all.length > 400, "the turn ended (the journal says so) with the assistant's answer in the panel", {outcome, done_marker_seen: record.done_marker_seen});
  }

  // 5 — where every byte of the essay came from, and what went wrong on the way
  const world = responses.filter(r => r.url.startsWith(`${bridgeUrl}/world/`));
  const foreign = responses.filter(r => !r.url.startsWith(appUrl) && !r.url.startsWith(bridgeUrl) && !/^(data|blob):/.test(r.url));
  const essayBytes = world.filter(r => /\/edition\/|\/renderer\//.test(r.url));
  const has = part => essayBytes.some(r => r.url.includes(part) && r.status === 200);
  check(essayBytes.length > 0 && essayBytes.every(r => r.status === 200) && ["/edition/static/fieldIndex.json", "/edition/quartz-source.json", "/edition/expressions/index.json", "/edition/THE-RETURN-OF-ZERO.html", "/renderer/expression.html", "/edition/expressions/x/roz-room-02-return-of-zero.journey.json"].every(has), "every edition and renderer request went to the bridge's /world/ route and was served (index, receipt, pages, renderer, journey)", {requests: essayBytes.length, statuses: [...new Set(essayBytes.map(r => r.status))]});
  check(foreign.length === 0, "nothing was requested from any other host (no edition server, no edition address)", foreign.slice(0, 3));
  // Chrome aborts in-flight requests with ERR_NETWORK_CHANGED whenever this Mac's network state changes under it (observed here with no change of
  // ours, more often while other browsers run). That is the browser's report about the machine, not a page error: it is counted and shown, not hidden,
  // and every check above passed regardless; any other error fails the walk.
  const aborted = errors.filter(m => /ERR_NETWORK_CHANGED/.test(m));
  const errs = errors.filter(m => !/favicon|ERR_NETWORK_CHANGED/.test(m));
  check(errs.length === 0, `no page or console errors (${aborted.length} request(s) aborted by the browser's ERR_NETWORK_CHANGED are counted separately)`, errs.slice(0, 4));
  record.network_changed_aborts = {console_errors: aborted.length, failed_requests: failures.filter(f => /ERR_NETWORK_CHANGED/.test(f.error ?? "")).length};
  record.requests = {world: world.length, sample: world.slice(0, 4).map(r => r.url.replace(bridgeUrl, "")), failed: failures.slice(0, 5)};
  record.projects = projects;
} catch (error) {
  failed = true; await page?.screenshot?.({path: shotPath("candidate-route-failure.png")}).catch(() => {});
  check(false, "the walk ran to its end", String(error?.stack ?? error).split("\n").slice(0, 5).join(" | "));
} finally {
  try { await browser?.close(); } catch { /* gone */ }
  let stopped = null;
  if (launcher) { launcher.kill("SIGTERM"); await new Promise(r => setTimeout(r, 2500)); stopped = launcher.exitCode !== null || launcher.killed; }
  const passed = checks.filter(c => c.ok).length;
  if (failed || checks.some(c => !c.ok)) record.launcher_log_tail = launcherLog.split("\n").filter(l => !/GET \/(state|events)/.test(l)).slice(-40);
  writeReceipt(turn ? "candidate-companion.json" : "candidate-route.json", {...record, launcher_stopped: stopped, passed: passed === checks.length && !failed, counts: {passed, total: checks.length}, checks});
  console.log(`\n${passed}/${checks.length} checks passed`);
  process.exit(passed === checks.length && !failed ? 0 : 1);
}
