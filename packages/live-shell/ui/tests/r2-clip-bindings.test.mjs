// T-REALIGN R2: a clip binding per mode maps its owner's reading onto its designed clip's keys (inhabitants/catalogue/clips/*.tsx),
// leaves absent what the owner does not report, takes no Launch tab where the clip is placed, and refuses a change no owner op carries
// in the owner's own words. Channel: FIXTURE readings shaped as each owner gives them (agentRunModel tracks and temporal events, a
// Live set document, the World cut's spine, Central's file payloads, a retained native editor reading); production modules in
// memory through the transpiling loader (detail-host.test.mjs's).
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

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

const {clipShape, wiredKey, resetViewHolds, viewHoldsOf, READING} = await import('../src/frame/detail/clipBinding.ts')
const {loadClip, CLIP_MODES} = await import('../src/inhabitants/catalogue/clips/index.ts')
const factory = await import('../src/agent/clipBinding.ts')
const {TASK_SEAMS} = await import('../src/agent/devices/taskBindings.ts')
const {SETTINGS_WHY} = await import('../src/agent/sessionSettings.ts')
const {trackKey} = await import('../src/agent/agentRunModel.ts')
const live = await import('../src/live/clipBinding.ts')
const techne = await import('../src/techne/clipBinding.ts')
const central = await import('../src/central/clipBinding.ts')
const {HIGHLIGHT_WIRING, BEINGS_WIRING} = await import('../src/central/devices/pageBindings.ts')
const expressions = await import('../src/components/expressions/clip/clipBinding.ts')

const tabsOf = design => ({panel: design.panel.map(tab => tab.id), tools: design.tools.map(tab => tab.id), editor: design.editor.map(tab => tab.id)})
const parse = (values, key) => JSON.parse(String(values[key]))

// ---------------------------------------------------------------------------------------------------------------- Factory

const T = (h, m) => Date.UTC(2026, 9, 8, h, m)
const track = {sessionRef: 'ses-214', purpose: 'correlate occurrences', agentRef: 'agent:fizz', agentName: 'Fizz', agentAccepted: true,
  spaceRef: 'space:lead', spaceLabel: null, depth: 0, parentRef: null, group: false, memberRefs: [], needle: null, telemetryOn: false,
  budget: {used: 2, max: 12}, disclosure: null, tasks: [
    // How it stands is Factory's reading (O-I #741, agent/taskActivity.ts): the State the Clip panel draws is Factory's word.
    {n: 1, title: 'correlate occurrences', state: 'running', startUnixMs: T(13, 41), lastActivityUnixMs: T(14, 24), softStop: false, disclosure: null,
      standing: {word: 'running', why: 'Checked in 4 s ago, within the 90 s bound.', retry: false, decidedBy: 'window-sampling', closure: null}},
    {n: 2, title: null, state: 'unknown', startUnixMs: null, lastActivityUnixMs: null, softStop: true, disclosure: null}]}
const other = {...track, sessionRef: 'ses-300', purpose: 'widget tests', tasks: []}
const events = [
  {subject_ref: 'ses-214', kind: 'tool.read', summary: 'read widgets/handoff.tsx', instant_unix_ms: T(13, 42)},
  {subject_ref: 'ses-214', kind: 'tool.bash', summary: 'pnpm test bridge', instant_unix_ms: T(13, 50)},
  {subject_ref: 'ses-214', kind: 'tool.read', summary: 'before the task began', instant_unix_ms: T(13, 30)},
  {subject_ref: 'ses-999', kind: 'tool.read', summary: 'another session', instant_unix_ms: T(13, 45)},
  {subject_ref: 'ses-214', kind: 'tool.edit', summary: 'no instant: no place on the task\'s time'},
]
const taskRef = `${trackKey(track)}#task/1`

// REPLACED (#787): "…and the hand-off sessions" — Hand off to is retired (§19.1: the task is dragged onto another session's track), so the
// clip offers no session list.
test('Factory: the task THE selection names maps onto clip:factory — its name, state, turns and log inside its span', () => {
  resetViewHolds()
  const binding = factory.factoryClipBinding({ref: taskRef, tracks: [track, other], events, colour: 'var(--fizz)'})
  assert.equal(binding.mode, 'factory')
  assert.equal(binding.ref, taskRef)
  const v = binding.values
  assert.equal(v.name, 'correlate occurrences'); assert.equal(v.state, 'running'); assert.equal(v.colour, 'var(--fizz)')
  assert.equal(v['turns.used'], 2); assert.equal(v['turns.cap'], 12)
  assert.equal(v.elapsed, (T(14, 24) - T(13, 41)) / 1000)
  const log = parse(v, 'log')
  assert.deepEqual(log.map(row => [row.at, row.tool, row.text]), [[60, 'tool.read', 'read widgets/handoff.tsx'], [540, 'tool.bash', 'pnpm test bridge']],
    'the session\'s own events inside the task\'s span, at seconds from its start, each the owner\'s kind and words')
  assert.equal('sessions' in v, false, 'Hand off to is retired: no session list')
  for (const key of ['launch', 'then', 'loop', 'loop.cap', 'repeat.levels', 'quantize', 'style.register', 'style.form', 'env.agent.effort', 'env.agent.autonomy', 'active'])
    assert.equal(key in v, false, `${key}: no owner reports it, so it reaches the view absent`)
  assert.equal(v['view.panel'], 'launch', 'a running task opens on its Launch tab beside the log, as the manual puts it first')
  assert.equal(factory.factoryClipBinding({ref: 'nothing:here', tracks: [track], events}), null, 'a selection that names no session names no clip')
  assert.equal(factory.factoryClipBinding({ref: trackKey(track), tracks: [track], events}).ref, taskRef, 'a session track opens its first task')
})

test('Factory: where the session\'s settings are not read, every per-task setting stands disabled saying so, and a refused change keeps it', async () => {
  const binding = factory.factoryClipBinding({ref: taskRef, tracks: [track], events: null})
  // REPLACED (#787): Hand off to is retired; Loop and what a Repeat varies are the session's settings now.
  for (const key of ['launch', 'then', 'loop', 'loop.until', 'repeat.variable', 'quantize', 'env.agent.effort', 'env.agent.autonomy', 'style.register', 'name']) {
    assert.equal(binding.standing[key]?.disabled, SETTINGS_WHY.notHere, `${key} stands disabled saying why`)
    await assert.rejects(binding.write([{key, value: 'x'}]), {message: SETTINGS_WHY.notHere})
  }
  await assert.rejects(binding.write([{key: 'state', value: 'done'}]), {message: READING('state')}, 'a reading is never written')
  assert.equal(binding.writes('state'), false)
  assert.equal(binding.values.log, undefined, 'no sessions provider: the log is not read, so it is absent')
})

test('Factory: a setting writes through its seam with the session\'s settings (factory-session-settings.test.mjs drives the owner)', async () => {
  const was = TASK_SEAMS.launch
  const sent = []
  TASK_SEAMS.launch = {send: async (task, value, context) => { sent.push([task, value, context.project]) }}
  try {
    const context = {transport: {kind: 'unavailable', reason: 'test'}, project: 'O-I', settings: {schema: 'aikit.encounter-session-settings/v1', agent_session: 'ses-214',
      revision: null, track: {telemetry: true, solo: false, set: []}, task: {task_ref: 'task:t', name: 'correlate occurrences', launch: 'trigger', then: 'next', quantize: 'global',
        loop: false, loop_until: 'done', loop_cap: null, repeat_variable: 'condition', repeat_levels: [], repeat_repeats: 3, repeat_stop: 'done',
        envelope_mode: 'automation', envelope_linked: true, effort: [], autonomy: [], register: 'plain', form: 'technical', active: true, colour: null, set: []},
      previous_task: null, standing: 's'}}
    const binding = factory.factoryClipBinding({ref: taskRef, tracks: [track], events: null, settings: context})
    assert.equal(binding.standing.launch, undefined, 'no longer disabled')
    // REPLACED (#787): the clip presses a launch mode (Gate) and the seam carries it to the owner as it is, AIKit's word being the manual's
    // (factory-clip-owner-words.test.mjs).
    await binding.write([{key: 'launch', value: 'gate'}])
    assert.deepEqual(sent, [[{sessionRef: 'ses-214', n: 1}, 'gate', 'O-I']])
  } finally { TASK_SEAMS.launch = was }
})

test('Factory: the view\'s own keys go to the clip\'s view holds, never to an owner', () => {
  resetViewHolds()
  const binding = factory.factoryClipBinding({ref: taskRef, tracks: [track], events})
  binding.local.fold(false)
  binding.local['view.editor']('envelopes')
  assert.deepEqual(viewHoldsOf(binding.id), {fold: false, 'view.editor': 'envelopes'})
  const again = factory.factoryClipBinding({ref: taskRef, tracks: [track], events})
  assert.equal(again.values.fold, false); assert.equal(again.values['view.editor'], 'envelopes', 'the detail area and the expanded view show the same tabs')
  resetViewHolds()
})

test('Factory on Arrangement view\'s ruler: no Launch tab, as in Live', async () => {
  const design = await loadClip('factory')
  const binding = factory.factoryClipBinding({ref: taskRef, tracks: [track], events: null, placed: true})
  assert.equal(binding.placed, true)
  // REPLACED (lane W1-Factory): the design gained the Intent panel (§19.1 "A third tab, Intent"); the ruler still drops only Launch.
  // REPLACED (lane AH, O-I #741): the design gained the Plan panel (OpenRig's planning dial and wave, as Factory keeps them).
  assert.deepEqual(tabsOf(clipShape(design, binding)).panel, ['clip', 'intent', 'plan'])
  assert.deepEqual(tabsOf(clipShape(design, factory.factoryClipBinding({ref: taskRef, tracks: [track], events: null}))).panel, ['clip', 'launch', 'intent', 'plan'])
})

test('Factory\'s Intent panel: every key absent with the read it waits for, Intent and a new condition refused with the write they lack (§19.1)', async () => {
  const binding = factory.factoryClipBinding({ref: taskRef, tracks: [track], events: null})
  for (const key of ['intent', 'intent.source', 'criteria', 'constraints', 'context']) {
    assert.equal(binding.values[key], undefined, `${key}: no reading`)
    assert.match(factory.INTENT_ABSENT[key], /missing op: /, key)
  }
  assert.match(factory.INTENT_ABSENT.criteria, /project-development ledger \(bounded intent, success criteria, PraxisCondition\)/)
  assert.match(factory.INTENT_ABSENT.intent, /factory development field read/)
  for (const [key, op] of [['intent', /factory development field set/], ['criterion', /success-condition write/]]) {
    assert.match(binding.standing[key].disabled, op, `${key} stands disabled with its operation`)
    await assert.rejects(() => binding.write([{key, value: 'x'}]), op)
  }
})

// ---------------------------------------------------------------------------------------------------------------- Live

const liveSet = {path: '/sets/demo.als', tempo_bpm: 120, scene_count: 1, arrangement_clips: 1,
  tracks: [{kind: 'midi', name: 'Pad', devices: []}, {kind: 'audio', name: 'Drums', devices: []}]}
const liveDoc = {path: '/sets/demo.als', tempo: 120, scenes: 1, tracks: [
  {kind: 'midi', name: 'Pad', devices: [], arrangementClips: [{name: 'Intro', kind: 'midi', start: 4, end: 12}], sessionSlots: {'0': 'A'}},
  {kind: 'audio', name: 'Drums', devices: [], arrangementClips: [], sessionSlots: {'0': 'Loop'}}]}
const dorian = {state: 'in-force', line: 'D Dorian', selection: {root: 2, scale: {kind: 'lens-cf', key: 'k', label: 'Dorian', lens: 'L', anchorBasis: 'A', mode: 'Dorian', pitches: [2, 4, 5, 7, 9, 11, 0], tuning: null, provenance: {}}}}

test('Live: an arrangement clip is placed (no Launch tab), carries the set\'s mode in force, and its undisclosed notes stay absent', async () => {
  const design = await loadClip('live')
  const binding = live.liveClipBinding({set: liveSet, document: liveDoc, selection: {track: 0, scene: null, clip: 0}, mode: dorian, colour: '#79b6ce'})
  assert.equal(binding.values.name, 'Intro'); assert.equal(binding.values.colour, '#79b6ce')
  assert.equal(binding.values['set.root'], 2); assert.equal(binding.values['set.mode'], 'dorian')
  for (const key of ['notes', 'start', 'end', 'loop', 'scale', 'root', 'mode', 'follow', 'launch', 'quantize']) assert.equal(key in binding.values, false, `${key} is not disclosed`)
  assert.equal(binding.placed, true)
  assert.deepEqual(tabsOf(clipShape(design, binding)).panel, ['clip'], 'A clip laid on Arrangement view\'s ruler is not launched')
  const slot = live.liveClipBinding({set: liveSet, document: liveDoc, selection: {track: 0, scene: 0}, mode: dorian})
  assert.equal(slot.values.name, 'A'); assert.equal(slot.placed, undefined)
  assert.deepEqual(tabsOf(clipShape(design, slot)), {panel: ['clip', 'launch'], tools: ['pitch', 'transform', 'generate'], editor: ['notes', 'envelopes', 'mpe']})
})

test('Live: an audio clip lacks Notes, MPE and the MIDI tools; a source scale names no mode of the seven; a clip not read whole refuses its writes saying so', async () => {
  const design = await loadClip('live')
  const audio = live.liveClipBinding({set: liveSet, document: liveDoc, selection: {track: 1, scene: 0}, mode: dorian})
  assert.deepEqual(tabsOf(clipShape(design, audio)), {panel: ['clip', 'launch'], tools: [], editor: ['envelopes']})
  const maqam = {...dorian, selection: {root: 9, scale: {kind: 'source', key: 'm', label: 'Rast', family: 'maqam', pitches: null, tuning: null, provenance: {}}}}
  assert.deepEqual(live.setModeValues(maqam), {'set.root': 9})
  assert.deepEqual(live.setModeValues({state: 'waiting', selection: null, line: 'reading'}), {})
  // Unread whole, every setting and tool says so (live-set-ops.test.mjs drives the clip read whole).
  await assert.rejects(audio.write([{key: 'loop', value: true}]), /The clip is not read whole yet/)
  await assert.rejects(audio.write([{key: 'transform.press', value: 1}]), /The clip is not read whole yet/)
  assert.equal(live.liveClipBinding({set: liveSet, document: liveDoc, selection: {track: 0, scene: null}, mode: dorian}), null)
})

// ---------------------------------------------------------------------------------------------------------------- Technē

const ruler = {label: at => `${at} CE`}
test('Technē: a walk\'s stop maps onto clip:techne\'s stop — its name, its moment on the ruler, and the next stop it follows to', () => {
  const stop = {ref: 'techne:stop:w1:2', clip: {id: 'techne:stop:w1:2', trackId: 't', columnId: 'techne:row:stop:w1:2', label: 'Nicaea', at: {start: 325}, launch: {follow: 'stop 3/4 · Constantinople'}},
    track: {id: 't', color: 'var(--w-ariadne)'}, set: {ruler}}
  assert.deepEqual(techne.walkStopValues(stop), {kind: 'stop', name: 'Nicaea', colour: 'var(--w-ariadne)', 'stop.moment': '325 CE', follow: 'next'})
  const last = {...stop, clip: {...stop.clip, launch: undefined}}
  assert.equal('follow' in techne.walkStopValues(last), false, 'the last stop follows to nothing the owner names')
  assert.equal(techne.walkStopValues({...stop, clip: {...stop.clip, columnId: 'techne:row:event:x'}}), null)
  for (const key of ['stop.place', 'stop.thing', 'stop.scene', 'stop.narration', 'arrival']) assert.equal(key in techne.walkStopValues(stop), false, `${key} is absent`)
})

test('Technē: the World cut\'s event carries the owner\'s verbatim standing only, its evidence as relations and its bounded whole', () => {
  const instant = Date.UTC(2026, 9, 8, 9, 30)
  const world = {spine: {occasion: () => ({basis: {ref: 'ev1', summary: 'Council at Nicaea', instantUnixMs: instant, civilDayRef: '2026-10-08', evidenceRefs: ['wiki:node:creed', 'wiki:node:arius']},
    admission: {admitted: true, disclosure: 'in the current reading'}}), subscribe: () => () => {}},
    source: {events: [{subject_ref: 'ev1', instant_unix_ms: instant, kind: 'council', stream: 'reading', stream_position: '12'}]}}
  const v = techne.worldEventValues(world, {ref: 'clip:ev1', clip: {id: 'clip:ev1', trackId: 't', columnId: 'c', label: 'x', at: {start: 1, end: 3}}, track: {color: 'var(--sel)'}, set: {ruler}})
  assert.equal(v.kind, 'event'); assert.equal(v.name, 'Council at Nicaea'); assert.equal(v['event.kind'], 'council')
  assert.equal(v.date, '2026-10-08 09:30 UTC · 2026-10-08'); assert.equal(v.span, '1 CE – 3 CE'); assert.equal(v['source.ref'], 'reading · 12')
  assert.equal(v['source.admitted'], 'Admitted · in the current reading')
  assert.equal('standing' in v, false, 'the World cut\'s reading discloses no standing: never upgraded by a class')
  assert.deepEqual(parse(v, 'relations').map(row => [row.type, row.to, row.standing]), [['evidence', 'wiki:node:creed', '—'], ['evidence', 'wiki:node:arius', '—']])
  assert.equal(parse(v, 'constellation').nodes.length, 3)
  for (const key of ['place', 'parent', 'source.revision', 'material']) assert.equal(key in v, false, `${key} is absent`)
  assert.equal(techne.designStanding('Claim', 'sourced'), 'claim'); assert.equal(techne.designStanding(null, 'disputed'), 'dispute')
  assert.equal(techne.designStanding('attested', 'sourced'), undefined, 'a word that is none of the six stays the owner\'s, absent here')
})

test('Technē: a World subject is placed, its Scenes as the material it gathers, the door\'s refusal in its words', () => {
  const subject = {kind: 'place', ref: 'place:chartres', title: 'Chartres'}
  const scene = {registerKey: 'sacred', scene_ref: 'scene:1', scene_title: 'Labyrinth'}
  const opening = {state: 'refused', opened: scene, scenes: [scene, {registerKey: 'sacred', scene_ref: 'scene:2', scene_title: 'Rose window'}], reason: 'the stage did not open it'}
  const v = techne.worldSubjectValues(subject, opening)
  assert.equal(v['source.admitted'], 'the stage did not open it'); assert.equal(v['source.ref'], 'place:chartres')
  assert.deepEqual(parse(v, 'material').map(row => row.text), ['Labyrinth', 'Rose window'])
  const binding = techne.techneClipBinding({worldCut: false, world: null, worldSubject: subject, opening, selected: {ref: null, clip: null, track: null, set: null}})
  assert.equal(binding.placed, true); assert.equal(binding.values['view.editor'], 'material')
})

// ---------------------------------------------------------------------------------------------------------------- Central

const island = doc => `<!doctype html><html><body><main></main><script type="application/json" id="ql-doc">${JSON.stringify(doc)}</script></body></html>`

test('Central: a page\'s own text as paragraphs, its marks kept; a Flow\'s participants, entries and notes; a Being\'s ties and its page', () => {
  assert.deepEqual(central.pageOfText('# Hildegard\n\nShe wrote ==what she saw== down.\n\n## 1. The music\n\n> O viriditas').map(p => p.kind), ['h1', 'p', 'h2', 'quote'])
  assert.deepEqual(central.pageOfText('She wrote ==what she saw== down.')[0].parts, [{text: 'She wrote '}, {text: 'what she saw', mark: 'yellow'}, {text: ' down.'}])
  const note = central.fileValues('# Note\n\nWords.', 'note')
  assert.equal(note.kind, 'note'); assert.equal(note.source, '# Note\n\nWords.'); assert.equal(parse(note, 'page').length, 2)

  const flow = central.fileValues(island({meta: {title: 'Closing the day', template: 'ql-dialogue-flow v0.4', participants: [{initial: 'F', name: 'Frank', kind: 'person'}, {initial: 'Fz', name: 'Fizz', kind: 'agent'}]},
    entries: [{id: 'e1', author: 'F', html: '<p>Can the Day close itself?</p>'}, {id: 'e2', author: 'Fz', html: '<p>It <mark>can</mark>.</p>', relations: [{type: 'reply', entryId: 'e1'}]}],
    notes: [{id: 'n1', entryId: 'e2', anchor: 'It can', text: 'Which automation?', timing: 'after'}]}), 'note')
  assert.equal(flow.kind, 'flow'); assert.equal(flow.name, 'Closing the day'); assert.equal(flow.template, 'ql-dialogue-flow v0.4')
  assert.deepEqual(parse(flow, 'participants').map(p => [p.name, p.kind]), [['Frank', 'person'], ['Fizz', 'agent']])
  assert.deepEqual(parse(flow, 'entries').map(e => [e.who, e.rel ?? null, e.depth]), [['Frank', null, 0], ['Fizz', 'Reply', 1]])
  assert.deepEqual(parse(flow, 'notes'), [{id: 'n1', anchor: 'entry 2 · "It can"', text: 'Which automation?', timing: 'after'}])

  const being = central.fileValues(island({profile: 'oi.page/v1', meta: {title: 'Hildegard of Bingen', family: 'beings', template: 'oi.template/beings', templateVersion: '0.1.0'},
    bindings: {worldRef: 'world:yours', subjectRef: 'being:hildegard', categories: ['C2', 'C3'], expressionRef: null, sources: [{ref: 'scivias', revision: 'r3'}]},
    appearance: {layout: 'portrait', tone: 'paper'}, page: {subtitle: 'Abbess', introduction: 'She wrote.', sections: [{id: 's1', heading: 'The music', text: 'Wide leaps.'}], links: []}}), 'note')
  assert.equal(being.kind, 'being'); assert.equal(being.office, '2,3'); assert.equal(being.template, 'Beings @ 0.1.0'); assert.equal(being.world, 'world:yours')
  assert.deepEqual(parse(being, 'sources'), ['scivias @ r3'])
  assert.equal('expression' in being, false, 'a null expression binding is absent, never an empty string')
  assert.deepEqual(parse(being, 'page').map(p => p.kind), ['h1', 'intro', 'p', 'h2', 'p'])
})

test('Central: a page is placed (no Launch tab); its tools refuse in the page family\'s words; the save outcome is the reached pane\'s, for this file only', async () => {
  const design = await loadClip('central')
  const location = {schema: 'central.path-ref/v1', ref: 'central:path:control:user/beings/hildegard.html', root: 'control', path: 'user/beings/hildegard.html'}
  const reading = {ref: 'subject:note:user/beings/hildegard.html', values: {kind: 'being', name: 'Hildegard'}, location}
  const binding = central.centralClipBinding(reading, {colour: 'var(--honey)', reached: {key: 'k', form: 'Flow', title: 't', state: 'saved', location, outcome: 'stale'}})
  assert.equal(binding.placed, true); assert.equal(binding.values.save, 'stale'); assert.equal(binding.values.colour, 'var(--honey)')
  const shownPanel = clipShape(design, binding).panel.filter(tab => !tab.shows || tab.shows(binding.values)).map(tab => tab.id)
  assert.deepEqual(shownPanel, ['clip', 'ties'], 'a Being: Clip and its ties, never Launch (the kit leaves out a tab the clip does not show)')
  const elsewhere = central.centralClipBinding(reading, {reached: {key: 'k', form: 'Flow', title: 't', state: 'saved', location: {...location, ref: 'central:path:other'}, outcome: 'saved'}})
  assert.equal('save' in elsewhere.values, false, 'another page\'s save is not this page\'s')
  assert.equal(binding.standing['hl.colour'].disabled, HIGHLIGHT_WIRING.refused.colour)
  await assert.rejects(binding.write([{key: 'act.topacket', value: 1}]), {message: HIGHLIGHT_WIRING.refused.toPacket})
  assert.equal(typeof binding.local['notes.order'], 'function', 'the order of the notes is the view\'s')
  assert.equal(central.centralSubjectName({kind: 'day', path: 'Control/agents/now/day/2026-10-08.md'}).startsWith('Day · '), true)
})

test('Central: a page\'s own fields are written through the page owner from Clip view; the passage acts mark and note the selection; unsaved edits refuse', async () => {
  const location = {schema: 'central.path-ref/v1', ref: 'central:path:control:user/flows/flow-1.html', root: 'control', path: 'user/flows/flow-1.html'}
  const island = {meta: {title: 'Untitled exchange'}, entries: [{id: 'e1', author: 'F', html: '<p>Hello</p>'}, {id: 'e2', author: 'F', html: '<p><mark>Marked</mark></p>'}]}
  const reading = {ref: 'subject:note:user/flows/flow-1.html#w', values: {kind: 'flow', name: 'Untitled exchange'}, location, island}
  const writes = []
  const write = async (field, value) => { writes.push([field, value]) }
  const flow = central.centralClipBinding(reading, {write})
  assert.equal(flow.writes('name'), true); assert.equal(flow.standing.name, undefined, 'the name is no longer held refused')
  await flow.write([{key: 'name', value: 'Morning exchange'}, {key: 'container', value: 'inquiry'}, {key: 'opensAs', value: 'journal'}, {key: 'seats', value: false}])
  assert.deepEqual(writes, [['title', 'Morning exchange'], ['container', 'inquiry'], ['launch', {opensAs: 'journal'}], ['launch', {seats: false}]])
  await assert.rejects(flow.write([{key: 'act.highlight', value: 1}]), /Select a paragraph or an entry first/)
  flow.local.selected('e1'); flow.local['hl.colour']('green')
  await flow.write([{key: 'act.highlight', value: 1}])
  flow.local.selected('e2')
  await flow.write([{key: 'act.highlight', value: 2}, {key: 'act.note', value: 3}])
  assert.deepEqual(writes.slice(4), [['highlight.add', {entry: 'e1', colour: 'green'}], ['highlight.remove', {entry: 'e2'}], ['note.add', {entry: 'e2', timing: 'during', text: ''}]],
    'Highlight on a marked entry takes its marks away (choose it again to remove it)')
  await assert.rejects(flow.write([{key: 'office', value: '1'}]), {message: BEINGS_WIRING.refused.o1}, 'a Flow takes no office')
  const held = central.centralClipBinding(reading, {write, reached: {key: 'k', form: 'Flow', title: 't', state: 'edited', location, dirty: true}})
  const before = writes.length
  await assert.rejects(held.write([{key: 'name', value: 'Other'}]), /holds edits its owner does not/)
  assert.equal(writes.length, before, 'nothing reaches the owner while the page holds unsaved edits')

  const pageIsland = {profile: 'oi.page/v1', meta: {title: 'Hildegard', family: 'beings'}, bindings: {categories: ['C2']}, page: {sections: [{id: 's1', heading: 'Music', text: 'Wide leaps.'}]},
    highlights: [{id: 'h1', part: 's1', passage: null, colour: 'blue'}]}
  const being = central.centralClipBinding({ref: 'subject:note:user/flows/beings-1.html#w', values: {kind: 'being', name: 'Hildegard'}, location, island: pageIsland}, {write})
  being.local.selected('s1:h')
  await being.write([{key: 'being', value: 'agent'}, {key: 'office', value: '1,3'}, {key: 'tone', value: 'ink'}, {key: 'act.highlight', value: 1}])
  assert.deepEqual(writes.slice(before), [['kind', 'agent'], ['office', ['C1', 'C3']], ['tone', 'ink'], ['highlight.remove', {part: 's1'}]],
    'a section\'s heading stands for its section; its whole-part highlight is taken away')
  const thing = central.centralClipBinding({ref: 'subject:note:user/flows/things-1.html#w', values: {kind: 'thing', name: 'Lyre'}, location, island: {...pageIsland, meta: {family: 'things'}}}, {write})
  await assert.rejects(thing.write([{key: 'being', value: 'agent'}]), {message: BEINGS_WIRING.refused.kind}, 'a Thing is no kind of being')
  const unwritten = central.centralClipBinding(reading, {})
  await assert.rejects(unwritten.write([{key: 'name', value: 'X'}]), {message: central.CENTRAL_WIRING.refused.name})
})

test('Central: a page\'s own colour, launch, kind of being and highlights read back into Clip view', () => {
  const values = central.fileValues(island({profile: 'oi.page/v1', meta: {title: 'Hildegard', family: 'beings', colour: 'var(--honey)', launch: {opensAs: 'reading'}},
    bindings: {kind: 'person', categories: ['C2'], sources: []}, appearance: {layout: 'portrait', tone: 'paper'},
    page: {subtitle: '', introduction: 'She wrote what she saw.', sections: []}, highlights: [{id: 'h1', part: 'introduction', passage: 'what she saw', colour: 'green'}]}), 'note')
  assert.equal(values.colour, 'var(--honey)'); assert.equal(values.opensAs, 'reading'); assert.equal(values.being, 'person')
  assert.deepEqual(parse(values, 'page').find(p => p.id === 'introduction').parts, [{text: 'She wrote '}, {text: 'what she saw', mark: 'green'}, {text: '.'}])
  const binding = central.centralClipBinding({ref: 'r', values}, {colour: 'var(--sel)'})
  assert.equal(binding.values.colour, 'var(--honey)', 'the page\'s own colour stands over its track\'s')
})

// ---------------------------------------------------------------------------------------------------------------- Expressions

const entity = (id, name, x, extra = {}) => ({id, name, kind: 'formation', position: {x, y: 0.5, z: 0}, size: {x: 0.65, y: 0.86}, rotation: 0, shape: 'ring', text: '', share: 1,
  tint: '#ffffff', tintWeight: 0, locked: false, force: {kind: 'attract', strength: 2, radius: 200, spin: 0}, station: null,
  sequence: {enabled: true, clock: 'seconds', steps: [{id: 's1', text: 'seed', shape: 'ring', hold: 2, transition: 1, position: null}]}, ...extra})
const moonSound = {enabled: true, carry: {kind: 'mode', ref: 'maqam/00'}, gain: 0.2, attack: 0.1, release: 0.8}
const nativeReading = {
  basis: {expression_ref: 'expr:1', scene_ref: 'scene:a', revision: 'r1'},
  scene: {id: 'a', name: 'Dawn', duration: 8, transition: 2, entities: [entity('sun', 'Sun', 0), entity('moon', 'Moon', -1, {sound: moonSound})],
    automation: [{id: 'l1', target: 'field.viscosity', type: 'lfo', wave: 'sine', min: 0.2, max: 0.8, rate: 0.25, phase: 0, blend: 'replace', duration: 4, delay: 0, loop: 'loop', enabled: true, firedAt: null}],
    text: [{id: 't1', visible: true, kicker: 'A moment', title: 'Dawn', italic: '', body: '', x: 0.07, y: 0.2, width: 240, size: 38, align: 'left'}],
    composition: {layout: 'ring', plane: 'XY', focus: 'parallel', focusDuration: 1, carryTint: false, carryStation: false, frequencyDriver: 'manual'}, morph: {dwell: 0.5}},
  scenes: {basis: {expression_ref: 'expr:1', revision: 'r1'}, scenes: [{scene_ref: 'scene:a', title: 'Dawn swell', working: {duration: 9, transition: 2}}, {scene_ref: 'scene:b', title: 'Night'}]},
  playback: {scene_ref: 'scene:a', intent_epoch: 3}, nativeSelection: {scene_ref: 'scene:a', entity_ref: null},
  nativeScene: {scene_ref: 'scene:a', body: null, triggers: [{trigger_ref: 'to-night', occasion: 'scene_leave', target: {kind: 'navigate', scene_ref: 'scene:b'}}]},
  entityOccurrences: {}, selection: {entity_ids: ['sun'], step_id: null}, history: {canUndo: false, canRedo: false}, standing: {dirty: false, pending: false, notice: null},
  chosenControls: {entries: []}, devices: []}

test('Expressions: the presented scene maps onto clip:expressions — its pacing, body, Jump trigger, symbols, their own controls, automation and text', () => {
  const v = expressions.expressionsClipValues(nativeReading, 'var(--honey)')
  assert.equal(v.name, 'Dawn swell'); assert.equal(v.duration, 9); assert.equal(v.transition, 2); assert.equal(v.start, 0, 'Scene.entryOffset: absent is 0, the owner\'s law')
  assert.equal(v.carrier, 'engine composition', 'no body: the live engine composition, the owner\'s default')
  assert.equal(v.follow, 'jump'); assert.equal(v.jumpTo, 'scene:b', '"Scene leaves → Jump to a scene" is Live\'s follow action Jump')
  assert.deepEqual(parse(v, 'triggers')[0], {name: 'to-night', occasion: 'Scene leaves', target: 'Jump to a scene', placement: '', operation: ''})
  assert.deepEqual(parse(v, 'scenes'), [{id: 'scene:a', name: 'Dawn swell'}, {id: 'scene:b', name: 'Night'}])
  assert.deepEqual(parse(v, 'symbols').map(s => s.name), ['Sun', 'Moon']); assert.equal(v.symbol, 'sun')
  const objects = parse(v, 'objects')
  assert.equal(objects.sun.formation.x, 0); assert.equal(objects.sun.force.kind, 'attract'); assert.equal(objects.sun.sound.voice, false)
  assert.equal(objects.moon.sound.voice, true); assert.equal(objects.moon.sound.carry, 'mode:maqam/00')
  assert.deepEqual(Object.keys(objects.moon.sound).sort(), ['attack', 'carry', 'gain', 'release', 'voice'], 'a symbol\'s voice reports no frequency, follow, waveform or pan: it has none')
  assert.deepEqual(parse(v, 'lanes')[0], {id: 'l1', device: 'Field', target: 'field.viscosity', type: 'oscillator', wave: 'sine', rate: 0.25, phase: 0, min: 0.2, max: 0.8,
    blend: 'replace', duration: 4, delay: 0, loop: 'loop', enabled: true})
  assert.equal(parse(v, 'layers')[0].heading, 'A moment')
  for (const key of ['signature', 'plate']) assert.equal(key in v, false, `${key} is not reported`)
  // The scene as a clip: unset, its settings stand at the scene's defaults (model.ts SceneClip).
  assert.deepEqual([v.active, v.locked, v.quantize], [true, false, 'global'])
})

test('Expressions: an edit of a symbol\'s own controls is the owner\'s own change; Meaning is refused naming the change it needs', () => {
  const objects = parse(expressions.expressionsClipValues(nativeReading), 'objects')
  const moved = structuredClone(objects); moved.sun.formation.x = 1.5
  assert.deepEqual(expressions.objectChanges(nativeReading, moved), [{kind: 'parameter', target: 'entity:sun:x', value: 1.5}])
  const kind = structuredClone(objects); kind.sun.force.kind = 'vortex'
  assert.deepEqual(expressions.objectChanges(nativeReading, kind), [{kind: 'force-mode', entity_id: 'sun', value: 'vortex'}])
  const voice = structuredClone(objects); voice.sun.sound.voice = true
  const [added] = expressions.objectChanges(nativeReading, voice)
  assert.equal(added.kind, 'entity-sound'); assert.equal(added.entity_id, 'sun'); assert.equal(added.sound.enabled, true)
  const carries = structuredClone(objects); carries.moon.sound.carry = 'name:shem'; carries.moon.sound.gain = 0.4
  const [carried, regained] = expressions.objectChanges(nativeReading, carries)
  assert.deepEqual(carried.sound.carry, {kind: 'name', ref: 'shem'}); assert.equal(carried.sound.gain, 0.2, 'each field is its own whole-sound change')
  assert.equal(regained.sound.gain, 0.4); assert.deepEqual(regained.sound.carry, {kind: 'mode', ref: 'maqam/00'})
  const none = structuredClone(objects); none.moon.sound.carry = ''
  assert.equal('carry' in expressions.objectChanges(nativeReading, none)[0].sound, false, 'None yet clears the carry')
  assert.throws(() => expressions.objectChanges(nativeReading, (() => { const x = structuredClone(objects); x.sun.sound.carry = 'mode:maqam/00'; return x })()), /no voice: turn Voice on first/)
  const meaning = structuredClone(objects); meaning.sun.meaning = {centre: 'heart'}
  assert.throws(() => expressions.objectChanges(nativeReading, meaning), /Meaning: the owner takes it as one entity-semantic change .*; Clip view does not compose it yet\./)
  const lanes = parse(expressions.expressionsClipValues(nativeReading), 'lanes'); lanes[0].rate = 0.5
  assert.deepEqual(expressions.laneChanges(nativeReading, lanes), [{kind: 'automation-set', lane_id: 'l1', values: {rate: 0.5}}])
  const layers = parse(expressions.expressionsClipValues(nativeReading), 'layers'); layers[0].heading = 'Another moment'
  assert.deepEqual(expressions.layerChanges(nativeReading, layers), [{kind: 'text-layer-set', layer_id: 't1', values: {kicker: 'Another moment'}}])
})

test('Expressions: a rename and the scene\'s clip settings go to the owner as scene edits on the captured basis; the owner\'s refusal comes back in its words', async () => {
  const sent = []
  const request = async operation => { sent.push(operation); return operation.operation === 'scene-edit' ? {ok: true, reading: nativeReading} : {ok: false, error: 'The owner refused: stale basis'} }
  const binding = expressions.expressionsClipBinding({reading: nativeReading, request})
  await binding.write([{key: 'name', value: 'Dawn chorus'}])
  assert.deepEqual(sent[0], {operation: 'scene-edit', basis: nativeReading.basis, intent_epoch: 3, native_selection: nativeReading.nativeSelection,
    intent: {operation: 'rename', scene_ref: 'scene:a', title: 'Dawn chorus'}})
  await assert.rejects(binding.write([{key: 'symbol', value: 'moon'}]), {message: 'The owner refused: stale basis'})
  // The scene's clip settings go as one scene edit, as a rename does; Global returns the setting to the scene's default.
  sent.length = 0
  await binding.write([{key: 'quantize', value: 'now'}, {key: 'quantize', value: 'global'}, {key: 'locked', value: true}])
  assert.deepEqual(sent.map(op => op.intent), [{operation: 'clip', scene_ref: 'scene:a', set: {quantize: 'now'}},
    {operation: 'clip', scene_ref: 'scene:a', set: {quantize: null}}, {operation: 'clip', scene_ref: 'scene:a', set: {locked: true}}])
  assert.equal(binding.values['ar.rule'], 'ring', 'Arrange opens on the scene\'s last applied rule'); assert.equal(binding.values['ar.plane'], 'XY')
  assert.equal(expressions.expressionsClipBinding({reading: null, request}), null)
})

// ---------------------------------------------------------------------------------------------------------------- every key wired

test('every key each mode\'s designed clip draws or sets is wired: a reading, a write, the view\'s, refused or absent', async () => {
  const wirings = {
    factory: factory.factoryWiring({sessionRef: 'ses-214', n: 1}), live: live.LIVE_WIRING, techne: techne.TECHNE_WIRING, central: central.CENTRAL_WIRING,
    expressions: expressions.expressionsWiring(nativeReading, null),
  }
  for (const mode of CLIP_MODES) {
    const design = await loadClip(mode)
    const keys = new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])
    const unwired = [...keys].filter(key => !wiredKey(wirings[mode], key))
    assert.deepEqual(unwired, [], `${mode}: every key of clip:${mode} is named by its binding`)
  }
})
