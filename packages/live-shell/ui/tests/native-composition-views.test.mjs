import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';

// Run production sources in memory. CSS is a non-executable SSR asset, not a
// replacement component. No emitted build, native owner or GPU is simulated.
const root = new URL('../../../../', import.meta.url);
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href;
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
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url);
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root);
const [{kernelDocumentToJourney}, {prepareCompositionEdit}, {DocumentStore}, {createRetainedNativeEditor, applyNativeGlyphChanges},
  {toNativeEntity}, {readNativeExpressionsContent, createNativeContentActions},
  {nativeSourceLanes, readNativeSourceTimeline, selectNativeSource, editNativeSourceTiming, currentCompositionReply, createNativeCompositionPresentationGuard},
  {SessionView}, {ArrangementView}, React, {renderToStaticMarkup}] = await Promise.all([
  import(new URL('kernelDocumentBridge.ts',author)), import(new URL('kernelComposition.ts',author)), import(new URL('store.ts',author)),
  import(new URL('hostEditor.ts',author)), import(new URL('nativeBridge.ts',author)), import('../src/shell/nativeContent.ts'),
  import('../src/shell/compositionViews.ts'), import('../src/components/SessionView.tsx'), import('../src/components/ArrangementView.tsx'),
  import('react'), import('react-dom/server'),
]);

// An actual owner read-only inspection receipt, with raw request/response
// evidence and unchanged before/after owner inventory. Override its location
// when replaying this source suite on another machine; no synthetic fallback.
const receiptPath = process.env.OI_NATIVE_COMPOSITION_RECEIPT ?? '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json';
const receipt = JSON.parse(await readFile(receiptPath,'utf8'));
const nativeDocument = receipt.after.document;
assert.deepEqual(nativeDocument,receipt.before.document);
assert.deepEqual(receipt.inventoryBefore.expressions,receipt.inventoryAfter.expressions);
const nativeBytes = JSON.stringify(nativeDocument);
const blocked = () => {throw Error('Read-only source verification does not dispatch native effects')};

function retained(document = nativeDocument) {
  const view = kernelDocumentToJourney(document), store = new DocumentStore(view.journey);
  const scene = store.document.scenes.find(s => s.id === view.startSceneId) ?? store.document.scenes[0];
  const binding = view.bindings[scene.id];
  const selected = binding.occurrences.find(o => o.entity_ref === document.selection.entity_ref);
  const selection = {entity_ids:selected ? [selected.view_entity_id] : [],step_id:scene.entities[0]?.sequence.steps[0]?.id ?? null};
  const owner = createRetainedNativeEditor({store,sceneId:()=>scene.id,selection:()=>selection,nativeView:()=>view,
    nativeSelect:blocked,commit:blocked,change:mutate=>store.change(mutate),afterHistory:blocked,selectLocal:blocked,openEditor:blocked,
    standing:()=>({busy:false,notice:null}),telemetry:()=>undefined,fieldPaused:()=>false});
  return {view,store,scene,binding,owner,reading:owner.read()};
}
function boundary(content) {
  const requests = [],reveals = [];
  const actions = createNativeContentActions(content,{request:async request=>{requests.push(structuredClone(request));return blocked()}});
  return {source:{owner:'expressions',content,actions,isPresented:()=>true,revealDetail:mode=>reveals.push(mode)},requests,reveals};
}

test('a retired composition cut refuses dispatch and late acknowledgement presentation', async () => {
  const {reading} = retained(), content = readNativeExpressionsContent(reading), {source,requests} = boundary(content);
  const retired = {...source,isPresented:()=>false};
  const clip = content.clip_sources[0];
  assert.equal((await selectNativeSource(retired,clip.id)).ok,false);
  assert.equal((await editNativeSourceTiming(retired,clip.id,clip.sequence.steps[0].id,{hold:2.5})).ok,false);
  assert.deepEqual(requests,[]);
  assert.equal(currentCompositionReply(retired,source,{ok:true,reading}),false);
});

test('actual rich owner read joins exact native source/Scene identities without reducing rich material',()=>{
  const {reading,binding} = retained(), content = readNativeExpressionsContent(reading), lanes = nativeSourceLanes(content);
  assert.equal(lanes.length,1); assert.equal(content.tracks.length,2);
  const lane = lanes[0], entity = reading.scene.entities[0];
  assert.equal(lane.source.sequence,entity.sequence);
  assert.equal(lane.source.scope.entity_ref,binding.occurrences[0].entity_ref);
  assert.equal(lane.member.scene_ref,nativeDocument.selection.scene_ref);
  assert.notEqual(lane.member.id,lane.source.id);assert.notEqual(lane.source.id,lane.member.track_id);
  assert.equal(lane.source.sequence.steps.length,3);
  assert.equal(lane.source.sequence.steps[0].layers.length,2);
  assert.deepEqual(lane.source.sequence.steps,entity.sequence.steps);
  assert.ok(JSON.stringify(entity).includes('data:image/png;base64,'));
  assert.equal(JSON.stringify(nativeDocument),nativeBytes);
});

test('source seconds resolve actual native authored timing without creating beat or instance positions',()=>{
  const {reading} = retained(),content = readNativeExpressionsContent(reading),timeline = readNativeSourceTimeline(content,'seconds');
  assert.equal(timeline.unit,'seconds');assert.equal(timeline.lanes.length,1);
  const entity = reading.scene.entities[0],native = toNativeEntity({...entity,sequence:{...entity.sequence,enabled:true}});
  let end = 0;
  for (const state of timeline.lanes[0].states) {
    const link = native.sequence.links.find(link=>link.id===state.step_id);
    assert.equal(state.axis_start,end);assert.equal(state.hold_seconds,link.hold ?? native.sequence.hold);
    assert.equal(state.transition_seconds,link.transition ?? native.sequence.transition);
    end += state.hold_seconds + state.transition_seconds;assert.equal(state.axis_end,end);
  }
  assert.equal(timeline.duration,end);assert.equal(readNativeSourceTimeline(content,'morph').lanes.length,0);
});

test('wrong Scene and occurrence joins are refused before reaching any effect boundary',async()=>{
  const content = readNativeExpressionsContent(retained().reading),{source,requests} = boundary(content);
  for(const alter of [c=>{c.scene.scene_ref+=':other'},c=>{c.scene_members[0].scene_ref+=':other'},c=>{c.clip_sources[0].scope={...c.clip_sources[0].scope,entity_ref:c.clip_sources[0].scope.entity_ref+':other'}},c=>{c.clip_sources.push(c.clip_sources[0])}]) {
    const wrong = structuredClone(content);alter(wrong);
    assert.throws(()=>nativeSourceLanes(wrong),/captured composition basis|exact track|Ambiguous/);
  }
  assert.equal((await selectNativeSource(source,'absent')).ok,false);
  assert.equal((await selectNativeSource(source,content.clip_sources[0].id,'absent')).ok,false);
  assert.equal((await editNativeSourceTiming(source,content.clip_sources[0].id,content.clip_sources[0].sequence.steps[0].id,{hold:3600.1})).ok,false);
  assert.equal(requests.length,0);
});

test('generated selection and editor-opening requests retain captured basis and stable state targets',async()=>{
  const {store,owner,reading} = retained(),content = readNativeExpressionsContent(reading),{source,requests,reveals} = boundary(content);
  const clip = content.clip_sources[0],step = clip.sequence.steps[1];
  store.touch();assert.notEqual(owner.read().basis.authored_revision,content.basis.authored_revision);
  await assert.rejects(selectNativeSource(source,clip.id,step.id),/does not dispatch/);
  await assert.rejects(source.actions.openClip(clip.id,step.id,'layers'),/does not dispatch/);
  assert.deepEqual(requests.map(r=>r.basis),[content.basis,content.basis]);
  assert.deepEqual(requests.map(r=>[r.operation,r.entity_id,r.step_id]),[['select',clip.scope.view_entity_id,step.id],['open',clip.scope.view_entity_id,step.id]]);
  assert.equal(requests[1].editor,'layers');assert.deepEqual(reveals,[]);
  const refusal = await source.actions.selectClip(clip.id,'absent');
  assert.equal(currentCompositionReply(source,source,refusal),true);
  assert.equal(currentCompositionReply(source,{...source,content:readNativeExpressionsContent(owner.read())},refusal),false);
});

test('one Arrangement timing request edits the real store and builds exact native CAS while retaining sources/layers/racks',async()=>{
  const {view,store,scene,owner,reading} = retained(),content = readNativeExpressionsContent(reading),{source,requests} = boundary(content);
  const clip = content.clip_sources[0],step = clip.sequence.steps[1],before = structuredClone(store.document);
  await assert.rejects(editNativeSourceTiming(source,clip.id,step.id,{hold:2.75,transition:.65}),/does not dispatch/);
  const request = requests[0];assert.equal(request.operation,'apply');assert.deepEqual(request.basis,content.basis);
  // Run the real retained owner through its real DocumentStore transaction.
  // A deliberately closed native-write boundary refuses commit; the authored
  // draft and undo entry must remain available for the existing recovery flow.
  await assert.rejects(owner.apply(request),/does not dispatch/);
  const after = structuredClone(store.document),edited = after.scenes.find(s=>s.id===scene.id).entities[0];
  assert.equal(edited.sequence.steps[1].hold,2.75);assert.equal(edited.sequence.steps[1].transition,.65);
  const retainedStep = {...edited.sequence.steps[1]};
  for(const key of ['hold','transition','holdOverride','transitionOverride'])delete retainedStep[key];
  const originalStep = {...before.scenes[0].entities[0].sequence.steps[1]};
  for(const key of ['hold','transition','holdOverride','transitionOverride'])delete originalStep[key];
  assert.deepEqual(retainedStep,originalStep);
  assert.deepEqual(edited.sequence.steps[0],before.scenes[0].entities[0].sequence.steps[0]);
  assert.deepEqual(edited.sequence.steps[2],before.scenes[0].entities[0].sequence.steps[2]);
  assert.deepEqual(edited.native,before.scenes[0].entities[0].native);
  const {sequence:beforeSequence,...beforeEntity} = before.scenes[0].entities[0];
  const {sequence:afterSequence,...afterEntity} = edited;
  assert.deepEqual(afterEntity,beforeEntity);
  assert.deepEqual(after.scenes[0].field,before.scenes[0].field);
  const nativeEdit = prepareCompositionEdit(view,store.document,{sceneId:scene.id,entityId:edited.id});
  assert.equal(nativeEdit.expression_ref,nativeDocument.expression_ref);assert.equal(nativeEdit.expected_revision,nativeDocument.revision);
  assert.equal(nativeEdit.changes.filter(c=>c.change==='scene_material_set').length,1);
  assert.ok(nativeEdit.changes.every(c=>!['entity_add','scene_create','scene_compose'].includes(c.change)));
  assert.equal(store.undoStack.length,1);assert.equal(store.undo(),true);assert.deepEqual(store.document,before);
  assert.equal(store.redo(),true);assert.deepEqual(store.document,after);
  assert.equal(JSON.stringify(nativeDocument),nativeBytes);
});

test('production presentation guard retires delayed settlement on unmount and does not revive it on remount',async()=>{
  const {store,owner,reading} = retained(),content = readNativeExpressionsContent(reading),{source} = boundary(content);
  const reply = await source.actions.selectClip(content.clip_sources[0].id,'absent');
  assert.equal(reply.ok,false);
  const guard = createNativeCompositionPresentationGuard(),unmount = guard.mount(),firstMount = guard.capture(source);
  assert.equal(firstMount(source,reply),true);
  let deliver;
  const delayed = new Promise(resolve=>{deliver=resolve}).then(result=>firstMount(source,result));
  unmount();deliver(reply);assert.equal(await delayed,false);
  const unmountAgain = guard.mount();
  assert.equal(firstMount(source,reply),false);
  const secondMount = guard.capture(source);assert.equal(secondMount(source,reply),true);
  store.touch();const humanWork = {...source,content:readNativeExpressionsContent(owner.read())};
  assert.equal(secondMount(humanWork,reply),false);
  unmount();assert.equal(secondMount(source,reply),true); // retired cleanup cannot close the newer mount
  unmountAgain();assert.equal(secondMount(source,reply),false);
});

test('real sequence clock edit exposes morph cycles and refuses a seconds edit of shared Field dwell',async()=>{
  const base = retained(),entity = base.scene.entities[0];
  base.store.replace(applyNativeGlyphChanges(base.store.document,base.scene.id,[{kind:'sequence-settings',entity_id:entity.id,values:{clock:'morph'}}]));
  const content = readNativeExpressionsContent(base.owner.read()),timeline = readNativeSourceTimeline(content,'morph'),{source,requests} = boundary(content);
  assert.equal(timeline.unit,'Field morph cycles');assert.equal(timeline.duration,3);
  assert.deepEqual(timeline.lanes[0].states.map(s=>[s.axis_start,s.axis_end]),[[0,1],[1,2],[2,3]]);
  assert.equal(readNativeSourceTimeline(content,'seconds').lanes.length,0);
  const reply = await editNativeSourceTiming(source,content.clip_sources[0].id,entity.sequence.steps[0].id,{hold:2});
  assert.equal(reply.ok,false);assert.match(reply.error,/shared Field dwell/);assert.equal(requests.length,0);
});

const audioProps = {set:null,document:null,selection:{track:0,scene:null},select:blocked,colors:[],setColor:blocked};
test('actual resident SSR displays exact native membership and authored states without audio transport controls',()=>{
  const content = readNativeExpressionsContent(retained().reading),{source,requests} = boundary(content);
  const session = renderToStaticMarkup(React.createElement(SessionView,{...audioProps,native:source}));
  const arrangement = renderToStaticMarkup(React.createElement(ArrangementView,{...audioProps,native:source}));
  const objects=[...new Set(content.scenes.scenes.flatMap(row=>row.member_refs))];
  assert.equal((session.match(/data-native-object=/g)??[]).length,objects.length);
  for(const ref of objects)assert.ok(session.includes(`data-native-object="${ref}"`));
  const members=content.scenes.scenes.reduce((count,row)=>count+row.members.length,0);
  assert.equal((session.match(/class="clip-slot[^"\n]*occupied-slot/g)??[]).length,members);
  for(const row of content.scenes.scenes)for(const ref of objects){
    const member=row.members.find(member=>member.entity_ref===ref);
    const label=`${content.scenes.object_titles[ref]}, ${row.title}${member?`, ${member.state}`:', absent'}`;
    const escaped=renderToStaticMarkup(React.createElement('span',null,label)).slice(6,-7);
    assert.ok(session.includes(`aria-label="${escaped}"`),`exact native matrix cell: ${ref} in ${row.scene_ref}`);
  }
  assert.equal((arrangement.match(/class="arrange-clip native-state-span"/g)??[]).length,3);
  assert.match(session,/>Scenes</);assert.match(session,/>Field</);assert.match(arrangement,/Glyph source timing/);
  assert.match(arrangement,/Authored source time in seconds/);assert.match(arrangement,/>Layers</);
  for(const html of [session,arrangement])assert.doesNotMatch(html,/MIDI From|Audio From|Launch scene|track-stop|arrange-loop-brace|Arm requires/);
  assert.equal(requests.length,0);
});
test('existing audio empty-state route remains unchanged when no native owner is supplied',()=>{
  for(const Component of [SessionView,ArrangementView])assert.equal(renderToStaticMarkup(React.createElement(Component,audioProps)),'<div class="view-empty">Open a Live set from the browser.</div>');
});

// Execute the exact production presentation closures. Setter observations
// are UI effects, not substitute native owners or fabricated native replies.
const ts=(await import(compiler)).default;
const parse=async path=>ts.createSourceFile(path,await readFile(new URL(path,root),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const appSource=await parse('packages/live-shell/ui/src/App.tsx'),detailSource=await parse('packages/live-shell/ui/src/components/NativeWorldDetail.tsx');
const find=(source,predicate)=>{const matches=[];const walk=node=>{if(predicate(node))matches.push(node);ts.forEachChild(node,walk)};walk(source);assert.equal(matches.length,1);return matches[0];};
const nativeViewInitializer=find(appSource,node=>ts.isVariableDeclaration(node)&&node.name.getText(appSource)==='nativeView').initializer.getText(appSource);
const configurationEffect=find(detailSource,node=>ts.isCallExpression(node)&&node.expression.getText(detailSource)==='useEffect'&&node.arguments[0]?.getText(detailSource).includes('consumedConfiguration.current')).arguments[0].getText(detailSource);
const execute=(text,bindings)=>new Function(...Object.keys(bindings),ts.transpileModule(`const selected=${text};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText+'\nreturn selected;')(...Object.values(bindings));
const {sameEditorBasis}=await import('../../../expressions-boundary/src/editor.ts');
const {nextSceneFrom}=await import(new URL('sceneWorkflow.ts',author));
function presentation(){
  const {view,store,scene,reading}=retained(),content=readNativeExpressionsContent(reading),next=nextSceneFrom(store.document,scene);
  const compilerRequest=prepareCompositionEdit(view,store.document),created=compilerRequest.changes.find(change=>change.change==='scene_create');
  assert.ok(created,'shifted Scene reference must come from the real composition compiler');
  assert.notEqual(next.id,scene.id);
  const shifted={...reading.basis,scene_ref:created.scene_ref,revision:reading.basis.revision+1};
  const currentEditorReading={current:{...reading,basis:shifted}},state={workspaceId:'source-test-workspace',accessEpoch:7,editor:{request:blocked},mode:'expressions',centerPanel:'native.session',settingsPresented:false,epoch:0};
  const effects=[],presentation={current:state};
  const nativeView=execute(nativeViewInitializer,{workspace:{...state,nativeAccessCurrent:epoch=>epoch===7},presentation,nativeProjection:{content},currentEditorReading,createNativeContentActions,sameEditorBasis,
    changeDetailMode:mode=>effects.push(['mode',mode]),setDetail:value=>effects.push(['detail',value]),configureDetail:update=>effects.push(['intent',update(null)])});
  return {source:nativeView('session'),effects,currentEditorReading,presentation,reading,shifted};
}
test('actual App reveal routes an explicitly supplied shifted Scene basis to exact current detail intent',()=>{
  const p=presentation();p.source.revealDetail('clip','scene',p.shifted);
  assert.deepEqual(p.effects,[['mode','clip'],['detail',true],['intent',{id:1,workspaceId:'source-test-workspace',accessEpoch:7,expression_ref:p.shifted.expression_ref,scene_ref:p.shifted.scene_ref,mode:'clip',material:'scene'}]]);
});
test('actual App reveal refuses captured old Scene and later human basis or retired presentation',()=>{
  const old=presentation();old.source.revealDetail('clip','scene');assert.deepEqual(old.effects,[]);
  for(const retire of [p=>{p.currentEditorReading.current.basis={...p.shifted,authored_revision:p.shifted.authored_revision+1}},p=>{p.presentation.current={...p.presentation.current,epoch:1}},p=>{p.presentation.current={...p.presentation.current,settingsPresented:true}},p=>{p.presentation.current={...p.presentation.current,mode:'audio'}}]){
    const p=presentation();retire(p);
    p.source.revealDetail('clip','scene',p.shifted);
    assert.deepEqual(p.effects,[]);
  }
});
function applyConfiguration(mode,family,alter=()=>{}){
  const p=presentation(),effects=[],reading=p.currentEditorReading.current;
  const configurationIntent={id:1,workspaceId:'source-test-workspace',accessEpoch:7,expression_ref:reading.basis.expression_ref,scene_ref:reading.basis.scene_ref,mode,...(mode==='clip'?{material:family==='scene'?'scene':'glyph'}:{family})};
  const bindings={configurationIntent,mode,consumedConfiguration:{current:null},workspace:{mode:'expressions',workspaceId:'source-test-workspace',accessEpoch:7},reading,
    residence:{current:{getClientRects:()=>[{}]}},setClipSurface:value=>effects.push(['clip',value]),setConfigure:value=>effects.push(['configure',value]),chooseConfiguration:value=>effects.push(['family',value])};
  alter(bindings);execute(configurationEffect,bindings)();return effects;
}
test('actual Scene detail effect enters device configuration and retains clip Scene routing',()=>{
  assert.deepEqual(applyConfiguration('device','scene'),[['configure',true],['family','scene']]);
  assert.deepEqual(applyConfiguration('clip','scene'),[['clip','scene']]);
  assert.deepEqual(applyConfiguration('clip',undefined),[['clip','glyph']]);
  for(const alter of [b=>{b.workspace.mode='audio'},b=>{b.workspace.accessEpoch++},b=>{b.configurationIntent.mode='clip'},b=>{b.configurationIntent.scene_ref='scene:unrelated'},b=>{b.residence.current.getClientRects=()=>[]}])assert.deepEqual(applyConfiguration('device','scene',alter),[]);
});

test('actual devicePresented requires the device cut, exact native access and real residence visibility',()=>{
 const initializer=find(detailSource,n=>ts.isVariableDeclaration(n)&&n.name.getText(detailSource)==='devicePresented').initializer.getText(detailSource);
 const state={mode:'device',configure:true,configuration:'device',workspaceId:'actual-current-cut',accessEpoch:7},scenePresentation={current:state};
 const bindings={scenePresentation,sceneWorkspaceId:state.workspaceId,sceneAccessEpoch:7,workspace:{nativeAccessCurrent:epoch=>epoch===7},residence:{current:{getClientRects:()=>[{}]}}};
 assert.equal(execute(initializer,bindings)(),true);
 for(const change of [{mode:'clip'},{configure:false},{configuration:'scene'},{configuration:'rack'},{workspaceId:'departed'},{accessEpoch:8}]){
  scenePresentation.current={...state,...change};assert.equal(execute(initializer,bindings)(),false);
 }
 scenePresentation.current={...state};
 assert.equal(execute(initializer,{...bindings,workspace:{nativeAccessCurrent:()=>false}})(),false);
 assert.equal(execute(initializer,{...bindings,residence:{current:{getClientRects:()=>[]}}})(),false);
});

test('actual Deep Return restores the captured exact height and refuses a departed native residence',()=>{
 const element=find(appSource,n=>ts.isJsxSelfClosingElement(n)&&n.tagName.getText(appSource)==='NativeWorldDetail');
 const attribute=name=>find(element,n=>ts.isJsxAttribute(n)&&n.name.getText(appSource)===name).initializer.expression.getText(appSource);
 for(const height of [null,319.997,421]){
  const detailExpansionReturn={current:null},effects=[],workspace={workspaceId:'current-native-residence',accessEpoch:7};
  const bindings={detailExpansionReturn,detailHeight:height,workspace,viewport:[1200,577],resizeDetail:value=>effects.push(value)};
  const expand=execute(attribute('expand'),bindings),collapse=execute(attribute('collapse'),bindings);
  expand();assert.equal(detailExpansionReturn.current.height,height);expand();collapse();
  assert.deepEqual(effects,[421,421,height]);assert.equal(detailExpansionReturn.current,null);
  expand();workspace.accessEpoch++;collapse();assert.deepEqual(effects,[421,421,height,421]);
 }
});

test('actual NativeWorldDetail ordinary Return uses restoration without switching Glyph into another editor',async()=>{
 const deep=find(detailSource,n=>ts.isVariableDeclaration(n)&&n.name.getText(detailSource)==='deep').initializer.getText(detailSource);
 const effects=[];
 await execute(deep,{residence:{current:{}},expanded:true,fullscreen:false,restoreDepth:()=>effects.push('restore'),expand:()=>{throw Error('Return cannot expand again')},setConfigure:()=>{throw Error('Return cannot choose another editor')},setConfiguration:()=>{throw Error('Return cannot choose another family')}})();
 assert.deepEqual(effects,['restore']);
});

test('actual read-only editor transport publishes the owning reading before await and later human work cannot reuse its detail basis',async()=>{
 const [{ExpressionsHost},{createNativeEditorClient},{installNativeEditorReceiver},{MessageChannel}]=await Promise.all([
  import('../../../expressions-boundary/src/host.ts'),import('../../../expressions-boundary/src/editorHost.ts'),import(new URL('hostEditor.ts',author)),import('node:worker_threads')]);
 const subscriptionEffect=find(appSource,n=>ts.isCallExpression(n)&&n.expression.getText(appSource)==='useEffect'&&n.arguments[0]?.getText(appSource).includes('workspace.editor?.subscribe')).arguments[0].getText(appSource);
 const r=retained(),origin='http://127.0.0.1:8788',messages=new EventTarget(),target=new EventTarget(),frame=new EventTarget(),{port1,port2}=new MessageChannel();
 const message=(data,source)=>Object.assign(new Event('message'),{data,source,origin});
 const parent={postMessage(data,targetOrigin){assert.equal(targetOrigin,origin);port2.postMessage(data)}};
 target.parent=parent;target.location={origin};frame.src=origin+'/__application/expressions/index.html';frame.closest=()=>null;
 frame.contentWindow={postMessage(data,targetOrigin){assert.equal(targetOrigin,origin);port1.postMessage(data)}};
 const host=new ExpressionsHost(frame,{bindingId:'read-only-source-publisher',owners:{channels:{}},messageTarget:new EventTarget(),isPresented:()=>true});
 port2.on('message',data=>target.dispatchEvent(message(data,parent)));
 const publicationBarriers=[];
 port1.on('message',data=>{messages.dispatchEvent(message(data,frame.contentWindow));while(publicationBarriers.length)publicationBarriers.shift()()});
 const receiver=installNativeEditorReceiver(r.owner,target),client=createNativeEditorClient(host,messages);
 const currentEditorReading={current:r.reading},workspace={editor:client,editorReading:r.reading};
 const stop=execute(subscriptionEffect,{workspace,currentEditorReading})();
 try{
  await host.handleMessage({source:frame.contentWindow,origin,data:{v:1,kind:'oi-app-state',state:{hostMode:'expressions',sceneCount:r.view.document.scenes.length,document:{id:r.view.document.expression_ref,name:r.view.document.title},nativeScene:{expression_ref:r.reading.basis.expression_ref,revision:r.reading.basis.revision,scene_ref:r.reading.basis.scene_ref}}}});
  const initial=await client.request({operation:'read'});assert.equal(initial.ok,true);assert.deepEqual(initial.reading,r.owner.read());assert.equal(currentEditorReading.current,initial.reading);
  const entity=r.scene.entities[0],step=entity.sequence.steps[0];
  r.store.change(()=>{r.store.document=applyNativeGlyphChanges(r.store.document,r.scene.id,[{kind:'step-timing',entity_id:entity.id,step_id:step.id,hold:step.hold+.1}])});
  assert.equal(workspace.editorReading,r.reading,'React context is deliberately still the prior real source reading');
  const reply=await client.request({operation:'read'});assert.equal(reply.ok,true);assert.deepEqual(reply.reading,r.owner.read());assert.equal(currentEditorReading.current,reply.reading,'actual owning read publication runs before Promise await');
  assert.ok(reply.reading.basis.authored_revision>initial.reading.basis.authored_revision);
  const presentationState={workspaceId:'source-publisher-cut',accessEpoch:7,editor:client,mode:'expressions',centerPanel:'native.arrangement',settingsPresented:false,epoch:0},effects=[];
  const view=execute(nativeViewInitializer,{workspace:{...presentationState,nativeAccessCurrent:epoch=>epoch===7},presentation:{current:presentationState},nativeProjection:{content:readNativeExpressionsContent(initial.reading)},currentEditorReading,createNativeContentActions,sameEditorBasis,changeDetailMode:value=>effects.push(['mode',value]),setDetail:value=>effects.push(['detail',value]),configureDetail:update=>effects.push(['intent',update(null)])})('arrangement');
  view.revealDetail('clip',undefined,reply.reading.basis);assert.equal(effects[2][1].material,'glyph');assert.equal(effects[2][1].scene_ref,reply.reading.basis.scene_ref);
  effects.length=0;
  r.store.change(()=>{r.store.document=applyNativeGlyphChanges(r.store.document,r.scene.id,[{kind:'step-timing',entity_id:entity.id,step_id:step.id,hold:step.hold+.2}])});
  const published=new Promise(resolve=>publicationBarriers.push(resolve));receiver.publish();await published;
  assert.deepEqual(currentEditorReading.current,r.owner.read());view.revealDetail('clip',undefined,reply.reading.basis);assert.deepEqual(effects,[],'later actual human revision refuses the old acknowledged read basis');
  stop();const retainedRef=currentEditorReading.current;
  r.store.change(()=>{r.store.document=applyNativeGlyphChanges(r.store.document,r.scene.id,[{kind:'step-timing',entity_id:entity.id,step_id:step.id,hold:step.hold+.3}])});
  const departed=new Promise(resolve=>publicationBarriers.push(resolve));receiver.publish();await departed;
  assert.equal(currentEditorReading.current,retainedRef,'retired App subscription cannot overwrite its captured ref');
 }finally{stop();receiver.dispose();client.dispose();host.dispose();port1.close();port2.close()}
});

test('actual installed Glyph expand is ensure-open and never toggles an existing deep Device into Return',()=>{
 const expandGlyphDevice=find(detailSource,n=>ts.isVariableDeclaration(n)&&n.name.getText(detailSource)==='expandGlyphDevice').initializer.getText(detailSource);
 for(const state of [{expanded:true,fullscreen:false},{expanded:false,fullscreen:true},{expanded:true,fullscreen:true},{expanded:false,fullscreen:false}]){
  const effects=[],receive=execute(expandGlyphDevice,{...state,setClipSurface:value=>effects.push(['surface',value]),presentMode:value=>effects.push(['mode',value]),deep:()=>effects.push(['deep','capture-and-expand'])});
  receive();assert.deepEqual(effects,[['surface','glyph'],['mode','clip'],...(!state.expanded&&!state.fullscreen?[['deep','capture-and-expand']]:[])]);
 }
});

test('actual compact and full Glyph presentation predicates admit only their visible sibling and exact native access',()=>{
 const compact=find(detailSource,n=>ts.isVariableDeclaration(n)&&n.name.getText(detailSource)==='compactGlyphPresented').initializer.getText(detailSource);
 const full=find(detailSource,n=>ts.isVariableDeclaration(n)&&n.name.getText(detailSource)==='glyphPresented').initializer.getText(detailSource);
 const state={mode:'device',configure:false,configuration:'device',clipSurface:'glyph',workspaceId:'captured-native-detail',accessEpoch:7},scenePresentation={current:state};
 const bindings={scenePresentation,sceneWorkspaceId:state.workspaceId,sceneAccessEpoch:7,workspace:{nativeAccessCurrent:epoch=>epoch===7},residence:{current:{getClientRects:()=>[{}]}}};
 assert.equal(execute(compact,bindings)(),true);assert.equal(execute(full,bindings)(),false);
 scenePresentation.current={...state,mode:'clip'};assert.equal(execute(compact,bindings)(),false);assert.equal(execute(full,bindings)(),true);
 scenePresentation.current={...state,mode:'clip',clipSurface:'scene'};assert.equal(execute(full,bindings)(),false);
 for(const mode of ['device','clip'])for(const retire of [b=>{b.scenePresentation={current:{...state,mode,workspaceId:'other'}}},b=>{b.scenePresentation={current:{...state,mode,accessEpoch:8}}},b=>{b.workspace={nativeAccessCurrent:()=>false}},b=>{b.residence={current:{getClientRects:()=>[]}}}]){
  const b={...bindings,scenePresentation:{current:{...state,mode}}};retire(b);assert.equal(execute(compact,b)(),false);assert.equal(execute(full,b)(),false);
 }
});

test('actual detail destination waits for its matching mode before consuming the native intent',()=>{
 const p=presentation(),reading=p.currentEditorReading.current,configurationIntent={id:42,workspaceId:'source-test-workspace',accessEpoch:7,expression_ref:reading.basis.expression_ref,scene_ref:reading.basis.scene_ref,mode:'clip',material:'glyph'},consumedConfiguration={current:null},effects=[];
 const bindings={configurationIntent,mode:'device',consumedConfiguration,workspace:{mode:'expressions',workspaceId:'source-test-workspace',accessEpoch:7},reading,residence:{current:{getClientRects:()=>[{}]}},setClipSurface:value=>effects.push(['clip',value]),setConfigure:()=>{throw Error('Clip destination cannot configure another editor')},chooseConfiguration:()=>{throw Error('Clip destination cannot choose a device family')}};
 execute(configurationEffect,bindings)();assert.equal(consumedConfiguration.current,null);assert.deepEqual(effects,[]);
 execute(configurationEffect,{...bindings,mode:'clip'})();assert.equal(consumedConfiguration.current,42);assert.deepEqual(effects,[['clip','glyph']]);
 execute(configurationEffect,{...bindings,mode:'clip'})();assert.deepEqual(effects,[['clip','glyph']]);
});

test('actual queued Deep Return keeps same Scene edited work but refuses departed owner before scroll or focus restoration',()=>{
 const restore=find(detailSource,n=>ts.isVariableDeclaration(n)&&n.name.getText(detailSource)==='restoreDepth').initializer.getText(detailSource);
 function receiving(){
  const r=retained(),effects=[],queued=[],view=new EventTarget();view.scrollLeft=0;
  const focus=new EventTarget();focus.isConnected=true;focus.focus=options=>effects.push(['focus',options]);
  const deepReturn={current:{mode:'device',configure:false,configuration:'device',focus,scroll:314.5}},lifetime={current:1};
  const requestResidence={current:{mode:'clip',workspaceId:'return-native-residence',accessEpoch:7,editor:r.owner,expression:r.reading.basis.expression_ref}};
  const currentWorkspace={current:{editorReading:r.reading,nativeAccessCurrent:epoch=>epoch===7}};
  const residence={current:{getClientRects:()=>[{}],querySelector:selector=>{assert.equal(selector,'.native-device-view');return view}}};
  const bindings={deepReturn,lifetime,requestResidence,currentWorkspace,residence,setExpanded:value=>effects.push(['expanded',value]),collapse:()=>effects.push(['height','restore']),presentMode:value=>{effects.push(['mode',value]);requestResidence.current.mode=value},setConfigure:value=>effects.push(['configure',value]),setConfiguration:value=>effects.push(['configuration',value]),requestAnimationFrame:callback=>queued.push(callback)};
  execute(restore,bindings)();assert.equal(deepReturn.current,null);assert.equal(queued.length,1);assert.equal(view.scrollLeft,0);assert.deepEqual(effects,[['expanded',false],['height','restore'],['mode','device'],['configure',false],['configuration','device']]);
  return {r,effects,queued,view,bindings};
 }
 const same=receiving(),entity=same.r.scene.entities[0],step=entity.sequence.steps[0];
 same.r.store.change(()=>{same.r.store.document=applyNativeGlyphChanges(same.r.store.document,same.r.scene.id,[{kind:'step-timing',entity_id:entity.id,step_id:step.id,hold:step.hold+.15}])});
 same.bindings.currentWorkspace.current.editorReading=same.r.owner.read();assert.ok(same.bindings.currentWorkspace.current.editorReading.basis.authored_revision>same.r.reading.basis.authored_revision);
 same.queued.shift()();assert.equal(same.view.scrollLeft,314.5);assert.deepEqual(same.effects.at(-1),['focus',{preventScroll:true}]);assert.equal(same.r.store.undoStack.length,1);
 const retires=[p=>{p.bindings.lifetime.current++},p=>{p.bindings.requestResidence.current.workspaceId='departed'},p=>{p.bindings.requestResidence.current.accessEpoch++},p=>{p.bindings.requestResidence.current.editor=retained().owner},p=>{p.bindings.requestResidence.current.expression='expression:departed'},p=>{p.bindings.currentWorkspace.current.editorReading={...p.r.reading,basis:{...p.r.reading.basis,scene_ref:presentation().shifted.scene_ref}}},p=>{p.bindings.currentWorkspace.current.nativeAccessCurrent=()=>false},p=>{p.bindings.residence.current.getClientRects=()=>[]}];
 for(const retire of retires){const p=receiving(),before=structuredClone(p.r.store.document);retire(p);p.queued.shift()();assert.equal(p.view.scrollLeft,0);assert.equal(p.effects.some(effect=>effect[0]==='focus'),false);assert.deepEqual(p.r.store.document,before);assert.equal(p.r.store.undoStack.length,0)}
});


test('actual rich image state and depth layers have separate retained source renderers with exact state identity',async()=>{
 const [{imageSuiteHTML},{inspectorHTML},{liveWorkspaceHTML},{stateSource},{esc}]=await Promise.all([
  import(new URL('imageSuite.ts',author)),import(new URL('inspector.ts',author)),import(new URL('liveWorkspace.ts',author)),import(new URL('sourceState.ts',author)),import(new URL('icons.ts',author)),
 ]);
 const r=retained(),before=JSON.stringify(r.store.document);
 const entity=r.scene.entities.find(e=>e.kind==='formation'&&e.sequence.steps.some((_,index)=>stateSource(e,index)?.kind==='image'));
 assert.ok(entity,'archived native receipt must disclose an actual image-bearing state');
 const index=entity.sequence.steps.findIndex((_,i)=>stateSource(entity,i)?.kind==='image'),step=entity.sequence.steps[index],source=stateSource(entity,index);
 const ctx={scene:r.scene,journey:r.store.document,selected:[entity.id],textId:null,tab:'objects',motionTab:'sequence',stepIndex:index,preview:false,search:'',customFont:false,supported:[],pinned:[],automationLoop:false,fieldPaused:false};
 const image=imageSuiteHTML(r.scene,entity.id,index);
 assert.ok(image.includes(`data-entity-id="${esc(entity.id)}"`));
 assert.ok(image.includes(`value="${index}" selected`));
 assert.ok(image.includes(`data-source-step="${index}"`));
 assert.ok(image.includes('data-bind="step.source.image.mode"'));
 assert.ok(image.includes(esc(source.image.name??'No image chosen')));
 const objects=inspectorHTML(ctx);
 assert.ok(objects.includes('data-action="image-suite"'),'ordinary objects controls disclose the real separate source editor action');
 assert.equal(objects.includes('data-detail="sources"'),false);
 assert.equal(objects.includes('data-detail="layers"'),false);
 assert.equal(objects.includes('data-bind="step.source.image.mode"'),false);
 const layeredIndex=entity.sequence.steps.findIndex(k=>(k.layers??entity.layers??[]).length>0);
 assert.ok(layeredIndex>=0,'archived native receipt must disclose a real layered state');
 const layers=entity.sequence.steps[layeredIndex].layers??entity.layers;
 const live=liveWorkspaceHTML({...ctx,stepIndex:layeredIndex},{entries:[]});
 assert.ok(live.sequence.includes('class="live-layers"'));
 for(let i=0;i<layers.length;i++)assert.ok(live.sequence.includes(`data-layer-index="${i}"`));
 assert.equal(live.sequence.includes('data-detail="layers"'),false);
 assert.equal(JSON.stringify(r.store.document),before,'renderer reads preserve complete actual native source and layer payload');
 assert.equal(r.store.undoStack.length,0);
});


test('actual acknowledged native open presentation ensures Source, Layers or Placement without toggling or retargeting rich state',async()=>{
 const [{imageSuiteHTML},{liveWorkspaceHTML},{stateSource}]=await Promise.all([
  import(new URL('imageSuite.ts',author)),import(new URL('liveWorkspace.ts',author)),import(new URL('sourceState.ts',author)),
 ]);
 const nativeApp=await parse('desktop/cradle/expressions-app/field-studies-journeys/src/app.ts');
 const receiver=find(nativeApp,n=>ts.isCallExpression(n)&&n.expression.getText(nativeApp)==='createRetainedNativeEditor');
 const callback=receiver.arguments[0].properties.find(n=>n.name?.getText(nativeApp)==='openEditor').initializer.getText(nativeApp);
 const r=retained(),before=JSON.stringify(r.store.document);
 const entity=r.scene.entities.find(e=>e.kind==='formation'&&e.sequence.steps.some((_,i)=>stateSource(e,i)?.kind==='image'));
 assert.ok(entity);const imageIndex=entity.sequence.steps.findIndex((_,i)=>stateSource(entity,i)?.kind==='image');
 const renderLive=find(nativeApp,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='renderLive');
 const secondary=find(nativeApp,n=>ts.isVariableDeclaration(n)&&n.name.getText(nativeApp)==='secondary'&&n.parent.parent.parent===renderLive.body).initializer.getText(nativeApp);
 const base={scene:r.scene,journey:r.store.document,selected:[entity.id],textId:null,tab:'objects',motionTab:'sequence',stepIndex:imageIndex,preview:false,search:'',customFont:false,supported:[],pinned:[],automationLoop:false,fieldPaused:false};
 // These are presentation observers only. The actual open callback and real
 // source/layer renderers run; no native selection or mutation ACK is supplied.
 const instantiate=()=>new Function('base','imageSuiteHTML','liveWorkspaceHTML',ts.transpileModule(`
  let selected=[],stepIndex=-1,editing=false,libraryOpen=true,presenting=true,contextKind='objects',beltPickerOpen=true,timelineOpen=true,shapePickerOpen=true,modesOpen=true,inspectorOpen=true,studioOpen=true,captureOpen=false,sequenceOpen=false,placementStep=true,cursorTool='pin',tool='pin';
  const pointer={active:true},camera={grid:false},renders=[],effects=[];
  const renderAll=()=>{const ctx={...base,selected,stepIndex};renders.push({image:captureOpen?imageSuiteHTML(base.scene,selected[0],stepIndex):null,live:sequenceOpen?liveWorkspaceHTML(ctx,{entries:[]}).sequence:null});};
  const $=id=>({querySelector:selector=>{if(id!=='live-content'||selector!=='.live-layers')throw Error('Unexpected presentation target');if(!renders.at(-1)?.live?.includes('class="live-layers"'))return null;return {set open(value){effects.push(['open',value])},scrollIntoView(value){effects.push(['scroll',value])}}}});
  const open=${callback};
  return {open,renders,effects,read:()=>({selected,stepIndex,editing,libraryOpen,presenting,contextKind,beltPickerOpen,timelineOpen,shapePickerOpen,modesOpen,inspectorOpen,studioOpen,captureOpen,sequenceOpen,placementStep,cursorTool,tool,pointer:{...pointer},camera:{...camera}})};
 `,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)(base,imageSuiteHTML,liveWorkspaceHTML);
 const source=instantiate();source.open('source',entity.id,imageIndex);source.open('source',entity.id,imageIndex);
 const state=source.read();assert.deepEqual(state.selected,[entity.id]);assert.equal(state.stepIndex,imageIndex);assert.equal(state.captureOpen,true);assert.equal(state.sequenceOpen,false);assert.equal(state.editing,true);assert.equal(state.pointer.active,false);
 for(const flag of ['libraryOpen','presenting','beltPickerOpen','timelineOpen','shapePickerOpen','modesOpen','inspectorOpen','studioOpen'])assert.equal(state[flag],false,flag);
 assert.equal(state.contextKind,'');assert.equal(state.placementStep,false,'Source retires previous stage placement');assert.equal(state.tool,'select');assert.equal(source.renders.length,2);assert.ok(source.renders.every(row=>row.image.includes(`data-source-step="${imageIndex}"`)));assert.deepEqual(source.effects,[]);
 const layeredIndex=entity.sequence.steps.findIndex(k=>(k.layers??entity.layers??[]).length>0);assert.ok(layeredIndex>=0);
 const layers=instantiate();layers.open('layers',entity.id,layeredIndex);assert.equal(layers.read().captureOpen,false);assert.equal(layers.read().sequenceOpen,true);assert.equal(layers.read().inspectorOpen,false);assert.equal(layers.read().placementStep,false);assert.equal(execute(secondary,Object.fromEntries(Object.entries(layers.read()).filter(([key])=>key!=='selected'))),false,'actual renderLive secondary predicate must admit Layers after a prior Pin tool');assert.deepEqual(layers.effects,[['open',true],['scroll',{block:'nearest'}]]);
 const unlayered=r.scene.entities.flatMap(e=>e.sequence.steps.map((k,i)=>({e,k,i}))).find(({e,k})=>!(k.layers??e.layers??[]).length);
 assert.ok(unlayered,'archived real source must disclose an unlayered state for missing-details coverage');
 {const empty=instantiate();assert.doesNotThrow(()=>empty.open('layers',unlayered.e.id,unlayered.i));assert.equal(empty.read().sequenceOpen,true);assert.deepEqual(empty.effects,[],'missing actual layer details is a graceful no-op');}
 const placement=instantiate();placement.open('placement',entity.id,imageIndex);assert.equal(placement.read().placementStep,true);assert.equal(placement.read().camera.grid,true);assert.equal(placement.read().cursorTool,'select');assert.equal(placement.read().tool,'select');assert.equal(placement.read().captureOpen,false);assert.equal(placement.read().sequenceOpen,false);assert.equal(placement.read().inspectorOpen,false);
 assert.equal(JSON.stringify(r.store.document),before);assert.equal(r.store.undoStack.length,0);
});


async function nativeEditorResidence(){
 const app=await parse('packages/live-shell/ui/src/App.tsx'),retention=await parse('packages/live-shell/ui/src/components/NativeInputRetention.tsx');
 const engine=await import(new URL('desktop/cradle/src/surface/engine.ts',root)),{freshLayout}=await import(new URL('desktop/cradle/src/surface/types.ts',root));
 const nativeInputBinding=execute(find(retention,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='nativeInputBinding').getText(retention).replace(/^export /,''),{groupsOf:engine.groupsOf});
 const r=retained(),book={layout:engine.openBinding(freshLayout(),{id:'world.expressions',kind:'expressions',title:'Expressions'}),modeLayouts:{}},continuity={current:book},currentContinuity={current:continuity};
 const state={workspaceId:'native-residence-source',accessEpoch:7,editor:r.owner,mode:'techne',centerPanel:'native.arrangement',settingsPresented:false,epoch:0},presentation={current:state};
 const effects=[],queued=[],currentEditorReading={current:r.owner.read()};let returned=null;
 class FocusObserver{isConnected=true;getClientRects(){return [{}]}focus(value){effects.push(['focus',value])}}
 const focus=new FocusObserver(),workspace={...state,nativeAccessCurrent:epoch=>epoch===7,setMode:mode=>{workspace.mode=mode;state.mode=mode;effects.push(['workspace-mode',mode])}};
 const callbacks=()=>{
  const shared={workspace,presentation,continuity,currentContinuity,currentEditorReading,nativeInputBinding,sameEditorBasis,detail:true,detailMode:'clip',centerPanel:state.centerPanel,settingsPresented:state.settingsPresented,document:{activeElement:focus},HTMLElement:FocusObserver,
   setNativeEditorReturn:value=>{returned=typeof value==='function'?value(returned):value;effects.push(['return-record',returned])},setDetail:value=>effects.push(['detail',value]),setCenterPanel:value=>{state.centerPanel=value;effects.push(['center',value])},changeDetailMode:value=>effects.push(['detail-mode',value]),requestAnimationFrame:callback=>queued.push(callback),nativeEditorReturn:returned};
  const present=execute(find(app,n=>ts.isVariableDeclaration(n)&&n.name.getText(app)==='presentNativeEditor').initializer.getText(app),shared);
  const leave=execute(find(app,n=>ts.isVariableDeclaration(n)&&n.name.getText(app)==='returnNativeEditor').initializer.getText(app),shared);
  return {present,leave};
 };
 return {r,state,workspace,book,engine,presentation,currentEditorReading,effects,queued,focus,callbacks,record:()=>returned};
}

test('actual large native editor captures original retained controller, native mode and view without recording authored material',async()=>{
 const p=await nativeEditorResidence(),before=JSON.stringify(p.r.store.document);
 p.callbacks().present('source',p.currentEditorReading.current.basis);
 assert.equal(p.record().centerPanel,'native.arrangement');assert.equal(p.record().detail,true);assert.equal(p.record().detailMode,'clip');
 assert.equal(p.record().mode,'techne');assert.equal(p.record().owner,p.r.owner);
 assert.equal(p.state.centerPanel,'world.expressions');assert.ok(p.effects.some(row=>row[0]==='detail'&&row[1]===false));
 assert.equal(JSON.stringify(p.r.store.document),before);assert.equal(p.r.store.undoStack.length,0);
});

test('actual large editor Return permits newer real same-Scene authoring but refuses replacement editor and departed view',async()=>{
 const edited=await nativeEditorResidence();edited.callbacks().present('layers',edited.currentEditorReading.current.basis);
 const entity=edited.r.scene.entities[0],step=entity.sequence.steps[0];edited.r.store.change(()=>{edited.r.store.document=applyNativeGlyphChanges(edited.r.store.document,edited.r.scene.id,[{kind:'step-timing',entity_id:entity.id,step_id:step.id,hold:step.hold+.1}])});edited.currentEditorReading.current=edited.r.owner.read();edited.effects.length=0;
 edited.callbacks().leave();assert.equal(edited.state.centerPanel,'native.arrangement');assert.ok(edited.effects.some(row=>row[0]==='detail'&&row[1]===true));assert.equal(edited.r.store.undoStack.length,1);edited.queued.shift()();assert.ok(edited.effects.some(row=>row[0]==='focus'));
 for(const depart of [p=>{p.workspace.editor=retained().owner;p.state.editor=p.workspace.editor},p=>{p.state.centerPanel='native.workbench'},p=>{p.state.settingsPresented=true},p=>{p.workspace.mode='audio';p.state.mode='audio'},p=>{p.workspace.accessEpoch++;p.state.accessEpoch++},p=>{p.workspace.workspaceId='departed';p.state.workspaceId='departed'},p=>{p.book.layout=p.engine.closeSurface(p.book.layout,'world.expressions')},p=>{p.currentEditorReading.current={...p.r.reading,basis:{...p.r.reading.basis,expression_ref:'expression:departed'}}},p=>{p.currentEditorReading.current={...p.r.reading,basis:{...p.r.reading.basis,scene_ref:'scene:departed'}}}]){
  const p=await nativeEditorResidence();p.callbacks().present('source',p.currentEditorReading.current.basis);depart(p);p.effects.length=0;p.callbacks().leave();
  assert.equal(p.effects.some(row=>row[0]==='center'||row[0]==='detail'||row[0]==='detail-mode'||row[0]==='workspace-mode'),false,'departed owner or deliberate view cannot be overwritten by old Return');assert.equal(p.queued.length,0);
 }
});

test('actual queued large native editor Return cannot focus behind newly opened Settings',async()=>{
 const p=await nativeEditorResidence();p.callbacks().present('placement',p.currentEditorReading.current.basis);p.effects.length=0;p.callbacks().leave();assert.equal(p.queued.length,1);
 p.state.settingsPresented=true;p.queued.shift()();assert.equal(p.effects.some(row=>row[0]==='focus'),false);
});


test('actual checkpoint view keeps origin only during active large residence and preserves nullable pre-Deep height',async()=>{
 const app=await parse('packages/live-shell/ui/src/App.tsx');
 const effect=find(app,n=>ts.isCallExpression(n)&&n.expression.getText(app)==='useEffect'&&n.arguments[0]?.getText(app).includes('continuity.checkpointApplicationView')).arguments[0].getText(app);
 for(const active of [true,false])for(const height of [null,319.997]){
  const writes=[],bindings={frameWorkspace:'retained-native-workspace',workspace:{workspaceId:'retained-native-workspace',mode:'techne'},continuity:{checkpointApplicationView:value=>writes.push(value)},state:{path:null},restored:null,tab:'arrangement',selection:{track:0,scene:null},browser:true,detail:false,dock:true,browserWidth:null,detailHeight:421,detailExpansionReturn:{current:{height,workspaceId:'retained-native-workspace',accessEpoch:7}},centerPanel:active?'world.expressions':'native.workbench',detailMode:'device',nativeEditorPresented:active,nativeEditorReturn:{centerPanel:'native.arrangement',detail:true,detailMode:'clip'},settingsPresented:false};
  execute(effect,bindings)();assert.equal(writes.length,1);assert.equal(writes[0].detailHeight,height);assert.equal(writes[0].centerPanel,active?'native.arrangement':'native.workbench');assert.equal(writes[0].detail,active);assert.equal(writes[0].detailMode,active?'clip':'device');
 }
});

test('actual NativeWorldDetail fullscreen open permits only intended restored mode and reaches real refused native owner',async()=>{
 const [{ExpressionsHost},{createNativeEditorClient},{installNativeEditorReceiver},{MessageChannel}]=await Promise.all([
  import('../../../expressions-boundary/src/host.ts'),import('../../../expressions-boundary/src/editorHost.ts'),import(new URL('hostEditor.ts',author)),import('node:worker_threads')]);
 const detail=await parse('packages/live-shell/ui/src/components/NativeWorldDetail.tsx');
 const requestBody=find(detail,n=>ts.isVariableDeclaration(n)&&n.name.getText(detail)==='request').initializer.arguments[0].getText(detail);
 const r=retained(),origin='http://127.0.0.1:8788',messages=new EventTarget(),target=new EventTarget(),frame=new EventTarget(),{port1,port2}=new MessageChannel(),sent=[];
 const message=(data,source)=>Object.assign(new Event('message'),{data,source,origin});
 const parent={postMessage(data,targetOrigin){assert.equal(targetOrigin,origin);port2.postMessage(data)}};
 target.parent=parent;target.location={origin};frame.src=origin+'/__application/expressions/index.html';frame.closest=()=>null;
 frame.contentWindow={postMessage(data,targetOrigin){assert.equal(targetOrigin,origin);sent.push(data);port1.postMessage(data)}};
 const host=new ExpressionsHost(frame,{bindingId:'native-large-editor-source',owners:{channels:{}},messageTarget:new EventTarget(),isPresented:()=>true});
 port2.on('message',data=>target.dispatchEvent(message(data,parent)));port1.on('message',data=>messages.dispatchEvent(message(data,frame.contentWindow)));
 const receiver=installNativeEditorReceiver(r.owner,target),client=createNativeEditorClient(host,messages),publishedReading={current:null},stop=client.subscribe(next=>{publishedReading.current=next});
 try{
  await host.handleMessage({source:frame.contentWindow,origin,data:{v:1,kind:'oi-app-state',state:{hostMode:'expressions',sceneCount:r.view.document.scenes.length,document:{id:r.view.document.expression_ref,name:r.view.document.title},nativeScene:{expression_ref:r.reading.basis.expression_ref,revision:r.reading.basis.revision,scene_ref:r.reading.basis.scene_ref}}}});
  const first=await client.request({operation:'read'});assert.equal(first.ok,true);assert.deepEqual(publishedReading.current,r.owner.read());
  const entity=r.scene.entities[0],operation={operation:'open',basis:first.reading.basis,entity_id:entity.id,step_id:entity.sequence.steps[1].id,editor:'source'};
  const receive=depart=>{
   const lifetime={current:1},requestResidence={current:{mode:'clip',workspaceId:'retained-native-workspace',accessEpoch:7,editor:client,expression:first.reading.basis.expression_ref}},residence={current:{getClientRects:()=>[{}]}},effects=[];
   const workspace={editor:client,nativeAccessCurrent:epoch=>epoch===7};
   const document={fullscreenElement:residence.current,exitFullscreen:async()=>{requestResidence.current.mode='device';depart?.({lifetime,requestResidence,residence,workspace})}};
   return {request:execute(requestBody,{lifetime,requestResidence,deepReturn:{current:{mode:'device'}},workspace,document,residence,publishedReading,sameEditorBasis,setFault:value=>effects.push(['fault',value]),presentNativeEditor:(...value)=>effects.push(['large',value])}),effects};
  };
  const current=receive(),before=JSON.stringify(r.store.document),sentBefore=sent.length,result=await current.request(operation);
  assert.equal(result.ok,false);assert.match(result.error,/does not dispatch native effects/);assert.ok(sent.length>sentBefore,'actual client/receiver reached refused real native selection port after intentional Device restoration');assert.equal(current.effects.some(row=>row[0]==='large'),false);assert.equal(JSON.stringify(r.store.document),before);
  for(const depart of [p=>{p.requestResidence.current.mode='device-other'},p=>{p.requestResidence.current.editor=retained().owner},p=>{p.requestResidence.current.workspaceId='departed'},p=>{p.requestResidence.current.expression='expression:departed'},p=>{p.lifetime.current++},p=>{p.residence.current.getClientRects=()=>[]},p=>{p.workspace.nativeAccessCurrent=()=>false}]){
   const p=receive(depart),count=sent.length,refusal=await p.request(operation);assert.equal(refusal.ok,false);assert.match(refusal.error,/residence changed before dispatch/);assert.equal(sent.length,count);assert.deepEqual(p.effects,[]);
  }
 }finally{stop();receiver.dispose();client.dispose();host.dispose();port1.close();port2.close()}
});


test('actual mounted hosted freshness key is unique per mount and real host hide/reveal/mode changes retain one frame URL',async()=>{
 const panel=await parse('packages/live-shell/ui/src/panels/expressions.tsx'),{mountExpressionsApplication}=await import('../../../expressions-boundary/src/host.ts');
 const freshness=find(panel,n=>ts.isVariableDeclaration(n)&&n.name.getText(panel)==='hostLoad').parent.parent.getText(panel);
 const call=find(panel,n=>ts.isCallExpression(n)&&n.expression.getText(panel)==='mountExpressionsApplication');
 const mainEffect=find(panel,n=>ts.isCallExpression(n)&&n.expression.getText(panel)==='useEffect'&&n.arguments[0]?.getText(panel).includes('let mounted:'));
 assert.deepEqual(mainEffect.arguments[1].elements.map(n=>n.getText(panel)),['qualified','attempt']);
 for(const name of ['visible','rebind']){
  const callback=find(panel,n=>ts.isVariableDeclaration(n)&&n.name.getText(panel)===name).initializer;
  assert.equal(callback.getText(panel).includes('hostLoad'),false);assert.equal(callback.getText(panel).includes('mountExpressionsApplication'),false);
 }
 const r=retained(),before=JSON.stringify(r.store.document),frames=[],commands=[];
 const messageTarget=new EventTarget(),previousWindow=globalThis.window;globalThis.window=messageTarget;
 const ownerDocument={baseURI:'http://127.0.0.1:8788/',createElement:name=>{
  assert.equal(name,'iframe');const frame=new EventTarget();let src='';frame.srcWrites=0;
  Object.defineProperty(frame,'src',{get:()=>src,set:value=>{src=value;frame.srcWrites++}});
  frame.dataset={};frame.style={};frame.attributes={};frame.setAttribute=(key,value)=>{frame.attributes[key]=value};frame.remove=()=>{frame.removed=true};frame.contentWindow={postMessage:(value,origin)=>{commands.push({value,origin})}};frames.push(frame);return frame;
 }};
 const container={ownerDocument,append:frame=>{frame.attached=true}};
 const invocation=new Function('mountExpressionsApplication','target','config','modeRef','worldLens','initialRef','continued','initial','owners','presented','workspaceRef','bookRef','selectionOwner','refreshEditor','setStatus','setHostFault','workspace','expressionBinding','live',ts.transpileModule(`${freshness}
return ${call.getText(panel)};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
 const mounts=[];let visible=true;
 try{
  for(let lease=0;lease<2;lease++){
   const mounted=invocation(mountExpressionsApplication,container,{expressions_entry:'/__application/expressions/index.html'},{current:'expressions'},{current:'generic'},r.reading.basis.expression_ref,undefined,undefined,{channels:{}},()=>visible,{current:{publishReading:blocked,publishEditorReading:blocked}}, {current:{current:{id:'retained-native-workspace'}}},{current:{workspaceId:'retained-native-workspace',expected:r.reading.basis.expression_ref}},()=>{},()=>{},()=>{},{setMode:blocked},()=>undefined,true);
   mounts.push(mounted);const url=new URL(mounted.frame.src),original=mounted.frame.src;
   assert.equal(url.searchParams.get('expression'),r.reading.basis.expression_ref);assert.match(url.searchParams.get('host-load'),/^[0-9a-f-]{36}$/);assert.equal(url.searchParams.get('mode'),'expressions');
   visible=false;mounted.host.setPresented();visible=true;mounted.host.setPresented();mounted.host.setMode('techne','generic');mounted.host.setMode('expressions','generic');
   assert.equal(mounted.frame.src,original);assert.equal(mounted.frame.srcWrites,1);assert.equal(mounted.host.frame,mounted.frame);assert.equal(mounted.frame.removed,undefined);
  }
  assert.notEqual(new URL(mounts[0].frame.src).searchParams.get('host-load'),new URL(mounts[1].frame.src).searchParams.get('host-load'));
  assert.equal(frames.length,2);assert.equal(JSON.stringify(r.store.document),before);assert.equal(r.store.undoStack.length,0);
 }finally{for(const mounted of mounts)mounted.dispose();if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow}
 assert.ok(frames.every(frame=>frame.removed));
});
