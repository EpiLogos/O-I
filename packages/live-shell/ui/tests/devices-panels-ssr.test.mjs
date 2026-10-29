import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

// The device-panel SSR smoke — the round-2 gates' render check for the
// generic DevicePanel family in `src/panels/devices/`. It imports the three
// device-panel modules the frame's `src/panels/index.ts` activates
// (devices, devices-pro), renders every registered device face
// through `react-dom/server` against a null set (the honest "no set open"
// state — SSR never runs effects, so no fetch is simulated) and against a
// set carrying the device (the "reading parameter tables…" state), and fails
// on any render that throws, any missing face for the nine devices added in
// round 2, or any id collision across the family.
//
// Production sources in memory, same loader pattern as the sibling tests:
// .ts/.tsx transpiled, .css stubbed. The panel modules inject their styles
// through `document` at import time, so a minimal document shim stands in
// (SSR has no DOM and the styles are inert here).
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
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
}`)}`, { parentURL: import.meta.url })

// The style-install shim: the modules' installStyle() calls document at
// import time; nothing else in the panels touches the DOM under SSR.
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({}),
  head: { appendChild: () => {} },
}

const { renderToStaticMarkup } = await import('react-dom/server')
const React = await import('react')
await import('../src/panels/devices/index.tsx')
await import('../src/panels/devices-pro/index.ts')
// The devices-pro faces load when Live's chain first shows them (shell/loadWhenDrawn.ts; O-I #740): fetched first, so every face
// renders itself here, not its waiting line.
await (await import('../src/shell/loadWhenDrawn.ts')).loadEveryPart()
const { allPanels } = await import('../src/shell/panels.ts')

const htmlOf = (element) => renderToStaticMarkup(element)

/** The nine faces added in round 2 (id -> element name the panel binds). */
const ROUND_2 = [
  ['devices.gate', 'Gate'],
  ['devices.erosion', 'Erosion'],
  ['devices.limiter', 'Limiter'],
  ['devices.filter-delay', 'FilterDelay'],
  ['devices.beat-repeat', 'BeatRepeat'],
  ['devices.channel-eq', 'ChannelEq'],
  ['devices.eq-three', 'FilterEQ3'],
  ['devices.grain-delay', 'GrainDelay'],
  ['devices.phaser-flanger', 'PhaserNew'],
]

const ctx = (set) => ({ set, loading: false, error: null, openSet: () => {} })

test('the nine round-2 faces are registered on the live detail host', () => {
  const panels = allPanels()
  for (const [id] of ROUND_2) {
    const panel = panels.find((p) => p.id === id)
    assert.ok(panel, `panel ${id} is registered`)
    assert.equal(panel.slot, 'bottom', `${id} renders in the live detail host`)
    assert.ok(panel.title && panel.note, `${id} carries its title and note`)
  }
  const ids = panels.map((p) => p.id)
  assert.equal(new Set(ids).size, ids.length, 'no duplicate panel ids')
})

test('every registered device panel renders clean with no set open', () => {
  for (const panel of allPanels()) {
    const html = htmlOf(React.createElement(panel.component, ctx(null)))
    assert.ok(html.length > 0, `${panel.id} renders markup`)
    assert.ok(!html.includes('undefined'), `${panel.id} renders no undefined`)
    assert.ok(!html.includes('data-part-loading'), `${panel.id} renders its face, not its waiting line`)
  }
})

test('each round-2 face states the honest "no set open" state without a set', () => {
  for (const [id] of ROUND_2) {
    const panel = allPanels().find((p) => p.id === id)
    const html = htmlOf(React.createElement(panel.component, ctx(null)))
    assert.ok(html.includes('no set open'), `${id} names the missing set honestly`)
  }
})

test('each round-2 face reaches the descriptor-reading state for a set carrying the device', () => {
  for (const [id, element] of ROUND_2) {
    const set = { path: '/x/set.als', tempo: 120, scenes: 1, tracks: [{ kind: 'audio', name: 'Track', devices: [element] }] }
    const panel = allPanels().find((p) => p.id === id)
    const html = htmlOf(React.createElement(panel.component, ctx(set)))
    assert.ok(html.includes('reading parameter tables'), `${id} reads its table from the seam`)
  }
})
