import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// FOUNDATION F4: one detail host. THE selection is read once, as the mode's tracks give it (frame/detail/ClipBox.tsx
// selectedClipOf), and every mode's Clip view is its designed clip on its binding (R2; the shell-owned clip box strip is retired:
// a clip's name, colour, launch and follow are its Clip view's head, Clip and Launch panels). Loader as live-browser-chain.test.mjs.
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

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {publishTimelineReading} = await import('../src/projections/timelinePaneHost.ts')
const {selectedClipOf} = await import('../src/frame/detail/ClipBox.tsx')
const {publishShownTracks} = await import('../src/frame/tracks/tracksDoor.ts')
const {MODE_TRACKS} = await import('../src/frame/tracks/modeTracks.ts')
// The frame's lazy parts (a mode's bodies, its transport and tracks, a device's face) load when first drawn (shell/loadWhenDrawn.ts;
// O-I #740); a server render cannot wait for a module, so they are fetched first and every body renders itself.
await (await import('../src/shell/loadWhenDrawn.ts')).loadEveryPart()
const {readFile} = await import('node:fs/promises')

const set = {path: '/sets/demo.als', tempo_bpm: 120, scene_count: 1, arrangement_clips: 1, tracks: [{kind: 'midi', name: 'Pad', devices: []}]}
const doc = {path: '/sets/demo.als', tempo: 120, scenes: 1, tracks: [{kind: 'midi', name: 'Pad', devices: [], arrangementClips: [{name: 'Intro', kind: 'midi', start: 4, end: 12}], sessionSlots: {'0': 'A'}}]}
const reading = (selectedRef) => ({mode: 'live', set, document: doc, colors: ['#79b6ce'], selection: {track: 0, scene: null}, select() {}, setColor() {}, selectedRef, selectTrackItem() {}})

test('THE selection names the clip in the tracks the pane shows: the clip, its track and the set, read once', () => {
  const shown = reading('als:/sets/demo.als#track/0/clip/0')
  const set = MODE_TRACKS[shown.mode](shown)
  const selected = selectedClipOf(shown.selectedRef, set)
  assert.equal(selected.clip?.label, 'Intro'); assert.equal(selected.track?.name, 'Pad'); assert.equal(selected.set, set)
  assert.equal(selectedClipOf('Control/agents/now/day/2026-10-14.md', set).clip, null, 'a selection that is no shown clip names none')
  assert.equal(selectedClipOf(null, null).clip, null)
})

test('App mounts one detail residence, the host with its sides, and the status bar reads Clip | Device in every mode', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.equal((app.match(/className="detail-residence"/g) ?? []).length, 1)
  assert.match(app, /<DetailHost sides=\{\{front: detailMode, hidden: hiddenSides\}\} expanded=\{clipExpanded\} \/>/)
  const bar = await readFile(new URL('../src/components/StatusBar.tsx', import.meta.url), 'utf8')
  // The frame never subscribes to the tracks the set's views publish: its own render republishes the reading they draw from, so a
  // subscription there loops without end (React #185, seen as a blank window on the native candidate r30, 20 Oct). The status bar
  // reads the selected track's name where it draws it.
  assert.doesNotMatch(app, /useShownTracks/, 'the frame does not read the shown tracks')
  assert.match(bar, /const shownTracks = useShownTracks\(\)/, 'the status bar reads them where it draws the name')
  // The two switches read Clip | Device in every mode; what each side holds is the mode's registration, said on the Info line
  // (rendered per mode in detail-host.test.mjs).
  assert.match(bar, /data-detail-side="clip"[\s\S]{0,500}<span>\{clipName \?\? 'Clip'\}<\/span>/); assert.match(bar, /data-detail-side="device"[\s\S]{0,500}<span>\{deviceName \?\? 'Device'\}<\/span>/)
})
