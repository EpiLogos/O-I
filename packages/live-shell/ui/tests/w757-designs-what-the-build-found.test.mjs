// O-I #757: the surviving catalogue designs brought up to what the build found they lack (T-COVERAGE §2.1, re-read against the
// reconciled manual ProjectCentral/docs/1-vision/dlw/DLW.md and the catalogue at 95d383f14). Each test names its row; each failed before
// its design or binding changed.
// Channels:
// - SCRIPTED: the catalogue designs rendered to static markup (react-dom/server); nothing here proves how a view looks.
// - OWNER-SHAPED: the bindings' own builders fed the shapes the owners give (QL's scene centres, tests/fixtures/ql-scene-centres-pr345-
//   2026-10-21.json; QL's ledger, tests/fixtures/ql-kernel-ledger-m3-rack-2026-10-21.json).
// No owner state is written.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

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
  if(url.includes('?raw')||url.endsWith('.html'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText.split('import.meta.env').join('({BASE_URL: "/"})')};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}
globalThis.getComputedStyle ??= () => ({getPropertyValue: () => ''})
globalThis.window ??= {matchMedia: () => ({matches: true, addEventListener() {}, removeEventListener() {}})}
await import('../src/inhabitants/catalogue/faces/vendor/creature-agency.js')
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')

const panel = name => import(`../src/inhabitants/catalogue/panels/${name}.tsx`).then(m => m.design)
const props = (design, v, extra = {}) => ({v, set: noop, nav: {}, page: extra.page ?? design.firstPage ?? '', setPage: noop, standing: extra.standing, owner: extra.owner})
/** One view of a design, on values laid over nothing (the owner's values alone). */
const draw = (design, view, v, extra) => renderToStaticMarkup(createElement(() => design[view](props(design, v, extra))))
const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const source = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ---------------------------------------------------------------- actuation__harness-model: the stage reads the binding's `stage`

test('the Agent\'s stage draws the run the kernel\'s events recorded (`stage`), and says so where no run event names the session', async () => {
  const agent = await panel('actuation__harness-model')
  // DLW §19.4 The stage: "The stage draws what the run's events say and nothing else".
  const declared = [agent.defaults, ...Object.values(agent.fixtures ?? {})].some(values => typeof values.stage === 'string')
  assert.ok(declared, 'the design declares `stage` with a fixture recording')
  const recording = [agent.defaults, ...Object.values(agent.fixtures ?? {})].map(values => values.stage).find(x => typeof x === 'string')
  assert.equal(JSON.parse(recording).source.transcript, 'oi.temporal-events/v1', 'the fixture is a recording of temporal events, as the binding makes one (runFaces.ts stageRecordingOf)')
  const thread = JSON.stringify([{who: 'you', kind: 'you', text: 'Type-check the roots.'}, {who: 'Flint', kind: 'tool', tool: 'Bash', text: 'tsc'}])
  const without = draw(agent, 'full', {...agent.defaults, stage: undefined, 'thread.thread': thread, thread, light: 'lit'})
  assert.match(without, /No run event names this session yet\./, 'no `stage`: the line, not a run made up from the thread')
  assert.doesNotMatch(without, /tree · annual/, 'no tree is drawn from the thread rows')
  const withStage = draw(agent, 'full', {...agent.defaults, stage: recording, light: 'lit'})
  assert.doesNotMatch(withStage, /No run event names this session yet/)
  assert.match(withStage, /tree · annual/, 'the stage draws the recording')
  assert.doesNotMatch(source('inhabitants/catalogue/panels/actuation__harness-model.tsx'), /recordingFromThread\(/, 'no recording is made up from the thread')
})

// ---------------------------------------------------------------- expressions__field: every control spreads its standing; never NaN

test('the Field\'s dials, toggles and radios draw the owner\'s reason, and an absent level draws unread, never NaN', async () => {
  const field = await panel('expressions__field')
  const why = {level: 'Level: no owner operation carries it here.', sound: 'No Expressions application is mounted.', keySource: 'No native Expression is open.', tempo: 'No physics device.'}
  const standing = Object.fromEntries(Object.entries(why).map(([key, disabled]) => [key, {disabled}]))
  const v = {...field.defaults, level: undefined}
  const whole = draw(field, 'whole', v, {standing})
  for (const [key, reason] of Object.entries(why)) assert.ok(whole.includes(escaped(reason)), `${key} draws the owner's reason`)
  const compact = draw(field, 'compact', v, {standing})
  assert.ok(compact.includes(escaped(why.level)), 'the macro Level too')
  for (const view of ['folded', 'compact', 'whole', 'full', 'widget']) assert.doesNotMatch(draw(field, view, v, {standing}), /NaN/, `${view}: no NaN`)
  const widget = draw(field, 'widget', v)
  assert.match(widget, /data-unread="true"|ref-meter[^>]*data-unread/, 'the meter draws unread while the level is absent')
})

// ---------------------------------------------------------------- expressions__resonance: the picture says which source drives the plate

test('Resonance draws what drives the plate (`drive`, the engine\'s resolved drive), and its binding names it absent with the missing reading', async () => {
  const resonance = await panel('expressions__resonance')
  // MAP B row, settled already: Torus stands first and is the default (DLW §20.14 "Frequency driver | Torus · Manual · Focus · Automation | Torus").
  assert.equal(resonance.defaults.frequencyDriver, 'torus')
  const drive = JSON.stringify({kind: 'torus', targetHz: 264, bound: true, keySource: 'torus', tonesHz: [264, 396]})
  const whole = draw(resonance, 'whole', {...resonance.defaults, drive}, {page: 'tuning'})
  assert.match(whole, /Torus drives · 264 Hz/, 'the plate says the torus drives it, at the tone the engine resolved')
  const silent = draw(resonance, 'full', {...resonance.defaults, drive: JSON.stringify({kind: 'torus', targetHz: 396, bound: false, silent: true, reason: 'The torus is not playing.'})})
  assert.match(silent, /Torus · silent/, 'a silent torus says so')
  assert.ok(silent.includes(escaped('The torus is not playing.')), 'with the engine\'s reason')
  const absent = draw(resonance, 'whole', {...resonance.defaults, drive: undefined}, {page: 'tuning'})
  assert.match(absent, /driven by —/, 'no reading of the drive: the dash, not the setting passed off as the reading')
  const fieldBinding = await import('../src/components/devices/fieldDesignBinding.ts')
  assert.match(fieldBinding.FIELD_ABSENT.resonance.drive ?? '', /observation/, 'the binding names `drive` absent: the editor reading carries no drive')
})

// ---------------------------------------------------------------- knowledge-graph__graph: Fit is the surface's own act

test('the graph\'s Fit presses the surface\'s own Fit (`fit`), not a zoom the design computes', async () => {
  const graph = await panel('knowledge-graph__graph')
  const whole = draw(graph, 'whole', graph.defaults, {page: 'display', standing: {fit: {disabled: 'The knowledge graph is not open.'}}})
  assert.ok(whole.includes(escaped('The knowledge graph is not open.')), 'Fit draws its own key\'s standing')
  assert.doesNotMatch(source('inhabitants/catalogue/panels/knowledge-graph__graph.tsx'), /function fitZoom/, 'no Fit zoom of the design\'s own')
  const bind = await import('../src/techne/devices/graphBinding.ts')
  let fitted = 0
  const surface = {filters: {scope: 'available', depth: 1, direction: 'both', shared: false, text: '', kinds: [], relations: [], unresolved: true, isolated: false,
    context: 'dim', labels: 'automatic', arrows: true, emphasis: []}, zoom: 1, selected: null, minimap: false, reading: null, loading: false, fit: () => { fitted++ }}
  await bind.graphWrite(surface, [{key: 'fit', value: true}], {setter: async () => { throw Error('no setter') }, patch: noop})
  assert.equal(fitted, 1, 'the surface\'s own fit() ran')
  assert.equal(bind.graphBinding(surface, null, {setter: noop, patch: noop}).writes('fit'), true)
  await assert.rejects(() => bind.graphWrite(null, [{key: 'fit', value: true}], {setter: noop, patch: noop}), new RegExp(bind.NOT_OPEN.slice(0, 30)))
})

// ---------------------------------------------------------------- quaternal-logic__chakra: QL's tattva, yantra and mantra

test('the Chakra colours by QL\'s tattva, and draws QL\'s yantra and mantra in its words', async () => {
  const chakra = await panel('quaternal-logic__chakra')
  const centres = await import('../src/inhabitants/ql/devices/qlCentres.ts')
  const real = json('./fixtures/ql-scene-centres-pr345-2026-10-21.json')
  const answer = {outcome: {result: 'owner_route_reading', data: {schema: 'ql.scene/v1', snapshot_ref: real.sky.snapshot_ref, epoch_utc: real.sky.epoch_utc, centres: real.centres}}}
  const read = centres.readCentresAnswer(answer, real.sky.snapshot_ref)
  assert.equal(read.ok, true)
  const v = {...chakra.defaults, centres: centres.centresValue(read.centres), 'detail.mantra': true, 'detail.yantra': true, colour: 'element'}
  const full = draw(chakra, 'full', v)
  assert.ok(full.includes(escaped('Four-petaled lotus with yellow square (earth symbol)')), 'QL\'s yantra, in its words')
  assert.ok(full.includes(escaped('LAM - earth element activation')), 'QL\'s mantra, in its words')
  assert.ok(full.includes('Prithvi Tattva'), 'QL\'s tattva name')
  assert.doesNotMatch(full, /petals<|\d+ petals/, 'no petal count: QL holds none')
  // Mūlādhāra's Prithvi stands in the earth colour; Ājñā carries no tattva and draws the value colour, never a made-up 'Beyond'.
  const earth = /fill="(#[0-9a-f]{6})"[^>]*stroke="\1"/i.exec(full)?.[1]
  assert.ok(earth, 'the Root\'s disc has a colour of its element')
  assert.notEqual(earth, 'var(--dp-value)')
  assert.doesNotMatch(full, /Beyond/, 'no element QL does not name')
  assert.doesNotMatch(JSON.stringify(chakra.defaults.centres), /petals|"element":"Earth"/, 'the sample is in the binding\'s shape (qlCentres.ts centresValue)')
})

// ---------------------------------------------------------------- widgets__wiki: an external link is its own kind

test('Wiki draws an external link as its own kind, not as a link that does not resolve', async () => {
  const wiki = await panel('widgets__wiki')
  const body = JSON.stringify({lines: ['See the guide at https://example.org/guide for the shape.'], links: [{line: 0, from: 17, to: 42, target: 'https://example.org/guide', state: 'external'}]})
  const v = {...wiki.defaults, body}
  for (const view of ['widget', 'full']) {
    const markup = draw(wiki, view, v)
    assert.match(markup, /leads out of the wiki/, `${view}: the external link says where it leads`)
    assert.doesNotMatch(markup, /This link does not resolve/, `${view}: an external link is not an unresolved one`)
  }
  assert.match(draw(wiki, 'full', v), /external/, 'Full\'s head counts it as external')
})

// ---------------------------------------------------------------- scope: a read place's include or exclude

test('Scope\'s Reads carry the include or exclude of each place (`r:<id>`), with its standing', async () => {
  const scope = (await import('../src/inhabitants/catalogue/panels/scope.tsx')).scope
  const reads = JSON.stringify([{id: 'central:source:a', name: 'Control wiki', ring: 3}, {id: 'central:source:b', name: 'Day notes', ring: 3}])
  const whole = draw(scope, 'whole', {...scope.defaults, reads, reach: 3, 'r:central:source:a': true, 'r:central:source:b': false}, {page: 'reach'})
  assert.match(whole, /aria-pressed="true" aria-label="Withhold Control wiki"/, 'an included place: its square pressed')
  assert.match(whole, /aria-pressed="false" aria-label="Request Day notes"/, 'an excluded place: its square open')
  const refused = draw(scope, 'whole', {...scope.defaults, reads, reach: 3, 'r:central:source:a': true}, {page: 'reach', standing: {'r:central:source:a': {disabled: 'No writer of the world\'s relations.'}}})
  assert.ok(refused.includes(escaped('No writer of the world\'s relations.')), 'a refused request says why')
})

// ---------------------------------------------------------------- dlw__session-grid: the shell's roll-up and rails

test('the Session grid rolls a group\'s members up whether it is folded or not, and its rails run the track\'s height, as the shell does', async () => {
  const grid = await panel('dlw__session-grid')
  const open = draw(grid, 'full', {...grid.defaults, 'fold:g1': false})
  assert.match(open, /sgd-cell sgd-roll/, 'an open group still rolls up its members\' clips (frame/tracks/SessionGrid.tsx: "A group with no clip of its own in this row rolls up its members\'")')
  assert.match(open, /class="sgd-rails"/, 'the rails stand on the track, top to bottom (tracks.css .rails: top 0, bottom 0)')
  assert.doesNotMatch(open, /<div class="sgd-head"><i class="sgd-rail"/, 'not inside the head alone')
  const css = readFileSync(new URL('../src/inhabitants/catalogue/panels/dlw__session-grid.css', import.meta.url), 'utf8')
  assert.match(css, /\.sgd-rails \{[^}]*top: 0;[^}]*bottom: 0;/)
})

// ---------------------------------------------------------------- widgets__terminal: the binding names the design's own keys

test('the Terminal\'s binding names the design\'s keys it cannot serve (rooms, provider, answers), and no SHELLS', async () => {
  const term = await import('../src/widgets/terminalBinding.ts')
  const design = await panel('widgets__terminal')
  assert.ok(!/SHELLS/.test(source('inhabitants/catalogue/panels/widgets__terminal.tsx')), 'the design draws from its keys (settled: 322134d71)')
  assert.doesNotMatch(source('widgets/terminalBinding.ts'), /SHELLS/, 'the binding cites no constant the design no longer has')
  const entry = {reading: {cwd: '/tmp', command: '', exited: false, fontSize: 12, scrollback: 5000, lines: 40, watch: false, attachedAt: 1}, hand: {fontSize: noop, scrollback: noop, watch: noop}}
  const binding = term.terminalBinding(entry)
  for (const key of ['rooms', 'provider', 'answers']) {
    assert.ok(key in JSON.parse(JSON.stringify(design.defaults)) || design.defaults[key] !== undefined, `${key} is the design's key`)
    assert.match(binding.standing[key]?.disabled ?? '', /missing op|no reading/, `${key} stands absent with what it waits for`)
  }
})

// ---------------------------------------------------------------- Approvals: a unit decision in its own options

test('Approvals shows a unit decision as its question, with Factory\'s own options on its answers', async () => {
  const approvals = await panel('software-factory__approvals')
  const units = await import('../src/agent/devices/unitDecisions.ts')
  const queue = JSON.stringify([{id: 'hr:asked', kind: 'request', text: 'Resume the bounded work of unit:type-check?', where: 'unit:type-check', who: 'Flint', age: 90,
    options: units.UNIT_ANSWERS}])
  const full = draw(approvals, 'full', {...approvals.defaults, queue, pick: 'hr:asked'})
  assert.match(full, /Resume bounded work/, 'Approve answers in Factory\'s words')
  assert.match(full, /Cancel bounded work/, 'Deny answers in Factory\'s words')
  assert.doesNotMatch(full, /aria-label="What it asks">unit:type-check/, 'the unit is not a command')
  assert.match(full, /unit:type-check/, 'the unit is named')
  const row = units.unitRows({decisions: [{statePath: 's', runRef: 'r', humanRequestRef: 'hr:x', question: 'Resume?', unit: 'unit:u'}], standings: {}}, null, undefined)[0]
  assert.deepEqual(row.options, {allowOnce: 'Resume bounded work', deny: 'Cancel bounded work'}, 'each unit row carries the options Factory declares')
})

// ---------------------------------------------------------------- the map rack: QL holds more than six in places

test('the rack\'s chains hold every part the map holds under a position (M3-1 has eight trigrams), never cut at six', async () => {
  const rack = await import('../src/inhabitants/catalogue/panels/map-rack.tsx')
  const ledger = json('./fixtures/ql-kernel-ledger-m3-rack-2026-10-21.json').views
  const children = Object.keys(ledger).filter(ref => /^#3-1-\d+$/.test(ref))
  assert.equal(children.length, 8, 'QL\'s ledger: M3-1 holds eight')
  const m3 = JSON.parse(rack.RACK_M3)
  assert.equal(m3.positions.find(x => x.pos === 1).parts.length, children.length, 'the M3 fixture carries all eight')
  assert.doesNotMatch(source('inhabitants/catalogue/panels/map-rack.tsx'), /its own six|each with its own six/, 'the words say what the map holds, not six')
})

// ---------------------------------------------------------------- workcell__workcell: a worker's mode and track are optional

test('the Workcell draws a worker with no mode or track as none, and the lane is the chosen project\'s seat\'s', async () => {
  const workcell = await panel('workcell__workcell')
  const working = JSON.stringify([{agent: 'flint'}])
  for (const view of ['whole', 'full', 'widget']) assert.doesNotMatch(draw(workcell, view, {...workcell.defaults, working}), /undefined/, `${view}: no "undefined"`)
  const seats = JSON.stringify([{product: 'ai-kit', state: 'claimed', lane: 'aikit/lane'}, {product: 'O-I', state: 'free', lane: null}])
  const folded = draw(workcell, 'folded', {...workcell.defaults, seats, project: 'O-I'})
  assert.doesNotMatch(folded, /aikit\/lane/, 'the chosen project\'s seat is free: its lane is none, not another project\'s')
  const bind = await import('../src/agent/devices/workcellRackBinding.ts')
  assert.match(source('agent/devices/workcellRackBinding.ts'), /put\(values, 'project', input\.project\)|values\.project = input\.project/, 'the binding names the project the chain stands for')
  assert.equal(typeof bind.workcellRackValues, 'function')
})

// ---------------------------------------------------------------- quaternal-logic__sky: a per-consent Withdraw

test('the Sky\'s Share page withdraws the consent you chose (`presence.withdraw`) through SharedField\'s withdraw_nara, then reads the list again', async () => {
  const presences = await import('../src/inhabitants/ql/devices/skyPresences.ts')
  const sky = await import('../src/inhabitants/ql/devices/qlSky.ts')
  // SharedField's own answers (desktop/cradle/kernel/tests/fixtures/owner-routes/shared-field-presences-2026-10-21.json: list, withdrawal).
  const real = json('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/shared-field-presences-2026-10-21.json')
  const me = real.list.presences[0].consent.participant_ref
  const ops = []
  presences.resetSkyPresences({call: async op => {
    ops.push(op)
    if (op.op === 'shared_field') return {outcome: {result: 'shared_field_reading', data: {schema: 'oi.shared-field.snapshot/v1', my_authority: [{participant_ref: me}], participants: []}}}
    if (op.request.operation === 'withdraw') return {outcome: {result: 'nara_presence_consent', data: real.withdrawal}}
    return {outcome: {result: 'nara_presence_consent', data: real.list}}
  }})
  await presences.readSkyPresences()
  assert.equal(presences.skyPresences().mine[0].projection, 'projection:sf5:nara', 'a row carries the projection its withdrawal names')
  await presences.withdrawSkyPresence('consent:sf5:1', () => 7)
  const withdrawal = ops.find(op => op.request?.operation === 'withdraw')
  // REPLACED (O-I #740 lane B): project 'O-I'; the sky's presences are the world's, asked in its root register.
  assert.deepEqual(withdrawal, {op: 'nara_presence', project: '', request: {operation: 'withdraw', projection_ref: 'projection:sf5:nara', consent_ref: 'consent:sf5:1', withdrawal_ref: 'withdrawal:consent:sf5:1:7'}})
  assert.equal(ops.at(-1).op, 'shared_field', 'the list is read again after it')
  await assert.rejects(() => presences.withdrawSkyPresence('consent:someone-else'), /not one your Participants gave/)
  const asked = []
  const binding = sky.qlSkyBinding(sky.qlSkyState(), undefined, presences.skyPresences(), async ref => { asked.push(ref) })
  assert.equal(binding.writes('presence.withdraw'), true)
  await binding.write([{key: 'presence.withdraw', value: 'consent:sf5:1'}])
  assert.deepEqual(asked, ['consent:sf5:1'])
  const design = await panel('quaternal-logic__sky')
  const why = 'The consents are not read, so none can be withdrawn: SharedField is unavailable.'
  const share = draw(design, 'whole', design.defaults, {page: 'share', standing: {'presence.withdraw': {disabled: why}}})
  assert.ok(share.includes(escaped(why)), 'Withdraw draws its own key\'s standing')
  assert.doesNotMatch(share, /has no operation to withdraw one yet/, 'no fixed refusal where the owner has an answer')
  presences.resetSkyPresences()
})

// ---------------------------------------------------------------- workcell__workcell: a chooser among the worlds listed for a cell

test('the Workcell\'s World page chooses among the worlds Workcell lists for the cell (`worlds`, `worldReceipt`), none assumed', async () => {
  const workcell = await panel('workcell__workcell')
  const rack = await import('../src/agent/devices/workcellRackBinding.ts')
  const worlds = JSON.stringify([{receipt: 'receipt:a', world: 'world:local:o-i:candidate'}, {receipt: 'receipt:b', world: 'world:local:o-i:dlw-build'}])
  const page = draw(workcell, 'whole', {...workcell.defaults, worlds, worldReceipt: 'receipt:b'}, {page: 'world'})
  assert.match(page, /world:local:o-i:candidate/, 'the chooser offers each listed world')
  assert.match(page, /Choose a world/, 'none is assumed')
  assert.match(rack.workcellRackBinding.toString(), /values\.worlds = JSON\.stringify\(picked\.listed/, 'the binding hands the listed worlds to the chooser')
})

// ---------------------------------------------------------------- software-factory__ledger: the receipts keyed by their ref (part two)

test('the Ledger keys each receipt by its ref: a change by its change_ref, a return by its return_ref, and a return draws no number', async () => {
  // DLW §19.13: "Every write has a receipt, and every receipt is in the Ledger." Central's source returns carry no number (source_return.rs
  // mints `<prefix><unix nanos>-<pid>`): the instant is when, never which.
  const bind = await import('../src/agent/devices/designBindings.ts')
  const rec = await import('../src/agent/devices/receiptBindings.ts')
  const ledger = await panel('software-factory__ledger')
  // The horizon's change as `projectcentral.change.horizon` answered it for O-I on 28 Oct (change_ref, cursor), made an agent's (FIXTURE).
  const change = {schema: 'central.source-change/v1', change_ref: 'central:change:project:O-I:481', cursor: 481, source_path: 'docs/a.json', kind: 'added',
    after_revision: 'central.content-fnv1a64/v1:1:aa', before_revision: null, observed_at_unix_seconds: 1793160515, actor: 'agent:kite', actor_kind: 'agent', agent_session_ref: 'session:kite'}
  const minted = 1_793_160_600_000
  const ret = {return_ref: `central:return:project:o-i:${minted}000000-4242`, source_ref: 'central:source:project:O-I:docs/b.md', basis_revision: 'r1', status: 'pending',
    agent_session_ref: 'session:flint', current_revision: 'r1'}
  const bare = {...ret, return_ref: 'central:return:project:o-i:no-instant', source_ref: 'central:source:project:O-I:docs/c.md', agent_session_ref: 'session:cairn'}
  const [row] = rec.receiptRows({changes: [change]}, 'Europe/London')
  assert.equal(row.ref, 'central:change:project:O-I:481', 'a change is keyed by its change_ref')
  assert.equal(row.n, 481, 'and keeps the horizon\'s own number')
  const returns = rec.returnReceiptRows([ret, bare], [], 'Europe/London')
  assert.deepEqual(returns.map(r => r.ref), [ret.return_ref, bare.return_ref], 'a return is keyed by its return_ref; one whose ref names no instant still stands')
  for (const r of returns) assert.ok(!('n' in r), 'a return carries no number: its minted instant is never drawn as one')
  assert.deepEqual([returns[1].day, returns[1].time], [undefined, undefined], 'no instant, no day and no time')
  // The receipt you read and Open log go by ref.
  bind.resetHolds()
  const ground = {sources: {state: 'ready', data: {changes: [change]}}, time: {state: 'ready', data: {civil_date: '2026-10-28', policy: {timezone: 'Europe/London'}}}}
  const opened = []
  const binding = rec.ledgerBinding({ground, groundError: null, holds: bind.chainHolds(), returns: {entries: [ret]}, tracks: []}, {openSession: ref => { opened.push(ref); return null }})
  binding.local.task(ret.return_ref)
  assert.equal(rec.ledgerReceiptSession({ground, holds: bind.chainHolds(), returns: {entries: [ret]}, tracks: []}), 'session:flint', 'the chosen receipt\'s session, by ref')
  await binding.write([{key: 'openLog', value: ret.return_ref}])
  await binding.write([{key: 'openLog', value: change.change_ref}])
  assert.deepEqual(opened, ['session:flint', 'session:kite'])
  await assert.rejects(() => binding.write([{key: 'openLog', value: minted}]), /not in the Ledger/, 'a minted instant is no key')
  bind.resetHolds()
  // The design: rows by ref, the chosen one by ref, no number where the owner gives none.
  const receipts = JSON.stringify([{ref: ret.return_ref, name: 'docs/b.md', agent: 'flint', outcome: 'waiting', day: '2026-10-28', time: '10:10'},
    {ref: change.change_ref, n: 481, agent: 'kite', outcome: 'landed', day: '2026-10-28', time: '09:48', files: [{path: 'docs/a.json', kind: 'added'}]},
    {n: 7, name: 'no ref', outcome: 'landed'}])
  const full = draw(ledger, 'full', {...ledger.defaults, period: 'all', receipts, task: ret.return_ref})
  assert.match(full, /<h3>[^<]*<b>docs\/b\.md<\/b><\/h3>/, 'the receipt you read is chosen by its ref')
  assert.ok(full.includes(escaped(ret.return_ref)), 'the receipt shows its ref')
  assert.doesNotMatch(full, new RegExp(`#${minted}|#NaN|undefined`), 'no number is made up for a return')
  assert.match(full, /#481/, 'a change keeps the horizon\'s number')
  assert.doesNotMatch(full, /no ref/, 'a row with no ref is no receipt')
  const tile = draw(ledger, 'widget', {...ledger.defaults, period: 'all', receipts, task: change.change_ref})
  assert.match(tile, new RegExp(`data-selected="true"[^>]*data-id="${change.change_ref}"`), 'the tile\'s rows are keyed by ref, the chosen one by its ref')
})

// ---------------------------------------------------------------- workcell__remote-carrier: a chooser among the runs a world names (part two)

test('the Remote carrier\'s Standing page chooses among the runs Workcell names for the chosen world (`runs`, `planRun`), none assumed', async () => {
  // DLW §19.18 Plan: "The run's needs laid on those offers." `workcell worlds` names each world's runs (the run-ledger slugs whose record
  // names its world_ref; read 28 Oct: run slugs such as development-entry-build-20261008 and its -r2); several wait for the hand's choice.
  const bind = await import('../src/agent/devices/designBindings.ts')
  const cells = await import('../src/agent/devices/workcellBindings.ts')
  const carrier = await panel('workcell__remote-carrier')
  const runs = ['development-entry-build-20261008', 'development-entry-build-20261008-r2']
  const status = {status: 'answered', value: {workcell_ref: 'workcell:mac', connections: []}}
  bind.resetHolds()
  const world = {worldRef: 'world:f067aac49a6184e6', runs}
  const unchosen = cells.planRunOf(world, {read: true}, undefined)
  const several = cells.carrierBinding(status, bind.chainHolds(), undefined, {run: {...unchosen, runs}})
  assert.equal(several.values.runs, JSON.stringify(runs), 'the runs the world names reach the chooser')
  assert.equal(several.values.planRun, undefined, 'none is assumed')
  assert.match(several.standing.plan.disabled, /choose one; none is assumed/)
  several.local.planRun(runs[1])
  const chosen = cells.planRunOf(world, {read: true}, bind.viewHolds(bind.chainHolds(), cells.CARRIER_ID).planRun)
  assert.equal(chosen.ref, runs[1], 'the hand\'s choice is the run the plan reads')
  assert.equal(cells.carrierBinding(status, bind.chainHolds(), undefined, {run: {...chosen, runs}}).values.planRun, runs[1], 'and the chooser shows it')
  const one = cells.carrierBinding(status, bind.chainHolds(), undefined, {run: {ref: runs[0], runs: [runs[0]]}})
  assert.equal(one.values.runs, undefined, 'one run is that run: nothing to choose')
  assert.match(one.standing.runs.disabled, /nothing to choose/)
  const none = cells.carrierBinding(status, bind.chainHolds(), undefined, {run: {ref: null, why: 'The run\'s plan: no run in this cell\'s ledger names world:x.', runs: []}})
  assert.equal(none.standing.runs.disabled, 'The run\'s plan: no run in this cell\'s ledger names world:x.', 'no run: the reason the plan gives')
  bind.resetHolds()
  // The chain hands the world's runs to the carrier.
  const chain = source('agent/devices/FactoryDeviceChain.tsx')
  assert.match(chain, /const carrierRunsKey = carrierWorld\?\.runs \? carrierWorld\.runs\.join\('\\n'\) : null/, 'the chosen world\'s runs')
  assert.match(chain, /run: \{ref: carrierRun, runs: carrierRuns,/, 'the world\'s runs reach material.run')
  // The design draws the chooser where several runs stand, and sets planRun.
  const page = draw(carrier, 'whole', {...carrier.defaults, runs: JSON.stringify(runs), planRun: runs[1]}, {page: 'standing'})
  assert.match(page, /Choose a run/, 'none is assumed')
  for (const run of runs) assert.ok(page.includes(run), `the chooser offers ${run}`)
  assert.doesNotMatch(draw(carrier, 'whole', {...carrier.defaults, runs: undefined}, {page: 'standing'}), /Choose a run/, 'no chooser where nothing names several runs')
})

// ---------------------------------------------------------------- techne__palace: the pages, the scene kind, the guide, the locus, Rename and Delete (part two)

test('the Palace draws its pages — Enter, Integral whole, Compose, Portals — a Scene room as a scene, the guide in the owner\'s words, the walk locus by locus, and Rename and Delete', async () => {
  // DLW §17.7: "To enter, select the palace on the World and choose Enter"; "Open an object, and it opens in its own instrument"; "The
  // guide says why the selected room stands where it does"; "Walk through a portal to leave the Palace"; "Bookmark a position".
  const palace = await panel('techne__palace')
  const v = palace.defaults
  const pages = Object.fromEntries(['palace', 'enter', 'whole', 'compose', 'portals'].map(page => [page, draw(palace, 'whole', v, {page})]))
  assert.match(pages.enter, /Palaces of your world/)
  assert.match(pages.enter, /Quaternal-Logic/, 'the Enter page lists the world\'s palaces')
  assert.match(pages.enter, />Enter</)
  assert.match(pages.whole, /Canvas \/ constellation/, 'the Integral whole lists the owner\'s regions')
  assert.doesNotMatch(pages.whole, /M′\d|M\d′/, 'by their offices, never an M′ number (#753)')
  assert.match(pages.whole, /ql\.techne:whole:fixture:l5-techne-contract-ground/, 'and the entries of the region the walk stands in')
  assert.match(pages.compose, /Save composition/)
  assert.match(pages.compose, /O-I — wiki local whole/, 'Compose lists the kernel\'s Expressions')
  assert.match(pages.portals, /the Earth/, 'Portals lists the doors out')
  assert.match(pages.palace, /Locus ›/, 'the walk steps locus by locus')
  assert.match(pages.palace, /1\/23 · Project \/ ground/)
  assert.match(pages.palace, />Rename</)
  assert.match(pages.palace, />Delete</)
  // The guide says the owner's line, and what each room rests on; with neither reported, it says so and invents no form.
  const full = draw(palace, 'full', {...v, warrant: 'stands in the warranted QL reading (canonical)', rests: 'warranted'})
  assert.match(full, /Its form: stands in the warranted QL reading \(canonical\)\./)
  assert.match(full, /constellation · warranted/)
  const unread = draw(palace, 'full', {...v, warrant: undefined, rests: undefined})
  assert.match(unread, /No reading of what it rests on\./)
  assert.doesNotMatch(unread, /free form|free mnemonic composition: no warranted QL structure/, 'no fixed form where the owner has not said')
  // A Scene room is a scene, in the guide's words (PalaceFloor.tsx ROOM_WORDS).
  const scene = draw(palace, 'compact', {...v, ...palace.fixtures['A Scene room']})
  assert.ok(scene.includes(escaped('A Scene of the palace\'s Expression.')), 'a Scene room keeps its kind')
  // No reading: every page draws, and draws no NaN and no undefined.
  const none = {...v, ...palace.fixtures['No readings']}
  for (const page of ['palace', 'enter', 'whole', 'compose', 'portals']) assert.doesNotMatch(draw(palace, 'whole', none, {page}), /\bNaN\b|undefined/, page)
})
