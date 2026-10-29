// T-RECOVERY-FOR-OPENED-WORKS: an Expression the host opens itself is routed to its canonical recovery address before the
// frame asks; the owner's "none yet" is a reading, not a refusal; the frame's first working checkpoint creates the record
// through the owner's compare-and-set; a configured saved-work address is never replaced.
//
// What these tests are. The code under test is real: the host and its admission (src/host.ts, src/recoveryBinding.ts), and
// the frame's own recovery functions and follow path, read from field-studies-journeys/src/{nativeRecovery,recovery,
// nativeWorkspace}.ts and run unchanged, with the real NativeWorking. The native recovery owner is a SCRIPTED STUB speaking
// the kernel's expression_recovery replies (an absent record reads `ready` with `record: null`; a write is compare-and-set
// on the record's revision with one monotonic sequence; a checkpoint's id and draft id must agree). It proves nothing about
// persistence; the kernel's own tests do (expression_recovery.rs durable_reopen_scopes_metadata_and_no_revision_aba,
// independent_store_writers_have_exactly_one_cas_winner), and the lane's headless run proves it against the real owner.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ExpressionsHost, CHANNEL_VERSION, mountExpressionsApplication} from '../src/index.ts';
import {RecoveryAdmission} from '../src/recoveryBinding.ts';

const root = new URL('../../../', import.meta.url);
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root);
const ts = (await import(new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href)).default;
const {NativeWorking, validateWorkingRecord} = await import(new URL('nativeWorking.ts', author));
const {validateJourney, clone, blankJourney} = await import(new URL('model.ts', author));
const nativeWorkspaceModule = await import(new URL('nativeWorkspace.ts', author));
const {captureNativeAdoption, isGenuineWorkspaceSwitch} = nativeWorkspaceModule;
const {draftBasis} = await import(new URL('draftStorage.ts', author));
const {draftJourney} = await import(new URL('recovery.ts', author));
const {draftValue, keepOwnerQuarantine, readOwnerQuarantine, removeOwnerQuarantineEntry} = await import(new URL('draftStorage.ts', author));
const sources = {};
for (const name of ['nativeRecovery', 'recovery', 'nativeWorkspace']) {
  const path = new URL(`${name}.ts`, author);
  sources[name] = ts.createSourceFile(path.pathname, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true);
}
const emit = text => ts.transpileModule(text, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText;
/** The named top-level functions and consts of one frame source, run unchanged in one scope over the given state. */
function load(file, names, scope) {
  const found = new Map();
  for (const node of file.statements) {
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) found.set(node.name.text, node.getText(file).replace(/^export /, ''));
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
      const name = declaration.name.getText(file);
      if (names.includes(name)) found.set(name, `const ${name}=${declaration.initializer.getText(file)};`);
    }
  }
  assert.deepEqual([...found.keys()].sort(), [...names].sort());
  return new Function(...Object.keys(scope), `${emit([...found.values()].join('\n'))}\nreturn {${names.join(',')}};`)(...Object.values(scope));
}
/** A const arrow declared inside a function body (nativeWorkspace's `checkpoint` port and `followOpen`). */
const inner = name => {
  let found;
  const walk = node => {if (!found && ts.isVariableDeclaration(node) && node.name.getText(sources.nativeWorkspace) === name) found = node; ts.forEachChild(node, walk);};
  walk(sources.nativeWorkspace);
  return found?.initializer.getText(sources.nativeWorkspace);
};
const execute = (text, scope) => new Function(...Object.keys(scope), `${emit(`const run=${text};`)}\nreturn run;`)(...Object.values(scope));
/** A method of the object installNativeWorkspace returns (its `changed`), run unchanged as a function over the given state. */
const method = (name, scope) => {
  let found;
  const walk = node => {if (!found && ts.isMethodDeclaration(node) && node.name.getText(sources.nativeWorkspace) === name) found = node; ts.forEachChild(node, walk);};
  walk(sources.nativeWorkspace);
  const text = found.getText(sources.nativeWorkspace).replace(/^async /, 'async function ');
  return new Function(...Object.keys(scope), `${emit(text)}\nreturn ${name};`)(...Object.values(scope));
};

const SCHEMA = 'oi.expression-recovery/v1';
/** Scripted stub of the kernel recovery owner (see the header): read and write, and the draft quarantine's keep and remove
 * (expression_recovery.rs KeepDraftQuarantine / RemoveDraftQuarantine: one record per Expression keyed by its ref, an entry
 * identity that is the digest of its text, compare-and-set on the record's revision), as the kernel answers them. */
function recoveryOwner() {
  const records = new Map(), calls = [];
  let sequence = 0;
  const quarantine = async request => {
    const key = `${request.scope}:draft_quarantine:${request.expression_ref}`, previous = records.get(key);
    if ((previous?.revision ?? null) !== request.expected_revision) return {schema: SCHEMA, state: 'revision_conflict', current_revision: previous?.revision ?? null};
    const entries = structuredClone(previous?.value.entries ?? []);
    if (request.operation === 'keep_draft_quarantine') {
      const id = createHash('sha256').update(request.text).digest('hex');
      if (entries.some(entry => entry.id === id)) return {schema: SCHEMA, state: 'quarantine_kept', kept: false, entry_id: id, revision: previous.revision};
      entries.push({id, draft_id: request.draft_id, reason: request.reason, kept_at_unix_ms: 1, text: request.text});
    } else if (!entries.some(entry => entry.id === request.entry_id)) throw Error('No kept draft with that identity is quarantined for this Expression. Nothing was removed.');
    const kept = entries.filter(entry => entry.id !== request.entry_id);
    const record = {id: request.expression_ref, scope: request.scope, kind: 'draft_quarantine', revision: ++sequence,
      value: {schema: 'oi.draft-quarantine/v1', expression_ref: request.expression_ref, entries: kept}};
    records.set(key, record);
    return request.operation === 'keep_draft_quarantine'
      ? {schema: SCHEMA, state: 'quarantine_kept', kept: true, entry_id: kept.at(-1).id, revision: record.revision}
      : {schema: SCHEMA, state: 'quarantine_entry_removed', entry_id: request.entry_id, remaining: kept.length, revision: record.revision};
  };
  const channel = async request => {
    calls.push(structuredClone(request));
    if (request.operation === 'keep_draft_quarantine' || request.operation === 'remove_draft_quarantine') return quarantine(request);
    const key = `${request.scope}:${request.kind}:${request.id}`;
    if (request.operation === 'read') return {schema: SCHEMA, state: 'ready', record: structuredClone(records.get(key) ?? null)};
    if (request.operation !== 'write') throw Error(`The scripted owner answers read and write only, not ${request.operation}`);
    if (request.kind === 'checkpoint' && request.value?.draft_id !== request.id) throw Error('Native checkpoint schema or identity disagrees with its key');
    const previous = records.get(key);
    if ((previous?.revision ?? null) !== request.expected_revision) return {schema: SCHEMA, state: 'revision_conflict', current_revision: previous?.revision ?? null};
    const record = {id: request.id, scope: request.scope, kind: request.kind, revision: ++sequence, value: structuredClone(request.value)};
    records.set(key, record);
    return {schema: SCHEMA, state: 'written', record: structuredClone(record)};
  };
  return {channel, records, calls};
}

const origin = 'http://127.0.0.1:8788';
const ready = {hostMode: 'expressions', sceneIndex: 0, sceneCount: 1, document: {id: 'boot', name: 'Boot canvas'}};
/** One retained host and the frame side of its channel: what the host posts down is kept; the frame's recovery requests go
 * up the same handler the browser event reaches (handleMessage), and each reply settles by its request id, as
 * kernelExpressions.ts `call` does. */
async function hosted(t, owner, options = {}) {
  const posted = [], pending = new Map();
  let req = 0;
  const contentWindow = {postMessage(data, target) {
    assert.equal(target, origin);
    posted.push(data);
    if (data?.kind === 'expression-recovery-result' && pending.has(data.req)) {
      const settle = pending.get(data.req); pending.delete(data.req);
      settle(data);
    }
  }};
  const frame = Object.assign(new EventTarget(), {src: `${origin}/__application/expressions/index.html`, contentWindow, closest: () => null});
  const host = new ExpressionsHost(frame, {bindingId: 'world.expressions', owners: {channels: {'expression-recovery': owner.channel}},
    messageTarget: new EventTarget(), handshakeTimeoutMs: 1000, ...options});
  t.after(() => host.dispose());
  const deliver = data => host.handleMessage({source: contentWindow, origin, data});
  await deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: ready});
  const nativeRecoveryRequest = request => new Promise((resolve, reject) => {
    const id = ++req;
    pending.set(id, reply => reply.ok ? resolve(reply.data) : reject(Error(reply.error)));
    void deliver({v: CHANNEL_VERSION, kind: 'expression-recovery', req: id, request});
  });
  const opened = () => posted.filter(data => data.kind === 'host-command' && /-expression$/.test(data.command));
  return {host, deliver, nativeRecoveryRequest, opened};
}

/** The frame's recovery state, fresh as a new frame document: nativeRecovery.ts and recovery.ts over that state. The frame
 * was booted in Technē (hostedScope() is 'techne'), so a write that followed the boot mode would leave the selected address. */
function frameRecovery(nativeRecoveryRequest) {
  const state = {bindings: new Map(), drafts: new Map(), selected: null, revisions: new Map(), queues: new Map(),
    readReceipts: new WeakMap(), latestReadRevisions: new Map()};
  const native = load(sources.nativeRecovery, ['qualifyRecoveryBinding', 'bindNativeRecovery', 'recoveryBinding', 'selectedRecovery',
    'acceptRecoveryDraft', 'acceptAbsentRecoveryCheckpoint', 'selectNativeRecovery', 'draftRecoveryAddress', 'selectedDraftAddress', 'key', 'rememberReading',
    'nativeRead', 'nativeWrite', 'serial'], {...state, nativeRecoveryRequest, hostedRecovery: () => true, hostedScope: () => 'techne'});
  const recovery = load(sources.recovery, ['checkpointReading', 'readBoundWorkingDraft', 'writeWorkingCheckpoint', 'readWorkingCheckpoint', 'writeDraft'],
    {...native, hostedRecovery: () => true, validateJourney, draftJourney, validateWorkingRecord, draftValue,
      recoveryStore: () => assert.fail('A hosted frame never uses the browser checkpoint store')});
  const checkpoint = execute(inner('checkpoint'), {draftRecoveryAddress: native.draftRecoveryAddress, writeWorkingCheckpoint: recovery.writeWorkingCheckpoint});
  return {...state, ...native, ...recovery, checkpoint};
}

const ownerDocument = ref => ({schema: 'oi.expression/v1', expression_ref: ref, revision: 1, title: 'Opened work',
  scenes: [{scene_ref: `${ref}:scene:main`, revision: 1, title: 'Main', entity_refs: []}], entities: {}, relations: {},
  selection: {scene_ref: `${ref}:scene:main`, entity_ref: null}, provenance: [], representations: [], refinements: []});

/** nativeWorkspace.ts `followOpen`, unchanged, over the real NativeWorking whose checkpoint port is nativeWorkspace's own. */
function follower(frame, kernel) {
  const loaded = [], notes = [];
  const work = new NativeWorking({expression: kernel, file: () => assert.fail('No file operation'), checkpoint: frame.checkpoint, mint: () => 'expression:unused'});
  // The boot canvas, untouched: app.ts reports it is not retained (shouldRetainDraft), so the follow reads the destination first.
  const host = {snapshot: () => ({journey: {id: 'boot-canvas'}}), version: () => 0, shouldRetainDraft: () => false, load: view => loaded.push(view), followed: () => {}};
  const follow = execute(`()=>{let followGeneration=0;return ${inner('followOpen')};}`, {
    host, work, opens: {cancel: () => {}}, hostedRecovery: () => true, recoveryBinding: frame.recoveryBinding, selectedRecovery: frame.selectedRecovery,
    status: text => notes.push(text), update: () => {}, captureNativeAdoption, clone, persistDraft: () => assert.fail('An untouched boot canvas is not retained'),
    requireAdoption: current => {if (!current()) throw Error('superseded');}, readBoundWorkingDraft: frame.readBoundWorkingDraft,
    readWorkingDraft: () => assert.fail('A host-opened work never discovers a checkpoint by its ref'), hostedScope: () => 'techne',
    settleRecovery: async found => found, actPerforms: async () => false, acceptWorkingRecoveryBasis: () => {},
    readKernelExpression: async ref => (await kernel({operation: 'inspect', expression_ref: ref})).document,
    selectNativeRecovery: frame.selectNativeRecovery, readThrough: null, restoreGeneration: 0, selections: {cancel: () => {}}, markLoaded: () => {},
  })();
  return {follow, work, loaded, notes};
}

test('the host selects the canonical address for a work it opens; a configured saved work keeps its own', () => {
  const configured = {scope: 'techne', checkpoint_id: 'expression:saved', expression_ref: 'expression:saved'};
  const admission = new RecoveryAdmission([configured], {selectOpened: true});
  assert.deepEqual(admission.binding('expression:saved'), configured);
  assert.deepEqual(admission.binding('expression:authored-new'), {scope: 'expressions', checkpoint_id: 'expression:authored-new', expression_ref: 'expression:authored-new'});
  // Deterministic: the boot query (mountExpressionsApplication's own admission) and the host agree on the same address.
  const boot = new RecoveryAdmission(undefined, {selectOpened: true}).binding('expression:techne-m0.central.ab12');
  assert.deepEqual(new RecoveryAdmission(undefined, {selectOpened: true}).initial(boot), boot);
  // Only the canonical grammar is selected; anything else stays refused by name.
  assert.throws(() => admission.binding('expression:has space'), /no host-selected recovery address/);
  // A configured address that already holds the canonical one for another work is never shared.
  const holder = new RecoveryAdmission([{scope: 'expressions', checkpoint_id: 'expression:taken', expression_ref: 'expression:other'}], {selectOpened: true});
  assert.throws(() => holder.binding('expression:taken'), /held by another selected work/);
  // Unchanged without selection: omission is legacy non-recovery hosting, a configured list admits only its own works.
  assert.equal(new RecoveryAdmission().binding('expression:authored-new'), undefined);
  assert.throws(() => new RecoveryAdmission([configured]).binding('expression:authored-new'), /no host-selected recovery address/);
});

test('an opened work carries its selected address; before the owner answers "none yet" no checkpoint write passes', async t => {
  const owner = recoveryOwner();
  const configured = {scope: 'techne', checkpoint_id: 'expression:saved', expression_ref: 'expression:saved'};
  const a = await hosted(t, owner, {recoveryBindings: [configured], selectOpenedWorks: true});
  a.host.openExpression('expression:authored-new', 'world.expressions');
  a.host.openExpression('expression:saved', 'world.expressions', {refresh: true});
  assert.deepEqual(a.opened().map(row => [row.command, row.ref, row.recovery]), [
    ['open-expression', 'expression:authored-new', {scope: 'expressions', checkpoint_id: 'expression:authored-new', expression_ref: 'expression:authored-new'}],
    ['refresh-expression', 'expression:saved', configured],
  ]);
  const value = {schema: 'oi.native-working/v1', draft_id: 'expression:authored-new', view: {document: ownerDocument('expression:authored-new')}};
  const write = {operation: 'write', scope: 'expressions', kind: 'checkpoint', id: 'expression:authored-new', expected_revision: null, value};
  await assert.rejects(a.nativeRecoveryRequest(write), /does not address the selected native work/);
  await assert.rejects(a.nativeRecoveryRequest({operation: 'write', scope: 'expressions', kind: 'draft', id: 'expression:authored-new', expected_revision: null, value: {id: 'expression:authored-new'}}), /read its checkpoint before using a draft/);
  await assert.rejects(a.nativeRecoveryRequest({operation: 'find_checkpoint', scope: 'expressions', expression_ref: 'expression:authored-new'}), /exact id/);
  await assert.rejects(a.nativeRecoveryRequest({operation: 'read', scope: 'techne', kind: 'checkpoint', id: 'expression:authored-new'}), /outside the host-selected address/);
  assert.deepEqual(owner.calls, [], 'no refused request reaches the owner');
  assert.deepEqual(await a.nativeRecoveryRequest({operation: 'read', scope: 'expressions', kind: 'checkpoint', id: 'expression:authored-new'}),
    {schema: SCHEMA, state: 'ready', record: null});
  const written = await a.nativeRecoveryRequest(write);
  assert.equal(written.state, 'written');
  assert.equal(written.record.revision, 1);
  // A second creation from the stale absent basis is the owner's conflict, relayed as it answered.
  assert.deepEqual(await a.nativeRecoveryRequest(write), {schema: SCHEMA, state: 'revision_conflict', current_revision: 1});
});

test('the frame follows a host-opened work with no checkpoint: none yet, the owner\'s Document, the first checkpoint created at the selected address', async t => {
  const owner = recoveryOwner(), ref = 'expression:authored-0b5e', document = ownerDocument(ref);
  const kernel = async request => {
    assert.deepEqual(request, {operation: 'inspect', expression_ref: ref});
    return {state: 'ready', expression_ref: ref, document: structuredClone(document)};
  };
  const a = await hosted(t, owner, {selectOpenedWorks: true});
  const frame = frameRecovery(a.nativeRecoveryRequest), opening = follower(frame, kernel);
  a.host.openExpression(ref, 'world.expressions');
  const [command] = a.opened();
  assert.equal(await opening.follow(command.ref, command.recovery), undefined);
  assert.deepEqual(owner.calls.map(({operation, scope, kind, id, expected_revision}) => ({operation, scope, kind, id, expected_revision})), [
    {operation: 'read', scope: 'expressions', kind: 'checkpoint', id: ref, expected_revision: undefined},
    {operation: 'write', scope: 'expressions', kind: 'checkpoint', id: ref, expected_revision: null},
  ], 'one exact read, then one compare-and-set creation; never a discovery, never the boot mode\'s scope');
  const stored = owner.records.get(`expressions:checkpoint:${ref}`);
  assert.equal(stored.value.draft_id, ref);
  assert.deepEqual(stored.value.view.document, document, 'the checkpoint holds the owner\'s own Document; nothing else is copied in');
  assert.equal(opening.work.state.view.document.expression_ref, ref);
  assert.equal(opening.loaded.length, 1);
  assert.match(opening.notes.at(-1), /^Opened Opened work at revision 1\./);
  // The work's draft is addressed with it: the autosave lands at the selected address, admitted by the host.
  await frame.writeDraft(opening.work.state.view.journey);
  assert.deepEqual(owner.calls.slice(2).map(({operation, scope, kind, id}) => [operation, scope, kind, id]),
    [['read', 'expressions', 'draft', ref], ['write', 'expressions', 'draft', ref]]);

  // A new frame document over a new host (a restart) meets the same checkpoint at the same address.
  const b = await hosted(t, owner, {selectOpenedWorks: true});
  const later = frameRecovery(b.nativeRecoveryRequest);
  b.host.openExpression(ref, 'world.expressions');
  const found = await later.readBoundWorkingDraft(later.recoveryBinding(ref, b.opened()[0].recovery));
  assert.equal(found.record.draft_id, ref);
  assert.deepEqual(found.record.view.document, document);
  assert.deepEqual(found.recoveryRecords.map(row => [row.kind, row.revision]), [['checkpoint', 1], ['draft', 2]]);
});

test('an opened work keeps and clears its kept drafts through the host: both reach the owner at the work\'s own address', async t => {
  // O-I #763: the admission refused keep_draft_quarantine and remove_draft_quarantine ("Unsupported native recovery operation"),
  // and the quarantine read with them, so an Expression the DLW opens could neither keep a superseded draft nor clear one.
  const owner = recoveryOwner(), ref = 'expression:authored-7c1d', document = ownerDocument(ref);
  const kernel = async () => ({state: 'ready', expression_ref: ref, document: structuredClone(document)});
  const a = await hosted(t, owner, {selectOpenedWorks: true});
  const frame = frameRecovery(a.nativeRecoveryRequest), opening = follower(frame, kernel), send = a.nativeRecoveryRequest;
  a.host.openExpression(ref, 'world.expressions');
  await opening.follow(ref, a.opened()[0].recovery);
  owner.calls.length = 0;
  const text = JSON.stringify(draftValue({...opening.work.state.view.journey, name: 'Set aside'}));
  // Keep: the frame's own sequence (draftStorage.ts keepOwnerQuarantine: read, keep, read back), through the host.
  const kept = await keepOwnerQuarantine(send, {expressionRef: ref, scope: 'expressions', draftId: ref, reason: 'Superseded by the saved copy.', text});
  assert.equal(kept.kept, true);
  assert.deepEqual((await readOwnerQuarantine(send, ref, 'expressions')).entries.map(entry => [entry.id, entry.draft_id, entry.text]), [[kept.entryId, ref, text]]);
  // Clear: the kept draft is removed by its identity, at the revision read at the call.
  assert.equal(await removeOwnerQuarantineEntry(send, ref, 'expressions', kept.entryId), 0);
  assert.deepEqual((await readOwnerQuarantine(send, ref, 'expressions')).entries, []);
  assert.deepEqual(owner.calls.map(({operation, scope, kind, id, expression_ref}) => [operation, scope, kind ?? null, id ?? expression_ref]), [
    ['read', 'expressions', 'draft_quarantine', ref], ['keep_draft_quarantine', 'expressions', null, ref], ['read', 'expressions', 'draft_quarantine', ref],
    ['read', 'expressions', 'draft_quarantine', ref],
    ['read', 'expressions', 'draft_quarantine', ref], ['remove_draft_quarantine', 'expressions', null, ref],
    ['read', 'expressions', 'draft_quarantine', ref],
  ], 'every keep and clear reached the owner, at the selected scope and the work\'s own ref');

  // Anything outside that address is refused by the host before the owner is asked.
  owner.calls.length = 0;
  const keep = {operation: 'keep_draft_quarantine', scope: 'expressions', expression_ref: ref, draft_id: ref, reason: 'r', text, expected_revision: 3};
  await assert.rejects(keepOwnerQuarantine(send, {expressionRef: 'expression:never-opened', scope: 'expressions', draftId: 'expression:never-opened', reason: 'r', text}), /outside the host-selected address/);
  await assert.rejects(send({operation: 'read', scope: 'techne', kind: 'draft_quarantine', id: ref}), /outside the host-selected address/);
  await assert.rejects(send({...keep, scope: 'techne'}), /outside the host-selected address/);
  await assert.rejects(send({...keep, draft_id: 'draft-never-read'}), /not the draft of the selected native work/);
  await assert.rejects(send({...keep, text: 7}), /verbatim text and its reason/);
  await assert.rejects(send({...keep, expected_revision: 0}), /revision basis/);
  await assert.rejects(send({operation: 'remove_draft_quarantine', scope: 'expressions', expression_ref: ref, entry_id: 'not-a-digest', expected_revision: 3}), /exact identity/);
  await assert.rejects(send({operation: 'write', scope: 'expressions', kind: 'draft_quarantine', id: ref, expected_revision: 3, value: {}}), /Unsupported native recovery operation/);
  await assert.rejects(send({operation: 'remove', scope: 'expressions', kind: 'draft_quarantine', id: ref, expected_revision: 3}), /Unsupported native recovery operation/);
  assert.deepEqual(owner.calls, [], 'no refused request reaches the owner');
});

test('the frame\'s own canvas, booted on or switched to, reads no checkpoint the host never addressed; a work\'s own draft still reads its own', async t => {
  // O-I #763: in a hosted frame, nativeWorkspace's changed() read the working checkpoint of whatever journey stood in the frame at
  // its own id, an address the host never selected, so the host refused it and the frame's status read "Native recovery was not
  // adopted…" with its Save marked failed. A local journey has no native checkpoint; only a draft the host addressed has one.
  const owner = recoveryOwner(), ref = 'expression:authored-2f9a', document = ownerDocument(ref);
  const kernel = async () => ({state: 'ready', expression_ref: ref, document: structuredClone(document)});
  const a = await hosted(t, owner, {selectOpenedWorks: true});
  const frame = frameRecovery(a.nativeRecoveryRequest), notes = [], restored = [];
  const canvas = {...blankJourney(), name: 'The mark'};
  let standing = canvas;
  const changed = method('changed', {isGenuineWorkspaceSwitch, bootState: {booted: false}, opens: {cancel() {}}, restoreGeneration: 0,
    selections: {cancel() {}}, work: {detach() {}, restore: (record, journey) => restored.push([record.draft_id, journey.id])},
    host: {correspondence() {}, shouldRetainDraft: () => true, snapshot: () => ({journey: standing})}, hostedRecovery: () => true,
    draftRecoveryAddress: frame.draftRecoveryAddress, selectedDraftAddress: frame.selectedDraftAddress,
    readWorkingCheckpoint: frame.readWorkingCheckpoint, update() {}, lastFailure: false, status: text => notes.push(text)});
  await changed(canvas);
  assert.deepEqual(notes, [], 'the canvas is not refused: nothing names a failed recovery');
  assert.deepEqual(owner.calls, []);
  // The work the host opened: its checkpoint stands at its selected address, and its draft id is that address's, so it is read there.
  const opening = follower(frame, kernel);
  a.host.openExpression(ref, 'world.expressions');
  await opening.follow(ref, a.opened()[0].recovery);
  const view = opening.work.state.view;
  standing = view.journey;
  owner.calls.length = 0;
  await changed(view.journey);
  assert.deepEqual(notes, []);
  assert.deepEqual(owner.calls.map(({operation, scope, kind, id}) => [operation, scope, kind, id]), [['read', 'expressions', 'checkpoint', ref]]);
  assert.deepEqual(restored, [[ref, view.journey.id]]);
});

/** The owner's works home (kernel expression_home.rs WORKS_HOME) as its `list` discloses it. */
const HOME = {schema: 'central.path-ref/v1', ref: 'central:path:/scratch/Central:Control/user/flows', root: '/scratch/Central', path: 'Control/user/flows'};
/** A scripted Expression owner for New's route: list (with its home), create, the composition edit a fresh draft makes
 * (scene_rename, scene_material_set), inspect and save_as, as the kernel answers them. */
function expressionOwner(open) {
  const held = new Map(open.map(doc => [doc.expression_ref, structuredClone(doc)])), files = [], calls = [];
  const channel = async request => {
    calls.push(structuredClone(request));
    if (request.operation === 'list') return {schema: 'oi.expression-list/v1', expressions: [], unreadable: [], home: {path: HOME.path, state: 'listed', location: HOME, truncated: false}};
    if (request.operation === 'inspect') return {state: 'ready', expression_ref: request.expression_ref, document: structuredClone(held.get(request.expression_ref))};
    if (request.operation === 'create') {
      const doc = {...ownerDocument(request.expression_ref), title: request.title};
      held.set(doc.expression_ref, doc);
      return {state: 'ready', document: structuredClone(doc)};
    }
    if (request.operation === 'edit') {
      const doc = structuredClone(held.get(request.expression_ref));
      if (request.expected_revision !== doc.revision) return {state: 'revision_conflict', current_revision: doc.revision, expression_ref: doc.expression_ref};
      for (const change of request.changes) {
        const scene = doc.scenes.find(row => row.scene_ref === change.scene_ref);
        if (change.change === 'scene_rename') scene.title = change.title;
        else if (change.change === 'scene_material_set') scene.presentation = structuredClone(change.presentation);
        else assert.fail(`the scripted owner has no rule for ${change.change}`);
      }
      doc.revision++;
      held.set(doc.expression_ref, doc);
      return {state: 'ready', document: structuredClone(doc)};
    }
    if (request.operation === 'save_as') {
      const doc = held.get(request.expression_ref);
      if (request.expected_revision !== doc.revision) return {state: 'revision_conflict', current_revision: doc.revision};
      const path = `${request.parent.path}/${request.name}`;
      files.push({path, document: structuredClone(doc)});
      return {state: 'saved', persisted: true, readback_verified: true, owner_operation: 'central.files.create',
        file: {location: {...HOME, ref: `central:path:/scratch/Central:${path}`, path}, revision: `file-r${files.length}`}};
    }
    assert.fail(`unexpected owner operation ${request.operation}`);
  };
  return {channel, calls, held, files};
}

test('a local draft edited and then left is kept as a work in its world\'s folder by New\'s route, and the other work opens', async t => {
  // O-I #763 (#709): an edited local draft in a hosted frame had no recovery address, so retaining it before another work opened
  // was refused by the host and the open stopped. It is now kept as a work: the owner's works home first, then the frame's own
  // create and composition edit, then save_as into that home and read back; only then does the other work open.
  const owner = recoveryOwner(), ref = 'expression:authored-5e60';
  const works = expressionOwner([ownerDocument(ref)]);
  const a = await hosted(t, owner, {selectOpenedWorks: true});
  const frame = frameRecovery(a.nativeRecoveryRequest), carried = [], loaded = [], keptAs = [];
  const sketch = {...blankJourney(), name: 'Morning sketch'};
  const work = new NativeWorking({expression: works.channel, file: () => assert.fail('No file operation'), checkpoint: frame.checkpoint, mint: () => 'expression:unused'});
  let edited = false;
  const host = {snapshot: () => ({journey: sketch, sceneId: sketch.scenes[0].id, entityId: null}), version: () => 3, shouldRetainDraft: () => true,
    localDraftEdited: () => edited, load: view => loaded.push(view), followed: () => {},
    // O-I #763: told of each draft kept as a work, so its Library copy opens that work and the host lists its works again (app.ts).
    keptAsWork: (journey, kept) => keptAs.push([journey.id, kept.expression_ref, kept.title, kept.path])};
  // The frame's own retention of the draft being left, run unchanged: persistDraft writes a draft the host addressed.
  const persistDraft = execute(inner('persistDraft'), {hostedRecovery: () => true, writeDraft: frame.writeDraft, unkeptDrafts: new Map(), heldDrafts: new Set(),
    draftBasisOf: execute(inner('draftBasisOf'), {work, draftBasis})});
  const departing = inner('retainDeparting');
  const retainDeparting = departing && execute(departing, {hostedRecovery: () => true, work, host, selectedDraftAddress: frame.selectedDraftAddress, persistDraft,
    keepDraftAsWork: nativeWorkspaceModule.keepDraftAsWork, nativeExpressionRequest: works.channel, carry: text => carried.push(text)});
  const follow = execute(`()=>{let followGeneration=0;return ${inner('followOpen')};}`, {
    host, work, opens: {cancel: () => {}}, hostedRecovery: () => true, recoveryBinding: frame.recoveryBinding, selectedRecovery: frame.selectedRecovery,
    status: () => {}, update: () => {}, captureNativeAdoption, clone, persistDraft, retainDeparting,
    requireAdoption: current => {if (!current()) throw Error('superseded');}, readBoundWorkingDraft: frame.readBoundWorkingDraft,
    readWorkingDraft: () => assert.fail('A host-opened work never discovers a checkpoint by its ref'), hostedScope: () => 'techne',
    settleRecovery: async found => found, actPerforms: async () => false, acceptWorkingRecoveryBasis: () => {},
    readKernelExpression: async reference => (await works.channel({operation: 'inspect', expression_ref: reference})).document,
    selectNativeRecovery: frame.selectNativeRecovery, readThrough: null, restoreGeneration: 0, selections: {cancel: () => {}}, markLoaded: () => {},
  })();
  // Opened and left unedited, the local draft is kept already (the browser Library) and is not made a work again.
  const other = 'expression:authored-0d1e';
  works.held.set(other, ownerDocument(other));
  a.host.openExpression(other, 'world.expressions');
  await follow(other, a.opened()[0].recovery);
  assert.deepEqual(works.calls.map(call => call.operation), ['inspect'], 'nothing is made of an unedited local draft');
  assert.deepEqual(keptAs, [], 'and nothing is told of one');
  assert.equal(loaded.length, 1);
  // Edited, it is a work in the folder: created, composed and saved there, before anything of the other work was read.
  edited = true;
  works.calls.length = 0;
  loaded.length = 0;
  work.detach();
  a.host.openExpression(ref, 'world.expressions');
  await follow(ref, a.opened()[1].recovery);
  const kept = [...works.held.keys()].find(key => key !== ref && key !== other);
  assert.match(kept ?? '', /^expression:authored-[0-9a-f-]{36}$/, 'the draft is a new native Expression');
  assert.deepEqual(works.calls.map(call => call.operation), ['list', 'create', 'edit', 'save_as', 'inspect']);
  const save = works.calls.find(call => call.operation === 'save_as');
  assert.deepEqual(save.parent, HOME, 'saved into the home the owner disclosed');
  assert.match(save.name, /^morning-sketch-[0-9a-f]{8}\.expression\.json$/);
  assert.equal(works.files[0].document.title, 'Morning sketch');
  assert.equal(works.files[0].document.scenes[0].title, sketch.scenes[0].name);
  assert.deepEqual(carried, [`"Morning sketch" was kept as a work: ${works.files[0].path}.`]);
  assert.deepEqual(keptAs, [[sketch.id, kept, 'Morning sketch', works.files[0].path]], 'the frame is told of the work the draft was kept as, once');
  // Nothing was written at an address the host never selected; the other work opened at its own.
  assert.deepEqual(owner.calls.map(({operation, kind, id}) => [operation, kind, id]), [['read', 'checkpoint', other], ['write', 'checkpoint', other],
    ['read', 'checkpoint', ref], ['write', 'checkpoint', ref]]);
  assert.equal(loaded.length, 1);
  assert.equal(work.state.view.document.expression_ref, ref);
});

test('an absent checkpoint at a non-canonical address is still refused, and nothing is written', async t => {
  const owner = recoveryOwner();
  const a = await hosted(t, owner, {recoveryBindings: [{scope: 'expressions', checkpoint_id: 'draft-7', expression_ref: 'expression:kept'}]});
  const frame = frameRecovery(a.nativeRecoveryRequest);
  a.host.openExpression('expression:kept', 'world.expressions');
  const binding = frame.recoveryBinding('expression:kept', a.opened()[0].recovery);
  await assert.rejects(frame.readBoundWorkingDraft(binding), /selected native working checkpoint is absent/);
  assert.deepEqual(owner.calls.map(row => row.operation), ['read']);
  assert.equal(frame.draftRecoveryAddress('expression:kept').scope, 'techne', 'no draft was addressed to the refused checkpoint');
});

test('the boot work the host mounts on carries the same selected address in the frame query', t => {
  // The smallest document the mount touches: one container, one iframe element (an EventTarget), no DOM.
  const iframe = Object.assign(new EventTarget(), {dataset: {}, style: {}, setAttribute() {}, contentWindow: null, closest: () => null, remove() {}});
  const container = {ownerDocument: {createElement: () => iframe, baseURI: `${origin}/app/`}, append() {}};
  const entry = '/__application/expressions/index.html?mode=techne&world=generic&expression=expression%3Aauthored-0b5e';
  const mounted = mountExpressionsApplication(container, entry, {bindingId: 'world.expressions', owners: {channels: {}},
    messageTarget: new EventTarget(), handshakeTimeoutMs: 1000, selectOpenedWorks: true});
  t.after(() => mounted.dispose());
  const query = new URL(iframe.src).searchParams;
  assert.deepEqual([query.get('expression'), query.get('recovery-scope'), query.get('recovery-checkpoint')],
    ['expression:authored-0b5e', 'expressions', 'expression:authored-0b5e'], 'the boot address is the selected one, never the boot mode');
  // Without selection the legacy boot is unchanged: no address rides in the query.
  const legacy = Object.assign(new EventTarget(), {dataset: {}, style: {}, setAttribute() {}, contentWindow: null, closest: () => null, remove() {}});
  const plain = mountExpressionsApplication({ownerDocument: {createElement: () => legacy, baseURI: `${origin}/app/`}, append() {}}, entry,
    {bindingId: 'world.expressions', owners: {channels: {}}, messageTarget: new EventTarget(), handshakeTimeoutMs: 1000});
  t.after(() => plain.dispose());
  assert.equal(new URL(legacy.src).searchParams.has('recovery-scope'), false);
});
