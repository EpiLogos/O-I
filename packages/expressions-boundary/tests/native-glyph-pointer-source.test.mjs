import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import './register-production-sources.mjs';
import ts from '../../../desktop/cradle/node_modules/typescript/lib/typescript.js';
const root=new URL('../../../',import.meta.url),author=new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root);
const [{kernelDocumentToJourney},{DocumentStore},{applyNativeGlyphChanges,createRetainedNativeEditor},{readNativeGlyphTiming}]=await Promise.all([
  import(new URL('kernelDocumentBridge.ts',author)),import(new URL('store.ts',author)),import(new URL('hostEditor.ts',author)),
  import(new URL('packages/live-shell/ui/src/shell/nativeContent.ts',root)),
]);
const source=ts.createSourceFile('GlyphSequenceEditor.tsx',await readFile(new URL('packages/live-shell/ui/src/components/GlyphSequenceEditor.tsx',root),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const nodes=[];function walk(node){nodes.push(node);ts.forEachChild(node,walk)}walk(source);
function execute(name,bindings={}) {
  const node=nodes.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);assert.ok(node,name);
  const code=ts.transpileModule(node.getText(source).replace(/^export /,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},fileName:'timing.ts'}).outputText;
  return new Function(...Object.keys(bindings),code+`\nreturn ${name};`)(...Object.values(bindings));
}
const document=JSON.parse(await readFile(new URL('packages/live-shell/ui/tests/fixtures/native-rich-glyph-rack.json',root),'utf8'));
function controller() {
  const view=kernelDocumentToJourney(document),store=new DocumentStore(view.journey),scene=store.document.scenes.find(row=>row.id===view.startSceneId),e=scene.entities.find(row=>row.kind==='formation');
  const basis={expression_ref:view.document.expression_ref,scene_ref:view.bindings[scene.id].scene_ref,revision:document.revision,authored_revision:store.revision};
  const closed=()=>{throw Error('Native effects stay closed during pure model pointer verification')};
  const reading=createRetainedNativeEditor({store,sceneId:()=>scene.id,selection:()=>({entity_ids:[e.id],step_id:e.sequence.steps[0].id}),nativeView:()=>view,nativeSelect:closed,commit:closed,change:closed,afterHistory:closed,selectLocal:closed,openEditor:closed,standing:()=>({busy:false,notice:null}),telemetry:()=>undefined,fieldPaused:()=>false}).read();
  const drag={current:null},lifetime={current:{epoch:1}},draftValues=new Map(),state={visible:true,preview:null,commits:[],captured:new Set()};
  const bindings={drag,lifetime,draftValues,r:reading,e,timing:readNativeGlyphTiming(e,scene.morph.dwell),pixelsPerSecond:40,timingLocked:false,
    shown:()=>state.visible,isPresented:()=>state.visible,setTimingDraft:next=>{state.preview=typeof next==='function'?next(state.preview):next},draftChanged:()=>{},
    apply:async(changes,captured)=>{const next=applyNativeGlyphChanges(store.document,scene.id,changes);store.replace(next);state.commits.push({changes,captured});return true},
    submitInput:execute('submitInput',{submissions:new WeakMap()}),
  };
  bindings.retainInput=execute('retainInput',{inputAperture:null});
  bindings.discardInput=execute('discardInput',{inputAperture:null});
  bindings.retainTimingInput=execute('retainTimingInput',bindings);
  bindings.submitCapturedInput=execute('submitCapturedInput',{...bindings,inputAperture:null});
  const currentTarget={setPointerCapture:id=>state.captured.add(id),hasPointerCapture:id=>state.captured.has(id),releasePointerCapture:id=>state.captured.delete(id)};
  const event=(pointerId,clientX=0)=>({pointerId,clientX,currentTarget,stopPropagation:()=>{}});
  return {store,scene,e,basis,drag,lifetime,state,draftValues,event,...Object.fromEntries(['startTiming','updateTiming','endTiming','cancelTiming'].map(name=>[name,execute(name,bindings)]))};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('one owning pointer writes final rich timing through real reducer/store with one exact Undo/Redo',async()=>{
  const c=controller(),before=structuredClone(c.store.document),step=c.e.sequence.steps[0];
  c.startTiming(c.event(7,10),step,'hold');c.updateTiming(c.event(7,30));c.updateTiming(c.event(7,50));
  c.endTiming(c.event(7,50));await tick();
  assert.equal(c.state.commits.length,1);assert.equal(c.store.undoStack.length,1);assert.equal(c.draftValues.size,0);
  assert.equal(c.store.document.scenes[0].entities[0].sequence.steps[0].hold,step.hold+1);
  assert.deepEqual(c.store.document.scenes[0].entities[0].sequence.steps[0].layers,step.layers);
  const after=structuredClone(c.store.document);assert.equal(c.store.undo(),true);assert.deepEqual(c.store.document,before);
  assert.equal(c.store.redo(),true);assert.deepEqual(c.store.document,after);
});

test('second pointer cannot replace, move, end or cancel the captured timing gesture',async()=>{
  const c=controller(),step=c.e.sequence.steps[0];c.startTiming(c.event(7,10),step,'hold');const initial=c.drag.current;
  c.startTiming(c.event(8,100),c.e.sequence.steps[1],'transition');c.updateTiming(c.event(8,500));
  c.endTiming(c.event(8,500));c.cancelTiming(c.event(8));await tick();
  assert.equal(c.drag.current,initial);assert.equal(initial.value,initial.hold);assert.equal(c.state.commits.length,0);assert.equal(c.draftValues.size,0);
  c.updateTiming(c.event(7,30));c.endTiming(c.event(7,30));await tick();assert.equal(c.state.commits.length,1);
  assert.equal(c.store.document.scenes[0].entities[0].sequence.steps[0].hold,step.hold+.5);
});

test('click, owned cancellation and lost capture preserve authored rich material and existing drafts',async()=>{
  for(const finish of ['click','cancel','lost-capture']) {
    const c=controller(),before=structuredClone(c.store.document),retained={label:'Earlier input',value:'2.45',commit:()=>assert.fail('Existing draft must remain untouched')};c.draftValues.set('retained',retained);
    c.startTiming(c.event(7),c.e.sequence.steps[0],'hold');
    if(finish==='click')c.endTiming(c.event(7));else{c.updateTiming(c.event(7,40));if(finish==='lost-capture')c.state.captured.delete(7);c.cancelTiming(c.event(7));}
    await tick();assert.deepEqual(c.store.document,before);assert.equal(c.store.undoStack.length,0);assert.equal(c.draftValues.size,finish==='click'?1:2);assert.equal(c.draftValues.get('retained'),retained);assert.equal(c.state.preview,null);
  }
});

test('hidden start is refused; a departed cut retains the exact moved draft without dispatching',async()=>{
  const c=controller(),before=structuredClone(c.store.document),step=c.e.sequence.steps[0];c.state.visible=false;c.startTiming(c.event(7),step,'hold');assert.equal(c.drag.current,null);
  c.state.visible=true;c.startTiming(c.event(7),step,'hold');c.updateTiming(c.event(7,40));
  const preview=c.state.preview;c.state.visible=false;c.lifetime.current.epoch++;c.updateTiming(c.event(7,80));assert.equal(c.state.preview,preview);
  c.endTiming(c.event(7,80));await tick();assert.equal(c.state.commits.length,0);assert.deepEqual(c.store.document,before);
  const [entry]=c.draftValues.values();assert.equal(entry.value,String(step.hold+1));assert.equal(c.draftValues.size,1);
});

test('actual removed membership reconciles stable range while runtime readings preserve it',()=>{
  const c=controller(),ids=c.e.sequence.steps.map(step=>step.id),reconcile=execute('reconcileGlyphSelection');assert.ok(ids.length>=3);
  const range=ids.slice(0,2);assert.deepEqual(reconcile(range,structuredClone(c.e),ids[0]),range);
  c.store.replace(applyNativeGlyphChanges(c.store.document,c.scene.id,[{kind:'step-remove',entity_id:c.e.id,step_ids:[ids[1]]}]));
  const current=c.store.document.scenes[0].entities[0];assert.deepEqual(reconcile(range,current,ids[0]),[ids[0]]);
  const receiving=nodes.find(node=>ts.isCallExpression(node)&&node.expression.getText(source)==='useEffect'&&node.arguments[0]?.getText(source).includes('reconcileGlyphSelection'));
  assert.ok(receiving.arguments[1].elements.some(node=>node.getText(source)==='stepMembership'),'actual production reconciliation must rerun on membership changes');
});
