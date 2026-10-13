import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Live's mode in force (T-LIVE-MODE-SCALES, leg 1). The catalogues below are
// test fixtures shaped as the owner's readings (ql-mef ModeTonicInstance and a
// maqam source scale); the production module holds no mode table of its own.
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

const {
  LIVE_MODE_SEAM, modeForClip, pitchMask, resolveModeInForce, rollRowState, validScale, waitingModeInForce,
} = await import('../src/live/modes.ts')

const provenance = (symbol) => ({owner: 'ql-mef', symbol, revision: 'fixture-rev'})
const dorian = {
  kind: 'lens-cf', key: 'bimba|L1|Dorian', label: 'Dorian · L1', lens: 'L1', anchorBasis: 'bimba', mode: 'Dorian',
  pitches: [2, 4, 5, 7, 9, 11, 0], tuning: null, provenance: provenance('mode_tonic_instance'),
}
const phrygian = {
  kind: 'lens-cf', key: 'bimba|L2|Phrygian', label: 'Phrygian · L2', lens: 'L2', anchorBasis: 'bimba', mode: 'Phrygian',
  pitches: [4, 5, 7, 9, 11, 0, 2], tuning: [{num: 16, den: 15}, {num: 9, den: 8}], provenance: provenance('mode_tonic_instance'),
}
const maqam = {
  kind: 'source', key: 'maqam:0', label: 'Maqam 0', family: 'maqam', pitches: null,
  tuning: [{num: 256, den: 243}], provenance: provenance('maqam_pitches'),
}
const catalogue = [dorian, phrygian, maqam]

test('with no kernel catalogue the mode in force waits and names the exact seam', () => {
  for (const absent of [null, undefined]) {
    const reading = resolveModeInForce(absent, {key: dorian.key, root: 2})
    assert.equal(reading.state, 'waiting')
    assert.equal(reading.selection, null)
    assert.ok(reading.line.includes(LIVE_MODE_SEAM), 'the waiting line carries the seam')
    assert.match(reading.line, /ql-mef mode_tonic_landscape/)
  }
  assert.equal(waitingModeInForce().line, waitingModeInForce(LIVE_MODE_SEAM).line)
})

test('a choice the kernel does not serve is refused, never invented', () => {
  const reading = resolveModeInForce(catalogue, {key: 'ficino:saturn', root: 0})
  assert.equal(reading.state, 'waiting')
  assert.match(reading.line, /not a scale the kernel serves; nothing is invented/)
  assert.equal(resolveModeInForce(catalogue, null).state, 'waiting')
})

test('a reading the owner did not produce is refused by the validator', () => {
  assert.equal(validScale({...dorian, provenance: {owner: 'shell', symbol: 'x', revision: 'y'}}), false)
  assert.equal(validScale({...dorian, pitches: [2, 4, 5, 7, 9, 11, 12]}), false)
  assert.equal(validScale({...dorian, tuning: [{num: 0, den: 1}]}), false)
  assert.equal(validScale(dorian), true)
  assert.equal(validScale(maqam), true)
  assert.equal(resolveModeInForce([{...dorian, pitches: [2, 4]}], {key: dorian.key, root: 2}).state, 'waiting')
})

test('a catalogued mode on a valid root is in force, and its line names mode, root and provenance', () => {
  const reading = resolveModeInForce(catalogue, {key: dorian.key, root: 2})
  assert.equal(reading.state, 'in-force')
  assert.equal(reading.selection.scale, dorian)
  assert.equal(reading.selection.root, 2)
  assert.match(reading.line, /^Mode in force — Dorian · L1 on pitch class 2 · ql-mef mode_tonic_instance@fixture-rev/)
  assert.equal(resolveModeInForce(catalogue, {key: dorian.key, root: 14}).state, 'waiting')
})

test('declared tuning travels with the mode unchanged, and an undeclared tuning is never assumed equal', () => {
  const declared = resolveModeInForce(catalogue, {key: phrygian.key, root: 4})
  assert.equal(declared.selection.scale.tuning, phrygian.tuning, 'the kernel ratios are the same objects, not re-derived')
  assert.match(declared.line, /tuning: exact ratios 16\/15 9\/8/)
  const undeclared = resolveModeInForce(catalogue, {key: dorian.key, root: 2})
  assert.match(undeclared.line, /tuning: none declared by the kernel \(pitch-class addresses only, no equal temperament assumed\)/)
  assert.doesNotMatch(undeclared.line, /12-TET|equal temperament is/)
})

test('a clip carrying its own mode overrides the set for that clip only', () => {
  const setChoice = {key: dorian.key, root: 2}
  const clipChoice = {key: phrygian.key, root: 4}
  const clip = modeForClip(catalogue, setChoice, clipChoice)
  assert.equal(clip.state, 'in-force')
  assert.equal(clip.selection.scale, phrygian)
  assert.match(clip.line, /^Clip mode \(this clip only\) — Phrygian · L2 on pitch class 4/)
  const plain = modeForClip(catalogue, setChoice, null)
  assert.equal(plain.selection.scale, dorian, 'a clip without its own mode plays the set mode')
  assert.equal(resolveModeInForce(catalogue, setChoice).selection.scale, dorian, 'the set mode is untouched by the clip')
})

test('the fold and the highlight agree with the mode: the roll keeps exactly its pitch set', () => {
  const mask = pitchMask(dorian)
  assert.deepEqual(mask.map((on, pitch) => (on ? pitch : -1)).filter(pitch => pitch >= 0), [0, 2, 4, 5, 7, 9, 11])
  for (let pitch = 0; pitch < 12; pitch++) {
    const folded = rollRowState(pitch, mask, 'fold')
    const highlit = rollRowState(pitch, mask, 'highlight')
    assert.equal(folded.visible, mask[pitch], `fold keeps pitch ${pitch} only when in the mode`)
    assert.equal(highlit.visible, true, 'highlight keeps every row')
    assert.equal(highlit.inMode, mask[pitch], 'highlight marks the mode rows')
    assert.equal(folded.inMode, highlit.inMode)
  }
})

test('a scale with no served pitch set neither folds nor marks the roll', () => {
  assert.equal(pitchMask(maqam), null)
  for (let pitch = 0; pitch < 12; pitch++) {
    assert.deepEqual(rollRowState(pitch, null, 'fold'), {visible: true, inMode: false})
    assert.deepEqual(rollRowState(pitch, null, 'highlight'), {visible: true, inMode: false})
  }
})
