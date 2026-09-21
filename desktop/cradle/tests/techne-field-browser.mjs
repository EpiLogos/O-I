/** Actual software-WebGL drawing, occurrence hit-testing and a disconnected
 * relation negative control. Controlled native document, real Stage/engine.
 * Whole-app/native save/search proofs are separately required in the ledger. */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:0},logLevel:'error'});
server.middlewares.use('/field-proof',async(_req,res)=>{
 res.setHeader('content-type','text/html');
 res.end(await server.transformIndexHtml('/field-proof','<!doctype html><body data-theme="light" style="margin:0;background:#f4f2eb"><div id="field" style="width:900px;height:600px;position:relative"></div><script type="module" src="/tests/techne-field-page.ts"></script>'));
});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:900,height:600}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const expression='expression:field-proof',scene=expression+':scene:main',a=expression+':entity:a',b=expression+':entity:b';
const param=value=>({value,automation:null});
const entity=(ref,x,title)=>({entity_ref:ref,revision:1,title,subject:{subject_ref:'wiki:same-source',native_owner:'ai-kit',presentation_role:'thing',sources:[],readings:[],actions:[]},parameters:{x:param(x),y:param(0),z:param(0),scale:param(.2),glyph:param(title)}});
const relation=id=>({binding_ref:expression+':relation:'+id,native_owner:'ai-kit',relation:{ref:'wiki:edge:'+id,revision:'r7',availability:'available'},from_entity_ref:a,to_entity_ref:b,provenance:[]});
const document={schema:'oi.expression/v1',expression_ref:expression,revision:1,title:'Real relation binding proof',scenes:[{scene_ref:scene,revision:1,title:'Two occurrences',entity_refs:[a,b]}],
 entities:{[a]:entity(a,-190,'A'),[b]:entity(b,190,'B')},relations:{one:relation('one'),two:relation('two')},selection:{scene_ref:scene,entity_ref:null},provenance:[],representations:[],refinements:[]};
try{
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/field-proof`);
 await page.waitForFunction(()=>window.fieldProof);
 await page.evaluate(doc=>window.fieldProof.open(doc),document);
 const observed=await page.evaluate(()=>window.fieldProof.inspect());
 assert.equal(observed.canvasCount,1);assert.equal(observed.bindings.rendered.length,2);assert.equal(observed.lines.length,2);
 assert.ok(observed.calls>0,'actual WebGL draw calls, not only fixture data');
 for(const line of observed.lines){assert.equal(line.vertices.length,75);assert.ok(line.point.visible);assert.equal((await page.evaluate(p=>window.fieldProof.hit(p.x,p.y),line.point))?.binding_ref,line.ref);}
 for(const entity of observed.entities){assert.equal((await page.evaluate(p=>window.fieldProof.hit(p.x,p.y),entity.point))?.entity_ref,entity.ref);}
 const before=await page.locator('canvas').screenshot();
 await page.evaluate(ref=>window.fieldProof.select(ref),observed.lines[0].ref);
 const selected=await page.evaluate(()=>window.fieldProof.inspect());
 assert.deepEqual(selected.entities,observed.entities,'selection must not re-layout or remint native poses');
 assert.equal(selected.clock,observed.clock,'selection must not advance the physics clock');
 await page.evaluate(()=>window.fieldProof.disconnect());
 const without=await page.evaluate(()=>window.fieldProof.inspect());
 assert.equal(without.bindings.rendered.length,0);
 assert.equal(await page.evaluate(p=>window.fieldProof.hit(p.x,p.y),observed.lines[0].point),null,'removing relation-to-renderer binding must break visual selection');
 const after=await page.locator('canvas').screenshot();
 assert.notDeepEqual(before,after,'removing relation geometry must change actual rendered pixels');
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.fieldProof.errors),[]);
 if(process.env.TECHNE_EVIDENCE_DIR){const dir=process.env.TECHNE_EVIDENCE_DIR;mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/field-with-relations.png`,before);writeFileSync(`${dir}/field-without-relations.png`,after);writeFileSync(`${dir}/field-receipt.json`,JSON.stringify({scenario:'controlled-document-real-production-stage',observed,selected,without,errors},null,2));}
 console.log('Technē actual engine: two distinct native relations drawn/hit-tested, exact repeated-source occurrences, selection clock/poses preserved; disconnected binding breaks pixel and selection proof.');
}finally{await browser.close();await server.close();}
