import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// FOUNDATION F4: one detail host. Every clip editor sits under the same shell-owned clip box, which reads THE selection
// and the clip as the mode's tracks give it. Loader as live-browser-chain.test.mjs.
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
const {ClipBox} = await import('../src/frame/detail/ClipBox.tsx')
const {publishShownTracks} = await import('../src/frame/tracks/tracksDoor.ts')
const {MODE_TRACKS} = await import('../src/frame/tracks/modeTracks.ts')
const {readFile} = await import('node:fs/promises')

const set = {path: '/sets/demo.als', tempo_bpm: 120, scene_count: 1, arrangement_clips: 1, tracks: [{kind: 'midi', name: 'Pad', devices: []}]}
const doc = {path: '/sets/demo.als', tempo: 120, scenes: 1, tracks: [{kind: 'midi', name: 'Pad', devices: [], arrangementClips: [{name: 'Intro', kind: 'midi', start: 4, end: 12}], sessionSlots: {'0': 'A'}}]}
const reading = (selectedRef) => ({mode: 'live', set, document: doc, colors: ['#79b6ce'], selection: {track: 0, scene: null}, select() {}, setColor() {}, selectedRef, selectTrackItem() {}})

test('the clip box shows the selected clip as its mode\'s tracks give it: name, colour, track, place, and what is not disclosed', () => {
  const shown = reading('als:/sets/demo.als#track/0/clip/0')
  publishTimelineReading(shown)
  // The tracks pane publishes the set it draws (frame/tracks/tracksDoor.ts); the clip box reads that, never the owner again.
  publishShownTracks(MODE_TRACKS[shown.mode](shown))
  const markup = renderToStaticMarkup(React.createElement(ClipBox))
  assert.match(markup, /data-clip-box="als:\/sets\/demo\.als#track\/0\/clip\/0"/)
  assert.match(markup, />Intro</); assert.match(markup, />Pad</)
  assert.match(markup, />2\.1 – 4\.1</, 'where it starts and ends, on the set\'s own ruler')
  assert.match(markup, /state not disclosed/); assert.match(markup, /launch not disclosed/)
  assert.match(markup, /--tc:#79b6ce/)
})

test('with nothing of this mode selected, the clip box stands down', () => {
  publishTimelineReading(reading('Control/agents/now/day/2026-10-14.md'))
  assert.equal(renderToStaticMarkup(React.createElement(ClipBox)), '')
  publishTimelineReading(null); publishShownTracks(null)
})

test('App mounts one detail residence, the host, and the status bar reads Clip | Device in every mode', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.equal((app.match(/className="detail-residence"/g) ?? []).length, 1)
  assert.match(app, /<DetailHost side=\{detailMode\} \/>/)
  const bar = await readFile(new URL('../src/components/StatusBar.tsx', import.meta.url), 'utf8')
  assert.match(bar, /<span>Clip<\/span>/); assert.match(bar, /<span>Device<\/span>/)
})
