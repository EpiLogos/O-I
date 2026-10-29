// Lane BF3: Factory's Main track and Clip side read right (lane BF2's shell proposals 2–5) — the session grid's Main head is a track's
// head that selects the Main track, with no mode branch (frame/tracks/SessionGrid.tsx MainHead, MAIN_TRACK_REF); Factory's Device side
// routes it to the Main track (agent/AgentShellDeviceDetail.tsx) and its head reads Main (shell/modeDetails.tsx); the Clip side draws the
// selected task's Tasks device beside its log (agent/devices/TaskClipDevice.tsx); the browser's Runs open the Run and the Runs (retired:
// #788, the browser has no Runs; a session's attempts are its track's take lanes).
//
// Channels: SCRIPTED (the grid and the head rendered to static markup; the head's press called on its element, recording the
// selection) and code-reading (the routes, where the component needs the live shell).
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
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const grid = await import('../src/frame/tracks/SessionGrid.tsx')
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

const SET = {columns: [{id: 'r1', name: '1'}], tracks: [{id: 'space:s1', name: 'Explain run', kind: 'session'}], clips: [], actions: {grain: 'whole harness'}}
const view = (ref, calls) => renderToStaticMarkup(createElement(grid.SessionGridView, {set: SET, selection: {ref, select: target => calls.push(target)}, folded: {}, onFold() {},
  receipt: null, onPress() {}, onDismiss() {}}))

test('the Main head is a track\'s head: a button that selects the Main track, pressed while it is selected — in every set alike', () => {
  const calls = []
  const markup = view(null, calls)
  assert.match(markup, /<button type="button" class="thd" aria-pressed="false" data-track-head="main" title="Main · every control here acts on the whole harness: the owner takes nothing finer">Main<span class="sg-grain">whole harness<\/span><\/button>/)
  assert.match(view(grid.MAIN_TRACK_REF, calls), /class="thd sel" aria-pressed="true" data-track-head="main"/, 'selected, it stands pressed')
  const head = grid.MainHead({selection: {ref: null, select: target => calls.push(target)}, children: 'Main'})
  head.props.onClick()
  assert.deepEqual(calls, [{kind: 'track', ref: 'main', title: 'Main'}], 'it selects the Main track through THE selection')
  const empty = renderToStaticMarkup(createElement(grid.SessionGridView, {set: {columns: [], tracks: [], clips: []}, selection: {ref: null, select() {}}, folded: {}, onFold() {},
    receipt: null, onPress() {}, onDismiss() {}}))
  assert.match(empty, /aria-label="Stops"><button type="button" class="thd" aria-pressed="false" data-track-head="main"/, 'an empty work\'s Main head selects too')
  assert.doesNotMatch(read('frame/tracks/SessionGrid.tsx'), /'(?:live|base|central|factory|expressions|techne)'/, 'no mode named in the grid')
})

test('Factory routes the Main track: its Device side is the Main track\'s chain and its head reads Main', () => {
  assert.match(read('agent/AgentShellDeviceDetail.tsx'), /shell\.selectedTrackId === MAIN_TRACK_REF \? undefined : tracks\.find/, 'the Main track is no session')
  // REPLACED (lane W1-Factory): the Main track's chain is the Experiment, then Approvals (§16.2, §19.1).
  // REPLACED (#725): the Experiment and Approvals — the Main track is the Run map, Approvals and the prompt pads (§16.2, §19.1; §19.5).
  assert.match(read('shell/modeDetails.tsx'), /if \(!track\) return \{name: 'Main', line: 'Factory\\'s Main track: the Run map, Approvals and the prompt pads'\}/)
})

test('the Clip side hosts the selected task\'s clip (R2): clip:factory on its binding — Launch beside the log — never the Tasks device', async () => {
  // Factory's clip body is its own module, loaded with Factory (shell/details/factory.tsx; O-I #740), registered by the detail table.
  const details = read('shell/details/factory.tsx')
  assert.match(details, /function FactoryClip\(\{place\}: \{place: ClipPlace\}\) \{ return <Hosted binding=\{useFactoryClip\(\)\}/)
  assert.match(read('shell/modeDetails.tsx'), /const FactoryClip: ClipBody = loadWhenDrawn\('Factory\\'s clip', \(\) => import\('\.\/details\/factory'\)/)
  const {existsSync} = await import('node:fs')
  assert.equal(existsSync(new URL('../src/agent/devices/TaskClipDevice.tsx', import.meta.url)), false, 'TaskClipDevice became the task\'s Clip, Launch and Envelopes panels')
  assert.match(read('agent/clipBinding.ts'), /TASK_SEAMS\[setting\]/, 'the per-task settings write through their named seams')
})

// REPLACED (#788): "the browser's Runs: the Factory browser draws the Run and the Runs as devices, a press holding each whole in its
// band". The Run and the Runs were retired as devices (#725, #772) and no chain publishes them, so their rows stood "no chain" for good.
// A session's course is its track in Arrangement view and its attempts are the track's take lanes, the take that stands on the main lane
// (§19.1 "Takes and Arrangement lanes"; timeline/factoryTrackAdapter.ts, agent/factoryTakes.ts, held by factory-attempt-takes.test.mjs),
// so the Factory browser has no Runs category.
test('REPLACED (#788) — the Factory browser lists no Run and no Runs: a session\'s attempts are its track\'s take lanes (§19.1)', () => {
  const browser = read('agent/AgentShellBrowser.tsx')
  assert.doesNotMatch(browser, /\{id: 'runs', label: 'Runs'\}|RUN_DEVICES|\bRUN_ID\b|\bRUNS_ID\b/, 'no Runs category, and no retired device named')
  assert.doesNotMatch(browser, /holdInBand|useIsPublished|publishedDevice/, 'no browser row stands on a device the chain publishes')
  assert.match(read('timeline/factoryTrackAdapter.ts'), /set\.lanes = \{events, \.\.\.\(takePort \? \{takes: takeLanes, comp\} : \{\}\), absent\}/,
    'the attempts stand as the track\'s take lanes, with the comp that chooses the take that stands')
})
