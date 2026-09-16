import {readFile,writeFile} from 'node:fs/promises';
const dir='/tmp/oi-ui-final-opening-20260915',raw=JSON.parse(await readFile(dir+'/opening.json','utf8'));
const windows=(draws,start,end)=>{
 const points=draws.filter(draw=>draw.at>=start&&draw.at<=end),gaps=points.slice(1).map((draw,i)=>draw.at-points[i].at).sort((a,b)=>a-b);
 return {start,end,draws:points.length,meanIntervalMs:gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:null,p95IntervalMs:gaps.length>=20?gaps[Math.ceil(gaps.length*.95)-1]:null,maxIntervalMs:gaps.at(-1)??null,fps:gaps.length>=30?1000/(gaps.reduce((a,b)=>a+b,0)/gaps.length):null};
};
const summary={basis:{head:raw.basis.head,native:raw.basis.engine.sha,indexSha256:raw.basis.indexSha256,finalIndexSha256:raw.basis.finalIndexSha256,browser:raw.basis.browser,viewport:raw.basis.viewport,deviceScaleFactor:raw.basis.deviceScaleFactor,authoredLogoParticleCount:raw.basis.authoredLogoParticleCount},cases:raw.results.map(result=>{
 const {name,enabled,before,idleStart,after,trace,pageErrors}=result,event=name=>trace.events.find(e=>e.name===name),first=event('native-first-framebuffer-draw'),ready=event('ready-control'),entering=event('entering'),entered=event('entered');
 const frame=trace.resources.find(r=>/\/CradleFrame-[^/]+\.js/.test(r.name));
 return {name,enabled,earlyBodyObservation:event('initial-ground'),firstNativeDraw:first,workspaceRequest:frame&&{name:frame.name,startTime:frame.startTime,responseEnd:frame.responseEnd},composed:event('workspace-composed'),ready,entering,entered,entryWallDurationMs:entered&&entering?entered.at-entering.at:null,playback:after.stage.playback,loading:first&&ready?windows(trace.draws,first.at,ready.at):null,rest:ready&&entering?windows(trace.draws,ready.at+250,entering.at-50):null,flight:entering&&entered?windows(trace.draws,entering.at+250,entered.at-100):null,coveredBefore:before.covered,canvasesBefore:before.canvases,canvasesAfter:after.canvases,heldContexts:trace.contexts,idle:{durationMs:after.at-idleStart.at,nativeDrawDelta:after.draws-idleStart.draws,allRafCallbackDelta:after.raf-idleStart.raf,stageFrameDelta:after.stage.frames===null?null:after.stage.frames-idleStart.stage.frames,live:after.stage.live,scheduled:after.stage.scheduled,presentations:after.stage.presentations},focusedAfter:after.focused,legacyAfter:after.legacy,engineResourceRequests:trace.resources.filter(r=>/\/(?:expressions-engine|engineSurface|three)-[^/]+\.js/.test(r.name)).map(r=>r.name),longTasks:trace.longTasks,pageErrors};
 })};
summary.checks=[];
const check=(label,ok)=>summary.checks.push({label,ok:!!ok});
check('Same served build throughout all three cases',raw.basis.indexSha256===raw.basis.finalIndexSha256&&summary.cases.length===3);
for(const c of summary.cases){
 check(c.name+': zero browser errors and no legacy renderer after entry',c.pageErrors.length===0&&c.legacyAfter===0);
 check(c.name+': zero native draws and animation-frame callbacks during settled idle',c.idle.nativeDrawDelta===0&&c.idle.allRafCallbackDelta===0);
 if(c.enabled){
  check(c.name+': native first draw precedes real workspace chunk request',c.firstNativeDraw.at<c.workspaceRequest.startTime);
  check(c.name+': workspace composes covered beneath field before entry',c.coveredBefore&&c.composed.at<c.entering.at);
  check(c.name+': actual rendered sequence completed before release',c.playback.status==='completed'&&c.playback.elapsed>=c.playback.duration&&c.playback.duration===2600);
  check(c.name+': exactly one healthy retained actual WebGL context and canvas',c.heldContexts.length===1&&c.heldContexts[0].connected&&!c.heldContexts[0].lost&&c.canvasesBefore===1&&c.canvasesAfter===1);
  check(c.name+': idle stage frames stable with no live or scheduled presentation',c.idle.stageFrameDelta===0&&c.idle.live===false&&c.idle.scheduled===false&&c.idle.presentations.length===0);
 }else{
  check('disabled: no engine canvas, actual WebGL context or native/Three chunk request',c.canvasesBefore===0&&c.canvasesAfter===0&&c.heldContexts.length===0&&c.engineResourceRequests.length===0);
 }
}
summary.passed=summary.checks.every(c=>c.ok);
await writeFile(dir+'/opening-summary.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
if(!summary.passed)process.exitCode=1;
