/** Production editor draft/checkpoint -> actual native frame CAS -> independent
 * native register read. All mutations are in a disposable Central World. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,readFile,writeFile,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {readRegister,invoke,saveConstruction} from '../src/knowledge/construction.ts';
import {fromNative,draftRequest} from '../src/knowledge/constructionDraft.ts';
import {restoreConstructionCheckpoint} from '../src/knowledge/constructionCheckpoint.ts';
import {readWikiTemporal} from '../src/techne/temporalFacets.ts';
import {formatYearLabel} from '../expressions-app/vendor/research-canvas/packages/canvas/src/timeline/ticks.ts';
import {parseTemporalInstant} from '../expressions-app/vendor/research-canvas/packages/canvas/src/timeline/instant.ts';
import {readParticipationEvidence} from '../src/knowledge/participationEvidence.ts';
const enabled=process.env.OI_NATIVE_PARTICIPATION_FACTS==='1';
test('participation editor saves, preserves, explicitly clears, recovers and refuses stale native facts',{skip:!enabled,timeout:120000},async()=>{
 for(const key of ['OI_KERNEL_BIN','OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN'])assert.ok(process.env[key],key+' required');
 const scratch=await realpath(await mkdtemp(join(tmpdir(),'oi-participation-facts-'))),root=join(scratch,'Central'),home=join(scratch,'oi-home');let child,stderr='';
 const env={...process.env,CENTRAL_ROOT:root,OI_CENTRAL_ROOT:root,OI_HOME:home,AIKIT_HOME:join(scratch,'aikit-home'),OI_CENTRAL_PROJECT_QUERY:''};
 const central=(action,input)=>{const out=JSON.parse(execFileSync(env.OI_CENTRAL_CTRL_BIN,['--root',root,'--json','action','run',action,JSON.stringify(input)],{env,encoding:'utf8',timeout:30000}));assert.equal(out.ok,true,JSON.stringify(out));return out.data;};
 try{
  await mkdir(root);await mkdir(home);central('central.init',{});await mkdir(join(root,'Work/Facts'),{recursive:true});
  const parent=central('central.files.list',{path:'Work/Facts'}).location;
  const receipt=central('central.files.create',{parent,name:'survey.txt',content:'Explicit synthetic evidence: 2024-06-03T10:30:00Z and [-0.09,51.51].',expected_absent:true,operation_ref:'native:participation-source',actor:'native-regression',actor_kind:'human'});
  child=spawn(env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,detached:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',chunk=>stderr+=chunk);
  const url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error(stderr||'Native startup timed out')),30000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Native exited '+code+stderr));});child.stdout.on('data',chunk=>{output+=chunk;const match=/listening on (http:\/\/\S+)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const transport={kind:'bridge',url},register=await readRegister(transport),basis=await readParticipationEvidence(transport,'Work/Facts/survey.txt');assert.deepEqual(basis.location,receipt.location);assert.ok(register.file.source,'native Wiki is a participating source');const registerEvidence=await readParticipationEvidence(transport,register.file.location.path);assert.equal(registerEvidence.source_ref,register.file.source.ref);assert.equal(registerEvidence.revision,register.file.revision);
  const frameRef='wiki:frame:participation-facts',part='participation:wiki:facts';
  const create={schema:'aikit.constellation-action/v1',frame_ref:frameRef,expected_revision:0,actor_ref:'human:native-facts-regression',operation_ref:'operation:wiki:facts-create',changes:[{change:'create',anchor_ref:'wiki:anchor:facts',title:'Participation input proof',inquiry:{question:'Does this exact member own its authored time/place?'},space_refs:[register.spaces[0].ref],frame:null},...['',':other'].map(suffix=>({change:'member_add',member:{subject_ref:register.spaces[0].ref,participation:{participation_ref:part+suffix,role_ref:null,sources:[],note:'Same source, distinct participation'}}}))]};
  assert.equal((await invoke(transport,undefined,'aikit.constellation.apply',frameRef,{location:register.file.location,expected_file_revision:register.file.revision,request:create,sources:[]})).persisted,true);
  let current=await readRegister(transport),frame=current.frames.find(row=>row.ref===frameRef),draft=fromNative(frame,current.relations);
  const historical=['-000027-01-01T00:00:00Z','-000001-01-01T00:00:00Z','-000001-07-01T00:00:00Z','0000-07-01T00:00:00Z','0001-01-01T00:00:00Z','0100-01-01T00:00:00Z'];
  const temporal=[...historical.map((instant,index)=>({facet_ref:'wiki:temporal:historical-'+index,kind:'occurrence',instant,precision:'century',source_ref:basis.source_ref})),{facet_ref:'wiki:temporal:facts',kind:'occurrence',instant:'2024-06-03T10:30:00Z',precision:'minute',source_ref:basis.source_ref}],places=[{place_ref:'wiki:place:facts',identity:{names:[{name:'Declared test point'}]},geometry:{type:'point',coordinates:[-0.09,51.51]},precision:'exact',source_ref:basis.source_ref}];
  draft.members[0]={...draft.members[0],temporal,places,facet_sources:[basis]};
  const request=draftRequest(draft),restored=restoreConstructionCheckpoint(JSON.parse(JSON.stringify({draft,pending:request})));assert.deepEqual(restored.pending,request);assert.deepEqual(restored.draft.members[0].facet_sources,[basis]);
  const saved=await saveConstruction(transport,undefined,current,restored.pending,[],undefined,restored.draft.members.flatMap(row=>row.facet_sources??[]));assert.equal(saved.persisted,true);
  current=await readRegister(transport);frame=current.frames.find(row=>row.ref===frameRef);
  assert.deepEqual(frame.constellations[0].members[0]['aikit.techne-facet/v1'],{contract:'aikit.techne-facet/v1',temporal,spatial:places});assert.equal(frame.constellations[0].members[1]['aikit.techne-facet/v1'],undefined);
  const reading=readWikiTemporal(current.file.content);assert.equal(reading.state,'available',JSON.stringify(reading));const observed=reading.sources.find(row=>row.frame?.participation_ref===part).facets;assert.deepEqual(observed,temporal);const years=observed.slice(0,historical.length).map(fact=>parseTemporalInstant(fact.instant));assert.ok(years.every((year,index)=>Number.isFinite(year)&&(index===0||year>years[index-1])),JSON.stringify(years));assert.equal(years[0],-27);assert.ok(years[2]>-1&&years[2]<0);assert.ok(years[3]>0&&years[3]<1);assert.equal(years[4],1);assert.equal(years[5],100);assert.deepEqual([-27,-1,0,1,100].map(year=>formatYearLabel(year,'century')),['28 BCE','2 BCE','1 BCE','1 CE','100 CE']);
  draft=fromNative(frame,current.relations);assert.deepEqual(draft.members[0].temporal,temporal);assert.deepEqual(draft.members[0].places,places);
  const compiled=await build({stdin:{contents:"export {ParticipationFacts} from './ParticipationFacts.tsx';export {createElement} from 'react';export {renderToStaticMarkup} from 'react-dom/server';",resolveDir:fileURLToPath(new URL('../src/knowledge/',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'cjs',jsx:'automatic',write:false,logLevel:'silent'});const bundleFile=join(scratch,'facts.cjs');await writeFile(bundleFile,compiled.outputFiles[0].text);const ui=createRequire(import.meta.url)(bundleFile);
  const html=ui.renderToStaticMarkup(ui.createElement(ui.ParticipationFacts,{member:draft.members[0],basis:frame.constellations[0].members[0],transport,onChange:()=>{throw Error('render must not edit');}}));for(const expected of ['this participation',...historical,'2024-06-03T10:30:00Z','Declared test point','Reset time and place to saved values','Read evidence file','Remove time fact 1'])assert.ok(html.includes(expected),expected);
  draft.members[0]={...draft.members[0],temporal:[]};const clear=draftRequest(draft);assert.deepEqual(clear.changes,[{change:'temporal_set',participation_ref:part,temporal:[]}]);
  assert.equal((await saveConstruction(transport,undefined,current,clear,[])).persisted,true);current=await readRegister(transport);frame=current.frames.find(row=>row.ref===frameRef);assert.deepEqual(frame.constellations[0].members[0]['aikit.techne-facet/v1'].spatial,places);assert.equal(frame.constellations[0].members[0]['aikit.techne-facet/v1'].temporal,undefined);
  const before=await readFile(join(root,current.file.location.path));assert.equal((await saveConstruction(transport,undefined,current,request,[],undefined,[basis])).state,'unchanged','exact already-applied operation is idempotent');await assert.rejects(saveConstruction(transport,undefined,current,{...request,operation_ref:'operation:wiki:stale-new-attempt'},[],undefined,[basis]),/construction changed; inspect and explicitly reconcile/);assert.deepEqual(await readFile(join(root,current.file.location.path)),before);
  draft=fromNative(frame,current.relations);draft.members[0]={...draft.members[0],temporal,facet_sources:[{...basis,revision:'stale'}]};await assert.rejects(saveConstruction(transport,undefined,current,draftRequest(draft),[],undefined,draft.members[0].facet_sources),/source_revision_conflict/);assert.deepEqual(await readFile(join(root,current.file.location.path)),before);
  assert.equal((await readParticipationEvidence(transport,'Work/Facts/survey.txt')).revision,basis.revision);console.log(JSON.stringify({native_participations:2,historical_owner_instants:historical,historical_render_years:years,dated_and_placed:1,other_unchanged:true,checkpoint_recovered:true,explicit_clear_preserved_place:true,stale_frame_and_source_refused:true,source_unchanged:true}));
 }finally{if(child){const stopped=child.exitCode===null?once(child,'exit'):null;try{process.kill(-child.pid,'SIGTERM');}catch{}if(stopped)await stopped;}await rm(scratch,{recursive:true,force:true});}
});
