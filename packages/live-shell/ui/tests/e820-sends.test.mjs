import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Lane AE (map O-I #706): the owner acts the search line's sends waited on, and the readings beside them.
//  1. #820 — a passage sent elsewhere: to a person, the Shared Field's `message` (a Contact request they accept); to a place, Central's
//     `central.place.file-passage`; to another document as a quote, the kernel's page `append_quote` — each through the kernel, each lit.
//  2. #820 — the Flow pane's Re-read asks the owner fresh (`readFlowInstance`'s fresh flag).
//  3. #745 (lane AA's proposal) — the document's packet put into AIKit's prepared context before the Send, so the Send carries what the
//     Packet shows: op encounter context edit, remove what the packet does not hold and add what it holds.
//  4. REPLACED (O-I ticket 1003, the one send): #741's Heard and the gateway's Steer retired with Messages' gateway send. Send is the next
//     turn in the conversation the open agent's occupant works; the line you sent stands queued until that conversation holds it.
// Channels: PURE (the plans, the selections); BINDING (the sends and the packet's edits through the kernel bridge, its fetch answered here
// as the kernel answers: each op asserted as it would reach the kernel); SCRIPTED (Messages' Full rendered to static markup);
// CODE-READING (the Flow face's Re-read and its provider). The kernel's own routes are proven in desktop/cradle/kernel (page.rs,
// inhabitation.rs, tests/shell_owner_routes.rs), Central's act in Central ctrl/tests/place_passage.rs, AIKit's read in ai-kit
// gateway_contact.rs heard_tests. Loader as e820-search-line.test.mjs.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop}, addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop; globalThis.dispatchEvent ??= () => true
globalThis.CustomEvent ??= class extends Event { constructor(type, init) { super(type); this.detail = init?.detail } }
globalThis.localStorage ??= {getItem: () => null, setItem: () => {}}
const {readFile} = await import('node:fs/promises')
const read = path => readFile(new URL(path, import.meta.url), 'utf8')

const model = await import('../src/central/searchLineModel.ts')
const sends = await import('../src/central/searchLineSends.ts')
const design = await import('../src/inhabitants/catalogue/panels/central__search.tsx')
const bridge = await import('../../../../desktop/cradle/src/kernel/bridge.ts')
const {readFlowInstance} = await import('../../../../desktop/cradle/src/flow/instances.ts')
const nativeContext = await import('../../../../desktop/cradle/src/context/nativeContext.ts')
const packetSlice = await import('../../../../desktop/cradle/src/context/packetSlice.ts')
const {packetSliceOver} = await import('./support/worldModelFixture.mjs')
const packetContext = await import('../src/central/devices/documentPacketContext.ts')
const packet = await import('../src/central/devices/packetBinding.ts')
const doors = await import('../src/central/documents/documentDoor.ts')
const msg = await import('../src/agent/devices/messagesBinding.ts')
const bind = await import('../src/agent/devices/designBindings.ts')

/** The kernel bridge's fetch, answered here: each op as it reaches the kernel, and the answer the kernel gives it. */
const TRANSPORT = {kind: 'bridge', url: 'http://kernel.test'}
function kernel(answer) {
  const ops = []
  globalThis.fetch = async (url, init) => {
    const op = JSON.parse(init.body)
    ops.push(op)
    const reply = await answer(op)
    return {json: async () => (reply instanceof Error ? {ok: false, error: reply.message} : {ok: true, outcome: reply})}
  }
  return ops
}

const passage = {text: 'A completion claim without executed evidence is only tone.', from: 'Flow — Completion', path: 'Control/user/flows/flow-a.html'}
const of = (kind, extra = {}) => ({ref: `${kind}:1`, title: `The ${kind}`, kind, group: design.searchGroupOf(kind), ...extra})

// ---------------------------------------------------------------------------------------------------------------------
// 1 · the sends, each through its owner

test('PURE — a person, a place and another document now take the passage, each saying what it sends and through whom', () => {
  const person = model.sendPlanOf(of('participant', {ref: 'participant:public:parasakti', title: 'parasakti'}), passage, {})
  assert.equal(person.verb, 'send'); assert.equal(person.target, 'person')
  assert.match(person.words, /^Sends parasakti a message with 58 characters from Flow — Completion and where it came from: a request they accept before they read it\.$/)
  const place = model.sendPlanOf(of('project', {ref: 'project:Archetypal-Earth', title: 'Archetypal-Earth'}), passage, {})
  assert.equal(place.verb, 'send'); assert.equal(place.target, 'place')
  assert.match(place.words, /^Files 58 characters from Flow — Completion on Archetypal-Earth, with a link back to the page\. It stays unrecognised there until you recognise it\.$/)
  assert.equal(model.placeWorldOf({ref: 'project:Archetypal-Earth'}), 'project:Archetypal-Earth')
  const inside = model.sendPlanOf(of('place', {ref: 'place:bollingen', title: 'Bollingen'}), passage, {})
  assert.equal(inside.verb, 'dim', 'a place inside a world whose world the owner did not give is not guessed')
  assert.match(inside.why, /names no world/)
  const readme = of('knowledge-source', {ref: 'central:source:project:O-I:README.md', title: 'README'})
  const quote = model.sendPlanOf(readme, passage, {flow: null})
  assert.equal(quote.verb, 'send'); assert.equal(quote.target, 'quote')
  assert.match(quote.words, /^Quotes 58 characters from Flow — Completion at the end of README, with a link back to the page\.$/)
  assert.equal(model.documentPathOf(readme), 'Work/O-I/README.md', 'a project\'s source is a path in that project')
  assert.equal(model.documentPathOf(of('document', {ref: 'Control/user/notes.md:3', owner: 'Control'})), 'Control/user/notes.md')
  const json = model.sendPlanOf(of('knowledge-source', {ref: 'central:source:control:root:Control/user/data.json', title: 'data'}), passage, {flow: null})
  assert.equal(json.verb, 'dim'); assert.match(json.why, /takes no quote at its end/)
  const unlisted = model.sendPlanOf(of('knowledge-source', {ref: 'central:source:control:root:Control/user/flows/flow-z.html', title: 'Z'}), passage, {flow: null})
  assert.equal(unlisted.verb, 'dim', 'a Flow the owner does not list takes no entry, and no quote either'); assert.match(unlisted.why, /does not list/)
  const wiki = model.sendPlanOf(of('knowledge-node', {ref: 'wiki:node:identity', title: 'Identity'}), passage, {flow: null})
  assert.equal(wiki.verb, 'dim'); assert.match(wiki.why, /no document the owner can find by its path/)
  for (const plan of [person, place, quote]) assert.doesNotMatch(plan.words, /missing op/i, 'no send waits on an owner operation any more')
})

test('BINDING — a person is sent the passage through the kernel\'s shared_field op: the Shared Field\'s message, answered as a request', async () => {
  const ops = kernel(() => ({result: 'shared_field_reading', data: {schema: 'oi.shared-field.message-result/v1', contact_ref: 'contact:message:1', field_ref: 'field:public',
    from_participant_ref: 'participant:public:me', to_participant_ref: 'participant:public:parasakti', state: 'pending', characters: 58}}))
  const receipt = await sends.messagePerson(TRANSPORT, 'participant:public:parasakti', passage)
  assert.deepEqual(ops, [{op: 'shared_field', request: {kind: 'message', to_participant_ref: 'participant:public:parasakti', passage}}])
  assert.deepEqual(receipt, {contactRef: 'contact:message:1', fieldRef: 'field:public', state: 'pending'})
  kernel(() => ({result: 'shared_field_reading', data: {state: 'unavailable', owner_operation: 'shared-field.projection', detail: 'no hosting target is bound'}}))
  await assert.rejects(() => sends.messagePerson(TRANSPORT, 'participant:public:parasakti', passage), /Shared Field is unavailable: no hosting target is bound/)
  kernel(() => new Error('An active Contact request already exists for this Participant pair'))
  await assert.rejects(() => sends.messagePerson(TRANSPORT, 'participant:public:parasakti', passage), /already exists/, 'the owner\'s refusal, in its words')
})

test('BINDING — a place files the passage through Central\'s central.place.file-passage, word for word, with the link back', async () => {
  const ops = kernel(() => ({result: 'action_dispatched', dispatch: {state: 'invoked', owner_operation: 'central.place.file-passage',
    data: {schema: 'central.filed-passage-receipt/v1', outcome: 'filed', source_path: 'Work/Archetypal-Earth/ProjectCentral/agents/places/filed/passage-1.json'}}}))
  const receipt = await sends.filePassage(TRANSPORT, 'project:Archetypal-Earth', {...passage, text: `${passage.text}\n`})
  assert.deepEqual(ops, [{op: 'invoke_action', invocation: {action: 'central.place.file-passage', target_ref: 'project:Archetypal-Earth',
    input: {place: 'project:Archetypal-Earth', passage: passage.text, source: {title: 'Flow — Completion', path: 'Control/user/flows/flow-a.html'}}}}])
  assert.deepEqual(receipt, {outcome: 'filed', path: 'Work/Archetypal-Earth/ProjectCentral/agents/places/filed/passage-1.json'})
  kernel(() => ({result: 'action_dispatched', dispatch: {state: 'owner_refused', owner_operation: 'central.place.file-passage', message: 'project is one existing Central/Work member'}}))
  await assert.rejects(() => sends.filePassage(TRANSPORT, 'project:Absent', passage), /Central did not file it: project is one existing Central\/Work member/)
})

test('BINDING — another document takes the passage as a quote at its end through the kernel\'s page append_quote, found fresh in its folder', async () => {
  const location = {schema: 'central.path-ref/v1', ref: 'central:path:control:Work/O-I/README.md', root: '/c', path: 'Work/O-I/README.md'}
  const ops = kernel(op => op.op === 'files_list'
    ? {result: 'directory_read', directory: {schema: 'central.directory-reading/v1', location: {...location, path: 'Work/O-I'}, entries: [{name: 'README.md', kind: 'file', byte_len: 9, retrieval_allowed: true, location}], automatic_agent_or_model_invocation: false}}
    : {result: 'page_reading', data: {schema: 'oi.page-quote/v1', form: 'markdown', outcome: 'written', revision: 'r-2', before_revision: 'r-1'}})
  const receipt = await sends.quoteAtEnd(TRANSPORT, 'Work/O-I/README.md', passage)
  assert.deepEqual(ops[0], {op: 'files_list', path: 'Work/O-I', fresh: true}, 'the folder is read fresh: the quote is written on what stands now')
  assert.deepEqual(ops[1], {op: 'page', request: {operation: 'append_quote', location, quote: passage}})
  assert.deepEqual(receipt, {outcome: 'written', revision: 'r-2'})
  kernel(op => op.op === 'files_list' ? {result: 'directory_read', directory: {location, entries: []}} : null)
  await assert.rejects(() => sends.quoteAtEnd(TRANSPORT, 'Work/O-I/README.md', passage), /lists no README\.md in Work\/O-I/)
})

test('CODE-READING — the line sends each through its owner, and the Search pane no longer says no owner takes them', async () => {
  const line = await read('../src/central/searchLine.tsx')
  for (const call of ['messagePerson(transport, result.ref, passage)', 'filePassage(transport, world, passage)', 'quoteAtEnd(transport, path, passage)']) assert.ok(line.includes(call), call)
  assert.match(line, /import\('\.\/searchLineSends'\)/, 'the sends load with the line, never in the first frame')
  const search = await read('../src/central/devices/searchBinding.ts')
  assert.doesNotMatch(search, /No owner takes a passage sent to a person/)
  assert.match(search, /central\.place\.file-passage/)
})

// ---------------------------------------------------------------------------------------------------------------------
// 2 · the Flow pane's Re-read asks the owner fresh

test('BINDING — readFlowInstance carries its fresh flag to the owner read; the Flow pane\'s Re-read asks fresh', async () => {
  const asked = []
  const flow = '<!doctype html><script type="application/json" id="ql-doc">{"meta":{"title":"F","revision":1},"entries":[],"notes":[]}</script>'
  bridge.installKernelReadHolder(async (_transport, op, fresh) => { asked.push([op.op, fresh]); return {outcome: {result: 'file_read', reading: {revision: 'r1', content: flow}}} })
  try {
    const location = {schema: 'central.path-ref/v1', ref: 'r', root: '/c', path: 'Control/user/flows/f.html'}
    await readFlowInstance(TRANSPORT, location)
    await readFlowInstance(TRANSPORT, location, true)
    assert.deepEqual(asked, [['file_read', false], ['file_read', true]])
  } finally { bridge.installKernelReadHolder(null) }
  const face = await read('../src/inhabitants/DocumentFlowFace.tsx')
  assert.match(face, /readFlowInstance\(transport, location, fresh\)/)
  assert.match(face, /const reread = useCallback\(\(\) => \{[\s\S]*?void load\(true\)[\s\S]*?\}, \[load\]\)/, 'the pane\'s Re-read reads fresh')
  assert.match(face, /data-action="reread" disabled=\{pending\} onClick=\{\(\) => void load\(true\)\}/, 'the device\'s Re-read reads fresh')
})

// ---------------------------------------------------------------------------------------------------------------------
// 3 · the document's packet in the prepared context before the Send

/** AIKit's prepared context as its owner keeps it (aikit-store encounter_context.rs): edited at its revision, and read as the kernel's World
 * Model reads it into its packet slice (world_model.rs `packet`, composed here over the owners' answers as the kernel asks them:
 * support/worldModelFixture.mjs packetSliceOver) — Central's root discloses one project, O-I, whose register holds the conversation. */
function preparedOwner(initial = [], conversation = null) {
  const state = {revision: 4, items: [...initial], n: 0, version: 0}
  const context = () => ({schema: 'aikit.prepared-context/v1', scope: {project: 'O-I', agent_session: 'agent-session/fizz'}, revision: state.revision, digest: `blake3:${state.revision}`, items: state.items})
  const edits = []
  const answered = (result, data) => ({ok: true, outcome: {result, data}})
  const ownerAsk = async op => {
    if (op.op === 'world_browse') return {ok: true, outcome: {result: 'world_read', snapshot: {navigator: {root: {work: {projects: [{name: 'O-I'}]}}}}}}
    if (op.op === 'agency_read') return answered('agency_reading', {spaces: op.project === 'O-I' ? [{agent_sessions: {'agent-session/fizz': {}}}] : []})
    if (op.op === 'encounter' && op.request.request.operation === 'read') {
      return answered('encounter_reading', op.request.agent_session ? context()
        : {schema: 'aikit.prepared-context/v1', scope: {project: op.project, agent_session: null}, revision: 0, digest: 'blake3:0', items: []})
    }
    return {ok: false, error: `the fake owner answers no ${op.op}`}
  }
  const ops = kernel(async op => {
    if (op.op === 'model_subscribe') {
      const slice = await packetSliceOver(ownerAsk, ++state.version)
      return slice.ok ? slice.outcome : new Error(slice.error)
    }
    // The conversation's own acts (its view, draft, Send and status), where the test holds one.
    if (op.op === 'encounter' && op.request.action !== 'context') return conversation ? {result: 'encounter_reading', data: conversation(op.request)} : new Error(`the fake owner answers no ${op.request.action}`)
    const request = op.request.request
    if (request.operation === 'edit') {
      assert.equal(request.basis, state.revision, 'each edit is made at the revision the owner last answered')
      edits.push(request.mutation.operation === 'remove' ? ['remove', request.mutation.id] : ['add', request.mutation.selection.text])
      if (request.mutation.operation === 'remove') state.items = state.items.filter(item => item.id !== request.mutation.id)
      else state.items = [...state.items, {id: `item-${++state.n}`, selection: request.mutation.selection, expression: null, canonical_expression: `@ ${request.mutation.selection.source_ref}`}]
      state.revision++
    }
    return {result: 'encounter_reading', data: context()}
  })
  return {ops, edits, state}
}

const LOCATION = {schema: 'central.path-ref/v1', ref: 'central:path:control:Control/user/flows/walk-notes.html', root: '/c', path: 'Control/user/flows/walk-notes.html'}
const ITEMS = [{entry: 2, by: 'C', scope: 'selection', label: '2 (C)', text: 'the Packet device reads it', chars: 26},
  {entry: 1, by: 'F', scope: 'whole entry', label: '1 (F)', text: 'The packet should be the document’s.', chars: 36}]
const DOCUMENT = {key: 'flow:walk', form: 'Flow', title: 'Walk notes', revision: 'r-7', dirty: false, state: 'saved', location: LOCATION, packet: ITEMS}

test('PURE — each packet item is the selection AIKit keeps: the Flow\'s ref and revision, the item\'s words, its place in the page\'s packet', () => {
  const now = new Date('2026-10-29T20:00:00Z')
  const selection = packetContext.packetSelectionOf(DOCUMENT, ITEMS[0], 0, now)
  assert.deepEqual(selection, {source_ref: LOCATION.ref, source_revision: 'r-7', source_project: null, title: 'Walk notes · 2 (C)', owner: 'oi.document-packet',
    binding_id: LOCATION.ref, text: 'the Packet device reads it', working_copy: false, captured_at: '2026-10-29T20:00:00.000Z',
    anchor: {kind: 'observation', document_id: LOCATION.path, key: 'packet:0', selector: '#ql-doc packet[0]', role: 'selection', node_ref: LOCATION.path, url: null}})
  assert.equal(packetContext.packetSelectionOf({...DOCUMENT, location: {...LOCATION, path: 'Work/O-I/ProjectCentral/user/f.html'}}, ITEMS[0], 0).source_project, 'O-I')
  const later = packetContext.packetSelectionOf(DOCUMENT, ITEMS[0], 0, new Date('2026-10-30T00:00:00Z'))
  assert.ok(packetContext.sameSelection(selection, later), 'the same item read later is the same selection (its capture time aside)')
  assert.ok(!packetContext.sameSelection(selection, packetContext.packetSelectionOf({...DOCUMENT, revision: 'r-8'}, ITEMS[0], 0)), 'a new revision of the page is a new selection')
})

test('BINDING — before the Send, the prepared context is brought to the document\'s packet: what it does not hold taken out, what it holds added', async () => {
  const stale = {id: 'item-old', selection: {...packetContext.packetSelectionOf(DOCUMENT, {...ITEMS[0], text: 'an older capture'}, 0), owner: 'oi.context-tray'}, expression: null, canonical_expression: 'x'}
  const owner = preparedOwner([stale])
  const prepared = await packetContext.prepareDocumentPacket(TRANSPORT, 'O-I', 'agent-session/fizz', DOCUMENT)
  assert.deepEqual(owner.edits, [['remove', 'item-old'], ['add', 'the Packet device reads it'], ['add', 'The packet should be the document’s.']])
  assert.deepEqual(prepared.items.map(item => item.selection.text), ITEMS.map(item => item.text), 'the prepared context holds exactly the Packet\'s items, in its order')
  // The read before the edits is the World Model's packet slice, read fresh (O-I ticket 1005; #1001): no surface reads AIKit's prepared
  // context itself; each edit is the owner's own, at the revision the slice gave and then each edit answered.
  assert.deepEqual(owner.ops[0], {op: 'model_subscribe', slice: 'packet', fresh: true}, 'the packet is read from the World Model, fresh, before it is edited')
  for (const op of owner.ops.slice(1)) assert.deepEqual([op.op, op.project, op.request.action, op.request.agent_session, op.request.request.operation], ['encounter', 'O-I', 'context', 'agent-session/fizz', 'edit'])
  // The Send's review takes each item: the person saw it whole in the Packet (no validator stands in the shell).
  for (const item of prepared.items) await nativeContext.validatePreparedItem(item, prepared)
  // Read again with nothing moved, nothing is edited.
  owner.edits.length = 0
  await packetContext.prepareDocumentPacket(TRANSPORT, 'O-I', 'agent-session/fizz', DOCUMENT)
  assert.deepEqual(owner.edits, [], 'the packet already stands: nothing is written')
})

test('BINDING — the provider the Send runs follows the document the hand reached; a hosted world\'s conversation is left as it is', async () => {
  const owner = preparedOwner()
  doors.publishDocument(DOCUMENT, true)
  try {
    await packetContext.documentPacketProvider({transport: TRANSPORT, project: 'O-I', session: 'agent-session/fizz', sourceWorldRef: 'world:other'})
    assert.deepEqual(owner.ops, [], 'another world\'s conversation is not touched')
    await packetContext.documentPacketProvider({transport: TRANSPORT, project: 'O-I', session: 'agent-session/fizz'})
    assert.equal(owner.edits.length, 2)
    // The Send's own review runs the provider first, then reads the context it reviews: the World Model's packet, fresh.
    owner.edits.length = 0
    owner.ops.length = 0
    const leave = packetContext.followDocumentPacket()
    const expectation = await packetSlice.reviewedContext(TRANSPORT, 'O-I', 'agent-session/fizz')
    leave()
    assert.deepEqual(expectation.reviewed, owner.state.items.map(item => item.id), 'what the Send carries is the Packet\'s items')
    assert.deepEqual(owner.ops.map(op => op.op === 'model_subscribe' ? `${op.slice}${op.fresh ? ' fresh' : ''}` : op.request.request.operation), ['packet fresh', 'packet fresh'],
      'the provider\'s read and the review\'s are the slice\'s; the packet already stood, so nothing was edited')
  } finally { doors.withdrawDocument(DOCUMENT.key) }
  const face = await read('../src/inhabitants/DocumentFlowFace.tsx')
  assert.match(face, /useEffect\(\(\) => \(inPane \? followDocumentPacket\(\) : undefined\), \[inPane\]\)/, 'a Flow in a pane follows its packet')
})

test('BINDING — the conversation\'s Send carries the packet the World Model holds: reviewed from the slice read fresh, and read again after it', async () => {
  // The conversation as AIKit's encounter answers it (aikit.encounter-view/v1): its draft, Send and prepared context enabled; the draft
  // taken at its basis; the Send taken with the reviewed context. FAKE OWNER, as AIKit answers each act.
  const draft = {revision: 0, text: ''}
  let sent = null
  const ACTIONS = ['draft', 'prompt', 'context'].map(name => ({ref: `aikit.encounter.${name}`, enabled: true, reason: null}))
  const owner = preparedOwner([], request => {
    if (request.action === 'view') return {schema: 'aikit.encounter-view/v1', agent_session: request.agent_session, blocks: [], more: false, draft: {...draft}, actions: ACTIONS}
    if (request.action === 'draft') { assert.equal(request.basis, draft.revision); Object.assign(draft, {revision: draft.revision + 1, text: request.text}); return {...draft} }
    if (request.action === 'prompt-context') { sent = request; Object.assign(draft, {revision: draft.revision + 1, text: ''}); return {draft: {...draft}} }
    if (request.action === 'status') return {state: 'idle'}
    throw new Error(`the conversation answers no ${request.action}`)
  })
  doors.publishDocument(DOCUMENT, true)
  const leave = packetContext.followDocumentPacket()
  try {
    const {encounterSessionOf} = await import('../../../../desktop/cradle/src/encounter/session.ts')
    await encounterSessionOf(TRANSPORT, {project: 'O-I', ref: 'agent-session/fizz'}).submit('What does the packet say?')
    assert.ok(sent, 'the Send went with its prepared context (prompt-context)')
    assert.deepEqual(sent.context.reviewed, owner.state.items.map(item => item.id), 'what the Send carries is the Packet\'s items')
    assert.deepEqual([sent.context.revision, sent.context.digest], [owner.state.revision, `blake3:${owner.state.revision}`], 'at the revision the owner holds')
    const acts = owner.ops.map(op => op.op === 'model_subscribe' ? `${op.slice}${op.fresh ? ' fresh' : ''}` : op.request.action === 'context' ? `context ${op.request.request.operation}` : op.request.action)
    assert.deepEqual(acts, ['view', 'draft', 'packet fresh', 'context edit', 'context edit', 'packet fresh', 'prompt-context', 'packet fresh', 'status'],
      'the document\'s packet brought to the context on the slice read fresh, the review read fresh, the Send, and the packet read again for every view that holds it: no read of AIKit\'s own')
  } finally { leave(); doors.withdrawDocument(DOCUMENT.key) }
})

test('BINDING — Answer this sends the document\'s packet with the question: the conversation\'s own Send, refused only in the conversation\'s words', async () => {
  const documentPacket = {form: 'Flow', title: 'Walk notes', packet: ITEMS}
  const reading = {actions: [{ref: 'aikit.encounter.prompt', enabled: true}, {ref: 'aikit.encounter.context', enabled: true}]}
  let sent = 0
  const ready = packet.packetBinding('central:packet', {reading: null, companion: 'Fizz', bound: true, document: documentPacket,
    conversation: {draft: 'What does the packet say?', busy: false, reading}}, {edit: null, send: async () => { sent++ }})
  assert.equal(ready.standing.answer, undefined, 'Answer this stands lit')
  await ready.write([{key: 'answer', value: true}])
  assert.equal(sent, 1)
  const empty = packet.packetBinding('central:packet', {reading: null, companion: 'Fizz', bound: true, document: documentPacket,
    conversation: {draft: '', busy: false, reading}}, {edit: null, send: async () => { sent++ }})
  assert.match(empty.standing.answer.disabled, /Write the question in Fizz's composer/)
  assert.match(empty.standing.answer.disabled, /puts the Flow's packet into AIKit's prepared context/)
  assert.doesNotMatch(empty.standing.answer.disabled, /missing op/i)
})

// ---------------------------------------------------------------------------------------------------------------------
// 4 · REPLACED (O-I ticket 1003, the one send): Heard and the gateway's Steer retired. Send is the next turn in the conversation the
// open agent's occupant works (messages-binding.test.mjs pins it); the line you sent stands queued until that conversation's rows hold it.

const ANSWERED = {gatewayAdmitted: true, gatewayDoc: {state: 'ready'}}
const ANIMA = 'central:position:project:O-I:anima-4'
const POPULATION = {status: 'answered', value: {schema: 'aikit.population-reading/v1', positions: [{position_ref: ANIMA, label: 'Anima', occupancy: {state: 'occupied', agent_ref: 'agent/anima'}}], agents: []}, error: null}

test('SCRIPTED — the line you sent stands queued until the conversation holds it; no Heard reading and no Steer stand beside it', async () => {
  const {createElement} = await import('react')
  const {renderToStaticMarkup} = await import('react-dom/server')
  const family = await import('../src/inhabitants/familyManifest.ts')
  const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
  const host = await import('../src/frame/devices/deviceHost.tsx')
  const {design: messages} = await import('../src/inhabitants/catalogue/panels/ai-kit__messages.tsx')
  family.resetFamilyManifestsForTest()
  loadAgentShellFamilies()
  const draw = binding => renderToStaticMarkup(createElement(host.HostedDevice, {designed: messages, binding, view: 'full', nav: {}}))
  bind.resetHolds()
  const sent = []
  const send = async (position, words) => { sent.push([position, words]) }
  // The open agent's conversation: the session Anima's occupant works, nothing in it yet but the line you send.
  const conversation = {agent: 'Anima', reading: {schema: 'aikit.encounter-view/v1', agent_session: 'agent-session/anima', more: false, draft: {text: '', revision: 0}, blocks: []}, status: {state: 'Resident'}}
  const input = {population: POPULATION, gateway: ANSWERED, conversation, project: 'O-I', holds: bind.chainHolds()}
  msg.messagesBinding(input, {send}).local.open(ANIMA)
  await msg.messagesBinding({...input, holds: bind.chainHolds()}, {send}).write([{key: 'conv.sent', value: 'Skip the root.'}])
  assert.deepEqual(sent, [[ANIMA, 'Skip the root.']], 'your words, to the conversation of the agent open')
  const full = draw(msg.messagesBinding({...input, holds: bind.chainHolds()}, {send}))
  assert.match(full, /Skip the root\.[\s\S]*queued · runs as the next task/)
  assert.doesNotMatch(full, /not heard yet|· heard|steer ·/, 'no Heard reading and no Steer: the conversation itself shows when it is taken')
  for (const gone of ['handlingAdvertisedOf', 'inputDefaultOf', 'communiqueRefOf']) assert.equal(msg[gone], undefined, `${gone}: retired with the gateway send`)
  await assert.rejects(() => read('../src/agent/devices/useHeardAnswer.ts'), /ENOENT/, 'Heard\'s reader is deleted')
  bind.resetHolds()
  host.resetHost()
})
