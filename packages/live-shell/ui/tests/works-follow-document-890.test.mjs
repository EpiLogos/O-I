// O-I #747 round 890 (the round 889 walk's finding, accepted): the Works list is a reading that must follow the document. A work's row
// showed revision 2 after the lane was drawn (revision 3) and after another writer's mix edit, because the list was asked again only when
// the presented work was missing from it. Now the documents the owner says moved — the kernel's `expression_changed` receipt (events.rs
// ExpressionChanged {expression_ref, revision}), or the presented frame's own reading of its work — are compared with the rows: a row
// behind the revision its document moved to is listed again through the owner, once per revision told (no loop on a lagging list).
// SCRIPTED: the pure decision, and the Expressions panel's wiring read from its source (the panel mounts the frame).
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
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
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)
globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const commands = await import('../src/components/nativeExpressionCommands.ts')
const panel = readFileSync(new URL('../src/panels/expressions.tsx', import.meta.url), 'utf8')

const works = [{expression_ref: 'expression:dawn', title: 'Dawn field', revision: 2}, {expression_ref: 'expression:tide', title: 'Tide', revision: 2}]

test('the documents the kernel says moved: each expression_changed receipt\'s work and revision, and nothing else', () => {
  assert.equal(typeof commands.movedWorks, 'function')
  assert.deepEqual(commands.movedWorks([
    {event: 'expression_changed', expression_ref: 'expression:dawn', revision: 3, actor: 'human:expressions-app'},
    {event: 'readings_changed', scopes: ['root'], epoch: 4},
    {event: 'expression_changed', expression_ref: 'expression:tide', revision: '9'},
    {event: 'expression_changed', revision: 5},
  ]), [{expression_ref: 'expression:dawn', revision: 3}])
})

test('a row behind the revision its document moved to is listed again, once per revision told; a row at it, or a work not listed, is not', () => {
  assert.equal(typeof commands.worksBehind, 'function')
  const moved = [{expression_ref: 'expression:dawn', revision: 3}, {expression_ref: 'expression:tide', revision: 2}, {expression_ref: 'expression:other', revision: 7}]
  assert.deepEqual(commands.worksBehind(works, moved), [{expression_ref: 'expression:dawn', revision: 3}])
  assert.deepEqual(commands.worksBehind(works, moved, new Map([['expression:dawn', 3]])), [], 'already asked at revision 3: a lagging list is not asked again')
  assert.deepEqual(commands.worksBehind(works, moved, new Map([['expression:dawn', 2]])).length, 1, 'a later revision is asked again')
})

test('the Expressions panel lists the works again where the presented reading or a receipt moves past a row', () => {
  assert.match(panel, /const behind = worksBehind\(workspaceRef\.current\.nativeWorks, \[\{expression_ref: state\.nativeScene\.expression_ref, revision: state\.nativeScene\.revision\}\], asked\.current\)/)
  assert.match(panel, /useEffect\(\(\) => \{followMoved\(movedWorks\(workspace\.receipts\)\)\}, \[workspace\.receipts\]\)/)
  assert.match(panel, /for \(const work of behind\) asked\.current\.set\(work\.expression_ref, work\.revision\)/)
})
