import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// T-WORLDS W4 (manual §24), the face side: the practice world derived from Central's own disclosure; practice pages made in its folder
// through Central's own creation door and written on the source owner's CAS; the dream journal as the atlas's dreams; Amplify's Source
// entries; the Sitting's record; identity and your sky; Answer this; the composer's kind; journeys from their page. A fake kernel stands
// in for Central (an in-memory ground with revisions, the source door and the page op), so every write here is on a revision read.
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
const practiceWorld = await import(`${cradle}nara/practiceWorld.ts`)
const sitting = await import(`${cradle}nara/sitting.ts`)
const dreams = await import(`${cradle}nara/dreamJournal.ts`)
const answer = await import(`${cradle}nara/answerThis.ts`)
const being = await import(`${cradle}nara/beingIdentity.ts`)
const createInPlace = await import(`${cradle}flow/createInPlace.ts`)
const instances = await import(`${cradle}flow/instances.ts`)
const instance = await import(`${cradle}flow/instance.ts`)
const pageOwner = await import(`${cradle}personal/pageOwner.ts`)
const identityCurrent = await import(`${cradle}nara/identity/current.ts`)

// ── a fake Central: files with revisions, the source door for a project's human ground, the page op, the root disclosure ─────────────

const ROOT = '/central'
function fakeCentral({projects = ['personal']} = {}) {
  const files = new Map()
  let counter = 0
  const ops = []
  const loc = path => ({schema: 'central.path-ref/v1', ref: `central:path:${ROOT}:${path}`, root: ROOT, path})
  const source = path => /^Work\/[^/]+\/ProjectCentral\//.test(path) ? {ref: `central:source:project:${path.split('/')[1]}:${path}`} : null
  const put = (path, content) => { const revision = `rev-${++counter}`; files.set(path, {content, revision}); return revision }
  const reading = path => {
    const file = files.get(path)
    if (!file) throw new Error(`No such file or directory: ${path}`)
    return {schema: 'central.file-reading/v1', location: loc(path), revision: file.revision, byte_len: file.content.length, content_encoding: 'utf-8', content: file.content,
      project: path.startsWith('Work/') ? {name: path.split('/')[1], path: `Work/${path.split('/')[1]}`, project_ref: null} : null, source: source(path), automatic_agent_or_model_invocation: false}
  }
  const islandOf = content => {
    const open = '<script type="application/json" id="ql-doc">', start = content.indexOf(open) + open.length
    return JSON.parse(content.slice(start, content.indexOf('</script>', start)).replace(/<\\\/script/g, '</script').replace(/<\\u0021--/g, '<!--'))
  }
  const formOf = island => island.profile === 'oi.page/v1' ? (island.meta.family === 'beings' ? 'being' : island.meta.family === 'things' ? 'thing' : 'page') : Array.isArray(island.entries) ? 'flow' : 'unknown'
  const outcome = op => {
    ops.push(op)
    switch (op.op) {
      case 'world_browse': return {result: 'world_read', snapshot: {navigator: {root: {
        control: {agent_wiki: {wiki: {space_ref: 'central:wiki:root'}}},
        work: {projects: projects.map(name => ({name, projectcentral: {agent_wiki: {wiki: {space_ref: `central:wiki:project:${name}`}}, user: {exists: true, path: `Work/${name}/ProjectCentral/user`}}}))},
      }}}}
      case 'files_list': {
        const prefix = `${op.path}/`
        const entries = [...files.keys()].filter(path => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
          .map(path => ({name: path.slice(prefix.length), kind: 'file', location: loc(path), byte_len: files.get(path).content.length, retrieval_allowed: true}))
        return {result: 'directory_read', directory: {location: loc(op.path), entries}}
      }
      case 'file_read': return {result: 'file_read', reading: reading(op.location.path)}
      case 'file_operation': {
        const path = op.location.path, held = files.get(path)
        if (source(path) || path.startsWith('Control/') && !path.startsWith('Control/user/flows/')) throw new Error('Protected ground or owner state must use its native authored operation; ordinary file writes are unavailable')
        if (!held && op.request.expected_revision === '') return {result: 'file_operation', data: {outcome: 'created', revision: put(path, op.request.content)}}
        if (!held || held.revision !== op.request.expected_revision) return {result: 'file_operation', data: {outcome: 'conflict', current: held ? reading(path) : undefined}}
        return {result: 'file_operation', data: {outcome: 'written', revision: put(path, op.request.content)}}
      }
      case 'invoke_action': {
        const {action, input} = op.invocation
        const ok = data => ({result: 'action_dispatched', dispatch: {state: 'invoked', data}})
        if (action === 'projectcentral.source.create') {
          const path = `Work/${input.project}/${input.path}`
          if (files.has(path)) return {result: 'action_dispatched', dispatch: {state: 'refused', message: 'already exists'}}
          put(path, input.content); return ok({})
        }
        const path = input.source_ref.replace(/^central:source:project:[^:]+:/, '')
        if (action === 'projectcentral.source.read') return ok({revision: {revision: `src-${files.get(path).revision}`}, content: files.get(path).content})
        if (action === 'projectcentral.source.write') {
          if (input.expected_revision !== `src-${files.get(path).revision}`) return {result: 'action_dispatched', dispatch: {state: 'refused', message: 'stale source revision'}}
          put(path, input.content); return ok({changed: true})
        }
        throw new Error(`no action ${action}`)
      }
      case 'page': {
        const request = op.request
        if (request.operation === 'read') { const r = reading(request.location.path), island = islandOf(r.content)
          return {result: 'page_reading', data: {schema: 'oi.page-reading/v1', location: r.location, revision: r.revision, form: formOf(island), title: island.meta.title, island}} }
        if (request.operation === 'list') {
          const prefix = `${request.path}/`
          const pages = [...files.keys()].filter(path => path.startsWith(prefix) && path.endsWith('.html')).map(path => {
            const island = islandOf(files.get(path).content)
            return {location: loc(path), name: path.slice(prefix.length), form: formOf(island), title: island.meta.title, revision: files.get(path).revision, world: island.meta.world ?? null}
          })
          return {result: 'page_reading', data: {schema: 'oi.page-list/v1', path: request.path, pages, not_pages: [], more: false}}
        }
        if (request.operation === 'launch') return {result: 'page_reading', data: {schema: 'oi.page-launch/v1', location: request.location, form: formOf(islandOf(files.get(request.location.path).content)), title: null, now_ref: 'now:1', allocated: {}, reopened: null}}
        throw new Error(`no page operation ${request.operation}`)
      }
      default: throw new Error(`the fake Central has no ${op.op}`)
    }
  }
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body)
    try { return {json: async () => ({ok: true, outcome: outcome(op)})} } catch (error) { return {json: async () => ({ok: false, error: error.message})} }
  }
  return {transport: {kind: 'bridge', url: 'http://kernel'}, files, ops, loc, put, islandOf}
}

const WORLDS = [
  {ref: 'central:wiki:root', name: 'Your world', kind: 'yours', folder: 'Control/user/flows', project: null},
  {ref: 'central:wiki:project:O-I', name: 'O-I', kind: 'project', folder: 'Work/O-I/ProjectCentral/user', project: 'O-I'},
  {ref: 'central:wiki:project:personal', name: 'personal', kind: 'project', folder: 'Work/personal/ProjectCentral/user', project: 'personal'},
]

// ── the practice world ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('the practice world is the register Central discloses as your Nara space; without it, your own world keeps the practice', () => {
  const practice = practiceWorld.practiceWorldOf(WORLDS)
  assert.equal(practice.world.ref, 'central:wiki:project:personal')
  assert.equal(practice.register, 'practice')
  assert.deepEqual([practice.kind, practice.chain, practice.activator, practice.arm, practice.fogged], ['Practice', ['Packet', 'Nara', 'Scope'], false, false, true])
  assert.match(practice.why, /personal register .*Work\/personal\/ProjectCentral\/user/)
  const fallback = practiceWorld.practiceWorldOf(WORLDS.filter(world => world.project !== 'personal'))
  assert.equal(fallback.world.kind, 'yours')
  assert.equal(fallback.register, 'yours')
  assert.equal(practiceWorld.practiceWorldOf([]), null)
})

test('a practice page says what it is for: a journey by its journey, any other by its mark', () => {
  assert.equal(practiceWorld.practiceOfIsland({meta: {practice: 'dreams'}, entries: []}), 'dreams')
  assert.equal(practiceWorld.practiceOfIsland({meta: {practice: 'journey', journey: {journey_ref: 'j'}}, entries: []}), 'journey')
  assert.equal(practiceWorld.practiceOfIsland({meta: {practice: 'journey'}, entries: []}), 'journey')
  assert.equal(practiceWorld.practiceOfIsland({meta: {}, entries: []}), null)
  assert.equal(practiceWorld.practiceOfIsland({meta: {practice: 'poem'}, entries: []}), null)
})

test('a practice page is made in the practice world through the source door, marked from its first write; its entries are written on the source owner\'s CAS', async () => {
  const central = fakeCentral()
  const made = await practiceWorld.makePracticePage(central.transport, WORLDS[2], 'journal', {now: new Date(2026, 9, 19, 7, 30)})
  assert.match(made.location.path, /^Work\/personal\/ProjectCentral\/user\/flow-2026-10-19-0730\.html$/)
  const island = central.islandOf(central.files.get(made.location.path).content)
  assert.equal(island.meta.practice, 'journal')
  assert.equal(island.meta.title, 'Journal')
  assert.equal(island.meta.view, 'journal')
  assert.equal(island.meta.world, 'central:wiki:project:personal', 'tied to its world')
  assert.ok(central.ops.some(op => op.op === 'invoke_action' && op.invocation.action === 'projectcentral.source.create'), 'through Central\'s own creation door')
  // The journal found again, and an entry appended on the source owner's own CAS (central.files.write refuses protected ground).
  const found = await practiceWorld.findPracticePage(central.transport, WORLDS[2], 'journal')
  assert.equal(found.location.ref, made.location.ref)
  const held = await instances.readFlowInstance(central.transport, made.location)
  const {html} = instance.appendEntry(held.html, 'The morning was still.')
  const written = await instances.writeFlowInstance(central.transport, made.location, held.revision, html)
  assert.equal(written.outcome, 'written')
  assert.ok(central.ops.some(op => op.op === 'invoke_action' && op.invocation.action === 'projectcentral.source.write'))
  assert.ok(!central.ops.some(op => op.op === 'file_operation'), 'no ordinary file write on a project\'s ground')
  // A write on a revision the file has moved past is a conflict, and nothing is written.
  const stale = await instances.writeFlowInstance(central.transport, made.location, held.revision, html)
  assert.equal(stale.outcome, 'conflict')
  // Your own world's Flow keeps Central's file CAS.
  const yours = await practiceWorld.makePracticePage(central.transport, WORLDS[0], 'dreams', {now: new Date(2026, 9, 19, 7, 31)})
  assert.match(yours.location.path, /^Control\/user\/flows\//)
  assert.equal(instances.inProjectGround(yours.location), false)
})

test('a new Flow\'s meta takes what it is made for, never its own identity', () => {
  const html = instance.mintBlankInstance(undefined, new Date(2026, 9, 19))
  const marked = createInPlace.withFlowMeta(html, {practice: 'sitting', sitting: {schema: 'oi.sitting/v1'}})
  assert.equal(instance.parseInstance(marked).meta.practice, 'sitting')
  assert.throws(() => createInPlace.withFlowMeta(html, {documentId: 'x'}), /documentId is its own/)
})

// ── the Sitting ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('a sitting rings at its start, each interval and its end, and keeps the time actually sat', () => {
  assert.deepEqual(sitting.bellMarks({length: 20, intervals: 0}), [0, 1200])
  assert.deepEqual(sitting.bellMarks({length: 20, intervals: 5}), [0, 300, 600, 900, 1200])
  assert.deepEqual(sitting.bellMarks({length: 12, intervals: 5}), [0, 300, 600, 720])
  assert.equal(sitting.bellPitchClass('D'), 2)
  assert.equal(sitting.bellPitchClass('off'), null)
  const settings = {...sitting.DEFAULT_SITTING, length: 20, focus: 'inquiry', inquiry: ' What is here? '}
  const stopped = sitting.sittingRecord(settings, Date.UTC(2026, 9, 19, 6, 40), Date.UTC(2026, 9, 19, 6, 52, 30), 'stop')
  assert.equal(stopped.sat_seconds, 750, 'Stop keeps the length actually sat')
  assert.equal(stopped.length_minutes, 20)
  assert.equal(stopped.inquiry, 'What is here?')
  assert.equal(stopped.centre, null)
  const over = sitting.sittingRecord(settings, 0, 30 * 60_000, 'bell')
  assert.equal(over.sat_seconds, 1200, 'never more than the length set')
  assert.match(sitting.sittingTitle(stopped), /^Sitting · 2026-10-19 · 12 min 30 s · an inquiry$/)
  assert.throws(() => sitting.checkSitting({...settings, length: 0}), /1 to 120 minutes/)
  assert.throws(() => sitting.checkSitting({...settings, intervals: 7}), /5, 10, 15 or 30/)
  assert.equal(Object.keys(stopped).some(key => /score|state|mood/.test(key)), false, 'nothing scores a sitting')
  const day = (() => { const d = new Date(Date.UTC(2026, 9, 19, 6, 40)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  assert.deepEqual(sitting.todaysSittings([stopped], day).map(item => item.minutes), [12.5])
  assert.deepEqual(sitting.sittingOfMeta({sitting: stopped}), stopped)
})

// ── the dream journal ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const journalHtml = () => createInPlace.withFlowMeta(instance.mintBlankInstance(undefined, new Date(2026, 9, 19)), {practice: 'dreams', title: 'Dream journal'})
const DREAM = {id: 'dream-1', createdAt: '2026-10-19T06:00:00.000Z', updatedAt: '2026-10-19T06:00:00.000Z', date: '2026-10-18', title: 'The snake', text: 'A snake by the well.\n\nIt spoke.', context: 'Moving house.', answer: ''}

test('a dream is the journal\'s entry, its id the dream\'s; a change is a correction beside it; the answer a reply; nothing is erased', () => {
  assert.deepEqual(dreams.readDreamHtml(dreams.dreamHtml(DREAM)), {date: DREAM.date, title: DREAM.title, text: DREAM.text, context: DREAM.context})
  let html = journalHtml()
  const first = dreams.planDreamWrites([], [DREAM])
  assert.deepEqual(first.map(write => write.op), ['dream'])
  html = first.reduce((next, write) => dreams.applyDreamWrite(next, write), html)
  let read = dreams.dreamsOfFlow(instance.parseInstance(html))
  assert.equal(read.length, 1)
  assert.equal(read[0].id, 'dream-1')
  assert.equal(read[0].text, DREAM.text)
  // A changed dream and an answer: a Correct entry and a reply; the first entry stays as written.
  const changed = {...read[0], text: 'A snake by the dry well.', answer: 'It asks me to slow down.'}
  const second = dreams.planDreamWrites(read, [changed])
  assert.deepEqual(second.map(write => write.op), ['correct', 'answer'])
  html = second.reduce((next, write) => dreams.applyDreamWrite(next, write), html)
  const doc = instance.parseInstance(html)
  assert.equal(doc.entries.length, 3)
  assert.equal(dreams.readDreamHtml(doc.entries[0].html).text, DREAM.text, 'the earlier entry stays')
  assert.deepEqual(doc.entries[1].relations.map(r => [r.type, r.entryId]), [['correct', 'dream-1']])
  assert.deepEqual(doc.entries[2].relations.map(r => [r.type, r.entryId]), [['reply', 'dream-1']])
  read = dreams.dreamsOfFlow(doc)
  assert.equal(read.length, 1, 'a correction and an answer are no dreams of their own')
  assert.equal(read[0].text, 'A snake by the dry well.')
  assert.equal(read[0].answer, 'It asks me to slow down.')
  assert.throws(() => dreams.planDreamWrites(read, []), /kept: correct it rather than erase it/)
  assert.deepEqual(dreams.planDreamWrites(read, read), [], 'nothing changed, nothing written')
})

test('Amplify lays Source entries on the dream, each with its sources, and lays the same image only once', () => {
  let html = dreams.applyDreamWrite(journalHtml(), {op: 'dream', id: 'dream-1', dream: DREAM})
  const places = [
    {occurrenceId: 'occ-1', title: 'The serpent of the well', when: '1912', place: 'Zürich', kind: 'dream', sources: [{ref: 'atlas:cite:cw5#¶580', label: 'Symbols of Transformation (CW5), ¶580'}]},
    {occurrenceId: 'occ-2', title: 'Kundalini', when: '1932', place: '', kind: 'vision', sources: []},
  ]
  const once = dreams.applyAmplification(html, 'dream-1', {familyId: 'snake', name: 'Snake'}, places)
  assert.equal(once.laid, 2)
  const entries = instance.parseInstance(once.html).entries
  const source = entries[1]
  assert.deepEqual(source.relations.map(r => [r.type, r.entryId ?? null, r.ref]), [['source', 'dream-1', 'atlas:occurrence:occ-1'], ['source', null, 'atlas:cite:cw5#¶580']])
  assert.match(source.html, /Snake<\/strong> has stood here before: The serpent of the well \(1912, Zürich\), a dream/)
  assert.match(entries[2].html, /names no source/)
  assert.doesNotMatch(source.html, /means|meaning/, 'it interprets nothing')
  const twice = dreams.applyAmplification(once.html, 'dream-1', {familyId: 'snake', name: 'Snake'}, places)
  assert.equal(twice.laid, 0)
  assert.equal(twice.html, once.html)
  assert.equal(dreams.dreamsOfFlow(instance.parseInstance(once.html)).length, 1, 'a Source entry is no dream')
})

test('the atlas\'s dreams are read from the dream journal and written back as its entries; a dropped dream is refused; Amplify lays its Source entries', async () => {
  const host = await import('../src/projections/atlas/practice/dreamsHost.ts')
  const central = fakeCentral()
  const base = new Map()
  const storage = {getItem: key => base.get(key) ?? null, setItem: (key, value) => base.set(key, value), removeItem: key => base.delete(key), clear: () => base.clear(), key: () => null, get length() { return base.size }}
  const at = {hash: ''}
  const said = []
  const bound = host.bindDreamJournal({base: storage, owners: host.kernelDreamOwners(central.transport, text => said.push(text)), location: at})
  await bound.ready
  assert.equal(bound.fault(), null)
  assert.equal(bound.storage.getItem(host.DREAMS_KEY), '[]', 'no dream journal yet: no dreams')
  // The store's own probe and other collections pass through to the workspace's store.
  bound.storage.setItem('aae.practice.v1.charts', '[]')
  assert.equal(base.get('aae.practice.v1.charts'), '[]')
  // A dream recorded: held at once for the lens, then kept in a dream journal made in the practice world.
  bound.storage.setItem(host.DREAMS_KEY, JSON.stringify([DREAM]))
  assert.equal(JSON.parse(bound.storage.getItem(host.DREAMS_KEY))[0].id, 'dream-1')
  await bound.settled()
  assert.equal(bound.fault(), null, said.join(' '))
  const journal = [...central.files.keys()].find(path => path.startsWith('Work/personal/ProjectCentral/user/'))
  assert.ok(journal, 'the dream journal is a page in the practice world')
  const island = central.islandOf(central.files.get(journal).content)
  assert.equal(island.meta.practice, 'dreams')
  assert.equal(island.entries.length, 1)
  assert.equal(island.entries[0].id, 'dream-1')
  assert.equal(base.has(host.DREAMS_KEY), false, 'never browser storage')
  assert.throws(() => bound.storage.setItem(host.DREAMS_KEY, '[]'), /kept/)
  // Amplify: the lens's route for an image of the dream lays its places, once.
  const model = {famById: new Map([['snake', {id: 'snake', name: 'Snake', archetypes: []}]]), famOcc: new Map([['snake', [0, 1]]]), archById: new Map(),
    occ: [{id: 'occ-a', title: 'A serpent', yearDisplay: '1912', place: 'Zürich', locusType: 'object', cites: [], coFamilyIds: []},
      {id: 'occ-b', title: 'The serpent dream', yearDisplay: '1913', place: '', locusType: 'dream', cites: [{work: 'cw5', workTitle: 'CW5', year: '1912', locator: '¶580'}], coFamilyIds: []}]}
  bound.attach(model)
  at.hash = '#/dreams/dream-1/snake'
  bound.storage.getItem(host.DREAMS_KEY)
  bound.storage.getItem(host.DREAMS_KEY)
  await new Promise(resolve => setImmediate(resolve))
  await bound.settled()
  const after = central.islandOf(central.files.get(journal).content)
  assert.equal(after.entries.length, 3, 'two places laid, once')
  assert.match(after.entries[1].html, /The serpent dream/, 'the image\'s dreams first')
  assert.ok(after.entries[1].relations.some(r => r.type === 'source' && r.ref === 'atlas:cite:cw5#¶580'))
  assert.equal(JSON.parse(bound.storage.getItem(host.DREAMS_KEY)).length, 1)
  bound.dispose()
})

// ── Answer this ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('Answer this finds the bound conversation, asks from the page, waits for Nara and, armed, keeps the answer; without a binding it says what is missing', async () => {
  const location = {schema: 'central.path-ref/v1', ref: 'ref:journal', root: 'R', path: 'Work/personal/ProjectCentral/user/journal.html'}
  const island = {meta: {practice: 'journal'}, entries: [{id: 'e1', html: '<p>Why does the morning feel so wide?</p>'}]}
  const identity = {selection_ref: 's', source: {source_ref: 'id', revision: '1'}, reading: {person_ref: 'person:frank', nara_ref: 'nara:frank'}}
  // Armed (the track's Arm, manual §24.1): the answer is written with its receipt. Unarmed it waits as a proposal (t765-nara-practice.test.mjs).
  const base = {transport: {kind: 'bridge', url: 'x'}, identity, expressionRef: 'expression:room', location, island, entryId: 'e1', arm: true}
  await assert.rejects(answer.answerThis({...base, identity: null}), /none is chosen/)
  await assert.rejects(answer.answerThis({...base, expressionRef: null}), /bound to an open Expression/)
  await assert.rejects(answer.answerThis(base, {lookup: async () => null}), /no conversation bound to this Expression/)
  await assert.rejects(answer.answerThis({...base, entryId: 'e9'}), /Select an entry/)
  const dialogue = {key: 'k', role: 'nara', project: 'O-I', provisioning: {agent_session: 'agent-session/1', space: 's'}, binding: {}}
  const views = [{blocks: [{id: 4, kind: 'completed', text: ''}]}, {blocks: [{id: 5, kind: 'user', text: 'q'}, {id: 6, kind: 'assistant', text: ''}]},
    {blocks: [{id: 5, kind: 'user', text: 'q'}, {id: 6, kind: 'assistant', text: 'Wide, because '}, {id: 7, kind: 'assistant', text: 'you wrote…'}, {id: 8, kind: 'completed', text: ''}]}]
  const asked = [], kept = []
  const done = await answer.answerThis(base, {
    // REPLACED (O-I #740 lane B): the channel's project 'O-I'; Nara's conversation is the world's, asked in its root register ('').
    lookup: async (_t, project, who, expression, role) => { assert.deepEqual([project, who.reading.person_ref, expression, role], ['', 'person:frank', 'expression:room', 'nara']); return dialogue },
    view: async () => views.shift() ?? views.at(-1),
    ask: async (_t, ask) => { asked.push(ask); return {lived: {context: {passages: [{key: 'p1'}, {key: 'p2'}]}}, basis: {}} },
    read: async (_t, dialogue, block) => ({dialogue, blockId: block}),
    flow: async () => ({location}),
    retain: async (_t, _flow, nara) => { kept.push(nara); return {revision: 'r2', entryId: 'nara-answer-1', already: false} },
    sleep: async () => {}, everyMs: 1, waitMs: 100,
  })
  assert.equal(asked[0].practice.kind, 'journal', 'the page\'s practice places the turn')
  assert.equal(asked[0].answering.passage, 'Why does the morning feel so wide?')
  assert.equal(kept[0].blockId, 6, 'the answer to the question asked, once its turn completed')
  assert.deepEqual(done, {kind: 'written', receipt: {page: 'ref:journal', entryId: 'nara-answer-1', revision: 'r2', already: false, agent: 'Nara', agentSession: 'agent-session/1', answering: 'e1', passages: 2}})
  assert.throws(() => answer.answeredBlock([{id: 9, kind: 'user', text: 'q'}, {id: 10, kind: 'error', text: ''}], 8), /in an error/)
  assert.equal(answer.answeredBlock([{id: 9, kind: 'user', text: 'q'}, {id: 10, kind: 'assistant', text: 'part'}], 8), null, 'still answering')
})

// ── identity and your sky ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('a Being page holds its person by its Subject; the identity\'s layers stand with their sources or their reasons; the birth sky is the identity\'s own', async () => {
  const page = (bindings) => ({profile: 'oi.page/v1', meta: {family: 'beings'}, bindings})
  assert.deepEqual(being.beingSubject(page({subjectRef: 'person:frank', kind: 'person'})), {person_ref: 'person:frank'})
  assert.match(being.beingSubject(page({subjectRef: null})).reason, /about no person/)
  assert.match(being.beingSubject(page({subjectRef: 'agent:nara', kind: 'agent'})).reason, /agent/)
  const reading = {person_ref: 'person:frank', nara_ref: 'nara:frank', input_revision: 'i', profile: {name: 'Frank', person_ref: 'person:frank', nara_ref: 'nara:frank'},
    matrix: [{kind: 'birthdate-name', coordinate: 'M4.0-0', available: true, route: '', source: {source_ref: 'src', revision: 'r1'}, method: null, data: null, absence_reason: null},
      {kind: 'gene-keys', coordinate: 'M4.0-3', available: false, route: '', source: null, method: null, data: null, absence_reason: 'No Gene Keys reading is given.'}],
    natal: {schema: 'ql.nara-natal/v1', status: 'available', reason: null, sky: {snapshot_ref: 'sky:natal', provider: {}, bodies: [{body: 'Sun', longitude_degrees: 169.38, retrograde: false}]}}}
  const layers = being.identityLayers(reading)
  assert.deepEqual(layers.map(layer => [layer.coordinate, layer.present, layer.source?.revision ?? null, layer.reason]),
    [['M4.0-0', true, 'r1', null], ['M4.0-3', false, null, 'No Gene Keys reading is given.']])
  assert.deepEqual(being.natalOf(reading), {bodies: [{body: 'Sun', longitude_degrees: 169.38, retrograde: false}]})
  assert.match(being.natalOf({...reading, natal: null}).reason, /no natal chart/)
  // Read through nara_identity: list finds the person's saved identity, open reads it at its revision (QL's inspection: no chart, as the
  // real owner answers), and calculate runs QL's natal calculation of exactly that profile.
  const calls = []
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body); calls.push(op.request.operation)
    const data = op.request.operation === 'list' ? {schema: 'oi.nara-identity/v1', profiles: [{source_ref: 'id:frank', revision: 'r7', name: 'Frank', person_ref: 'person:frank'}]}
      : op.request.operation === 'calculate' ? {schema: 'oi.nara-identity/v1', reading: {...reading, schema: 'ql.nara-identity-reading/v1'}}
      : {schema: 'oi.nara-identity/v1', source: {source_ref: 'id:frank', revision: 'r7'}, reading: {...reading, natal: null, schema: 'ql.nara-identity-reading/v1'}}
    return {json: async () => ({ok: true, outcome: {result: 'nara_identity', data}})}
  }
  identityCurrent.clearCurrentIdentity()
  const read = await being.readBeingIdentity({kind: 'bridge', url: 'x'}, page({subjectRef: 'person:frank', kind: 'person'}))
  assert.equal(read.ok, true)
  assert.deepEqual(calls, ['list', 'open', 'calculate'])
  assert.equal(read.identity.source.revision, 'r7')
  assert.equal(read.identity.natal.length, 1)
  const sky = await import('../src/inhabitants/ql/devices/qlSky.ts')
  sky.resetQlSky({call: async () => ({outcome: null, error: 'no sky'})})
  assert.ok(sky.qlSkyBinding(sky.qlSkyState()).standing.natalBodies.disabled, 'closed until a launch gives it')
  sky.setQlSkyNatal({person_ref: 'person:frank', name: 'Frank', source: read.identity.source, bodies: read.identity.natal})
  const values = sky.qlSkyValues(sky.qlSkyState())
  assert.deepEqual(JSON.parse(values.natalBodies), [{body: 'Sun', longitude_degrees: 169.38, retrograde: false}])
  assert.equal(values.natal, true, 'the natal ring opens on it')
  sky.setQlSkyNatal(null, 'No saved identity names person:x.')
  assert.equal(sky.qlSkyBinding(sky.qlSkyState()).standing.natalBodies.disabled, 'No saved identity names person:x.')
})

// ── journeys from their page ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('a journey\'s Launch opens its Deck once; a journey made from New… opens on the Deck by its theme, with consent to chance', async () => {
  const deck = await import('../src/inhabitants/ql/devices/qlDeck.ts')
  const launch = await import('../src/inhabitants/ql/devices/practiceLaunch.ts')
  const central = fakeCentral()
  const location = (await practiceWorld.makePracticePage(central.transport, WORLDS[2], 'journey', {now: new Date(2026, 9, 19, 8, 0)})).location
  const journeyCalls = []
  deck.resetQlDeck({call: async op => {
    if (op.op === 'page') return {outcome: {result: 'page_reading', data: {location, revision: central.files.get(location.path).revision}}}
    journeyCalls.push(op.request)
    const reading = {schema: 'ql.nara-oracle-journey-reading/v1', concern: {concern_ref: 'c', title: 'The move'}, journey_revision: 1, status: 'open', spreads: [], symbolic_assignments: [], iching: [],
      deck: {dealt: 0}}
    return {outcome: {result: 'nara_journey', data: {schema: 'oi.nara-journey/v1', operation: op.request.operation, reading, page: {location, revision: 'r2'}}}}
  }})
  // The page made from New… holds no journey yet: the Deck asks for its theme, and nothing is read or dealt.
  await deck.openDeckJourney({location, actor_ref: 'person:frank', subject_ref: 'person:frank', day_ref: 'central:day:2026-10-19', unopened: true})
  assert.equal(journeyCalls.length, 0)
  let binding = deck.qlDeckBinding(deck.qlDeckState())
  assert.equal(binding.writes('theme'), true)
  assert.equal(binding.standing.theme.disabled, deck.NO_CONSENT, 'consent to chance first')
  await assert.rejects(binding.write([{key: 'theme', value: 'The move'}]), /consent/)
  deck.setQlDeckView({consent: true})
  binding = deck.qlDeckBinding(deck.qlDeckState())
  await binding.write([{key: 'theme', value: 'The move'}])
  assert.deepEqual(journeyCalls.map(call => call.operation), ['open'])
  assert.equal(journeyCalls[0].consent_to_chance, true)
  assert.equal(journeyCalls[0].deck.system, 'tarot-thoth')
  assert.equal(journeyCalls[0].concern.title, 'The move')
  assert.equal(journeyCalls[0].expected_revision, central.files.get(location.path).revision, 'opened on the revision read')
  assert.equal(deck.qlDeckState().view.consent, false, 'the opening spends the consent')
  assert.equal(deck.qlDeckState().journey.unopened, false)
  // Launching the same journey again while the Deck holds it reads nothing again and deals nothing.
  await launch.openJourneyOfPage(central.transport, location, {meta: {journey: {}}}, 'The move')
  assert.deepEqual(journeyCalls.map(call => call.operation), ['open'])
})

test('a page\'s Launch is answered after its owner opens the moment', async () => {
  const central = fakeCentral()
  const location = (await practiceWorld.makePracticePage(central.transport, WORLDS[2], 'journal', {now: new Date(2026, 9, 19, 9, 0)})).location
  const told = []
  const stop = pageOwner.onPageLaunched(launched => { told.push(launched.now_ref) })
  const launched = await pageOwner.launchPage(central.transport, location)
  stop()
  assert.equal(launched.now_ref, 'now:1')
  assert.deepEqual(told, ['now:1'])
})
