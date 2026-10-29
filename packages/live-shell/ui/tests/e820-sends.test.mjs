import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Lane AE (map O-I #706): the owner acts the search line's sends waited on, and the readings beside them.
//  1. #820 — a passage sent elsewhere: to a person, the Shared Field's `message` (a Contact request they accept); to a place, Central's
//     `central.place.file-passage`; to another document as a quote, the kernel's page `append_quote` — each through the kernel, each lit.
//  2. #820 — the Flow pane's Re-read asks the owner fresh (`readFlowInstance`'s fresh flag).
//  3. #745 (lane AA's proposal) — the document's packet put into AIKit's prepared context before the Send, so the Send carries what the
//     Packet shows: op encounter context edit, remove what the packet does not hold and add what it holds.
//  4. #741 (lane AC's open item) — Heard on the line you sent in Messages: AIKit's desk read of that one Communique by its ref; and Input
//     starts on Steer where the gateway advertises `communique-handling`, on Queue otherwise.
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

/** AIKit's prepared context as its owner keeps it (aikit-store encounter_context.rs): read, and edited at its revision. */
function preparedOwner(initial = []) {
  const state = {revision: 4, items: [...initial], n: 0}
  const context = () => ({schema: 'aikit.prepared-context/v1', scope: {project: 'O-I', agent_session: 'agent-session/fizz'}, revision: state.revision, digest: `blake3:${state.revision}`, items: state.items})
  const edits = []
  const ops = kernel(op => {
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
  for (const op of owner.ops) assert.deepEqual([op.op, op.project, op.request.action, op.request.agent_session], ['encounter', 'O-I', 'context', 'agent-session/fizz'])
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
    // The Send's own review runs the provider first, then reads the context it reviews.
    owner.edits.length = 0
    const leave = packetContext.followDocumentPacket()
    const expectation = await nativeContext.reviewedContext(TRANSPORT, 'O-I', 'agent-session/fizz')
    leave()
    assert.deepEqual(expectation.reviewed, owner.state.items.map(item => item.id), 'what the Send carries is the Packet\'s items')
  } finally { doors.withdrawDocument(DOCUMENT.key) }
  const face = await read('../src/inhabitants/DocumentFlowFace.tsx')
  assert.match(face, /useEffect\(\(\) => \(inPane \? followDocumentPacket\(\) : undefined\), \[inPane\]\)/, 'a Flow in a pane follows its packet')
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
// 4 · Heard in Messages, and where Input starts

test('PURE — Input starts on Steer where the gateway advertises communique-handling, on Queue otherwise and while unread', async () => {
  const heardHook = await import('../src/agent/devices/useHeardAnswer.ts')
  const protocol = features => ({type: 'protocol', gateway_version: '0.71.0', ...(features ? {features} : {})})
  assert.equal(msg.handlingAdvertisedOf(protocol(['communique-exact-instance', 'communique-handling'])), true)
  assert.equal(msg.handlingAdvertisedOf(protocol(['communique-exact-instance'])), false)
  assert.equal(msg.handlingAdvertisedOf(protocol()), false, 'a gateway that predates advertisement keeps none')
  assert.equal(msg.handlingAdvertisedOf({type: 'ecology'}), undefined)
  assert.equal(msg.inputDefaultOf(true), 'steer')
  assert.equal(msg.inputDefaultOf(false), 'queue')
  assert.equal(msg.inputDefaultOf(undefined), 'queue')
  assert.equal(msg.communiqueRefOf({route: 'aikit gateway send', data: {communique: {communique_ref: 'aikit:communique:01x'}}}), 'aikit:communique:01x')
  assert.equal(msg.communiqueRefOf({data: {}}), undefined)
  assert.equal(heardHook.heardOf({heard: true}), true)
  assert.equal(heardHook.heardOf({state: 'pending'}), undefined)
})

const ANSWERED = {gatewayAdmitted: true, gatewayDoc: {state: 'ready'}}
const ANIMA = 'central:position:project:O-I:anima-4'
const POPULATION = {status: 'answered', value: {schema: 'aikit.population-reading/v1', positions: [{position_ref: ANIMA, label: 'Anima', occupancy: {state: 'occupied', agent_ref: 'agent/anima'}}], agents: []}, error: null}

test('BINDING — Send keeps the Communique AIKit answered; Heard is AIKit\'s reading of that one Communique, and Input follows the gateway', async () => {
  bind.resetHolds()
  const requests = []
  const gateway = async request => { requests.push(request); return {route: 'aikit gateway send', data: {communique: {schema: 'aikit.communique/v1', communique_ref: 'aikit:communique:01heard'}}} }
  const input = {population: POPULATION, gateway: ANSWERED, project: 'O-I', holds: bind.chainHolds(), handlingAdvertised: true}
  msg.messagesBinding(input, {gateway}).local.open(ANIMA)
  let binding = msg.messagesBinding({...input, holds: bind.chainHolds()}, {gateway})
  assert.equal(binding.values['conv.input'], 'steer', 'the gateway keeps a steer: Input starts on Steer')
  await binding.write([{key: 'conv.sent', value: 'Skip the root.'}])
  assert.deepEqual(requests[0], {kind: 'send', project: 'O-I', to: ANIMA, body: 'Skip the root.', handling: 'steer'})
  assert.deepEqual(msg.sentOf(bind.viewHolds(bind.chainHolds(), msg.MESSAGES_ID).sent), {to: ANIMA, words: 'Skip the root.', ref: 'aikit:communique:01heard'},
    'the line holds the Communique its send answered')
  // Not read yet: Heard waits for AIKit, and says so.
  binding = msg.messagesBinding({...input, holds: bind.chainHolds()}, {gateway})
  assert.equal(binding.values['conv.heard'], undefined)
  assert.match(binding.standing['conv.heard'].disabled, /has not answered its read of the Communique yet/)
  // AIKit's reading: pending, then delivered.
  const heardOf = heard => ({ref: 'aikit:communique:01heard', status: 'answered', value: {schema: 'aikit.communique-heard/v1', communique_ref: 'aikit:communique:01heard', state: heard ? 'delivered' : 'pending', heard}})
  binding = msg.messagesBinding({...input, holds: bind.chainHolds(), heard: heardOf(false)}, {gateway})
  assert.equal(binding.values['conv.heard'], false)
  binding = msg.messagesBinding({...input, holds: bind.chainHolds(), heard: heardOf(true)}, {gateway})
  assert.equal(binding.values['conv.heard'], true)
  assert.equal(binding.standing['conv.heard'], undefined)
  // A reading of another Communique is not this line's.
  binding = msg.messagesBinding({...input, holds: bind.chainHolds(), heard: {...heardOf(true), ref: 'aikit:communique:other'}}, {gateway})
  assert.equal(binding.values['conv.heard'], undefined)
  // AIKit's refusal is its words.
  binding = msg.messagesBinding({...input, holds: bind.chainHolds(), heard: {ref: 'aikit:communique:01heard', status: 'refused', error: 'aikit gateway heard: unknown command'}}, {gateway})
  assert.equal(binding.standing['conv.heard'].disabled, 'aikit gateway heard: unknown command')
  // The hand's own choice of Input stands over the gateway's.
  binding.local['conv.input']('queue')
  assert.equal(msg.messagesValues({...input, holds: bind.chainHolds()})['conv.input'], 'queue')
  bind.resetHolds()
  // A gateway that does not advertise it: Queue, and no handling named.
  const older = {...input, holds: bind.chainHolds(), handlingAdvertised: false}
  msg.messagesBinding(older, {gateway}).local.open(ANIMA)
  binding = msg.messagesBinding({...older, holds: bind.chainHolds()}, {gateway})
  assert.equal(binding.values['conv.input'], 'queue')
  await binding.write([{key: 'conv.sent', value: 'Next.'}])
  assert.deepEqual(requests[1], {kind: 'send', project: 'O-I', to: ANIMA, body: 'Next.'})
  bind.resetHolds()
})

test('SCRIPTED — the line you sent says whether the agent heard it, steer or queued', async () => {
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
  const gateway = async () => ({data: {communique: {communique_ref: 'aikit:communique:01heard'}}})
  // The open agent's conversation as AIKit's journal reads it: nothing yet but the line you send.
  const conversation = {status: 'answered', value: {position_ref: ANIMA, communiques: []}, error: null}
  const input = {population: POPULATION, gateway: ANSWERED, conversation, project: 'O-I', holds: bind.chainHolds(), handlingAdvertised: true}
  msg.messagesBinding(input, {gateway}).local.open(ANIMA)
  await msg.messagesBinding({...input, holds: bind.chainHolds()}, {gateway}).write([{key: 'conv.sent', value: 'Skip the root.'}])
  const heard = value => ({ref: 'aikit:communique:01heard', status: 'answered', value: {heard: value}})
  assert.match(draw(msg.messagesBinding({...input, holds: bind.chainHolds(), heard: heard(false)})), /Skip the root\.[\s\S]*steer · not heard yet/)
  assert.match(draw(msg.messagesBinding({...input, holds: bind.chainHolds(), heard: heard(true)})), /data-heard="true"[^>]*>[\s\S]*Skip the root\.[\s\S]*steer · heard/)
  msg.messagesBinding({...input, holds: bind.chainHolds()}).local['conv.input']('queue')
  assert.match(draw(msg.messagesBinding({...input, holds: bind.chainHolds(), heard: heard(true)})), /Skip the root\.[\s\S]*queued · heard/)
  assert.match(draw(msg.messagesBinding({...input, holds: bind.chainHolds(), heard: heard(false)})), /queued · runs as the next task/)
  bind.resetHolds()
  host.resetHost()
})
