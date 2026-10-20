import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// The handles that move two parameters (docs/dlw/DLW.md §16.9, §21.5; catalogue/panels/handleLaws.ts). A handle is what its picture
// draws run backwards, so each law is held as a round trip: put the handle where the values place it, read the values off that place,
// and they come back (within the step each is kept to). The Filter's cutoff and resonance handle is the manual's own example; the
// Dynamics knee and its dip and the Delay's first two repeats follow the same rule.
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
  if(url.endsWith('.ts')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const laws = await import('../src/inhabitants/catalogue/panels/handleLaws.ts')
const near = (a, b, eps, said) => assert.ok(Math.abs(a - b) <= eps, `${said}: ${a} is not within ${eps} of ${b}`)

test('Dynamics knee: across is the threshold, up is the makeup, and the place reads back what put it there', () => {
  for (const threshold of [-60, -30, -12, -0.5, 0]) for (const makeup of [0, 2, 9.5, 24]) {
    const at = laws.kneePlace(threshold, makeup)
    assert.deepEqual(laws.kneeDrag(at.inDb, at.outDb), {threshold, makeup}, `threshold ${threshold}, makeup ${makeup}`)
  }
})

test('Dynamics knee: a hand past the ends stays inside what the effect takes', () => {
  assert.deepEqual(laws.kneeDrag(12, 99), {threshold: 0, makeup: 24})
  assert.deepEqual(laws.kneeDrag(-99, -99), {threshold: -60, makeup: 0})
  const k = laws.kneeDrag(-20, -20)
  assert.equal(k.makeup, 0, 'the curve cannot sit under the unity line: no makeup below 0 dB')
})

test('Dynamics dip: the depth the handles stand at is the ratio, and the ratio reads back from it', () => {
  for (const threshold of [-60, -30, -12]) for (const ratio of [1, 1.5, 2, 4, 8, 12, 20]) {
    const depth = laws.depthOf(threshold, ratio)
    near(laws.ratioForDepth(threshold, depth), ratio, 0.1, `threshold ${threshold}, ratio ${ratio}`)
  }
  assert.equal(laws.ratioForDepth(-12, 99), 20, 'a hand below the floor is the greatest ratio')
  assert.equal(laws.ratioForDepth(-12, -3), 1, 'a hand above the line is no reduction')
  assert.equal(laws.ratioForDepth(0, 5), 1, 'with the threshold at 0 dB there is no room to pull, so any depth is ratio 1')
})

test('Dynamics times: the attack handle and the release handle each stand for the one full depth', () => {
  for (const deep of [3, 9, 27.5]) for (const attack of [0.5, 1, 30, 200]) for (const release of [5, 100, 800]) {
    const gr = laws.reductionAt(attack, deep, attack, release)
    near(laws.depthAtAttack(gr), deep, 1e-9, `attack ${attack}`)
    const back = laws.reductionAt(laws.BURST + release, deep, attack, release)
    near(laws.depthAtRelease(back, attack), deep, 1e-9, `release ${release}, attack ${attack}`)
  }
})

test('Delay repeats: the second repeat stands at the feedback up, and the mix is the first repeat\'s height', () => {
  for (const mix of [5, 25, 60, 100]) for (const feedback of [0, 10, 35, 70, 95]) {
    const second = laws.repeatHeight(mix, feedback, 2)
    assert.equal(laws.feedbackForSecond(second, mix), feedback, `mix ${mix}, feedback ${feedback}`)
    near(laws.repeatHeight(mix, feedback, 1) * 100, mix, 1e-9, 'the first repeat is the mix')
  }
  assert.equal(laws.feedbackForSecond(0.5, 0), 0, 'with no repeats to read it from, the feedback is 0')
  assert.equal(laws.feedbackForSecond(1, 50), 95, 'a hand above the first repeat stops at the most the delay takes')
})
