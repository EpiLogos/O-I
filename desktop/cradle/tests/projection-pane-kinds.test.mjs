// Behavioural regressions for the projection pane kinds and the projection
// module boundary (WORLD-SHELL-DESIGN §10 seams 1–2). Production engine,
// codec, registry and module door — no rendered stubs, no source-presence
// assertions. The pane grammar exercised here is the same one the mockups
// name: open, split beside/below, four-fold (tile), move, close.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/surface/engine.ts';
import {freshLayout, PROJECTION_PANE_KINDS, isProjectionPaneKind} from '../src/surface/types.ts';
import {decodeLayout} from '../src/surface/persist.ts';
import {validBinding} from '../src/surface/layout-codec.mjs';
import {bindingDisclosures} from '../src/surface/registry.ts';
import {registerProjectionModule, projectionModule, resetProjectionModulesForTest, absentEncounterBridge} from '../src/surface/projectionModules.ts';

const group=(id,tabs=[id])=>({type:'group',id,tabs,pinned:[],active:tabs[0]??null});
const bindingOf=(id,kind='draft',extra={})=>({id,kind,title:id,...extra});
const stateOf=(root,surfaces)=>({...freshLayout(),root,surfaces:Object.fromEntries(surfaces.map(b=>[b.id,b])),focusedGroupId:engine.groupsOf(root)[0]?.id??null});

test('the four projection kinds are additive body kinds of the existing engine',()=>{
  assert.deepEqual([...PROJECTION_PANE_KINDS],['projection.earth','projection.timeline','projection.constellation','projection.expressions']);
  for(const kind of PROJECTION_PANE_KINDS)assert.ok(isProjectionPaneKind(kind));
  assert.equal(isProjectionPaneKind('projection.telescope'),false);
  assert.equal(isProjectionPaneKind('source'),false);
});

test('a projection binding is minted with its encounter slice; the same kind+subject reactivates, a different subject mints a second instance',()=>{
  let s=freshLayout();
  const first=engine.makeProjectionBinding(s,'projection.timeline',{subject_ref:'stone1950',subject_title:'Stone 1950'});
  assert.equal(first.kind,'projection.timeline');
  assert.deepEqual(first.projection,{kind:'projection.timeline',subject_ref:'stone1950'});
  assert.equal(first.title,'Timeline · Stone 1950');
  s={...s,surfaces:{...s.surfaces,[first.id]:first}};
  const again=engine.makeProjectionBinding(s,'projection.timeline',{subject_ref:'stone1950'});
  assert.equal(again.id,first.id,'same kind + same subject = the same projection instance');
  const pinned=engine.makeProjectionBinding(s,'projection.earth',{subject_ref:'stone1950'});
  assert.notEqual(pinned.id,first.id,'a second projection of the same subject is its own pane');
  const following=engine.makeProjectionBinding(s,'projection.timeline',{});
  assert.deepEqual(following.projection,{kind:'projection.timeline'},'no subject_ref = the pane follows the encounter');
  assert.equal(engine.isProjectionBinding(first),true);
  assert.equal(engine.isProjectionBinding(bindingOf('x','source')),false);
});

test('two panes hold two projections of one subject: open, split beside, both live, encounter slice survives',()=>{
  const a=engine.makeProjectionBinding(freshLayout(),'projection.timeline',{subject_ref:'stone1950'});
  let s=engine.openBinding(freshLayout(),a);
  assert.ok(engine.groupsOf(s.root).some(g=>g.tabs.includes(a.id)));
  const b=engine.makeProjectionBinding(s,'projection.earth',{subject_ref:'stone1950'});
  s=engine.openBinding(s,b);
  s=engine.splitOff(s,b.id,'h');
  const groups=engine.groupsOf(s.root);
  assert.equal(groups.length,2,'the split is real: two pane groups');
  const held=groups.flatMap(g=>g.tabs).map(id=>s.surfaces[id]);
  assert.deepEqual(held.map(h=>[h.kind,h.projection?.subject_ref]),[['projection.timeline','stone1950'],['projection.earth','stone1950']],'two projections, one subject, one encounter');
  // The same subject through the same kind again activates instead of duplicating.
  const before=engine.groupsOf(s.root).length;
  s=engine.openProjectionPane(s,'projection.earth',{subject_ref:'stone1950'});
  assert.equal(engine.groupsOf(s.root).length,before);
  assert.equal(engine.focusedGroup(s)?.active,b.id);
});

test('the frame discloses its own pane grammar for projection kinds; close retires to the recovery stack',()=>{
  const b=engine.makeProjectionBinding(freshLayout(),'projection.constellation',{subject_ref:'ariadne'});
  const s=stateOf(group('g1',[b.id]),[b]);
  const disclosures=bindingDisclosures({state:s,snapshot:{root:s.root,surfaces:s.surfaces,closedStack:[],focusedGroupId:s.focusedGroupId}},b.id);
  assert.ok(disclosures.some(d=>d.action_ref==='surface.close'),'close is disclosed');
  assert.ok(disclosures.some(d=>d.action_ref==='surface.maximize'),'maximize is disclosed');
  const closed=engine.closeSurface(s,b.id);
  assert.equal(engine.groupsOf(closed.root).length,0);
  assert.deepEqual(closed.closedStack,[b.id],'a closed projection pane is recoverable, never deleted');
  const reopened=engine.reopenClosed(closed);
  assert.ok(engine.groupsOf(reopened.root).some(g=>g.tabs.includes(b.id)));
});

test('the codec restores a projection binding with its slice and drops a mistyped slice without dropping the binding',()=>{
  const good=validBinding({id:'p1',kind:'projection.timeline',title:'Timeline · Stone 1950',projection:{kind:'projection.timeline',subject_ref:'stone1950'}});
  assert.ok(good);
  assert.deepEqual(good.projection,{kind:'projection.timeline',subject_ref:'stone1950'});
  const following=validBinding({id:'p2',kind:'projection.earth',title:'Earth',projection:{kind:'projection.earth'}});
  assert.deepEqual(following.projection,{kind:'projection.earth'});
  const sliced=validBinding({id:'p3',kind:'projection.constellation',title:'Constellation',projection:{kind:'projection.earth',subject_ref:'x'}});
  assert.equal(sliced.projection,undefined,'a slice whose kind contradicts the binding is dropped, never guessed');
  assert.ok(sliced,'the binding itself stands');
  const mistyped=validBinding({id:'p4',kind:'projection.earth',title:'Earth',projection:'earth'});
  assert.ok(mistyped,'a mistyped slice never invalidates the binding');
  assert.equal(mistyped.projection,undefined,'the mistyped slice itself is dropped, never guessed');
  assert.equal(validBinding({id:'p5',kind:'projection.telescope',title:'Telescope'}),null,'an unknown projection kind is not admitted');
  // Full layout round trip: split tree, two projections of one subject.
  const a=engine.makeProjectionBinding(freshLayout(),'projection.timeline',{subject_ref:'stone1950'});
  let s=engine.openBinding(freshLayout(),a);
  const b=engine.makeProjectionBinding(s,'projection.expressions',{subject_ref:'stone1950'});
  s=engine.openBinding(s,b);
  s=engine.splitOff(s,b.id,'v');
  const restored=decodeLayout(JSON.parse(JSON.stringify(s)));
  const restoredKinds=engine.groupsOf(restored.root).flatMap(g=>g.tabs).map(id=>restored.surfaces[id]).map(h=>[h.kind,h.projection?.subject_ref]).sort();
  assert.deepEqual(restoredKinds,[['projection.expressions','stone1950'],['projection.timeline','stone1950']]);
});

test('the module door: one module per kind, a different late module refuses, same id is idempotent',()=>{
  resetProjectionModulesForTest();
  const unmounts=[];
  const make=(id,kind)=>({id,kind,create:(context)=>{const unsub=context.encounter.subscribe(()=>{});unmounts.push(id);return{unmount(){unsub();unmounts.splice(unmounts.indexOf(id),1);}}}});
  registerProjectionModule(make('atlas-earth','projection.earth'));
  assert.equal(projectionModule('projection.earth')?.id,'atlas-earth');
  assert.equal(projectionModule('projection.timeline'),undefined,'a kind with no module stays honestly unadmitted');
  assert.throws(()=>registerProjectionModule(make('other-earth','projection.earth')),'a second, different module for a taken kind refuses');
  registerProjectionModule(make('atlas-earth','projection.earth'));
  assert.equal(projectionModule('projection.earth')?.id,'atlas-earth','idempotent re-admission of the same module stands');
  assert.throws(()=>registerProjectionModule(make('x','projection.telescope')),'an unknown kind refuses');
  resetProjectionModulesForTest();
  assert.equal(projectionModule('projection.earth'),undefined);
});

test('the absence bridge is honest: one immediate snapshot, transitions refused by name, not swallowed',()=>{
  let seen=0;
  const unsub=absentEncounterBridge.subscribe(snapshot=>{seen++;assert.equal(snapshot.mode,'unhosted');assert.equal(snapshot.accessEpoch,0);});
  assert.equal(seen,1);
  unsub();
  assert.throws(()=>absentEncounterBridge.transition({kind:'subject',title:'x'}),/refused/);
});
