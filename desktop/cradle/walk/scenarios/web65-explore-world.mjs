// web65-explore-world (EpiLogos/O-I #65 / #220): the running desktop walks
// the hosted World A field and the owner's private undertaking through the
// ordinary Explore UI — rail entry, search, result selection, Relations
// depth, back/forward — and reads every claim from the data attributes the
// renderer already emits.
//
// Read only. The kernel pulls the field through the O:I-owned client
// (`shared-field/spacetimedb/field.sh`) with the runner's own environment:
// OI_SHARED_FIELD_TARGET=hosted and the default OI_STATE_HOME (the owner
// transport, which can read the private undertaking). The walk never
// publishes, contributes, admits or watches, and it never touches the
// owner-side producer that holds the activity's liveness.
//
// The one controlled step is the discriminating negative for liveness: the
// real snapshot response is fetched and delivered with its
// activity_liveness rows removed, so the SAME renderer path must read the
// activity as `disconnected` rather than trusting the publication's
// `liveness: live` claim. Removing the interception restores `live`.
import {setup as sourceSetup} from "./editor.mjs";
import {bindDefaultCentral} from "../editor-doc.mjs";

const WORLD = "world:central:project:O-I";
const POSITION = `${WORLD}/central:position:project:O-I:aletheia-5`;
const REGION_POSITION = "world:central:project:O-I:region:a04-mask/central:position:project:O-I:aletheia-5";
const WORKCELL = `${WORLD}/workcell:mac`;
const PRACTICE = `${WORLD}/skill/ql/darshana`;
const ACTIVITY = `${WORLD}/run:01M3FNY3P0E4H7JGN0BARSRQ8R`;
const PUBLIC_FIELD = "oi:field:central:project:O-I";
const UNDERTAKING = "oi:field:central:project:O-I:undertaking:a04-mask";
const REGION = "world:central:project:O-I:region:a04-mask";
const CONTEMPLATIONS = [`${REGION}/wiki:node:contemplation/a04p-re-sites-a04-2026-09-28`, `${REGION}/wiki:node:contemplation/a05p-re-sites-a05-2026-09-28`];
const ARTIFACTS = ["A04", "A04p", "A05", "A05p"].map((id) => `${REGION}/artifact:central:corpus:${id}`);
const SOURCE_REVISION_PREFIX = "f3d55f2f";
const q = (ref) => JSON.stringify(ref);
// The field client's mutating request kinds (knowledge/shared-field.ts); status,
// identity, receipt, snapshot, read and stage are readings.
const WRITE_KINDS = new Set(["publish", "projection", "participant", "contribute", "admit", "reject", "withdraw", "contact", "watch", "enter", "leave", "stage-open", "stage-advance", "stage-close", "stage-follow", "stage-unfollow"]);

export async function setup(args) {
  // A disposable Central root for the frame to stand in; the Shared Field
  // target and state home stay the runner's own (never overridden here).
  const p = await sourceSetup(args);
  return {...p, cradleRoot: args.cradleRoot};
}

export default async function run({page, baseUrl, check, metric, shot, channel, log, provision: p}) {
  const target = process.env.OI_SHARED_FIELD_TARGET;
  check(target === "hosted" && !process.env.OI_STATE_HOME, "The walk reads the hosted target through the default state home (owner transport); the renderer never sees a target or token", {target: target ?? null, state_home_overridden: Boolean(process.env.OI_STATE_HOME)});
  const writes = [];
  page.on("request", (request) => {
    if (!request.url().endsWith("/op") || request.method() !== "POST") return;
    try { const body = request.postDataJSON(); if (body.op === "shared_field" && WRITE_KINDS.has(body.request?.kind)) writes.push(body.request?.kind); } catch { /* non-JSON */ }
  });

  await page.goto(baseUrl); await channel("info");
  const chooser = page.getByRole("region", {name: "Central location"});
  if (await chooser.isVisible().catch(() => false)) await bindDefaultCentral(page, p.root);

  // (1) hosted status — kernel reading and the Explore micro-signal.
  const status = (await channel("invoke.kernel_op", [{op: "shared_field", request: {kind: "status"}}])).data.outcome.data;
  check(status.bound === true && status.target?.name === "hosted" && !JSON.stringify(status).match(/token/i), "(1) Kernel shared_field status is bound to the `hosted` target, with no token in the reading", {bound: status.bound, target: status.target});
  const snapshot = (await channel("invoke.kernel_op", [{op: "shared_field", request: {kind: "snapshot"}}])).data.outcome.data;
  const entry = (ref) => snapshot.entries.find((e) => e.ref === ref);
  check([POSITION, WORKCELL, PRACTICE, ACTIVITY].every(entry) && snapshot.fields.some((f) => f.field_ref === PUBLIC_FIELD && f.visibility === "public") && snapshot.fields.some((f) => f.field_ref === UNDERTAKING && f.visibility === "private"), "(1) The owner snapshot holds World A's Position, Workcell, practice and activity, the public field and the private undertaking", {counts: snapshot.counts, fields: snapshot.fields.map((f) => `${f.field_ref} (${f.visibility})`)});

  const nav = page.getByRole("complementary", {name: "World navigator"});
  if (!await nav.isVisible()) await page.keyboard.press("Meta+b");
  const t0 = Date.now();
  await nav.getByRole("button", {name: "Open Explore", exact: true}).click();
  const explore = page.getByRole("region", {name: "Explore"});
  await explore.waitFor({timeout: 15000});
  await explore.locator('[data-field-state="available"]').waitFor({timeout: 90000});
  metric("explore_open_ms", Date.now() - t0);
  const signal = explore.locator(".explore-availability");
  check(await signal.getAttribute("data-availability") === "available" && (await signal.innerText()).trim() === "hosted", "(1) Explore, opened from the World navigator rail, shows the field available at `hosted`", {signal: await signal.innerText()});
  await shot("field");

  const search = explore.getByRole("searchbox", {name: "Search the open field"});
  const find = async (query) => { await search.fill(query); await search.press("Enter"); };
  const release = async () => { await explore.getByRole("button", {name: "Return to the field", exact: true}).first().click(); await explore.locator('[data-field-state="available"]').waitFor({timeout: 30000}); };
  const selected = () => explore.getAttribute("data-selected-ref");
  const waitSelected = (ref) => explore.locator(`.presentation-body[data-presentation-state="hosted"][data-entry-ref=${q(ref)}]`).waitFor({timeout: 60000});
  const constituent = explore.locator("article.world-constituent");
  const facts = () => constituent.locator(".world-component__meta > div").evaluateAll((rows) => Object.fromEntries(rows.map((row) => [row.querySelector("dt")?.textContent ?? "", row.querySelector("dd")?.textContent ?? ""])));

  // Same labels in different Worlds stay distinguishable in the result list.
  await find("Aletheia 5");
  await explore.locator(`.explore-results li[data-explore-ref=${q(REGION_POSITION)}]`).waitFor({timeout: 10000});
  const twins = await explore.locator(".explore-results li").evaluateAll((items, refs) => items.filter((li) => refs.includes(li.dataset.exploreRef)).map((li) => ({ref: li.dataset.exploreRef, label: li.querySelector("strong")?.textContent, world: li.querySelector("small")?.textContent})), [POSITION, REGION_POSITION]);
  check(twins.length === 2 && twins[0].label === twins[1].label && twins[0].world !== twins[1].world, "The same-labelled Position in World A and in the undertaking region are two results, told apart by their World", {twins});

  // (2) search "agents" finds the Aletheia Position.
  await find("agents");
  const hit = explore.locator(`.explore-results li[data-explore-ref=${q(POSITION)}]`);
  await hit.waitFor({timeout: 10000});
  check(await hit.getAttribute("data-kind") === "world-position", "(2) Searching `agents` finds the Aletheia 5 Agent Position of World A", {label: await hit.locator("strong").innerText(), world: await hit.locator("small").innerText()});

  // (3) the Being: Carried by → Workcell mac exactly once; Practises.
  const t1 = Date.now();
  await hit.locator("button").click();
  await waitSelected(POSITION);
  metric("being_open_ms", Date.now() - t1);
  const body = explore.locator('.presentation-body[data-presentation-state="hosted"]');
  check(await body.getAttribute("data-entry-kind") === "world-position" && await constituent.getAttribute("data-constituent-role") === "being" && await constituent.getAttribute("data-constituent-kind") === "world-position" && await constituent.getAttribute("data-subject-ref") === POSITION, "(3) Selecting it opens the Position itself as a Being (not the World page)", {role: await constituent.getAttribute("data-constituent-role"), standing: await constituent.locator(".world-component__eyebrow").first().innerText()});
  const carried = constituent.locator('[data-relation-group="Carried by"] button');
  const carriedRefs = await carried.evaluateAll((els) => els.map((el) => el.dataset.ref));
  check(carriedRefs.length === 1 && carriedRefs[0] === WORKCELL && (await carried.first().innerText()).includes("Workcell mac"), "(3) Carried by names Workcell mac exactly once", {carried_by: carriedRefs});
  const practises = await constituent.locator('[data-relation-group="Practises"] button').evaluateAll((els) => els.map((el) => el.dataset.ref));
  const fieldPractises = snapshot.relations.filter((r) => r.relation === "oi.world/practises" && r.from === POSITION).map((r) => r.to);
  check(practises.includes(PRACTICE) && practises.length === new Set(fieldPractises).size, "(3) Practises lists the field's practices once each, darshana among them", {rendered: practises.length, field: new Set(fieldPractises).size});
  // Relations depth summoned inside the Surface and dismissed again.
  await explore.getByRole("group", {name: "Contextual depth"}).getByRole("button", {name: "Relations", exact: true}).click();
  const depth = explore.getByRole("complementary", {name: "Relations of this subject"});
  await depth.waitFor();
  const depthText = await depth.innerText();
  check(await body.getAttribute("data-depth-relations") === "true" && depthText.includes(WORKCELL) && depthText.includes("oi.world/carried-by") && depthText.includes(PRACTICE), "(3) Relations depth opens beside the Being with its typed relations (carried-by, practises)", {relations_listed: await depth.locator(".presentation-relations > li").count()});
  await shot("being-relations");
  await depth.getByRole("button", {name: "Dismiss relations"}).click();
  check(await body.getAttribute("data-depth-relations") === "false", "(3) Relations depth dismisses back to the Being");
  await shot("being");

  // (4) Workcell Thing: nothing offered.
  await carried.first().click();
  await waitSelected(WORKCELL);
  const workcellFacts = await facts();
  check(await constituent.getAttribute("data-constituent-role") === "thing" && await constituent.getAttribute("data-constituent-kind") === "workcell" && workcellFacts.Offered === "nothing offered — inspectable only", "(4) Workcell mac opens as a Thing that says nothing is offered", {facts: workcellFacts});
  await shot("workcell");

  // (8) back/forward restores the prior subject.
  await explore.getByRole("button", {name: "Back", exact: true}).click();
  await waitSelected(POSITION);
  check(await selected() === POSITION && await constituent.getAttribute("data-constituent-role") === "being", "(8) Back restores the Aletheia Being", {selected: await selected()});
  await explore.getByRole("button", {name: "Forward", exact: true}).click();
  await waitSelected(WORKCELL);
  check(await selected() === WORKCELL && await constituent.getAttribute("data-constituent-kind") === "workcell", "(8) Forward returns to the Workcell Thing", {selected: await selected()});
  await explore.getByRole("button", {name: "Back", exact: true}).click();
  await waitSelected(POSITION);

  // (5) practice Thing: source revision and publication is not permission.
  await constituent.locator(`[data-relation-group="Practises"] button[data-ref=${q(PRACTICE)}]`).click();
  await waitSelected(PRACTICE);
  const practiceFacts = await facts();
  check(await constituent.getAttribute("data-constituent-kind") === "practice" && practiceFacts["Source revision"] === entry(PRACTICE).meta.source_revision && practiceFacts["Source revision"].startsWith(SOURCE_REVISION_PREFIX), "(5) The darshana practice Thing shows its exact source revision (f3d55f2f…)", {source_revision: practiceFacts["Source revision"], availability: practiceFacts.Availability});
  check(practiceFacts["Granted use"] === "none — publication is not permission", "(5) The practice says publication is not permission (granted use: none)", {granted_use: practiceFacts["Granted use"]});
  await shot("practice");

  // (6) activity Thing: live with owner state, from the producer's row.
  await release();
  await find("01M3FNY3P0E4H7JGN0BARSRQ8R");
  await explore.locator(`.explore-results li[data-explore-ref=${q(ACTIVITY)}] button`).click();
  await waitSelected(ACTIVITY);
  const row = (snapshot.activity_liveness ?? []).find((r) => r.activity_ref === ACTIVITY);
  check(Boolean(row) && entry(ACTIVITY).meta.liveness === "live", "(6) The field holds an owner-side producer row for the run (and the publication claims live)", {owner_state: row?.owner_state, owner_revision: row?.owner_revision, heartbeat_at_micros: row?.heartbeat_at_micros});
  await constituent.and(page.locator('[data-liveness="live"]')).waitFor({timeout: 30000});
  let activityFacts = await facts();
  check(await constituent.getAttribute("data-liveness") === "live" && /^live — owner state \S+ at revision \d+$/.test(activityFacts.Liveness) && activityFacts.Liveness.includes(`owner state ${row?.owner_state}`), "(6) The activity Thing reads data-liveness=live with the producer's owner state and revision", {liveness: activityFacts.Liveness, state: activityFacts.State});
  await shot("activity-live");

  // (6) discriminating negative: the same snapshot without liveness rows.
  let stripped = 0;
  const withoutLiveness = async (route) => {
    const request = route.request();
    let body; try { body = request.postDataJSON(); } catch { body = null; }
    if (request.method() !== "POST" || body?.op !== "shared_field" || body.request?.kind !== "snapshot") { await route.continue(); return; }
    const response = await route.fetch(); // the real owner reading; only its liveness rows are removed
    const json = await response.json();
    if (Array.isArray(json?.outcome?.data?.activity_liveness)) { stripped += json.outcome.data.activity_liveness.length; json.outcome.data.activity_liveness = []; }
    await route.fulfill({response, json});
  };
  await page.route("**/op", withoutLiveness);
  await explore.getByRole("button", {name: "Refresh the field", exact: true}).click();
  await constituent.and(page.locator('[data-liveness="disconnected"]')).waitFor({timeout: 60000});
  activityFacts = await facts();
  check(stripped > 0 && await constituent.getAttribute("data-liveness") === "disconnected" && activityFacts.Liveness === "disconnected — published as live, but no producer holds it now", "(6) Negative: with the producer's liveness rows removed from the real snapshot the same Thing reads `disconnected` — the renderer does not synthesise liveness from the publication", {rows_removed: stripped, liveness: activityFacts.Liveness});
  await shot("activity-disconnected");
  await page.unroute("**/op", withoutLiveness);
  await explore.getByRole("button", {name: "Refresh the field", exact: true}).click();
  await constituent.and(page.locator('[data-liveness="live"]')).waitFor({timeout: 60000});
  check(await constituent.getAttribute("data-liveness") === "live", "(6) Restoring the real reading returns the activity to live");

  // (7) the undertaking field: Shared NOW revision 1, workcell:mac root + child.
  await release();
  await find("undertaking");
  await explore.locator(`.explore-results li[data-explore-ref=${q(UNDERTAKING)}] button`).click();
  const fieldPage = explore.locator(`article[data-field-ref=${q(UNDERTAKING)}]`);
  await fieldPage.waitFor({timeout: 30000});
  const now = (snapshot.field_now ?? []).find((r) => r.field_ref === UNDERTAKING);
  const rootNow = now?.contract?.projected_root_now_refs?.find((r) => r.workcell_ref === "workcell:mac");
  const childNow = now?.contract?.projected_child_now_refs?.find((r) => r.parent_now_ref === rootNow?.now_ref);
  check(await fieldPage.getAttribute("data-field-visibility") === "private" && await fieldPage.getAttribute("data-membership") !== "none", "(7) The private undertaking opens as a field page within the owner's own membership", {visibility: await fieldPage.getAttribute("data-field-visibility"), membership: await fieldPage.getAttribute("data-membership")});
  const nowRegion = fieldPage.locator('[data-region-role="field-now"]');
  const cell = nowRegion.locator('[data-workcell-ref="workcell:mac"]');
  const cellText = await cell.innerText().catch(() => "");
  check(now?.revision === 1 && await nowRegion.getAttribute("data-field-now-revision") === "1" && (await nowRegion.locator(".world-region__label").textContent()).includes("Shared NOW · revision 1"), "(7) The field page shows Shared NOW revision 1", {revision: await nowRegion.getAttribute("data-field-now-revision")});
  check(Boolean(rootNow) && cellText.includes(rootNow.now_ref) && cellText.includes(rootNow.world_ref), "(7) workcell:mac carries its projected root NOW", {root_now: rootNow?.now_ref, world_ref: rootNow?.world_ref});
  check(Boolean(childNow) && await cell.locator(`[data-now-ref=${q(childNow.now_ref)}]`).count() === 1 && !cellText.includes("its Workcell NOW is not projected here"), "(7) The child NOW sits under that root", {child_now: childNow?.now_ref, state: childNow?.state});
  const entriesRegion = fieldPage.locator('[data-region-role="entries"]');
  const relationsRegion = fieldPage.locator('[data-region-role="relations"]');
  const entriesText = await entriesRegion.innerText();
  check(ARTIFACTS.every((ref) => entriesText.includes(entry(ref)?.label ?? "\u0000")) && CONTEMPLATIONS.every((ref) => entriesText.includes(entry(ref)?.label ?? "\u0000")), "(7) The undertaking carries the curated A04/A04′/A05/A05′ artifacts and both contemplation nodes", {artifacts: ARTIFACTS.map((ref) => entry(ref)?.label), contemplations: CONTEMPLATIONS.map((ref) => entry(ref)?.label)});
  check((await relationsRegion.innerText()).includes("wiki.edge/re-sites"), "(7) The typed relation wiki.edge/re-sites is listed among the field's relations", {});
  await shot("undertaking-field-now");
  await explore.getByRole("button", {name: "Back", exact: true}).click();
  await explore.locator('[data-field-state="available"]').waitFor({timeout: 30000});
  await explore.getByRole("button", {name: "Forward", exact: true}).click();
  await fieldPage.waitFor({timeout: 30000});
  check(await selected() === UNDERTAKING, "(8) Back/forward also restores the field page", {selected: await selected()});

  // (9) narrow viewport with reduced motion: the Being stays readable.
  await page.setViewportSize({width: 420, height: 800});
  await page.emulateMedia({reducedMotion: "reduce"});
  await release();
  await find("agents");
  await explore.locator(`.explore-results li[data-explore-ref=${q(POSITION)}] button`).click();
  await waitSelected(POSITION);
  const narrow = await page.evaluate(() => ({
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    inner: innerWidth,
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  const heading = await constituent.locator("h1").boundingBox();
  const carriedBox = await constituent.locator('[data-relation-group="Carried by"]').boundingBox();
  check(narrow.reduced && narrow.doc <= narrow.inner && narrow.body <= narrow.inner, "(9) At 420×800 with reduced motion the page body does not overflow horizontally", narrow);
  check(Boolean(heading && carriedBox) && heading.width > 0 && heading.x >= 0 && heading.x + heading.width <= narrow.inner + 1 && carriedBox.x >= 0 && carriedBox.x + carriedBox.width <= narrow.inner + 1 && await constituent.locator('[data-relation-group="Carried by"] button').count() === 1, "(9) The Being's title and Carried by group stay within the narrow viewport", {heading, carried_by: carriedBox});
  await shot("being-narrow-reduced-motion");
  await page.setViewportSize({width: 1280, height: 820});
  await page.emulateMedia({reducedMotion: null});

  check(writes.length === 0, "The walk issued no Shared Field write (no publish, contribute, admit, watch, enter or stage act)", {writes});
  metric("kernel_events_total", (await channel("read.events", [0])).data.receipts.length);
  log(`web65 read: ${snapshot.counts.entries} entries, ${snapshot.counts.relations} relations, field_now ${snapshot.counts.field_now}`);
}
