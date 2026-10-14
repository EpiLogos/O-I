import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// T-LIVE-TORUS-INSTRUMENT leg 3: the owner's determinant and presentation controls, reached through the hosted channel. The shell
// never writes the owner itself: each control sends one validated `instrument` stage command, and a refusal is named.
// Loader as live-torus-instrument.test.mjs.
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
}`)}`, {parentURL: import.meta.url})

// T-LIVE-TORUS-INSTRUMENT leg 5: the Live browser's categories, the instrument's chain (the torus first, then the effect faces), the
// Presets seam, and the ported generator faces kept reachable under Legacy generators. Nothing is unregistered.
globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const here = new URL('../src/', import.meta.url)
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readFileSync} = await import('node:fs')
await import('../src/live/LiveInstrumentSection.tsx')
await import('../src/live/LivePresets.tsx')
await import('../src/panels/devices/index.tsx')
await import('../src/panels/devices-pro/index.ts')
const panels = await import('../src/shell/panels.ts')
const chainModel = await import('../src/live/liveChain.ts')
const browser = await import('../src/components/BrowserPane.tsx')
const presets = await import('../src/live/LivePresets.tsx')
const torus = await import('../src/live/torusInstrument.ts')
const chain = await import('../src/components/DeviceChainPanel.tsx')
import {readFile} from 'node:fs/promises'

// The bottom-slot faces: the generic stored-parameter editors and the devices-pro faces (frozen as the corpus reference). The devices-b2
// faces kept local state and wrote nothing, and were removed (FOUNDATION §7).
const COMMITTED_BOTTOM = ['devices.beat-repeat', 'devices.channel-eq', 'devices.compressor', 'devices.echo', 'devices.eq-three', 'devices.erosion', 'devices.filter-delay', 'devices.gate', 'devices.glue-compressor', 'devices.grain-delay', 'devices.limiter', 'devices.overdrive', 'devices.phaser-flanger', 'devices.redux', 'devices.reverb', 'devicespro.echo', 'devicespro.glue-compressor', 'devicespro.operator', 'devicespro.rack.echo', 'devicespro.rack.glue-compressor', 'devicespro.rack.operator', 'devicespro.rack.reverb', 'devicespro.rack.wavetable', 'devicespro.reverb', 'devicespro.wavetable']
const LEGACY = ['devicespro.operator', 'devicespro.rack.operator', 'devicespro.wavetable', 'devicespro.rack.wavetable']
const ctx = {set: null, loading: false, error: null}
const selection = {track: 0, clip: undefined, scene: null}

// ── 1 — the browser's categories ──────────────────────────────────────────

test('the Live browser categories are the instrument\'s: Presets, Instruments, Chain devices, Samples, Views — and nothing else', () => {
  assert.deepEqual([...browser.LIVE_BROWSER_CATEGORIES], ['Presets', 'Instruments', 'Chain devices', 'Samples', 'Views'])
})

test('the browser holds no generator or drum catalogue, and opens on the instrument', async () => {
  const source = await readFile(new URL('components/BrowserPane.tsx', here), 'utf8')
  const categories = source.slice(source.indexOf('LIVE_BROWSER_CATEGORIES: readonly'), source.indexOf('/** The Live views'))
  for (const removed of ['Sounds', 'Drums', 'Audio Effects', 'MIDI Effects', 'Max for Live', 'Clips', 'Grooves', 'Tunings']) {
    assert.doesNotMatch(categories, new RegExp(`'${removed}'`), removed)
  }
  assert.match(source, /useState\('Instruments'\)/)
})

test('the Presets and Instruments sections are the browser sections of their categories', () => {
  const ids = panels.getPanels('browser-section').map(p => p.id)
  assert.ok(ids.includes('Presets'))
  assert.ok(ids.includes('Instruments'))
})

// ── 2 — Presets: the owner's seam, named; no shell store ───────────────────

test('Presets list through the owner route and store nothing in the shell or the browser', async () => {
  const markup = renderToStaticMarkup(React.createElement(presets.LivePresetsSection))
  assert.match(markup, /data-live-presets="listing"/, 'the section asks the owner for its bases; it keeps none')
  const source = await readFile(new URL('live/LivePresets.tsx', here), 'utf8')
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|IndexedDB/)
  assert.match(source, /commitLivePerformance\(\{action: 'list'\}\)/)
})

// ── 3 — the chain: the torus first, then the selected track's own devices ─

test('the legacy generators are exactly the four devices-pro generator faces', () => {
  assert.deepEqual(chainModel.legacyGeneratorPanels().map(p => p.id).sort(), [...LEGACY].sort())
})

test('with no set the device side is the keyboard and the torus, then one waiting line — never the registry; the clip side carries no faces', () => {
  torus.publishLiveTorusState({ok: true, determinants: null,
    value: {schema: 'ql.instrument-reading/v1', standing: 'following', identity: {event_ref: 'event:chain'}},
    parameters: {muted: true, level: 1, scale: {unitsPerMetre: 120, mode: 'domain-follow'}, cadence: null, refusal: null}})
  let device
  try { device = renderToStaticMarkup(React.createElement(chain.DeviceChainPanel, {ctx, document: null, selection, mode: 'device'})) }
  finally { torus.publishLiveTorusState(null) }
  assert.ok(device.indexOf('data-live-torus=') >= 0, 'the instrument is on the chain once published')
  assert.doesNotMatch(device, /data-chain-device=/, 'no registered face stands on a chain with no track')
  assert.ok(device.indexOf('data-live-chain-waits') > device.indexOf('data-live-torus='), 'the line where the track\'s devices would stand follows the torus')
  const clip = renderToStaticMarkup(React.createElement(chain.DeviceChainPanel, {ctx, document: null, selection, mode: 'clip'}))
  assert.doesNotMatch(clip, /data-live-torus=|data-chain-device=/)
})

test('with a set, the chain is the selected track\'s devices in order, each a plate: the owner\'s table where one exists, else the document read losslessly', () => {
  const set = {path: '/sets/demo.als', tracks: [{name: 'Pad', kind: 'midi', devices: ['Reverb', 'PluginDevice', 'Echo']}, {name: 'Bass', kind: 'midi', devices: ['Gate']}]}
  const markup = renderToStaticMarkup(React.createElement(chain.DeviceChainPanel, {ctx: {set, loading: false, error: null}, document: null, selection, mode: 'device'}))
  assert.deepEqual([...markup.matchAll(/data-chain-device="([^"]+)"/g)].map(m => m[1]), ['Reverb', 'PluginDevice', 'Echo'], 'every device of the track, in track order')
  assert.equal((markup.match(/data-device-size="compact"/g) ?? []).length, 3, 'each one a plate of the runtime (live/SetDeviceOnChain.tsx)')
  assert.doesNotMatch(markup, /Gate/, 'another track\'s devices are not on this chain')
  assert.equal(chainModel.trackDeviceFaceTitle('Reverb'), 'Reverb', 'Reverb reads and writes through its stored-parameter table once the owner\'s table is read')
  assert.equal(chainModel.trackDeviceFaceTitle('PluginDevice'), undefined, 'a plug-in has none: its plate reads the document')
})

// ── 4 — the generator faces are reachable under Legacy generators ───────

test('the Instruments section names the legacy generators and renders each of the six faces', () => {
  const section = panels.getPanels('browser-section').find(p => p.id === 'Instruments')
  const markup = renderToStaticMarkup(React.createElement(section.component, ctx))
  assert.match(markup, /aria-label="Legacy generators"/)
  assert.match(markup, /The torus is the instrument; these faces remain until its chain carries their capacities\./)
  for (const id of LEGACY) assert.match(markup, new RegExp(`data-legacy-generator="${id.replace(/\./g, '\\.')}"`), id)
})

// ── 5 — the registered faces ─────────────────────────────────────────

test('the registered bottom faces are the generic editors and the frozen devices-pro faces, each with an id and title', () => {
  const registered = panels.getPanels('bottom').map(p => p.id).sort()
  assert.deepEqual(registered, [...COMMITTED_BOTTOM].sort())
  for (const panel of panels.getPanels('bottom')) assert.ok(panel.title && panel.component, panel.id)
})

test("the opened set's own devices stay browsable: its instruments under Instruments, every other device (plug-ins too) under Chain devices", () => {
  const set = {path: '/sets/demo.als', tracks: [{devices: ['Operator', 'Reverb', 'PluginDevice']}, {devices: ['Simpler', 'Delay']}]}
  const ctx = {set, openSet: () => {}}
  const html = renderToStaticMarkup(React.createElement(browser.BrowserPane, {defaultSet: '', ctx}))
  const listed = [...html.matchAll(/data-browser-set-device="([^"]+)"/g)].map(m => m[1])
  assert.deepEqual(listed, ['Operator', 'Simpler'], 'the browser opens on Instruments, listing the set\'s own instruments')
  const source = readFileSync(new URL('../src/components/BrowserPane.tsx', import.meta.url), 'utf8')
  assert.match(source, /category === 'Instruments' \? INSTRUMENTS\.has\(name\) : category === 'Chain devices' && !INSTRUMENTS\.has\(name\)/, 'plug-ins and effects list under Chain devices')
})
