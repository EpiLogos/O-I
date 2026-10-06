#!/usr/bin/env node
// The actual companion in the encounter. From the field (Epi world, the essay at M16) with a relation selected and a
// tangent open, ONE real turn goes through the Cradle's own encounter path (composer → reviewedContext → AIKit
// prompt-context → the pinned pi/GLM-flash provider), and the walk reads the owner's records to show:
//   - the delivered prepared context carries the field item (primary@revision, tangent, selected, generation);
//   - a selection made while that turn is in flight changes the NEXT turn's basis and leaves the in-flight one as it was.
//
// A real turn spends the owner's plan quota, so it is opt-in (OI_WALK_REAL_PROVIDER=1; model pinned in lib/walk-provider.mjs,
// never inherited). Without it every step up to the send runs and the send phases are reported SKIPPED, not passed.
//   OI_AIKIT_BIN=$(which aikit) FIELD_SITE_ROOT=<site root> [OI_WALK_REAL_PROVIDER=1] node walk/scenarios/field-companion-turn.mjs
import {execFileSync} from "node:child_process";
import {chmodSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {bootField, shotPath, writeReceipt} from "../lib/field-walk.mjs";
import {realProviderAuthorised, walkPiArgv, REAL_PROVIDER_SKIP_NOTE} from "../lib/walk-provider.mjs";

const checks = [], skipped = [], record = {};
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 260) : ""}`); return !!ok; };
const skip = label => { skipped.push(label); console.log(`SKIP — ${label}`); };
const aikit = process.env.OI_AIKIT_BIN;
if (!aikit) { console.error("OI_AIKIT_BIN must name the native AIKit"); process.exit(2); }
const real = realProviderAuthorised();
const fixture = fileURLToPath(new URL("../../tests/fixtures/field-corpus/", import.meta.url));

const SPACE = "session-space/field-turn", SESSION = "agent-session/field-turn", PURPOSE = "Field encounter turn", PROVIDER = "Field walk Pi (GLM flash)";
let native, request;
const provision = async ({root, home, projectRoot}) => {
  const router = join(root, "oi-owner-router.mjs");
  writeFileSync(router, `#!/usr/bin/env node\nimport {spawnSync} from "node:child_process";\nconst args = process.argv.slice(2);\nif (args[0] === "aikit") { const c = spawnSync(${JSON.stringify(aikit)}, args.slice(1), {stdio: "inherit"}); process.exit(c.status ?? 1); }\nconst c = spawnSync("oi", args, {stdio: "inherit"}); process.exit(c.status ?? 1);\n`); chmodSync(router, 0o755);
  const env = {...process.env, OI_CENTRAL_ROOT: root, OI_HOME: home, OI_CENTRAL_PROJECT_QUERY: "Field", AIKIT_HOME: join(root, ".aikit-home"), OI_AIKIT_BIN: aikit, OI_BIN: router};
  native = (...p) => JSON.parse(execFileSync(aikit, ["--json", "session-space", "-C", projectRoot, ...p], {encoding: "utf8", env}));
  const bind = JSON.parse(execFileSync(aikit, ["--json", "-C", projectRoot, "project", "bind", "field-walk", "--directory", projectRoot, "--no-default-skill-sets"], {encoding: "utf8", env}));
  if (!bind.ok) throw new Error(JSON.stringify(bind));
  const apply = preview => native("apply", "--preview-json", JSON.stringify(preview));
  apply(native("create", SPACE, "--label", "Field turn"));
  for (const intent of [{operation: "bind-project-context", binding: native("project-context")}, {operation: "attach-agent-session", attachment: {agent_session: SESSION, purpose: PURPOSE, provenance: ["field-companion-turn walk"]}}]) apply(native("stage", "--space", SPACE, "--intent-json", JSON.stringify(intent)));
  native("encounter-configure", "--provider-json", JSON.stringify({protocol: "pi-rpc", id: "field-walk-pi", label: PROVIDER, argv: walkPiArgv()}));
  const owner = native("encounter-start");
  if (!owner.ok) throw new Error(JSON.stringify(owner));
  request = (action, fields = {}) => { const r = native("encounter", "--request-json", JSON.stringify({action, agent_session: SESSION, ...fields})); if (!r.ok) throw new Error(JSON.stringify(r)); return r.data; };
  request("draft", {basis: 0, text: ""});
  return {env, cleanup: () => { try { process.kill(-owner.data.pid, "SIGTERM"); } catch { /* gone */ } }};
};

const f = await bootField({epi: false, provision, fixture});
const {page} = f;
const settle = ms => page.waitForTimeout(ms);
const enc = async () => JSON.parse(await page.locator(".field-root").getAttribute("data-encounter"));
const sends = [];
page.on("request", r => { if (!r.url().endsWith("/op")) return; try { const b = r.postDataJSON(); const q = b?.request; if (q?.action === "prompt-context") sends.push({t: Date.now(), context: q.context, draft_revision: q.draft_revision}); } catch { /* not a prompt */ } });
const contextRead = () => request("context", {request: {scope: {project: "field-walk", agent_session: SESSION}, request: {operation: "read"}}});
const fieldItems = ctx => ctx.items.filter(i => i.selection.anchor.kind === "observation" && i.selection.anchor.role === "field-encounter");
const gen = item => Number(/#(\d+)$/.exec(item.selection.anchor.selector)[1]);
let failed = false;
try {
  // 0 — scope: the linked project (the companion's conversation belongs to it); the field reads it, Epi world off
  await page.locator('.futil [data-util="scope"]').click();
  await page.locator('.futil__menu[aria-label="Scope"] .futil__item', {hasText: "Field"}).click();
  await page.waitForSelector(".article.fpane:not([hidden]) .ahead__title", {timeout: 60000});
  // 1 — the companion is bound to the session: the window's left navigator (folded in the field default) opens the conversation in the panel
  await page.getByRole("button", {name: "Toggle left region"}).click(); await settle(600);
  const nav = page.getByRole("complementary", {name: "World navigator"});
  await nav.locator('[data-project-path="Work/Field"]').click({timeout: 20000}).catch(() => {});
  await page.getByRole("button", {name: PURPOSE, exact: true}).click({timeout: 20000});
  await settle(800);
  await page.getByRole("button", {name: "Toggle left region"}).click(); await settle(500);
  const panel = page.locator('[data-region="right"]');
  // the harness route is opened through the owner's own connect (the panel's chip lists only roster-eligible routes; this walk's
  // pinned pi/GLM-flash route is configured natively, as the canvas-context walk does) — the composer below is the real Cradle one
  const opened = await (await fetch(`${f.bridgeUrl}/op`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({op: "encounter", project: "Field", request: {action: "open", space: SPACE, agent_session: SESSION, provider: "field-walk-pi"}})})).json();
  check(opened.ok, "the owner opened the pinned provider route (the kernel's encounter op, as the panel does)", opened.error ?? opened.outcome?.result);
  await panel.locator('.chat-composer[data-connection="connected"]').waitFor({timeout: 90000});
  check(true, "the companion is bound to a real AIKit session and its provider is connected");
  // the Epi world on (same scope): the field now reads the essay
  await page.locator('.futil [data-util="scope"]').click();
  await page.locator('.futil__menu[aria-label="Scope"] .futil__item', {hasText: "Epi-Logos"}).click();
  await page.waitForSelector(".article.fpane:not([hidden]) .ahead__eyebrow", {timeout: 60000}); await settle(1000);
  check(await panel.locator('.chat-composer[data-connection="connected"]').count() === 1, "the companion stays bound and connected while the field changes world");

  // 2 — the encounter: manuscript at M16, a relation selected, a tangent open
  const search = page.getByRole("searchbox", {name: "Search"});
  await search.fill("The Return of Zero"); await settle(300); await search.press("Shift+Enter");
  await page.waitForFunction(() => document.querySelector(".article.fpane:not([hidden]) .ahead__eyebrow")?.textContent?.includes("Manuscript"), null, {timeout: 60000});
  await search.fill("");
  await page.locator(".mrail__t[data-span='M16']").click({force: true});
  await page.waitForFunction(() => document.querySelector(".field-root")?.getAttribute("data-encounter")?.includes('"span":"M16"'), null, {timeout: 30000});
  await settle(800);
  const rel = await page.evaluate(() => { const li = [...document.querySelectorAll(".conn__g li[data-ref]")].find(l => /\/arguments\//.test(decodeURIComponent(l.dataset.ref)) && !/README/.test(decodeURIComponent(l.dataset.ref))); return li?.dataset.ref; });
  const box = await page.locator(`.graph-svg .gn[data-ref="${rel}"] circle.hit`).first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await settle(400);
  const b2 = await page.locator(`.graph-svg .gn[data-ref="${rel}"] circle.hit`).first().boundingBox();
  await page.mouse.dblclick(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await page.waitForFunction(() => document.querySelectorAll(".ftab").length === 2, null, {timeout: 30000}); await settle(600);
  // select another page's node from the tangent's neighbourhood so selection ≠ tangent
  const sel1 = await page.evaluate(rel0 => [...document.querySelectorAll(".graph-svg .gn[data-ref]")].map(g => g.dataset.ref).find(r => r !== rel0 && !document.querySelector(`.gn--focus[data-ref="${r}"]`)), rel);
  const b3 = await page.locator(`.graph-svg .gn[data-ref="${sel1}"] circle.hit`).first().boundingBox();
  await page.mouse.click(b3.x + b3.width / 2, b3.y + b3.height / 2); await settle(500);
  const e1 = await enc();
  check(e1.primary.span === "M16" && e1.tangent?.ref === rel && e1.selected === sel1, "the field stands at M16 with a tangent open and a different page selected", {gen: e1.generation});
  await page.screenshot({path: shotPath("field-turn-01-encounter-1440.png")});

  // 3 — the field in the companion's context: follows the active locus (from the field's own utility bar)
  await page.locator('.futil [data-util="companion"]').click();
  await page.locator('.futil__menu[aria-label="Companion"] .futil__item', {hasText: "Follows the active locus"}).click(); await settle(300);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => true); await settle(1500);                                    // the keeper settles the prepared context
  let ctx = contextRead(), items = fieldItems(ctx);
  check(items.length === 1 && gen(items[0]) === e1.generation, "AIKit holds the field item at the generation the field stands on", {items: items.length, gen: items[0] && gen(items[0]), live: e1.generation});
  const text1 = items[0]?.selection.text ?? "";
  check(text1.includes(`main: `) && text1.includes(e1.primary.revision) && text1.includes("at M16") && text1.includes(`tangent (page, preview)`) && text1.includes(rel) && text1.includes(`selected: `) && text1.includes(sel1), "it names primary @ revision · M16, the tangent and the selected page", text1.split("\n").slice(0, 5));

  if (!real) { skip(`the real turn and the in-flight/next-turn basis checks — ${REAL_PROVIDER_SKIP_NOTE}`); }
  else {
    // 4 — turn 1: a real send through the composer; change the selection WHILE it is in flight
    const message = panel.getByRole("textbox", {name: "Message", exact: true});
    await message.fill("In one short sentence: what page is the reader on, and what is open beside it?");
    await page.waitForFunction(() => !document.querySelector(".agent-chat .chat-send")?.disabled, undefined, {timeout: 30000});
    await panel.getByRole("button", {name: "Send", exact: true}).click();
    const deadline = Date.now() + 30000; while (!sends.length && Date.now() < deadline) await settle(200);
    check(sends.length === 1, "one prompt-context send went through the encounter path");
    const t1 = sends[0], g1 = e1.generation;
    check(t1.context && t1.context.reviewed?.length >= 1, "the send names the reviewed context (items, revision, digest)", {revision: t1.context?.revision});
    // the in-flight turn: select something else now
    const sel2 = await page.evaluate(refs => [...document.querySelectorAll(".graph-svg .gn[data-ref]")].map(g => g.dataset.ref).find(r => !refs.includes(r)), [rel, sel1]);
    const b4 = await page.locator(`.graph-svg .gn[data-ref="${sel2}"] circle.hit`).first().boundingBox();
    await page.mouse.click(b4.x + b4.width / 2, b4.y + b4.height / 2);
    await settle(2500);
    const e2 = await enc();
    check(e2.generation > g1 && e2.selected === sel2, "a selection made while the turn was in flight advanced the generation", {from: g1, to: e2.generation});
    // the owner's journal: the turn as delivered
    const journal = request("read", {after: 0, limit: 1000});
    const user = journal.events.map(r => r.event).filter(e => e?.kind === "user-message");
    check(user.length >= 1, "the owner's journal records the delivered turn", user.map(u => Object.keys(u)));
    const deliveredIds = new Set(t1.context.reviewed);
    const journalText = JSON.stringify(user[0]);
    const pc = user[0].prepared_context;
    record.deliveredTurn = {prepared_context_keys: pc && typeof pc === "object" ? Object.keys(pc) : typeof pc, digest: pc?.digest, revision: pc?.revision, items: (pc?.items ?? []).map(i => ({id: i.id, title: i.selection?.title, selector: i.selection?.anchor?.selector})), reviewed_by_ui: t1.context.reviewed};
    check(!!pc, "the journal event carries the prepared context it was dispatched with", record.deliveredTurn);
    const carriesGen = journalText.includes(`field-encounter:`) || journalText.includes("field generation");
    check(carriesGen && journalText.includes(`#${g1}`) || journalText.includes(`field generation ${g1}`), "the delivered turn carries the field item at the generation it was prepared against", {g1});
    ctx = contextRead(); items = fieldItems(ctx);
    check(items.length === 1 && gen(items[0]) === e2.generation && !deliveredIds.has(items[0].id), "the live prepared context moved to the new generation (the NEXT turn's basis)", {gen: items[0] && gen(items[0])});
    check(journalText.includes(`field generation ${g1}`) && !journalText.includes(`field generation ${e2.generation}`), "…while the in-flight turn kept the basis it was prepared with", {g1, now: e2.generation});
    // The NEXT turn is not sent (one real turn only, to spare the plan): what it would carry is the owner's live context,
    // already read above at the new generation, and the keeper puts the same reading in front of reviewedContext at send time.
    if (process.env.OI_WALK_SECOND_TURN === "1") {
      await panel.getByRole("button", {name: "Send", exact: true}).waitFor({timeout: 120000}); await settle(3000);
      await message.fill("And now, in one short sentence: which page is selected?");
      await page.waitForFunction(() => !document.querySelector(".agent-chat .chat-send")?.disabled, undefined, {timeout: 30000});
      await panel.getByRole("button", {name: "Send", exact: true}).click();
      const d2 = Date.now() + 30000; while (sends.length < 2 && Date.now() < d2) await settle(200);
      check(sends.length === 2 && JSON.stringify(sends[1].context.reviewed) !== JSON.stringify(sends[0].context.reviewed), "the next turn was dispatched against the new basis", sends.map(s => s.context.reviewed));
    } else skip("the second real send (set OI_WALK_SECOND_TURN=1): the next turn's basis is shown from the owner's live context instead");
  }
} catch (error) {
  failed = true; check(false, "the walk ran to its end", String(error?.stack ?? error).split("\n").slice(0, 5).join(" | "));
  await page.screenshot({path: shotPath("field-turn-failure.png")}).catch(() => {});
} finally {
  const errs = f.errors.filter(m => !/Failed to load resource|favicon/.test(m));
  check(errs.length === 0, "no page or console errors", errs.slice(0, 4));
  const passed = checks.filter(c => c.ok).length;
  writeReceipt("field-companion-turn.json", {scenario: "field-companion-turn", at: new Date().toISOString(), real_turn: real, record, passed: passed === checks.length && !failed, counts: {passed, total: checks.length, skipped: skipped.length}, skipped, checks});
  console.log(`\n${passed}/${checks.length} checks passed${skipped.length ? `, ${skipped.length} skipped` : ""}`);
  await f.dispose();
  process.exit(passed === checks.length && !failed ? 0 : 1);
}
