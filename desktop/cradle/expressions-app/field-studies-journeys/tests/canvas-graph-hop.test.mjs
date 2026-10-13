// lane-1 C3: the Research Canvas's "Show in graph" affordance. A card offers the
// act only when its entity is bound to a native subject with its own owner; a
// resource file, an unbound card or an owner-less subject offers nothing. The
// host method posts a kind-"graph" summon through the existing host-request
// envelope, and the cradle answers it by focusing the register's wiki graph.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');
const cradle=resolve(engine,'../..');
const readSrc=name=>readFile(join(engine,'src',name),'utf8');

let api;
let temporary;
test.before(async()=>{
 temporary=await mkdtemp(join(tmpdir(),'oi-canvas-graph-hop-'));
 const out=join(temporary,'canvas-graph-hop.mjs');
 await build({
  stdin:{contents:"export {graphHopSubject} from './src/researchInstruments.tsx';",resolveDir:engine},
  tsconfig:join(engine,'tsconfig.json'),
  bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'error',
  loader:{'.css':'empty'},
  plugins:[{name:'raw-text',setup(b){
   // Vite-style `?raw` imports (the vendored geography pack) load as text.
   b.onResolve({filter:/\?raw$/},args=>({path:resolve(args.resolveDir,args.path.slice(0,-4)),namespace:'raw-text'}));
   b.onLoad({filter:/.*/,namespace:'raw-text'},async args=>({contents:`export default ${JSON.stringify(await readFile(args.path,'utf8'))};`,loader:'js'}));
  }}],
 });
 api=await import(pathToFileURL(out));
});
test.after(()=>rm(temporary,{recursive:true,force:true}));

test('a card bound to a native subject with its own owner is offered the graph hop with exactly that subject and owner', ()=>{
 assert.deepEqual(api.graphHopSubject({subject:{subject_ref:'central:node:alpha',native_owner:'ql-mef'}}),{subject_ref:'central:node:alpha',native_owner:'ql-mef'});
});

test('an unbound card, a resource file or an owner-less subject is offered nothing', ()=>{
 assert.equal(api.graphHopSubject(undefined),undefined,'no entity');
 assert.equal(api.graphHopSubject({}),undefined,'an entity with no subject');
 assert.equal(api.graphHopSubject({subject:null}),undefined,'a null subject');
 assert.equal(api.graphHopSubject({subject:{subject_ref:'central:node:alpha'}}),undefined,'no native owner');
 assert.equal(api.graphHopSubject({subject:{subject_ref:'central:node:alpha',native_owner:'  '}}),undefined,'a blank owner');
 assert.equal(api.graphHopSubject({subject:{subject_ref:'',native_owner:'ql-mef'}}),undefined,'a blank ref');
});

test('the canvas inspector shows the act only when the host declares it and the card is bound', async()=>{
 const src=await readSrc('researchInstruments.tsx');
 assert.match(src,/showInGraph\?:\(subjectRef:string,nativeOwner:string\)=>void/,'the host method is optional and typed');
 assert.match(src,/current&&host\.showInGraph&&\(\(\)=>\{const hop=current\.type==='resource'\?undefined:graphHopSubject\(/,'gated on a declared host and a non-resource card');
 assert.match(src,/aria-label="Show in graph" title="Show in graph" onClick=\{\(\)=>host\.showInGraph!\(hop\.subject_ref,hop\.native_owner\)\}/,'the act passes the exact subject ref and owner');
});

test('the app posts a kind-graph summon through the existing host-request envelope, never a source summon', async()=>{
 const app=await readFile(join(engine,'src','app.ts'),'utf8');
 const start=app.indexOf('showInGraph:(subjectRef,nativeOwner)');
 assert.ok(start>=0,'the host method is wired in app.ts');
 const line=app.slice(start,app.indexOf('nativeView:()=>nativeWorkspace',start));
 assert.match(line,/hostRequest\(\{request:'summon',detail:\{kind:'graph',subject:\{ref:subjectRef,nativeOwner,/);
 assert.doesNotMatch(line,/kind:'source'/);
});

test('the cradle answers a graph summon through the register wiki graph with its exact focus', async()=>{
 const summon=await readFile(join(cradle,'src','library','techneSummon.tsx'),'utf8');
 assert.match(summon,/kind === "graph"/,'a graph consumer exists');
 assert.match(summon,/graphSummonSubject\(detail\?\.subject\)/,'the carried subject is admitted before anything opens');
 assert.match(summon,/"oi:epi-open-knowledge", \{detail: \{ref: space, title: "Graph", project, nativeKnowledge\}\}/,'the open carries the exact native focus');
 const cradleFrame=await readFile(join(cradle,'src','CradleFrame.tsx'),'utf8');
 assert.match(cradleFrame,/validateNativeKnowledgeContext\(d\.nativeKnowledge\)/,'the knowledge open admits the focus before it opens');
 assert.match(cradleFrame,/validateNativeKnowledgeContext\(d\.nativeKnowledge\)[\s\S]*?native\?\?undefined\)\.catch\(fail\)/,'and passes it to openKnowledge');
});
