#!/usr/bin/env node
/** Save the actual retained authored starter through production NativeWorking,
 * then open that native Central file through a separate native process.
 * Visible Save UI and personal dynamics require their own evidence.
 * node tests/nara-starter-native.mjs <config.json> <bridge-url> <negative-url> <reopen-bridge-url> <saved-expression-ref>
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const original=JSON.parse(await readFile(process.argv[2],'utf8'));
const bridge=process.argv[3];assert.match(bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(original.binding.person_ref,/^controlled:/);
assert.ok(original.world.includes('/Control/agents/now/clearings/')&&original.world.includes('/T/')&&original.world.endsWith('/world'));
const output=path.join(path.dirname(process.argv[2]),'nara-starter-native');await mkdir(output,{recursive:true});
const files=['expressions-app/field-studies-journeys/src/nativeWorking.ts','expressions-app/field-studies-journeys/src/kernelComposition.ts','expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts','src/expressions/hostedComposition.ts','src/knowledge/artifactRecovery.ts'];
const sources=Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
const reopenBridge=process.argv[5],savedRef=process.argv[6];assert.match(reopenBridge,/^http:\/\/127\.0\.0\.1:\d+$/);assert.notEqual(reopenBridge,bridge);assert.match(savedRef,/^expression:authored-/);
const events=[],errors=[];
const parentModule=`import {relayKernelChannel} from '/src/expressions/hostedApp.ts';
import {hostedCompositionFile} from '/src/expressions/hostedComposition.ts';
window.reopenSaved=path=>hostedCompositionFile({kind:'bridge',url:${JSON.stringify(reopenBridge)}},{operation:'open',path});
const frame=document.querySelector('iframe');relayKernelChannel(frame,{kind:'bridge',url:${JSON.stringify(bridge)}});frame.src='/starter-child?mode=expressions';`;
const childModule=`
import {NativeWorking} from '/expressions-app/field-studies-journeys/src/nativeWorking.ts';
import {writeWorkingCheckpoint} from '/expressions-app/field-studies-journeys/src/recovery.ts';
import {installKernelExpressions,kernelExpressionsAvailable,nativeExpressionRequest,nativeFileRequest} from '/expressions-app/field-studies-journeys/src/kernelExpressions.ts';
installKernelExpressions();
window.saveStarter=async()=>{
 if(!kernelExpressionsAvailable())throw Error('Native host handshake unavailable');
 const opened=await nativeExpressionRequest({operation:'inspect',expression_ref:${JSON.stringify(savedRef)}});
 const work=new NativeWorking({expression:nativeExpressionRequest,file:nativeFileRequest,checkpoint:(id,value)=>writeWorkingCheckpoint(id,value,'expressions'),mint:()=> 'expression:authored-'+crypto.randomUUID()});
 const view=await work.adopt(opened.document),journey=view.journey;
 const committed=opened.document;
 const scene=committed.scenes.find(scene=>scene.scene_ref===committed.selection.scene_ref);
 const centre=scene.entity_refs.map(ref=>committed.entities[ref]).find(entity=>entity.entity_ref===committed.selection.entity_ref);
 if(!centre)throw Error('Retained source did not select an actual native entity');
 await work.select({scene_ref:scene.scene_ref,entity_ref:centre.entity_ref});
 const readback=await nativeExpressionRequest({operation:'inspect',expression_ref:committed.expression_ref});
 if(readback.document.revision!==work.state.view.document.revision)throw Error('Native saved revision differs from acknowledged working basis');
 const file=await work.saveFile({journey,sceneId:view.startSceneId,entityId:view.entity_ids[committed.selection.entity_ref]},{parent_path:'Work/controlled',name:'retained-chakral-body-'+crypto.randomUUID()+'.expression.json'});
 const exported=await nativeExpressionRequest({operation:'export',expression_ref:committed.expression_ref,expected_revision:readback.document.revision});
 return {source_id:'native-saved-retained-starter',journey_id:journey.id,document:readback.document,exported,file,checkpoint:work.state};
};`;
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:path.join(output,'vite-cache'),server:{host:'127.0.0.1',port:0,hmr:false},optimizeDeps:{noDiscovery:true,entries:[],include:['react','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime']},resolve:{dedupe:['react','react-dom']},esbuild:{jsx:'automatic'},plugins:[{name:'native-starter-replay',configureServer(server){server.middlewares.use((req,res,next)=>{const route=req.url?.split('?')[0];if(route==='/starter-parent'||route==='/starter-child'){res.setHeader('Content-Type','text/html');res.end(route==='/starter-parent'?'<iframe></iframe><script type="module" src="/starter-parent.js"></script>':'<script type="module" src="/starter-child.js"></script>');}else if(route==='/starter-parent.js'||route==='/starter-child.js'){res.setHeader('Content-Type','application/javascript');res.end(route==='/starter-parent.js'?parentModule:childModule);}else next();});}}]});
let browser;
try{
 await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage();
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('request',request=>{if(request.url()===`${bridge}/op`){const op=request.postDataJSON();events.push({op:op.op,operation:op.request?.operation});}});
 await page.goto(`${server.resolvedUrls.local[0]}starter-parent`,{waitUntil:'commit'});
 await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow?.saveStarter,{timeout:90000});
 const child=page.frames().find(frame=>frame.url().includes('/starter-child'));assert.ok(child);
 await child.waitForFunction(()=>window.__OI_KERNEL_EXPRESSIONS__?.kernelExpressionsAvailable(),{timeout:90000});
 const result=await child.evaluate(()=>window.saveStarter());assert.equal(Object.keys(result.document.entities).length,7);
 assert.ok(result.document.entities[result.document.selection.entity_ref]);
 const reopened=await page.evaluate(path=>window.reopenSaved(path),result.file.location.path);
 assert.deepEqual(reopened.document,result.document);assert.deepEqual(reopened.file.location,result.file.location);assert.equal(reopened.file.revision,result.file.revision);
 const response=await fetch(`${bridge}/op`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'nara_identity',request:{operation:'open',source_ref:original.binding.source_ref}}),signal:AbortSignal.timeout(90000)});
 const identity=await response.json();assert.ok(!identity.error,identity.error);assert.equal(identity.outcome.data.reading.person_ref,original.binding.person_ref);
 const config={...original,bridge:reopenBridge,negative_bridge:process.argv[4],binding:{...original.binding,expression_ref:result.document.expression_ref,expected_revision:identity.outcome.data.source.revision},block_id:null};
 const configPath=path.join(output,'native-config.json');await writeFile(configPath,JSON.stringify(config,null,2));
 await writeFile(path.join(output,'export.json'),JSON.stringify(result.exported,null,2));
 await writeFile(path.join(output,'receipt.json'),JSON.stringify({schema:'oi.nara-starter-native-verification/v1',...result,reopened,reopen_bridge:reopenBridge,sources,events,errors,limits:['Actual retained native starter, NativeWorking SaveAs and fresh native process OpenFile equal readback; visible Save control not exercised by this script','Retained authored seven-centre source, not personal chart-derived dynamics; native SubjectBindings are absent until explicit source-resolved personal binding']},null,2));
 assert.deepEqual(errors,[]);process.stdout.write(JSON.stringify({ok:true,expression_ref:result.document.expression_ref,revision:result.document.revision,config:configPath})+'\n');
}catch(error){await writeFile(path.join(output,'failure.json'),JSON.stringify({error:String(error),errors,events,sources},null,2));throw error;}
finally{await browser?.close();await server.close();}
