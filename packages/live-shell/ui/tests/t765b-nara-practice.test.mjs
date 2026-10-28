import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

// O-I #765, part two (manual §24.4, §24.6): the Astrology lens draws your chart from your saved identity — QL's calculation of exactly
// that profile, mapped to the atlas's chart contract — and no second engine computes it; a journey launched as Reading opens as an
// Expression, its cards and lines laid out in a scene with each card's codon and the entries it is linked to; and Nara's answer quoted
// into your Day goes as your press, carried by your authority, naming Nara as its producer. The fixtures are the real owners' answers on
// scratch inputs, 28 Oct: QL's `nara calculate` (tests/fixtures/ql-nara-natal-2026-10-28.json) and QL's `nara.journey.read` after an
// open, a torus draw, a link to an entry and a cast (tests/fixtures/ql-nara-journey-reading-2026-10-28.json).
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
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}, body: {classList: {toggle: noop}}}

const fixture = async name => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'))
const NATAL = await fixture('ql-nara-natal-2026-10-28.json')
const JOURNEY = await fixture('ql-nara-journey-reading-2026-10-28.json')

const cradle = '../../../../desktop/cradle/src/'
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

// ── your chart, from your identity ───────────────────────────────────────────────────────────────────────────────────────────────────

const PERSON = 'person:scratch-you'
const SOURCE = 'central:source:control:root:Control/self/nara/identities/0d5ab466.json'
const PROFILE = {schema: 'ql.nara-identity-profile/v1', person_ref: PERSON, nara_ref: 'nara:scratch-you', name: 'Scratch You',
  birth: {date: '1990-06-15', time: '08:30', precision: 'exact', uncertainty_minutes: null, fold: null,
    place: {label: 'London', latitude_degrees: 51.5074, longitude_degrees: -0.1278, timezone: 'Europe/London', source_ref: 'place:test:london'}},
  jungian: null, gene_keys: null, human_design: null, quintessence: null}
const READING = (natal, input = 'sha256:36fd46') => ({schema: 'ql.nara-identity-reading/v1', person_ref: PERSON, nara_ref: 'nara:scratch-you', input_revision: input, profile: PROFILE,
  matrix: [], natal, identity: null, material: {value: '', standing: '', supplied_offices: [], identity_quaternion_ref: null, m3_form_address_ref: null}, private: true, public_export: false})
/** The identity owner as it answers (part one, t765-nara-practice.test.mjs): open runs no natal calculation; calculate runs QL's. */
function identityOwner({profiles = [{source_ref: SOURCE, revision: 'r1', name: 'Scratch You', person_ref: PERSON}], natal = NATAL} = {}) {
  return kernel(op => {
    assert.equal(op.op, 'nara_identity')
    const r = op.request
    const data = r.operation === 'list' ? {schema: 'oi.nara-identity/v1', profiles, errors: []}
      : r.operation === 'open' ? {schema: 'oi.nara-identity/v1', source: {source_ref: r.source_ref, revision: 'r1'}, reading: READING(null)}
      : r.operation === 'calculate' ? (assert.deepEqual(r.profile, PROFILE), {schema: 'oi.nara-identity/v1', reading: READING(natal)})
      : assert.fail(`no ${r.operation}`)
    return {result: 'nara_identity', data}
  })
}

test('QL\'s natal maps to the atlas\'s chart contract: the port\'s own check passes, and every place is QL\'s', async () => {
  const host = await import('../src/projections/atlas/practice/chartsHost.ts')
  const sidecar = await import('../src/projections/atlas/src/sky/sidecar.ts')
  const mapped = host.chartOfNatal(NATAL, PROFILE)
  assert.ok('chart' in mapped, mapped.reason)
  assert.deepEqual(sidecar.chartProblems(mapped.chart), [], 'the mapped chart keeps the contract the lens and the overlay draw')
  for (const body of NATAL.sky.bodies) assert.equal(mapped.chart.bodies[body.body.toLowerCase()].lon, body.longitude_degrees, `${body.body} stands where QL put it`)
  assert.equal(mapped.chart.bodies.saturn.retrograde, NATAL.sky.bodies.find(b => b.body === 'Saturn').retrograde)
  assert.equal(mapped.chart.angles.ascendant.lon, NATAL.chart.angles.find(a => a.name === 'Ascendant').abs_pos)
  assert.equal(mapped.chart.angles.midheaven.lon, NATAL.chart.angles.find(a => a.name === 'Medium_Coeli').abs_pos)
  assert.deepEqual(mapped.chart.houses.cusps, NATAL.chart.houses.map(h => h.abs_pos))
  assert.equal(mapped.chart.houses.effective, 'Whole Sign')
  const bodyAspects = NATAL.chart.aspects.filter(a => mapped.chart.bodies[a.p1_name.toLowerCase()] && mapped.chart.bodies[a.p2_name.toLowerCase()])
  assert.deepEqual(mapped.chart.aspects, bodyAspects.map(a => ({a: a.p1_name.toLowerCase(), b: a.p2_name.toLowerCase(), type: a.aspect, orb: a.orbit})))
  assert.equal(mapped.chart.utc, '1990-06-15T07:30:00Z')
  assert.equal(mapped.chart.timeKnown, true)
  assert.deepEqual(mapped.birth, {date: '1990-06-15', time: '08:30', offsetMinutes: 60, lat: 51.5074, lon: -0.1278, place: 'London'})
  // QL charts no unknown birth time: nothing is computed in its place, and QL's reason is said.
  const none = host.chartOfNatal({...NATAL, status: 'unavailable', reason: 'unknown-birth-time', chart: null, sky: null}, PROFILE)
  assert.match(none.reason, /unknown-birth-time|birth time/)
})

test('a held chart is the chart: chartOf computes nothing for it, and the lens and the controller compute charts only through chartOf', async () => {
  const charts = await import('../src/projections/atlas/src/astro/charts.ts')
  const host = await import('../src/projections/atlas/practice/chartsHost.ts')
  const {chart, birth} = host.chartOfNatal(NATAL, PROFILE)
  const held = {id: 'you', label: 'Scratch You', birth, source: 'local', chart}
  assert.equal(charts.chartOf(held), chart, 'the held chart itself, never a computed one')
  // The tripwire: no ported module computes a chart but through chartOf (manual §24.6 "The shell does not compute a second chart").
  for (const path of ['../src/projections/atlas/src/lenses/astrology.ts', '../src/projections/atlas/src/app/controller.ts']) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /(?<![A-Za-z.])natalChart\(/, `${path} computes no chart of its own`)
  }
})

test('your chart is read from your saved identity through its owner: list, open at its revision, QL\'s calculate of exactly that profile', async () => {
  const identityCurrent = await import(`${cradle}nara/identity/current.ts`)
  const host = await import('../src/projections/atlas/practice/chartsHost.ts')
  identityCurrent.clearCurrentIdentity()
  const ops = identityOwner()
  const yours = await host.kernelYourChart(TRANSPORT)()
  assert.equal(yours.ok, true, yours.reason)
  assert.deepEqual(ops.map(op => op.request.operation), ['list', 'open', 'calculate'])
  assert.equal(yours.chart.label, 'Scratch You')
  assert.equal(yours.chart.source.revision, 'r1')
  assert.equal(yours.chart.chart.bodies.sun.lon, NATAL.sky.bodies[0].longitude_degrees)
  identityOwner({profiles: []})
  assert.match((await host.kernelYourChart(TRANSPORT)()).reason, /No identity is saved yet/)
  identityOwner({natal: {...NATAL, status: 'unavailable', reason: 'unknown-birth-time', chart: null, sky: null}})
  assert.match((await host.kernelYourChart(TRANSPORT)()).reason, /unknown-birth-time|birth time/)
})

test('the lens\'s chart store holds your chart from your identity and refuses every chart write; the astrology material is corpus-neutral', async () => {
  const host = await import('../src/projections/atlas/practice/chartsHost.ts')
  const store = await import('../src/projections/atlas/src/practice/store.ts')
  const charts = await import('../src/projections/atlas/src/astro/charts.ts')
  const mapped = host.chartOfNatal(NATAL, PROFILE)
  const base = new Map([['other', 'kept']])
  const storage = {getItem: key => base.get(key) ?? null, setItem: (key, value) => base.set(key, value), removeItem: key => base.delete(key), clear: () => base.clear(), key: () => null, get length() { return base.size }}
  const said = []
  let reads = 0
  const bound = host.bindYourChart({base: storage, read: async () => { reads++; return {ok: true, chart: {label: 'Scratch You', birth: mapped.birth, chart: mapped.chart, source: {source_ref: SOURCE, revision: 'r1'}}} }, said: text => said.push(text), deferred: true})
  assert.equal(reads, 0, 'deferred: nothing is read before it is asked for')
  store.setPracticeStorage(bound.storage)
  // The published astrology material waits for your chart, so the lens reads both together.
  const response = await bound.published(null)('astrology')
  assert.equal(reads, 1)
  const material = await response.json()
  assert.deepEqual([material.people, material.frame, material.signs], [[], [], {}], 'no corpus: no curated person, no quotation')
  assert.deepEqual(material.order.bodies, ['moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'sun'])
  for (const key of material.order.bodies) assert.deepEqual(material.bodies[key].quotes, [])
  assert.match(material.yours.line, /identity/)
  assert.equal(material.yours.none, null)
  assert.equal(await bound.published(null)('redbook'), null, 'every other name is the provider\'s, here none')
  // The lens reads your chart as the store holds it: QL's, held, and chartOf returns it.
  const mine = charts.localChart()
  assert.equal(mine.id, 'you')
  assert.deepEqual(charts.chartOf(mine), JSON.parse(JSON.stringify(mapped.chart)))
  assert.deepEqual(charts.chartSources([]).map(rec => rec.id), ['you'])
  // A chart is never kept from the lens: saving, deleting and wiping are refused in words, and nothing moves.
  assert.throws(() => charts.saveLocalChart('Me', mapped.birth), /identity/)
  assert.throws(() => charts.forgetLocalChart(), /identity/)
  assert.throws(() => store.practice.wipe('charts'), /identity/)
  assert.equal(said.length, 3)
  assert.equal(charts.localChart().chart.utc, mapped.chart.utc, 'your chart stands as it was')
  assert.equal(bound.storage.getItem('other'), 'kept', 'every other collection is the store it was bound to before')
  // No identity: no chart is held, and the material says why.
  const none = host.bindYourChart({base: storage, read: async () => ({ok: false, reason: 'No identity is saved yet: Setup asks for your date of birth.'}), said: noop})
  const nothing = await (await none.published(null)('astrology')).json()
  assert.match(nothing.yours.none, /No identity is saved yet/)
  store.setPracticeStorage(none.storage)
  assert.equal(charts.localChart(), null)
  store.setPracticeStorage(null)
})

// ── a journey launched as Reading opens as an Expression ────────────────────────────────────────────────────────────────────────────

const JOURNEY_PAGE = {schema: 'central.path-ref/v1', ref: 'central:path:/c:Control/user/flows/journey.html', root: '/c', path: 'Control/user/flows/journey.html'}

test('a journey\'s reading lays out as an Expression scene: each card at its position with its codon, its linked entries and its lines', async () => {
  const reading = await import(`${cradle}nara/journeyReading.ts`)
  const document = reading.composeJourneyExpression(JOURNEY, JOURNEY_PAGE)
  assert.equal(document.schema, 'oi.expression/v1')
  assert.match(document.expression_ref, /^expression:journey-[A-Za-z0-9._-]+$/)
  assert.equal(document.scenes.length, 1)
  const scene = document.scenes[0]
  assert.equal(scene.title, `Reading · ${JOURNEY.concern.title}`)
  assert.deepEqual(document.selection, {scene_ref: scene.scene_ref, entity_ref: null})
  const entities = scene.entity_refs.map(ref => document.entities[ref])
  for (const ref of [...scene.entity_refs, ...Object.keys(document.entities)]) assert.ok(ref.startsWith(`${document.expression_ref}:entity:`) && /^[A-Za-z0-9._-]{1,128}$/.test(ref.slice(`${document.expression_ref}:entity:`.length)), ref)
  const placements = JOURNEY.spreads.flatMap(spread => spread.placements)
  for (const placement of placements) {
    const card = entities.find(entity => entity.subject?.subject_ref === placement.placement_ref)
    assert.ok(card, `${placement.position} ${placement.card.name} is laid out`)
    assert.equal(card.title, `${placement.position} · ${placement.card.name}${placement.reversed ? ' (reversed)' : ''}`)
    assert.equal(card.subject.native_owner, 'ql')
    assert.equal(card.parameters.glyph.value, placement.card.codons.length ? `codon ${placement.card.codons.join('·')}` : 'no codon')
    assert.ok(card.subject.readings.some(r => r.ref === placement.card.token_ref))
    assert.ok(Math.abs(card.parameters.x.value) <= 1600 && Math.abs(card.parameters.y.value) <= 1600)
  }
  const positions = new Set(entities.filter(e => e.subject?.subject_ref.includes('/placement/')).map(e => `${e.parameters.x.value},${e.parameters.y.value}`))
  assert.equal(positions.size, placements.length, 'each position stands in its own place')
  // The entry the card is linked to stands beside it, its source Central's, related to the card.
  const linked = placements.find(p => p.recognitions.length)
  const recognition = linked.recognitions[0]
  const entry = entities.find(entity => entity.subject?.native_owner === 'central')
  assert.ok(entry, 'the linked entry is laid out')
  assert.deepEqual(entry.subject.sources, [{ref: recognition.source.source_ref, revision: recognition.source.revision, availability: 'available'}])
  const cardRef = scene.entity_refs.find(ref => document.entities[ref].subject?.subject_ref === linked.placement_ref)
  assert.ok(Object.values(document.relations).some(r => r.from_entity_ref === cardRef && r.to_entity_ref === entry.entity_ref), 'the card is related to its entry')
  // The lines: the cast stands with its hexagram and is related to the card it was cast for.
  const cast = JOURNEY.iching[0]
  const lines = entities.find(entity => entity.subject?.subject_ref === cast.reading_ref)
  assert.equal(lines.title, `Hexagram ${cast.primary} → ${cast.resulting}`)
  assert.equal(lines.parameters.glyph.value, cast.lines.join(' '))
  assert.ok(Object.values(document.relations).some(r => r.from_entity_ref === lines.entity_ref && r.to_entity_ref === cardRef))
  for (const relation of Object.values(document.relations)) assert.ok(document.entities[relation.from_entity_ref] && document.entities[relation.to_entity_ref])
  // A later draw stands behind the first, and every card already laid keeps its place (a later launch only adds).
  const later = structuredClone(JOURNEY)
  later.spreads.push({...structuredClone(JOURNEY.spreads[0]), spread_ref: 'journey:doc-probe/spread/9',
    placements: JOURNEY.spreads[0].placements.map((p, i) => ({...p, placement_ref: `journey:doc-probe/placement/9${i}`, recognitions: []}))})
  const grown = reading.composeJourneyExpression(later, JOURNEY_PAGE)
  for (const ref of scene.entity_refs) assert.deepEqual(grown.entities[ref].parameters, document.entities[ref].parameters, `${document.entities[ref].title} keeps its place`)
  const behind = grown.scenes[0].entity_refs.filter(ref => !document.entities[ref]).map(ref => grown.entities[ref].parameters.z.value)
  assert.ok(behind.length === 6 && behind.every(z => z < 0), 'the later spread stands behind the first')
})

test('Launch as Reading reads the journey, opens its Expression through the Expression owner once, adds what a later draw laid, and shows it', async () => {
  const reading = await import(`${cradle}nara/journeyReading.ts`)
  const held = new Map()
  let current = JOURNEY
  const ops = kernel(op => {
    if (op.op === 'nara_journey') {
      assert.deepEqual(op.request, {operation: 'read', location: JOURNEY_PAGE})
      return {result: 'nara_journey', data: {schema: 'oi.nara-journey/v1', operation: 'read', reading: current, page: {location: JOURNEY_PAGE, revision: 'r9'}}}
    }
    assert.equal(op.op, 'expression')
    const r = op.request
    if (r.operation === 'inspect') {
      const document = held.get(r.expression_ref)
      if (!document) throw new Error('No open Expression has this ref')
      return {result: 'expression', data: {document}}
    }
    if (r.operation === 'open') { held.set(r.document.expression_ref, r.document); return {result: 'expression', data: {document: r.document}} }
    if (r.operation === 'edit') {
      const document = structuredClone(held.get(r.expression_ref))
      assert.equal(r.expected_revision, document.revision)
      document.revision += 1
      for (const change of r.changes) {
        if (change.change === 'entity_add') { document.entities[change.entity_ref] = {entity_ref: change.entity_ref, revision: document.revision, title: change.title, subject: null, parameters: {}}; document.scenes.find(s => s.scene_ref === change.scene_ref).entity_refs.push(change.entity_ref) }
        if (change.change === 'subject_bind') document.entities[change.entity_ref].subject = change.binding
        if (change.change === 'parameter_set') document.entities[change.entity_ref].parameters[change.parameter] = {value: change.value, automation: null}
        if (change.change === 'relation_bind') document.relations[change.binding.binding_ref] = change.binding
      }
      held.set(r.expression_ref, document)
      return {result: 'expression', data: {document}}
    }
    assert.fail(r.operation)
  })
  const shown = []
  const opened = await reading.openJourneyReading(TRANSPORT, JOURNEY_PAGE, {show: ref => shown.push(ref)})
  assert.deepEqual(ops.map(op => op.op === 'expression' ? op.request.operation : op.op), ['nara_journey', 'inspect', 'open'])
  assert.equal(opened.opened, true)
  assert.deepEqual(shown, [opened.expression_ref])
  // Read back from the Expression owner: the scene it holds is the journey's.
  const document = held.get(opened.expression_ref)
  assert.equal(document.scenes[0].entity_refs.length, reading.composeJourneyExpression(JOURNEY, JOURNEY_PAGE).scenes[0].entity_refs.length)
  // A later draw: launching again adds only what is new, by the owner's own edit; nothing opens twice, nothing is removed.
  current = structuredClone(JOURNEY)
  const night = structuredClone(JOURNEY.spreads[0])
  night.spread_ref = 'journey:doc-probe/spread/1'
  night.kind = {kind: 'klein-night', day_spread_ref: JOURNEY.spreads[0].spread_ref}
  night.placements = night.placements.slice(0, 1).map(p => ({...p, placement_ref: 'journey:doc-probe/placement/6', position: 'P0\'', recognitions: []}))
  current.spreads.push(night)
  ops.length = 0
  const again = await reading.openJourneyReading(TRANSPORT, JOURNEY_PAGE, {show: ref => shown.push(ref)})
  assert.deepEqual(ops.map(op => op.op === 'expression' ? op.request.operation : op.op), ['nara_journey', 'inspect', 'edit'])
  assert.equal(again.opened, false)
  const edit = ops.at(-1).request
  assert.deepEqual(edit.changes.filter(c => c.change === 'entity_add').map(c => c.title), ['P0′ · ' + night.placements[0].card.name])
  assert.ok(held.get(opened.expression_ref).scenes[0].entity_refs.length === document.scenes[0].entity_refs.length + 1)
  assert.deepEqual(shown, [opened.expression_ref, opened.expression_ref])
  // Nothing new: no edit at all.
  ops.length = 0
  await reading.openJourneyReading(TRANSPORT, JOURNEY_PAGE, {show: noop})
  assert.deepEqual(ops.map(op => op.op === 'expression' ? op.request.operation : op.op), ['nara_journey', 'inspect'])
})

test('a journey\'s page launched as Reading opens its Expression, not its Flow; launched otherwise it opens its Deck as before', async () => {
  const opening = await import('../src/central/launchOpening.ts')
  const journeyIsland = launch => ({meta: {title: 'The move', journey: {schema: 'ql.nara-oracle-journey/v1'}, ...(launch ? {launch} : {})}})
  const asReading = opening.launchOpeningOf('flow', JOURNEY_PAGE, journeyIsland({opensAs: 'reading'}))
  assert.equal(asReading.open, null, 'the Flow stays where you write; the Expression opens')
  assert.match(asReading.words, /Expression/)
  const asFlow = opening.launchOpeningOf('flow', JOURNEY_PAGE, journeyIsland({opensAs: 'journal'}))
  assert.equal(asFlow.open.target.form, 'flow')
  // A Flow that is no journey's never opens as Reading, whatever its launch says; nor does a journey's page that holds no journey yet.
  assert.equal(opening.launchOpeningOf('flow', JOURNEY_PAGE, {meta: {launch: {opensAs: 'reading'}}}).open.target.form, 'flow')
  assert.equal(opening.launchOpeningOf('flow', JOURNEY_PAGE, {meta: {practice: 'journey', launch: {opensAs: 'reading'}}}).open.target.form, 'flow')

  const launch = await import('../src/inhabitants/ql/devices/practiceLaunch.ts')
  const asked = []
  const answer = launched => launch.answerLaunch({form: 'flow', location: JOURNEY_PAGE}, TRANSPORT, {
    read: async () => ({location: JOURNEY_PAGE, island: journeyIsland(launched), title: 'The move'}),
    reading: async location => { asked.push(['reading', location.ref]) },
    deck: async location => { asked.push(['deck', location.ref]) },
  })
  await answer({opensAs: 'reading'})
  await answer({opensAs: 'flow'})
  await answer(null)
  // A journey's page made from New… with no journey yet: nothing to lay out, so its Deck asks for its theme.
  await launch.answerLaunch({form: 'flow', location: JOURNEY_PAGE}, TRANSPORT, {
    read: async () => ({location: JOURNEY_PAGE, island: {meta: {practice: 'journey', launch: {opensAs: 'reading'}}}, title: null}),
    reading: async location => { asked.push(['reading', location.ref]) }, deck: async location => { asked.push(['deck', location.ref]) }})
  assert.deepEqual(asked, [['reading', JOURNEY_PAGE.ref], ['deck', JOURNEY_PAGE.ref], ['deck', JOURNEY_PAGE.ref], ['deck', JOURNEY_PAGE.ref]])
})

// ── Nara's answer quoted into your Day, as your press ───────────────────────────────────────────────────────────────────────────────

test('the receiving wire carries the producer a submission declares', async () => {
  const client = await import(`${cradle}receiving/client.ts`)
  const producer = {ref: 'agent-session/nara-1', actor_kind: 'agent', attribution: 'verified'}
  const wire = client.receivingWire({kind: 'submit', producer_key: 'p', source_ref: 's', document_id: 'd', expected_source_revision: 'r', occurred_at_unix_seconds: 1,
    proposal: {operation: 'field.append'}, declared_producer: producer})
  assert.deepEqual(wire.Submit.declared_producer, producer)
})

test('Nara\'s answer quoted into your Day names Nara\'s session as its producer, and its Return is read back from Central', async () => {
  const owner = await import(`${cradle}nara/nativeReturn.ts`)
  const SESSION = 'agent-session/nara-1', EXPRESSION = 'expression:room', IDENTITY_SOURCE = 'central:source:control:root:Control/self/nara/identities/you.json'
  const binding = {source_ref: IDENTITY_SOURCE, expected_revision: 'r1', person_ref: PERSON, nara_ref: 'nara:scratch-you', expression_ref: EXPRESSION, role: 'nara'}
  const dialogue = {key: 'k', role: 'nara', project: 'O-I', provisioning: {agent_session: SESSION, space: 's'}, binding}
  const input = {schema: 'oi.nara-dialogue-input/v1', role: 'nara', question: 'Why does the morning feel so wide?', selected: {},
    context: {subject_ref: PERSON, nara_ref: 'nara:scratch-you', agent_session_ref: SESSION, disclosed: [{ref_id: IDENTITY_SOURCE, revision: 'r1', disclosure: 'personal-consent'}],
      profile_ref: IDENTITY_SOURCE, profile_revision: 'r1', expression_ref: EXPRESSION, expression_revision: '3'},
    identity: {source: {source_ref: IDENTITY_SOURCE, revision: 'r1'}, input_revision: 'sha256:36fd46'}, expression: {ref: EXPRESSION, revision: 3}}
  const view = {schema: 'aikit.encounter-view/v1', agent_session: SESSION, connection: {state: 'Resident', error: null}, more: false,
    blocks: [{id: 1, kind: 'user', text: JSON.stringify(input)}, {id: 2, kind: 'assistant', text: 'Wide, because you wrote of the river.'}, {id: 3, kind: 'completed', text: ''}]}
  const target = {day: {day_ref: 'central:day:control:root:2026-10-28'}, document: {source: {ref: 'central:source:control:root:Control/user/day/2026-10-28/day.md'}, document_id: 'day:probe',
    revision: {revision: 'rev-day'}, document: {kind: 'day', lifecycle: 'open'}}, fields: [{id: 'p0_quick_thoughts', label: 'Quick thoughts'}]}
  let submitted = null
  const ops = kernel(op => {
    if (op.op === 'encounter') return {result: 'encounter_reading', data: view}
    assert.equal(op.op, 'receiving')
    if (op.request.List) return {result: 'receiving_reading', data: {schema: 'central.receiving-page/v1', returns: submitted ? [{return_ref: 'return:1', source_ref: target.document.source.ref, document_id: 'day:probe'}] : [], more: false}}
    if (op.request.Submit) {
      submitted = op.request.Submit
      return {result: 'receiving_reading', data: {schema: 'central.receiving-reading/v1', return_ref: 'return:1', revision: 'rr1', included: false, source_changed_by_arrival_or_review: false,
        record: {return_ref: 'return:1', status: 'pending', source_ref: submitted.source_ref, document_id: submitted.document_id, author: {principal_ref: 'human:probe', actor_kind: 'human'},
          declared_producer: submitted.declared_producer, proposal: submitted.proposal}}}
    }
    if (op.request.Read) return {result: 'receiving_reading', data: {schema: 'central.receiving-reading/v1', return_ref: 'return:1', revision: 'rr1', included: false, source_changed_by_arrival_or_review: false,
      record: {return_ref: 'return:1', status: 'pending', source_ref: submitted.source_ref, document_id: submitted.document_id, author: {principal_ref: 'human:probe', actor_kind: 'human'},
        declared_producer: submitted.declared_producer, proposal: submitted.proposal}}}
    assert.fail(JSON.stringify(op.request))
  })
  const answer = await owner.readNativeAnswer(TRANSPORT, dialogue, 2)
  const proposed = await owner.proposeAnswerForDay(TRANSPORT, target, 'p0_quick_thoughts', answer)
  assert.deepEqual(submitted.declared_producer, {ref: SESSION, actor_kind: 'agent', attribution: 'verified'}, 'Nara\'s session is named as the producer the person carries')
  assert.equal(proposed.record.declared_producer.ref, SESSION)
  assert.equal(proposed.record.status, 'pending')
  // Asked again, the Return is read back from Central by its producer key's contribution: nothing is submitted twice.
  const before = ops.filter(op => op.request?.Submit).length
  const again = await owner.proposeAnswerForDay(TRANSPORT, target, 'p0_quick_thoughts', answer)
  assert.equal(ops.filter(op => op.request?.Submit).length, before)
  assert.equal(again.return_ref, 'return:1')
})
