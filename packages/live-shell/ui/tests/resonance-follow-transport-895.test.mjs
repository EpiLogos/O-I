import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

// O-I #747 round 895, OPEN 8 (DLW build ruling 2026-11-08: wired, or their words say exactly why not). Manual §10.5, the Expressions
// column: "Key, root and scale | … | Tune the field's resonance" and "Follow | … | Keep views with the scene". Round 894 found neither
// wired in the Expressions transport, and their waiting words ("The native transport carries the real readings when the owner is
// attached") said more than the code did.
//   The key row now tunes the plate the Resonance drives: ☿ Resonance its tone (Freq), Root the root of its modes (f0), Scale how many
//   of its modes take part (Modes), each the field parameter the Resonance's own dials set, one owner request as Tempo is. The tone is the
//   Resonance's Driver's unless the Driver is Manual: then the slot shows it and says who sets it.
//   Follow holds no switch, and its words say why in the frame's own terms.
// SCRIPTED: the pure slot words and the registry rows over a blank scene. CODE-READING: the hook's wiring, beside key-row-typed-896.test.mjs,
// which draws the hook and types into the key row (round 896, 0R-surface.5).
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

const R = await import('../src/components/resonanceTransport.ts')
const bar = await import('../src/components/nativeBarModel.ts')
const author = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts')
const hook = readFileSync(new URL('../src/shell/transports/useExpressionsTransport.tsx', import.meta.url), 'utf8')

test('the key row is the Resonance\'s Freq, f0 and Modes: the field parameters its own dials set, read from the scene', () => {
  assert.deepEqual(R.RESONANCE_SLOT_PATHS, {key: 'cymatics.frequencyHz', root: 'cymatics.baseFrequency', scale: 'cymatics.modeCount'})
  const dials = readFileSync(new URL('../src/inhabitants/catalogue/panels/expressions__resonance.tsx', import.meta.url), 'utf8')
  for (const path of Object.values(R.RESONANCE_SLOT_PATHS)) assert.match(dials, new RegExp(`key: '${path.replace(/\./g, '\\.')}'`), `${path} is one of the Resonance's dials`)
  const scene = author.blankJourney().scenes[0]
  const rows = Object.values(R.RESONANCE_SLOT_PATHS).map(path => bar.barParameter({scene}, path))
  assert.deepEqual(rows.map(row => [row?.label, row?.target]), [['Drive Frequency', 'field.frequency'], ['Resonator f0', 'field.native_cymatics__baseFrequency'], ['Mode Count', 'field.native_cymatics__modeCount']],
    'the owner\'s own targets for them (nativeParameters.ts NATIVE_BINDINGS)')
})

// Who sets the plate's tone, as the engine resolves it (nativeBridge.ts resonanceDrive; torusDrive.ts: under the Torus driver, Key source
// Manual takes the resonance that was set; DLW §20.14 Rules: "Drive frequency is the live drive only while the driver is Manual, or Automation
// without a sweep"; §20.2: Key source "Manual uses the resonance you set"). Read from the scene's own values, never a row's label.
const sceneWith = (composition, engine = {}) => {
  const scene = author.blankJourney().scenes[0]
  return {...scene, composition: {...scene.composition, ...composition}, engine: {...scene.engine, resonanceEnabled: true, ...engine}}
}
test('the tone takes the transport wherever Drive frequency is the live drive, and says who sets it everywhere else', () => {
  const at = (composition, engine) => R.resonanceRefusal('key', R.plateDriveOf(sceneWith(composition, engine)), true)
  assert.equal(at({frequencyDriver: 'manual'}), null, 'Manual: the tone is yours')
  assert.equal(at({frequencyDriver: 'automation'}, {autoSweep: false}), null, 'Automation without a sweep: Drive frequency is the live drive')
  assert.equal(at({frequencyDriver: 'torus', keySource: 'manual'}), null, 'Torus with Key source Manual takes the resonance you set')
  const either = 'choose Manual as the Field\'s Key source, or as the Resonance\'s Frequency driver, to tune it here.'
  assert.equal(at({frequencyDriver: 'torus', keySource: 'torus'}), `The Torus sets the plate's tone now: ${either}`)
  assert.equal(at({frequencyDriver: 'torus', keySource: undefined}), `The Torus sets the plate's tone now: ${either}`, 'a scene with no Key source reads as Torus')
  assert.equal(at({frequencyDriver: 'torus', keySource: 'sky'}), `The sky over your world sets the plate's tone now (Key source Sky): ${either}`)
  assert.equal(at({frequencyDriver: 'focus'}), 'The travelling Focus sets the plate\'s tone now: choose Manual as the Resonance\'s Frequency driver to tune it here.')
  assert.equal(at({frequencyDriver: 'automation'}, {autoSweep: true}), 'The station sweep sets the plate\'s tone now: turn the Resonance\'s Sweep off, or choose Manual as its Frequency driver, to tune it here.')
  const torus = R.plateDriveOf(sceneWith({frequencyDriver: 'torus', keySource: 'torus'}))
  assert.equal(R.resonanceRefusal('root', torus, true), null, 'the base tone and the modes are the plate\'s whatever sets its tone')
  assert.equal(R.resonanceRefusal('scale', torus, false), 'The native editor is busy or not attached.')
  assert.equal(R.resonanceTitle('key', R.resonanceRefusal('key', torus, true), 528.4),
    `☿ Resonance — the tone that drives the plate (the Resonance's Drive frequency). The plate rings at 528 Hz now. The Torus sets the plate's tone now: ${either}`)
  assert.equal(R.resonanceTitle('root', null), 'Root — the base tone of the plate\'s modes: each mode rings at f0 · (m² + n²) (the Resonance\'s Base frequency). Drag the name, type a value, or use the arrow keys.')
  assert.equal(R.resonanceTitle('scale', null), 'Scale — how many of the plate\'s modes take part, the best coupled to the drive first (the Resonance\'s Mode count). Drag the name, type a value, or use the arrow keys.')
})

test('Follow says exactly why it holds no switch in Expressions, in the frame\'s own terms', () => {
  assert.equal(R.EXPRESSIONS_FOLLOW_WHY, 'Saved playback selects each scene at its owner before it plays it, so the views that read the selection move with the scene; outside the saved sequence, a scene a Jump lands on moves the field alone. There is no switch here to keep or release that.')
  const frame = readFileSync(new URL('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/app.ts', import.meta.url), 'utf8')
  assert.match(frame, /try\{if\(await nativeWorkspace!\.select\(target\.id,null\)!=='applied'\)throw Error\('Saved Scene transition was superseded/, 'saved playback selects at the owner')
  assert.match(frame, /if\(wasSequence\)void advanceSavedScene\(sceneIndexOf\(landing\),0,followed\);else\{const target=store\.document\.scenes\[sceneIndexOf\(landing\)\];setSceneRef\(target\.id,true\);/, 'outside the sequence, a landed Jump is an automatic switch')
  assert.match(frame, /if\(!automatic\)followNativeScene\(sceneId\);/, 'an automatic switch does not select at the owner')
})

// Round 896, 0R-surface.5: a typed key, root and scale reaching the field's parameter is run, not read, in key-row-typed-896.test.mjs (the
// hook drawn in Chromium over the owner's reading). These pins stay beside it.
test('CODE-READING, beside key-row-typed-896 (which runs it): the hook binds the key row as Tempo is bound, and Follow with its words', () => {
  assert.match(hook, /const read = editorReading \? barParameter\(editorReading, RESONANCE_SLOT_PATHS\[slot\]\) : null\n\s+return \{slot, parameter: read \? resonanceParameter\(slot, read\) : null\}/)
  assert.match(hook, /createLiveSession\(target, \(\) => resonanceDeps\.current\[target\] \?\? IDLE_LIVE\)/)
  assert.match(hook, /const refusal = resonanceRefusal\(slot, drive, ready\)/)
  assert.match(hook, /control: <BarValue parameter=\{parameter\} session=\{session\} disabled=\{refusal !== null\} reason=\{refusal\} \/>/)
  assert.match(hook, /follow: \{refused: EXPRESSIONS_FOLLOW_WHY\},/)
  assert.match(hook, /const drive = editorReading \? plateDriveOf\(editorReading\.scene\) : null/, 'who sets the tone, from the scene\'s own values')
  assert.doesNotMatch(hook, /expressionsSettingRead\('resonance', 'frequencyDriver'/, 'never a row\'s label (expressionsSettingRead answers "Manual", not "manual")')
})
