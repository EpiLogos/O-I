import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// O-I #747 round 884, XS08 ("I set when scenes launch"), ruled from the manual (DLW build ruling 2026-11-06; DLW.md §10.5 "Quantize | Set
// when scenes launch", §20.1 The Launch panel "Global, or one of the transport's values"): the transport shows the Quantize the
// Expression keeps and sets it through its owner, the scene's own chooser offers Global and Live's values, and a launch the frame holds
// for its boundary shows as waiting, with Live's blinking launch, until it lands.
// Channels: FIXTURE readings in the owner's shape (expressions-boundary/src/scenes.ts, its playback `launch_pending`), projected through
// frame/tracks/modeTracks.ts and SCRIPTED through the shared grid to static markup. Not a screen pass. Loader as session-grid-readings.
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
const {nativeTracks} = await import('../src/frame/tracks/modeTracks.ts')
const {SessionGridView} = await import('../src/inhabitants/catalogue/panels/dlw__session-grid.tsx')
const playback = await import('../src/components/nativeScenePlayback.ts')

const noop = () => {}
const grid = set => renderToStaticMarkup(React.createElement(SessionGridView,
  {set, selection: {select: noop}, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop}))
/** FIXTURE: the open Expression as the native content holds it; Opening plays, Second is launched and waits for the bar. */
const content = (pending = {scene_ref: 's2', at_seconds: 4}) => ({
  basis: {expression_ref: 'expression:w', scene_ref: 's1'},
  playback: {scene_ref: 's1', scene_playing: true, saved_sequence_playing: false, scene_elapsed_seconds: 1.2, ...(pending === 'absent' ? {} : {launch_pending: pending})},
  scenes: {loop: false, launch_quantize: '1 bar', timing: {working: {available: true}, saved: {available: false, reason: 'no saved sequence'}},
    scenes: [
      {scene_ref: 's1', title: 'Opening', native_title: 'n1', working: {duration: 12, transition: 0}, snapshot: {duration: null}, material: {available: true, reason: null}},
      {scene_ref: 's2', title: 'Second', native_title: 'n2', working: {duration: 4, transition: 0}, snapshot: {duration: null}, material: {available: true, reason: null}},
    ]},
})
const visual = set => set.clips.filter(clip => clip.id.endsWith(':visual'))

test('XS08: a launched scene waits for its boundary as Live\'s blinking launch, and says when it lands; the playing scene runs on', () => {
  const set = nativeTracks(content(), 'Work')
  assert.deepEqual(visual(set).map(clip => [clip.label, clip.status]), [['Opening', 'running'], ['Second', 'waiting']])
  const second = visual(set)[1]
  assert.match(second.note ?? '', /Launched: it lands at 4\.00 s of the playing scene, on its Quantize\./)
  assert.match(grid(set), /class="[^"]*\bclip\b[^"]*\bwaiting\b/, 'drawn waiting: the grid\'s fast blink (tracks.css .cs.clip.waiting)')
  for (const none of [null, 'absent']) assert.deepEqual(visual(nativeTracks(content(none), 'Work')).map(clip => clip.status), ['running', 'stopped'], 'nothing waits')
  // A launch of the scene that plays waits too: it starts again at the boundary.
  assert.deepEqual(visual(nativeTracks(content({scene_ref: 's1', at_seconds: 4}), 'Work')).map(clip => clip.status), ['waiting', 'stopped'])
})

test('XS08: the transport\'s Quantize and the scene\'s chooser offer Live\'s values; the transport shows the Expression\'s and sets it through its owner', () => {
  const LIVE = ['None', '8 Bars', '4 Bars', '2 Bars', '1 Bar', '1/2', '1/2T', '1/4', '1/4T', '1/8', '1/8T', '1/16', '1/16T', '1/32']
  assert.deepEqual(playback.EXPRESSIONS_LAUNCH_QUANTIZE.map(option => option.label), LIVE)
  assert.deepEqual(playback.EXPRESSIONS_LAUNCH_QUANTIZE.map(option => option.value), ['none', '8 bars', '4 bars', '2 bars', '1 bar', '1/2', '1/2t', '1/4', '1/4t', '1/8', '1/8t', '1/16', '1/16t', '1/32'])
  assert.deepEqual(playback.EXPRESSIONS_SCENE_QUANTIZE.map(option => option.label), ['Global', ...LIVE], 'a scene: Global, or one of the transport\'s values')
  const sent = []
  const slot = playback.quantizeSlot({value: '1 bar', reason: null, send: value => sent.push(value)})
  assert.match(slot.title, /^Scene quantize — when a launched scene lands: 1 Bar\./)
  const select = slot.control
  assert.equal(select.type, 'select'); assert.equal(select.props.value, '1 bar'); assert.equal(select.props.disabled, false)
  assert.deepEqual(React.Children.toArray(select.props.children).map(option => option.props.children), LIVE)
  select.props.onChange({target: {value: '1/4'}})
  assert.deepEqual(sent, ['1/4'], 'one owner request with the chosen value')
  select.props.onChange({target: {value: '1 bar'}}); select.props.onChange({target: {value: 'beat'}})
  assert.deepEqual(sent, ['1/4'], 'the value it keeps, or a word that is not Live\'s, sends nothing')
  const busy = playback.quantizeSlot({value: '1 bar', reason: 'The native editor is busy or not attached.', send: noop})
  assert.equal(busy.control.props.disabled, true); assert.match(busy.title, /The native editor is busy or not attached\./)
  const unread = playback.quantizeSlot({value: null, reason: null, send: noop})
  assert.deepEqual(unread.readout, {value: '—', title: 'Scene quantize — the Expression\'s owner has not said which Quantize it keeps.'})
  assert.equal(unread.control, undefined)
})
