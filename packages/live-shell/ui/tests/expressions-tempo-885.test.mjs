import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// O-I #747 round 885, the beat (DLW build ruling 2026-11-06, the lead's derivation): the manual's Expressions Tempo is "20 to 240 | 96 |
// Sets how fast the field forms and breathes" (DLW.md:9290) and the transport's Tempo in Expressions is "Set the field's speed" (§10.5),
// so the speed control is one control, read as Tempo. The slot shows Tempo = 96 × time scale in beats a minute; setting it sets
// time scale = Tempo ÷ 96, clamped to 20–240 there; a time scale set elsewhere, 0 included, reads as its Tempo. SCRIPTED: pure helpers.
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

const bar = await import('../src/components/nativeBarModel.ts')
const frame = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/sceneWorkflow.ts')

/** FIXTURE: the field's time scale as barParameter reads it (registry fluid.timeScale: 0 to 4, step 0.01). */
const timeScale = (base, effective) => ({path: 'fluid.timeScale', key: 'timeScale', target: 'field.timeScale', label: 'Time Scale', unit: '',
  base, effective, automated: effective !== undefined, min: 0, max: 4, hardMin: 0, hardMax: 100, step: .01})

test('r885: the Tempo slot reads the field\'s speed as Tempo, 96 × its time scale, the same 96 the frame\'s beat is counted in', () => {
  assert.equal(bar.EXPRESSIONS_TEMPO_PER_TIME_SCALE, 96)
  assert.equal(bar.EXPRESSIONS_TEMPO_PER_TIME_SCALE, frame.EXPRESSIONS_TEMPO_PER_TIME_SCALE, 'one Tempo for the slot and the launch grid')
  const tempo = bar.tempoParameter(timeScale(1))
  assert.deepEqual([tempo.label, tempo.unit, tempo.base, tempo.min, tempo.max, tempo.target], ['Tempo', 'BPM', 96, 20, 240, 'field.timeScale'])
  assert.equal(bar.formatBarValue(tempo.base, tempo), '96.00', 'read to the hundredth, as Live shows its tempo')
  assert.equal(bar.tempoParameter(timeScale(1.25)).base, 120)
  assert.equal(bar.tempoParameter(timeScale(0)).base, 0, 'a time scale of 0, set elsewhere, reads as Tempo 0 (the field holds; no beat)')
  assert.equal(bar.tempoParameter(timeScale(1, 1.5)).effective, 144, 'an automated speed reads as its Tempo too')
  assert.equal(bar.stepBarValue(96, tempo, 1), 97, 'the arrows move a beat a minute'); assert.equal(bar.stepBarValue(96, tempo, 1, true), 106)
})

test('r885: setting Tempo sets time scale = Tempo ÷ 96, clamped to 20–240 there', () => {
  assert.equal(bar.timeScaleOfTempo(120), 1.25)
  assert.equal(bar.timeScaleOfTempo(96), 1)
  assert.equal(bar.timeScaleOfTempo(300), 2.5, 'above 240: 240')
  assert.equal(bar.timeScaleOfTempo(10), 20 / 96, 'below 20: 20')
  const tempo = bar.tempoParameter(timeScale(1))
  assert.equal(bar.parseBarValue('300', tempo), 240, 'a typed Tempo is clamped, not refused')
  assert.equal(bar.parseBarValue('7', tempo), 20)
  assert.equal(bar.parseBarValue('fast', tempo), null)
  const sent = []
  const session = bar.tempoSession({live: value => sent.push(['live', value]), commit: async value => { sent.push(['commit', value]); return true }, cancel: () => sent.push(['cancel'])})
  session.live(48); void session.commit(120); session.cancel()
  assert.deepEqual(sent, [['live', .5], ['commit', 1.25], ['cancel']], 'the time scale goes to the field, through the same session')
})
