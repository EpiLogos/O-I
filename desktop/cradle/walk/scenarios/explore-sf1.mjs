// explore-sf1 — the SF1 acceptance walk, exactly as SHARED-FIELD-DESKTOP
// §14 requires, in the running desktop against the real hosted field named
// by OI_SHARED_FIELD_TARGET (the runner passes the process environment to
// the bridge; the renderer never sees a target or a token).
//
//   local desktop (a source tab in "Central", a draft in "Personal")
//   → open global Explore
//   → search/open an addressable projected world
//   → WorldPresentation becomes the main canvas body
//   → summon relations/source depth and dismiss it
//   → summon the personal Agent without replacing the shared subject
//   → full / split the presentation (detach/re-dock is native-only; recorded)
//   → return to the Explore field with selection/history intact
//   → return to the prior Work/Personal workspaces intact
//
//   local ordinary Expression (with private sentinels planted)
//   → Share / Project → exact outward preview + omissions
//   → audience → Projection → Publish to the hosted field → Open in Explore
//   → the exact projected representation/ref, live or explicit fallback
//
// Also: the offline/unavailable field is honest and erases nothing (a
// second, target-less bridge on the same storage); the human reading and the
// structured Agent reading identify the same projected subject/revisions.
// The walk publishes real rows in the field under its own publisher
// `human:desktop-walk`; it withdraws, overwrites and deletes nothing else.
import {execFileSync, spawn} from "node:child_process";
import {join, resolve} from "node:path";
import {setup as sourceSetup} from "./editor.mjs";
import {bindDefaultCentral, openWorkspaceStrip, newWorkspace, switchWorkspace} from "../editor-doc.mjs";

const OWNER_OPERATION = "shared-field.projection";
const SENTINELS = ["PRIVATE_SENTINEL_SCENE", "PRIVATE_SENTINEL_ENTITY", "PRIVATE_SENTINEL_READING", "PRIVATE_SENTINEL_ACTION", "PRIVATE_SENTINEL_WITHHELD"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function setup(args) {
  const p = await sourceSetup(args);
  return {...p, cradleRoot: args.cradleRoot, env: {...p.env, AIKIT_HOME: join(p.root, ".aikit-home")}};
}

function doorway(cradleRoot, request, env = process.env) {
  const script = resolve(cradleRoot, "../../shared-field/spacetimedb/field.sh");
  let stdout;
  try { stdout = execFileSync(script, {input: JSON.stringify(request), encoding: "utf8", env, stdio: ["pipe", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024}); }
  catch (error) { stdout = error.stdout?.toString() ?? ""; }
  return JSON.parse(stdout);
}

/** A second walk bridge with NO Shared Field target — the offline path through the real kernel. */
async function withUnboundBridge(cradleRoot, env, run) {
  const port = 4182;
  const url = `http://127.0.0.1:${port}`;
  const stripped = {...process.env, ...env};
  for (const key of ["OI_SHARED_FIELD_TARGET", "SPACETIMEDB_URI", "SPACETIMEDB_DATABASE"]) delete stripped[key];
  const child = spawn("cargo", ["run", "--quiet", "--manifest-path", join(cradleRoot, "kernel/Cargo.toml"), "--bin", "walk-bridge", "--", `127.0.0.1:${port}`], {cwd: cradleRoot, detached: true, stdio: ["ignore", "pipe", "pipe"], env: stripped});
  let output = ""; child.stdout.on("data", (c) => { output += c; }); child.stderr.on("data", (c) => { output += c; });
  try {
    const deadline = Date.now() + 180_000;
    for (;;) {
      try { const r = await fetch(`${url}/state`); if (r.ok) break; } catch { /* not up yet */ }
      if (Date.now() > deadline) throw new Error(`the unbound bridge did not come up:\n${output}`);
      await sleep(250);
    }
    return await run(url);
  } finally {
    try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
  }
}

const workspaces = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("oi-cradle.workspaces.v1") ?? "null"));
const localTabs = (book, id) => { const w = book?.workspaces?.find((x) => x.id === id); if (!w) return null; const tabs = []; const walk = (pane) => { if (!pane) return; if (pane.type === "group") tabs.push(...pane.tabs.map((t) => ({id: t, kind: w.layout.surfaces[t]?.kind, ref: w.layout.surfaces[t]?.ref}))); else pane.children.forEach(walk); }; walk(w.layout.root); return tabs.filter((t) => t.kind !== "explore" && t.kind !== "presentation"); };

export default async function run({page, baseUrl, check, metric, shot, channel, log, provision: p}) {
  const target = process.env.OI_SHARED_FIELD_TARGET;
  check(Boolean(target), "A hosting target is named in the walk environment (OI_SHARED_FIELD_TARGET); the renderer never sees it", {target: target ?? null});
  const ops = [];
  page.on("request", (request) => { if (request.url().endsWith("/op") && request.method() === "POST") { try { ops.push(request.postDataJSON()); } catch { /* non-JSON */ } } });

  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  const nav = page.getByRole("complementary", {name: "World navigator"});
  const showNav = async () => { if (!await nav.isVisible()) await page.keyboard.press("Meta+b"); };

  // ---- local work: a source tab in "Central", a draft in "Personal" ----
  const source = p.sources[0];
  await showNav();
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button", {name: "Editor: files", exact: true}).click();
  await nav.locator(`[data-file-path="Work/Editor/${source.binding.path}"]`).click();
  await page.locator(`.cm-content[data-source-ref="${source.binding.ref}"]`).waitFor({timeout: 15000});
  await newWorkspace(page, "Personal");
  await page.getByRole("button", {name: "Start writing", exact: true}).click();
  await page.locator(".draft-surface, .flow-surface").first().waitFor({timeout: 15000});
  let book = await workspaces(page);
  const personalId = book.workspaces.find((w) => w.name === "Personal")?.id;
  check(Boolean(personalId) && localTabs(book, personalId).some((t) => t.kind === "draft"), "A second local arrangement (Personal) holds unsaved writing", {personal: localTabs(book, personalId)});
  await switchWorkspace(page, "root");
  await page.locator(`.cm-content[data-source-ref="${source.binding.ref}"]`).waitFor({timeout: 15000});
  book = await workspaces(page);
  const centralBefore = localTabs(book, "root");
  const personalBefore = localTabs(book, personalId);
  check(centralBefore.some((t) => t.kind === "source" && t.ref === source.binding.ref), "The Central arrangement holds the local source tab", {central: centralBefore});
  const layoutBefore = (await channel("read.layout")).data.layout;
  check(layoutBefore.accompanying === undefined, "No accompanying AgentSession is bound before Explore opens", {accompanying: layoutBefore.accompanying ?? null});
  const opsBeforeExplore = ops.length;

  // ---- open global Explore ----
  await showNav();
  const t0 = Date.now();
  await nav.getByRole("button", {name: "Open Explore", exact: true}).click();
  const explore = page.getByRole("region", {name: "Explore"});
  await explore.waitFor({timeout: 15000});
  await explore.locator('[data-field-state]').waitFor({timeout: 60000});
  metric("explore_open_ms", Date.now() - t0);
  const state = (await channel("read.state")).data;
  const exploreSurface = Object.values(state.surfaces).find((s) => s.kind === "explore");
  check(Boolean(exploreSurface), "Explore is one kernel-registered Surface of kind `explore` (no shell, no sidebar)", {surface: exploreSurface});
  const layoutWithExplore = (await channel("read.layout")).data.layout;
  const exploreBinding = Object.values(layoutWithExplore.surfaces).find((b) => b.kind === "explore");
  check(Boolean(exploreBinding) && !exploreBinding.project, "The Explore binding is not scoped to the selected Project", {binding: exploreBinding});
  check(localTabs(await workspaces(page), "root").length === centralBefore.length && layoutWithExplore.accompanying === undefined, "Opening Explore left the local arrangement and the Agent relation intact", {central: localTabs(await workspaces(page), "root")});
  check(!ops.slice(opsBeforeExplore).some((o) => o.op === "encounter"), "Opening Explore starts no AgentSession and posts no encounter op", {ops: [...new Set(ops.slice(opsBeforeExplore).map((o) => o.op))]});
  const fieldState = await explore.locator("[data-field-state]").getAttribute("data-field-state");
  check(fieldState === "available", "The open field is available at rest (constellation + list reading)", {fieldState});
  const snapshot = (await channel("invoke.kernel_op", [{op: "shared_field", request: {kind: "snapshot"}}])).data.outcome.data;
  const entriesShown = Number(await explore.locator(".explore-field").getAttribute("data-entries"));
  check(entriesShown === snapshot.counts.entries && (await explore.locator(".explore-node").count()) >= snapshot.counts.entries, "The field renders one node per hosted entry, equal to the client's own snapshot", {entries_shown: entriesShown, snapshot_entries: snapshot.counts.entries});
  check(await explore.locator(".explore-availability").getAttribute("data-availability") === "available", "The availability micro-signal reads available", {});
  await shot("explore-field");

  // ---- search / open a real projected world ----
  const world = snapshot.entries.find((e) => e.kind === "central-world") ?? snapshot.entries[0];
  const worldProjection = snapshot.projections.filter((pr) => pr.subject?.ref === world.ref).sort((a, b) => b.projection_revision - a.projection_revision)[0];
  await explore.getByRole("searchbox", {name: "Search the open field"}).fill(world.label.split(" ")[0]);
  await explore.getByRole("searchbox", {name: "Search the open field"}).press("Enter");
  await page.waitForFunction((ref) => !!document.querySelector(`.explore-results [data-explore-ref="${CSS.escape(ref)}"]`), world.ref, {timeout: 10000});
  const t1 = Date.now();
  await explore.locator(`.explore-results [data-explore-ref="${world.ref}"] button`).click();
  const body = explore.locator('.presentation-body[data-presentation-state="hosted"]');
  await body.waitFor({timeout: 60000});
  metric("subject_open_ms", Date.now() - t1);
  const attrs = await body.evaluate((el) => ({...el.dataset}));
  check(attrs.entryRef === world.ref && attrs.projectionRef === worldProjection?.projection_ref && Number(attrs.projectionRevision) === worldProjection?.projection_revision && attrs.sourceRevision === worldProjection?.source?.revision, "The primary body carries the exact World/Projection refs and revisions the field holds", {dom: attrs, field: worldProjection && {projection_ref: worldProjection.projection_ref, projection_revision: worldProjection.projection_revision, source_revision: worldProjection.source.revision}});
  const worldPresentation = worldProjection?.representation?.kind === "oi.world-presentation/v1" ? worldProjection.representation.payload : null;
  check(Boolean(worldPresentation) && attrs.presentationRef === worldPresentation.presentation_ref && Number(attrs.presentationRevision) === worldPresentation.revision && (await body.locator(`.world-presentation[data-presentation-ref="${worldPresentation.presentation_ref}"]`).count()) === 1, "The WorldPresentation is the main canvas body, at its exact presentation ref/revision", {presentation_ref: worldPresentation?.presentation_ref, revision: worldPresentation?.revision});
  const rendererKeys = await body.locator(".world-binding").evaluateAll((els) => els.map((el) => ({key: el.dataset.rendererKey, available: el.dataset.rendererAvailable})));
  check(rendererKeys.length > 0 && rendererKeys.every((r) => r.available === "true" || r.available === "false"), "Every binding resolved through the accepted renderer registry or its declared fallback", {renderers: rendererKeys});
  await shot("explore-world-presentation");

  // ---- contextual depth: relations, source; summon and dismiss ----
  await explore.getByRole("button", {name: "Relations", exact: true}).click();
  const relations = explore.getByRole("complementary", {name: "Relations of this subject"});
  await relations.waitFor({timeout: 5000});
  check((await relations.locator(".presentation-relations li").count()) >= 0 && (await body.getAttribute("data-depth-relations")) === "true", "Relation depth opens inside the Surface (left), bounded to the hosted relations touching the subject", {rows: await relations.locator(".presentation-relations li").count()});
  await relations.getByRole("button", {name: "Dismiss relations"}).click();
  await relations.waitFor({state: "detached"});
  await explore.getByRole("button", {name: "Source", exact: true}).click();
  const sourceDepth = explore.getByRole("complementary", {name: "Source and provenance of this subject"});
  await sourceDepth.waitFor({timeout: 5000});
  const sourceText = await sourceDepth.innerText();
  check(sourceText.includes(worldProjection.projection_ref) && sourceText.includes(worldProjection.source.revision) && sourceText.includes(snapshot.target.uri), "Source & provenance depth names the projection, its source revision and the hosting target — inside the Surface (right)", {});
  await shot("explore-source-depth");
  await sourceDepth.getByRole("button", {name: "Dismiss source and provenance"}).click();
  await sourceDepth.waitFor({state: "detached"});
  check((await body.getAttribute("data-depth-relations")) === "false" && (await body.getAttribute("data-depth-source")) === "false" && (await page.locator(".presentation-depth").count()) === 0, "Both depths dismiss; nothing permanent remains", {});

  // ---- the personal Agent stays separate and summonable ----
  await page.getByRole("button", {name: "Toggle right region"}).click();
  await page.getByRole("region", {name: "Accompanying agent"}).waitFor({timeout: 5000});
  const layoutWithAgent = (await channel("read.layout")).data.layout;
  check(layoutWithAgent.rightDepth === "panel" && layoutWithAgent.accompanying === undefined && (await body.getAttribute("data-entry-ref")) === world.ref, "The personal Agent region opens beside the shared subject without replacing it and without binding any AgentSession", {rightDepth: layoutWithAgent.rightDepth, accompanying: layoutWithAgent.accompanying ?? null});
  await shot("explore-with-agent");
  await page.getByRole("button", {name: "Collapse right region"}).click();

  // ---- full / split the presentation; refs survive ----
  await page.locator('.pane.group.focused [aria-label="Maximize this pane"]').click();
  await page.locator('.pane.group[data-maximized="true"]').waitFor({timeout: 10000});
  check((await page.locator('.pane.group[data-maximized="true"]').count()) === 1 && (await body.getAttribute("data-projection-ref")) === worldProjection.projection_ref, "Full (maximized) keeps the same projected subject", {maximized: (await channel("read.layout")).data.layout.maximizedGroupId ?? null});
  await page.locator('.pane.group.focused [aria-label="Restore pane arrangement"]').click();
  await page.locator('.pane.group[data-maximized="true"]').waitFor({state: "detached", timeout: 10000});
  await explore.getByRole("button", {name: "Open as Surface", exact: true}).click();
  const pinned = page.getByRole("region", {name: "Projected subject"});
  await pinned.waitFor({timeout: 15000});
  await pinned.locator('.presentation-body[data-presentation-state="hosted"]').waitFor({timeout: 60000});
  let layout = (await channel("read.layout")).data.layout;
  const pinnedBinding = Object.values(layout.surfaces).find((b) => b.kind === "presentation" && b.ref === world.ref);
  check(Boolean(pinnedBinding) && pinnedBinding.presentation?.world_ref === world.world_ref && pinnedBinding.presentation?.projection_ref === worldProjection.projection_ref && pinnedBinding.presentation?.projection_revision === worldProjection.projection_revision && pinnedBinding.presentation?.presentation_ref === worldPresentation.presentation_ref, "The pinned presentation is an ordinary binding carrying the exact World/Projection/Presentation refs", {binding: pinnedBinding});
  await page.keyboard.press("Meta+d");
  await page.waitForFunction(() => document.querySelectorAll('.presentation-body[data-presentation-state="hosted"]').length >= 1, null, {timeout: 60000});
  layout = (await channel("read.layout")).data.layout;
  const groups = (pane, out = []) => { if (!pane) return out; if (pane.type === "group") out.push(pane); else pane.children.forEach((c) => groups(c, out)); return out; };
  check(groups(layout.root).length >= 2 && Object.values(layout.surfaces).find((b) => b.id === pinnedBinding.id)?.presentation?.projection_ref === worldProjection.projection_ref, "Split keeps the binding and its refs intact", {groups: groups(layout.root).length});
  const detachButton = page.getByRole("button", {name: "Detach active surface"});
  check((await detachButton.count()) === 0, "Detach/re-dock is native-window grammar (Tauri) and is not walkable in the bridge harness — recorded, not claimed", {native_windows: false});
  await shot("explore-pinned-split");

  // ---- back to the Explore field with selection/history intact ----
  await page.locator(`.tab[data-surface-id="${exploreBinding.id}"]`).click();
  await explore.waitFor({timeout: 5000});
  const lengthBefore = Number(await explore.getAttribute("data-travel-length"));
  await explore.getByRole("button", {name: "Back", exact: true}).click();
  await explore.locator('[data-field-state="available"]').waitFor({timeout: 10000});
  check((await explore.getAttribute("data-selected-ref")) === "" && Number(await explore.getAttribute("data-travel-length")) === lengthBefore && !(await explore.getByRole("button", {name: "Forward", exact: true}).isDisabled()), "Back returns to the field with the history retained and Forward available", {length: lengthBefore});
  await explore.getByRole("button", {name: "Forward", exact: true}).click();
  await explore.locator('.presentation-body[data-presentation-state="hosted"]').waitFor({timeout: 60000});
  check((await explore.getAttribute("data-selected-ref")) === world.ref, "Forward restores the selected subject", {});
  const travel = await page.evaluate(() => JSON.parse(localStorage.getItem("oi-cradle.explore.v1") ?? "null"));
  check(travel?.schema === "oi.cradle.explore-travel/v1" && travel.visits.some((v) => v.selected === world.ref) && !JSON.stringify(travel).includes("representation"), "Explore persists compact view state (query/selection/history/depth), never a cloned remote payload", {visits: travel?.visits?.length});

  // ---- return to local work: both arrangements intact ----
  await page.locator(`.tab[data-surface-id="${centralBefore.find((t) => t.kind === "source").id}"]`).click();
  await page.locator(`.cm-content[data-source-ref="${source.binding.ref}"]`).waitFor({timeout: 15000});
  book = await workspaces(page);
  check(JSON.stringify(localTabs(book, "root")) === JSON.stringify(centralBefore) && JSON.stringify(localTabs(book, personalId)) === JSON.stringify(personalBefore), "Both local arrangements (Central source tab, Personal draft) are exactly as before Explore", {central: localTabs(book, "root"), personal: localTabs(book, personalId)});

  // ---- Share / Project: one ordinary local Expression with private sentinels planted ----
  await showNav();
  await page.getByRole("button", {name: "System", exact: true}).click();
  const panel = page.getByRole("region", {name: "System composition"});
  await panel.getByRole("button", {name: "Visuals"}).click();
  await panel.getByRole("button", {name: "Compose", exact: true}).click();
  const editor = page.getByRole("region", {name: "Expression composition"});
  await editor.waitFor({timeout: 10000});
  await editor.getByRole("textbox", {name: "Expression title"}).fill("SF1 walk field");
  await editor.getByRole("button", {name: "New Expression"}).click();
  await editor.getByRole("button", {name: "Add Thing"}).waitFor({timeout: 10000});
  const listing = (await channel("invoke.kernel_op", [{op: "expression", request: {operation: "list"}}])).data.outcome.data;
  const expressionRef = listing.expressions.find((e) => e.title === "SF1 walk field")?.expression_ref;
  check(Boolean(expressionRef), "The local Expression exists in the native application", {expression_ref: expressionRef});
  await editor.getByRole("button", {name: "Add Thing"}).click();
  await editor.getByRole("group", {name: "Expression entities"}).getByRole("button").first().click();
  const glyph = editor.getByRole("textbox", {name: "Glyph"});
  await glyph.waitFor({timeout: 10000});
  await glyph.fill("☉"); await glyph.press("Tab");
  await sleep(300);
  let doc = (await channel("invoke.kernel_op", [{op: "expression", request: {operation: "inspect", expression_ref: expressionRef}}])).data.outcome.data.document;
  const sceneRef = doc.selection.scene_ref;
  const sunRef = Object.keys(doc.entities)[0];
  // Plant private material through the same structured seam an Agent uses: a
  // subject binding with private readings, a disclosed Action and a withheld
  // source; a second scene whose entity must not travel.
  const hiddenScene = `${expressionRef}:scene:hidden`;
  const hiddenEntity = `${expressionRef}:entity:hidden`;
  const planted = (await channel("invoke.kernel_op", [{op: "expression", request: {operation: "edit", expression_ref: expressionRef, expected_revision: doc.revision, actor: "agent:walk", changes: [
    {change: "subject_bind", entity_ref: sunRef, binding: {subject_ref: "central:being:walk", native_owner: "central", presentation_role: "being", sources: [{ref: source.binding.ref, revision: "walk", availability: "available"}, {ref: "central:source:project:editor-walk:PRIVATE_SENTINEL_WITHHELD.md", revision: "w1", availability: "withheld"}], readings: [{ref: "aikit:reading:PRIVATE_SENTINEL_READING", revision: "r1", availability: "available"}], actions: [{action_ref: "central.PRIVATE_SENTINEL_ACTION", target_ref: "central:being:walk", authority_requirement: "owner"}]}},
    {change: "scene_create", scene_ref: hiddenScene, title: "PRIVATE_SENTINEL_SCENE working notes"},
    {change: "entity_add", scene_ref: hiddenScene, entity_ref: hiddenEntity, title: "PRIVATE_SENTINEL_ENTITY"},
    {change: "focus", scene_ref: sceneRef, entity_ref: sunRef},
  ]}}])).data.outcome.data;
  check(planted.state === "ready" && planted.document?.revision > doc.revision, "Private readings, an Action disclosure, a withheld source and a private scene are planted in the local Expression through the structured seam", {state: planted.state, revision: planted.document?.revision});
  doc = planted.document;
  await page.waitForFunction((rev) => document.querySelector(".expression-editor header span")?.textContent?.includes(`Revision ${rev}`), doc.revision, {timeout: 10000});
  await editor.getByRole("button", {name: "Share / Project"}).click();
  const share = page.getByRole("region", {name: "Share / Project"});
  await share.waitFor({timeout: 10000});
  await share.getByLabel("PRIVATE_SENTINEL_SCENE working notes").uncheck();
  await page.waitForFunction(() => document.querySelector('.share-omissions [data-omission="scene"]'), null, {timeout: 5000});
  const omissions = await share.locator(".share-omissions li").allTextContents();
  check(omissions.some((t) => t.includes("PRIVATE_SENTINEL_SCENE")) && omissions.some((t) => t.includes("PRIVATE_SENTINEL_ENTITY")) && omissions.some((t) => t.includes("PRIVATE_SENTINEL_WITHHELD")) && omissions.some((t) => t.startsWith("1 private reading")) && omissions.some((t) => t.startsWith("1 Action disclosure")), "The omissions name every withheld thing to the publisher", {omissions});
  const previewPayload = await share.locator(".share-preview").getAttribute("data-preview-payload");
  check(!SENTINELS.some((s) => previewPayload.includes(s)) && previewPayload.includes(expressionRef), "The exact outward preview payload carries no private sentinel", {bytes: previewPayload.length});
  check((await share.locator('.share-preview [data-expression-state="fallback"][data-fallback-kind="html"]').count()) === 1, "The preview shows the explicit frozen-HTML fallback a client without the live renderer receives", {});
  const live = await share.locator(".share-live").getAttribute("data-live-renderer");
  check(live === "renderer:oi:expression-stage", "Live eligibility names the accepted renderer", {live});
  await share.getByRole("textbox", {name: "Publisher identity"}).fill("human:desktop-walk");
  await share.getByRole("combobox", {name: "Projection visibility"}).selectOption("public");
  await shot("share-preview");
  await share.getByRole("button", {name: "Create Projection"}).click();
  const created = share.locator(".share-created");
  await created.waitFor({timeout: 10000});
  const envelope = JSON.parse(await created.getAttribute("data-projection"));
  check(envelope.schema === "oi.projection/v1" && envelope.subject.ref === expressionRef && envelope.subject.kind === "expression" && envelope.source.revision === String(doc.revision) && envelope.representation.kind === "oi.world-presentation/v1" && envelope.audience.visibility === "public" && envelope.publisher_participant_ref.startsWith("participant:oi-field-desktop-") && envelope.publisher_participant_ref.endsWith(":human-desktop-walk"), "The created Projection is a real oi.projection/v1 carrying a WorldPresentation with the Expression body, distinct from the Expression revision", {projection_ref: envelope.projection_ref, projection_revision: envelope.projection_revision, source_revision: envelope.source.revision, expression_revision: doc.revision});
  check(!SENTINELS.some((s) => JSON.stringify(envelope).includes(s)), "The Projection envelope carries no private sentinel", {});
  const agent = JSON.parse(await share.locator("[data-agent-reading]").getAttribute("data-agent-reading"));
  check(agent.projection_ref === envelope.projection_ref && agent.expression?.expression_ref === expressionRef && agent.expression?.expression_revision === doc.revision && agent.presentation_ref === (await created.getAttribute("data-presentation-ref")), "The structured Agent reading identifies the same projection/presentation/Expression refs and revisions as the human reading", {agent});
  const host = share.locator(".share-host");
  await host.waitFor({timeout: 15000});
  const t2 = Date.now();
  await share.getByRole("button", {name: "Publish to the hosted field"}).click();
  const hostedResult = share.locator(".share-hosted");
  await hostedResult.waitFor({timeout: 90000});
  metric("hosted_publish_ms", Date.now() - t2);
  const hosted = JSON.parse(await hostedResult.getAttribute("data-hosted-result"));
  check(hosted.hosted_projection_row.projectionRef === envelope.projection_ref && hosted.hosted_projection_row.projectionRevision === envelope.projection_revision && hosted.hosted_projection_row.sourceRevision === String(doc.revision) && hosted.entries[0] === expressionRef, "The hosted result shows the hosted Projection row verbatim for the created envelope", {hosted_projection_row: hosted.hosted_projection_row, entries: hosted.entries});
  const readBack = (await channel("invoke.kernel_op", [{op: "shared_field", request: {kind: "read", ref: expressionRef}}])).data.outcome.data;
  check(readBack.state === "hosted" && readBack.entry?.kind === "expression" && readBack.projections.some((pr) => pr.projection_ref === envelope.projection_ref && pr.projection_revision === envelope.projection_revision), "Reading the Expression ref through the kernel returns state `hosted` with the same projection", {ref: expressionRef, state: readBack.state});
  const fieldRaw = JSON.stringify(doorway(p.cradleRoot, {kind: "read", ref: expressionRef}));
  check(!SENTINELS.some((s) => fieldRaw.includes(s)), "The hosted field holds no private sentinel for the published ref (payload, entry, fallback)", {bytes: fieldRaw.length});
  check(hosted.hosted_projection_row.publisherParticipantRef === envelope.publisher_participant_ref && readBack.field_ref && readBack.my_authority.some((row) => row.participant_ref === envelope.publisher_participant_ref && row.role === "contributor"), "The field-scoped participant (identity human:desktop-walk) holds contributor authority in the Expression's own field", {field_ref: readBack.field_ref, authority: readBack.my_authority});
  log(`walk rows in ${target}: projection ${envelope.projection_ref}; entry ${expressionRef}; participant ${envelope.publisher_participant_ref} (identity human:desktop-walk)`);

  // ---- Open in Explore: the exact projected representation/ref ----
  const t3 = Date.now();
  await share.getByRole("button", {name: "Open in Explore"}).click();
  await explore.waitFor({timeout: 15000});
  const exprBody = explore.locator(`.presentation-body[data-presentation-state="hosted"][data-entry-ref="${expressionRef}"]`);
  await exprBody.waitFor({timeout: 60000});
  metric("open_in_explore_ms", Date.now() - t3);
  const exprAttrs = await exprBody.evaluate((el) => ({...el.dataset}));
  check(exprAttrs.projectionRef === envelope.projection_ref && Number(exprAttrs.projectionRevision) === envelope.projection_revision && exprAttrs.expressionRef === expressionRef && Number(exprAttrs.expressionRevision) === doc.revision && exprAttrs.sourceRevision === String(doc.revision), "Explore presents the exact projected representation: same projection ref/revision, same Expression ref/revision", {dom: exprAttrs});
  const expressionElement = exprBody.locator(`[data-expression-ref="${expressionRef}"][data-expression-state]`).first();
  await page.waitForFunction((ref) => { const el = document.querySelector(`.presentation-body [data-expression-ref="${CSS.escape(ref)}"][data-expression-state]`); return el && el.dataset.expressionState !== "" && !el.querySelector('[role="status"]'); }, expressionRef, {timeout: 30000}).catch(() => {});
  const expressionState = await expressionElement.getAttribute("data-expression-state");
  const stage = (await channel("read.stage")).data;
  const livePresentation = stage.presentations.find((pr) => pr.id.startsWith("explore:"));
  check(expressionState === "live" ? Boolean(livePresentation) : expressionState === "fallback", `The Expression body renders ${expressionState === "live" ? "live on this window's stage" : "its explicit safe fallback"} — never an unexplained blank`, {state: expressionState, stage_presentation: livePresentation ?? null, hosting: await expressionElement.getAttribute("data-expression-hosting")});
  check((await explore.locator(".world-presentation").count()) === 1 && (await explore.locator(".explore-subject strong").innerText()) === "SF1 walk field", "The Expression's WorldPresentation is the main body under its own title", {});
  await shot("explore-expression-live-or-fallback");
  // Watch / availability where the field supports it (the walk's own field grants contributor authority).
  const watch = explore.locator(".explore-watch");
  const watchState = await watch.getAttribute("data-watch-state");
  if (watchState === "none") {
    await watch.click();
    await page.waitForFunction(() => document.querySelector(".explore-watch")?.getAttribute("data-watch-state") === "active", null, {timeout: 60000}).catch(() => {});
  }
  check(["active", "unavailable"].includes(await watch.getAttribute("data-watch-state")), "Watch state is shown from the client's own rows, and placing a Watch (where the field grants it) lands", {watch_state: await watch.getAttribute("data-watch-state"), title: await watch.getAttribute("title")});
  // Leaving the subject releases the live presentation (no hidden GPU work).
  await explore.getByRole("button", {name: "Return to the field"}).click();
  await explore.locator('[data-field-state="available"]').waitFor({timeout: 10000});
  const stageAfter = (await channel("read.stage")).data;
  check(!stageAfter.presentations.some((pr) => pr.id.startsWith("explore:")), "Returning to the field releases the Explore presentation from the stage", {presentations: stageAfter.presentations});

  // ---- offline / unavailable field is honest and erases nothing ----
  const offline = await withUnboundBridge(p.cradleRoot, p.env, async (url) => {
    const other = await page.context().newPage();
    await other.addInitScript((u) => { window.__OI_KERNEL_BRIDGE__ = u; sessionStorage.setItem("oi-cradle.welcome.v1", "walk-continuing-session"); }, url);
    try {
      await other.goto(baseUrl);
      await other.getByRole("region", {name: "Explore"}).waitFor({timeout: 20000});
      const off = other.getByRole("region", {name: "Explore"});
      await off.getByRole("button", {name: "Return to the field"}).click().catch(() => {});
      await off.locator('[data-field-state="unavailable"]').waitFor({timeout: 60000});
      const detail = await off.locator('[data-field-state="unavailable"] [role="status"]').innerText();
      const availability = await off.locator(".explore-availability").getAttribute("data-availability");
      const localStill = (await other.locator(`.tab`).evaluateAll((els) => els.map((el) => el.dataset.surfaceId)));
      await other.screenshot({path: join(p.cradleRoot, "walk/artifacts", "explore-sf1-offline-honest.png")});
      return {detail, availability, localStill};
    } finally { await other.close(); }
  });
  check(offline.detail.includes("no SharedField target bound") && offline.availability === "unavailable" && centralBefore.every((t) => offline.localStill.includes(t.id)), "With no hosting target the field is honestly unavailable, names the client's reason, and the local tabs are still there", {offline});

  const events = (await channel("read.events", [0])).data.receipts;
  check(!JSON.stringify(events).includes(OWNER_OPERATION), "Hosted reads are pulls: the kernel event log carries no Shared Field receipt", {events: events.length});
  metric("kernel_events_total", events.length);
}
