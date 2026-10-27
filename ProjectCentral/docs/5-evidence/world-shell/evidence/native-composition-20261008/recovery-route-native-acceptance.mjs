/** Actual app/host/native-owner routing, with personal owner reads only.
 * All journal writes and semantic edits use a disposable native OI_HOME.
 * MessageChannel is a protocol harness, not a GUI or craft acceptance. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {join} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
const arg = name => { const i = process.argv.indexOf(name); if (i < 0 || !process.argv[i + 1]) throw Error(`Pass ${name}`); return process.argv[i + 1]; };
const seat = arg('--seat'), personalUrl = arg('--kernel-url'), binary = arg('--kernel-bin'), configPath = arg('--config');
const base = fileURLToPath(new URL('.', import.meta.url));
const sha = value => createHash('sha256').update(value).digest('hex');
const sourcePaths = ['nativeRecovery.ts', 'recovery.ts', 'nativeWorkspace.ts', 'app.ts', 'nativeWorking.ts', 'kernelExpressions.ts', 'kernelDocumentBridge.ts', 'kernelComposition.ts', 'model.ts', 'nativeSelectionQueue.ts', 'nativeOpenIntent.ts', 'nativeFollow.ts', 'worldChannel.ts'].map(name => join(seat, 'desktop/cradle/expressions-app/field-studies-journeys/src', name));
sourcePaths.push(...['host.ts', 'recoveryBinding.ts', 'protocol.ts'].map(name => join(seat, 'packages/expressions-boundary/src', name)), join(seat, 'desktop/cradle/src/expressions/recoveryTypes.ts'), join(seat, 'desktop/cradle/src/kernel/bridge.ts'));
const sources = await Promise.all(sourcePaths.map(async path => ({path, sha256: sha(await readFile(path))})));
const configBytes = await readFile(configPath), bindings = JSON.parse(configBytes).works;
const deep = bindings.find(b => b.scope === 'techne'), authored = bindings.find(b => b.scope === 'expressions');
assert.ok(deep && authored && deep.expression_ref !== authored.expression_ref);
const {kernelOp} = await import(pathToFileURL(join(seat, 'desktop/cradle/src/kernel/bridge.ts')));
const personalCalls = [], actual = new Map();
for (const binding of [deep, authored]) {
  const request = {operation: 'read', scope: binding.scope, kind: 'checkpoint', id: binding.checkpoint_id};
  personalCalls.push(request);
  const reply = await kernelOp({kind: 'bridge', url: personalUrl}, {op: 'expression_recovery', request});
  if (reply.error || !reply.outcome?.data?.record) throw Error(reply.error ?? 'A genuine selected checkpoint is required');
  actual.set(binding.expression_ref, reply.outcome.data.record);
}
assert.ok(actual.get(deep.expression_ref).value.pending, 'Central must carry its real interrupted operation for this proof');
assert.ok(!actual.get(authored.expression_ref).value.pending, 'Choose the genuine clean authored work for focus mutation');
const home = await mkdtemp(join(base, '.native-route-disposable-'));
let child, retainedHost, wire, outcome, stderr = '', journalCalls = [], expressionCalls = [], statusReadings = [];
try {
  child = spawn(binary, ['127.0.0.1:0'], {env: {...process.env, OI_HOME: home,
    OI_CENTRAL_CTRL_BIN: '/Users/admin/Central/worktrees/env-3/central/target/release/ctrl'}, stdio: ['ignore', 'pipe', 'pipe']});
  child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-12000); });
  const scratchUrl = await new Promise((resolve, reject) => {
    let output = ''; const timeout = setTimeout(() => reject(Error('Disposable native owner did not launch')), 20000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(Error(`Disposable native owner exited ${code}`)); });
    child.stdout.on('data', chunk => { output += chunk; const match = /listening on (http:\/\/[^ ]+)/.exec(output); if (match) { clearTimeout(timeout); resolve(match[1]); } });
  });
  const operation = async (op, request) => {
    const reply = await kernelOp({kind: 'bridge', url: scratchUrl}, {op, request});
    if (reply.error || !reply.outcome) throw Error(reply.error ?? 'The actual native owner did not answer');
    return reply.outcome.data;
  };
  // Native owner writes complete genuine retained records, not generated data.
  for (const binding of [deep, authored]) {
    const record = actual.get(binding.expression_ref);
    const written = await operation('expression_recovery', {operation: 'write', scope: binding.scope, kind: 'checkpoint',
      id: binding.checkpoint_id, expected_revision: null, value: record.value});
    assert.equal(written.state, 'written');
  }
  // The real storage model admits a same-ref checkpoint in another scope.
  // The configured frame must still use its explicit selected family.
  const alternate = {...authored, scope: 'techne'};
  const duplicate = await operation('expression_recovery', {operation: 'write', scope: alternate.scope, kind: 'checkpoint',
    id: alternate.checkpoint_id, expected_revision: null, value: actual.get(authored.expression_ref).value});
  assert.equal(duplicate.state, 'written');
  const {ExpressionsHost} = await import(pathToFileURL(join(seat, 'packages/expressions-boundary/src/host.ts')));
  const {messageWire} = await import(pathToFileURL(join(seat, 'packages/expressions-boundary/tests/message-wire.mjs')));
  const appWindow = new EventTarget(), frame = new EventTarget(), origin = 'http://127.0.0.1:8788';
  wire = messageWire();
  const parent = {postMessage(data) { void retainedHost.handleMessage({source: appWindow, origin, data}); }};
  Object.assign(appWindow, {parent, setTimeout, clearTimeout,
    postMessage(data, targetOrigin) { assert.equal(targetOrigin, origin); wire.port1.postMessage(data); }});
  globalThis.window = appWindow;
  globalThis.location = {protocol: 'http:', search: `?mode=techne&expression=${encodeURIComponent(deep.expression_ref)}&recovery-scope=techne&recovery-checkpoint=${encodeURIComponent(deep.checkpoint_id)}`};
  frame.src = `${origin}/__application/expressions/index.html${location.search}`;
  frame.contentWindow = appWindow; frame.closest = () => null;
  wire.port2.on('message', data => {
    if (data?.__boundary_test_barrier) return;
    const event = new Event('message'); Object.assign(event, {source: parent, data}); appWindow.dispatchEvent(event);
  });
  let effectReady, releaseEffect, gateNextFocus = false;
  const effect = new Promise(resolve => { effectReady = resolve; });
  const release = new Promise(resolve => { releaseEffect = resolve; });
  retainedHost = new ExpressionsHost(frame, {bindingId: 'actual-native-route-acceptance', recoveryBindings: bindings,
    initialRecoveryBinding: deep, messageTarget: new EventTarget(), owners: {channels: {
      'expression-recovery': async request => { journalCalls.push({operation: request.operation, scope: request.scope, kind: request.kind, id: request.id}); return operation('expression_recovery', request); },
      'kernel-expression': async request => {
        expressionCalls.push({operation: request.operation, expression_ref: request.expression_ref ?? request.document?.expression_ref});
        const result = await operation('expression', request);
        if (gateNextFocus && request.operation === 'edit' && request.expression_ref === authored.expression_ref) {
          gateNextFocus = false; effectReady(); await release;
        }
        return result;
      },
      'kernel-expression-world': request => operation('expression_world', request),
    }}});
  const api = await import(pathToFileURL(join(seat, 'desktop/cradle/expressions-app/field-studies-journeys/src/kernelExpressions.ts')));
  const routing = await import(pathToFileURL(join(seat, 'desktop/cradle/expressions-app/field-studies-journeys/src/nativeRecovery.ts')));
  const recovery = await import(pathToFileURL(join(seat, 'desktop/cradle/expressions-app/field-studies-journeys/src/recovery.ts')));
  const {installNativeWorkspace} = await import(pathToFileURL(join(seat, 'desktop/cradle/expressions-app/field-studies-journeys/src/nativeWorkspace.ts')));
  api.installKernelExpressions(); await wire.observe();
  let journey = structuredClone(actual.get(deep.expression_ref).value.view.journey), sceneId = journey.scenes[0].id, entityId = null, version = 0, retain = false;
  const workspace = installNativeWorkspace({snapshot: () => structuredClone({journey, sceneId, entityId}), version: () => version,
    shouldRetainDraft: () => retain, load: view => { journey = structuredClone(view.journey); sceneId = view.startSceneId ?? journey.scenes[0].id; entityId = null; version++; },
    toast: () => {}, summon: () => {}, correspondence: () => {}, status: state => statusReadings.push(state)});
  await workspace.changed(journey);
  assert.equal(await workspace.follow(deep.expression_ref, deep), true);
  assert.equal(workspace.inspect().pending, actual.get(deep.expression_ref).value.pending.kind);
  assert.ok(JSON.stringify(workspace.nativeView().document) === JSON.stringify(actual.get(deep.expression_ref).value.view.document));
  assert.equal(journalCalls.filter(c => c.operation === 'write').length, 0, 'Opening the real pending work must not rewrite or replay it');
  assert.ok(expressionCalls.every(c => c.operation === 'open'), 'Reopening pending work may only call its native Open owner');
  retain = true; retainedHost.setMode('expressions');
  assert.equal(await workspace.follow(authored.expression_ref, authored), true);
  assert.equal(routing.recoveryScope(), 'expressions');
  assert.match(location.search, /mode=techne/);
  const beforeOldDraft = journalCalls.length;
  await recovery.writeDraft(structuredClone(actual.get(deep.expression_ref).value.view.journey));
  const oldDraftCalls = journalCalls.slice(beforeOldDraft).filter(c => c.operation === 'write');
  assert.ok(oldDraftCalls.length && oldDraftCalls.every(c => c.scope === deep.scope && c.kind === 'draft'));
  assert.throws(() => routing.recoveryBinding(authored.expression_ref, alternate), /different selected recovery address/);
  assert.throws(() => routing.acceptRecoveryDraft(alternate, duplicate.record), /different native recovery address/);
  await assert.rejects(routing.nativeRead('checkpoint', authored.checkpoint_id, 'techne'), /outside the host-selected address/);
  // Delay an actual native focus acknowledgement, then change the visible
  // work. The old authorized effect returns to its immutable journal family.
  const authorView = workspace.nativeView(), focusScene = authorView.journey.scenes.find(s => authorView.bindings[s.id]?.occurrences.some(o => o.entity_ref !== authorView.document.selection?.entity_ref));
  const occurrence = authorView.bindings[focusScene.id].occurrences.find(o => o.entity_ref !== authorView.document.selection?.entity_ref);
  sceneId = focusScene.id; entityId = occurrence.view_entity_id;
  gateNextFocus = true;
  const lateStart = journalCalls.length, selecting = workspace.select(sceneId, entityId);
  await Promise.race([effect, new Promise((_, reject) => setTimeout(() => reject(Error('The genuine focus effect did not arrive')), 20000))]);
  retainedHost.setMode('techne');
  journey = structuredClone(actual.get(deep.expression_ref).value.view.journey); sceneId = journey.scenes[0].id; entityId = null; version++;
  await workspace.changed(journey);
  releaseEffect(); await selecting;
  const lateWrites = journalCalls.slice(lateStart).filter(c => c.operation === 'write' && c.kind === 'checkpoint');
  assert.ok(lateWrites.length >= 2 && lateWrites.every(c => c.scope === authored.scope && c.id === authored.checkpoint_id));
  assert.equal(workspace.inspect().native_ref, deep.expression_ref);
  assert.equal(workspace.inspect().pending, actual.get(deep.expression_ref).value.pending.kind);
  const deepAfter = await operation('expression_recovery', {operation: 'read', scope: deep.scope, kind: 'checkpoint', id: deep.checkpoint_id});
  assert.ok(JSON.stringify(deepAfter.record.value) === JSON.stringify(actual.get(deep.expression_ref).value), 'Central material and complete pending request remain unchanged');
  const authoredAfter = await operation('expression_recovery', {operation: 'read', scope: authored.scope, kind: 'checkpoint', id: authored.checkpoint_id});
  const nativeAfter = await operation('expression', {operation: 'inspect', expression_ref: authored.expression_ref});
  assert.ok(JSON.stringify(authoredAfter.record.value.view.document) === JSON.stringify(nativeAfter.document));
  assert.equal(nativeAfter.document.selection.entity_ref, occurrence.entity_ref);
  assert.ok(nativeAfter.document.revision > actual.get(authored.expression_ref).value.view.document.revision);
  assert.ok(!authoredAfter.record.value.pending);
  // A genuine competing writer advances the disposable owner only. Reading
  // it is observation, not accepting the newer CAS basis for an open draft.
  const competing = await operation('expression_recovery', {operation: 'write', scope: authored.scope, kind: 'checkpoint',
    id: authored.checkpoint_id, expected_revision: authoredAfter.record.revision, value: authoredAfter.record.value});
  assert.equal(competing.state, 'written');
  await routing.nativeRead('checkpoint', authored.checkpoint_id, authored.scope);
  await assert.rejects(routing.nativeWrite('checkpoint', authored.checkpoint_id, authoredAfter.record.value, authored.scope), /Another window changed/);
  const afterConflict = await operation('expression_recovery', {operation: 'read', scope: authored.scope, kind: 'checkpoint', id: authored.checkpoint_id});
  assert.equal(afterConflict.record.revision, competing.record.revision);
  assert.ok(JSON.stringify(afterConflict.record.value) === JSON.stringify(competing.record.value));
  assert.ok(personalCalls.every(c => c.operation === 'read'));
  for (const source of sources) assert.equal(sha(await readFile(source.path)), source.sha256, 'Root source changed during the acceptance; repeat on its final basis');
  outcome = {schema: 'techne.new-shell.native-recovery-route-acceptance/v1', grade: 'B', result: 'passed',
    claim: 'actual app/host/native-owner routing; not GUI Save or craft acceptance', sources,
    kernel_binary: binary, kernel_sha256: sha(await readFile(binary)), config_sha256: sha(configBytes),
    personal_owner_requests: personalCalls.length, personal_owner_writes: 0,
    retained_frame_url_unchanged: frame.src.endsWith(location.search), current_recovery_scope: routing.recoveryScope(),
    existing_central_pending_preserved: true, pending_replayed: false, generic_find_calls: journalCalls.filter(c => c.operation === 'find_checkpoint').length,
    same_ref_alternative_scope_refused: true, draft_rebinding_refused: true, old_draft_writes_remained_techne: true,
    genuine_competing_owner_cas_refused: true, newer_read_did_not_accept_basis: true, conflict_did_not_overwrite: true,
    late_old_checkpoint_writes: lateWrites, late_effect_adopted_into_new_work: false,
    actual_native_focus_acknowledged_revision: nativeAfter.document.revision, scratch_host_write_requests: journalCalls.filter(c => c.operation === 'write').length, scratch_direct_seed_writes: 3, scratch_competing_writer_writes: 1,
    semantic_effects_confined_to_disposable_native_owner: true};
} finally {
  retainedHost?.dispose(); wire?.dispose();
  if (child) { const exiting = child.exitCode === null ? once(child, 'exit') : null; child.kill('SIGTERM'); if (exiting) await exiting; }
  await rm(home, {recursive: true, force: true});
}
outcome.disposable_home_deleted = true;
console.log(JSON.stringify(outcome, null, 2));
