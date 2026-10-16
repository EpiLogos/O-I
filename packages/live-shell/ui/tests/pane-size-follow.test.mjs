import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Lane F, F1 (owner, 16 Oct, watching the native candidate: "the resizing of the pane content per the changes to viewport size
// with sidebar toggle changes - cont in general"). The ported atlas re-measured on the window's resize alone; hosted, it is a pane
// in the shell's own document, and a pane changes size without the window (the browser, the widget rail or the detail area
// toggled, a split). Seen natively: the Earth drawn as an ellipse that stayed. The atlas now follows its pane's box through one
// observer under its lifetime (ui/lifetime.ts followSize); the window's resize stays for a change of devicePixelRatio. Headless
// (lane F, Chromium on the GPU, 1372×892): every canvas and iframe in every mode redraws to its box after each toggle — see the
// lane's report. Channel here: scripted (the lifetime's observer) and code-reading (the three adapted modules, the pin).
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

/** A ResizeObserver stand-in: records what it observes, reports on demand, says whether it is still connected. */
class FakeResizeObserver {
  static made = []
  constructor(callback) { this.callback = callback; this.targets = []; this.connected = true; FakeResizeObserver.made.push(this) }
  observe(target) { this.targets.push(target) }
  disconnect() { this.connected = false }
  report() { if (this.connected) this.callback([]) }
}
globalThis.ResizeObserver = FakeResizeObserver

const lifetime = await import('../src/projections/atlas/src/ui/lifetime.ts')
const port = path => readFile(new URL(`../src/projections/atlas/src/${path}`, import.meta.url), 'utf8')

test('the atlas follows the box it lays out in: the observer reports every change, and the atlas lifetime releases it', () => {
  FakeResizeObserver.made.length = 0
  const life = lifetime.beginLifetime()
  try {
    const pane = {name: 'the .atlas-host pane'}
    let sized = 0
    const stop = lifetime.followSize(pane, () => { sized++ })
    const [observer] = FakeResizeObserver.made
    assert.ok(observer, 'one observer is made')
    assert.deepEqual(observer.targets, [pane], 'it observes the element the atlas lays out in, not the window')
    observer.report(); observer.report()
    assert.equal(sized, 2, 'each change of the pane box runs the handler (the browser toggled, then the detail)')
    assert.equal(typeof stop, 'function', 'the follow returns its own release, for a view that leaves before the atlas does')
  } finally {
    life.dispose()
  }
  assert.equal(FakeResizeObserver.made[0].connected, false, 'the atlas lifetime disconnects it: a closed pane leaves no observer')
})

test('a follow released early leaves the lifetime; nothing is observed while no atlas is mounted', () => {
  FakeResizeObserver.made.length = 0
  const life = lifetime.beginLifetime()
  try {
    const stop = lifetime.followSize({}, () => {})
    stop()
    assert.equal(FakeResizeObserver.made[0].connected, false, 'its own release disconnects it at once')
  } finally {
    life.dispose()
  }
  FakeResizeObserver.made.length = 0
  lifetime.followSize({}, () => { throw Error('never') })
  assert.deepEqual(FakeResizeObserver.made.map(o => o.targets.length), [], 'no lifetime, no observation (a late callback starts nothing)')
})

test('the globe, the controller and the walk strip each follow their box, and the window resize stays for the pixel ratio', async () => {
  const engine = await port('globe/engine.ts')
  assert.match(engine, /listen\(window, 'resize', this\.onResize\);\s*followSize\(this\.parent, this\.onResize\);/, 'the globe: the window (pixel ratio) and its parent\'s box')
  assert.match(engine, /if \(!w \|\| !h\) return;/, 'a hidden pane (0 × 0) keeps the last size: the camera never takes a 0/0 aspect')
  const controller = await port('app/controller.ts')
  assert.match(controller, /listen\(window, 'resize', relayout\);[\s\S]{0,400}followSize\(hostElement\(this\.root\) \?\? this\.root, relayout\);/,
    'the controller\'s window handlers (rig, shift, strip, label, graph insets) also run on the pane\'s box')
  const strip = await port('ui/walk-strip.ts')
  assert.match(strip, /stopFollow = followSize\(this\.viewport, onResize\);/, 'the walk strip re-centres on its own width')
})

test('the atlas port keeps its pin true: the three adapted modules and the lifetime say what lane F changed', async () => {
  const {checkPort, portHashes, PIN_PATH} = await import('../scripts/atlas-port-pin.mjs')
  const pin = JSON.parse(await readFile(PIN_PATH, 'utf8'))
  const {faults} = await checkPort(pin, await portHashes())
  assert.deepEqual(faults, [], 'every port module equals its pinned bytes or is a recorded adaptation')
  for (const path of ['globe/engine.ts', 'app/controller.ts', 'ui/walk-strip.ts']) assert.match(pin.adapted[path], /\[lane F\] the pane is the viewport/, `${path} records the adaptation`)
  assert.match(pin.portNew['ui/lifetime.ts'], /\[lane F\].*followSize/, 'the port-new lifetime records followSize')
})
