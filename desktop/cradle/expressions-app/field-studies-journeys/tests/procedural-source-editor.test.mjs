import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),proposal=process.env.OI_SOURCE_EDITOR_PROPOSAL;
const actualSrc=path.join(root,'src'),helper=proposal?path.join(proposal,'sourceEditor.ts'):path.join(actualSrc,'sourceEditor.ts');
const proposalFile=name=>proposal?path.join(proposal,'source-editor-'+name):path.join(actualSrc,name);
const ownerApp=readFileSync(proposalFile('app.ts'),'utf8'),start=ownerApp.indexOf('function editStateLayers('),end=ownerApp.indexOf('\nfunction modalCloseButton',start);
assert.ok(start>=0&&end>start,'test executes actual receiving-owner layer writer');
const compiled=await build({absWorkingDir:root,stdin:{contents:
"export * from "+JSON.stringify(helper)+";export * from 'owner:liveWorkspace.ts';export * from 'owner:imageSuite.ts';export {inspectorHTML} from 'owner:inspector.ts';export {blankJourney,entity,clone} from './src/model';export {kernelDocumentToJourney} from './src/kernelDocumentBridge';import {clone} from './src/model';import {preserveLayerStates} from './src/sourceState';import {syncHeldState} from './src/workspacePreferences';"+ownerApp.slice(start,end)+"\nexport {editStateLayers};",
resolveDir:root,loader:'ts'},plugins:[{name:'actual-owner-proposal',setup(b){b.onResolve({filter:/^owner:/},args=>({path:args.path.slice(6),namespace:'actual-owner'}));b.onLoad({filter:/.*/,namespace:'actual-owner'},args=>({contents:readFileSync(proposalFile(args.path),'utf8'),loader:'ts',resolveDir:actualSrc}));}}],bundle:true,write:false,format:'esm',platform:'node',target:'es2022',nodePaths:[path.resolve(root,'../node_modules')]});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {blankJourney,entity,clone,captureSourceEditor,resolveSourceEditor,admitSourceEditor,sourceEditorValue,editStateLayers,liveWorkspaceHTML,imageSuiteHTML,inspectorHTML,kernelDocumentToJourney,captureSourceUpload,admitSourceUpload}=api;
function authored(){
 const journey=blankJourney('Source editing'),scene=journey.scenes[0],e=entity('Continuing formation','A'),other=entity('Other subject','C');
 e.sequence.steps=[{id:'state:A',text:'A',shape:'text',hold:1,transition:.5,position:null,layers:[{id:'layer:front',text:'F',z:.1,source:{kind:'ascii',ascii:{text:'F  F\n F ',fontFamily:'monospace'}}},{id:'layer:back',text:'B',z:-.1}]},{id:'state:B',text:'B',shape:'text',hold:1,transition:.5,position:null,layers:[{id:'layer:other-state',text:'O',z:.2}]}];
 scene.entities=[e,other];const context={journey,scene_id:scene.id,selected:[e.id],expression_ref:'expression:source-editors',scene_ref:'scene:native:source',entity_refs:{[e.id]:'entity:native:A',[other.id]:'entity:native:C'}};
 return {context,scene,e,other};
}
test('actual receiving adapter follows stable state/layer IDs through entity, state and layer reorder',()=>{
 const {context,scene,e}=authored(),target=captureSourceEditor(context,e.id,'state:A','layer:front'),before=clone(context.journey);
 scene.entities.reverse();e.sequence.steps.reverse();e.sequence.steps.find(k=>k.id==='state:A').layers.reverse();
 const material=admitSourceEditor(context,target,'layer.text','F');assert.equal(material.state_index,1);assert.equal(material.layer_index,1);
 editStateLayers(material.entity,material.state_index,()=>{material.entity.layers.find(l=>l.id===target.layer_ref).text='Human';});
 assert.equal(e.sequence.steps.find(k=>k.id==='state:A').layers.find(l=>l.id==='layer:front').text,'Human');
 assert.equal(e.sequence.steps.find(k=>k.id==='state:A').layers.find(l=>l.id==='layer:back').text,'B');
 assert.equal(e.sequence.steps.find(k=>k.id==='state:B').layers[0].text,before.scenes[0].entities[0].sequence.steps[1].layers[0].text);
});
test('foreign native identity, wrong selected subject and missing target refuse before changing actual source bytes',()=>{
 const {context,e,other}=authored(),target=captureSourceEditor(context,e.id,'state:A','layer:front');
 for(const update of [{subject_basis:'source:wrong-prime'},{journey_id:'elsewhere'},{scene_id:'another'},{expression_ref:'expression:foreign'},{scene_ref:'scene:foreign'},{entity_ref:'entity:foreign'},{state_ref:'state:missing'},{layer_ref:'layer:missing'}]){
  const before=JSON.stringify(context.journey);assert.throws(()=>admitSourceEditor(context,{...target,...update},'layer.text','F'));assert.equal(JSON.stringify(context.journey),before);
 }
 context.subject_basis={[e.id]:JSON.stringify({subject_ref:'subject:prime',sources:[{ref:"+#1-2\'",revision:'r1'}]})};assert.throws(()=>admitSourceEditor(context,target,'layer.text','F'),/earlier native/);delete context.subject_basis;
 context.selected=[other.id];assert.throws(()=>admitSourceEditor(context,target,'layer.text','F'),/original source occurrence/);
});
test('concurrent native source changes, duplicate IDs and locks refuse with no source mutation',()=>{
 const {context,e}=authored(),target=captureSourceEditor(context,e.id,'state:A','layer:front');e.sequence.steps[0].layers[0].text='Native';
 const before=JSON.stringify(context.journey);assert.throws(()=>admitSourceEditor(context,target,'layer.text','F'),/changed in the native/);assert.equal(JSON.stringify(context.journey),before);
 e.sequence.steps[0].layers[0].text='F';e.locked=true;assert.throws(()=>admitSourceEditor(context,target,'layer.text','F'),/Unlock/);e.locked=false;
 e.sequence.steps[0].layers.push(clone(e.sequence.steps[0].layers[0]));assert.throws(()=>resolveSourceEditor(context,target),/ambiguous/);e.sequence.steps[0].layers.pop();
 e.sequence.steps.push(clone(e.sequence.steps[0]));assert.throws(()=>resolveSourceEditor(context,target),/ambiguous/);
});
test('source read retains exact ASCII whitespace/depth and inherited source rule without constructing a second model',()=>{
 const {context,e}=authored(),target=captureSourceEditor(context,e.id,'state:A','layer:front'),m=resolveSourceEditor(context,target);
 assert.equal(sourceEditorValue(m,'layer.ascii'),'F  F\n F ');assert.equal(sourceEditorValue(m,'layer.depth'),.1);
 const state=captureSourceEditor(context,e.id,'state:A');e.sequence.steps[0].source={kind:'ascii',ascii:{text:'  A\nA  ',fontFamily:'monospace'}};assert.equal(sourceEditorValue(resolveSourceEditor(context,state),'step.source.ascii.text'),'  A\nA  ');
 e.sequence.steps[0].source=undefined;e.source={kind:'ascii',ascii:{text:'Legacy',fontFamily:'monospace'}};e.sequence.sourcesVersion=undefined;assert.equal(sourceEditorValue(resolveSourceEditor(context,state),'step.source.ascii.text'),'Legacy');e.sequence.sourcesVersion=1;assert.equal(sourceEditorValue(resolveSourceEditor(context,state),'step.source.ascii.text'),undefined);
 assert.equal(sourceEditorValue(m,'step.__proto__.polluted'),undefined);
});
test('actual existing layer writer preserves edited legacy layer identity while migrating other state carriers',()=>{
 const {context,e}=authored();e.layers=[{id:'legacy:front',text:'F',z:.1},{id:'legacy:back',text:'B',z:-.1}];for(const k of e.sequence.steps)delete k.layers;
 const target=captureSourceEditor(context,e.id,'state:A','legacy:front'),m=admitSourceEditor(context,target,'layer.text','F');
 editStateLayers(m.entity,m.state_index,()=>{m.entity.layers.find(l=>l.id==='legacy:front').text='H';});
 assert.equal(e.sequence.steps[0].layers[0].id,'legacy:front');assert.equal(e.sequence.steps[0].layers[0].text,'H');assert.equal(resolveSourceEditor(context,target).layer.text,'H');
 assert.notEqual(e.sequence.steps[1].layers[0].id,'legacy:front');assert.equal(e.sequence.steps[1].layers[0].text,'F');
});
test('actual existing source HTML emits real state/layer identity and never selection index as state reference',()=>{
 const {context,e,scene}=authored(),ctx={scene,journey:context.journey,selected:[e.id],stepIndex:0,textId:null,tab:'objects',motionTab:'sequence',preview:false,search:'',supported:[],pinned:[]};
 const live=liveWorkspaceHTML(ctx,{entries:[],appearance:'light'}).sequence,source=imageSuiteHTML(scene,e.id,0);
 assert.ok(live.includes('data-state-ref="state:A"'));assert.ok(live.includes('data-state-ref="state:B"'));assert.ok(live.includes('data-layer-ref="layer:front"'));
 const studio=inspectorHTML({...ctx,tab:'motion',motionTab:'sequence'});for(const state of e.sequence.steps)assert.ok(studio.includes(`data-state-ref="${state.id}"`),'actual Studio state producer must carry its own stable ref');
 assert.ok(source.includes('value="state:A"'));assert.ok(source.includes('value="state:B"'));assert.ok(!source.includes('<option value="1"'));
});
test('actual image read re-admits original layer identity after reordered states and layers',async()=>{
 const {context,e}=authored(),intent=captureSourceUpload(context,e.id,'state:A','layer:front');
 assert.ok(Object.isFrozen(intent)&&Object.isFrozen(intent.target));
 const image=readFile(path.join(root,'../collections/return-of-zero/essay/roz-essay-reading.cover.png'));
 e.sequence.steps.reverse();e.sequence.steps.find(k=>k.id==='state:A').layers.reverse();
 const bytes=await image;assert.equal(bytes.subarray(1,4).toString(),'PNG');const m=admitSourceUpload(context,intent);
 assert.equal(m.state_index,1);assert.equal(m.layer_index,1);assert.equal(m.layer.id,'layer:front');
});
test('actual file-read boundaries refuse same-ID foreign Expression, changed principal/source and replaced layer before any writer',async()=>{
 const changes=[
  ({context})=>{context.expression_ref='expression:foreign-same-view-ids';},
  ({context,e})=>{context.subject_basis={[e.id]:JSON.stringify({subject_ref:'subject:prime',sources:[{ref:"#1-2'",revision:'source-r2'}]})};},
  ({e})=>{e.sequence.steps[0].layers[0].source={kind:'ascii',ascii:{text:'Concurrent native source',fontFamily:'monospace'}};},
  ({e})=>{e.sequence.steps[0].layers[0]={...e.sequence.steps[0].layers[0],z:.8};},
  ({context,other})=>{context.selected=[other.id];},
 ];
 for(const mutate of changes){const fixture=authored(),intent=captureSourceUpload(fixture.context,fixture.e.id,'state:A','layer:front');admitSourceUpload(fixture.context,intent);
  const reading=readFile(path.join(root,'../collections/return-of-zero/essay/roz-essay-reading.cover.png'));mutate(fixture);await reading;
  const before=JSON.stringify(fixture.context.journey);assert.throws(()=>admitSourceUpload(fixture.context,intent));assert.equal(JSON.stringify(fixture.context.journey),before);
 }
});
test('state image upload fences actual intervening source/fit changes after every awaited read; append membership has its own basis',async()=>{
 const fixture=authored(),{context,e}=fixture,intent=captureSourceUpload(context,e.id,'state:A');
 await readFile(path.join(root,'../collections/return-of-zero/essay/roz-essay-reading.cover.png'));assert.equal(admitSourceUpload(context,intent).state.id,'state:A');
 e.sequence.steps[0].source={kind:'ascii',ascii:{text:'Intervening state source',fontFamily:'monospace'}};
 await readFile(path.join(root,'../collections/return-of-zero/essay/roz-essay-reading.cover.png'));const before=JSON.stringify(context.journey);assert.throws(()=>admitSourceUpload(context,intent),/source or append basis changed/);assert.equal(JSON.stringify(context.journey),before);
 const appended=authored(),append=captureSourceUpload(appended.context,appended.e.id,'state:A',null,true);assert.equal(append.mode,'append');assert.ok(append.append_basis);
 appended.e.sequence.steps.reverse();assert.throws(()=>admitSourceUpload(appended.context,append),/append basis changed/);
 const fit=authored(),fitted=captureSourceUpload(fit.context,fit.e.id,'state:A');fit.e.size.x*=2;assert.throws(()=>admitSourceUpload(fit.context,fitted),/source or append basis changed/);
});
test('validate genuine installed source editor retention/reorder/conflict/refusal evidence',{skip:process.env.OI_SOURCE_EDITOR_EVIDENCE?false:'UNEXECUTED: actual native owner mount/browser reception required'},()=>{
 const evidence=JSON.parse(readFileSync(process.env.OI_SOURCE_EDITOR_EVIDENCE,'utf8'));
 assert.equal(evidence.execution,'passed');assert.equal(evidence.mocked_transport,false);assert.equal(evidence.actual_native_expression_ref,evidence.initial_native_basis.expression_ref);assert.ok(evidence.entry.frame_url);
 for(const name of ['discard_unchanged_basis_never_writes_dirty_source','escape_cancels_source_draft_without_native_write','native_update_retains_same_source_control_and_text','reordered_state_and_layer_edit_reaches_original_native_ids','concurrent_source_change_refuses_and_retains_text','wrong_selected_subject_refuses_source_write','missing_state_refuses_source_write','explicit_discard_adopts_current_source','studio_two_state_buttons_reach_exact_existing_editors','native_source_change_refuses_async_image_and_retains_file','native_pulse_retains_upload_retry_discard_reachability'])assert.ok(evidence.checks.some(c=>c.name===name&&c.passed),'missing actual browser check '+name);
 assert.ok(evidence.native_reads.length>=4);assert.ok(evidence.native_reads.every(d=>d.expression_ref===evidence.actual_native_expression_ref&&Number.isSafeInteger(d.revision)));
 assert.equal(evidence.page_errors.length,0);assert.ok(evidence.final_native_basis.revision>evidence.initial_native_basis.revision);
});

