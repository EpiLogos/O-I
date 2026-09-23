/**
 * Forms create a copy (10-SIDEBARS §3.7, regression §6.1.6) and Factory's
 * INTENT asks for its Goal and Vision in place (ruling D5), on the real
 * kernel with a disposable ground whose Work/O-I holds this checkout's form
 * templates byte-exact.
 *
 *   new tab → Day / Beings    a copy is minted at Central's one first-save
 *                             door (Control/user/flows/<form>-<stamp>.html),
 *                             the tab opens THAT copy, the template's bytes
 *                             are unchanged, the copy differs from the
 *                             template only in its embedded identity
 *   Rest → Card               the Epi-Card carrier is copied the same way
 *   INTENT                    "review" marks the agent-recovered vision;
 *                             "Write one" / "Write it" ask Central to create
 *                             the goal / vision IN PLACE in the project's
 *                             ProjectCentral/user — Central refuses (protected
 *                             ground, no native operation for a new document):
 *                             the refusal is shown beside the row and nothing
 *                             is written anywhere instead. The same refusal is
 *                             read from Central directly (the native gap).
 */
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {existsSync, readFileSync, readdirSync, realpathSync} from "node:fs";
import {join} from "node:path";
import {setup as groundSetup, bindDefaultCentral} from "./left-ground.mjs";

export async function setup(args) { return groundSetup(args); }

const sha = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const QL_DOC = /<script type="application\/json" id="ql-doc">[\s\S]*?<\/script>/;
const withoutDoc = html => html.replace(QL_DOC, "<ql-doc/>");
const docOf = html => JSON.parse(html.match(QL_DOC)[0].replace(/^<script[^>]*>|<\/script>$/g, ""));

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  const opErrors = [];
  page.on("response", async response => {
    if (!response.url().endsWith("/op")) return;
    try { const reply = await response.json(); if (reply.error) opErrors.push({op: response.request().postDataJSON()?.op, body: JSON.stringify(response.request().postDataJSON()).slice(0, 400), error: String(reply.error).slice(0, 300)}); } catch {}
  });
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  const left = page.locator('[data-region="left"]');
  const templates = join(p.root, "Work/O-I/desktop/cradle/documents");
  const templateSha = Object.fromEntries(readdirSync(templates).filter(name => name.endsWith(".html")).map(name => [name, sha(join(templates, name))]));
  // Central admits a first save only in its user-section flows area.
  const documents = () => readdirSync(join(p.root, "Control/user/flows"));
  await page.locator('[data-project-path="Work/Alpha"]').waitFor({timeout: 30000});

  // A pane to hold a new tab: open a file, then the pane's own New tab.
  await left.locator('button[data-file-path="Control/user"]').click();
  await left.locator('button[data-file-path="Control/user/flows"]').click();
  await left.locator('button[data-file-path="Control/user/flows/flow-2026-09-23-0900.html"]').click();
  await page.locator('[data-region="centre"] [role="tab"]').first().waitFor({timeout: 20000});

  const fromNewTab = async (label) => {
    await page.getByRole("button", {name: "New tab"}).first().click();
    const fresh = page.getByRole("region", {name: "New tab"}).last();
    await fresh.waitFor({timeout: 15000});
    await fresh.locator("summary", {hasText: "Project and document forms"}).click();
    await fresh.getByRole("navigation", {name: "Open a document form"}).getByRole("button", {name: new RegExp(`^${label}`)}).click();
  };

  // ---- Day from a new tab: a copy, never the template
  const beforeDocs = documents();
  await fromNewTab("Day");
  try { await page.waitForFunction(() => [...document.querySelectorAll('[data-region="centre"] [role="tab"]')].some(tab => /^day-\d{4}-\d{2}-\d{2}-\d{4}/.test((tab.textContent ?? "").trim())), null, {timeout: 30000}); }
  catch { throw new Error(`no day tab; tabs ${JSON.stringify(await page.locator('[role="tab"]').allInnerTexts())}; fresh ${JSON.stringify(await page.getByRole("region", {name: "New tab"}).allInnerTexts())}; errors ${JSON.stringify(opErrors.slice(-6))}`); }
  const dayCopies = documents().filter(name => !beforeDocs.includes(name) && name.startsWith("day-"));
  const dayCopy = dayCopies.length === 1 ? readFileSync(join(p.root, "Control/user/flows", dayCopies[0]), "utf8") : "";
  const dayTemplate = readFileSync(join(templates, "ql-daily-die.html"), "utf8");
  const dayMeta = dayCopy ? docOf(dayCopy).meta : {};
  const today = new Date(); const pad = n => String(n).padStart(2, "0");
  const localToday = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  check(dayCopies.length === 1 && sha(join(templates, "ql-daily-die.html")) === templateSha["ql-daily-die.html"], "§6.1.6: choosing Day from a new tab mints one copy at Central's first-save door (Control/user/flows/day-<stamp>.html) and leaves the template's bytes unchanged", {dayCopies});
  check(withoutDoc(dayCopy) === withoutDoc(dayTemplate) && typeof dayMeta.uuid === "string" && dayMeta.uuid.length > 10 && dayMeta.date === localToday && docOf(dayTemplate).meta.uuid === null, "§3.7: the copy differs from the template only in its embedded identity (a fresh uuid, today's civil date)", {uuid: dayMeta.uuid, date: dayMeta.date});
  const tabNames = (await page.locator('[data-region="centre"] [role="tab"]').allInnerTexts()).map(text => text.trim());
  check(tabNames.includes(dayCopies[0]) && !tabNames.includes("ql-daily-die.html") && !tabNames.includes("New tab"), "The new tab became the COPY (its own file name) — never the repo template", {tabNames});
  await shot("day-copy");

  // ---- Beings from a new tab
  await fromNewTab("Beings");
  await page.waitForFunction(() => [...document.querySelectorAll('[data-region="centre"] [role="tab"]')].some(tab => /^beings-/.test((tab.textContent ?? "").trim())), null, {timeout: 30000});
  const beings = documents().filter(name => name.startsWith("beings-"));
  const beingsDoc = beings.length === 1 ? docOf(readFileSync(join(p.root, "Control/user/flows", beings[0]), "utf8")) : {meta: {}};
  check(beings.length === 1 && beingsDoc.meta.family === "beings" && typeof beingsDoc.meta.documentId === "string" && sha(join(templates, "oi-beings.html")) === templateSha["oi-beings.html"], "Beings: a copy with its own documentId; the reference carrier is untouched", {beings});

  // ---- Rest → Card: the Epi-Card carrier copied verbatim (it carries no ql-doc identity)
  for (let i = 0; i < 8; i++) {
    const close = page.locator('[data-region="centre"] .warm-tree-host:not([hidden]) button[aria-label^="Close "]').first();
    if (!(await close.count())) break;
    await close.click({force: true}).catch(() => {});
    await page.waitForTimeout(200);
  }
  const card = page.getByRole("button", {name: "Card", exact: true});
  if (await card.isVisible().catch(() => false)) {
    await card.click();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-region="centre"] [role="tab"]')].some(tab => /^epi-card-/.test((tab.textContent ?? "").trim())), null, {timeout: 30000});
    const cards = documents().filter(name => name.startsWith("epi-card-"));
    const cardBytes = cards.length === 1 ? readFileSync(join(p.root, "Control/user/flows", cards[0])) : Buffer.alloc(0);
    check(cards.length === 1 && cardBytes.equals(readFileSync(join(templates, "oi-epi-card.html"))) && sha(join(templates, "oi-epi-card.html")) === templateSha["oi-epi-card.html"], "Rest → Card mints a copy of the Epi-Card carrier (byte-equal: it has no embedded identity) and never opens the template", {cards});
  } else check(false, "Rest → Card: the rest page's Card entry is reachable once the tabs are closed");

  // ---- Factory INTENT: vision review mark; Write a goal in place
  await left.locator("[data-left-head] .left-scope-trigger").click();
  await left.locator('[data-scope-project="Alpha"]').click();
  await left.locator('.world-mode-strip [data-mode="factory"]').click();
  await page.locator('.desktop-shell[data-mode="factory"]').waitFor();
  const intent = left.locator('[data-section="intent"]');
  await intent.locator('[data-goals-absent]').waitFor({timeout: 30000});
  const visionRow = intent.locator('div[data-file-path="Work/Alpha/ProjectCentral/user/alpha.html"]');
  const learnings = (await intent.locator(".left-learnings").innerText()).replace(/\s+/g, " ").trim();
  check((await visionRow.innerText()).includes("review") && (await intent.locator("[data-goals-absent]").innerText()).replace(/\s+/g, " ").trim() === "No goals yet Write one" && learnings === "Learnings 1", "D5: INTENT shows Alpha's vision marked 'review' (the page says it is agent-recovered), 'No goals yet — Write one', and Learnings (1)", {learnings});
  await shot("intent-before");
  const asked = [];
  page.on("request", request => { if (request.url().endsWith("/op")) { try { const body = request.postDataJSON(); if (body?.op === "file_operation" && body.request?.action === "write") asked.push(body.location.path); } catch {} } });
  const telosBefore = readdirSync(join(p.root, "Work/Alpha/ProjectCentral/user/telos"));
  await intent.getByRole("button", {name: "Write one"}).click();
  const refusal = intent.getByRole("alert");
  await refusal.waitFor({timeout: 30000});
  const refusalText = (await refusal.innerText()).trim();
  const goalAsk = asked.find(path => /^Work\/Alpha\/ProjectCentral\/user\/telos\/goal-\d{4}-\d{2}-\d{2}-\d{4}\.html$/.test(path));
  check(!!goalAsk && /^Central doesn't yet let the desktop create a Goal in Alpha's human ground/.test(refusalText) && /Nothing was written\.$/.test(refusalText), "D5: Write one asks Central to create the goal IN PLACE (ProjectCentral/user/telos/goal-<stamp>.html) and shows Central's refusal beside the row in plain words", {goalAsk, refusalText});
  check(JSON.stringify(readdirSync(join(p.root, "Work/Alpha/ProjectCentral/user/telos"))) === JSON.stringify(telosBefore) && await intent.locator("[data-goals-absent]").count() === 1 && sha(join(templates, "oi-goal.html")) === templateSha["oi-goal.html"], "D5: nothing was written instead — telos holds what it held, INTENT still says No goals yet, the Goal template is untouched");
  await shot("intent-goal-refused");
  // The refusal is Central's own law, read natively (the gap, not the UI).
  const runCtrl = (args) => { try { return execFileSync("ctrl", args, {encoding: "utf8"}); } catch (error) { return String(error.stdout ?? ""); } };
  const native = JSON.parse(runCtrl(["--root", p.root, "--json", "action", "run", "central.files.write", JSON.stringify({location: {schema: "central.path-ref/v1", ref: `central:path:${realpathSync(p.root)}:${goalAsk}`, root: realpathSync(p.root), path: goalAsk}, expected_revision: "", content: "probe", actor: "oi-desktop-user", actor_kind: "human"})]));
  check(native.ok === false && /Protected ground|No such file/i.test(native.error?.message ?? ""), "Native gap: Central itself refuses a first save into ProjectCentral/user (only Control/user/flows/ admits one)", {native: native.error});
  // Beta has no vision page: Write it asks for Beta's vision in place.
  await left.locator("[data-left-head] .left-scope-trigger").click();
  await left.locator('[data-scope-project="Beta"]').click();
  const write = intent.getByRole("button", {name: "Write it"});
  await write.waitFor({timeout: 30000});
  await write.click();
  await intent.getByRole("alert").waitFor({timeout: 30000});
  const visionAsk = asked.find(path => path === "Work/Beta/ProjectCentral/user/beta.html");
  check(!!visionAsk && !existsSync(join(p.root, "Work/Beta/ProjectCentral/user/beta.html")) && /Vision in Beta's human ground/.test(await intent.getByRole("alert").innerText()) && sha(join(templates, "oi-vision.html")) === templateSha["oi-vision.html"], "D5: Write it asks for Beta's vision IN PLACE (ProjectCentral/user/beta.html); Central refuses, nothing is written, the Vision template is untouched", {visionAsk});
  await shot("intent-vision-refused");
  const untouched = Object.entries(templateSha).every(([name, digest]) => sha(join(templates, name)) === digest);
  check(untouched, "No template in Work/O-I/desktop/cradle/documents changed across the walk (sha-256 of every carrier)");
}
