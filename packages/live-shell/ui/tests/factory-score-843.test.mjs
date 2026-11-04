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
  assert.match(check.why, /ql vak compose/, 'QL\'s word on each unit names the operation it waits for')
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
  team_space: 'ql.vak-team-space/v1', subject: {key: 'eros-verify'}, chosen: {}, open: ['vak-cpf', 'vak-ct', 'vak-cp', 'vak-cf', 'vak-cfp', 'vak-cs', 'vak-direction'],
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
  // Compose is Anima's act as an agent: it stands refused, naming that no operation composes a song from an Intent.
  setViewHold(HOLD, 'gen.tool', 'compose')
  await assert.rejects(binding.write([{key: 'gen.press', value: 1}]), /Anima/)
  // The engine's word on a proposal: QL's per-unit word waits for its operation.
  assert.match(binding.standing['gen.status']?.disabled ?? clip.factoryWiring({sessionRef: 'ses-eros', n: 1}, null, null, null, picked.port).absent['gen.status'], /ql vak compose/)
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
