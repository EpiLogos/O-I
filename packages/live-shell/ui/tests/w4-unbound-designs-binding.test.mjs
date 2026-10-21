// W4, three designs that were unbound (T-COVERAGE §1.4), each on its owner, standard (a)–(g):
//   ai-kit:knowledge-route (§19.9)  inside Scope on a session's chain; AIKit's `knowledge status` through the kernel's knowledge op
//   actuation:voice (§19.21)        the Answer's voice (the kernel op nara_voice, central/devices/answerVoice.ts); placed after the Agent
//                                   on the track it speaks on — Central's chain, builder A's (PROPOSE in the lane's return)
//   widgets:terminal (§17.9)        the Workbench's Terminal surface over the PTY host (desktop/cradle/src/terminal/terminalReadings.ts);
//                                   on the rail and in a pane, never on a chain
// Channels:
// - REAL (tests/fixtures/knowledge-route-2026-10-21.json, read-only): AIKit's knowledge status and history for O-I, Central's personal
//   agent profiles, on workcell:mac 21 Oct.
// - OWNER-SHAPED: the Answer's voice states (AnswerVoiceState, answerVoice.ts VOICE_OFF and its moves); a terminal reading in the shape
//   the surface publishes (terminalReadings.ts), its folder and command the Workbench's own.
// - SCRIPTED: the catalogue designs drawn through the host; the voice's and the terminal's hands recorded, never sent.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
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

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const family = await import('../src/inhabitants/familyManifest.ts')
const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const {designKey} = await import('../src/frame/devices/designs.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const door = await import('../src/frame/devices/deviceDoor.ts')
const places = await import('../src/agent/devices/factoryPlaces.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const kr = await import('../src/agent/devices/knowledgeRouteBinding.ts')
const vb = await import('../src/agent/devices/voiceBinding.ts')
const {VOICE_OFF} = await import('../src/central/devices/answerVoice.ts')
const tb = await import('../src/widgets/terminalBinding.ts')
const terminals = await import('../../../../desktop/cradle/src/terminal/terminalReadings.ts')
const rail = await import('../src/widgets/TerminalRailWidget.tsx')
const registry = await import('../src/shell/widgets.tsx')
const {design: knowledgeDesign} = await import('../src/inhabitants/catalogue/panels/ai-kit__knowledge-route.tsx')
const {design: voiceDesign} = await import('../src/inhabitants/catalogue/panels/actuation__voice.tsx')
const {design: terminalDesign} = await import('../src/inhabitants/catalogue/panels/widgets__terminal.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const REAL = JSON.parse(readFileSync(new URL('./fixtures/knowledge-route-2026-10-21.json', import.meta.url), 'utf8'))
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const designKeys = design => [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
const classify = (binding, key) => binding.local && key in binding.local ? 'local' : key in binding.values ? 'reading' : binding.standing?.[key]?.disabled ? 'absent' : null
const VIEWS = ['folded', 'compact', 'whole', 'full', 'widget']
function drawsOn(design, binding, fixture, reasons = []) {
  const drawn = VIEWS.map(view => [view, renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding, view, nav: {}}))])
  for (const [view, markup] of drawn) {
    assert.match(markup, new RegExp(`data-device-view="${view}"`), `${design.id} ${view} draws`)
    assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${view}: no absent key drawn as text`)
    assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${view}: its own view drew`)
    assert.doesNotMatch(markup, fixture, `${design.id} ${view}: its fixture never stands in`)
  }
  const all = drawn.map(([, markup]) => markup).join('\n')
  for (const why of reasons) assert.ok(all.includes(escaped(why)), `${design.id}: drawn as why (${why.slice(0, 80)}…)`)
  return all
}

// ── the Knowledge route ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const KNOWLEDGE_FIXTURE = /verification-before-completion|AIKit verification and conformance|decode_envelope|SESSION-GROUNDING|index metadata exceeds 1 MiB|cradle\/04-VERIFICATION/
const PROFILE = REAL.profiles.sample[0]
const EMPTY_PROFILE = REAL.profiles.sample[1]

test('REAL — the Knowledge route reads each lens\'s answer from AIKit\'s knowledge status: the wiki withheld by its publication budget, the project and the code ready', () => {
  const answers = kr.lensAnswers(REAL.status, 'O-I')
  assert.deepEqual(answers.wiki, {ready: 'withheld', why: 'Knowledge discovery withheld or unavailable (knowledge.wiki_publication_budget)'}, 'the wiki\'s own absence, once')
  assert.deepEqual(answers.project, {ready: 'ready'}, 'every source pool available, the project map standing')
  assert.deepEqual(answers.code, {ready: 'ready'}, 'available, and no absence names O-I\'s code index')
  // The rules on the owner's own fields.
  const down = {...REAL.status, sources: [{provider: 'provider/source-pool/now-field', available: false, detail: 'rg is missing'}, ...REAL.status.sources.slice(1)], project_map: false}
  assert.deepEqual(kr.lensAnswers(down, 'O-I').project, {ready: 'degraded', why: 'provider/source-pool/now-field: rg is missing; The project map is unavailable.'})
  const codeDown = {...REAL.status, code: {available: false, detail: 'gitnexus is not installed'}, absences: [...REAL.status.absences, 'GitNexus CodeIndex degraded for Work/O-I: index metadata exceeds 1 MiB']}
  assert.deepEqual(kr.lensAnswers(codeDown, 'O-I').code, {ready: 'withheld', why: 'gitnexus is not installed'})
  assert.deepEqual(kr.lensAnswers({...REAL.status, absences: codeDown.absences}, 'O-I').code, {ready: 'degraded', why: 'GitNexus CodeIndex degraded for Work/O-I: index metadata exceeds 1 MiB'})
  assert.equal(kr.lensAnswers({unreadable: true}, 'O-I'), null, 'a reading that is not a status is not read as one')
  // REAL: the history names no session, so no page is this agent's; the profiles carry sources, not lenses.
  assert.deepEqual(REAL.history.contexts, ['{}'])
  assert.ok(PROFILE.knowledge_source_refs.every(ref => ref.startsWith('file://') || ref.startsWith('central:source:')), 'sources, not lenses')
})

test('the Knowledge route: every key its design reads is a reading, absent with its reason, or the hand\'s; every control refused by the operation it lacks', async () => {
  const binding = kr.knowledgeRouteBinding({status: REAL.status, project: 'O-I', profile: PROFILE})
  const keys = designKeys(knowledgeDesign)
  const classes = Object.fromEntries(keys.map(key => [key, classify(binding, key)]))
  for (const key of keys) assert.ok(classes[key], `${key} is classified`)
  assert.deepEqual(Object.entries(classes).filter(([, c]) => c === 'reading').map(([k]) => k).sort(), ['ready:code', 'ready:project', 'ready:wiki', 'why:wiki'])
  for (const key of ['pages', 'graph', 'reach', 'level:wiki', 'level:project', 'level:code', 'light', 'affected']) assert.match(binding.standing[key].disabled, /missing op: /, key)
  for (const key of ['wiki', 'project', 'code']) {
    assert.match(binding.standing[key].disabled, /missing op: a lens-level request on the AgentProfile/, key)
    assert.match(binding.standing[key].disabled, /names 2 sources \(file:\/\/\/private\/tmp\/ag65-campaign/, 'the profile\'s own sources named')
  }
  assert.match(binding.standing['why:code'].disabled, /AIKit names nothing wrong with this source; it is ready/)
  const refusedStatus = kr.knowledgeRouteBinding({status: null, statusError: 'AIKit is unavailable: oi not found', project: 'O-I', profile: null})
  for (const key of ['ready:wiki', 'why:wiki', 'ready:code']) assert.match(refusedStatus.standing[key].disabled, /knowledge status refused — AIKit is unavailable: oi not found/, key)
  assert.match(kr.knowledgeRouteBinding({status: null, project: 'O-I', profile: EMPTY_PROFILE}).standing.wiki.disabled, /names no knowledge source/)
  assert.match(kr.knowledgeRouteBinding({status: null, project: 'O-I', profile: null}).standing.wiki.disabled, /no agent's profile is read here/)
  for (const key of ['depth', 'budget', 'searchFirst']) assert.match(binding.standing[key].disabled, /missing op: /, key)
  // REPLACED (lane W8): `aikit knowledge forget` is routed; Forget waits on Affected, which no command reports.
  assert.match(binding.standing.forget.disabled, /Affected is not reported, so no reading stands to forget/)
  for (const key of ['wiki', 'depth', 'budget', 'searchFirst', 'refresh', 'forget']) await assert.rejects(binding.write([{key, value: true}]), new RegExp(binding.standing[key].disabled.slice(0, 24).replace(/[()[\]?.*+]/g, '\\$&')))
  await assert.rejects(binding.write([{key: 'ready:wiki', value: 'ready'}]), /is a reading/)
  assert.deepEqual(kr.knowledgeRouteValues({status: null, project: 'O-I', profile: null}), {}, 'unread: nothing, never a default')
})

test('the Knowledge route draws on its binding in all five views — no NaN, no undefined, never its fixtures — each refusal drawn as why', () => {
  host.resetHost()
  const binding = kr.knowledgeRouteBinding({status: REAL.status, project: 'O-I', profile: PROFILE})
  const all = drawsOn(knowledgeDesign, binding, KNOWLEDGE_FIXTURE, [REAL.status.absences.find(item => item.includes('wiki_publication_budget')), kr.KNOWLEDGE_REFUSE.depth])
  assert.ok(!all.includes('GitNexus CodeIndex degraded for Work/O-I'), 'the code index is ready: no degradation drawn')
  drawsOn(knowledgeDesign, kr.knowledgeRouteBinding({status: null, project: 'O-I', profile: null}), KNOWLEDGE_FIXTURE)
  host.resetHost()
})

test('the Knowledge route stands inside Scope on a session\'s chain, and nowhere else (§16.1, §19.9)', () => {
  assert.equal(places.INSIDE.world, 'knowledge')
  assert.deepEqual(places.SLOT_DEVICE.knowledge, {id: kr.KNOWLEDGE_ROUTE_ID, design: 'ai-kit:knowledge-route'})
  assert.equal(knowledgeDesign.kind, 'effect')
  const device = kr.knowledgeRouteDevice()
  assert.ok(device, 'AIKit admits the face')
  assert.equal(designKey(device.family, device.face.id), knowledgeDesign.id, 'the catalogue\'s design by the family\'s declaration')
  for (const place of [{kind: 'main'}, {kind: 'workcell', name: 'env-1'}, {kind: 'session', group: true}]) assert.ok(!places.chainSlots(place).includes('knowledge'), 'never a slot of its own')
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  assert.match(view, /slot\.id === 'world' && knowledgeOn && placed\(KNOWLEDGE_ROUTE_ID, knowledgeDevice, knowledgeDesignBinding, [^\n]*\{member: true\}\)/)
  assert.match(view, /const knowledgeOn = sessionRef != null && cellName == null/)
  assert.match(view, /useOwnerOp\(transport, knowledgeOn \? KNOWLEDGE_STATUS : null, 'knowledge'\)/, 'status asked only while a session\'s chain stands')
  assert.doesNotMatch(read('agent/devices/knowledgeRouteBinding.ts'), /\.defaults\[|\.fixtures|catalogue\/panels\//, 'the binding reads no design default or fixture')
})

// ── Voice ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const VOICE_FIXTURE = /I hear you|What stood out|en_US-norman|af_heart|0f3a|240 ms/
const ABSENT_KERNEL = 'Voice needs the desktop\'s own speech on this machine (the kernel op nara_voice: whisper.cpp hears, Kokoro speaks), and no native kernel stands here: the browser stack'

test('Voice reads the Answer\'s voice: Local while it is open, Off while closed, waiting while it opens; Local closed in the voice\'s own words where it cannot open', () => {
  const closed = vb.voiceValues({state: VOICE_OFF, why: null})
  assert.equal(closed['voice.body'], 'off')
  assert.deepEqual(JSON.parse(closed.bodies).map(body => [body.id, body.available]), [['local', true], ['face', false], ['realtime-aligned', false], ['realtime-native', false]])
  assert.equal(closed.reason, vb.NO_TURN)
  assert.equal(vb.voiceValues({state: {...VOICE_OFF, speaks: 'on'}, why: null})['voice.body'], 'local')
  assert.equal(vb.voiceValues({state: {...VOICE_OFF, hears: 'on', voice: 'listening'}, why: null})['voice.body'], 'local')
  const opening = vb.voiceBinding({state: {...VOICE_OFF, speaks: 'on', busy: 'Opening the voice'}, why: null}, async () => {})
  assert.equal(opening.values['voice.body'], undefined, 'not drawn before the owner answers')
  assert.deepEqual(opening.waiting, ['voice.body'])
  const away = vb.voiceValues({state: VOICE_OFF, why: ABSENT_KERNEL})
  assert.deepEqual(JSON.parse(away.bodies)[0], {id: 'local', available: false, why: ABSENT_KERNEL})
  assert.equal(away.reason, ABSENT_KERNEL)
  const refused = vb.voiceValues({state: {...VOICE_OFF, refused: {speaks: 'Native voice is busy'}}, why: null})
  assert.equal(refused.reason, 'Native voice is busy', 'the owner\'s refusal, in its words')
})

test('Voice: every key its design reads is classified; Body writes through the Answer\'s voice; every other control refused by the operation it lacks', async () => {
  const pressed = []
  const binding = vb.voiceBinding({state: VOICE_OFF, why: null}, async (key, value) => { pressed.push([key, value]) })
  const keys = designKeys(voiceDesign)
  const classes = Object.fromEntries(keys.map(key => [key, classify(binding, key)]))
  for (const key of keys) assert.ok(classes[key], `${key} is classified`)
  assert.deepEqual(Object.entries(classes).filter(([, c]) => c === 'reading').map(([k]) => k).sort(), ['bodies', 'reason', 'voice.body'])
  for (const key of Object.keys(vb.VOICE_ABSENT).filter(key => !(key in vb.VOICE_REFUSE))) assert.match(binding.standing[key].disabled, /missing op: /, key)
  for (const key of Object.keys(vb.VOICE_REFUSE)) {
    assert.match(binding.standing[key].disabled, /missing op: /, key)
    await assert.rejects(binding.write([{key, value: 'x'}]), /missing op: /)
  }
  await binding.write([{key: 'voice.body', value: 'local'}])
  await binding.write([{key: 'voice.body', value: 'off'}])
  assert.deepEqual(pressed, [['speaks', 'on'], ['speaks', 'off'], ['hears', 'off']], 'Local opens the voice; Off closes both keys (recorded, never sent)')
  await assert.rejects(binding.write([{key: 'voice.body', value: 'face'}]), /face rig's own body/)
  await assert.rejects(binding.write([{key: 'voice.body', value: 'realtime-aligned'}]), /no live Realtime client/)
  const away = vb.voiceBinding({state: VOICE_OFF, why: ABSENT_KERNEL}, async () => assert.fail('not pressed'))
  assert.equal(away.standing['voice.body'].disabled, ABSENT_KERNEL)
  await assert.rejects(away.write([{key: 'voice.body', value: 'local'}]), /no native kernel stands here/)
})

test('Voice draws on its binding in all five views — no NaN, no undefined, never its fixtures — each refusal drawn as why', () => {
  host.resetHost()
  drawsOn(voiceDesign, vb.voiceBinding({state: VOICE_OFF, why: null}, async () => {}), VOICE_FIXTURE, [vb.NO_TURN])
  drawsOn(voiceDesign, vb.voiceBinding({state: {...VOICE_OFF, speaks: 'on'}, why: null}, async () => {}), VOICE_FIXTURE, [vb.NO_TURN])
  drawsOn(voiceDesign, vb.voiceBinding({state: VOICE_OFF, why: ABSENT_KERNEL}, async () => {}), VOICE_FIXTURE, [ABSENT_KERNEL])
  host.resetHost()
})

test('Voice is Actuation\'s admitted face, an effect; it stands on no Factory chain (no Factory session speaks: Central\'s chain places it after its Agent)', () => {
  const device = vb.voiceDevice()
  assert.ok(device, 'Actuation admits the face')
  assert.equal(designKey(device.family, device.face.id), voiceDesign.id)
  assert.equal(voiceDesign.kind, 'effect')
  for (const place of [{kind: 'main'}, {kind: 'workcell', name: 'env-1'}, {kind: 'session', group: false}, {kind: 'session', group: true}]) {
    assert.ok(!places.chainSlots(place).some(slot => places.SLOT_DEVICE[slot].design === 'actuation:voice'), 'no Factory chain carries it')
  }
  assert.doesNotMatch(read('agent/devices/voiceBinding.ts'), /\.defaults\[|\.fixtures|catalogue\/panels\//, 'the binding reads no design default or fixture')
})

// ── the Terminal ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const TERMINAL_FIXTURE = /git status -sb|Already up to date|port\/bridge-2|rm -i src|desktop {2}docs|npx tsc --noEmit|3812|3\.8k/
function terminalEntry(reading = {}) {
  const hand = {calls: [], fontSize: px => hand.calls.push(['fontSize', px]), scrollback: lines => hand.calls.push(['scrollback', lines]), watch: on => hand.calls.push(['watch', on])}
  return {reading: {id: 'surface-1', title: 'Terminal', cwd: '/Users/admin/Central/Work/O-I', cwdStanding: 'launch-directory', command: null, exited: false, archived: false,
    fontSize: 12, scrollback: 5000, lines: 41, watch: false, attachedAt: 1, ...reading}, hand}
}

test('the surfaces publish what they hold of their PTYs, the newest attached first; a retired surface leaves', () => {
  const seen = []
  const stop = terminals.subscribeTerminals(() => seen.push(terminals.terminalsNow().map(entry => entry.reading.id)))
  const a = terminalEntry({id: 'a', attachedAt: terminals.nextAttachOrder()}), b = terminalEntry({id: 'b', attachedAt: terminals.nextAttachOrder()})
  terminals.publishTerminal(a.reading, a.hand)
  terminals.publishTerminal(b.reading, b.hand)
  assert.deepEqual(terminals.terminalsNow().map(entry => entry.reading.id), ['b', 'a'])
  const same = terminals.terminalsNow()
  assert.equal(terminals.terminalsNow(), same, 'the same array while nothing moves')
  terminals.retireTerminal('b')
  terminals.retireTerminal('a')
  terminals.retireTerminal('a')
  stop()
  assert.deepEqual(seen, [['a'], ['b', 'a'], ['a'], []], 'a retire of what is gone moves nothing')
  // The surface publishes on attach, on its process's end and as its lines move, and retires as it goes (TerminalSurface.tsx).
  const surface = readFileSync(new URL('../../../../desktop/cradle/src/terminal/TerminalSurface.tsx', import.meta.url), 'utf8')
  assert.match(surface, /attachedNow=true;attachedAt=nextAttachOrder\(\);publish\(\)/)
  assert.match(surface, /if\(out\.eof!==exitedNow\|\|/)
  assert.match(surface, /return\(\)=>\{unregister\(\);retireTerminal\(binding\.id\)/)
  assert.match(surface, /term\.options\.disableStdin=watching/, 'Watch holds through a checkpoint\'s pause')
})

test('the Terminal: every key its design reads is classified; Text size, Scrollback and Watch go to the surface that holds the lease; the rest refused in words', async () => {
  const entry = terminalEntry()
  const binding = tb.terminalBinding(entry)
  const keys = designKeys(terminalDesign)
  const classes = Object.fromEntries(keys.map(key => [key, classify(binding, key)]))
  for (const key of keys) assert.ok(classes[key], `${key} is classified`)
  assert.deepEqual(binding.values, {light: 'lit', folder: '/Users/admin/Central/Work/O-I', command: '', exited: false, fontSize: 12, scrollback: 5000, lines: 41, watch: false})
  for (const key of ['selected', 'shell', 'follow']) assert.match(binding.standing[key].disabled, /missing op: /, key)
  await binding.write([{key: 'fontSize', value: 14}, {key: 'scrollback', value: 20000}, {key: 'watch', value: true}])
  assert.deepEqual(entry.hand.calls, [['fontSize', 14], ['scrollback', 20000], ['watch', true]], 'through the surface (recorded, never sent)')
  for (const key of ['follow', 'shell', 'folder', 'command']) await assert.rejects(binding.write([{key, value: 'x'}]), new RegExp(tb.TERMINAL_REFUSE[key].slice(0, 20)))
  await assert.rejects(binding.write([{key: 'lines', value: 1}]), /lines is a reading/)
  await assert.rejects(binding.write([{key: 'fontSize', value: 'big'}]), /number of pixels/)
  assert.equal(tb.terminalBinding(null), null, 'no terminal runs: no binding, never a default')
  const ended = tb.terminalValues(terminalEntry({exited: true, command: 'npm test'}))
  assert.deepEqual([ended.light, ended.exited, ended.command], ['dark', true, 'npm test'])
})

test('the Terminal draws on its binding in all five views — no NaN, no undefined, never its fixture\'s screens; with none running, the rail says where one starts', () => {
  host.resetHost()
  const all = drawsOn(terminalDesign, tb.terminalBinding(terminalEntry()), TERMINAL_FIXTURE)
  assert.match(all, /No reading: shell/, 'the screen is not reported: said, not drawn from the design\'s own shells')
  drawsOn(terminalDesign, tb.terminalBinding(terminalEntry({exited: true, command: 'npm test'})), TERMINAL_FIXTURE)
  door.publishDevice(tb.TERMINAL_ID, null)
  assert.match(renderToStaticMarkup(createElement(rail.TerminalRailWidget, {close: () => {}})), new RegExp(escaped(tb.NO_TERMINAL).replace(/[()[\]?.*+]/g, '\\$&')))
  door.publishDevice(tb.TERMINAL_ID, {device: tb.terminalDevice(), binding: tb.terminalBinding(terminalEntry())})
  try {
    const tile = renderToStaticMarkup(createElement(rail.TerminalRailWidget, {close: () => {}}))
    assert.match(tile, /data-device-size="widget"/)
    assert.match(tile, /data-device-design="widgets:terminal"|data-device-design="generic"/, 'the device\'s widget (the design registers when the rail loads it)')
  } finally { door.publishDevice(tb.TERMINAL_ID, null) }
  host.resetHost()
})

test('the Terminal stands on the rail (its own bare tile) and in a pane, never on a chain (§17.9)', () => {
  const tile = registry.WIDGETS.find(widget => widget.id === 'terminal')
  assert.equal(tile.bare, true, 'the device\'s own tile: no second head')
  assert.equal(terminalDesign.kind, 'instrument')
  assert.equal(tb.terminalDevice().id, terminalDesign.id)
  for (const place of [{kind: 'main'}, {kind: 'workcell', name: 'env-1'}, {kind: 'session', group: false}, {kind: 'session', group: true}]) {
    assert.ok(!places.chainSlots(place).some(slot => places.SLOT_DEVICE[slot].design === terminalDesign.id), 'no chain carries it')
  }
  const publisher = read('widgets/railDevices.tsx')
  assert.match(publisher, /publishDevice\(TERMINAL_ID, terminal \? \{device: terminalInstance, binding: terminal\} : null\)/, 'published by the rail\'s publisher, in every mode, while a terminal runs')
  assert.match(publisher, /useSyncExternalStore\(subscribeTerminals, terminalsNow, terminalsNow\)/)
  assert.doesNotMatch(read('widgets/terminalBinding.ts'), /\.defaults\[|\.fixtures|catalogue\/panels\//, 'the binding reads no design default or fixture')
})

test('§16.14 — none of the three bindings defaults a reading: unread owners leave every key absent', () => {
  bind.resetHolds()
  assert.deepEqual(kr.knowledgeRouteValues({status: null, project: 'O-I', profile: null}), {})
  assert.deepEqual(tb.terminalValues(null), {})
  const voice = vb.voiceValues({state: VOICE_OFF, why: ABSENT_KERNEL})
  assert.deepEqual(Object.keys(voice).sort(), ['bodies', 'reason', 'voice.body'], 'the closed voice is a reading (Off); nothing else is filled in')
})
