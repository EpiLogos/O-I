/** The parent-join acceptance walk: one generated Point-Cloud artifact enters
 * the running desktop through the EXISTING import path and engine, the
 * graph/Wiki/Expression shared selection moves over exact native refs,
 * Surface portals open and degrade honestly through the real host, the verso
 * reads the same identity without releasing the stage, and an ExpressiveAct
 * runs, holds, checkpoints and restores — all driven through the same
 * KernelOp seam the Tauri host fronts. No corpus-specific runtime code: the
 * Bimba fixture is the external sandbox's own output, read from the committed
 * byte copy. */
import {createServer} from "vite";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
export {setup} from "./expression-page.mjs";
import {bindDefaultCentral} from "../editor-doc.mjs";

const cradleRoot = fileURLToPath(new URL("../../", import.meta.url));

async function convertArtifact(artifact, expressionRef, title) {
  const server = await createServer({ root: cradleRoot, appType: "custom", server: { middlewareMode: true }, logLevel: "error" });
  try {
    const mod = await server.ssrLoadModule("/src/expression/artifactImport.ts");
    return mod.artifactToExpression(expressionRef, artifact, title);
  } finally {
    await server.close();
  }
}

export default async function run({ page, baseUrl, bridgeUrl, check, metric, shot, channel, provision }) {
  const op = async (opName, request) => {
    const response = await fetch(`${bridgeUrl}/op`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: opName, request }) });
    const envelope = await response.json();
    if (!envelope.ok) throw new Error(JSON.stringify(envelope));
    return envelope.outcome?.data ?? envelope.outcome;
  };
  const expression = (request) => op("expression", request);

  // 1 — the generated artifact enters through the existing import path and
  // opens in the kernel as an ordinary oi.expression/v1 document.
  const bimba = JSON.parse(readFileSync(new URL("../../tests/fixtures/generated-artifacts/bimba-path-proof-fixture.expression.json", import.meta.url), "utf8"));
  const imported = await convertArtifact(bimba, "expression:join-bimba", "Bimba path-proof (join walk)");
  const doc = imported.document;
  const entityRefs = Object.keys(doc.entities);
  check(doc.schema === "oi.expression/v1" && doc.revision === 1 && entityRefs.length === 4, "The generated Bimba artifact imports as an ordinary oi.expression/v1 document", { schema: doc.schema, entities: entityRefs.length });
  const opened = await expression({ operation: "open", document: doc, actor: "agent:join-walk" });
  check(opened.document.expression_ref === "expression:join-bimba" && opened.document.revision === 1, "The opened document keeps the artifact's exact identity and revision");
  const sceneRefs = opened.document.scenes.map((s) => s.scene_ref);
  metric("artifact_scenes", sceneRefs.length);

  // 2 — one shared selection relation: the graph origin moves the Expression
  // selection over exact refs, and the global focus moves with it.
  const subjectRef = "central:project:ExpressionPage";
  const sourceRef = "central:source:work/expression-page";
  let revision = opened.document.revision;
  const bound = await expression({ operation: "edit", expression_ref: doc.expression_ref, expected_revision: revision, actor: "human:join-walk", changes: [{ change: "subject_bind", entity_ref: entityRefs[0], binding: { subject_ref: subjectRef, native_owner: "central", presentation_role: "thing", sources: [{ ref: sourceRef, revision: "source@1", availability: "available" }], readings: [], actions: [] } }] });
  revision = bound.document.revision;
  const selection = await op("expression_world", { operation: "selection_set", origin: "graph", subject_ref: subjectRef, kind: "project", native_owner: "central", revision: "source@1", activity_ref: null, expression_ref: doc.expression_ref });
  check(selection.state === "selected" && selection.expression?.state === "focused" && selection.expression?.entity_ref === entityRefs[0], "A graph-origin selection focuses the exact bound entity through the shared refs", selection);
  const log = await (await fetch(`${bridgeUrl}/events?since=0`)).json();
  const receipts = log.receipts ?? [];
  check(receipts.some((receipt) => receipt.event === "focus_changed" && JSON.stringify(receipt).includes(subjectRef)), "The shared selection moves the one global focus to the same native subject", receipts.slice(-2).map((r) => r.event));

  // 3 — the reciprocal direction: an Expression focus edit is the same
  // shared selection, origin-attributed, with no minted identity.
  const otherEntity = entityRefs[1];
  const focused = await expression({ operation: "edit", expression_ref: doc.expression_ref, expected_revision: revision, actor: "human:join-walk", changes: [{ change: "focus", scene_ref: sceneRefs[0], entity_ref: otherEntity }] });
  revision = focused.document.revision;
  const readBack = await op("expression_world", { operation: "selection_read" });
  // The focused entity is unbound, so the shared selection names the
  // Expression itself as the subject (the contract's "or the Expression when
  // unbound") — the same one relation, origin-attributed.
  check(readBack.state === "selected" && readBack.selection?.origin === "expression" && readBack.selection?.subject_ref === doc.expression_ref, "An Expression focus edit updates the same shared selection", readBack);

  // 4 — Surface portals through the real host: honest degradation for an
  // unavailable target, a real open/inspect/re-dock/close cycle otherwise.
  const refused = await op("expression_world", { operation: "portal_open", portal_ref: "portal:join-refused", target_ref: sourceRef, surface_kind: "file", surface_id: "surface:join-refused", placement: "overlay", title: "unread source", actor: "agent:join-walk" });
  check(refused.state === "unavailable_surface" && refused.target_ref === sourceRef, "A portal over an unavailable target names the host's own refusal instead of fabricating a surface", refused);
  const portal = await op("expression_world", { operation: "portal_open", portal_ref: "portal:join-1", target_ref: sourceRef, surface_kind: "source", surface_id: "surface:join-1", placement: "detached", title: "project source", actor: "agent:join-walk" });
  check(portal.state === "portal_open" && portal.portal?.placement === "detached" && portal.portal?.target_ref === sourceRef, "A portal opens detached through the existing kernel Surface host with the exact target ref", portal);
  const inspected = await op("expression_world", { operation: "portal_inspect", target_ref: null });
  check(inspected.state === "portals" && inspected.portals?.some((p) => p.portal_ref === "portal:join-1"), "Portal inspect lists the live portal over the same ref");
  const redocked = await op("expression_world", { operation: "portal_redock", portal_ref: "portal:join-1", actor: "agent:join-walk" });
  check(redocked.state === "portal_redocked", "A detached portal re-docks back into the frame with the same binding");
  await op("expression_world", { operation: "portal_close", portal_ref: "portal:join-1", actor: "agent:join-walk" });
  const afterClose = await op("expression_world", { operation: "portal_inspect", target_ref: null });
  check(afterClose.portals?.length === 0, "Portal close releases the binding through the same host");

  // 5 — an ExpressiveAct is one atomic structured edit that can be held,
  // checkpointed and restored over exact revisions.
  const pin = entityRefs.find((ref) => ref.includes("pin")) ?? entityRefs[0];
  const act = await op("expression_world", { operation: "act_perform", act_ref: "act:join-1", expression_ref: doc.expression_ref, expected_revision: revision, summary: "foreground the still centre", actor: "agent:join-walk", activity_ref: "activity:join-1", changes: [{ change: "parameter_set", entity_ref: pin, parameter: "scale", value: 1.4 }] });
  check(act.state === "act_running" && act.act?.basis_revision === revision, "A structured act performs as one atomic edit over the exact basis revision", act);
  const held = await op("expression_world", { operation: "act_interrupt", act_ref: "act:join-1", actor: "human:join-walk", reason: "owner holds the act" });
  check(held.state === "act_held", "Human interruption holds the act without reverting or advancing it");
  await op("expression_world", { operation: "act_checkpoint", act_ref: "act:join-1", checkpoint_ref: "checkpoint:join-1", actor: "agent:join-walk" });
  revision = (await expression({ operation: "inspect", expression_ref: doc.expression_ref })).document.revision;
  const drifted = await expression({ operation: "edit", expression_ref: doc.expression_ref, expected_revision: revision, actor: "human:join-walk", changes: [{ change: "parameter_set", entity_ref: pin, parameter: "scale", value: 2 }] });
  revision = drifted.document.revision;
  const restored = await op("expression_world", { operation: "act_restore", act_ref: "act:join-1", checkpoint_ref: "checkpoint:join-1", expected_revision: revision, actor: "agent:join-walk" });
  const restoredScale = restored.expression?.document?.entities?.[pin]?.parameters?.scale?.value;
  check(restored.state === "act_restored" && restoredScale === 1.4, "Checkpoint restore returns the exact document through a revision advance", { scale: restoredScale, revision: restored.expression?.document?.revision });

  // 6 — the real UI: the compose surface presents the artifact through the
  // one Global Expression Stage, flips to the verso reading of the SAME
  // identity, and returns to the same canvas.
  await page.goto(baseUrl);
  await channel("info");
  await bindDefaultCentral(page, provision.root);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("oi:expression-compose", { detail: {} })));
  const editor = page.getByRole("region", { name: "Expression composition" });
  await editor.getByLabel("Open Expression").selectOption(doc.expression_ref);
  check(await editor.getAttribute("data-expression-ref") === doc.expression_ref, "The compose surface addresses the imported artifact by its exact ref");
  await editor.getByRole("button", { name: "Present on stage" }).click();
  await page.locator(".expression-stage-host canvas").waitFor();
  const stage = (await channel("read.stage")).data;
  check(stage.presentations?.some((item) => item.id === "expression-application"), "The generated artifact presents through the one Global Expression Stage", stage.presentations?.map((item) => item.id));
  const canvas = page.locator(".expression-stage-host canvas");
  await canvas.evaluate((element) => { element.dataset.joinIdentity = "one-canvas"; });
  await editor.getByRole("button", { name: "Flip to verso" }).click();
  const verso = page.locator(".expression-verso");
  await verso.waitFor();
  check(await editor.getAttribute("data-face") === "verso", "Flip presents the verso over the same Expression identity");
  check(await verso.getAttribute("data-expression-ref") === doc.expression_ref, "The verso names the exact expression ref");
  check(await verso.locator(`[data-subject-ref="${subjectRef}"]`).count() === 1, "The verso reads the same bound subject with its native ref");
  check(await verso.locator(`[data-source-ref="${sourceRef}"]`).count() === 1, "The verso discloses the exact source ref and availability");
  const versoStage = (await channel("read.stage")).data;
  check(versoStage.presentations?.some((item) => item.id === "expression-application"), "Flipping to the verso does not release the stage presentation");
  await shot("join-verso");
  await editor.getByRole("button", { name: "Return to front" }).click();
  await page.locator(".expression-stage-host canvas[data-join-identity]").waitFor();
  check(await editor.getAttribute("data-face") === "front", "Returning to the front restores the living body");
  check(await canvas.getAttribute("data-join-identity") === "one-canvas", "Front/verso transitions reuse the same renderer canvas — no engine fork");
  await shot("join-front");

  // 7 — capability disclosure names the substrate contracts honestly.
  const capabilities = await expression({ operation: "capabilities" });
  check((capabilities.scene_body?.carriers?.length ?? 0) === 9 && capabilities.triggers?.script_bodies === "refused", "Capabilities disclose the carrier range and refuse script bodies", { carriers: capabilities.scene_body?.carriers?.length });
  metric("subject", 1);
}
