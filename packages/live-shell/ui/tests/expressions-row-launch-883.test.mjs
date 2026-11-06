// O-I #747 round 883, XS05 ("I launch a moment across several Expressions at once": §20.1 The Main track; §16.6 Rules "a row launches
// only what is in it"): the Main track's row launcher for Expressions starts the row's scene on every Expression in it, each through
// that Expression's own scene launch (the owner's play-scene); a row with no scene in it is refused in words.
// - SCRIPTED: the adapter's acts with the owner's scene launch recorded. The shell presents one composition at a time, so the
//   two-Expression case runs at the adapter only; on screen a row holds the presented Expression's scene.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
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
const {projectExpressionsWork} = await import('../src/timeline/expressionsTrackAdapter.ts')

const played = []
const play = {op: 'expressions scene · play-scene', run: async (expressionId, sceneId) => { played.push([expressionId, sceneId]); return {ok: true, note: 'The scene plays.'} }}
const expression = (id, n) => ({id, name: id, scenes: Array.from({length: n}, (_, i) => ({id: `s${i + 1}`, name: `${id} ${i + 1}`, duration: 4}))})

test('XS05: the Main track\'s row launcher starts the row\'s scene on every Expression in it; a row holds only what is in it', async () => {
  const set = projectExpressionsWork({expressions: [expression('a', 3), expression('b', 2)], controls: {playScene: play}})
  const row = set.actions.launchStop
  assert.ok(row, 'the row launcher stands where scenes launch')
  assert.match(row.op, /play-scene/)
  played.length = 0
  assert.deepEqual(await row.run(set.columns[1].id), {ok: true, note: 'The row plays: its scene on 2 Expressions.'})
  assert.deepEqual(played, [['a', 's2'], ['b', 's2']], 'each Expression\'s own scene in that row, through its own launch')
  played.length = 0
  assert.deepEqual(await row.run(set.columns[2].id), {ok: true, note: 'The row plays: its scene on 1 Expression.'})
  assert.deepEqual(played, [['a', 's3']], 'an Expression with no scene in the row is not launched')
  assert.deepEqual(await row.run('row:none'), {ok: false, error: 'This row holds no scene: a row launches only what is in it.'})
  const refused = projectExpressionsWork({expressions: [expression('a', 1)], controls: {playScene: {op: 'p', run: async () => ({ok: false, error: 'The owner refused.'})}}})
  assert.deepEqual(await refused.actions.launchStop.run(refused.columns[0].id), {ok: false, error: 'The owner refused.'})
  assert.equal(projectExpressionsWork({expressions: [expression('a', 1)], controls: {}}).actions?.launchStop, undefined, 'no scene launch: no row launch')
})
