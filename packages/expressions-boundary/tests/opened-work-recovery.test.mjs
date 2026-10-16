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
import {ExpressionsHost, CHANNEL_VERSION, mountExpressionsApplication} from '../src/index.ts';
import {RecoveryAdmission} from '../src/recoveryBinding.ts';

const root = new URL('../../../', import.meta.url);
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root);
const ts = (await import(new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href)).default;
const {NativeWorking, validateWorkingRecord} = await import(new URL('nativeWorking.ts', author));
const {validateJourney, clone} = await import(new URL('model.ts', author));
const {captureNativeAdoption} = await import(new URL('nativeWorkspace.ts', author));
const {draftJourney} = await import(new URL('recovery.ts', author));
const {draftValue} = await import(new URL('draftStorage.ts', author));
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
  return found.initializer.getText(sources.nativeWorkspace);
};
const execute = (text, scope) => new Function(...Object.keys(scope), `${emit(`const run=${text};`)}\nreturn run;`)(...Object.values(scope));

const SCHEMA = 'oi.expression-recovery/v1';
/** Scripted stub of the kernel recovery owner (see the header): only read and write, as the kernel answers them. */
function recoveryOwner() {
  const records = new Map(), calls = [];
  let sequence = 0;
  const channel = async request => {
    calls.push(structuredClone(request));
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
    'acceptRecoveryDraft', 'acceptAbsentRecoveryCheckpoint', 'selectNativeRecovery', 'draftRecoveryAddress', 'key', 'rememberReading',
    'nativeRead', 'nativeWrite', 'serial'], {...state, nativeRecoveryRequest, hostedRecovery: () => true, hostedScope: () => 'techne'});
  const recovery = load(sources.recovery, ['checkpointReading', 'readBoundWorkingDraft', 'writeWorkingCheckpoint', 'writeDraft'],
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
