import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const packageRoot=fileURLToPath(new URL('../../../packages/oi-design-system/',import.meta.url));
if(!process.env.QL_NARA_SNAPSHOT)throw new Error('QL_NARA_SNAPSHOT must name the focused-snapshot.json emitted by the actual k8_personal acceptance example');
const ownerSnapshot=JSON.parse(readFileSync(process.env.QL_NARA_SNAPSHOT,'utf8'));
const server=await createServer({root,appType:'custom',resolve:{alias:{'@epilogos/oi-design-system':packageRoot}},server:{host:'127.0.0.1',port:0},logLevel:'error'});
server.middlewares.use('/nara-retained',(_req,res)=>{res.setHeader('content-type','text/html');res.end('<div id="host" style="width:900px;height:700px"></div><script type="module" src="/tests/nara-retained-page.ts"></script>');});
server.middlewares.use('/nara-stage',async(_req,res)=>{res.setHeader('content-type','text/html');res.end(await server.transformIndexHtml('/nara-stage','<body class="oi-desktop"><div id="root"></div><script type="module" src="/tests/expression-provider-page.tsx"></script>'));});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']}),page=await browser.newPage({viewport:{width:900,height:700}});
try{
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/nara-retained`);
 await page.waitForFunction(()=>window.NaraRetainedTest);
 const portable=await page.evaluate(snapshot=>{
  const {exportNaraCues,naraCueExpression}=window.NaraRetainedTest;
  snapshot.nara_expression.portable.future_protected_field={constitution:'must remain session local'};
  const cues=exportNaraCues(snapshot.nara_expression),document=naraCueExpression(snapshot,'expression:portable-native-cues');
  snapshot.personal_current=false;let staleRefused=false;try{naraCueExpression(snapshot,'expression:stale');}catch{staleRefused=true;}
  return {cues,document,staleRefused};
 },ownerSnapshot);
 assert.equal(portable.cues.future_protected_field,undefined,'contract extension cannot silently export Personal fields');
 assert.equal(Object.keys(portable.document.entities).length,8);
 assert.deepEqual(Object.values(portable.document.entities).map(e=>e.subject.subject_ref),[...portable.cues.centre_locus_refs,portable.cues.earth_body_locus_ref]);
 assert.equal(portable.document.relations&&Object.keys(portable.document.relations).length,0,'neutral cue layout invents no semantic relations');
 assert.ok(!JSON.stringify(portable.document).includes('resonance'));
 assert.equal(portable.staleRefused,true,'stale owner reception cannot be composed');
 const result=await page.evaluate(async(ownerSnapshot)=>{
  const {EngineSurface,naraExpressionConfig,naraRetainedPresentation,projectNaraExpression}=window.NaraRetainedTest;
  const projected=projectNaraExpression(ownerSnapshot),base=naraRetainedPresentation(projected.session);
  const surface=EngineSurface.forElement(document.getElementById('host'),()=>{});
  surface.presentConfig('nara:test',naraExpressionConfig(projected.session),'nara:test:scene');
  const lease=surface.retainedLease('nara:test'),port=lease.retainedTargetPort();
  port.setTargetTextures(port.targetA,port.targetB,{x:0,y:0});
  const adapter=surface.adapter,engine=adapter.engine;
  lease.renderOnce();
  const capture=()=>({targets:[port.currentPosTarget,port.currentVelTarget,port.targetA,port.targetB],parts:engine.entities.getPartitions().map(p=>({id:p.entityId,start:p.start,end:p.end})),seeds:engine.inspectState().seeds,centres:engine.entities.uniforms.centers.map(v=>[v.x,v.y,v.z]),scales:Array.from(engine.entities.uniforms.depthScales),tints:engine.entities.uniforms.tints.map(v=>v.getHexString()),weights:Array.from(engine.entities.uniforms.tintWeights)});
  const before=capture();
  const request=(generation,delta=0)=>({...base,personalGeneration:generation,entities:base.entities.map((e,i)=>({...e,x:e.x+(i===0?delta/100:0),scale:e.scale+delta/100}))});
  lease.updatePresentation(base);lease.renderOnce();const first=capture();
  lease.pause();lease.updatePresentation(request(base.personalGeneration+1,5));const second=capture();lease.resume();
  let refused=false;try{lease.updatePresentation(request(base.personalGeneration,20));}catch{refused=true;}lease.renderOnce();const afterRefusal=capture();
  surface.release('nara:test');surface.presentConfig('nara:next',naraExpressionConfig(projected.session),'nara:next:scene');const nextLease=surface.retainedLease('nara:next'),nextPort=nextLease.retainedTargetPort();nextPort.setTargetTextures(nextPort.targetA,nextPort.targetB,{x:0,y:0});const newBefore=surface.adapter.engine.inspectState();let oldRefused=false;try{lease.updatePresentation(request(base.personalGeneration+2));}catch{oldRefused=true;}const newAfter=surface.adapter.engine.inspectState();
  surface.dispose();
  return {before,first,second,afterRefusal,refused,oldRefused,newBefore,newAfter,targetSame:first.targets.every((v,i)=>v===before.targets[i])&&second.targets.every((v,i)=>v===before.targets[i]),partSame:JSON.stringify(before.parts)===JSON.stringify(first.parts)&&JSON.stringify(first.parts)===JSON.stringify(second.parts)};
 },ownerSnapshot);
 assert.equal(result.refused,true);assert.equal(result.oldRefused,true);assert.deepEqual(result.newAfter,result.newBefore);assert.equal(result.targetSame,true);assert.equal(result.partSame,true);
 assert.equal(result.before.seeds,result.second.seeds);assert.notDeepEqual(result.first.centres,result.second.centres);assert.notDeepEqual(result.first.scales,result.second.scales);assert.ok(result.first.weights.every(value=>value===0),'actual owner no-palette condition remains neutral');
 assert.deepEqual(result.afterRefusal,result.second);
 assert.equal(new Set(result.first.centres.slice(0,7).map(JSON.stringify)).size,7);
 console.log('Nara retained field: actual owner snapshot plus controlled next-generation presentation; 8 stable partitions, 7 distinct GPU loci, no target replacement/reseed, atomic stale refusal.');
 await page.addInitScript(()=>localStorage.setItem('oi-cradle.visuals.v1',JSON.stringify({enabled:true,welcomeEnabled:false})));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/nara-stage`);
 await page.waitForFunction(()=>window.providerTest?.stage?.inspect().engine);
 const priority=await page.evaluate(async snapshot=>{
  const {projectNaraExpression,naraRetainedPresentation}=await import('/src/instrument/nara-expression-adapter.ts');
  const projection=projectNaraExpression(snapshot),stage=providerTest.stage;
  const cue=stage.express('searching',{rect:new DOMRect(40,50,44,28),hold:true});
  const presentation=stage.present({id:'nara:owned',recipe:'oi.mark',config:projection.config,sceneRef:'nara:owned',plane:'ambient'});
  await presentation.ready();presentation.setPaused(true);
  const lease=stage.retainedLease(presentation.id),port=lease.retainedTargetPort();
  port.setTargetTextures(port.targetA,port.targetB,{x:0,y:0});
  lease.updatePresentation(naraRetainedPresentation(projection.session));lease.renderOnce();
  const before=lease.inspect(),targets=[port.targetA,port.targetB,port.currentPosTarget,port.currentVelTarget];
  presentation.release();
  const released=stage.inspect();
  stage.update(cue,{name:'listening'});
  // The real retained lease, not a fixture flag, protects resident buffers
  // while the foreground is absent. Semantic state continues to update.
  const reserved=stage.inspect();
  let releasedInspectionRefused=false;try{lease.inspect();}catch{releasedInspectionRefused=true;}
  const clocks=()=>({frames:stage.inspect().frames,scheduled:stage.inspect().scheduled});
  const quietBefore=clocks();
  for(const method of ['resume','renderOnce'])try{lease[method]();}catch{/* A released lease may refuse rather than silently draw. */}
  await new Promise(r=>setTimeout(r,350));
  const quietAfter=clocks();
  const next=stage.present({id:'nara:owned',recipe:'oi.mark',config:projection.config,sceneRef:'nara:owned',plane:'ambient',paused:true});
  await next.ready();
  const nextLease=stage.retainedLease(next.id),nextPort=nextLease.retainedTargetPort();
  const reentered=nextLease.inspect();
  const sameTargets=targets.every((t,i)=>t===[nextPort.targetA,nextPort.targetB,nextPort.currentPosTarget,nextPort.currentVelTarget][i]);
  const currentBefore=clocks();
  for(const method of ['resume','renderOnce'])try{lease[method]();}catch{/* Superseded lease cannot act on this owner. */}
  await new Promise(r=>setTimeout(r,350));
  const currentAfter=clocks();
  next.release();stage.release(cue);providerTest.unmount();
  return {before,reentered,released,reserved,quietBefore,quietAfter,currentBefore,currentAfter,sameTargets,releasedInspectionRefused};
 },ownerSnapshot);
 assert.equal(priority.released.retainedReservation,true,'actual retained lease reserves the window field after release');
 assert.equal(priority.reserved.live,false,'queued semantic activity cannot replace a reserved Nara field');
 assert.equal(priority.reserved.overlay.forms[0],'listening','reservation preserves semantic cue updates');
 assert.equal(priority.releasedInspectionRefused,true,'released lease cannot inspect another ownership lifetime');
 assert.equal(priority.before.seeds,priority.reentered.seeds,'Nara reentry preserves resident seeds');
 assert.equal(priority.sameTargets,true,'Nara reentry preserves actual target texture identity');
 assert.deepEqual(priority.quietAfter,priority.quietBefore,'released lease calls cannot draw dormant field');
 assert.deepEqual(priority.currentAfter,priority.currentBefore,'superseded lease cannot wake or draw replacement owner');
 console.log('Nara stage priority: actual QL retained lease suppresses queued native cues; release/reentry preserves target texture identities and seeds; released/superseded clocks cannot run.');

}finally{await browser.close();await server.close();}
