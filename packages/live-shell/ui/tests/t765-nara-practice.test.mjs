import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// O-I #765, finishing Nara's practice (manual §24.1, §24.2, §24.6): your natal sky is your saved identity's own, read through its owner
// (nara_identity open, then QL's calculate of exactly that profile: an open carries no chart); Amplify lays Source entries from your
// pages (nara_lived_context), your knowledge (AIKit's knowledge search) and the works of your worlds (the atlas field), each naming
// where it came from; Answer this proposes while Arm is off and writes with a receipt while it is on. The fixtures are shaped as the real
// owners answered on scratch roots (a private walk-bridge over a scratch Central, 28 Oct): nara_identity list/open/calculate,
// nara_lived_context compose, knowledge search.
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
  if(url.includes('.html?raw')){const path=new URL(url.slice(0,url.indexOf('?'))).pathname;return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(path,'utf8'))};}
  if(url.endsWith('.json')&&!url.startsWith('data:'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url).pathname,'utf8')};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText.split('import.meta.env').join('({BASE_URL: "/"})').split('import.meta.glob').join('(() => ({}))')};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}

const cradle = '../../../../desktop/cradle/src/'
const being = await import(`${cradle}nara/beingIdentity.ts`)
const identityCurrent = await import(`${cradle}nara/identity/current.ts`)
const answer = await import(`${cradle}nara/answerThis.ts`)
const dreams = await import(`${cradle}nara/dreamJournal.ts`)
const sources = await import(`${cradle}nara/amplifySources.ts`)
const createInPlace = await import(`${cradle}flow/createInPlace.ts`)
const instance = await import(`${cradle}flow/instance.ts`)

const TRANSPORT = {kind: 'bridge', url: 'http://kernel'}
/** A kernel standing in for the owners: each op answered by `answer(op)`, every op kept. */
function kernel(answer) {
  const ops = []
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body); ops.push(op)
    try { return {json: async () => ({ok: true, outcome: await answer(op)})} } catch (error) { return {json: async () => ({ok: false, error: error.message})} }
  }
  return ops
}

// ── your natal sky: the saved identity's own ─────────────────────────────────────────────────────────────────────────────────────────

const PERSON = 'person:scratch-you'
const SOURCE = 'central:source:control:root:Control/self/nara/identities/0d5ab466.json'
const PROFILE = {schema: 'ql.nara-identity-profile/v1', person_ref: PERSON, nara_ref: 'nara:scratch-you', name: 'Scratch You',
  birth: {date: '1990-06-15', time: '08:30', precision: 'exact', uncertainty_minutes: null, fold: null,
    place: {label: 'London', latitude_degrees: 51.5074, longitude_degrees: -0.1278, timezone: 'Europe/London', source_ref: 'place:test:london'}},
  jungian: null, gene_keys: null, human_design: null, quintessence: null}
const MATRIX = (charted) => [
  {kind: 'birthdate-name', coordinate: 'M4.0.0', available: true, route: 'self-report', source: {source_ref: SOURCE, revision: 'r1'}, method: null, data: null, absence_reason: null},
  {kind: 'natal-chart', coordinate: 'M4.0.1', available: charted, route: 'calculated', source: null, method: null, data: null, absence_reason: charted ? null : 'Natal calculation has not run for this input'},
]
/** As the real owner answers: open runs QL's inspect (no chart), calculate runs the natal calculation of the profile it is given. */
const READING = (charted, input = 'sha256:36fd46') => ({schema: 'ql.nara-identity-reading/v1', person_ref: PERSON, nara_ref: 'nara:scratch-you', input_revision: input, profile: PROFILE,
  matrix: MATRIX(charted), natal: charted ? {schema: 'ql.nara-natal/v1', status: 'available', reason: null, epoch_utc: '1990-06-15T07:30:00Z', request_ref: 'req', time_resolution: null,
    chart: null, provider: {name: 'Kerykeion', kerykeion_version: '5.7.1', network: 'disabled'},
    sky: {snapshot_ref: 'sha256:b33d9a', provider: {name: 'Kerykeion'}, bodies: [{body: 'Sun', longitude_degrees: 83.95, retrograde: false}, {body: 'Saturn', longitude_degrees: 294.04, retrograde: true}]}} : null,
  identity: null, material: {value: '', standing: '', supplied_offices: [], identity_quaternion_ref: null, m3_form_address_ref: null}, private: true, public_export: false})
function identityOwner({profiles = [{source_ref: SOURCE, revision: 'r1', name: 'Scratch You', person_ref: PERSON}], calculated = READING(true)} = {}) {
  return kernel(op => {
    assert.equal(op.op, 'nara_identity')
    const r = op.request
    const data = r.operation === 'list' ? {schema: 'oi.nara-identity/v1', profiles, errors: []}
      : r.operation === 'open' ? {schema: 'oi.nara-identity/v1', source: {source_ref: r.source_ref, revision: 'r1'}, reading: READING(false)}
      : r.operation === 'calculate' ? (assert.deepEqual(r.profile, PROFILE, 'the chart is calculated from exactly the profile opened'), {schema: 'oi.nara-identity/v1', reading: calculated})
      : assert.fail(`no ${r.operation}`)
    return {result: 'nara_identity', data}
  })
}

test('your birth sky is your saved identity\'s own: opened at its revision, then calculated by QL from exactly that profile', async () => {
  identityCurrent.clearCurrentIdentity()
  const ops = identityOwner()
  const read = await being.readPersonIdentity(TRANSPORT, PERSON)
  assert.equal(read.ok, true, read.reason)
  assert.deepEqual(ops.map(op => op.request.operation), ['list', 'open', 'calculate'])
  assert.deepEqual(read.identity.natal, [{body: 'Sun', longitude_degrees: 83.95, retrograde: false}, {body: 'Saturn', longitude_degrees: 294.04, retrograde: true}])
  assert.equal(read.identity.source.revision, 'r1')
  assert.ok(read.identity.layers.find(layer => layer.coordinate === 'M4.0.1').present, 'the chart layer stands with the calculated reading')
  // A calculation of another input is not this identity's chart.
  identityOwner({calculated: READING(true, 'sha256:other')})
  const other = await being.readPersonIdentity(TRANSPORT, PERSON)
  assert.equal(other.ok, true)
  assert.equal(other.identity.natal, null)
  assert.match(other.identity.natalWhy, /another profile|not this identity/)
})

test('your saved identity is the one you chose, else the only one saved; two unchosen are not guessed between, and none says so', async () => {
  identityCurrent.clearCurrentIdentity()
  identityOwner()
  assert.deepEqual(await being.yourIdentitySource(TRANSPORT), {ok: true, person_ref: PERSON, name: 'Scratch You', source: {source_ref: SOURCE, revision: 'r1'}})
  identityOwner({profiles: []})
  assert.match((await being.yourIdentitySource(TRANSPORT)).reason, /No identity is saved yet/)
  identityOwner({profiles: [{source_ref: 'a', revision: '1', name: 'A', person_ref: 'person:a'}, {source_ref: 'b', revision: '1', name: 'B', person_ref: 'person:b'}]})
  assert.match((await being.yourIdentitySource(TRANSPORT)).reason, /2 identities are saved/)
  identityCurrent.selectCurrentIdentity({...READING(false), profile: {...PROFILE, person_ref: 'person:b', nara_ref: 'nara:b'}, person_ref: 'person:b', nara_ref: 'nara:b'}, {source_ref: 'b', revision: '1'})
  const ops = identityOwner({profiles: []})
  assert.deepEqual(await being.yourIdentitySource(TRANSPORT), {ok: true, person_ref: 'person:b', name: 'Scratch You', source: {source_ref: 'b', revision: '1'}})
  assert.equal(ops.length, 0, 'the chosen identity is read from the choice, without a listing')
  identityCurrent.clearCurrentIdentity()
})

// ── Amplify from your pages, your knowledge and the works of your worlds ─────────────────────────────────────────────────────────────

/** nara_lived_context compose, as the real owner answered for a journal holding the term (one passage, its reason the concern term). */
const LIVED = {schema: 'oi.nara-lived-context/v1', sources: [], unread: [], skipped: [], context: {schema: 'ql.nara-lived-context/v1', context_revision: 'c1', subject_ref: PERSON,
  concern: {concern_ref: 'amplify:dream-1:snake', title: 'Snake', terms: ['Snake']}, occasion: null, journey: null, disclosed: [], attribution: {human: 2, agent: 0, operational: 0},
  candidates: 2, omitted: [], composed_at_unix_ms: 1, passages: [
    {key: 'central:path:/c:Control/user/flows/journal.html/doc-j/e-river@rev-j', source_ref: 'central:path:/c:Control/user/flows/journal.html', revision: 'rev-j', document_id: 'doc-j',
      entry_id: 'e-river', contribution_id: null, selector: null, kind: 'journal', actor: 'human', author_ref: 'participant:p-1', mode: 'written', standing: 'authored',
      day_ref: null, occurred_at_unix_ms: Date.UTC(2026, 9, 12), received_at_unix_ms: Date.UTC(2026, 9, 12), late_receipt: false, unreviewed_revision: false, superseded_by: null,
      reasons: [{reason: 'concern-term', term: 'snake'}], text: 'I walked by the river and a snake crossed the path; I froze.'},
    {key: 'central:path:/c:Control/user/flows/dreams.html/doc-d/dream-1@rev-d', source_ref: 'central:path:/c:Control/user/flows/dreams.html', revision: 'rev-d', document_id: 'doc-d',
      entry_id: 'dream-1', contribution_id: null, selector: null, kind: 'dream', actor: 'human', author_ref: 'participant:p-1', mode: 'written', standing: 'authored',
      day_ref: null, occurred_at_unix_ms: Date.UTC(2026, 9, 18), received_at_unix_ms: Date.UTC(2026, 9, 18), late_receipt: false, unreviewed_revision: false, superseded_by: null,
      reasons: [{reason: 'concern-term', term: 'snake'}], text: 'A snake by the well.'}]}}
/** AIKit's knowledge search, as the real owner answered (`aikit knowledge search --json`). */
const KNOWLEDGE = {query: 'Snake', absences: ['ProjectMap code search unavailable: provider absent'], hits: [
  {address: {kind: 'source', value: 'source:bkmr:glade-frank:3'}, authority: 'observed', kind: 'knowledge-source', label: 'The serpent and the staff', provider: 'provider/source-pool/bkmr-stores',
    resource: 'source:bkmr:glade-frank:3', score: 1, snippet: '# The serpent and the staff\n\nThe snake that sheds its skin is renewal; Asclepius carries it on his staff.'},
  {address: {kind: 'wiki', value: 'wiki:no-label'}, label: '', provider: 'p', resource: 'r', score: 0.4, snippet: ''}]}

test('each source answers in its own words: a passage of your pages, a source of your knowledge, each naming where it came from', () => {
  const pages = sources.pagePlaces(LIVED, {dreamId: 'dream-1', titles: new Map([['central:path:/c:Control/user/flows/journal.html', 'Journal']])})
  assert.equal(pages.length, 1, 'the dream amplified is not its own parallel')
  assert.equal(pages[0].from, 'pages')
  assert.equal(pages[0].title, '“I walked by the river and a snake crossed the path; I froze.”')
  assert.deepEqual(pages[0].sources, [{ref: LIVED.context.passages[0].key, label: 'your Journal, 12 Oct 2026'}])
  const known = sources.knowledgePlaces(KNOWLEDGE)
  assert.equal(known.length, 1, 'a hit with no label names nothing, so it is not laid')
  assert.equal(known[0].from, 'knowledge')
  assert.equal(known[0].title, 'The serpent and the staff')
  assert.deepEqual(known[0].sources, [{ref: 'aikit:knowledge:source:source:bkmr:glade-frank:3', label: 'The serpent and the staff (provider/source-pool/bkmr-stores)'}])
  let html = dreams.applyDreamWrite(createInPlace.withFlowMeta(instance.mintBlankInstance(undefined, new Date(2026, 9, 19)), {practice: 'dreams', title: 'Dream journal'}),
    {op: 'dream', id: 'dream-1', dream: {date: '2026-10-18', title: 'The snake', text: 'A snake by the well.', context: '', answer: ''}})
  const works = [{occurrenceId: 'occ-1', title: 'The serpent of the well', when: '1912', place: 'Zürich', kind: 'dream', sources: [{ref: 'atlas:cite:cw5#¶580', label: 'CW5, ¶580'}]}]
  const laid = dreams.applyAmplification(html, 'dream-1', {familyId: 'snake', name: 'Snake'}, [...pages, ...known, ...works])
  assert.equal(laid.laid, 3)
  const entries = instance.parseInstance(laid.html).entries.slice(1)
  assert.match(entries[0].html, /From your pages: your Journal, 12 Oct 2026\./)
  assert.match(entries[1].html, /From your knowledge: The serpent and the staff \(provider\/source-pool\/bkmr-stores\)\./)
  assert.match(entries[2].html, /From the works of your worlds: CW5, ¶580\./)
  assert.deepEqual(entries.map(entry => entry.relations[0].ref), [LIVED.context.passages[0].key, 'aikit:knowledge:source:source:bkmr:glade-frank:3', 'atlas:occurrence:occ-1'])
  assert.ok(entries.every(entry => entry.relations[0].entryId === 'dream-1'), 'each stands on the dream it amplifies')
  for (const entry of entries) assert.doesNotMatch(entry.html, /means|meaning/, 'it interprets nothing')
  assert.equal(dreams.applyAmplification(laid.html, 'dream-1', {familyId: 'snake', name: 'Snake'}, [...pages, ...known, ...works]).laid, 0, 'the same image lays nothing twice')
})

test('the owners read for Amplify: your pages through nara_lived_context, your knowledge through AIKit\'s search, each refusal in its owner\'s words', async () => {
  const ops = kernel(op => op.op === 'nara_lived_context' ? {result: 'nara_lived_context', data: LIVED}
    : op.op === 'knowledge' ? {result: 'knowledge', data: KNOWLEDGE} : assert.fail(op.op))
  const pages = [{location: {schema: 'central.path-ref/v1', ref: 'central:path:/c:Control/user/flows/journal.html', root: '/c', path: 'Control/user/flows/journal.html'}, practice: 'journal', title: 'Journal'}]
  const fromPages = await sources.readPagePlaces(TRANSPORT, {subject_ref: PERSON, image: {familyId: 'snake', name: 'Snake'}, dreamId: 'dream-1', pages})
  assert.equal(fromPages.length, 1)
  const asked = ops[0].request
  assert.deepEqual([asked.operation, asked.subject_ref, asked.concern.terms, asked.pages[0].practice], ['compose', PERSON, ['Snake'], 'journal'])
  const fromKnowledge = await sources.readKnowledgePlaces(TRANSPORT, {familyId: 'snake', name: 'Snake'})
  assert.equal(fromKnowledge[0].title, 'The serpent and the staff')
  assert.deepEqual(ops[1].request, {action: 'search', query: 'Snake'})
})

test('Amplify on a dream lays Source entries from each of the three sources; a source turned off lays nothing; one that does not answer says why', async () => {
  const host = await import('../src/projections/atlas/practice/dreamsHost.ts')
  const loc = path => ({schema: 'central.path-ref/v1', ref: `central:path:/c:${path}`, root: '/c', path})
  const files = new Map()
  let n = 0
  const said = []
  const placesAsked = []
  const owners = (amplify) => ({
    world: async () => ({ref: 'central:wiki:root', name: 'Your world', kind: 'yours', folder: 'Control/user/flows', project: null}),
    find: async () => files.size ? loc('Control/user/flows/dreams.html') : null,
    make: async () => { files.set('Control/user/flows/dreams.html', {html: createInPlace.withFlowMeta(instance.mintBlankInstance(undefined, new Date(2026, 9, 19)), {practice: 'dreams', title: 'Dream journal'}), revision: `r${++n}`}); return loc('Control/user/flows/dreams.html') },
    read: async location => { const held = files.get(location.path); return {html: held.html, revision: held.revision, doc: instance.parseInstance(held.html)} },
    write: async (location, revision, html) => { if (files.get(location.path).revision !== revision) return {outcome: 'conflict'}; files.set(location.path, {html, revision: `r${++n}`}); return {outcome: 'written'} },
    said: text => said.push(text),
    amplify,
  })
  const pagesFrom = async ask => { placesAsked.push(['pages', ask.image.name, ask.dreamId]); return sources.pagePlaces(LIVED, {dreamId: ask.dreamId, titles: new Map()}) }
  const knowledgeFrom = async image => { placesAsked.push(['knowledge', image.name]); return sources.knowledgePlaces(KNOWLEDGE) }
  const model = {famById: new Map([['snake', {id: 'snake', name: 'Snake', archetypes: []}]]), famOcc: new Map([['snake', [0]]]), archById: new Map(),
    occ: [{id: 'occ-b', title: 'The serpent dream', yearDisplay: '1913', place: '', locusType: 'dream', cites: [{work: 'cw5', workTitle: 'CW5', year: '1912', locator: '¶580'}], coFamilyIds: []}]}
  const base = new Map()
  const storage = {getItem: key => base.get(key) ?? null, setItem: (key, value) => base.set(key, value), removeItem: key => base.delete(key), clear: () => base.clear(), key: () => null, get length() { return base.size }}
  const at = {hash: ''}
  const bound = host.bindDreamJournal({base: storage, owners: owners({pages: pagesFrom, knowledge: knowledgeFrom}), location: at, model: () => model})
  await bound.ready
  bound.storage.setItem(host.DREAMS_KEY, JSON.stringify([{id: 'dream-1', createdAt: '2026-10-19T06:00:00.000Z', updatedAt: '2026-10-19T06:00:00.000Z', date: '2026-10-18', title: 'The snake', text: 'A snake by the well.', context: '', answer: ''}]))
  await bound.settled()
  at.hash = '#/dreams/dream-1/snake'
  bound.storage.getItem(host.DREAMS_KEY)
  await new Promise(resolve => setImmediate(resolve))
  await bound.amplified()
  await bound.settled()
  const entries = instance.parseInstance(files.get('Control/user/flows/dreams.html').html).entries.slice(1)
  assert.deepEqual(entries.map(entry => (entry.html.match(/From (your pages|your knowledge|the works of your worlds)/) ?? [])[1]), ['your pages', 'your knowledge', 'the works of your worlds'],
    'one Source entry from each source, in the manual\'s order')
  assert.deepEqual(placesAsked, [['pages', 'Snake', 'dream-1'], ['knowledge', 'Snake']])
  assert.equal(said.length, 0, said.join(' '))
  bound.dispose()

  // Amplify from: your knowledge off lays nothing from it; your pages not answering is said, and the others still lay.
  files.clear(); placesAsked.length = 0
  const quiet = host.bindDreamJournal({base: storage, owners: owners({pages: async () => { throw new Error('QL did not answer') }, knowledge: knowledgeFrom}), location: at, model: () => model,
    amplifyFrom: {pages: true, knowledge: false, works: true}})
  await quiet.ready
  quiet.storage.setItem(host.DREAMS_KEY, JSON.stringify([{id: 'dream-1', createdAt: '2026-10-19T06:00:00.000Z', updatedAt: '2026-10-19T06:00:00.000Z', date: '2026-10-18', title: 'The snake', text: 'A snake by the well.', context: '', answer: ''}]))
  await quiet.settled()
  quiet.storage.getItem(host.DREAMS_KEY)
  await new Promise(resolve => setImmediate(resolve))
  await quiet.amplified()
  await quiet.settled()
  const laid = instance.parseInstance(files.get('Control/user/flows/dreams.html').html).entries.slice(1)
  assert.deepEqual(laid.map(entry => (entry.html.match(/From (your pages|your knowledge|the works of your worlds)/) ?? [])[1]), ['the works of your worlds'])
  assert.equal(placesAsked.length, 0, 'your knowledge, turned off, is not asked')
  assert.match(said.join(' '), /Amplify from your pages did not answer: QL did not answer/)
  quiet.dispose()
})

// ── Answer this under Arm ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const LOCATION = {schema: 'central.path-ref/v1', ref: 'ref:journal', root: 'R', path: 'Control/user/flows/journal.html'}
const ISLAND = {meta: {practice: 'journal'}, entries: [{id: 'e1', html: '<p>Why does the morning feel so wide?</p>'}]}
const IDENTITY = {selection_ref: 's', source: {source_ref: 'id', revision: '1'}, reading: {person_ref: 'person:frank', nara_ref: 'nara:frank'}}
const DIALOGUE = {key: 'k', role: 'nara', project: 'O-I', provisioning: {agent_session: 'agent-session/1', space: 's'}, binding: {}}
function naraTurn(kept) {
  const views = [{blocks: [{id: 4, kind: 'completed', text: ''}]},
    {blocks: [{id: 5, kind: 'user', text: 'q'}, {id: 6, kind: 'assistant', text: 'Wide, because you wrote…'}, {id: 7, kind: 'completed', text: ''}]}]
  const read = [], asks = []
  return {read, asks, steps: {
    lookup: async () => DIALOGUE, view: async () => views.shift() ?? views.at(-1),
    ask: async (_t, ask) => { asks.push(ask); return {lived: {context: {passages: [{key: 'p1'}, {key: 'p2'}]}}, basis: {}} },
    read: async (_t, dialogue, block) => { read.push(block); return {dialogue, blockId: block, answer: 'Wide, because you wrote…', question: 'q', basis: {}} },
    flow: async () => ({location: LOCATION}),
    retain: async (_t, _flow, nara) => { kept.push(nara); return {revision: 'r2', entryId: 'nara-answer-1', already: false} },
    sleep: async () => {}, everyMs: 1, waitMs: 100,
  }}
}

test('Answer this with Arm off leaves Nara\'s answer as a proposal, read back from her conversation, and writes nothing in the page', async () => {
  const kept = []
  const {read, steps} = naraTurn(kept)
  const done = await answer.answerThis({transport: TRANSPORT, identity: IDENTITY, expressionRef: 'expression:room', location: LOCATION, island: ISLAND, entryId: 'e1', arm: false}, steps)
  assert.equal(kept.length, 0, 'nothing is written while Arm is off')
  assert.deepEqual(read, [6], 'the completed answer is read back from Nara\'s conversation')
  assert.equal(done.kind, 'proposed')
  assert.deepEqual({page: done.proposal.page, entry: done.proposal.entryId, block: done.proposal.blockId, session: done.proposal.agentSession, passages: done.proposal.passages},
    {page: 'ref:journal', entry: 'e1', block: 6, session: 'agent-session/1', passages: 2})
  assert.deepEqual(answer.answerProposals('ref:journal').map(p => p.blockId), [6], 'the proposal waits on its page')
  assert.match(answer.answerWords(done), /proposal.*waits for you/i)
})

test('Answer this with Arm on writes Nara\'s answer into the page with a receipt, read back from Central; a waiting proposal on that entry is kept, not asked again', async () => {
  // The proposal the Arm-off test left on e1 is the answer kept: read back from Nara again, written, its receipt read back.
  assert.equal(answer.answerProposals('ref:journal').length, 1)
  const kept = []
  const {asks, read, steps} = naraTurn(kept)
  const done = await answer.answerThis({transport: TRANSPORT, identity: IDENTITY, expressionRef: 'expression:room', location: LOCATION, island: ISLAND, entryId: 'e1', arm: true}, steps)
  assert.equal(done.kind, 'written')
  assert.equal(asks.length, 0, 'the waiting proposal is kept: Nara is not asked again')
  assert.deepEqual(read, [6], 'its answer is read back from Nara before it is written')
  assert.equal(kept.length, 1)
  assert.deepEqual(done.receipt, {page: 'ref:journal', entryId: 'nara-answer-1', revision: 'r2', already: false, agent: 'Nara', agentSession: 'agent-session/1', answering: 'e1', passages: 2})
  assert.deepEqual(answer.answerProposals('ref:journal'), [], 'the proposal on that entry is answered by the write')
  assert.match(answer.answerWords(done), /Nara wrote .* receipt/)
  // Nothing waiting: armed, Nara is asked, and the answer is written with its receipt.
  const again = naraTurn(kept)
  const fresh = await answer.answerThis({transport: TRANSPORT, identity: IDENTITY, expressionRef: 'expression:room', location: LOCATION, island: ISLAND, entryId: 'e1', arm: true}, again.steps)
  assert.equal(again.asks.length, 1)
  assert.equal(fresh.kind, 'written')
  assert.equal(kept.length, 2)
})

test('Clip view\'s Answer this carries the shell\'s write arm to Nara; without an identity or an Expression it is refused as before', async () => {
  const clip = await import('../src/central/clipBinding.ts')
  const asked = []
  const run = async input => { asked.push(input.arm); return {kind: 'proposed', proposal: {}} }
  const hand = arm => clip.answeringHand({transport: TRANSPORT, location: LOCATION, island: ISLAND, identity: IDENTITY, expressionRef: 'expression:room', arm, run, after: () => {}})
  await hand(false).ask('e1')
  await hand(true).ask('e1')
  assert.deepEqual(asked, [false, true])
  assert.match(clip.answeringHand({transport: TRANSPORT, location: LOCATION, island: ISLAND, identity: null, expressionRef: 'expression:room', arm: true, run, after: () => {}}).refused, /none is chosen/)
  assert.match(clip.answeringHand({transport: TRANSPORT, location: LOCATION, island: ISLAND, identity: IDENTITY, expressionRef: null, arm: true, run, after: () => {}}).refused, /open Expression/)
  assert.equal(clip.answeringHand({transport: TRANSPORT, location: null, island: ISLAND, identity: IDENTITY, expressionRef: 'x', arm: true, run, after: () => {}}), null)
})
