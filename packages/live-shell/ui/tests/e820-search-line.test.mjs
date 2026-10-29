import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// O-I #820 — the search line (DLW §18.4 "The line anywhere"): one line, three doors (⌘K over the frame, @ in a Flow entry, @ in the
// agent's composer); the language and the results the Search pane's own (searchBinding.ts over AIKit's knowledge search); plain words a
// jump ranked by the owner's own use counts; Enter opens, or sends a selected passage through the target's owner; `>` the menu bar's
// acts with their keys. Loader as f9-keys.test.mjs.
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
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage ??= {getItem: () => null, setItem: () => {}}
const {readFile} = await import('node:fs/promises')
const read = path => readFile(new URL(path, import.meta.url), 'utf8')

const door = await import('../src/central/searchLineDoor.ts')
const model = await import('../src/central/searchLineModel.ts')
const keyMap = await import('../src/frame/keys/keyMap.ts')
const {planKey} = await import('../src/frame/keys/planKey.ts')
const {handleKey, frameKeyDoors} = await import('../src/frame/keys/FrameKeys.tsx')
const design = await import('../src/inhabitants/catalogue/panels/central__search.tsx')
const binding = await import('../src/central/devices/searchBinding.ts')
const {MENU_COMMANDS} = await import('../src/frame/menu/commandDoor.ts')

const el = (tagName, attrs = {}, parentElement = null, extra = {}) => ({tagName, parentElement, getAttribute: name => (name in attrs ? attrs[name] : null), ...extra})
const body = el('BODY')
const keydown = (key, extra = {}) => ({key, code: '', target: body, defaultPrevented: false, prevented: 0, preventDefault() { this.defaultPrevented = true; this.prevented++ }, ...extra})

// ---------------------------------------------------------------------------------------------------------------------
// the door: one line, open or not, and Esc leaves you where you were

test('one line at a time: it opens on a request, a second request while it stands is refused, and closing puts the caret back', () => {
  const restored = []
  assert.equal(door.searchLineNow(), null)
  assert.equal(door.openSearchLine({door: 'frame', restore: () => restored.push('frame')}), true)
  assert.equal(door.searchLineNow()?.door, 'frame')
  assert.equal(door.openSearchLine({door: 'composer'}), false, 'the line already stands: it is one line')
  door.closeSearchLine()
  assert.equal(door.searchLineNow(), null)
  assert.deepEqual(restored, ['frame'], 'Esc: the caret and the selection go back where they were')
  door.openSearchLine({door: 'flow', restore: () => restored.push('flow')})
  door.closeSearchLine({restore: false})
  assert.deepEqual(restored, ['frame'], 'a click elsewhere closes the line and leaves the focus where the click put it')
})

test('an @ opens the line where a word starts (the start of the field, or after a space); an @ inside a word is an address', () => {
  for (const before of ['', 'Ask ', 'line one\n']) assert.equal(door.atOpens(before), true, JSON.stringify(before))
  for (const before of ['mail me at frank', 'x']) assert.equal(door.atOpens(before), false, JSON.stringify(before))
  // the same rule as the pane's own reading of a composer's words (searchPane.tsx atQueryOf)
  for (const text of ['Ask ', 'mail me at frank', '', 'a\n']) assert.equal(door.atOpens(text), door.atQueryOf(`${text}@`) !== null)
})

test('a composer\'s @: with no selection the @ is typed and the line opens; with a passage selected the @ is held and the passage goes with it', () => {
  const field = (value, start, end = start) => ({tagName: 'TEXTAREA', value, selectionStart: start, selectionEnd: end, getAttribute: name => (name === 'data-at-search' ? 'composer' : null), parentElement: body})
  const plain = door.atKeyOf(keydown('@'), field('Ask ', 4))
  assert.equal(plain?.hold, false, 'the @ stays as typed')
  assert.equal(plain?.request.door, 'composer')
  assert.equal(plain?.request.passage ?? null, null)
  const selected = door.atKeyOf(keydown('@'), field('Ask about this please', 4, 14))
  assert.equal(selected?.hold, true, 'the selection is not replaced by the @')
  assert.equal(selected?.request.passage?.text, 'about this')
  assert.equal(door.atKeyOf(keydown('@'), field('frank', 5)), null, 'an address')
  assert.equal(door.atKeyOf(keydown('@', {metaKey: true}), field('', 0)), null)
  assert.equal(door.atKeyOf(keydown('@', {isComposing: true}), field('', 0)), null, 'an IME composition is not a press')
  assert.equal(door.atKeyOf(keydown('a'), field('', 0)), null)
  const undeclared = {...field('', 0), getAttribute: () => null}
  assert.equal(door.atKeyOf(keydown('@'), undeclared), null, 'only a field that declares data-at-search opens the line')
})

// ---------------------------------------------------------------------------------------------------------------------
// ⌘K: the window's key, through the line's door

test('⌘K opens the line over anything: a key of the window, even in a text field, never inside something that takes its own keys', () => {
  assert.deepEqual(keyMap.intentOfKey({key: 'k', metaKey: true}), {id: 'line'})
  assert.deepEqual(keyMap.intentOfKey({key: 'K', ctrlKey: true}), {id: 'line'}, 'Ctrl K where there is no ⌘')
  assert.equal(keyMap.intentOfKey({key: 'k', metaKey: true, shiftKey: true}), null)
  assert.equal(keyMap.intentOfKey({key: 'k', metaKey: true, altKey: true}), null)
  assert.equal(keyMap.intentOfKey({key: 'k'}), null, 'a plain k is no one\'s here')
  assert.equal(keyMap.suppressed({id: 'line'}, el('TEXTAREA')), false, 'as Quick Open opens over the editor')
  assert.equal(keyMap.suppressed({id: 'line'}, el('DIV', {contenteditable: 'true'})), false)
  assert.equal(keyMap.suppressed({id: 'line'}, el('INPUT', {}, el('DIV', {role: 'dialog'}, body))), true, 'the line itself, or any dialog, keeps its keys')
  assert.equal(keyMap.suppressed({id: 'line'}, el('DIV', {'data-takes-keys': 'line'}, body)), true)
})

test('⌘K needs the line\'s host; it waits its turn, so a handler that already took ⌘K (the Earth\'s own search) keeps it', () => {
  const opened = []
  const doors = {transport: () => null, rows: () => null, device: () => null, openable: () => null, searchAvailable: () => false, search: () => false,
    lineAvailable: () => true, line: () => { opened.push('line') }}
  assert.equal(planKey({id: 'line'}, {...doors, lineAvailable: () => false}), null, 'no host mounted: the key is no one\'s')
  assert.equal(planKey({id: 'line'}, {...doors, lineAvailable: undefined, line: undefined}), null)
  const waiting = []
  const run = event => handleKey(event, doors, {}, noop, {querySelectorAll: () => []}, task => waiting.push(task))
  const press = keydown('k', {metaKey: true})
  assert.equal(run(press), true)
  assert.equal(press.prevented, 0, 'not claimed at once')
  waiting.shift()()
  assert.deepEqual(opened, ['line'])
  const taken = keydown('k', {metaKey: true})
  assert.equal(run(taken), true)
  taken.preventDefault()
  waiting.shift()()
  assert.deepEqual(opened, ['line'], 'the Earth took it first: the line stands down')
  const typing = keydown('k', {metaKey: true, target: el('TEXTAREA', {}, body)})
  assert.equal(run(typing), true, 'in the composer too')
})

test('the frame\'s doors reach the line through its host: available only while the host is mounted', () => {
  assert.equal(frameKeyDoors.lineAvailable(), false)
  const leave = door.registerSearchLineHost()
  assert.equal(frameKeyDoors.lineAvailable(), true)
  frameKeyDoors.line()
  assert.equal(door.searchLineNow()?.door, 'frame')
  door.closeSearchLine({restore: false})
  leave()
  assert.equal(frameKeyDoors.lineAvailable(), false)
})

// ---------------------------------------------------------------------------------------------------------------------
// the language: the Search pane's own

test('what the line read: each mark the design\'s grammar finds is a chip; plain words carry none', () => {
  assert.deepEqual(design.marksOf('bol'), [])
  assert.deepEqual(design.marksOf('@4 world:bollingen').map(mark => mark.mark), ['horizon', 'kind'])
  assert.deepEqual(design.marksOf('+ @1 source:ground').map(mark => mark.mark), ['include', 'horizon', 'kind'])
  assert.deepEqual(design.marksOf('@2 reading:notes = @3 form:brief').map(mark => mark.mark), ['horizon', 'kind', 'relation', 'horizon', 'kind'])
  assert.deepEqual(design.marksOf('@# @5').map(mark => mark.mark), ['question', 'horizon'])
  assert.deepEqual(design.marksOf('@bol').map(mark => mark.mark), ['address'])
  assert.deepEqual(design.marksOf('vak:M0-3').map(mark => mark.mark), ['kind'])
})

test('the line\'s four states: > is acts, nothing is what you opened, plain words a jump, any mark a search', () => {
  assert.equal(model.lineModeOf('>'), 'acts')
  assert.equal(model.lineModeOf('> fold'), 'acts')
  assert.equal(model.lineModeOf(''), 'opened')
  assert.equal(model.lineModeOf('   '), 'opened')
  assert.equal(model.lineModeOf('bol'), 'jump')
  assert.equal(model.lineModeOf('founding positions'), 'jump')
  assert.equal(model.lineModeOf('@bol'), 'search')
  assert.equal(model.lineModeOf('@4 world:bollingen'), 'search')
  assert.equal(model.lineModeOf('vak:M0-3'), 'search')
})

test('the results carry the owner\'s address and its own use count (AIKit\'s ranking.destination), never one the shell makes', () => {
  const hit = (resource, kind, destination) => ({resource, label: resource, kind, snippet: '', provider: 'p', authority: 'observed', address: {kind: 'source', value: resource},
    ...(destination ? {ranking: {destination}} : {})})
  const rows = binding.searchResultsOf({query: 'x', hits: [hit('a', 'knowledge-source', {observations: 3, frecency: 1.25}), hit('b', 'knowledge-source', {observations: 0, frecency: -0}), hit('c', 'agent')], rows: [], pending: []})
  assert.equal(rows[0].address, JSON.stringify({kind: 'source', value: 'a'}))
  assert.equal(rows[0].used, 3); assert.equal(rows[0].frecency, 1.25)
  assert.equal(rows[1].used, undefined, 'never opened: no count shown')
  assert.equal(rows[2].frecency, undefined, 'the owner gave no ranking: none is made')
})

test('the jump: what you open most first, by the owner\'s frecency; the rest after it in the owner\'s order; nothing re-ranked by the shell', () => {
  const r = (ref, frecency) => ({ref, title: ref, kind: 'knowledge-source', group: 'document', ...(frecency === undefined ? {} : {frecency})})
  assert.deepEqual(model.jumpOrder([r('a', 0), r('b', 2), r('c', 0.5), r('d'), r('e', 2)]).map(x => x.ref), ['b', 'e', 'c', 'a', 'd'])
  assert.deepEqual(model.jumpOrder([r('a'), r('b'), r('c')]).map(x => x.ref), ['a', 'b', 'c'], 'no counts: the owner\'s order stands')
})

test('a search comes in groups by kind, in the design\'s order, the kinds turned off left out', () => {
  const results = model.lineResultsOf(JSON.stringify([
    {ref: 'x1', title: 'X', kind: 'knowledge-source'}, {ref: 'a1', title: 'A', kind: 'agent'}, {ref: 'p1', title: 'P', kind: 'project'}, {ref: 'v', title: 'V', kind: 'vak-entry'}]))
  assert.deepEqual(results.map(r => r.group), ['document', 'agent', 'place', 'vak'])
  const groups = model.groupsOf(results, () => true)
  assert.deepEqual(groups.map(g => g.name), ['Agents', 'Places', 'Documents', 'Vāk'])
  assert.deepEqual(model.groupsOf(results, group => group !== 'agent').map(g => g.name), ['Places', 'Documents', 'Vāk'])
  assert.deepEqual(model.lineResultsOf(undefined), [])
})

// ---------------------------------------------------------------------------------------------------------------------
// Enter: open, or send the passage through the target's owner; a send no owner takes stands dimmed with its reason

const passage = {text: 'A completion claim without executed evidence is only tone.', from: 'Flow — Completion', path: 'Control/user/flows/flow-a.html'}
const of = (kind, extra = {}) => ({ref: `${kind}:1`, title: `The ${kind}`, kind, group: design.searchGroupOf(kind), ...extra})

test('what a tag does to each kind (§18.4 What a tag sends): a Flow takes a new entry; a passage, a power and a Vāk entry open', () => {
  const flow = {schema: 'central.path-ref/v1', ref: 'central:path:control:Control/user/flows/flow-b.html', root: 'control', path: 'Control/user/flows/flow-b.html'}
  const toFlow = model.sendPlanOf(of('knowledge-source', {ref: 'central:source:control:root:Control/user/flows/flow-b.html'}), passage, {flow})
  assert.equal(toFlow.verb, 'send'); assert.equal(toFlow.target, 'flow')
  assert.match(toFlow.words, /^Adds 58 characters from Flow — Completion to The knowledge-source as a new entry, with the page it came from\.$/)
  for (const kind of ['knowledge-frame', 'capability', 'vak-entry']) assert.equal(model.sendPlanOf(of(kind), passage, {}).verb, 'open', `${kind}: a tag does not send to it`)
  assert.equal(model.sendPlanOf(of('knowledge-source'), null, {}).verb, 'open', 'with no selection, Enter opens the result')
})

test('a send no owner takes stays in the list, dimmed, and names the operation it waits for', () => {
  const person = model.sendPlanOf(of('participant'), passage, {})
  assert.equal(person.verb, 'dim'); assert.match(person.why, /missing op/i); assert.match(person.why, /person/i)
  const place = model.sendPlanOf(of('project'), passage, {})
  assert.equal(place.verb, 'dim'); assert.match(place.why, /missing op/i)
  const page = model.sendPlanOf(of('knowledge-source', {ref: 'central:source:project:O-I:README.md'}), passage, {})
  assert.equal(page.verb, 'dim'); assert.match(page.why, /quote at the end/); assert.match(page.why, /missing op/i)
  const agentAbsent = model.sendPlanOf(of('agent'), passage, {agent: null})
  assert.equal(agentAbsent.verb, 'dim'); assert.match(agentAbsent.why, /no session/i)
  const agent = model.sendPlanOf(of('agent'), passage, {agent: {sessionRef: 'agent-session/flint', project: '', name: 'Flint'}})
  assert.equal(agent.verb, 'send'); assert.equal(agent.target, 'agent')
  assert.match(agent.words, /^Starts Flint on 58 characters from Flow — Completion\.$/)
})

test('the Flow a tag sends to: the owner\'s Flow listing names it by the path the result carries; nothing else is taken for a Flow', () => {
  const listing = [{name: 'flow-b.html', location: {schema: 'central.path-ref/v1', ref: 'central:path:control:Control/user/flows/flow-b.html', root: 'control', path: 'Control/user/flows/flow-b.html'}, byte_len: 1}]
  assert.equal(model.flowOf(of('knowledge-source', {ref: 'central:source:control:root:Control/user/flows/flow-b.html'}), listing)?.path, 'Control/user/flows/flow-b.html')
  assert.equal(model.flowOf(of('document', {ref: 'Control/user/flows/flow-b.html:12', owner: 'Control'}), listing)?.path, 'Control/user/flows/flow-b.html', 'Central\'s match in Control: its path and line')
  assert.equal(model.flowOf(of('knowledge-source', {ref: 'central:source:control:root:Control/user/flows/flow-z.html'}), listing), null, 'not in the owner\'s listing')
  assert.equal(model.flowOf(of('knowledge-source', {ref: 'central:source:control:root:Control/user/day/2026-10-29/day.md'}), listing), null)
})

test('the entry a Flow takes: the passage, and where it came from', () => {
  assert.equal(model.flowEntryText(passage), `${passage.text}\n\n— from Flow — Completion (Control/user/flows/flow-a.html)`)
  assert.equal(model.flowEntryText({text: 'x', from: 'the Agent\'s composer'}), 'x\n\n— from the Agent\'s composer')
})

// ---------------------------------------------------------------------------------------------------------------------
// > : the menu bar's acts, each with its key

test('the acts are the menu bar\'s own, each with the key its host menu binds (desktop/cradle/src-tauri/src/menus.rs)', async () => {
  const menus = await read('../../../../desktop/cradle/src-tauri/src/menus.rs')
  const bound = Object.fromEntries([...menus.matchAll(/item\("([a-z.-]+)", "[^"]+", (?:Some\("([^"]+)"\)|None)\)/g)].map(m => [m[1], m[2] ?? null]))
  for (const id of Object.keys(MENU_COMMANDS)) assert.equal(model.MENU_ACCELERATORS[id], bound[id], `${id}: the line says the key the menu binds`)
  assert.deepEqual(Object.keys(model.MENU_ACCELERATORS).sort(), Object.keys(MENU_COMMANDS).sort())
  assert.equal(model.keyGlyphs('CmdOrCtrl+Shift+Z'), '⇧⌘Z')
  assert.equal(model.keyGlyphs('Alt+CmdOrCtrl+9'), '⌥⌘9')
  assert.equal(model.keyGlyphs('CmdOrCtrl+,'), '⌘,')
  assert.equal(model.keyGlyphs(null), '')
})

test('> and words: the acts whose names match, each with its key; > alone offers every act', () => {
  const view = model.actsOf('> clip')
  assert.deepEqual(view.map(a => a.id), ['create.clip', 'view.clip', 'view.detail', 'view.expand-clip'])
  assert.equal(view.find(a => a.id === 'view.clip')?.key, '⌥⌘3')
  assert.equal(model.actsOf('>').length, Object.keys(MENU_COMMANDS).length)
  assert.equal(model.actsOf('> rename')[0].object, 'rename', 'an Edit act runs on the selection, through the view\'s object acts')
  assert.deepEqual(model.actsOf('> fold'), [], 'the menu bar holds no Fold')
})

// ---------------------------------------------------------------------------------------------------------------------
// the doors as built

test('the Flow\'s form asks its host for the line on @, and the host opens it at the caret and puts the selection back after', async () => {
  const form = await read('../../../../desktop/cradle/documents/ql-flow.html')
  assert.match(form, /type:'oi:at-search'/, 'the form posts the @ to its host')
  assert.match(form, /'oi:at-search-closed'/, 'and restores the caret and the selection when the host closes the line')
  const face = await read('../src/inhabitants/DocumentFlowFace.tsx')
  assert.match(face, /AT_SEARCH_MESSAGE/); assert.match(face, /openSearchLine\(/)
})

test('the agent\'s composer declares its @ (ChatComposer\'s message field), and the Agent\'s composer words open the line, not a pane', async () => {
  assert.match(await read('../../../../desktop/cradle/src/agent/chat/ChatComposer.tsx'), /data-at-search="composer"/)
  const pane = await read('../src/central/searchPane.tsx')
  const hook = pane.slice(pane.indexOf('export function useAtSearch'))
  assert.match(hook, /openSearchLine\(/); assert.doesNotMatch(hook, /openSearchPane\(/)
})

test('the frame mounts the line\'s host and publishes the menu bar\'s commands to it; the line itself loads when first opened', async () => {
  const app = await read('../src/App.tsx')
  assert.match(app, /<SearchLineHost \/>/)
  assert.match(app, /publishMenuCommands\(/)
  const host = await read('../src/central/SearchLineHost.tsx')
  assert.match(host, /import\('\.\/searchLine'\)/, 'a dynamic import')
  assert.doesNotMatch(host, /from '\.\/searchLine'/)
  // The gate's own list names it (read as text: importing the gate would run its build here).
  const gate = await read('./first-load-budget.test.mjs')
  const later = gate.slice(gate.indexOf('export const LOADS_LATER'), gate.indexOf('\n]\n', gate.indexOf('export const LOADS_LATER')))
  assert.match(later, /searchLine/)
})
