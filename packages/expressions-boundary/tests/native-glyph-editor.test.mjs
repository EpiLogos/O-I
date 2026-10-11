import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';

// Evaluate the actual production authoring sources without emitting a build.
// Their legacy .js specifiers and implicit type imports require TypeScript's
// existing transpiler rather than Node's syntax-only type stripping.
const root = new URL('../../../', import.meta.url);
const typescript = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href;
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(typescript)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier, context, next) {
  try {return await next(specifier, context)} catch (error) {
    if (specifier.startsWith('.') && specifier.endsWith('.js')) return next(specifier.slice(0,-3)+'.ts',context);
    if (specifier.startsWith('.') && !/\\.[cm]?[jt]s$/.test(specifier)) return next(specifier+'.ts',context);
    throw error;
  }
}
export async function load(url,context,next) {
  if (!url.endsWith('.ts') && !url.endsWith('.tsx')) return next(url,context);
  const source=await readFile(new URL(url),'utf8');
  return {format:'module',shortCircuit:true,source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}
`)}`, import.meta.url);
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root);
const {readNativeGlyphTiming} = await import(new URL('packages/live-shell/ui/src/shell/nativeContent.ts', root));
const [{applyNativeGlyphChanges}, {blankJourney,entity,clone,validateJourney}, {DocumentStore}, {toNativeEntity,fromNativeEntity},
  {resolveSequence,orderedIndex}, {kernelDocumentToJourney}, {prepareCompositionEdit}, {sameEditorBasis}, {syncHeldState}, {effectiveScene,initialiseShared,toggleShared}] = await Promise.all([
  import(new URL('hostEditor.ts',author)),import(new URL('model.ts',author)),import(new URL('store.ts',author)),
  import(new URL('nativeBridge.ts',author)),import(new URL('desktop/cradle/expressions-app/src/engine/fieldModel.ts',root)),
  import(new URL('kernelDocumentBridge.ts',author)),import(new URL('kernelComposition.ts',author)),import('../src/editor.ts'),
  import(new URL('workspacePreferences.ts',author)),
  import(new URL('sharedSettings.ts',author)),
]);

function rich() {
  const doc=blankJourney(),scene=doc.scenes[0],body=entity('Layered body','A');
  scene.engine.autoFitSizes=false;
  body.sequence={enabled:true,clock:'seconds',sourcesVersion:1,manual:false,hold:1,transition:1,order:'loop',easing:'linear',jitter:0,impulse:.4,rateMul:1,phaseOffset:0,steps:[
    {id:'step:a',text:'A',shape:'text',hold:1,transition:1,holdOverride:true,transitionOverride:true,position:{x:.25,y:-.5,z:1},source:{kind:'ascii',ascii:{text:' A\nAAA',fontSize:32,invert:false}},layers:[{id:'layer:a',text:'inner',z:.2,scale:.75,source:{kind:'ascii',ascii:{text:'x+x'}}}],objectState:{size:{x:2,y:3},rotation:15,scale:1.2,tint:'#123456',tintWeight:.7,force:{kind:'vortex',strength:2,radius:3,spin:.4},normalized:true},native:{id:'step:a',shape:{kind:'glyph',text:'A'},futureNativeProperty:{kept:['one','two']}}},
    {id:'step:b',text:'B',shape:'disc',hold:3,transition:2,holdOverride:true,transitionOverride:true,position:null,source:{kind:'image',image:{mode:'silhouette',threshold:.4,scale:1,invert:false,name:'retained-source',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8////fwYGBgYmEAHCAD34BABm6tHAAAAAAElFTkSuQmCC'}},layers:[{id:'layer:b',text:'second',z:-.3,scale:1}],futureState:{sourceRevision:'exact:r3'}},
    {id:'step:c',text:'word',shape:'text',hold:2,transition:1,holdOverride:true,transitionOverride:true,position:null},
  ]};
  body.native={id:body.id,kind:'formation',futureOwnerProperty:{source:'retain'}};
  scene.entities=[body];scene.futureSceneProperty={sourceRef:'central:exact',revision:'r9'};
  doc.futureDocumentProperty={unrecognised:['preserve','verbatim']};
  validateJourney(doc);return {doc,scene,body};
}
const change=(body,fields)=>({entity_id:body.id,...fields});
const apply=(doc,fields)=>applyNativeGlyphChanges(doc,doc.scenes[0].id,fields);

test('rich timing and position edits retain all sources, layers, native metadata and untouched states',()=>{
  const {doc,body}=rich(),before=clone(doc);
  const next=apply(doc,[change(body,{kind:'step-timing',step_id:'step:b',hold:4.25}),change(body,{kind:'step-position',step_id:'step:a',position:{x:1,y:2,z:3}})]);
  assert.deepEqual(doc,before);
  assert.equal(next.scenes[0].entities[0].sequence.steps[1].hold,4.25);
  assert.deepEqual(next.scenes[0].entities[0].sequence.steps[1].source,body.sequence.steps[1].source);
  assert.deepEqual(next.scenes[0].entities[0].sequence.steps[0].layers,body.sequence.steps[0].layers);
  assert.deepEqual(next.scenes[0].entities[0].native,body.native);
  assert.deepEqual(next.futureDocumentProperty,doc.futureDocumentProperty);
  assert.deepEqual(next.scenes[0].futureSceneProperty,doc.scenes[0].futureSceneProperty);
  assert.deepEqual(next.scenes[0].entities[0].sequence.steps[2],body.sequence.steps[2]);
});

test('one multi-change DocumentStore transaction has one undo entry and exact rich content redo',()=>{
  const {doc,body}=rich(),store=new DocumentStore(doc),before=clone(store.document);
  store.replace(apply(store.document,[change(body,{kind:'step-timing',step_id:'step:a',hold:5}),change(body,{kind:'step-order',step_ids:['step:c','step:a','step:b']})]));
  const edited=clone(store.document);assert.equal(store.undoStack.length,1);assert.equal(store.transactionOpen,false);
  assert.equal(store.undo(),true);assert.deepEqual(store.document,before);
  assert.equal(store.redo(),true);assert.deepEqual(store.document,edited);
});

test('a failing composite never mutates the real store or any source occurrence',()=>{
  const {doc,body}=rich(),store=new DocumentStore(doc),before=clone(store.document);
  assert.throws(()=>store.replace(apply(store.document,[change(body,{kind:'step-timing',step_id:'step:a',hold:5}),change(body,{kind:'step-position',step_id:'absent',position:null})])),/state no longer exists/);
  assert.deepEqual(store.document,before);assert.equal(store.undoStack.length,0);
  assert.throws(()=>apply(doc,[{entity_id:'other:entity',kind:'step-remove',step_ids:['step:a']}]),/target is not a formation/);
  assert.throws(()=>applyNativeGlyphChanges(doc,'other:scene',[]),/scene no longer exists/);
});

test('duplicate gives new step/layer identities while retaining source and appearance',()=>{
  const {doc,body}=rich(),next=apply(doc,[change(body,{kind:'step-duplicate',step_id:'step:a'})]),steps=next.scenes[0].entities[0].sequence.steps;
  const copy=steps[1];assert.notEqual(copy.id,steps[0].id);assert.notEqual(copy.layers[0].id,steps[0].layers[0].id);
  assert.equal(copy.native,undefined);assert.deepEqual(copy.source,steps[0].source);assert.deepEqual(copy.objectState,steps[0].objectState);
  assert.deepEqual(copy.layers[0].source,steps[0].layers[0].source);assert.equal(new Set(steps.map(s=>s.id)).size,4);
});

test('reordering and range removal preserve stable surviving IDs and refuse lossy order',()=>{
  const {doc,body}=rich();const reordered=apply(doc,[change(body,{kind:'step-order',step_ids:['step:c','step:b','step:a']})]);
  assert.deepEqual(reordered.scenes[0].entities[0].sequence.steps.map(s=>s.id),['step:c','step:b','step:a']);
  const removed=apply(reordered,[change(body,{kind:'step-remove',step_ids:['step:a','step:b']})]);assert.equal(removed.scenes[0].entities[0].sequence.steps[0].id,'step:c');
  assert.throws(()=>apply(doc,[change(body,{kind:'step-order',step_ids:['step:a','step:a','step:c']})]),/every stable state once/);
  assert.throws(()=>apply(doc,[change(body,{kind:'step-remove',step_ids:['step:a','step:b','step:c']})]),/at least one state/);
});

test('state source replacement and layer editing retain all unrelated native source records',()=>{
  const {doc,body}=rich(),source={kind:'ascii',ascii:{text:' /\\\n/--\\',fontSize:48,invert:true}};
  const next=apply(doc,[change(body,{kind:'step-source',step_id:'step:c',shape:'text',source}),change(body,{kind:'step-layers',step_id:'step:b',layers:[{...body.sequence.steps[1].layers[0],text:'edited layer'}]})]);
  const steps=next.scenes[0].entities[0].sequence.steps;
  assert.deepEqual(steps[2].source,source);assert.deepEqual(steps[0],body.sequence.steps[0]);
  assert.deepEqual(steps[1].source,body.sequence.steps[1].source);assert.equal(steps[1].layers[0].id,'layer:b');
  assert.equal(steps[1].futureState.sourceRevision,'exact:r3');
  assert.throws(()=>apply(doc,[change(body,{kind:'step-layers',step_id:'step:b',layers:[{id:'layer:a',text:'collision',z:0}]})]),/state layer/);
});

test('rich native evaluator reads unequal authored hold and outgoing transition plus order semantics',()=>{
  const {body}=rich(),native=toNativeEntity(body);
  assert.equal(native.sequence.links[0].hold,1);assert.equal(native.sequence.links[1].hold,3);
  assert.deepEqual(resolveSequence(native,.5,0,0,0).linkIndex,0);
  const outgoing=resolveSequence(native,1.5,0,0,0);assert.equal(outgoing.linkIndex,0);assert.equal(outgoing.nextIndex,1);assert.equal(outgoing.progress,.5);
  assert.equal(resolveSequence(native,3,0,0,0).linkIndex,1);
  assert.deepEqual(Array.from({length:6},(_,i)=>orderedIndex(i,3,'pingpong')),[0,1,2,1,0,1]);
  const random=Array.from({length:100},(_,i)=>orderedIndex(i,3,'random',17));assert.ok(random.every((n,i)=>!i||n!==random[i-1]));
  assert.deepEqual(random,Array.from({length:100},(_,i)=>orderedIndex(i,3,'random',17)));
});

test('clip timing reads real inherited native values and preserves every held state',()=>{
  const {body}=rich();body.sequence.enabled=false;body.sequence.manual=false;
  body.sequence.hold=2;body.sequence.transition=.75;
  body.sequence.steps[1].holdOverride=false;body.sequence.steps[1].transitionOverride=false;
  body.sequence.steps[1].hold=999;body.sequence.steps[1].transition=999;
  const before=clone(body),timing=readNativeGlyphTiming(body,.3);
  assert.equal(timing.states.length,3);assert.equal(body.sequence.enabled,false);assert.deepEqual(body,before);
  assert.deepEqual(timing.states[1],{step_id:'step:b',start_seconds:2,hold_seconds:2,transition_seconds:.75,end_seconds:4.75,axis_start:2,axis_hold:2,axis_transition:.75,axis_end:4.75});
  assert.equal(timing.authored_duration_seconds,7.75);assert.equal(timing.playback_axis,'simulation-seconds');
  const native=toNativeEntity({...body,sequence:{...body.sequence,enabled:true}});
  assert.equal(resolveSequence(native,2.5,0,0,0).linkIndex,1);
  assert.equal(resolveSequence(native,2.5,0,0,0).phase,'hold');
  assert.ok(Math.abs(resolveSequence(native,4.5,0,0,0).progress-2/3)<1e-12);
  for(const step of body.sequence.steps){step.holdOverride=false;step.transitionOverride=false;}
  body.sequence.hold=0;body.sequence.transition=0;
  const zero=readNativeGlyphTiming(body,.3);assert.equal(zero.axis_duration,0);
  assert.ok(zero.states.every(state=>state.axis_hold===0&&state.axis_transition===0));
});

test('morph clip axis uses real Field cycles and dwell rather than stored state seconds',()=>{
  const {body}=rich();body.sequence.clock='morph';const before=clone(body),timing=readNativeGlyphTiming(body,1);
  assert.deepEqual(body,before);assert.equal(timing.playback_axis,'field-morph-cycles');
  assert.equal(timing.axis_duration,3);assert.equal(timing.authored_duration_seconds,10);
  assert.ok(timing.states.every(state=>state.axis_hold===.95&&Math.abs(state.axis_transition-.05)<1e-12));
  const native=toNativeEntity(body),state=resolveSequence(native,100,.96*Math.PI*2,0,1);
  assert.equal(state.linkIndex,0);assert.equal(state.phase,'transition');assert.ok(Math.abs(state.progress-.2)<1e-12);
});

test('manual mode feeds the real evaluator and held selection uses existing native base synchronisation',()=>{
  const {doc,body}=rich(),manual=apply(doc,[change(body,{kind:'sequence-settings',values:{enabled:false,manual:true}})]),s=manual.scenes[0],e=s.entities[0];
  assert.equal(s.engine.autoOscillate,false);assert.equal(s.engine.morphEnabled,true);
  const state=resolveSequence(toNativeEntity(e),100,20,.375,0);assert.equal(state.progress,.375);assert.equal(state.linkIndex,0);
  const held=apply(manual,[change(body,{kind:'sequence-settings',step_id:'step:b',values:{enabled:false,manual:false}})]).scenes[0].entities[0];
  assert.deepEqual(held.source,body.sequence.steps[1].source);assert.equal(held.shape,'disc');
  // Existing sync helper agrees with the newly selected held-state operation.
  const heldBefore=clone(held);syncHeldState(held,1);assert.deepEqual(held,heldBefore);
  const heldNative=toNativeEntity(held);assert.equal(heldNative.sequence.links.length,1);assert.equal(heldNative.authoringSource.kind,'image');
});

test('manual takeover updates the inherited shared Field controls consumed by the real engine',async()=>{
  const {doc,body}=rich(),scene=doc.scenes[0];initialiseShared(doc);
  scene.engine.autoOscillate=true;scene.engine.morphEnabled=false;
  toggleShared(doc,scene,'engine.autoOscillate');toggleShared(doc,scene,'engine.morphEnabled');
  const other=clone(scene);other.id='scene:shared-manual-peer';doc.scenes.push(other);
  const before=clone(doc),manual=apply(doc,[change(body,{kind:'sequence-settings',values:{enabled:false,manual:true}})]);
  const {toNativeConfig}=await import(new URL('nativeBridge.ts',author));
  assert.deepEqual(doc,before);
  assert.equal(manual.shared.values['engine.autoOscillate'],false);
  assert.equal(manual.shared.values['engine.morphEnabled'],true);
  for(const s of manual.scenes){
    const native=toNativeConfig(effectiveScene(manual,s));
    assert.equal(native.toroidalMorph.autoOscillate,false);assert.equal(native.toroidalMorph.enabled,true);
  }
  const native=toNativeConfig(effectiveScene(manual,manual.scenes[0]));
  const state=resolveSequence(native.entities[0],100,20,.375,0);
  assert.equal(state.progress,.375);assert.equal(state.linkIndex,0);
  assert.equal(manual.scenes[1].entities[0].sequence.manual,false,'the shared Field takeover does not make another formation manual');
});

test('native roundtrip carries independent layer sources, stable steps, offsets and exact rich object states',()=>{
  const {body}=rich(),native=toNativeEntity(body),returned=fromNativeEntity(native);
  for(let i=0;i<body.sequence.steps.length;i++) {
    const wanted=body.sequence.steps[i],got=returned.sequence.steps[i];
    assert.equal(got.id,wanted.id);assert.deepEqual(got.source,wanted.source);
    // JSON carrier semantics omit optional source:undefined, never real source payloads.
    assert.deepEqual(got.layers===undefined?undefined:JSON.parse(JSON.stringify(got.layers)),wanted.layers===undefined?undefined:JSON.parse(JSON.stringify(wanted.layers)));
    for(let l=0;l<(wanted.layers?.length??0);l++)if(wanted.layers[l].source)assert.deepEqual(got.layers[l].source,wanted.layers[l].source);
    assert.deepEqual(got.position,wanted.position);assert.equal(got.hold,wanted.hold);assert.equal(got.transition,wanted.transition);
  }
  const expected=body.sequence.steps[0].objectState,actual=returned.sequence.steps[0].objectState;
  assert.ok(Math.abs(actual.rotation-expected.rotation)<1e-12);
  assert.deepEqual({...actual,rotation:expected.rotation},expected);
});

test('native composition save builder preserves source-owner fields and rich material across reopened conversion',()=>{
  const {doc}=rich(),E='expression:glyph-independent-verifier',S=E+':scene:main',R=E+':entity:body';
  const scene=clone(doc.scenes[0]);scene.id=S;scene.entities[0].id=R;
  const native={schema:'oi.expression/v1',expression_ref:E,revision:7,title:'Rich glyph',entities:{[R]:{entity_ref:R,title:'Body',subject:{subject_ref:'central:source',native_owner:'central',revision:'source:r2'},parameters:{glyph:{value:'A'}}}},scenes:[{scene_ref:S,title:scene.name,entity_refs:[R],presentation:{schema:'oi.journey-scene/v1',scene,saved:null}}],selection:{scene_ref:S,entity_ref:R},futureOwnerFields:{opaque:'verbatim'}};
  const view=kernelDocumentToJourney(native),body=view.journey.scenes[0].entities[0];
  const edited=applyNativeGlyphChanges(view.journey,view.journey.scenes[0].id,[change(body,{kind:'step-timing',step_id:'step:b',transition:4.75})]);
  const request=prepareCompositionEdit(view,edited);
  assert.equal(request.expected_revision,7);assert.equal(request.expression_ref,E);
  const material=request.changes.find(c=>c.change==='scene_material_set');assert.ok(material);assert.equal(material.scene_ref,S);
  assert.equal(material.presentation.scene.entities[0].sequence.steps[1].transition,4.75);
  assert.deepEqual(native.entities[R].subject,{subject_ref:'central:source',native_owner:'central',revision:'source:r2'});
  const converted=kernelDocumentToJourney({...native,scenes:[{...native.scenes[0],presentation:material.presentation}]});
  assert.deepEqual(converted.journey.scenes[0].entities[0].sequence.steps,edited.scenes[0].entities[0].sequence.steps);
  assert.deepEqual(converted.document.futureOwnerFields,native.futureOwnerFields);
  assert.deepEqual(prepareCompositionEdit(converted,converted.journey).changes,[]);
  // This is an actual builder/adapter test, not a kernel save acknowledgement.
});

test('captured editor basis includes authoring revision, exact Scene and Expression',()=>{
  const b={expression_ref:'expression:one',scene_ref:'scene:one',revision:3,authored_revision:8};
  assert.equal(sameEditorBasis(b,{...b}),true);
  for(const [key,value] of [['expression_ref','expression:two'],['scene_ref','scene:two'],['revision',4],['authored_revision',9]])assert.equal(sameEditorBasis(b,{...b,[key]:value}),false);
});

test('unknown runtime operations are refused before adoption',()=>{
  const {doc,body}=rich();assert.throws(()=>apply(doc,[change(body,{kind:'unknown-operation'})]),/unsupported|unknown/i);
});

test('ambiguous stable step IDs are refused before adoption',()=>{
  const {doc,body}=rich(),duplicate=clone(doc);duplicate.scenes[0].entities[0].sequence.steps[1].id='step:a';
  assert.throws(()=>apply(duplicate,[change(body,{kind:'step-timing',step_id:'step:a',hold:6})]),/duplicate|ambiguous|unique/i);
});

const {FONT_OPTIONS} = await import(new URL('fontCatalog.ts',author));
const {refitFormationForFont} = await import(new URL('stateSizing.ts',author));
const {toNativeConfig} = await import(new URL('nativeBridge.ts',author));
const {resolveEntityPose} = await import(new URL('desktop/cradle/expressions-app/src/engine/entityPose.ts',root));
const {WORLD_SCALE} = await import(new URL('nativeParameters.ts',author));

test('Field font change reuses native refit geometry and compiler while preserving locked and sampled states',()=>{
  const {doc,scene,body}=rich();scene.engine.autoFitSizes=true;
  const locked=clone(body);locked.id='entity:locked-font';locked.locked=true;
  locked.sequence.steps.forEach((step,i)=>{step.id=`step:locked-font:${i}`;if(step.layers)step.layers.forEach(layer=>layer.id+=':locked')});
  scene.entities.push(locked);
  const before=clone(doc),font={fontFamily:FONT_OPTIONS.find(option=>option.id==='classic-serif').stack,fontWeight:600};
  const expected=clone(body);refitFormationForFont(expected,{fontFamily:scene.engine.fontFamily,fontWeight:scene.engine.fontWeight},font);
  const store=new DocumentStore(doc);
  store.replace(apply(store.document,[{kind:'field-font',values:font}]));
  const next=store.document,actual=next.scenes[0].entities[0];
  assert.deepEqual(doc,before);assert.deepEqual(actual,expected);
  assert.ok(actual.sequence.steps[2].objectState.normalized,'the real refit captures and normalizes the unsampled text state');
  assert.deepEqual(actual.sequence.steps[0],body.sequence.steps[0],'ASCII state retains independent geometry, layers and source');
  assert.deepEqual(actual.sequence.steps[1],body.sequence.steps[1],'image state retains independent geometry, layers and source');
  assert.deepEqual(next.scenes[0].entities[1],locked);
  assert.equal(toNativeConfig(next.scenes[0]).fontFamily,font.fontFamily);
  assert.equal(toNativeConfig(next.scenes[0]).fontWeight,600);
  assert.equal(store.undoStack.length,1);const edited=clone(next);
  assert.equal(store.undo(),true);assert.deepEqual(store.document,before);
  assert.equal(store.redo(),true);assert.deepEqual(store.document,edited);
});

test('shared Field font edits refit each inheriting unlocked Scene and preserve auto-fit-off authored boxes',()=>{
  const {doc,scene}=rich();scene.engine.autoFitSizes=true;initialiseShared(doc);
  toggleShared(doc,scene,'engine.fontFamily');toggleShared(doc,scene,'engine.fontWeight');
  const peer=clone(scene);peer.id='scene:font-peer';peer.entities[0].id='entity:font-peer';doc.scenes.push(peer);
  const retained=clone(scene);retained.id='scene:font-retained';retained.engine.autoFitSizes=false;retained.entities[0].id='entity:font-retained';doc.scenes.push(retained);
  const before=clone(doc),font={fontFamily:FONT_OPTIONS.find(option=>option.id==='modern-mono').stack,fontWeight:700};
  const expected=doc.scenes.map(source=>{const body=clone(source.entities[0]);if(source.engine.autoFitSizes!==false)refitFormationForFont(body,effectiveScene(doc,source).engine,font);return body});
  const next=apply(doc,[{kind:'field-font',values:font}]);
  assert.deepEqual(doc,before);assert.equal(next.shared.values['engine.fontFamily'],font.fontFamily);assert.equal(next.shared.values['engine.fontWeight'],700);
  next.scenes.forEach((source,i)=>{
    assert.deepEqual(source.entities[0],expected[i]);
    const native=toNativeConfig(effectiveScene(next,source));assert.equal(native.fontFamily,font.fontFamily);assert.equal(native.fontWeight,700);
    assert.deepEqual(source.engine,doc.scenes[i].engine,'inherited settings keep their local authored source');
  });
});

test('Field scope accepts a locked selected formation, and malformed font batches never enter the store',()=>{
  const {doc,body}=rich();body.locked=true;
  const next=apply(doc,[{kind:'field-font',values:{fontWeight:400}}]);
  assert.equal(next.scenes[0].engine.fontWeight,400);assert.deepEqual(next.scenes[0].entities[0],body);
  const store=new DocumentStore(doc),before=clone(doc);
  for(const values of [{},{fontWeight:0},{fontWeight:1001},{fontWeight:600.5},{fontWeight:'700'},{fontFamily:''},{fontFamily:'serif; color:red'},{fontFamily:'a'.repeat(201)},{unknown:true}]) {
    assert.throws(()=>store.replace(apply(store.document,[{kind:'field-font',values:{fontWeight:700}},{kind:'field-font',values}])));
    assert.deepEqual(store.document,before);assert.equal(store.undoStack.length,0);
  }
});

test('state force kind and native pixel radius overrides reach the real native pose evaluator',()=>{
  const {doc,body}=rich(),before=clone(doc),state=clone(body.sequence.steps[0].objectState);
  state.force={...state.force,kind:'repel',radius:880/WORLD_SCALE};
  const next=apply(doc,[change(body,{kind:'step-overrides',step_id:'step:a',operation:'capture',values:state})]);
  assert.deepEqual(doc,before);const edited=next.scenes[0].entities[0],native=toNativeEntity(edited);
  for(const force of [native.sequence.links[0].state.forces,resolveEntityPose(native,.5,0,0,0).forces]) {
    assert.ok(Math.abs(force.radius-880)<1e-10,'native pixel radius retains its authored value within floating-point precision');
    assert.deepEqual({...force,radius:880},{mode:'repel',strength:2,radius:880,spin:.4});
  }
  assert.deepEqual(fromNativeEntity(native).sequence.steps[0].objectState.force,state.force);
  assert.deepEqual(edited.sequence.steps[1],body.sequence.steps[1]);
  for(const force of [{...state.force,kind:'unknown'},{...state.force,radius:0},{...state.force,radius:126}]) {
    assert.throws(()=>apply(doc,[change(body,{kind:'step-overrides',step_id:'step:a',operation:'capture',values:{...state,force}})]),/Invalid object state/);
    assert.deepEqual(doc,before);
  }
});


test('native acknowledgement leaves the actual Glyph gesture first in Undo and preserves Redo',()=>{
 const {doc,body}=rich(),store=new DocumentStore(doc),before=clone(store.document);
 store.replace(apply(store.document,[change(body,{kind:'step-timing',step_id:'step:a',hold:2.35})]));
 const edited=clone(store.document),revision=store.revision;
 store.acknowledge(clone(edited));
 assert.equal(store.undoStack.length,1);assert.ok(store.revision>revision);
 assert.equal(store.undo(),true);assert.deepEqual(store.document,before);
 store.acknowledge(clone(store.document));
 assert.equal(store.undoStack.length,0);assert.equal(store.redoStack.length,1);
 assert.equal(store.redo(),true);assert.deepEqual(store.document,edited);
});

test('native acknowledgement cannot consume an uncommitted human transaction or another document',()=>{
 const {doc}=rich(),store=new DocumentStore(doc),before=clone(store.document);
 store.begin();
 assert.throws(()=>store.acknowledge(clone(before)),/Uncommitted authoring/);
 assert.equal(store.transactionOpen,true);assert.deepEqual(store.document,before);
 store.finish();const other=clone(before);other.id='different-native-document';
 assert.throws(()=>store.acknowledge(other),/another document/);
 assert.deepEqual(store.document,before);assert.equal(store.undoStack.length,0);
});
