/** Real native construction/source and native Expression roundtrip; no source
 * model extension, inference from traversal, mocked owner, or RC persistence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readRegister} from '../src/knowledge/construction.ts';
import {projectConstruction} from '../src/knowledge/constructionProjection.ts';
import {kernelOp} from '../src/kernel/bridge.ts';
import {readFile as readBytes} from 'node:fs/promises';
import {readWikiSceneTechne} from '../src/techne/wikiReadingProvider.ts';
import {publishWikiNativeRegisters} from '../src/techne/wikiNativeExpression.ts';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

test('native PlaceSet reaches active Scene Places with exact geometry, precision and participation identity',{skip:process.env.OI_NATIVE_AUTHORED_SCENE!=='1',timeout:120000},async()=>{
 for(const key of ['OI_KERNEL_BIN','OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN'])assert.ok(process.env[key],key+' required');
 const retained=process.env.OI_NATIVE_SPATIAL_EVIDENCE_DIR;
 const scratch=retained??await mkdtemp(join(tmpdir(),'oi-scene-spatial-')),root=join(scratch,'Central'),home=join(scratch,'oi-home');let child,stderr='';
 if(retained)await mkdir(scratch); // refuse overwriting an earlier proof World
 const env={...process.env,OI_HOME:home,AIKIT_HOME:join(scratch,'aikit-home'),OI_CENTRAL_ROOT:root,CENTRAL_ROOT:root,OI_CENTRAL_PROJECT_QUERY:''};
 try{
  await mkdir(root);await mkdir(home);
  assert.equal(JSON.parse(execFileSync(process.env.OI_CENTRAL_CTRL_BIN,['--root',root,'--json','action','run','central.init','{}'],{env,encoding:'utf8',timeout:30000})).ok,true);
  child=spawn(process.env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,detached:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',chunk=>stderr+=chunk);
  const url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error(stderr||'Native startup timed out')),30000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Native exited '+code+stderr));});child.stdout.on('data',chunk=>{output+=chunk;const match=/listening on (http:\/\/[^ ]+)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const transport={kind:'bridge',url},before=await readRegister(transport),subject=before.spaces[0].ref,frameRef='wiki:frame:native-direction';
  const parts=['participation:wiki:direction-a','participation:wiki:direction-b'];
  const directions=['directed'];
  const temporal=[{facet_ref:'wiki:temporal:native-instant',kind:'occurrence',instant:'2020-04-03T12:30:00Z',precision:'second',source_ref:subject},{facet_ref:'wiki:temporal:native-interval',kind:'valid',interval:{from:'2021-01-01T00:00:00Z',to:'2021-12-31T23:59:59Z',from_precision:'year',to_precision:'second'},uncertainty:'The source supplies a year span'},{kind:'day',day_ref:'day:native-continuity'}];
  const places=[{place_ref:'wiki:place:native-spatial',identity:{names:[{name:'Native declared place',valid_from:'2020'}]},geometry:{type:'point',coordinates:[-0.09,51.51]},precision:'exact',valid_from:'2020',observer_frame:frameRef,source_ref:subject},{place_ref:'wiki:place:native-unnamed',precision:'unlocated',source_ref:subject}];
  const request={schema:'aikit.constellation-action/v1',frame_ref:frameRef,expected_revision:0,actor_ref:'human:native-direction-regression',operation_ref:'operation:wiki:native-direction',changes:[{change:'create',anchor_ref:'wiki:anchor:native-direction',title:'Native direction parity',inquiry:{question:'Does source direction survive a transient reading?'},space_refs:[subject],frame:null},...parts.map(part=>({change:'member_add',member:{subject_ref:subject,participation:{participation_ref:part,role_ref:null,sources:[],note:'Same source, distinct native occurrence'}}})),...directions.map(direction=>({change:'relation_put',relation:{relation_ref:'wiki:edge:native-'+direction,expected_revision:null,from_participation_ref:parts[0],to_participation_ref:parts[1],relation:'supports',direction,standing:'asserted',evidence:[],temporal}})),{change:'place_set',participation_ref:parts[1],places}]};
  const apply=JSON.parse(execFileSync(process.env.OI_AIKIT_BIN,['--json','-C',root,'wiki-construct','apply','--file',join(root,before.file.location.path)],{env,input:JSON.stringify({basis_content:before.file.content,request}),encoding:'utf8',timeout:30000}));assert.ok(apply.ok,JSON.stringify(apply));
  const current=await readRegister(transport),frame=current.frames.find(row=>row.ref===frameRef);assert.ok(frame);
  const opened=await projectConstruction(transport,undefined,frame,current.relations,current);assert.equal(opened.state,'ready',JSON.stringify(opened));
  const document=opened.document,scene=document.scenes.find(row=>row.scene_ref===document.selection.scene_ref),bytes=JSON.stringify(document);
  const sourcePath=join(root,current.file.location.path),sourceBytes=await readBytes(sourcePath,'utf8');
  const raw=JSON.parse(sourceBytes),sourceRow=(Array.isArray(raw)?raw:raw.objects).find(row=>row.ref==='wiki:edge:native-directed');
  assert.deepEqual(sourceRow['aikit.techne-facet/v1'].temporal,temporal,'the native owner retained the submitted canonical temporal metadata');
  const nativeFrame=(Array.isArray(raw)?raw:raw.objects).find(row=>row.ref===frameRef);assert.deepEqual(nativeFrame.constellations[0].members[1]['aikit.techne-facet/v1'].spatial,places,'native PlaceSet retained exact metadata');
  publishWikiNativeRegisters([]);
  const requestReading={expression_ref:document.expression_ref,revision:document.revision,scene_ref:scene.scene_ref};
  const resolved=await readWikiSceneTechne(transport,requestReading);
  assert.equal(resolved.temporal.length,3);
  assert.deepEqual(resolved.temporal.slice(0,2),temporal.slice(0,2));
  assert.equal(resolved.temporal[2].day_ref,temporal[2].day_ref);
  assert.equal(resolved.disclosure.instruments.find(row=>row.instrument==='timeline').available,true);
  assert.deepEqual(resolved.spatial,places);assert.equal(resolved.disclosure.instruments.find(row=>row.instrument==='place').available,true);
  assert.ok(resolved.provenance.some(row=>row.source_ref===subject&&row.source_revision===String(frame.revision)&&row.selector?.kind==='techne-spatial-facet'));
  const compiled=await build({stdin:{contents:"export {readingInstruments,nativeInstrumentTitles} from './researchInstrumentsData.ts';export {kernelDocumentToJourney} from './kernelDocumentBridge.ts';",resolveDir:fileURLToPath(new URL('../expressions-app/field-studies-journeys/src/',import.meta.url)),loader:'ts'},tsconfig:fileURLToPath(new URL('../expressions-app/field-studies-journeys/tsconfig.json',import.meta.url)),bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
  const converted=api.kernelDocumentToJourney(document),instruments=await api.readingInstruments(resolved,api.nativeInstrumentTitles(converted,converted.startSceneId));
  const walk=await instruments.timeline.getTimelineWalk(scene.scene_ref,{startYear:2019,endYear:2022});
  assert.equal(walk.earthboundNodes.length,2,'continuity refs must not manufacture calendar dates');
  assert.deepEqual(walk.earthboundNodes.map(row=>row.date).sort(),['2020-04-03T12:30:00Z','2021-01-01T00:00:00Z']);
  assert.equal(walk.earthboundNodes.find(row=>row.graphNodeId===temporal[1].facet_ref).precision,'year');
  for(const row of walk.earthboundNodes){assert.ok(row.title.includes('Same source, distinct native occurrence'),'actual occurrence names reach Timeline');const node=await instruments.dataSource.loadNode(row.graphNodeId);assert.deepEqual(node.sourceCoordinates,[sourceRow.ref]);}
  const located=await instruments.places.getLocatedNodes(scene.scene_ref);assert.equal(located.length,2);assert.equal(located[0].graphNodeId,places[0].place_ref);assert.equal(located[0].place.names[0].name,places[0].identity.names[0].name);assert.deepEqual(located[0].sourceCoordinates,[subject]);assert.deepEqual(located[0].place.coordinate,{latitude:51.51,longitude:-0.09,precision:'exact'});
  const unnamed=located.find(row=>row.graphNodeId===places[1].place_ref);assert.deepEqual(unnamed.place.names,[],'an absent authored name stays absent');assert.ok(unnamed.title.includes('Same source, distinct native occurrence'),'the display label uses its exact Scene occurrence title');assert.equal(resolved.spatial[1].identity,undefined);
  const interval=instruments.bundle.nodes.find(row=>row.graphNodeId===temporal[1].facet_ref);assert.equal(interval.validTo,temporal[1].interval.to);
  assert.equal(JSON.stringify(document),bytes,'temporal reading does not add a state or model to the native document');
  assert.equal(await readBytes(sourcePath,'utf8'),sourceBytes,'reading does not mutate native Wiki source');
  const emptyScene=document.expression_ref+':scene:undated';
  const edited=await kernelOp(transport,{op:'expression',request:{operation:'edit',expression_ref:document.expression_ref,expected_revision:document.revision,actor:'human:native-temporal-regression',changes:[{change:'scene_create',scene_ref:emptyScene,title:'No dated members'},{change:'scene_compose',scene_ref:emptyScene,entity_refs:[scene.entity_refs[0]]}]}});
  assert.equal(edited.error,undefined);const emptyDocument=edited.outcome.data.document;
  // This Scene has a real source member, but not both endpoints of the dated edge.
  const emptyRequest={...requestReading,revision:emptyDocument.revision,scene_ref:emptyScene};
  const undated=await readWikiSceneTechne(transport,emptyRequest);assert.equal(undated.temporal,undefined,'a Scene cannot borrow dates from a relation outside its membership');assert.equal(undated.disclosure.instruments.find(row=>row.instrument==='timeline').available,false);
  assert.equal(undated.spatial,undefined,'another occurrence of the same source cannot borrow a placed participation');assert.equal(undated.disclosure.instruments.find(row=>row.instrument==='place').available,false);
  const emptyInstruments=await api.readingInstruments(undated);assert.equal((await emptyInstruments.places.getLocatedNodes(emptyScene)).length,0);assert.equal((await emptyInstruments.timeline.getTimelineWalk(emptyScene,{startYear:2019,endYear:2022})).earthboundNodes.length,0);
  if(retained)await writeFile(join(scratch,'native-spatial-proof.json'),JSON.stringify({schema:'oi.native-spatial-proof/v1',environment:{OI_CENTRAL_ROOT:root,CENTRAL_ROOT:root,OI_HOME:home,AIKIT_HOME:env.AIKIT_HOME,OI_BIN:env.OI_BIN,OI_AIKIT_BIN:env.OI_AIKIT_BIN,OI_CENTRAL_CTRL_BIN:env.OI_CENTRAL_CTRL_BIN},expression_ref:document.expression_ref,scene_ref:scene.scene_ref,revision:emptyDocument.revision,source_path:sourcePath,reading:resolved,timeline:walk,document:emptyDocument},null,2)+'\n');
 }finally{if(child){const stopped=child.exitCode===null?once(child,'exit'):null;try{process.kill(-child.pid,'SIGTERM');}catch{}if(stopped)await stopped;}if(!retained)await rm(scratch,{recursive:true,force:true});}
});
