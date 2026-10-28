import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// The widget rail at the mockup's floor (FOUNDATION F8; manual §10.6; world-shell-mockup.html `.tilesh`/`.tile` 140–145,
// `.launch`/`.lgrid`/`.lcell`/`.pv` 379–387, `tileBody` 1627): the agent you are talking to as the candidate's one
// conversation surface, the packet as its owner holds it, THE selection's trail as stops, the launcher as live miniatures.
// Loader as f8-widgets.test.mjs.
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
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url).pathname,'utf8')};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document = {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop}, addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}, dataset: {}, classList: {add: noop, remove: noop, contains: () => false}}, body: {style: {}, dataset: {}, appendChild: noop, classList: {add: noop, remove: noop}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.__CRADLE_WALK__ = false
globalThis.matchMedia ??= () => ({matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop})
globalThis.localStorage = {getItem: () => null, setItem: () => {}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readFile} = await import('node:fs/promises')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
const html = element => renderToStaticMarkup(element)
const {WidgetRail} = await import('../src/frame/widgets/WidgetRail.tsx')
const {sameGlance} = await import('../src/frame/widgets/widgets.ts')
const {conversationOf, conversationAbsence, conversationGlance, CONVERSATION_PROJECT} = await import('../src/widgets/agentConversation.ts')
const {TrailStops, trailGlance, stopTime} = await import('../src/shell/TrailWidget.tsx')
const {PacketView, packetRows, packetGlance, answerRefusal} = await import('../src/widgets/PacketWidget.tsx')

const bookOf = rail => ({rail, toggle: noop, pin: noop, savePreset: noop, applyPreset: noop, widen: noop})
const track = (space, session, extra = {}) => ({sessionRef: `agent-session/${session}`, spaceRef: `session-space/${space}`, purpose: session, agentRef: null, agentName: null, agentAccepted: null,
  spaceLabel: null, depth: 0, parentRef: null, group: false, memberRefs: [], tasks: [], needle: null, telemetryOn: false, budget: {used: null, max: null}, disclosure: null, ...extra})
const keyOf = t => `${t.spaceRef}:${t.sessionRef}`

test('the rail wears the mockup\'s anatomy: one head with its open count, tiles with mark · name · pin · close, a launcher of two-column cells (headless SSR)', () => {
  const probe = (id, Name) => ({id, name: id, mark: 'trav', ...(Name ? {Name} : {}), Body: () => React.createElement('p', null, id)})
  const markup = html(React.createElement(WidgetRail, {widgets: [probe('agent', () => 'Fizz'), probe('packet'), probe('sky')], book: bookOf({open: ['agent', 'packet']}), selectionRef: 'ref:now'}))
  assert.match(markup, /class="mode-dock-tilesh"><span>Widgets<\/span><span class="mode-dock-count">2 open<\/span>/)
  assert.match(markup, /data-widget="agent"[\s\S]*?class="mode-dock-tile-name">Fizz</, 'a widget whose name follows the world draws it in its head')
  assert.equal((markup.match(/aria-label="Pin /g) ?? []).length, 2, 'pin on every open tile')
  assert.equal((markup.match(/aria-label="Close /g) ?? []).length, 2, 'close on every open tile')
  assert.ok(!/[⌖]/.test(markup), 'the pin mark is the cut\'s follow/placed mark, not a typed glyph')
  assert.equal((markup.match(/class="mode-dock-cell( open)?"/g) ?? []).length, 3, 'every widget has a launcher cell')
  assert.equal((markup.match(/data-preview="mark"/g) ?? []).length, 3, 'with no reading handed up, each cell draws the designed mark')
  assert.equal((markup.match(/<small aria-label="open">open<\/small>/g) ?? []).length, 2, 'an open widget is named open under its miniature')
  assert.match(markup, /data-launch="agent"[\s\S]*?class="mode-dock-cell-label">Fizz</, 'the launcher names the agent by the world too')
})

test('the launcher\'s cells are 122px rows in two columns; the tile head carries a count (code-reading: the rule is the mockup\'s)', async () => {
  const css = await source('shell/modeSurface.css')
  assert.match(css, /\.mode-dock-launch-grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[^}]*grid-auto-rows: 122px/)
  assert.match(css, /\.mode-dock-launch \{[^}]*height: 300px/)
  assert.match(css, /\.mode-dock-cell\.open \{ border-color: var\(--accent\) \}/)
  assert.match(css, /\.mode-dock-row \{ display: grid; grid-template-columns: 62px minmax\(0, 1fr\) auto/, 'rows are the mockup\'s .ctx')
  const rail = await source('frame/widgets/WidgetRail.tsx')
  assert.match(rail, /mode-dock-tile-count/, 'the head draws the count the body handed up')
  assert.match(rail, /glance=\{handOf\(widget\.id\)\}/, 'each body is handed its own glance')
})

test('a glance is the same reading when it draws the same; a body takes its glance back when it leaves (code-reading)', async () => {
  assert.ok(sameGlance({count: 2, lines: [{text: 'a'}]}, {count: 2, lines: [{text: 'a'}]}))
  assert.ok(!sameGlance({count: 2}, {count: 3}))
  assert.ok(sameGlance(null, undefined))
  assert.match(await source('frame/widgets/useGlance.ts'), /useEffect\(\(\) => \(\) => hand\?\.\(null\), \[hand\]\)/)
})

test('the agent widget holds the session THE selection names, else the companion\'s own, else none in the owner\'s words', () => {
  const fizz = track('a', 'fizz-1', {agentName: 'Fizz'}), anima = track('b', 'anima-1', {agentName: 'Anima'}), honey = track('c', 'honey-1', {agentName: 'Honey'})
  const tracks = [honey, fizz, anima]
  assert.equal(conversationOf(tracks, 'Fizz', null).track, fizz)
  assert.equal(conversationOf(tracks, 'Fizz', null).by, 'companion')
  assert.equal(conversationOf(tracks, 'Anima', 'central:day:2026-10-14').track, anima, 'a Day selected is no session: the companion answers')
  assert.equal(conversationOf(tracks, 'Fizz', keyOf(honey)).track, honey, 'a selected session is the one you talk to')
  assert.equal(conversationOf(tracks, 'Fizz', `${keyOf(honey)}#task/2`).track, honey, 'a selected task stands for its session')
  const group = track('g', 'group', {group: true}), lead = track('m', 'lead', {agentName: 'Bumble', parentRef: 'session-space/g'})
  assert.equal(conversationOf([group, lead], 'Fizz', keyOf(group)).track, lead, 'a group stands for its lead')
  assert.deepEqual(conversationOf([honey], 'Epii', null), {track: null, by: null})
  assert.equal(conversationAbsence('Epii', {transport: {kind: 'tauri'}, error: null, loading: false}), 'No Epii conversation stands in the agency reading.')
  assert.match(conversationAbsence('Fizz', {transport: {kind: 'unavailable', reason: 'no kernel'}, error: null, loading: false}), /carrier is unavailable.*no kernel/)
  assert.equal(CONVERSATION_PROJECT, 'O-I')
})

test('the agent widget mounts the one conversation surface, never a second chat (code-reading)', async () => {
  const widget = await source('widgets/AgentWidget.tsx')
  assert.match(widget, /<NativeAgencyParticipation /, 'the canonical agent panel the Factory thread and the Workbench pane mount')
  assert.match(widget, /conversation plane="Chat"/)
  for (const own of ['<textarea', 'kernelOp(', "action: 'prompt'", 'encounterProvision(']) assert.ok(!widget.includes(own), `no ${own} of its own`)
  assert.match(widget, /preferredBodyRef=\{body\?\.ref\}/, 'a new conversation is provisioned on the companion\'s own body when the roster holds it')
  const registry = await source('shell/widgets.tsx')
  assert.match(registry, /\{id: 'agent', name: 'Agent', Name: AgentWidgetName, [^}]*Body: AgentWidget\}/)
  assert.match(registry, /OWN_BODIES[^=]*= \{packet: PacketWidget, trail: TrailWidget\}/)
})

test('the conversation glance is the owner\'s last turns, the person\'s and the agent\'s only', () => {
  const blocks = [{id: 1, kind: 'user', text: 'say more'}, {id: 2, kind: 'thinking', text: 'x'}, {id: 3, kind: 'assistant', text: 'the stone  holds'}, {id: 4, kind: 'completed', text: ''}]
  assert.deepEqual(conversationGlance({blocks}, 'Fizz'), {lines: [{lead: 'you', text: 'say more'}, {lead: 'Fizz', text: 'the stone holds'}]})
  assert.equal(conversationGlance(undefined, 'Fizz'), null)
})

const item = (id, title, text, anchor = {kind: 'text', start: 0, end: text.length}) => ({id, canonical_expression: '', expression: null,
  selection: {source_ref: `central:path:${id}`, title, owner: 'central', binding_id: 'b', text, working_copy: false, captured_at: '', anchor}})
const context = items => ({schema: 'aikit.prepared-context/v1', scope: {project: 'O-I', agent_session: 'agent-session/x'}, revision: 1, digest: 'blake3:x', items})

test('the packet shows each prepared selection as its owner holds it, sized in characters, and names the undisclosed tokens (headless SSR)', () => {
  const held = context([item('i1', 'Flow · Fz2', 'the vessel is the stone’s other face'), item('i2', 'Page', 'x', {kind: 'observation', document_id: 'd', key: 'k', selector: 's', role: 'r'})])
  assert.deepEqual(packetRows(held).map(row => [row.title, row.size]), [['Flow · Fz2', '36'], ['Page', 'page']])
  const markup = html(React.createElement(PacketView, {companion: 'Fizz', scope: 'agent-session/x', context: held, reading: false, refusal: null, onAnswer: noop}))
  assert.equal((markup.match(/data-packet-item=/g) ?? []).length, 2)
  assert.match(markup, /tokens not disclosed/, 'no token count is drawn: the owner discloses none')
  assert.doesNotMatch(markup, /\d+ tokens/)
  assert.match(markup, /data-action="answer-this"(?![^>]*disabled)/, 'Answer this presses when nothing refuses it')
  const refused = html(React.createElement(PacketView, {companion: 'Fizz', scope: null, context: context([]), reading: false, refusal: 'No Fizz conversation stands, so nothing receives the packet yet.', onAnswer: noop}))
  assert.match(refused, /data-action="answer-this" disabled=""/)
  assert.match(refused, /The packet is empty/)
  assert.match(refused, /Prepared for O-I; no conversation receives it until Fizz has one/)
  assert.deepEqual(packetGlance(held)?.count, 2)
})

test('Answer this is the conversation\'s own Send, and says which owner condition is missing', async () => {
  const actions = (...enabled) => ({actions: ['aikit.encounter.prompt', 'aikit.encounter.context'].map(ref => ({ref, enabled: enabled.includes(ref), reason: null}))})
  const base = {companion: 'Anima', bound: true, reading: actions('aikit.encounter.prompt', 'aikit.encounter.context'), draft: 'why?', busy: false, items: 2}
  assert.equal(answerRefusal(base), null)
  assert.match(answerRefusal({...base, bound: false}), /No Anima conversation stands/)
  assert.match(answerRefusal({...base, reading: actions('aikit.encounter.prompt')}), /takes no prepared context/)
  assert.match(answerRefusal({...base, reading: actions()}), /takes no prompt now/)
  assert.match(answerRefusal({...base, draft: '  '}), /Write the question in Anima's composer/)
  assert.match(answerRefusal({...base, items: 0}), /packet is empty/)
  const widget = await source('widgets/PacketWidget.tsx')
  assert.match(widget, /onAnswer=\{\(\) => void encounter\?\.actions\.send\(\)\}/, 'the press is the shared encounter session\'s Send')
  assert.match(widget, /nativeContext\(transport, CONVERSATION_PROJECT, session, \{operation: 'read'\}\)/, 'the packet is read from its owner')
})

test('the trail draws the book\'s stops newest first as lines, the stop you stand on marked; a stop with no recorded time draws none (headless SSR)', () => {
  // The book's order (oldest first); the stop you stand on is the book's (#764: WorldContext.trailAt), not a selection several stops share.
  const stops = [{mode: 'techne', surfaceRef: 'wiki:m', surfaceKind: 'subject', label: 'Mercurius'}, {mode: 'base', surfaceRef: 'day:1', surfaceKind: 'day', label: 'Bollingen', at: Date.UTC(2026, 9, 14, 12, 24)}]
  const returned = []
  const markup = html(React.createElement(TrailStops, {stops, standing: 0, onReturn: index => returned.push(index)}))
  assert.equal((markup.match(/class="mode-dock-line trail-stop"/g) ?? []).length, 2)
  assert.match(markup, /Bollingen[\s\S]*aria-current="location"[\s\S]*?Mercurius/, 'newest first; the stop you stand on is marked')
  assert.match(markup, /class="mode-dock-line-lead"><\/span><span class="mode-dock-line-text">Mercurius/, 'no time is guessed')
  assert.equal(stopTime(stops[0]), null)
  assert.match(stopTime(stops[1]), /^\d\d:\d\d$/)
  assert.equal(trailGlance(stops).count, 2)
  assert.equal(trailGlance([]), null)
  assert.match(html(React.createElement(TrailStops, {stops: [], standing: null, onReturn: noop})), /Every place you go is kept here/)
})

test('the widget files name no mode; the frame stays mode-blind (code-reading)', async () => {
  for (const file of ['frame/widgets/WidgetRail.tsx', 'frame/widgets/widgets.ts', 'frame/widgets/useGlance.ts', 'widgets/AgentWidget.tsx', 'widgets/PacketWidget.tsx', 'widgets/agentConversation.ts', 'widgets/widgetReading.tsx']) {
    assert.doesNotMatch(await source(file), /[!=]==\s*'(live|base|central|factory|expressions|techne|audio)'/, `${file} branches on no mode`)
  }
})
