// O-I #747 round 892, XT01 (manual §16.6 Arrangement view; §20.1 "Each Expression is a track with its picture lane over its sound lane"):
// walk 891 (captures-13/14, 44-arrangement-tracks.png) found the Arrangement's head column cutting what it holds — "Dawn field: visual"
// drawn "Dawn field: vis" beside its Activator, Solo and Arm, and the ruler's own tools "⌗ grid" and "Insert" drawn "gri" and "Inse" — a
// column of 132 px whatever its heads held. The kit's no-cut guards (device-grammar-748: a Section widens to its longest name) read the
// devices' sections and never reach the tracks' heads. Now the column is as wide as its widest head lays out (ArrangementRuler.tsx
// fitHeadColumn), never under its own 132 px, and every head in it is that one width, so the lanes stay in line. Walk 892 then saw the
// sound lane's Volume drawn half under the next lane: the 22 px lane held a head of two lines. A lane is as high as its head's lines.
// Channel: LAID OUT — the Arrangement drawn in Chromium on the Expressions mode's own tracks (modeTracks.ts nativeTracks over a kernel
// document, through the Expressions model's bridge and the scenes projection), with the cut modes a set carrying its cuts shows, under a
// long title, and under nested groups; every element in every head measured as the browser lays it out.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {fileURLToPath} from 'node:url'
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href
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
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const app = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const boundary = new URL('packages/expressions-boundary/src/', root)
const [model, {kernelDocumentToJourney}, {projectNativeScenes}, {nativeTracks}] = await Promise.all([
  import(new URL('model.ts', app)),
  import(new URL('kernelDocumentBridge.ts', app)),
  import(new URL('scenes.ts', boundary)),
  import('../src/frame/tracks/modeTracks.ts'),
])
const E = 'expression:dawn'
const S = n => `${E}:scene:s${n}`
/** The Expressions mode's own tracks over a kernel document of three scenes (Dawn, Noon, Dusk), the work named `title`. */
function tracksOf(title, mixer = false) {
  const scenes = ['Dawn', 'Noon', 'Dusk'].map((name, i) => {
    const scene = model.blankScene(name); scene.id = S(i + 1); scene.duration = [10, 8, 6][i]; scene.transition = 1
    return {scene_ref: scene.id, revision: 1, title: name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}}
  })
  const view = kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 4, title, scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []})
  const content = {basis: {expression_ref: E, revision: 4, scene_ref: S(1)}, playback: {scene_ref: S(1), scene_playing: false, saved_sequence_playing: false},
    scenes: projectNativeScenes(view.journey, view)}
  // With its mixer read (as the walk's frame reads it): each lane's head carries its Volume on a line of its own, and the Main track stands.
  const sound = {op: 'sound', active: true, soloOn: false, level: 1, main: 1, activate() {}, solo() {}, setLevel() {}, setMain() {}}
  return JSON.parse(JSON.stringify(nativeTracks(content, title, mixer ? {controls: {sound}} : {})))
}
/** A set of nested groups, each track three deep, as a Live set lays its groups (rails in the head). */
function nested() {
  const set = tracksOf('Dawn field')
  const [visual, audio] = set.tracks
  return {...set, tracks: [{...visual, id: 'group:a', name: 'Morning group', kind: 'group'}, {...visual, id: 'group:b', name: 'Inner group', kind: 'group', parentId: 'group:a'},
    {...visual, parentId: 'group:b'}, {...audio, parentId: 'group:b'}]}
}

// In the page: the shared Arrangement (ArrangementRuler.tsx) drawn on a set — with the cuts a set carries where it carries them (the
// ruler then shows the Move mode and the Trim mode) — and what is cut, out of line or under the column's own width in its heads.
const LAID_OUT = `
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {createElement as h} from 'react'
import {ArrangementRuler} from './src/frame/tracks/ArrangementRuler'
import './src/styles.css'
const press = {op: 'a cut', run() { return {ok: true} }}
;(window as any).__lay = async (set: any, cuts: boolean) => {
  const host = document.createElement('div')
  host.style.cssText = 'position:relative;width:1100px;height:420px'
  document.body.appendChild(host)
  const shown = cuts ? {...set, actions: {...set.actions, moveClip: press, trimClip: press, rollClip: press, slipClip: press, slideClip: press}} : set
  const root = createRoot(host)
  flushSync(() => root.render(h(ArrangementRuler, {set: shown, selection: {select() {}}})))
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  const faults: string[] = []
  const heads = [...host.querySelectorAll<HTMLElement>('.tl-ruler > .tl-head, .tl-lane > .tl-head')]
  for (const head of heads)
    for (const x of [head, ...head.querySelectorAll<HTMLElement>('*')].filter(x => x instanceof HTMLElement && x.clientWidth > 0))
      if (x.scrollWidth > x.clientWidth + .5) faults.push('"' + (x.textContent ?? '').trim() + '" is cut (' + x.clientWidth + ' of ' + x.scrollWidth + ' px)')
  // Nothing in a head stands past its foot or above its top: the lane's height holds the head's lines (walk 892: the sound lane's Volume
  // drawn half under the next lane).
  for (const head of heads) {
    const box = head.getBoundingClientRect()
    for (const x of [...head.querySelectorAll<HTMLElement>('*')].filter(x => x.getBoundingClientRect().height > 0)) {
      const r = x.getBoundingClientRect()
      if (r.bottom > box.bottom + .5 || r.top < box.top - .5)
        faults.push('"' + ((x.textContent || x.getAttribute('aria-label')) ?? '').trim().slice(0, 40) + '" stands past its head (' + Math.round(r.top - box.top) + '–' + Math.round(r.bottom - box.top) + ' px in a head ' + Math.round(box.height) + ' px high)')
    }
  }
  const widths = [...new Set(heads.map(head => Math.round(head.getBoundingClientRect().width)))]
  if (widths.length !== 1) faults.push('the head column is not one width: ' + widths.join(', ') + ' px')
  if (Math.min(...widths) < 132) faults.push('the head column is under its own 132 px: ' + Math.min(...widths) + ' px')
  const names = heads.map(head => (head.querySelector('.tl-name') ?? head).textContent ?? '')
  root.unmount(); host.remove()
  return {faults, widths, names, heads: heads.length}
}
;(window as any).__ready = true
`

test('XT01: the Arrangement\'s head column holds every head whole — a track\'s name beside its switches, the ruler\'s tools and cut modes — and stays one width', {timeout: 300_000}, async t => {
  const {bundleEntry, shellHtml, playwright} = await import('./support/agentShellHarness.mjs')
  const ui = fileURLToPath(new URL('..', import.meta.url))
  const {js, css} = await bundleEntry({contents: LAID_OUT, resolveDir: ui, sourcefile: 'arrangement-heads.tsx', outfile: 'arrangement-heads.mjs'})
  const cases = [['the walk\'s Expression, its cuts carried', tracksOf('Dawn field'), true], ['the same, carrying no cuts', tracksOf('Dawn field'), false],
    ['its mixer read, each head\'s Volume on its own line', tracksOf('Dawn field', true), true],
    ['a long title', tracksOf('The tide that comes in at first light'), true], ['nested groups', nested(), true]]
  // Chromium, and WebKit: the desktop host draws the shell in WebKit on macOS.
  let engines = 0
  for (const engine of ['chromium', 'webkit']) {
    let browser
    try { browser = await playwright()[engine].launch() } catch (error) { console.log(`no ${engine} to lay the Arrangement out in: ${String(error?.message ?? error).split('\n')[0]}`); continue }
    engines += 1
    try {
      const tab = await browser.newPage({viewport: {width: 1420, height: 900}})
      const errors = []
      tab.on('pageerror', error => errors.push(String(error).split('\n')[0]))
      await tab.setContent(shellHtml({js, css}), {waitUntil: 'load'})
      await tab.waitForFunction(() => window.__ready, null, {timeout: 60_000}).catch(error => { throw Error(`${error.message} ${errors.join(' | ')}`) })
      const faults = [], seen = []
      for (const [named, set, cuts] of cases) {
        const laid = await tab.evaluate(([set, cuts]) => window.__lay(set, cuts), [set, cuts])
        seen.push(`${engine} · ${named}: ${laid.heads} heads at ${laid.widths.join('/')} px`)
        faults.push(...laid.faults.map(fault => `${engine} · ${named}: ${fault}`))
        assert.ok(laid.names.some(name => name.startsWith(set.tracks.at(-1).name)), `${named}: the tracks are drawn (${laid.names.join(' | ')})`)
      }
      console.log(seen.join('\n'))
      assert.deepEqual(errors, [], `${engine}: the Arrangement draws without an error`)
      assert.deepEqual(faults, [], `${engine}: a head in the Arrangement\'s column is cut, past its foot, out of line, or under the column\'s own width`)
    } finally { await browser.close() }
  }
  if (!engines) t.skip('no browser to lay the Arrangement out in')
})
