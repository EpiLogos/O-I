/** Actual native fact writes and Expression projections. A shared node never
 * lends one containing whole's or participation's facts to another whole. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resolveHostedSource} from '../src/expressions/sourceHandoff.ts';
import {readRegister} from '../src/knowledge/construction.ts';
import {projectConstruction} from '../src/knowledge/constructionProjection.ts';
import {kernelOp} from '../src/kernel/bridge.ts';
import {publishWikiNativeRegisters} from '../src/techne/wikiNativeExpression.ts';
import {readWikiRegister,projectWikiExpression} from '../src/techne/wikiExpression.ts';
import {readWikiTemporal,resolveSceneTemporalFacets} from '../src/techne/temporalFacets.ts';
import {readWikiSpatial,sceneSpatialFacets} from '../src/techne/spatialFacets.ts';

test('native node, whole and participation facts remain separately bound in authored and generated Scenes',{
 skip:process.env.OI_NATIVE_WIKI_FACTS!=='1',timeout:120000,
},async()=>{
 for(const key of ['OI_KERNEL_BIN','OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN'])assert.ok(process.env[key],key+' required');
 const scratch=await mkdtemp(join(tmpdir(),'oi-whole-facts-')),root=join(scratch,'Central');let child;
 const env={...process.env,OI_CENTRAL_ROOT:root,CENTRAL_ROOT:root,OI_HOME:join(scratch,'oi-home'),AIKIT_HOME:join(scratch,'aikit-home'),OI_CENTRAL_PROJECT_QUERY:''};
 try{
  await mkdir(root);
  assert.equal(JSON.parse(execFileSync(env.OI_CENTRAL_CTRL_BIN,['--root',root,'--json','action','run','central.init','{}'],{env,encoding:'utf8',timeout:30000})).ok,true);
  child=spawn(env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,detached:true,stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
  const url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error(stderr||'Native startup timed out')),30000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Native exited '+code+stderr));});child.stdout.on('data',chunk=>{output+=chunk;const match=/listening on (http:\/\/[^ ]+)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const transport={kind:'bridge',url};publishWikiNativeRegisters([]);
  const native=async request=>{const result=await kernelOp(transport,{op:'expression',request});assert.equal(result.error,undefined,result.error);assert.ok(result.outcome?.data.document);return result.outcome.data.document;};
  let sequence=0;
  const write=async(verb,request)=>{
   const register=await readRegister(transport);
   const result=JSON.parse(execFileSync(env.OI_AIKIT_BIN,['--json','-C',root,'wiki-construct',verb,'--file',join(root,register.file.location.path)],{env,input:JSON.stringify({basis_content:register.file.content,request}),encoding:'utf8',timeout:30000}));
   assert.equal(result.ok,true,JSON.stringify(result));return readRegister(transport);
  };
  const shared='wiki:anchor:shared-node',frameA='wiki:frame:facts-a',frameB='wiki:frame:facts-b',partA='participation:wiki:facts-a',partB='participation:wiki:facts-b';
  const create=async(ref,anchor,parts)=>{
   const register=await readRegister(transport);
   return write('apply',{schema:'aikit.constellation-action/v1',frame_ref:ref,expected_revision:0,actor_ref:'human:native-whole-facts-test',operation_ref:`operation:wiki:create-${++sequence}`,changes:[
    {change:'create',anchor_ref:anchor,title:'Synthetic source fact scope '+sequence,inquiry:{question:'Do exact native facts remain on their selected owner?'},space_refs:[register.spaces[0].ref],frame:null},
    ...parts.map(part=>({change:'member_add',member:{subject_ref:shared,participation:{participation_ref:part,role_ref:null,sources:[],note:'Shared source, exact native occurrence'}}})),
   ]});
  };
  await create('wiki:frame:shared-node-owner',shared,[]);
  await create(frameA,'wiki:anchor:facts-a',[partA,partB]);
  await create(frameB,'wiki:anchor:facts-b',['participation:wiki:facts-other-whole']);
  const facts=label=>({temporal:[{facet_ref:`wiki:time:${label}`,kind:'occurrence',instant:`${label==='node'?'2000':label==='whole-a'?'2001':label==='whole-b'?'2002':'2003'}-01-01T00:00:00Z`,precision:'year',source_ref:shared}],places:[{place_ref:`wiki:place:${label}`,precision:'unlocated',source_ref:shared}]});
  const set=async(kind,ref,label)=>{
   const register=await readRegister(transport),raw=JSON.parse(register.file.content),object=raw.objects.find(row=>row.ref===ref);assert.ok(object);
   const value=facts(label);
   return write('facts-apply',{schema:'aikit.wiki-facts-action/v1',target:{kind,ref},expected_revision:object.revision,actor_ref:'human:native-whole-facts-test',operation_ref:`operation:wiki:facts-${++sequence}`,changes:[{change:'temporal_set',temporal:value.temporal},{change:'place_set',places:value.places}]});
  };
  await set('node',shared,'node');await set('whole',frameA,'whole-a');await set('whole',frameB,'whole-b');
  let register=await readRegister(transport),frame=register.frames.find(row=>row.ref===frameA),part=facts('participation');
  register=await write('apply',{schema:'aikit.constellation-action/v1',frame_ref:frameA,expected_revision:frame.revision,actor_ref:'human:native-whole-facts-test',operation_ref:`operation:wiki:participation-${++sequence}`,changes:[{change:'temporal_set',participation_ref:partB,temporal:part.temporal},{change:'place_set',participation_ref:partB,places:part.places}]});
  const sourcePath=join(root,register.file.location.path),sourceBytes=await readFile(sourcePath,'utf8');
  const temporal=readWikiTemporal(sourceBytes),spatial=readWikiSpatial(sourceBytes);assert.equal(temporal.state,'available');assert.equal(spatial.state,'available');
  const check=async(document,sceneRef,labels)=>{
   const scene=document.scenes.find(row=>row.scene_ref===sceneRef);assert.ok(scene);
   const time=await resolveSceneTemporalFacets(temporal,document,scene),place=await sceneSpatialFacets(spatial,document,scene);
   assert.deepEqual(time.temporal.map(f=>f.facet_ref).sort(),labels.map(label=>`wiki:time:${label}`).sort());
   assert.deepEqual(place.spatial.map(f=>f.place_ref).sort(),labels.map(label=>`wiki:place:${label}`).sort());
   for(const label of labels.filter(label=>label.startsWith('whole'))){
    const owner=label==='whole-a'?frameA:frameB;
    assert.deepEqual(time.provenance.filter(p=>p.selector.value===`wiki:time:${label}`).map(p=>p.source_ref),[owner]);
    assert.deepEqual(place.provenance.filter(p=>p.selector.value===`wiki:place:${label}`).map(p=>p.source_ref),[owner]);
   }
  };
  const authored=[];
  for(const [ref,labels] of [[frameA,['node','whole-a','participation']],[frameB,['node','whole-b']]]){
   const frame=register.frames.find(row=>row.ref===ref),opened=await projectConstruction(transport,undefined,frame,register.relations,register);assert.equal(opened.state,'ready',JSON.stringify(opened));
   authored.push(opened.document);await check(opened.document,opened.document.selection.scene_ref,labels);
   const target=await resolveHostedSource(transport,{ref:`temporal:${ref}`,subject:{ref:opened.document.expression_ref,revision:opened.document.revision,sceneRef:opened.document.selection.scene_ref},context:{node:{graphNodeId:`temporal:${ref}`,sourceCoordinates:[ref]}}});
   assert.deepEqual(target.address,{kind:'wiki',value:ref});assert.equal(target.returnTo.passageId,opened.document.selection.scene_ref);
   const other=ref===frameA?frameB:frameA;
   await assert.rejects(resolveHostedSource(transport,{ref:other,subject:{ref:opened.document.expression_ref,revision:opened.document.revision,sceneRef:opened.document.selection.scene_ref}}),/no single source/);
  }
  const live=await readWikiRegister(transport,{key:'central',title:'Central'});assert.equal(live.state,'ready');
  const projection=projectWikiExpression(live);let generated=await native({operation:'open',document:projection.document,actor:'human:native-whole-facts-test'});
  for(const [anchor,labels] of [['wiki:anchor:facts-a',['node','whole-a','participation']],['wiki:anchor:facts-b',['node','whole-b']]]){
   const sceneRef=projection.constellations.find(row=>row.wholeRef===anchor).sceneRef;
   await check(generated,sceneRef,labels);
   const scene=generated.scenes.find(row=>row.scene_ref===sceneRef),scoped=scene.entity_refs.filter(ref=>generated.entities[ref].subject.readings.some(r=>r.ref===partA));
   if(scoped.length){
    const subset=generated.expression_ref+':scene:one-participation';
    const narrowed=await native({operation:'edit',expression_ref:generated.expression_ref,expected_revision:generated.revision,actor:'human:native-whole-facts-test',changes:[{change:'scene_create',scene_ref:subset,title:'Exact undated participation'},{change:'scene_compose',scene_ref:subset,entity_refs:scoped}]});
    await check(narrowed,subset,['node','whole-a']);generated=narrowed;
   }
  }
  assert.equal(await readFile(sourcePath,'utf8'),sourceBytes,'Scene reading never writes facts back to source');
  await set('whole',frameA,'whole-a'); // real owner revision advance, unchanged fact values
  const changed=await readFile(sourcePath,'utf8'),old=authored[0],oldScene=old.scenes.find(row=>row.scene_ref===old.selection.scene_ref);
  await assert.rejects(resolveHostedSource(transport,{ref:frameA,subject:{ref:old.expression_ref,revision:old.revision,sceneRef:oldScene.scene_ref}}),/changed|revision/);
  await assert.rejects(resolveSceneTemporalFacets(readWikiTemporal(changed),old,oldScene),/changed source membership|revision/);
  await assert.rejects(sceneSpatialFacets(readWikiSpatial(changed),old,oldScene),/changed source membership|revision/);
 }finally{if(child){const stopped=child.exitCode===null?once(child,'exit'):null;try{process.kill(-child.pid,'SIGTERM');}catch{}if(stopped)await stopped;}await rm(scratch,{recursive:true,force:true});}
});
