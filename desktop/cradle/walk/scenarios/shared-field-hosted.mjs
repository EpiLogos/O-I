// shared-field-hosted (Lane C step 5, unit U-SF1): the desktop opens the
// same hosted Shared Field refs the browser Explore page opens.
//
// Relation cell S→S0 · aperture mode: the hosted field is an owner read
// model the kernel pulls through the O:I-owned client
// (`shared-field/spacetimedb/field.sh`); the desktop invents no store, no
// second index, no identity. The walk drives the REAL app against the REAL
// hosted field named by OI_SHARED_FIELD_TARGET (the runner passes the
// process environment to the bridge; the renderer never sees a target or a
// token). Publishing lands real rows in that field — the walk's own rows,
// recognisable by the fixture project id `editor-walk` inside every ref it
// mints; it withdraws, overwrites and deletes nothing else.
//
// Checks: (a) rest — no Shared Field call before a graph is requested;
// (b) the kernel's status/read/absent path with the target bound, and the
// UNBOUND path through a second, target-less bridge boot the scenario
// spawns itself; (c) hosted node/edge counts equal the client's own
// snapshot counts (the field is live — other sessions publish to it — so
// the graph is compared with the snapshots taken directly before and after
// it); (d) a hosted wiki node opens in the Knowledge surface UI (the root
// register's wiki: the scratch project's own wiki has no AIKit SemanticWiki
// provider, the same absence the committed `knowledge` walk records) and
// its detail dialog reads projection_ref/revision; (e) a passage of
// the Editor ground publishes from the SharedFieldMaterial strip to the
// hosted field and reads back as `hosted`; (f) the browser Explore page on
// the hosting machine renders the same ref.
import {execFileSync, spawn} from "node:child_process";
import {join, resolve} from "node:path";
import {setup as sourceSetup} from "./editor.mjs";
import {bindDefaultCentral} from "../editor-doc.mjs";

const OWNER_OPERATION = "shared-field.projection";
const HOSTED_WIKI_NODE = "world:central:project:O-I/wiki:node:project-root/o-i";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function setup(args) {
  const p = await sourceSetup(args);
  // The Knowledge surface's wiki open reads through AIKit (as knowledge.mjs
  // provisions it); the Shared Field target is the runner's own environment.
  return {...p, cradleRoot: args.cradleRoot, env: {...p.env, AIKIT_HOME: join(p.root, ".aikit-home")}};
}

/** The owner doorway called directly from the walk (not through the
 * kernel): the same client the bridge spawns, for the field's own truth. */
function doorway(cradleRoot, request, env = process.env) {
  const script = resolve(cradleRoot, "../../shared-field/spacetimedb/field.sh");
  let stdout;
  try { stdout = execFileSync(script, {input: JSON.stringify(request), encoding: "utf8", env, stdio: ["pipe", "pipe", "ignore"]}); }
  catch (error) { stdout = error.stdout?.toString() ?? ""; }
  return JSON.parse(stdout);
}

async function selectRange(editor, start, end) {
  await editor.focus(); await editor.press("Meta+ArrowUp");
  for (let i = 0; i < start; i++) await editor.press("ArrowRight");
  for (let i = start; i < end; i++) await editor.press("Shift+ArrowRight");
}

/** A second walk bridge with NO Shared Field target in its environment —
 * the unbound path through the real kernel, which one runner boot with the
 * target bound cannot prove. Same binary, a different port. */
async function withUnboundBridge(cradleRoot, env, run) {
  const port = 4181;
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
    const post = async (body) => (await (await fetch(`${url}/op`, {method: "POST", body: JSON.stringify(body)})).json());
    return await run(post);
  } finally {
    try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
  }
}

export default async function run({page, baseUrl, check, metric, shot, channel, log, op, provision: p}) {
  const target = process.env.OI_SHARED_FIELD_TARGET;
  check(Boolean(target), "A hosting target is named in the walk environment (OI_SHARED_FIELD_TARGET) — the bridge inherits it; the renderer never does", {target: target ?? null});

  // Every kernel op the renderer posts, in order — the rest proof is data.
  const ops = [];
  page.on("request", (request) => { if (request.url().endsWith("/op") && request.method() === "POST") { try { ops.push(request.postDataJSON().op); } catch { /* non-JSON */ } } });

  await page.goto(baseUrl); await channel("info");
  const chooser = page.getByRole("region", {name: "Central location"});
  if (await chooser.isVisible().catch(() => false)) await bindDefaultCentral(page, p.root);
  const nav = page.getByRole("complementary", {name: "World navigator"});
  const showNav = async () => { if (!await nav.isVisible()) await page.keyboard.press("Meta+b"); };

  // (a) rest: nothing reaches the Shared Field client before a graph is asked for.
  const restEvents = (await channel("read.events", [0])).data.receipts;
  check(ops.filter((name) => name === "shared_field" || name === "graph").length === 0, "At rest the renderer has posted no shared_field or graph op — the hosted field is pulled only when a graph is requested", {ops_at_rest: [...new Set(ops)]});
  check(!JSON.stringify(restEvents).includes(OWNER_OPERATION), "The kernel event log carries no Shared Field receipt at rest (hosted reads are pulls; they emit nothing)", {events_at_rest: restEvents.length});

  // (b) the bound kernel path: status, an absent ref, the snapshot.
  const status = (await channel("invoke.kernel_op", [{op: "shared_field", request: {kind: "status"}}])).data.outcome.data;
  check(status.bound === true && status.target?.name === target, "Kernel shared_field status reports the bound target by its hosting.json name (no network, no token in the reading)", {status});
  check(!JSON.stringify(status).match(/token/i), "The status reading carries no token", {keys: Object.keys(status)});
  const absent = (await channel("invoke.kernel_op", [{op: "shared_field", request: {kind: "read", ref: "world:nobody"}}])).data.outcome.data;
  check(absent.state === "absent" && absent.ref === "world:nobody", "Reading a ref the field does not hold is an explicit `absent` reading, not an error", {absent});
  const t0 = Date.now();
  const snapshot = (await channel("invoke.kernel_op", [{op: "shared_field", request: {kind: "snapshot"}}])).data.outcome.data;
  metric("hosted_snapshot_ms", Date.now() - t0);
  check(snapshot.schema === "oi.shared-field.snapshot/v1" && snapshot.counts?.entries > 0, "The kernel pulls the client's own caller-visible snapshot", {counts: snapshot.counts, target: snapshot.target});
  const beforeCounts = snapshot.counts;

  // (b) the UNBOUND path, through a second kernel boot with no target.
  const unbound = await withUnboundBridge(p.cradleRoot, p.env, async (post) => ({
    graph: await post({op: "graph", query: ""}),
    read: await post({op: "shared_field", request: {kind: "snapshot"}}),
  }));
  const unboundInput = unbound.graph.outcome?.reading?.inputs?.shared_field;
  check(unboundInput?.state === "unavailable" && unboundInput.owner_operation === OWNER_OPERATION && String(unboundInput.detail).startsWith("no SharedField target bound"), "With no target bound the graph names the Shared Field input `unavailable` with the client's own reason — never an empty fabrication", {unbound_input: unboundInput});
  check((unbound.graph.outcome?.reading?.nodes ?? []).every((n) => n.native_owner !== "shared-field") && unbound.graph.outcome?.reading?.counts?.hosted_rows === 0, "With no target bound no hosted rows exist in the graph", {hosted_rows: unbound.graph.outcome?.reading?.counts?.hosted_rows});
  check(unbound.read.outcome?.data?.state === "unavailable" && String(unbound.read.outcome.data.detail).startsWith("no SharedField target bound"), "With no target bound a shared_field op returns `{state:\"unavailable\"}` as data, not an error", {unbound_read: unbound.read.outcome?.data});
  const doorwayUnbound = doorway(p.cradleRoot, {kind: "status"}, Object.fromEntries(Object.entries(process.env).filter(([k]) => !["OI_SHARED_FIELD_TARGET", "SPACETIMEDB_URI", "SPACETIMEDB_DATABASE"].includes(k))));
  check(doorwayUnbound.ok === true && doorwayUnbound.data?.bound === false, "The owner doorway itself reports `bound:false` without a target (the reason the kernel carries)", {doorway: doorwayUnbound});

  // (c) the graph carries the hosted field: one node per entry, one edge per relation.
  const t1 = Date.now();
  // The root register's graph, exactly what the UI opens below.
  const graph = (await channel("invoke.kernel_op", [{op: "graph", query: ""}])).data.outcome.reading;
  metric("graph_with_hosted_ms", Date.now() - t1);
  // The field is live: another session may publish between the snapshot
  // and the graph. The graph must equal the field as it stood at one of the
  // two moments bracketing it; both counts are recorded.
  const afterGraph = (await channel("invoke.kernel_op", [{op: "shared_field", request: {kind: "snapshot"}}])).data.outcome.data;
  const hostedNodes = graph.nodes.filter((n) => n.native_owner === "shared-field");
  const hostedEdges = graph.edges.filter((e) => e.provenance.source === OWNER_OPERATION);
  const targetLabel = `${snapshot.target.uri}/${snapshot.target.database}`;
  const bracket = (value, key) => value === beforeCounts[key] || value === afterGraph.counts[key];
  check(graph.inputs.shared_field.state === "available" && graph.inputs.shared_field.owner_operation === OWNER_OPERATION && graph.inputs.shared_field.detail === targetLabel, "The graph names the Shared Field input available at the hosting target", {input: graph.inputs.shared_field});
  check(bracket(hostedNodes.length, "entries") && graph.counts.hosted_rows === hostedNodes.length, "Hosted node count equals the snapshot's entry count", {hosted_nodes: hostedNodes.length, hosted_rows: graph.counts.hosted_rows, snapshot_entries_before: beforeCounts.entries, snapshot_entries_after: afterGraph.counts.entries});
  check(bracket(hostedEdges.length, "relations"), "Hosted edge count equals the snapshot's relation count", {hosted_edges: hostedEdges.length, snapshot_relations_before: beforeCounts.relations, snapshot_relations_after: afterGraph.counts.relations});
  check(hostedNodes.every((n) => n.kind.startsWith("hosted-") && n.provenance.source === OWNER_OPERATION && n.provenance.detail?.[0] === targetLabel && n.actions.length === 0), "Every hosted node carries kind `hosted-<entry kind>`, the owner operation, the target, and no invented Action", {kinds: [...new Set(hostedNodes.map((n) => n.kind))]});
  const grammars = [...new Set(hostedNodes.map((n) => n.ref.split(":")[0]))];
  check(!hostedNodes.some((n) => graph.nodes.some((o) => o !== n && o.ref === n.ref && o.native_owner !== "shared-field")), "Hosted refs (world-qualified projections, contribution refs) collide with no Central or AIKit node", {ref_grammars: grammars, sample: hostedNodes.slice(0, 3).map((n) => n.ref)});
  const hostedRefs = new Set(hostedNodes.map((n) => n.ref));
  check(hostedEdges.every((e) => hostedRefs.has(e.from_ref) && hostedRefs.has(e.to_ref)), "Every hosted edge joins two hosted refs verbatim", {relations: [...new Set(hostedEdges.map((e) => e.relation))]});

  // (d) the hosted wiki node opens in the Knowledge surface UI.
  const wikiEntry = snapshot.entries.find((e) => e.ref === HOSTED_WIKI_NODE) ?? snapshot.entries.find((e) => e.kind === "wiki-node");
  check(Boolean(wikiEntry), "The hosted field holds the O-I project-root wiki node (or another hosted wiki node) to open", {ref: wikiEntry?.ref ?? null, expected: HOSTED_WIKI_NODE});
  await showNav();
  await nav.getByRole("button", {name: "Central: wiki", exact: true}).click();
  await nav.getByRole("button", {name: "Central neighbourhood", exact: true}).click();
  await page.getByRole("region", {name: "Knowledge surface"}).waitFor({timeout: 30000});
  await page.waitForFunction(() => document.querySelector(".knowledge-surface")?.getAttribute("aria-busy") === "false", null, {timeout: 60000});
  check(await page.locator(`[data-knowledge-ref="${wikiEntry.ref}"]`).count() === 1, "The hosted wiki node is rendered in the running Knowledge surface by its hosted ref", {ref: wikiEntry.ref});
  const inputSummaries = await page.locator(".knowledge-inputs summary").allTextContents();
  check(!inputSummaries.some((s) => s.includes("Shared Field")), "The inputs strip does not report the Shared Field as unavailable or deferred while it is available", {non_available_inputs: inputSummaries});
  const worldEntries = graph.nodes.filter((n) => n.native_owner === "shared-field" && n.kind === "hosted-central-world");
  check(worldEntries.length === snapshot.entries.filter((e) => e.kind === "central-world").length, "Hosted worlds appear as hosted-central-world nodes", {worlds: worldEntries.map((n) => n.ref)});
  // The node's accessible control (keyboard path: focus + Enter, as a
  // screen-reader user opens it; the canvas paints over it for pointers).
  await page.locator(`[data-knowledge-ref="${wikiEntry.ref}"]`).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", {name: `Details: ${wikiEntry.label}`});
  await dialog.waitFor({timeout: 15000});
  await dialog.locator('[data-hosted-state="hosted"]').waitFor({timeout: 30000});
  const worldProjection = snapshot.projections.find((pr) => pr.subject?.ref === wikiEntry.world_ref);
  const projectionRows = await dialog.locator("[data-projection-ref]").evaluateAll((els) => els.map((el) => ({projection_ref: el.dataset.projectionRef, projection_revision: Number(el.dataset.projectionRevision), source_revision: el.dataset.sourceRevision})));
  check(Boolean(worldProjection) && projectionRows.some((r) => r.projection_ref === worldProjection.projection_ref && r.projection_revision === worldProjection.projection_revision && r.source_revision === worldProjection.source.revision), "The detail dialog reads the world's projection_ref, projection revision and source revision exactly as the field holds them", {dialog: projectionRows, field: worldProjection && {projection_ref: worldProjection.projection_ref, projection_revision: worldProjection.projection_revision, source_revision: worldProjection.source.revision}});
  const provenanceTarget = await dialog.locator("[data-hosted-target]").getAttribute("data-hosted-target");
  const provenanceRevision = await dialog.locator("[data-projection-revision]").first().getAttribute("data-projection-revision");
  const provenanceEntry = await dialog.locator("[data-entry-revision]").getAttribute("data-entry-revision").catch(() => null);
  check(provenanceTarget === targetLabel && provenanceRevision === String(worldProjection?.projection_revision) && provenanceEntry === (wikiEntry.revision ?? null), "The provenance block shows the hosting target and both revisions (projection and entry)", {target: provenanceTarget, projection_revision: provenanceRevision, entry_revision: provenanceEntry});
  const openInTab = dialog.getByRole("button", {name: "Open in tab"});
  check(await openInTab.isDisabled() && (await openInTab.getAttribute("title") ?? "").includes("No local address"), "`Open in tab` is disabled for a hosted node and says why (no local address)", {title: await openInTab.getAttribute("title")});
  check((await dialog.locator(".knowledge-owner").innerText()).startsWith("shared-field"), "The dialog names the native owner shared-field", {owner: await dialog.locator(".knowledge-owner").innerText()});
  await shot("hosted-node-detail");
  await page.keyboard.press("Escape");

  // (e) publish a passage of the Editor ground from the strip to the hosted field.
  const source = p.sources[0];
  const content = p.originals.get(source.binding.path);
  const passage = content.split("\n")[0].replace(/^#\s*[0-9]+\s*—\s*/, "").trim() || content.split("\n")[0].trim();
  const start = content.indexOf(passage);
  await showNav();
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button", {name: "Editor: files", exact: true}).click();
  await nav.locator(`[data-file-path="Work/Editor/${source.binding.path}"]`).click();
  const editor = page.locator(`.cm-content[data-source-ref="${source.binding.ref}"]`);
  await editor.waitFor({timeout: 15000});
  check(await page.locator(".shared-field-material").count() === 0, "No shared material is advertised before anything is published");
  await selectRange(editor, start, start + passage.length);
  await page.getByRole("button", {name: "Pick component for context", exact: true}).click();
  await page.getByRole("button", {name: "Add selected text to context", exact: true}).click();
  const tray = page.getByRole("dialog", {name: "Include selected context"}); await tray.waitFor();
  check((await tray.locator("pre").innerText()) === passage, "The tray holds the exact selected passage", {passage});
  await tray.getByRole("button", {name: "Publish to the shared field"}).click();
  await tray.waitFor({state: "detached"});
  const strip = page.locator(".shared-field-material"); await strip.waitFor();
  await strip.getByLabel("Publisher participant").fill("human:desktop-walk");
  await strip.getByLabel("Projection visibility").selectOption("public");
  await strip.getByRole("button", {name: "Publish projection"}).click();
  const published = strip.locator(".shared-field-published"); await published.waitFor();
  const envelope = JSON.parse(await published.getAttribute("data-projection"));
  check(envelope.schema === "oi.projection/v1" && envelope.state === "published" && envelope.subject.ref === source.binding.ref, "The composed envelope is a real oi.projection/v1 on the Editor source", {projection_ref: envelope.projection_ref, subject: envelope.subject.ref, source_revision: envelope.source.revision});
  const host = strip.locator(".shared-field-host");
  await host.waitFor({timeout: 15000});
  check((await host.getAttribute("data-hosted-target")) === targetLabel, "The hosted publish act appears only after the kernel reports a bound target, naming it", {target: await host.getAttribute("data-hosted-target")});
  const t2 = Date.now();
  await strip.getByRole("button", {name: "Publish to the hosted field"}).click();
  const hostedResult = strip.locator(".shared-field-hosted");
  await hostedResult.waitFor({timeout: 60000});
  metric("hosted_publish_ms", Date.now() - t2);
  const hosted = JSON.parse(await hostedResult.getAttribute("data-hosted-result"));
  check(hosted.schema === "oi.shared-field.hosted-result/v1" && hosted.hosted_projection_row.projectionRef === envelope.projection_ref && hosted.hosted_projection_row.projectionRevision === envelope.projection_revision && hosted.hosted_projection_row.state === "published" && hosted.hosted_projection_row.publisherParticipantRef === "human:desktop-walk", "The hosted result shows the hosted Projection row verbatim for the composed envelope", {hosted_projection_row: hosted.hosted_projection_row});
  check(hosted.target.name === target && hosted.entries.length === 1 && hosted.entries[0] === source.binding.ref, "The result names the target and the one Explore entry (ref = the subject ref)", {target: hosted.target, entries: hosted.entries});
  check((await hostedResult.innerText()).includes("not a human participant") && /^[0-9a-f]{64}$/.test(hosted.transport_identity), "The transport identity is shown labelled as transport, not as a human", {transport_identity: hosted.transport_identity});
  await shot("hosted-publish-result");
  const readBack = (await channel("invoke.kernel_op", [{op: "shared_field", request: {kind: "read", ref: source.binding.ref}}])).data.outcome.data;
  check(readBack.state === "hosted" && readBack.entry?.ref === source.binding.ref && readBack.entry.kind === "central.document" && readBack.projections.some((pr) => pr.projection_ref === envelope.projection_ref && pr.projection_revision === envelope.projection_revision && pr.source.revision === envelope.source.revision), "Reading the published ref through the kernel returns state `hosted` with the same projection_ref, projection revision and source revision", {ref: source.binding.ref, state: readBack.state, projections: (readBack.projections ?? []).map((pr) => ({projection_ref: pr.projection_ref, projection_revision: pr.projection_revision, source_revision: pr.source.revision}))});
  const readAlias = (await channel("invoke.kernel_op", [{op: "shared_field", request: {kind: "read", ref: envelope.projection_ref}}])).data.outcome.data;
  check(readAlias.state === "hosted" && readAlias.entry?.ref === source.binding.ref, "The projection ref resolves to the same hosted entry (entry alias)", {ref: envelope.projection_ref, state: readAlias.state});
  const after = (await channel("invoke.kernel_op", [{op: "shared_field", request: {kind: "snapshot"}}])).data.outcome.data;
  const lostEntries = snapshot.entries.map((e) => e.ref).filter((ref) => !after.entries.some((e) => e.ref === ref));
  const lostRelations = snapshot.relations.filter((r) => !after.relations.some((o) => o.from === r.from && o.to === r.to && o.relation === r.relation));
  const lostProjections = snapshot.projections.filter((pr) => !after.projections.some((o) => o.projection_ref === pr.projection_ref && o.projection_revision === pr.projection_revision && o.state === pr.state));
  check(after.projections.some((pr) => pr.projection_ref === envelope.projection_ref) && lostEntries.length === 0 && lostRelations.length === 0 && lostProjections.length === 0, "The field holds the walk's projection and lost nothing it held before (the walk's own entry upserts on re-runs; nothing else is withdrawn, overwritten or deleted)", {before: beforeCounts, after: after.counts, lost_entries: lostEntries, lost_relations: lostRelations.length, lost_projections: lostProjections.length});
  const fieldRef = `oi:field:desktop:${source.binding.ref.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
  check(after.fields.some((f) => f.field_ref === fieldRef && f.kind === "explore") && after.participants.some((pt) => pt.participant_ref === "human:desktop-walk" && pt.field_ref === fieldRef && pt.identity?.kind === "human"), "The desktop's field and the publisher participant exist in the hosted field under owner contracts", {field_ref: fieldRef});
  log(`walk rows in ${target}: field ${fieldRef}; participant human:desktop-walk; projection ${envelope.projection_ref}; entry ${source.binding.ref}`);

  // (f) the browser Explore page on the hosting machine renders the same ref.
  const exploreBase = process.env.OI_SHARED_FIELD_EXPLORE_URL ?? `http://${new URL(snapshot.target.uri).hostname}:4180/explore.html`;
  const exploreUrl = `${exploreBase}?ref=${encodeURIComponent(source.binding.ref)}&spacetimedb_uri=${encodeURIComponent(snapshot.target.uri)}&spacetimedb_database=${encodeURIComponent(snapshot.target.database)}`;
  const explore = await page.context().newPage();
  let exploreText = "";
  try {
    await explore.goto(exploreUrl, {timeout: 30000});
    await explore.waitForTimeout(6000);
    exploreText = await explore.locator("main").innerText({timeout: 10000}).catch(async () => explore.locator("body").innerText());
    await op("capture.screenshot", async () => { const file = "shared-field-hosted-explore-same-ref.png"; await explore.screenshot({path: join(p.cradleRoot, "walk/artifacts", file)}); return {file, page: "explore (hosting machine)"}; });
  } catch (error) { log(`explore page: ${error}`); }
  const title = String(envelope.representation?.payload?.title ?? "");
  check(exploreText.includes(title) && exploreText.includes(source.binding.ref), "The hosting machine's Explore page renders the same ref by its hosted label — one semantic object, two surfaces", {explore_url: exploreUrl, label: title, matched_text: exploreText.split("\n").filter((line) => line.includes(title) || line.includes(source.binding.ref)).slice(0, 4)});
  await explore.close();
  // (f) continued: the desktop opens that same ref through its graph.
  const graphAfter = (await channel("invoke.kernel_op", [{op: "graph", query: ""}])).data.outcome.reading;
  const publishedNode = graphAfter.nodes.find((n) => n.native_owner === "shared-field" && n.ref === source.binding.ref);
  check(Boolean(publishedNode) && publishedNode.kind === "hosted-central.document" && publishedNode.provenance.detail?.[1] === envelope.source.revision, "The desktop graph now opens the published ref as a hosted node carrying the source revision", {node: publishedNode && {ref: publishedNode.ref, kind: publishedNode.kind, provenance: publishedNode.provenance}});
  metric("kernel_events_total", (await channel("read.events", [0])).data.receipts.length);
}
