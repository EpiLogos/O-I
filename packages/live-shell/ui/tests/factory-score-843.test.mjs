// O-I #843 (lane BC, Factory's Clip view: the song's score, the task's log and Vāk). A Factory task's Notes draws the score of the song its
// Run performs, as Factory reads it (`factory workflow score`, factory.workflow-score/v1, through the kernel's factory_owner
// `workflow-score-read`): its units with their compositions, who does each, its joins and its waves, this task's own note lit, its rows the
// track's Agent rack (the group's agents and its agent set) and then the agents and agent sets the song names that the rack does not hold.
// Allocate, Connect and Thread form write the song's file through Factory (`factory workflow edit`, factory.workflow-edit/v1, factory_owner
// `workflow-edit`), compare-and-swap on the byte revision Factory read, and a refusal is Factory's words. Fill heads asks AIKit's decision
// model for the selected unit's open heads among the labels QL's Vāk-block instrument holds (`aikit decide invoke --instrument vak-block`,
// aikit_write `decide-fill`); its picks stand dashed until Accept writes them through Factory, or Discard drops them. Sample draws the
// task's log from the session's events, the retrospective readings where they were found; nothing the tools do changes the log.
// Channels: the Factory readings and refusals are REAL — Factory's CLI built from dlw/843-score, walked headless on a scratch project
// (tests/fixtures/factory-workflow-score-2026-11-03.json, its scratch path written /walk); the installed Factory's refusal of an unknown
// verb is REAL (what `factory workflow score` answers on a Factory that predates it). DERIVED — an uncomposed unit, the real reading with
// one composition removed. SCRIPTED — the kernel calls and the owners' writes are recording ports, and AIKit's fill reading is shaped as
// ai-kit decide_instrument.rs writes it (its own test, crates/aikit-cli/tests/decide_instrument_fill.rs, pins it against a recording
// endpoint), never a decision model's answer. FIXTURE — the session tracks, owner-shaped. Not a screen pass: the native window with a
// real song is UNVERIFIED (the lead's walk).
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage ??= {getItem: () => null, setItem: noop}

const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const score = await import('../src/agent/scoreBinding.ts')
const clip = await import('../src/agent/clipBinding.ts')
const {loadClip} = await import('../src/inhabitants/catalogue/clips/index.ts')
const {resetViewHolds, wiredKey, setViewHold, clipHostId, viewHoldsOf} = await import('../src/frame/detail/clipBinding.ts')
const {trackKey} = await import('../src/agent/agentRunModel.ts')
const {writesOwner} = await import('../../../../desktop/cradle/src/kernel/bridge.ts')

const REAL = JSON.parse(await readFile(new URL('./fixtures/factory-workflow-score-2026-11-03.json', import.meta.url), 'utf8'))
const STATE = '/walk/song/.factory/development-state.json'
const RUN = REAL.score.runRef
const unitOf = (reading, key) => reading.units.find(unit => unit.key === key)
const TARGET = {statePath: STATE, runRef: RUN, unitRef: unitOf(REAL.score, 'eros-verify').unitRef}
const read = reading => ({state: 'read', reading, target: TARGET})

// The track's rack: the Anima space's group track (its SessionSpace names the Central agent set it runs) and two of its sessions.
const group = {sessionRef: 'space:anima', purpose: 'Anima', agentRef: null, agentName: null, agentAccepted: null, spaceRef: 'space:anima', spaceLabel: 'Anima',
  depth: 0, parentRef: null, group: true, memberRefs: ['ses-eros', 'ses-mythos'], tasks: [], needle: null, telemetryOn: true, budget: {used: null, max: null},
  disclosure: null, agentSet: {ref: 'agent-set/anima', revision: 'r1'}}
const member = (sessionRef, agentRef, agentName, tasks = []) => ({sessionRef, purpose: null, agentRef, agentName, agentAccepted: true, spaceRef: 'space:anima',
  spaceLabel: 'Anima', depth: 1, parentRef: 'space:anima', group: false, memberRefs: [], tasks, needle: null, telemetryOn: true, budget: {used: 2, max: 12}, disclosure: null})
const eros = member('ses-eros', 'agent/anima-eros', 'Eros', [{n: 1, title: 'verify the change', state: 'done', startUnixMs: 1_000, lastActivityUnixMs: 61_000, softStop: false, disclosure: null}])
const TRACKS = [group, eros, member('ses-mythos', 'agent/anima-mythos', 'Mythos')]
const REF = `${trackKey(eros)}#task/1`
const HOLD = clipHostId('factory', REF)

/** A recording score port over a reading: Factory's edits and AIKit's fills as they would be asked. */
function port(reading, over = {}) {
  const asked = {edits: [], fills: [], drops: 0}
  return {asked, port: {reading, rack: score.rackRowsOf(eros, TRACKS), picks: null, edit: async request => { asked.edits.push(request) },
    fill: async (unit, request) => { asked.fills.push({unit, request}) }, drop: () => { asked.drops++ }, ...over}}
}
const bindingOf = (scorePort, extra = {}) => clip.factoryClipBinding({ref: REF, tracks: TRACKS, events: [], score: scorePort, ...extra})

test('the score is Factory\'s reading of the song its Run performs, asked as a read, and a refusal stays in Factory\'s words', async () => {
  const asked = []
  const answer = await score.readScore(async op => { asked.push(op); return {outcome: {result: 'factory_development_reading', data: REAL.score}} }, TARGET)
  assert.deepEqual(asked, [{op: 'factory_owner', request: {kind: 'workflow-score-read', state_path: STATE, run_ref: RUN}}])
  assert.equal(writesOwner(asked[0]), false, 'its kind ends in read: the bridge hears a read, and retires no held answer')
  assert.equal(answer.state, 'read')
  const edit = score.scoreEditOp(TARGET, {contract: 'factory.workflow-edit/v1', expectedRevision: 'blake3:1', edits: []})
  assert.deepEqual(edit, {op: 'factory_owner', request: {kind: 'workflow-edit', state_path: STATE, run_ref: RUN, request: {contract: 'factory.workflow-edit/v1', expectedRevision: 'blake3:1', edits: []}}})
  assert.equal(writesOwner(edit), true, 'an edit of the song is a write')
  // What a Factory that predates the score answers (REAL: the installed Factory, asked `factory workflow score`).
  const refused = await score.readScore(async () => ({error: JSON.stringify({kind: 'owner-refused-or-failed',
    message: 'workflow.operation: Unknown workflow operation score; use factory workflow help', operation_may_have_run: false})}), TARGET)
  assert.equal(refused.state, 'absent')
  assert.match(refused.why, /^Factory did not read the song's score: workflow\.operation: Unknown workflow operation score/)
  const other = await score.readScore(async () => ({outcome: {result: 'factory_development_reading', data: {contract: 'factory.wave-reading/v1'}}}), TARGET)
  assert.match(other.why, /factory\.workflow-score\/v1/)
})

test('the rows are the track\'s Agent rack — its agents and its agent set — then the agents and agent sets the song names that the rack does not hold', () => {
  const rack = score.rackRowsOf(eros, TRACKS)
  assert.deepEqual(rack, [{id: 'agent/anima-eros', name: 'Eros', kind: 'agent'}, {id: 'agent/anima-mythos', name: 'Mythos', kind: 'agent'},
    {id: 'agent-set/anima', name: 'Anima', kind: 'set'}])
  const lone = {...member('ses-lone', 'agent/aletheia', 'Aletheia'), parentRef: null}
  assert.deepEqual(score.rackRowsOf(lone, [lone]), [{id: 'agent/aletheia', name: 'Aletheia', kind: 'agent'}], 'a lone session\'s rack is its own agent')
  const values = score.scoreValuesOf(read(REAL.score), rack, null)
  const drawn = JSON.parse(values.score)
  assert.equal(drawn.name, 'development-and-knowledge')
  assert.deepEqual(drawn.rows.slice(0, 3).map(row => [row.id, row.kind, row.rack]), [['agent/anima-eros', 'agent', true], ['agent/anima-mythos', 'agent', true],
    ['agent-set/anima', 'set', true]])
  assert.deepEqual(drawn.rows.filter(row => row.rack === false).map(row => [row.id, row.kind]), [['agent/anima-logos', 'agent'], ['agent/anima-techne-helper', 'agent'],
    ['agent/anima-sophia', 'agent'], ['agent/aletheia', 'agent'], ['agent-set/aletheia', 'set']], 'the song\'s other requirements, in Factory\'s order, marked off the rack')
  assert.equal(values['unit.own'], 'eros-verify', 'this task\'s own note: the unit its attempt names')
  const verify = drawn.units.find(unit => unit.key === 'eros-verify'), own = unitOf(REAL.score, 'eros-verify')
  assert.equal(verify.row, 'agent/anima-eros')
  assert.deepEqual(verify.deps, ['techne-implement'])
  assert.deepEqual(verify.heads, own.heads, 'the composition\'s seven heads, in Factory\'s words')
  for (const key of ['concern', 'returns', 'sources', 'success', 'may', 'stop', 'escalate']) assert.deepEqual(verify[key], own[key], key)
  assert.deepEqual(drawn.joins, [])
  assert.deepEqual(drawn.waves, [])
  const check = JSON.parse(values['score.check'])
  assert.equal(check.state, 'admitted')
  assert.match(check.why, /factory workflow check admits the song's file/)
  // REPLACED (O-I 795 round 14): "QL's word on each unit names the operation it waits for" (`ql vak compose`, which takes no unit's
  // composition). QL checks each unit's seven heads as a Vāk-block cell (`ql context-frame team-space check`); unasked, it says so.
  assert.match(check.why, /QL's word on each unit is not read here[\s\S]*ql context-frame team-space check vak-block/)
  // Once the file is edited the Run still performs the edition it was commissioned with, and Factory marks the unit the file changed.
  const after = score.scoreValuesOf(read(REAL.score_allocated), rack, null)
  assert.match(JSON.parse(after['score.check']).why, /performs the edition it was commissioned with/)
  assert.equal(JSON.parse(after.score).units.find(unit => unit.key === 'eros-verify').row, 'agent/anima-mythos')
  // Nothing read: the keys stand absent with why, and every score write refused in the same words.
  const wiring = clip.factoryWiring({sessionRef: 'ses-eros', n: 1}, null, null, null, null)
  for (const key of ['score', 'unit.own', 'score.check']) assert.equal(wiring.absent[key], score.SCORE_NOT_HERE, key)
  for (const key of ['score', 'tr.press', 'gen.press', 'gen.accept', 'gen.discard']) assert.equal(wiring.refused[key], score.SCORE_NOT_HERE, key)
})

test('a note moved to another row, and Allocate, give the unit to that agent or agent set through Factory, or are refused in Factory\'s words', async () => {
  resetViewHolds()
  const {asked, port: held} = port(read(REAL.score))
  const binding = bindingOf(held)
  const drawn = JSON.parse(binding.values.score)
  const rowed = row => JSON.stringify({...drawn, units: drawn.units.map(unit => (unit.key === 'eros-verify' ? {...unit, row} : unit))})
  await binding.write([{key: 'score', value: rowed('agent/anima-mythos')}])
  assert.deepEqual(asked.edits.pop(), {contract: 'factory.workflow-edit/v1', expectedRevision: REAL.score.song.file.byteRevision,
    edits: [{op: 'allocate', units: ['eros-verify'], to: {kind: 'agent', ref: 'agent/anima-mythos'}}]}, 'compare-and-swap on the byte revision Factory read')
  // Factory's own receipt of that very edit (REAL): the row's agents and the composition's actor, nothing else.
  assert.deepEqual(REAL.allocate.changed, ['/units/2/agentRequirements/agentRefs', '/units/2/composition/actor'])
  await binding.write([{key: 'score', value: rowed('agent-set/anima')}])
  assert.deepEqual(asked.edits.pop().edits, [{op: 'allocate', units: ['eros-verify'], to: {kind: 'agent-set', ref: 'agent-set/anima'}}])
  // Allocate, with its row chosen in the view: the selected note, else this task's own.
  setViewHold(HOLD, 'tr.tool', 'allocate')
  await assert.rejects(binding.write([{key: 'tr.press', value: 1}]), /Choose the agent or agent set/)
  setViewHold(HOLD, 'tr.to', 'agent/anima-mythos')
  await binding.write([{key: 'tr.press', value: 1}])
  assert.deepEqual(asked.edits.pop().edits, [{op: 'allocate', units: ['eros-verify'], to: {kind: 'agent', ref: 'agent/anima-mythos'}}])
  setViewHold(HOLD, 'unit', 'mythos-debug')
  await binding.write([{key: 'tr.press', value: 1}])
  assert.deepEqual(asked.edits.pop().edits[0].units, ['mythos-debug'])
  // Factory refuses (REAL): the refusal is the press's error, in its words, and the file stands.
  for (const refusal of [REAL.shared, REAL.stale]) {
    const refusing = bindingOf(port(read(REAL.score), {edit: async () => { throw new Error(refusal.error.message) }}).port)
    await assert.rejects(refusing.write([{key: 'tr.press', value: 1}]), new RegExp(refusal.error.message.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  // Only a note's row moves on the score: any other change of it is no allocation.
  await assert.rejects(binding.write([{key: 'score', value: JSON.stringify({...drawn, units: drawn.units.map(unit => (unit.key === 'eros-verify' ? {...unit, deps: []} : unit))})}]), /row/)
  // A song the Run performs from another root reads its retained edition, and takes no edit.
  const retained = {...REAL.score, song: {...REAL.score.song, edition: 'retained', file: null, why: 'The song this Run performs does not stand under its project root.'}}
  await assert.rejects(bindingOf(port(read(retained)).port).write([{key: 'tr.press', value: 1}]), /does not stand under its project root/)
})

test('Connect makes the unit wait on another and Thread form sets its form, through Factory; the join is the agent set\'s, and a song branches only by allocation', async () => {
  resetViewHolds()
  const {asked, port: held} = port(read(REAL.score))
  const binding = bindingOf(held)
  setViewHold(HOLD, 'tr.tool', 'connect')
  setViewHold(HOLD, 'tr.on', 'logos-scope-plan')
  await binding.write([{key: 'tr.press', value: 1}])
  assert.deepEqual(asked.edits.pop().edits, [{op: 'connect', unit: 'eros-verify', waitsOn: 'logos-scope-plan'}])
  // Factory refuses a tie that closes a loop (REAL), in its words.
  const cycling = bindingOf(port(read(REAL.score), {edit: async () => { throw new Error(REAL.cycle.error.message) }}).port)
  await assert.rejects(cycling.write([{key: 'tr.press', value: 1}]), /DependencyCycle/)
  setViewHold(HOLD, 'tr.tool', 'form')
  setViewHold(HOLD, 'tr.form', 'CFP3')
  await binding.write([{key: 'tr.press', value: 1}])
  assert.deepEqual(asked.edits.pop().edits, [{op: 'heads', unit: 'eros-verify', heads: {CFP: 'CFP3'}}])
  // The join is where a stacked step's returns meet: the Central agent set's, set on the Agent rack; the song holds none to write.
  assert.match(binding.standing['tr.join'].disabled, /agent set's join/)
  await assert.rejects(binding.write([{key: 'tr.join', value: 'first'}]), /Agent rack/)
  // No tool branches a song on a condition.
  setViewHold(HOLD, 'tr.tool', 'condition')
  await assert.rejects(binding.write([{key: 'tr.press', value: 1}]), /branches only by allocation/)
  assert.equal(asked.edits.length, 0)
})

// AIKit's fill reading, shaped as ai-kit decide_instrument.rs writes it (SCRIPTED: no decision model answered it).
const FILL = {schema: 'aikit.instrument-fill/v1', instrument: {id: 'vak-block', organ: 'S4′ Anima', kind: 'vak-block', source: 'ql:skill:vak-evaluate'},
  team_space: 'ql.vak-team-space/v2', subject: {key: 'eros-verify'}, chosen: {}, open: ['vak-cpf', 'vak-ct', 'vak-cp', 'vak-cf', 'vak-cfp', 'vak-cs', 'vak-direction'],
  rules: [], standing: 'evidence', engine: 'QL admits or refuses the block (`ql vak compose`); the owner of the composition checks it when it is accepted.',
  invocation_ref: 'invocation:01', calls: 1, outcome: 'completed', answered_by: 'kev-latest',
  picks: {'vak-cs': {field: 'sequence', label: 'CS3', confidence: 0.7}, 'vak-direction': {field: 'direction', label: 'returning-inquiry', confidence: 0.6},
    'vak-cfp': {field: 'thread-form', label: null, why: 'The decision model gave this head no choice: it stays open.'}}}

test('Vāk draws the selected unit\'s heads, the open ones dashed; Fill heads asks AIKit for the open heads only, and Accept writes the picks through Factory', async () => {
  resetViewHolds()
  setViewHold(HOLD, 'gen.tool', 'heads')
  // A composed unit has no open head: nothing is asked (zero heads, zero calls).
  const composed = port(read(REAL.score))
  await assert.rejects(bindingOf(composed.port).write([{key: 'gen.press', value: 1}]), /nothing is open/)
  assert.equal(composed.asked.fills.length, 0)
  // An uncomposed unit (DERIVED): all seven heads open, asked of AIKit with the unit's own words and no chosen head.
  const bare = structuredClone(REAL.score)
  Object.assign(unitOf(bare, 'eros-verify'), {heads: null, composition: null})
  const asking = port(read(bare))
  await bindingOf(asking.port).write([{key: 'gen.press', value: 1}])
  const own = unitOf(REAL.score, 'eros-verify')
  assert.deepEqual(asking.asked.fills, [{unit: 'eros-verify', request: {schema: 'aikit.instrument-fill-request/v1',
    subject: {key: 'eros-verify', unitRef: own.unitRef, row: 'agent/anima-eros', concern: own.concern, requiredDifference: own.requiredDifference, returns: own.returns,
      success: own.success, sources: own.sources}, chosen: {}}}])
  assert.deepEqual(score.fillOp(asking.asked.fills[0].request, 'ses-eros'), {op: 'aikit_write', request: {kind: 'decide-fill', instrument: 'vak-block',
    request: asking.asked.fills[0].request, agent_session: 'ses-eros'}})
  assert.equal(writesOwner(score.fillOp({}, null)), true, 'the ask is kept against the session: a write')
  // Only AIKit's fill reading is held; a failed fill is AIKit's words.
  assert.equal(score.fillReadingOf(FILL), FILL)
  assert.throws(() => score.fillReadingOf({...FILL, outcome: 'failed', why: 'The decision provider returned no answer'}), /returned no answer/)
  assert.throws(() => score.fillReadingOf({schema: 'other'}), /aikit\.instrument-fill\/v1/)
  // The picks stand on the unit, dashed in Vāk, until Accept or Discard; a head the model left open stays open.
  const picked = port(read(bare), {picks: {unit: 'eros-verify', reading: FILL}})
  const binding = bindingOf(picked.port)
  const drawn = JSON.parse(binding.values.score).units.find(unit => unit.key === 'eros-verify')
  assert.deepEqual(drawn.picks, {CS: 'CS3', direction: 'returning-inquiry'})
  const design = await loadClip('factory')
  setViewHold(HOLD, 'unit', 'eros-verify')
  const vak = design.editor.find(tab => tab.id === 'vak')
  const markup = renderToStaticMarkup(createElement(vak.draw, {v: bindingOf(picked.port).values, set: noop, standing: binding.standing, size: 'detail', room: {w: 900, h: 360}}))
  assert.ok(markup.includes('CS3'), 'the pick is drawn at its note')
  assert.match(markup, /the decision model&#x27;s pick, dashed until you accept it/)
  assert.ok(markup.includes('strokeDasharray') || markup.includes('stroke-dasharray'), 'open and picked heads are dashed')
  // Accept writes the picks into the composition through Factory, which refuses a unit with none (its words), or Discard drops them.
  await binding.write([{key: 'gen.accept', value: 1}])
  assert.deepEqual(picked.asked.edits.pop().edits, [{op: 'heads', unit: 'eros-verify', heads: {CS: 'CS3', direction: 'returning-inquiry'}}])
  assert.equal(picked.asked.drops, 1, 'accepted picks are no longer held')
  await binding.write([{key: 'gen.discard', value: 1}])
  assert.equal(picked.asked.drops, 2)
  await assert.rejects(bindingOf(port(read(bare)).port).write([{key: 'gen.discard', value: 1}]), /Nothing proposed waits/)
  // Factory's refusal of QL's own spelling of a head it does not lower (REAL: the thread form Z) is the Accept's error.
  const spelling = bindingOf(port(read(bare), {picks: {unit: 'eros-verify', reading: FILL}, edit: async () => { throw new Error(REAL.ql_spelling.error.message) }}).port)
  await assert.rejects(spelling.write([{key: 'gen.accept', value: 1}]), /InvalidCPrimeProfile/)
  // Compose asks the session's team (round 15): a port with no team read for the task refuses it in words, before and at the press.
  // REPLACED (O-I 844 round 15): "Compose is Anima's act as an agent: it stands refused, naming that no operation composes a song".
  setViewHold(HOLD, 'gen.tool', 'compose')
  await assert.rejects(binding.write([{key: 'gen.press', value: 1}]), /no team is read for this task here/)
  assert.equal(binding.standing['gen.asks']?.disabled, score.COMPOSE_NOT_HERE)
  // The engine's word on a proposal: QL's check of the unit with its picks, unasked here.
  // REPLACED (O-I 795 round 14): "QL's per-unit word waits for its operation" (`ql vak compose`).
  assert.match(binding.standing['gen.status']?.disabled ?? clip.factoryWiring({sessionRef: 'ses-eros', n: 1}, null, null, null, picked.port).absent['gen.status'], /ql context-frame team-space check vak-block/)
})

// O-I 795 round 14: QL's word on each unit (§19.1 "the engine refusing one unit"; #843 "Vāk draws the selected unit's heads from" QL's
// engine): a unit's seven heads are a cell of QL's Vāk-block instrument, and QL's engine checks every cell of the score in one ask (ql
// team_space.rs check_cells: each chosen label held to its head and the instrument's constraints, the open heads named; `ql context-frame
// team-space check vak-block -`, through the kernel's ql_read instrument-check). A proposal's picks are checked with the unit's heads as
// their own cell, which is the engine's word on the proposal. SCRIPTED: QL's answers are in the REAL check's shape (its own test,
// crates/ql-cli/src/lib.rs a_cell_of_an_instrument_is_checked_by_the_engine_with_its_open_heads_named, pins it on the built space).
test('QL\'s word on each unit: its seven heads checked as a Vāk-block cell by QL\'s engine; one refused refuses the score, and a proposal is checked with its picks', async () => {
  const reading = read(REAL.score)
  const rack = score.rackRowsOf(eros, TRACKS)
  const cells = score.vakCellsOf(reading, null)
  const own = unitOf(REAL.score, 'eros-verify')
  assert.equal(cells.length, REAL.score.units.length, 'one cell for each unit')
  assert.deepEqual(cells.find(cell => cell.key === 'eros-verify').chosen, Object.fromEntries([['CPF', 'vak-cpf'], ['CT', 'vak-ct'], ['CP', 'vak-cp'],
    ['CF', 'vak-cf'], ['CFP', 'vak-cfp'], ['CS', 'vak-cs'], ['direction', 'vak-direction']].filter(([head]) => own.heads[head]).map(([head, vak]) => [vak, [own.heads[head]]])),
  'Factory\'s heads under QL\'s head ids')
  const asked = []
  const answering = data => async op => { asked.push(op); return {outcome: {result: 'owner_route_reading', route: 'ql context-frame team-space check', data}} }
  const admitted = {schema: 'ql.instrument-cell-check/v1', instrument: 'vak-block', cells: cells.map(cell => ({key: cell.key, state: 'admitted', heads: [], open: [],
    why: 'every head holds a label it allows, and no constraint is broken'}))}
  const word = await score.readQlWord(answering(admitted), cells)
  assert.deepEqual(asked, [{op: 'ql_read', request: {kind: 'instrument-check', instrument: 'vak-block', request: {schema: 'ql.instrument-cells/v1', cells}}}])
  const check = JSON.parse(score.scoreValuesOf(reading, rack, null, word)['score.check'])
  assert.equal(check.state, 'admitted')
  assert.match(check.why, /factory workflow check admits the song's file · QL admits every unit's composition/)
  // One unit refused: the score is refused, in QL's words.
  const refusing = {...admitted, cells: admitted.cells.map(cell => cell.key === 'eros-verify'
    ? {...cell, state: 'refused', why: 'label `CF8` is not legal for `vak-cf` (context-frame)'} : cell)}
  const refused = JSON.parse(score.scoreValuesOf(reading, rack, null, await score.readQlWord(answering(refusing), cells))['score.check'])
  assert.equal(refused.state, 'refused')
  assert.match(refused.why, /QL refuses eros-verify: label `CF8` is not legal for `vak-cf`/)
  // QL not reached, or an older QL: its words stand where its check would.
  const absent = await score.readQlWord(async () => ({error: 'unknown Context-Frame operation `check`'}), cells)
  assert.equal(absent.state, 'absent')
  assert.match(JSON.parse(score.scoreValuesOf(reading, rack, null, absent)['score.check']).why, /QL's word on each unit is not read: QL did not check[\s\S]*unknown Context-Frame operation/)
  assert.match((await score.readQlWord(answering({schema: 'ql.vak-team-space/v2'}), cells)).why, /ql\.instrument-cell-check\/v1/)
  // The proposal: the unit's heads with the decision model's picks, a cell of its own; QL's word on it is the engine's word on the proposal.
  const bare = structuredClone(REAL.score)
  Object.assign(unitOf(bare, 'eros-verify'), {heads: null, composition: null})
  const held = {unit: 'eros-verify', reading: FILL}
  const proposing = score.vakCellsOf(read(bare), held)
  assert.deepEqual(proposing.find(cell => cell.key === 'eros-verify#proposed').chosen, {'vak-cs': ['CS3'], 'vak-direction': ['returning-inquiry']})
  const proposed = await score.readQlWord(answering({...admitted, cells: [...admitted.cells, {key: 'eros-verify#proposed', state: 'admitted', heads: [],
    open: ['vak-cpf'], why: 'every chosen label is one its head holds, and no constraint is broken; open: participation'}]}), proposing)
  const values = score.scoreValuesOf(read(bare), rack, held, proposed)
  assert.deepEqual(JSON.parse(values['gen.status']), {state: 'admitted', why: 'eros-verify: every chosen label is one its head holds, and no constraint is broken; open: participation'})
  const wiring = score.scoreWiring({...port(read(bare)).port, picks: held, word: proposed}, () => undefined)
  assert.equal(wiring.absent['gen.status'], undefined, 'read')
  assert.match(score.scoreWiring({...port(read(bare)).port, word: proposed}, () => undefined).absent['gen.status'], /Nothing proposed waits/)
  assert.match(score.scoreWiring({...port(read(bare)).port, picks: held, word: absent}, () => undefined).absent['gen.status'], /QL did not check/)
  // On the clip: the port carries QL's word.
  const binding = bindingOf({...port(read(REAL.score)).port, word: await score.readQlWord(answering(refusing), cells)})
  assert.equal(JSON.parse(binding.values['score.check']).state, 'refused')
})

// Round 22 (DLW build ruling 2026-11-05, "Direction labels. QL law wins"): QL's law spells a unit's direction forward-synthesis or
// returning-inquiry (the Vāk block's `vak-direction`, ql-mef vak_profile.rs InquiryDirection), and every carrier writes it so. O-I passes
// Factory's heads to QL verbatim (vakCellsOf), so each label it passes must be one QL's Vāk block holds. REAL: the Vāk-block instrument
// (`ql context-frame team-space --json`, the installed QL a2aa0a7 and the env-2 seat's build at 7bb2535 answering byte-identically,
// 5 Nov 2026) and Factory's score (its _source). Red on the score Factory wrote before round 22, whose directions were `forward` and
// `returning`: QL's check refused those cells.
test('every label O-I passes QL verbatim is a label of QL\'s Vāk block: a unit\'s direction is forward-synthesis or returning-inquiry', () => {
  const held = new Map(REAL.vak_block.heads.map(head => [head.id, head.labels.map(label => label.id)]))
  assert.deepEqual(held.get('vak-direction'), ['forward-synthesis', 'returning-inquiry'], 'QL\'s law spells the two directions')
  const cells = score.vakCellsOf(read(REAL.score), null)
  assert.equal(cells.length, REAL.score.units.length)
  for (const cell of cells) for (const [head, labels] of Object.entries(cell.chosen)) for (const label of labels) {
    assert.ok(held.get(head)?.includes(label), `${cell.key}: ${head} \`${label}\` is no label of QL's Vāk block (${(held.get(head) ?? []).join(', ')})`)
  }
  assert.deepEqual(new Set(cells.flatMap(cell => cell.chosen['vak-direction'] ?? [])), new Set(['forward-synthesis', 'returning-inquiry']))
})

// Round 22 (DLW build ruling 2026-11-05: "the Clip's Vāk tab reads vak-unit-steps"): Vāk reads QL's breakdown of the selected unit's
// heads (`ql vak unit-steps -`, ql.vak-unit-steps/v1, the kernel's ql_read `vak-unit-steps`): what each chosen label means in the Vāk
// block, the labels an open head may take, the composition steps the heads fix and the walk they give, and what a composition takes that
// a unit does not carry. REAL: QL's breakdown of eros-verify's heads and its refusal of an unknown frame (`ql vak unit-steps <unit>
// --json`, built from the env-2 seat at 7bb2535 with the round-22 patch, 5 Nov 2026). SCRIPTED: the kernel port. DERIVED: a unit with
// six heads removed.
test('Vāk reads QL\'s breakdown of the selected unit\'s heads: each label\'s meaning, an open head\'s labels and the steps they compose, or QL\'s refusal', async () => {
  resetViewHolds()
  const reading = read(REAL.score)
  const rack = score.rackRowsOf(eros, TRACKS)
  assert.equal(score.stepsUnitOf(reading, null), 'eros-verify', 'with no note held, this task\'s own unit')
  assert.equal(score.stepsUnitOf(reading, 'mythos-debug'), 'mythos-debug', 'the note the view holds')
  assert.equal(score.stepsUnitOf(reading, 'no-such-unit'), 'eros-verify', 'a note the song does not hold is not asked about')
  const request = score.unitStepsRequestOf(reading, 'eros-verify')
  assert.deepEqual(request, {contract: 'ql.vak-unit-steps/v1', unit: 'eros-verify', heads: unitOf(REAL.score, 'eros-verify').heads}, 'Factory\'s heads, verbatim')
  assert.deepEqual(request.heads, REAL.unit_steps.heads.map(head => [head.head, head.label]).reduce((all, [head, label]) => ({...all, [head]: label}), {}),
    'the heads QL broke down are the score\'s')
  const bare = structuredClone(REAL.score)
  unitOf(bare, 'eros-verify').heads = {CFP: 'CFP2'}
  assert.deepEqual(score.unitStepsRequestOf(read(bare), 'eros-verify').heads, {CFP: 'CFP2'}, 'an open head is absent')
  assert.equal(score.unitStepsRequestOf(reading, 'no-such-unit'), null)
  const asked = []
  const answering = data => async op => { asked.push(op); return {outcome: {result: 'owner_route_reading', route: 'ql vak unit-steps', data}} }
  const steps = await score.readUnitSteps(answering(REAL.unit_steps), request)
  assert.deepEqual(asked, [{op: 'ql_read', request: {kind: 'vak-unit-steps', request}}])
  assert.equal(writesOwner(asked[0]), false, 'a read')
  const drawn = JSON.parse(score.scoreValuesOf(reading, rack, null, null, null, steps)['vak.steps'])
  assert.equal(drawn.unit, 'eros-verify')
  assert.deepEqual(drawn.heads.find(head => head.head === 'direction'),
    {head: 'direction', state: 'chosen', label: 'returning-inquiry', meaning: 'Retrospective: the pass back through the pairs'})
  assert.deepEqual(drawn.compose.map(step => step.step), ['cfp-form chain', 'cs-select ground-through-operation returning-inquiry'])
  assert.deepEqual(drawn.compose.map(step => step.hops), [0, 3])
  assert.deepEqual(drawn.walk, ['4.5', '4.4', '4.3'])
  assert.deepEqual(drawn.needs, ['context', 'oikonomia', 'basis'])
  // QL's refusal stands in its words; an older QL answers no breakdown.
  const refused = await score.readUnitSteps(async () => ({error: REAL.unit_steps_refused}), {...request, heads: {...request.heads, CF: 'CF8'}})
  assert.equal(refused.state, 'absent')
  assert.match(refused.why, /^QL did not break down eros-verify's heads: .*CF `CF8`: unknown context frame CF8/)
  assert.match((await score.readUnitSteps(answering({contract: 'ql.vak-composition/v1'}), request)).why, /may predate `ql vak unit-steps`/)
  assert.deepEqual(JSON.parse(score.scoreValuesOf(reading, rack, null, null, null, refused)['vak.steps']), {unit: 'eros-verify', state: 'absent', why: refused.why})
  // The wiring: read where the port carries it, and said absent where nothing asks QL.
  assert.match(score.scoreWiring({...port(reading).port, steps}, () => undefined).reads['vak.steps'], /ql vak unit-steps/)
  assert.equal(score.scoreWiring(port(reading).port, () => undefined).absent['vak.steps'], score.STEPS_UNASKED)
  assert.equal(score.scoreWiring(null, () => undefined).absent['vak.steps'], score.SCORE_NOT_HERE)
  // On the clip: Vāk draws QL's meaning of each head and the steps under the lanes; a refusal stands there in QL's words.
  setViewHold(HOLD, 'unit', 'eros-verify')
  const design = await loadClip('factory')
  const vak = design.editor.find(tab => tab.id === 'vak')
  const draw = scorePort => { const binding = bindingOf(scorePort)
    return renderToStaticMarkup(createElement(vak.draw, {v: binding.values, set: noop, standing: binding.standing, size: 'detail', room: {w: 900, h: 360}})) }
  const markup = draw({...port(reading).port, steps})
  for (const words of ['QL composes', 'CFP: cfp-form chain (ql.cprime-oikonomia/v1:cfp2:chained-c-thread)', '4.5 → 4.4 → 4.3', 'context, oikonomia, basis',
    'QL: Retrospective: the pass back through the pairs', 'QL: dialogue with the person']) assert.ok(markup.includes(words), words)
  assert.match(draw({...port(reading).port, steps: refused}), /unknown context frame CF8/)
  // A breakdown of another unit than the one shown is not drawn on it.
  assert.ok(!draw({...port(reading).port, steps: {...steps, unit: 'mythos-debug'}}).includes('QL composes'))
  // An open head: QL names the labels its Vāk block holds for it.
  const opened = await score.readUnitSteps(answering({...REAL.unit_steps, open: ['CS'], heads: REAL.unit_steps.heads.map(head => head.head === 'CS'
    ? {head: 'CS', field: 'sequence', state: 'open', label: null, instrumentHead: 'vak-cs', labels: ['CS0', 'CS1', 'CS2', 'CS3', 'CS4', 'CS5']} : head)}), request)
  assert.match(draw({...port(reading).port, steps: opened}), /QL(&#x27;|')s Vāk block holds CS0 · CS1 · CS2 · CS3 · CS4 · CS5/)
})

test('Sample draws the task\'s log from the session\'s events, the retrospective readings where they were found; Warp lays it on the note; the tools change no log', async () => {
  resetViewHolds()
  const events = [
    {stream: 'agent-sessions', kind: 'run', subject_ref: 'ses-eros', instant_unix_ms: 2_000, summary: 'Read the diff'},
    {stream: 'now-thoughts', kind: 'thought', thought_type: 'T3-prime', subject_ref: 'ses-eros', instant_unix_ms: 31_000, summary: 'The test read the old capture list'},
    {stream: 'now-thoughts', kind: 'thought', thought_type: 'T2', subject_ref: 'ses-eros', instant_unix_ms: 40_000, summary: 'Does the fixture hold?'},
  ]
  const log = clip.taskLogOf(eros, eros.tasks[0], events)
  assert.deepEqual(log[0], {at: 1, kind: 'tool', tool: 'run', text: 'Read the diff'})
  assert.deepEqual(log[1], {at: 30, kind: 'reading', reading: 'T3′', text: 'The test read the old capture list'}, 'a retrospective reading stands where it was found')
  assert.equal(log[2].kind, 'tool', 'a prospective thought is the log\'s own row')
  // As the kernel reads Central's NOW stream (temporal_sources.rs thought_fixture_to_event): a thought is about its clearing, stands
  // at the instant Central recorded it, says its own first words, and names the session that wrote it among its evidence.
  const thought = (file, over) => ({stream: 'central-now-thoughts', kind: 'thought', subject_ref: `central:now:control:root:abc#T/${file}`,
    evidence_refs: [`now/T/${file}`, 'central.content-fnv1a64/v1:1:aaaa', 'ses-eros'], ...over})
  const stream = [events[0],
    thought('an-anomaly.md', {thought_type: 'T3-prime', instant_unix_ms: 31_000, summary: 'The test read the old capture list'}),
    thought('an-integration.md', {thought_type: 'T5-prime', instant_unix_ms: 61_000, summary: 'The fixture holds at the return'}),
    thought('another-session.md', {thought_type: 'T3-prime', instant_unix_ms: 33_000, summary: 'Another session\'s reading', evidence_refs: ['now/T/another-session.md', 'ses-agape']}),
    thought('no-instant.md', {thought_type: 'T1-prime', summary: 'A reading with no time'})]
  assert.deepEqual(clip.taskLogOf(eros, eros.tasks[0], stream), [
    {at: 1, kind: 'tool', tool: 'run', text: 'Read the diff'},
    {at: 30, kind: 'reading', reading: 'T3′', text: 'The test read the old capture list'},
    {at: 60, kind: 'reading', reading: 'T5′', text: 'The fixture holds at the return'},
  ], 'the readings the session wrote stand at their recorded times; another session\'s, and one with no time, do not')
  const {port: held} = port(read(REAL.score))
  const binding = bindingOf(held, {events})
  assert.equal(binding.writes('log'), false, 'nothing writes the log')
  assert.equal(binding.writes('elapsed'), false)
  // The task returned and its unit stands in the score: Warp lays the log on its note.
  const values = {...binding.values, state: 'done', warp: true}
  const design = await loadClip('factory')
  const sample = design.editor.find(tab => tab.id === 'log')
  const markup = renderToStaticMarkup(createElement(sample.draw, {v: values, set: noop, standing: binding.standing, size: 'detail', room: {w: 900, h: 360}}))
  assert.ok(markup.includes('Return · eros-verify'), 'the return is a warp marker on the note')
  assert.ok(markup.includes('eros-verify&#x27;s note in the score'), 'warped: the note stands behind the log')
  assert.ok(markup.includes('T3′: The test read the old capture list'))
  // A reading made after the return (the retrospective pass reads once the unit is back): on the clock the ruler reaches it, and
  // warped it stands on the return, at the note's end. Its line is read from the drawing: x1 inside the grid's width.
  const late = [...JSON.parse(binding.values.log), {at: 95, kind: 'reading', reading: 'T5′', text: 'The fixture holds at the return'}]
  const lineOf = (html, label) => Number(new RegExp(`data-i="${label}[^"]*"[^>]*><line x1="([0-9.]+)"`).exec(html)?.[1] ?? NaN)
  const draw = over => renderToStaticMarkup(createElement(sample.draw, {v: {...binding.values, log: JSON.stringify(late), elapsed: 60, state: 'done', ...over}, set: noop, standing: binding.standing, size: 'detail', room: {w: 900, h: 360}}))
  const clocked = draw({warp: false}), laid = draw({warp: true})
  assert.ok(lineOf(clocked, 'T5′') > lineOf(clocked, 'Return · eros-verify') && lineOf(clocked, 'T5′') <= 900, 'on the clock the late reading stands after the return, inside the ruler')
  assert.equal(lineOf(laid, 'T5′'), lineOf(laid, 'Return · eros-verify'), 'warped, the late reading stands on the return')
  assert.ok(laid.includes('read after the unit returned'))
})

// FIXTURE takes, owner-shaped (agent/factoryTakes.ts FactoryTake): each names the Run, the Factory state and the unit its attempt works.
const takeOf = (sessionRef, key, over = {}) => ({sessionRef, attemptRef: `attempt/${sessionRef}/${key}`, runRef: RUN, statePath: STATE, taskRef: `task/${sessionRef}`,
  unit: key, unitRef: unitOf(REAL.score, key).unitRef, state: 'returned', startUnixMs: 1_000, endUnixMs: 2_000, summary: null, receivingRef: null, ...over})
const taskAt = (title, startUnixMs, taskRef) => ({n: 1, title, state: 'running', startUnixMs, lastActivityUnixMs: startUnixMs + 1_000, softStop: false, disclosure: null, taskRef})

test('selecting another unit\'s note moves Clip view to that unit\'s task, the note chosen there for Routine…; a note no task works stays selected here', () => {
  resetViewHolds()
  const mythos = member('ses-mythos', 'agent/anima-mythos', 'Mythos', [taskAt('debug the capture', 5_000, 'task/ses-mythos')])
  // Off the track's rack: Sophia's agent is a row of the song; Scribe's is not.
  const sophia = {...member('ses-sophia', 'agent/anima-sophia', 'Sophia', [taskAt('finish the docs', 6_000, 'task/ses-sophia')]), parentRef: null, depth: 0}
  const scribe = {...member('ses-scribe', 'agent/scribe', 'Scribe', [taskAt('write it up', 7_000, 'task/ses-scribe')]), parentRef: null, depth: 0}
  const tracks = [group, eros, mythos, sophia, scribe]
  // Whose takes are read: the sessions of the track's rack, then the sessions whose agent is a row of the song.
  assert.deepEqual(clip.noteSessionsOf(eros, tracks, read(REAL.score)), ['ses-eros', 'ses-mythos', 'ses-sophia'])
  assert.deepEqual(clip.noteSessionsOf(eros, tracks, {state: 'absent', why: score.SCORE_READING_NOW}), ['ses-eros', 'ses-mythos'], 'before the score is read, its rack\'s')
  // A unit's task is the task whose latest attempt names it in this Run, as a task's own note is (wavePlan.ts planTargetOf).
  const takes = new Map([
    ['ses-eros', [takeOf('ses-eros', 'eros-verify')]],
    ['ses-mythos', [takeOf('ses-mythos', 'logos-scope-plan', {startUnixMs: 500}), takeOf('ses-mythos', 'mythos-debug', {startUnixMs: 4_000})]],
    ['ses-sophia', [takeOf('ses-sophia', 'sophia-finish', {runRef: 'run/another'})]],
    ['ses-scribe', [takeOf('ses-scribe', 'aletheia-knowledge-return', {statePath: '/walk/other/.factory/development-state.json'})]],
  ])
  const tasks = clip.unitTasksOf(read(REAL.score), tracks, ref => takes.get(ref) ?? null)
  assert.deepEqual([...tasks.keys()].sort(), ['eros-verify', 'mythos-debug'], 'an earlier attempt\'s unit, another Run\'s and another state\'s name no task here')
  const mythosRef = `${trackKey(mythos)}#task/1`
  assert.deepEqual(tasks.get('mythos-debug'), {kind: 'clip', ref: mythosRef, title: 'debug the capture', track: trackKey(mythos)})
  assert.equal(clip.unitTasksOf({state: 'absent', why: score.SCORE_NO_TAKE}, tracks, ref => takes.get(ref) ?? null).size, 0, 'no score read, no note has a task')
  // Two tasks working one unit: the one whose attempt began last.
  const later = new Map([...takes, ['ses-sophia', [takeOf('ses-sophia', 'mythos-debug', {startUnixMs: 8_000})]]])
  assert.equal(clip.unitTasksOf(read(REAL.score), tracks, ref => later.get(ref) ?? null).get('mythos-debug').ref, `${trackKey(sophia)}#task/1`)
  // The note selected in the score: another task's unit moves THE selection to that task, whose Clip view holds the note.
  const moved = []
  const binding = bindingOf(port(read(REAL.score)).port, {tracks, unitTasks: tasks, select: to => moved.push(to)})
  binding.local.unit('mythos-debug')
  assert.deepEqual(moved, [{kind: 'clip', ref: mythosRef, title: 'debug the capture', track: trackKey(mythos)}])
  assert.equal(viewHoldsOf(HOLD).unit, undefined, 'this task\'s own view is left as it was')
  assert.equal(viewHoldsOf(clipHostId('factory', mythosRef)).unit, 'mythos-debug', 'the task moved to holds the note chosen')
  assert.deepEqual(clip.chosenNoteOf(mythosRef, tracks, ''), {project: '', session: 'ses-mythos', key: 'mythos-debug'}, 'the note Routine… takes is the one chosen')
  // This task's own note, and a note no task works, stay selected here: the tools act on them.
  binding.local.unit('logos-scope-plan')
  assert.equal(viewHoldsOf(HOLD).unit, 'logos-scope-plan')
  binding.local.unit('eros-verify')
  assert.equal(viewHoldsOf(HOLD).unit, 'eros-verify')
  assert.equal(moved.length, 1)
  binding.local['score.fold']('rack')
  assert.equal(viewHoldsOf(HOLD)['score.fold'], 'rack', 'the view\'s other keys hold as before')
  // A song opened inside a note shows that song's notes: one selected there is no unit of this Run, and nothing moves.
  setViewHold(HOLD, 'score.open', 'eros-verify')
  binding.local.unit('mythos-debug')
  assert.equal(moved.length, 1)
  assert.equal(viewHoldsOf(HOLD).unit, 'mythos-debug')
  // Where no takes are read, nothing moves: the note stays selected.
  resetViewHolds()
  bindingOf(port(read(REAL.score)).port, {tracks}).local.unit('mythos-debug')
  assert.equal(viewHoldsOf(HOLD).unit, 'mythos-debug')
})

test('the Clip view reads the takes of the sessions that may work its notes and moves THE selection through its one writer', async () => {
  const source = await readFile(new URL('../src/agent/clipBinding.ts', import.meta.url), 'utf8')
  const hook = source.slice(source.indexOf('export function useFactoryClip'), source.indexOf('// ----', source.indexOf('export function useFactoryClip')))
  assert.match(hook, /useAttemptTakes\(transport, [^)]*noteSessions/, 'the takes of the rack\'s sessions and the song\'s rows')
  assert.match(hook, /unitTasksOf\(/)
  assert.match(hook, /timelineReading\(\)\?\.selectTrackItem\(/, 'THE selection\'s one writer (projections/timelinePaneHost.ts)')
})

test('the design draws the song on the track\'s rack, this task\'s note lit, every key wired, in the words "agents and agent sets"', async () => {
  resetViewHolds()
  const design = await loadClip('factory')
  const {port: held} = port(read(REAL.score))
  const binding = bindingOf(held)
  const notes = design.editor.find(tab => tab.id === 'notes')
  const draw = values => renderToStaticMarkup(createElement(notes.draw, {v: values, set: noop, standing: binding.standing, size: 'detail', room: {w: 900, h: 360}}))
  const markup = draw(binding.values)
  for (const words of ['development-and-knowledge', 'Eros', 'Mythos', 'eros-verify', 'logos-scope-plan', 'Admitted']) assert.ok(markup.includes(words), words)
  assert.ok(!markup.includes('◆ Anima'), 'Fold keeps the rows that hold notes')
  assert.ok(draw({...binding.values, 'score.fold': 'rack'}).includes('◆ Anima'), 'Rack shows the agent set the track runs, ◆')
  assert.match(markup, /data-tone="green"[^>]*data-i="eros-verify/, 'this task\'s own note is lit')
  // §19.1: "This task's note is drawn in the clip's colour" — the colour the clip's head stands on; a highlighted form's tint wins.
  const coloured = draw({...binding.values, colour: 'var(--parasakti)'})
  assert.match(coloured, /data-tone="green"[^>]*data-i="eros-verify[^>]*style="[^"]*color:var\(--parasakti\)/, 'this task\'s note in the clip\'s colour')
  assert.equal(coloured.match(/color:var\(--parasakti\)/g)?.length, 1, 'only this task\'s note')
  assert.doesNotMatch(draw({...binding.values, colour: 'var(--parasakti)', 'score.highlight': unitOf(REAL.score, 'eros-verify').heads.CFP}), /color:var\(--parasakti\)/)
  const wiring = clip.factoryWiring({sessionRef: 'ses-eros', n: 1}, null, null, null, held)
  for (const key of ['score', 'unit.own', 'score.check', 'gen.status', 'unit', 'score.fold', 'score.highlight', 'score.open', 'warp', 'tr.tool', 'tr.form',
    'tr.join', 'tr.to', 'tr.on', 'tr.auto', 'tr.press', 'gen.tool', 'gen.waves', 'gen.decider', 'gen.press', 'gen.accept', 'gen.discard']) assert.ok(wiredKey(wiring, key), key)
  const sources = await Promise.all(['../src/agent/clipBinding.ts', '../src/agent/scoreBinding.ts', '../src/inhabitants/catalogue/clips/factory.tsx']
    .map(path => readFile(new URL(path, import.meta.url), 'utf8')))
  for (const source of sources) assert.doesNotMatch(source, /agents? (and|or) teams?|kind: agent \| team|'team'/, 'the rows are agents and agent sets')
  assert.match(sources[1], /agents and agent sets/)
})

// O-I 844 Compose (lead rulings, round 15): Compose is Anima's act through its team. The press sends one Communique to the Position the
// session's orchestrator occupies (`aikit gateway send`, the kernel's gateway_write send) carrying the Intent, the clip's Constellation and
// its sources, the song's identity and where the answer goes; Anima answers the person (`aikit gateway send --to @owner --propose
// --reply-to <the ask>`), a proposal Central's receiving ledger holds from its Position. The desk reads the ledger (`receiving` List, Read)
// for the proposal that answers the ask; QL checks the heads it gives, Factory admits it (`factory workflow edit --check`, factory_owner
// `workflow-edit-check`), and the person's Accept is one act: the proposal accepted in Central and the edit written by Factory. Discard
// declines it. Channels: Central's agent set and AIKit's population are REAL (tests/fixtures/central-agent-set-anima-2026-10-29.json;
// workcell-readings-2026-10-21.json, where agent/anima occupies anima-4 over omarchy); a vacant orchestrator is DERIVED from it (its
// occupancy made vacant). SCRIPTED, as the lead rules: AIKit's send answer and the ledger's proposal (Central's receiving page and
// reading shapes, ctrl continuous_work/receiving.rs) — no body and no model. QL's check is SCRIPTED in its REAL shape (as above); Factory's
// check receipt is DERIVED from the REAL heads receipt as Factory's `--check` answers it (its own test, factory/tests/workflow_score.rs
// an_edit_is_admitted_without_being_written…, pins it); Factory's refusal is REAL (ql_spelling). The native walk is UNVERIFIED.
const SET = JSON.parse(await readFile(new URL('./fixtures/central-agent-set-anima-2026-10-29.json', import.meta.url), 'utf8')).answer
const WHO = JSON.parse(await readFile(new URL('./fixtures/workcell-readings-2026-10-21.json', import.meta.url), 'utf8')).population
const ANIMA = 'central:position:project:O-I:anima-4'
const REV = REAL.score.song.file.byteRevision
const ASK = 'aikit:communique:01m3compose0ask0000000000000'
const answered = value => ({status: 'answered', value})
const ADDRESS = {position: ANIMA, agent: 'agent/anima', set: 'agent-set/anima'}
const WORDS = {intent: 'The capture list survives a restart', intentWhy: null, constellation: 'wiki:space:capture', sources: ['wiki:page:capture-list', 'wiki:page:restart']}
const PROPOSAL = {contract: 'factory.workflow-edit/v1', expectedRevision: REV, edits: [{op: 'heads', unit: 'eros-verify', heads: {CS: 'CS3'}},
  {op: 'connect', unit: 'mythos-debug', waitsOn: 'eros-verify'}]}
const proposalBody = (edit = PROPOSAL) => `Compose: a first score for development-and-knowledge\n\nVerify before debugging.\n\n\`\`\`json\n${JSON.stringify(edit)}\n\`\`\``
// Central's receiving ledger, SCRIPTED in its own shapes: a page's rows and each Return's reading.
const ledgerRow = (n, over = {}) => ({return_ref: `central:return:project:O-I:compose-${n}`, revision: `central.content-fnv1a64/v1:${n}:aa`, sequence: n, status: 'pending',
  kind: 'request', source_ref: null, document_id: null, author: {principal_ref: 'native-service:aikit/gateway', actor_kind: 'native-service'},
  declared_producer: {ref: ANIMA, actor_kind: 'agent', attribution: 'verified'}, summary: null,
  request: {kind: 'proposal', subject: 'Compose: development-and-knowledge', proposed_owner_ref: null, proposal_ref: null}, acknowledged: false,
  received_at_unix_seconds: 1_790_000_100, settled: false, ...over})
const ledgerReading = (row, replyTo, body = proposalBody(), status = row.status) => ({schema: 'central.receiving-reading/v1', return_ref: row.return_ref, revision: row.revision,
  record: {...row, status, request: {...row.request, body}, reply_to: replyTo, authority_ref: 'a', authority_revision: 'r', stale_at_arrival: false, review: null},
  included: false, source_changed_by_arrival_or_review: false, automatic_agent_or_model_invocation: false})
const ASKED = {communique: ASK, position: ANIMA, project: 'O-I', revision: REV, at: 1_790_000_000_000}
/** A scripted kernel over the ledger, QL and Factory: every op recorded, each answered as its owner would. */
function owners({rows = [], readings = {}, ql = 'admitted', factory = 'admitted', reviewed = []} = {}) {
  const asked = []
  const call = async op => {
    asked.push(op)
    if (op.op === 'receiving') {
      const [verb, request] = Object.entries(op.request)[0]
      if (verb === 'List') return {outcome: {result: 'receiving_reading', data: {schema: 'central.receiving-page/v1', returns: rows.filter(row => row.sequence > (request.after ?? 0)),
        more: false, next_after: null, withheld_unavailable_sources: 0, proposal_bodies_in_page: false, open_total: rows.length}}}
      if (verb === 'Read') return {outcome: {result: 'receiving_reading', data: readings[request.return_ref]}}
      if (verb === 'Review') { reviewed.push(request); return {outcome: {result: 'receiving_reading', data: {...readings[request.return_ref], revision: 'reviewed'}}} }
    }
    if (op.op === 'ql_read') {
      const cells = op.request.request.cells
      return {outcome: {result: 'owner_route_reading', route: 'ql context-frame team-space check', data: {schema: 'ql.instrument-cell-check/v1', instrument: 'vak-block',
        cells: cells.map(cell => ql === 'admitted' ? {key: cell.key, state: 'admitted', heads: [], open: [], why: 'every head holds a label it allows, and no constraint is broken'}
          : {key: cell.key, state: 'refused', heads: [], open: [], why: 'label `CS3` breaks the constraint of `vak-cs` with `vak-cfp`'})}}}
    }
    if (op.op === 'factory_owner' && op.request.kind === 'workflow-edit-check') {
      if (factory === 'refused') return {error: JSON.stringify({kind: 'owner-refused-or-failed', message: `${REAL.ql_spelling.error.code}: ${REAL.ql_spelling.error.message}`, operation_may_have_run: false})}
      const {semanticDigest, performed, performs, imports, ...receipt} = REAL.heads
      return {outcome: {result: 'factory_development_reading', data: factory === 'older' ? REAL.heads : {...receipt, revision: receipt.previousRevision, written: false}}}
    }
    return {error: `unscripted ${op.op}`}
  }
  return {asked, call, reviewed}
}

test('Compose asks the Position the session\'s orchestrator occupies, from Central\'s agent set and AIKit\'s population, or is refused in words naming how its body starts', () => {
  // REAL: Central's agent set anima names agent/anima its orchestrator; AIKit's population has it occupy anima-4.
  const to = score.composeAddressOf(eros, TRACKS, {set: answered(SET), population: answered(WHO)})
  assert.deepEqual(to, {state: 'addressed', address: ADDRESS})
  // DERIVED: no one occupies the orchestrator's Position. The press is refused, naming it and how its body starts; nothing is asked.
  const vacant = structuredClone(WHO)
  Object.assign(vacant.positions.find(row => row.position_ref === ANIMA), {occupancy: {state: 'vacant', observed_via: 'local'}})
  const refused = score.composeAddressOf(eros, TRACKS, {set: answered(SET), population: answered(vacant)})
  assert.equal(refused.state, 'refused')
  assert.match(refused.why, /no one occupies central:position:project:O-I:anima-4, where agent\/anima composes for agent-set\/anima: its body starts with `aikit inhabit --position central:position:project:O-I:anima-4`, and nothing is asked until it does/)
  // A session in no agent set, a set not read or naming no orchestrator, and a population not read: each in its owner's words.
  const lone = {...member('ses-lone', 'agent/aletheia', 'Aletheia'), parentRef: null}
  assert.match(score.composeAddressOf(lone, [lone], {set: null, population: answered(WHO)}).why, /stands in no agent set/)
  assert.match(score.composeAddressOf(eros, TRACKS, {set: {status: 'refused', error: 'central.agent_set_not_found'}, population: answered(WHO)}).why,
    /Central did not read the agent set agent-set\/anima: central\.agent_set_not_found/)
  assert.match(score.composeAddressOf(eros, TRACKS, {set: answered({...SET, record: {...SET.record, orchestrator_agent_ref: null}}), population: answered(WHO)}).why, /names no orchestrator/)
  assert.match(score.composeAddressOf(eros, TRACKS, {set: answered(SET), population: {status: 'reading'}}).why, /AIKit has not answered who is here yet/)
  assert.match(score.composeAddressOf(eros, TRACKS, {set: answered({...SET, record: {...SET.record, orchestrator_agent_ref: 'agent/nobody'}}), population: answered(WHO)}).why,
    /agent\/nobody, the orchestrator of agent-set\/anima, holds no Position here/)
})

test('Compose sends one Communique to that Position carrying the Intent, the Constellation\'s sources, the song and where the answer goes, and keeps its id', () => {
  const {body, revision} = score.composeAskOf(ADDRESS, WORDS, REAL.score, TARGET, 'O-I')
  assert.equal(revision, REV)
  assert.match(body, /^Compose a first score for the song development-and-knowledge, from the task's Intent, through your team \(agent-set\/anima\)\./)
  assert.match(body, /Intent: The capture list survives a restart/)
  assert.match(body, /Sources: wiki:space:capture — wiki:page:capture-list, wiki:page:restart/)
  assert.match(body, /From: no plan is named/)
  assert.match(body, /`aikit gateway send --to @owner --propose --reply-to <this Communique> --subject "Compose: development-and-knowledge" --project-world O-I --body-file -`/)
  // Anima is told which edits are Factory's: `unit` writes a unit the song does not hold, whole, in the workflow SDK's words.
  assert.match(body, /Your edits are Factory's \(factory\.workflow-edit\/v1\): `unit` writes a unit the song does not hold, whole, in the workflow SDK's words \(`factory workflow schema`\); `allocate`, `connect` and `heads` change the units it holds\./)
  const ask = JSON.parse(body.match(/```json\n([\s\S]*?)\n```/)[1])
  assert.deepEqual(ask, {schema: 'oi.compose-ask/v1', intent: WORDS.intent, from: null, constellation: WORDS.constellation, sources: WORDS.sources,
    song: {workflowKey: 'development-and-knowledge', runRef: RUN, statePath: STATE, byteRevision: REV}, set: 'agent-set/anima', map: null,
    answer: {to: '@owner', propose: true, register: 'O-I', contract: 'factory.workflow-edit/v1', expectedRevision: REV, edits: ['unit', 'allocate', 'connect', 'heads']}})
  assert.throws(() => score.composeAskOf(ADDRESS, {...WORDS, intent: null, intentWhy: 'Factory did not read the Run\'s Development Field'}, REAL.score, TARGET, 'O-I'),
    /Compose writes from the task's Intent, and it is not read: Factory did not read/)
  // One send, to the orchestrator's Position, with no sender: the desk is never an occupant. AIKit's answer names the Communique kept.
  const op = score.composeSendOp(ADDRESS, body, 'O-I')
  assert.deepEqual(op, {op: 'gateway_write', request: {kind: 'send', project: 'O-I', to: ANIMA, body}})
  assert.equal(writesOwner(op), true)
  const sent = {communique: {schema: 'aikit.communique/v1', communique_ref: ASK, from_position_ref: null, to_position_ref: ANIMA, attribution: 'unknown', state: 'held'}}
  assert.deepEqual(score.composeAskedOf(sent, ADDRESS, 'O-I', REV, 7), {communique: ASK, position: ANIMA, project: 'O-I', revision: REV, at: 7})
  assert.throws(() => score.composeAskedOf({}, ADDRESS, 'O-I', REV, 7), /AIKit's send answered no Communique/)
})

// O-I 844, round 16: "The spec a song answers to stands in the Intent panel's From. When the work is a project's development, the
// project's map gives the song its units: each ticket on the map is a unit, and its parts are the unit's parts" (manual §19.1 Songs).
// The From is the plan the Run answers to (its Development Field's targets.planRef). Where it names an issue, Compose reads it as a map
// through Factory (factory_owner `workflow-map` → `factory workflow map <owner/repo> <n> --gh <gh>`). Channels: the map is REAL
// (`factory workflow map EpiLogos/O-I 706`, 4 Nov, through the forge), trimmed to two of its 46 units and their waves; the refusal of an
// issue that is no map is REAL (`factory workflow map EpiLogos/O-I 844`), carried in the kernel's envelope with its kind `not-a-map`
// (kernel factory.rs workflow_refusal_kind); the map's unread refusal is DERIVED from Factory's words (workflow_score.rs map).
const MAP_REF = 'github:EpiLogos/O-I:issue:706'
const MAP = {closed: ['github:EpiLogos/O-I:issue:722'], contract: 'factory.project-map-reading/v1',
  map: {label: 'wayfinder:map', ticket: MAP_REF, title: '[MAP] The DLW: built from the manual, walked from four worlds', url: 'https://github.com/EpiLogos/O-I/issues/706'},
  units: [{blockedBy: [], key: 'issue-842', ticket: 'github:EpiLogos/O-I:issue:842', title: 'Every session\'s agency stands in one Agent rack', url: 'https://github.com/EpiLogos/O-I/issues/842', waitsOutside: [], wave: 'wave-1'},
    {blockedBy: ['issue-842'], key: 'issue-843', ticket: 'github:EpiLogos/O-I:issue:843', title: 'Factory\'s Clip view: the song\'s score, the task\'s log and Vāk', url: 'https://github.com/EpiLogos/O-I/issues/843', waitsOutside: [], wave: 'wave-2'}],
  waves: [{wave: 'wave-1', units: ['issue-842']}, {wave: 'wave-2', units: ['issue-843']}], written: false}
const NOT_A_MAP = JSON.stringify({kind: 'not-a-map', message: 'EpiLogos/O-I#844 (Songs: work written once, run again, and used whole in other work) carries no wayfinder:map label: it is not a map, so it gives no song its units', operation_may_have_run: false})
/** A unit written whole, as the workflow SDK words it (factory/workflow-sdk/schema.json $defs/unit), for the map's ticket. */
const wholeUnit = (key, dependencies, over = {}) => ({key, developmentalConcern: `The ticket ${key} is built`, requiredDifference: `${key}'s Done when holds on main`,
  returnContract: 'a pull request against main', subjectRef: 'project:O-I', basisRevision: 'b545a50ef', agentRequirements: {agentRefs: ['agent/anima-techne-helper']},
  praxisRefs: [], capabilityRefs: [], permittedEffects: ['packages/live-shell/ui/'], verificationObligations: [`${key}'s Done when`], returnAddress: 'central:source:project:O-I:ProjectCentral/now',
  stopConditions: [], escalationConditions: [], dependencies, ...over})

test('the From is the plan the Run answers to, and where it names an issue Compose reads it as a map through Factory; an issue that is no map leaves the Intent alone, any other refusal refuses the press', async () => {
  assert.deepEqual(score.mapNamedBy(MAP_REF), {repository: 'EpiLogos/O-I', number: 706})
  assert.deepEqual(score.mapNamedBy('https://github.com/EpiLogos/O-I/issues/706'), {repository: 'EpiLogos/O-I', number: 706})
  for (const plan of [null, 'plan:development-field-s4', 'github:EpiLogos/O-I:pull:706', 'https://github.com/EpiLogos/O-I/pull/706']) assert.equal(score.mapNamedBy(plan), null, String(plan))
  const asked = []
  const answering = answer => async op => { asked.push(op); return answer }
  const read = await score.readComposeMap(answering({outcome: {result: 'factory_development_reading', data: MAP}}), MAP_REF)
  assert.deepEqual(read, {state: 'read', reading: MAP})
  assert.deepEqual(asked, [{op: 'factory_owner', request: {kind: 'workflow-map', repository: 'EpiLogos/O-I', number: 706}}])
  assert.equal(writesOwner(asked[0]), false, 'a map is read, never written: the bridge hears a read')
  // REAL: the issue is no map. Compose writes from the Intent, and says why.
  const none = await score.readComposeMap(answering({error: NOT_A_MAP}), 'github:EpiLogos/O-I:issue:844')
  assert.equal(none.state, 'none')
  assert.match(none.why, /EpiLogos\/O-I#844 \(Songs: work written once, run again, and used whole in other work\) carries no wayfinder:map label: it is not a map/)
  // A plan that names no issue is not asked about.
  asked.length = 0
  assert.match((await score.readComposeMap(answering({}), 'plan:development-field-s4')).why, /the plan it answers to \(plan:development-field-s4\) names no issue on the forge/)
  assert.match((await score.readComposeMap(answering({}), null)).why, /its Run names no plan/)
  assert.deepEqual(asked, [])
  // The forge not read, or a Factory that predates the map read: the press is refused in Factory's words.
  await assert.rejects(score.readComposeMap(answering({error: JSON.stringify({kind: 'owner-refused-or-failed', message: 'The forge did not answer repos/EpiLogos/O-I/issues/706: gh api timed out', operation_may_have_run: false})}), MAP_REF),
    /^Error: Compose: Factory did not read the map github:EpiLogos\/O-I:issue:706: The forge did not answer repos\/EpiLogos\/O-I\/issues\/706/)
  await assert.rejects(score.readComposeMap(answering({outcome: {result: 'factory_development_reading', data: {contract: 'factory.wave-reading/v1'}}}), MAP_REF),
    /may predate `factory workflow map`/)
})

test('Compose from a map asks for one unit per ticket, keyed as the map keys it and waiting on its blockers, its parts the ticket\'s; the proposal\'s new units stand dashed until Accept', async () => {
  const words = {...WORDS, from: MAP_REF}
  const {body} = score.composeAskOf(ADDRESS, words, REAL.score, TARGET, 'O-I', {state: 'read', reading: MAP})
  assert.match(body, /From: github:EpiLogos\/O-I:issue:706/)
  // The prose names how many tickets and waves; the keys stand only in the JSON block, so a 46-ticket map reads in a paragraph.
  assert.match(body, /The song answers to the map github:EpiLogos\/O-I:issue:706 \(\[MAP\] The DLW: built from the manual, walked from four worlds\): give each of its 2 open tickets one unit with `unit`, in its 2 waves \(1 and 1 tickets\), keyed as the map keys it and waiting on the tickets that block it \(blockedBy\); the tickets, their keys and their waves stand in the JSON block below\./)
  assert.ok(!body.split('```json')[0].includes('issue-842'), 'no key in the prose')
  assert.match(body, /Read each ticket: its Question is what the unit is for, its Context the unit's sources, its Done when the unit's success conditions, its Writes what the unit may change, and its claim the row the unit stands on\./)
  assert.match(body, /A blocker outside the map \(waitsOutside\) is no unit of this song, so no unit waits on it\./)
  const ask = JSON.parse(body.match(/```json\n([\s\S]*?)\n```/)[1])
  assert.equal(ask.from, MAP_REF)
  assert.deepEqual(ask.map, {ticket: MAP_REF, title: MAP.map.title, url: MAP.map.url, units: MAP.units, waves: MAP.waves})
  // An issue that is no map: the ask says so, and composes from the Intent.
  const plain = score.composeAskOf(ADDRESS, {...words, from: 'github:EpiLogos/O-I:issue:844'}, REAL.score, TARGET, 'O-I', {state: 'none', why: 'EpiLogos/O-I#844 carries no wayfinder:map label: it is not a map'})
  assert.match(plain.body, /No map gives this song its units \(EpiLogos\/O-I#844 carries no wayfinder:map label: it is not a map\): compose them from the Intent\./)
  assert.equal(JSON.parse(plain.body.match(/```json\n([\s\S]*?)\n```/)[1]).map, null)
  // Anima's answer: one unit per ticket, written whole; the second's composition gives heads QL checks, under their own cell.
  const composition = {participation: 'dialogical', content: 'CT2', position: '4.2', frame: 'CF3', thread: 'CFP2', sequence: 'CS2', direction: 'returning-inquiry'}
  const fromMap = {contract: 'factory.workflow-edit/v1', expectedRevision: REV, edits: [{op: 'unit', unit: wholeUnit('issue-842', [])},
    {op: 'unit', unit: wholeUnit('issue-843', ['issue-842'], {composition})}, {op: 'heads', unit: 'issue-843', heads: {CS: 'CS3'}}]}
  const reading = read(REAL.score)
  const cells = score.composedCellsOf(reading, fromMap)
  assert.deepEqual(cells.map(cell => cell.key), ['issue-843#composed'], 'a unit with no composition gives no heads')
  assert.deepEqual(cells[0].chosen, {'vak-cpf': ['dialogical'], 'vak-ct': ['CT2'], 'vak-cp': ['4.2'], 'vak-cf': ['CF3'], 'vak-cfp': ['CFP2'], 'vak-cs': ['CS3'], 'vak-direction': ['returning-inquiry']},
    'its composition\'s heads, a later heads edit over them')
  const ok = owners()
  const word = await score.judgeProposal(ok.call, reading, fromMap)
  assert.equal(word.state, 'admitted')
  assert.match(word.why, /Anima's proposal: 3 edits, 2 units written whole; QL admits the heads it gives, and Factory admits it/)
  // On the score: the units the proposal writes stand after the song's own, dashed, on the row each requires.
  const taken = {state: 'answered', returnRef: 'central:return:project:O-I:compose-3', revision: 'r', status: 'pending', proposal: fromMap, later: 0}
  const values = score.scoreValuesOf(reading, score.rackRowsOf(eros, TRACKS), null, null, {state: 'answered', asked: ASKED, answer: taken, word: 'admitted', why: word.why})
  const drawn = JSON.parse(values.score)
  const added = drawn.units.filter(unit => unit.key.startsWith('issue-'))
  assert.deepEqual(added.map(unit => [unit.key, unit.row, unit.deps, unit.proposed]), [['issue-842', 'agent/anima-techne-helper', [], true],
    ['issue-843', 'agent/anima-techne-helper', ['issue-842'], true]])
  assert.deepEqual(added[1].heads, {CPF: 'dialogical', CT: 'CT2', CP: '4.2', CF: 'CF3', CFP: 'CFP2', CS: 'CS2', direction: 'returning-inquiry'})
  assert.deepEqual(added[1].picks, {CS: 'CS3'})
  assert.equal(added[0].concern, 'The ticket issue-842 is built')
  assert.deepEqual(added[0].success, ['issue-842\'s Done when'])
  assert.equal(drawn.units.length, REAL.score.units.length + 2, 'the song\'s own units stand as Factory read them')
})

test('Anima\'s answer is the proposal Central\'s ledger holds from that Position replying to the ask; another ask\'s, a second, or one that is no edit is not taken, in words', async () => {
  // Waiting: the Position proposed something else since the ask, and another Position proposed too.
  const other = ledgerRow(1), stranger = ledgerRow(2, {declared_producer: {ref: 'central:position:project:O-I:central-guardian', actor_kind: 'agent', attribution: 'verified'}})
  const waiting = owners({rows: [other, stranger], readings: {[other.return_ref]: ledgerReading(other, 'aikit:communique:another-ask')}})
  const none = await score.composeAnswerOf(waiting.call, ASKED)
  assert.deepEqual(none, {state: 'waiting', others: 1})
  assert.deepEqual(waiting.asked.map(op => Object.keys(op.request)[0]), ['List', 'Read'], 'only the proposals from the Position asked are read')
  assert.ok(waiting.asked.every(op => op.op === 'receiving' && op.project === 'O-I' && writesOwner(op) === false), 'the ledger is read, never written')
  assert.match(score.composeStatusOf({state: 'asked', asked: ASKED, others: 1}).why,
    /Compose asked central:position:project:O-I:anima-4 \(aikit:communique:01m3compose0ask0000000000000\): no proposal in Central's receiving ledger answers it yet\. 1 proposal from it since then answers another Communique and is not taken\./)
  // Answered: the first proposal replying to the ask is taken; a second replying to it is not.
  const first = ledgerRow(3), second = ledgerRow(4)
  const both = owners({rows: [other, first, second], readings: {[other.return_ref]: ledgerReading(other, 'aikit:communique:another-ask'),
    [first.return_ref]: ledgerReading(first, ASK), [second.return_ref]: ledgerReading(second, ASK, proposalBody({...PROPOSAL, edits: [{op: 'heads', unit: 'eros-verify', heads: {CS: 'CS4'}}]}))}})
  const taken = await score.composeAnswerOf(both.call, ASKED)
  assert.equal(taken.state, 'answered')
  assert.equal(taken.returnRef, first.return_ref)
  assert.deepEqual(taken.proposal, PROPOSAL)
  assert.equal(taken.later, 1)
  // Its body is no edit, or an edit against another revision: not taken, said so.
  const prose = owners({rows: [first], readings: {[first.return_ref]: ledgerReading(first, ASK, 'Compose: I would split the debug unit in two.')}})
  const notEdit = await score.composeAnswerOf(prose.call, ASKED)
  assert.equal(notEdit.state, 'refused')
  assert.match(notEdit.why, /Anima's proposal \(central:return:project:O-I:compose-3\) holds no factory\.workflow-edit\/v1, so it is not taken/)
  const stale = owners({rows: [first], readings: {[first.return_ref]: ledgerReading(first, ASK, proposalBody({...PROPOSAL, expectedRevision: 'blake3:old'}))}})
  assert.ok((await score.composeAnswerOf(stale.call, ASKED)).why.includes(`is against revision blake3:old, and the song was asked at ${REV}`))
  // The ledger not answering is Central's words.
  await assert.rejects(score.composeAnswerOf(async () => ({error: 'central.receiving_unavailable: the receiving owner store is locked'}), ASKED),
    /Central's receiving ledger did not answer the list of what it received: central\.receiving_unavailable/)
})

test('a proposal goes through QL\'s check of its heads, then Factory\'s admission written nowhere; each refusal is its owner\'s words', async () => {
  const reading = read(REAL.score)
  const cells = score.composedCellsOf(reading, PROPOSAL)
  assert.deepEqual(cells.map(cell => cell.key), ['eros-verify#composed'])
  assert.deepEqual(cells[0].chosen['vak-cs'], ['CS3'], 'the head it gives, over the unit\'s own')
  assert.deepEqual(cells[0].chosen['vak-cf'], ['CF3'], 'the unit\'s heads under it')
  const ok = owners()
  const word = await score.judgeProposal(ok.call, reading, PROPOSAL)
  assert.equal(word.state, 'admitted')
  assert.match(word.why, /Anima's proposal: 2 edits; QL admits the heads it gives, and Factory admits it \(factory workflow edit --check\)\. Accept writes it into the song\./)
  assert.deepEqual(ok.asked.map(op => op.op === 'factory_owner' ? op.request.kind : op.op), ['ql_read', 'workflow-edit-check'], 'QL first, then Factory')
  const check = ok.asked[1]
  assert.deepEqual(check, {op: 'factory_owner', request: {kind: 'workflow-edit-check', state_path: STATE, run_ref: RUN, request: PROPOSAL}})
  assert.equal(writesOwner(check), false, 'Factory\'s admission writes nothing: the bridge hears a read')
  const ql = owners({ql: 'refused'})
  assert.match((await score.judgeProposal(ql.call, reading, PROPOSAL)).why, /^QL refuses eros-verify: label `CS3` breaks the constraint/)
  assert.equal(ql.asked.length, 1, 'Factory is not asked what QL refused')
  assert.match((await score.judgeProposal(owners({factory: 'refused'}).call, reading, PROPOSAL)).why, /^Factory refuses Anima's proposal: authoring\.domain_lowering: Factory Vāk orchestration error: InvalidCPrimeProfile/)
  assert.match((await score.judgeProposal(owners({factory: 'older'}).call, reading, PROPOSAL)).why, /may predate `factory workflow edit --check`/)
})

test('Accept is one act — the proposal accepted in Central\'s ledger, then Factory writes the edit — and Discard declines it; nothing is written before Accept', async () => {
  const first = ledgerRow(3)
  const answer = {returnRef: first.return_ref, revision: first.revision, status: 'pending', proposal: PROPOSAL}
  const edits = []
  const ledger = owners({readings: {[first.return_ref]: ledgerReading(first, ASK)}})
  await score.acceptComposed(ledger.call, 'O-I', answer, async request => { edits.push(request) })
  assert.deepEqual(ledger.reviewed, [{return_ref: first.return_ref, expected_return_revision: first.revision, disposition: 'accepted',
    expected_source_revision: undefined, note: 'Accepted on the task\'s clip: Factory writes it into the song.', answer: undefined}])
  assert.equal(writesOwner(ledger.asked[0]), true, 'the person\'s review is a write, carried with the person\'s authority (owner_write.rs receiving_person_act)')
  assert.deepEqual(edits, [PROPOSAL], 'then Factory writes the edit, at the revision it was asked against')
  // Accepted already (in the Inbox, or a Factory refusal before): Factory is asked again and Central is not.
  const again = owners()
  await score.acceptComposed(again.call, 'O-I', {...answer, status: 'accepted'}, async request => { edits.push(request) })
  assert.deepEqual(again.asked, [])
  // Factory refuses after Central accepted it: said so, in Factory's words.
  await assert.rejects(score.acceptComposed(owners({readings: {[first.return_ref]: ledgerReading(first, ASK)}}).call, 'O-I', answer, async () => { throw new Error('workflow.edit_stale: The song\'s file changed since it was read') }),
    /Central holds Anima's proposal accepted \(central:return:project:O-I:compose-3\), and Factory did not write it: workflow\.edit_stale/)
  await assert.rejects(score.acceptComposed(owners().call, 'O-I', {...answer, status: 'rejected'}, async () => {}), /The person declined Anima's proposal in Central/)
  // Discard declines a proposal that waits; one Central settled is only forgotten.
  const declined = owners({readings: {[first.return_ref]: ledgerReading(first, ASK)}})
  await score.declineComposed(declined.call, 'O-I', answer)
  assert.equal(declined.reviewed[0].disposition, 'rejected')
  const settled = owners()
  await score.declineComposed(settled.call, 'O-I', {...answer, status: 'accepted'})
  assert.deepEqual(settled.asked, [])
})

test('on the clip: Compose shows where it asks, then asked and waiting in words, then the proposal dashed in the score until Accept or Discard', async () => {
  resetViewHolds()
  setViewHold(HOLD, 'gen.tool', 'compose')
  const design = await loadClip('factory')
  const generate = design.tools.find(tab => tab.id === 'generate')
  const draw = binding => renderToStaticMarkup(createElement(generate.draw, {v: binding.values, set: noop, standing: binding.standing, size: 'detail', room: {w: 900, h: 360}}))
  const acts = {asks: 0, accepts: 0, discards: 0}
  const composing = state => ({state, ask: async () => { acts.asks++ }, accept: async () => { acts.accepts++ }, discard: async () => { acts.discards++ }})
  // Unaddressed: the press stands disabled with the owners' words before it is pressed.
  const vacantWhy = 'Compose: no one occupies central:position:project:O-I:anima-4, where agent/anima composes for agent-set/anima: its body starts with `aikit inhabit --position central:position:project:O-I:anima-4`, and nothing is asked until it does.'
  const unaddressed = bindingOf({...port(read(REAL.score)).port, compose: composing({state: 'unaddressed', why: vacantWhy})})
  assert.equal(unaddressed.standing['gen.asks']?.disabled, vacantWhy)
  assert.ok(draw(unaddressed).includes('aikit inhabit --position central:position:project:O-I:anima-4'), 'the refusal is drawn where Compose asks')
  // Ready: where it asks; the press sends the ask.
  const ready = bindingOf({...port(read(REAL.score)).port, compose: composing({state: 'ready', address: ADDRESS})})
  assert.equal(ready.values['gen.asks'], 'central:position:project:O-I:anima-4 · agent/anima, the orchestrator of agent-set/anima')
  assert.equal(ready.standing['gen.asks'], undefined)
  await ready.write([{key: 'gen.press', value: 1}])
  assert.equal(acts.asks, 1)
  // Asked: the clip says it waits, in words, and Discard drops the ask.
  const asked = bindingOf({...port(read(REAL.score)).port, compose: composing({state: 'asked', asked: ASKED, others: 0})})
  assert.equal(JSON.parse(asked.values['gen.status']).state, 'asked')
  assert.match(draw(asked), /Asked: Compose asked central:position:project:O-I:anima-4/)
  await asked.write([{key: 'gen.discard', value: 1}])
  assert.equal(acts.discards, 1)
  // Answered and admitted: the units it names stand dashed, the heads it gives as picks, until Accept.
  const taken = {state: 'answered', returnRef: 'central:return:project:O-I:compose-3', revision: 'r', status: 'pending', proposal: PROPOSAL, later: 1}
  const admitted = bindingOf({...port(read(REAL.score)).port, compose: composing({state: 'answered', asked: ASKED, answer: taken, word: 'admitted', why: 'Anima\'s proposal: 2 edits; QL admits the heads it gives, and Factory admits it (factory workflow edit --check). Accept writes it into the song.'})})
  const units = JSON.parse(admitted.values.score).units
  assert.deepEqual(units.filter(unit => unit.proposed).map(unit => unit.key), ['eros-verify', 'mythos-debug'])
  assert.deepEqual(units.find(unit => unit.key === 'eros-verify').picks, {CS: 'CS3'})
  assert.deepEqual(JSON.parse(admitted.values['gen.status']), {state: 'admitted',
    why: 'Anima\'s proposal: 2 edits; QL admits the heads it gives, and Factory admits it (factory workflow edit --check). Accept writes it into the song. (1 later proposal answering the same ask is not taken)'})
  await admitted.write([{key: 'gen.accept', value: 1}])
  assert.equal(acts.accepts, 1, 'Accept is Compose\'s, while its tool is chosen')
  // The real hook's Accept refuses until the owners' word is in, and before any answer.
  setViewHold(HOLD, 'gen.tool', 'heads')
  await assert.rejects(admitted.write([{key: 'gen.accept', value: 1}]), /Nothing proposed waits/, 'Fill heads keeps its own Accept')
  assert.equal(acts.accepts, 1)
})
