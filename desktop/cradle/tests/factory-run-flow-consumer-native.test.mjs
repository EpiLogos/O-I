// Genuine native association/Central process captures are mandatory. This
// cannot pass with a missing capture, invented owner response, or ignored test.
// Run with OI_NATIVE_FACTORY_FLOW_CAPTURES=<allocated T phase root containing
// before/, retained/, changed/, replaced/> and the existing ts-register.mjs loader.
import test from "node:test";
import {register} from "node:module";
register("./factory-flow-native-raw-hook.mjs", import.meta.url);
import assert from "node:assert/strict";
import {readFileSync, existsSync} from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
import {decodeRunFlowReading, observeRunFlow, runFlowObservationKey} from "../src/contributions/factory/desk/runFlow.ts";
import {deskCard} from "../src/contributions/factory/desk/runModel.ts";
import {validBinding} from "../src/surface/layout-codec.mjs";
import {ownerRunComplete} from "../src/contributions/factory/live/eventMap.ts";
const {assertFlowInstanceIdentity, flowInstanceFromReading, matchesFlowInstanceOpen, FlowDocumentIdentityError} = await import("../src/flow/instances.ts");
const root = process.env.OI_NATIVE_FACTORY_FLOW_CAPTURES;
assert.ok(root && path.isAbsolute(root), "genuine native Flow consumer captures are required");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const loadPhase = phase => {
  const folder = path.join(root, phase);
  // The existing genuine Rust gate preserves raw ActionResults and exact
  // process output files. The read-only capture driver preserves the native
  // data after the same envelope validation. Neither format invents a basis.
  const nativeGate = !existsSync(path.join(folder, "capture.json"));
  const m = JSON.parse(readFileSync(path.join(folder, nativeGate ? "manifest.json" : "capture.json"), "utf8"));
  assert.equal(m.schema, "oi.factory-run-flow-native-phase/v1");
  if (nativeGate) {
    assert.equal(m.phase, phase); assert.equal(m.controlledIsolatedOwner, true);
    assert.equal(m.modelOpened, false); assert.equal(m.humanAnswer, false);
    assert.equal(m.credentialsCopied, false); assert.equal(m.repairRunTouched, false);
    for (const owner of [m.factory, m.central]) {
      assert.equal(owner.sha256Before, owner.sha256After);
      assert.equal(owner.sha256, owner.sha256Before);
    }
    assert.equal(m.factory.stateSha256Before, m.factory.stateSha256After);
    assert.ok(m.versions["factory-version"].reading && m.versions["central-version"].reading);
  } else {
    assert.equal(m.controlledNativeOwner, true); assert.equal(m.modelInvoked, false);
    assert.equal(m.actualHumanWorldReply, false); assert.equal(m.credentialsIncluded, false);
    assert.ok(m.factory.reportedVersion && m.central.reportedVersion);
  }
  assert.match(m.factory.sha256, /^[0-9a-f]{64}$/); assert.match(m.central.sha256, /^[0-9a-f]{64}$/);
  const bytes = entry => {
    assert.ok(entry, `missing actual ${phase} capture`);
    assert.equal(path.basename(entry.file), entry.file, "capture paths stay in the phase");
    const data = readFileSync(path.join(folder, entry.file)); assert.equal(hash(data), entry.sha256);
    return data;
  };
  const argv = JSON.parse(nativeGate ? bytes(m.operations) : readFileSync(path.join(folder, "operations.json"), "utf8"));
  assert.equal(argv.length, 6); assert.ok(argv.every(row => row.exitCode === 0));
  assert.equal(argv.filter(row => row.argv.includes("--version")).length, 2);
  assert.ok(argv.some(row => row.argv.includes("central.flow.read")));
  assert.ok(argv.some(row => row.argv.includes("central.files.read")));
  if (nativeGate) for (const row of argv) { bytes(row.stdout); bytes(row.stderr); }
  const read = key => JSON.parse(bytes(m.files[key]));
  const data = (reading, action) => {
    if (!nativeGate) return reading;
    assert.equal(reading.ok, true); assert.equal(reading.status, "success"); assert.equal(reading.action, action);
    assert.ok(reading.data); return reading.data;
  };
  const run = read("run"), sibling = read("sibling");
  const flow = data(read("flow"), "central.flow.read"), file = data(read("file"), "central.files.read");
  assert.equal(file.schema, "central.file-reading/v1");
  assert.equal(file.revision, flow.revision); assert.deepEqual(file.location, flow.location);
  return {m, rawRun: run, rawSibling: sibling, run: decodeRunFlowReading(run, m.factory.runRef), sibling: decodeRunFlowReading(sibling, m.factory.siblingRunRef), flow, file};
};
const before = loadPhase("before"), retained = loadPhase("retained"), changed = loadPhase("changed"), replaced = loadPhase("replaced");
const relation = retained.run.flowAssociations[0];
assert.equal(retained.run.flowAssociations.length, 1);

test("an exact native per-Run relation survives refresh; sibling ancestry supplies none", () => {
  for (const phase of [retained, changed, replaced]) {
    assert.deepEqual(phase.run.flowAssociations, retained.run.flowAssociations);
    assert.ok(!phase.sibling.flowAssociations?.length);
    assert.equal(phase.run.revision, retained.run.revision);
    assert.equal(phase.run.nativeAttempts?.completionVerified, false);
    assert.equal(ownerRunComplete(phase.run.nativeAttempts, phase.run.runRef), false);
    const source = {statePath: phase.m.factory.statePath, projectRef: phase.run.projectRef};
    assert.notEqual(deskCard(source, phase.run).state, "success");
  }
});
test("actual current native Flow reads distinguish retained, changed and replaced bases", () => {
  assert.equal(observeRunFlow(relation, retained.flow).state, "matching");
  assert.equal(observeRunFlow(relation, changed.flow).state, "changed");
  assert.equal(observeRunFlow(relation, replaced.flow).state, "replaced");
  assert.notEqual(changed.flow.revision, retained.flow.revision);
  assert.equal(changed.flow.document_id, retained.flow.document_id);
  assert.notEqual(replaced.flow.document_id, retained.flow.document_id);
  assert.equal(JSON.stringify(relation), JSON.stringify(retained.run.flowAssociations[0]));
});
test("provider advance changes the observation key even when topology does not", () => {
  assert.ok(!before.run.flowAssociations?.length);
  assert.equal(retained.run.provenance.factoryStateRevision, before.run.provenance.factoryStateRevision + 1);
  assert.equal(retained.run.revision, before.run.revision);
  assert.notEqual(runFlowObservationKey(before.run, before.m.factory.statePath, relation),
    runFlowObservationKey(retained.run, retained.m.factory.statePath, relation));
  assert.notEqual(runFlowObservationKey(retained.run, "foreign-provider-state", relation),
    runFlowObservationKey(retained.run, retained.m.factory.statePath, relation));
});
test("a foreign, malformed or providerless association cannot become a Run entry", () => {
  for (const mutate of [
    row => {row.flowAssociations[0].runRef = retained.sibling.runRef;},
    row => {row.flowAssociations[0].journeyRef = "journey:foreign";},
    row => {row.flowAssociations[0].workflowSourceDigest = "not-an-exact-source-digest";},
    row => {row.flowAssociations[0].flow.location.path = "Control/user/flows/../foreign.html";},
    row => {row.flowAssociations[0].flow.documentRevision = -1;},
    row => {delete row.provenance;},
    row => {row.provenance.owner = "foreign";},
    row => {row.flowAssociations.push(row.flowAssociations[0]);},
  ]) {
    const hostile = structuredClone(retained.run); mutate(hostile);
    assert.throws(() => decodeRunFlowReading(hostile, retained.run.runRef));
  }
});
test("foreign/invalid Flow observations are refused; same-document source changes never rewrite history", () => {
  for (const mutate of [
    row => {row.location.ref = "central:path:foreign";},
    row => {row.document_revision = -1;},
    row => {row.private_collections_included = true;},
    row => {row.format_version = 3;},
  ]) {
    const hostile = structuredClone(retained.flow); mutate(hostile);
    assert.throws(() => observeRunFlow(relation, hostile));
  }
  assert.deepEqual(retained.run.flowAssociations, changed.run.flowAssociations);
});

test("the ordinary opener checks genuine current file bytes and refuses a different document", () => {
  assert.doesNotThrow(() => assertFlowInstanceIdentity(retained.file, relation.flow.documentId));
  assert.doesNotThrow(() => assertFlowInstanceIdentity(changed.file, relation.flow.documentId));
  assert.throws(() => assertFlowInstanceIdentity(replaced.file, relation.flow.documentId), /different Flow/);
  assert.doesNotThrow(() => assertFlowInstanceIdentity(replaced.file), "ordinary navigator opens retain their prior behavior");
});

// These are the production read/dedup boundaries used by CradleFrame and
// FlowSurface. The inputs below are actual captured native file bytes;
// this proves consumer identity admission, not renderer timing or UI clicks.
test("the bound surface's independent initial and subsequent reads refuse a replacement after an accepted opening read", () => {
  const expected = relation.flow.documentId;
  assertFlowInstanceIdentity(retained.file, expected); // the frame's earlier native read
  const initial = flowInstanceFromReading(retained.file, relation.flow.location, expected);
  const changedSameDocument = flowInstanceFromReading(changed.file, relation.flow.location, expected);
  assert.equal(initial.doc.meta.documentId, expected);
  assert.equal(initial.revision, retained.file.revision);
  assert.equal(changedSameDocument.doc.meta.documentId, expected);
  assert.equal(changedSameDocument.revision, changed.file.revision);
  assert.notEqual(initial.revision, changedSameDocument.revision);
  assert.throws(() => flowInstanceFromReading(replaced.file, relation.flow.location, expected), FlowDocumentIdentityError);
  // An ordinary navigator read remains free to open the actual current document.
  assert.equal(flowInstanceFromReading(replaced.file, relation.flow.location).doc.meta.documentId, replaced.flow.document_id);
  assert.equal(initial.doc.meta.documentId, expected, "refusal preserves the previously loaded document basis");
});
test("a Run opening cannot reuse a different bound document or an unpinned navigator surface at the same native location", () => {
  const row = {name: relation.flow.documentId, location: relation.flow.location, expectedDocumentId: relation.flow.documentId};
  const retainedBinding = {kind: "flow", location: relation.flow.location, flow: {flowRef: relation.flow.documentId, path: relation.flow.location.path, expectedDocumentId: relation.flow.documentId}};
  const replacedBinding = {...retainedBinding, flow: {...retainedBinding.flow, expectedDocumentId: replaced.flow.document_id}};
  const navigatorBinding = {...retainedBinding, flow: {flowRef: relation.flow.documentId, path: relation.flow.location.path}};
  assert.equal(matchesFlowInstanceOpen(retainedBinding, row), true);
  assert.equal(matchesFlowInstanceOpen(replacedBinding, row), false);
  assert.equal(matchesFlowInstanceOpen(navigatorBinding, row), false);
  const navigatorRow = {name: row.name, location: row.location};
  assert.equal(matchesFlowInstanceOpen(navigatorBinding, navigatorRow), true, "ordinary navigator reuse keeps its prior unpinned contract");
  assert.equal(matchesFlowInstanceOpen(retainedBinding, navigatorRow), false, "a pinned Run surface keeps its independent draft and identity");
  assert.equal(matchesFlowInstanceOpen({...retainedBinding, kind: "file"}, row), false);
});

test("actual layout restoration preserves a Run document pin and cannot reopen its replacement unpinned", () => {
  const raw = {id: "native-capture-run-flow-surface", kind: "flow", title: relation.flow.documentId, ref: relation.flow.location.ref, location: relation.flow.location, flow: {flowRef: relation.flow.documentId, path: relation.flow.location.path, expectedDocumentId: relation.flow.documentId}};
  const restored = validBinding(JSON.parse(JSON.stringify(raw)));
  assert.ok(restored);
  assert.equal(restored.flow.expectedDocumentId, relation.flow.documentId);
  assert.equal(matchesFlowInstanceOpen(restored, {name: raw.title, location: raw.location, expectedDocumentId: relation.flow.documentId}), true);
  assert.throws(() => flowInstanceFromReading(replaced.file, restored.location, restored.flow.expectedDocumentId), FlowDocumentIdentityError);
  for (const expectedDocumentId of ["", 7, null]) assert.equal(validBinding({...raw, flow: {...raw.flow, expectedDocumentId}}), null);
  const unpinned = {...raw, flow: {flowRef: raw.flow.flowRef, path: raw.flow.path}};
  const legacy = validBinding(JSON.parse(JSON.stringify(unpinned)));
  assert.ok(legacy);
  assert.equal(legacy.flow.expectedDocumentId, undefined);
  assert.equal(flowInstanceFromReading(replaced.file, legacy.location, legacy.flow.expectedDocumentId).doc.meta.documentId, replaced.flow.document_id);
});

// This case requires the actual native opaque-Source regression captures.
// Expected strings are the exact authored test source admitted by the owner;
// no owner response or successful association is manufactured here.
test("the real typed consumer preserves opaque native origin and successor Source revision bytes", () => {
  const origin = "native  Flow\tsource revision v1%20@basis:é";
  const successor = "explicit  native\trelation successor v2%20@basis:é";
  for (const phase of [before, retained, changed, replaced]) {
    const current = decodeRunFlowReading(phase.rawRun, phase.m.factory.runRef);
    const original = decodeRunFlowReading(phase.rawSibling, phase.m.factory.siblingRunRef);
    assert.equal(current.nativeAttempts.workflowSourceRevision, successor);
    assert.equal(original.nativeAttempts.workflowSourceRevision, origin);
    for (const association of current.flowAssociations ?? []) {
      assert.equal(association.workflowSourceRevision, successor);
      assert.deepEqual(Buffer.from(association.workflowSourceRevision, "utf8"), Buffer.from(successor, "utf8"));
      assert.equal(association.workflowSourceRevision, phase.rawRun.flowAssociations[0].workflowSourceRevision);
    }
  }
  assert.equal(relation.workflowSourceRevision, successor);
  assert.equal(JSON.parse(runFlowObservationKey(retained.run, retained.m.factory.statePath, relation))[5], successor);
  const blank = structuredClone(retained.rawRun);
  blank.flowAssociations[0].workflowSourceRevision = " \t\n";
  assert.throws(() => decodeRunFlowReading(blank, retained.m.factory.runRef), /malformed Flow association/);
});
