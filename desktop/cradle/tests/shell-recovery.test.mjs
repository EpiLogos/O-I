// Behavioural state regressions: production engine, persistence and workspace
// owner. No rendered stubs or source-presence assertions.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/surface/engine.ts';
import {freshLayout} from '../src/surface/types.ts';
import {decodeLayout} from '../src/surface/persist.ts';
import {switchWorkspaceMode} from '../src/workspace/store.ts';
const group=(id,tabs=[id])=>({type:'group',id,tabs,pinned:[],active:tabs[0]??null});
const split=(id,dir,...children)=>({type:'split',id,dir,children,weights:children.map((_,i)=>i+1)});
const binding=(id,kind='draft')=>({id,kind,title:id});
const state=(root)=>({...freshLayout(),root,surfaces:Object.fromEntries(engine.groupsOf(root).flatMap(g=>g.tabs.map(id=>[id,binding(id)]))),focusedGroupId:engine.groupsOf(root)[0]?.id??null});
const corners=s=>[engine.upperCornerGroupId(s,'left'),engine.upperCornerGroupId(s,'right')];
const invariant=s=>{
 const groups=engine.groupsOf(s.root),ids=groups.flatMap(g=>g.tabs);
 assert.equal(ids.length,new Set(ids).size,'a binding has one centre placement');
 for(const g of groups){assert.equal(g.tabs.length?g.tabs.includes(g.active):g.active===null,true);for(const id of g.pinned)assert.ok(g.tabs.includes(id));assert.ok(!g.tabs.length||!g.emptySlot);}
 assert.ok(s.focusedGroupId===null||groups.some(g=>g.id===s.focusedGroupId));
 assert.ok(!s.maximizedGroupId||groups.some(g=>g.id===s.maximizedGroupId));
 assert.ok(!s.focusedTabId||ids.includes(s.focusedTabId));
 if(!ids.length&&!s.detached?.length)assert.equal(s.root,null);
};

test('upper-right belongs to the spatial boundary, never focus or first traversal',()=>{
 for(const root of [split('h','h',group('left'),split('v','v',group('upper-right'),group('bottom'))),split('v','v',split('h','h',group('left'),group('upper-right')),group('bottom'))]){
  let s=state(root);assert.deepEqual(corners(s),['left','upper-right']);
  s=engine.focusGroup(s,'bottom');assert.deepEqual(corners(s),['left','upper-right']);
  s=engine.resizeSplit(s,root.id,[97,3]);assert.deepEqual(corners(s),['left','upper-right']);
  assert.deepEqual(corners(decodeLayout(JSON.parse(JSON.stringify(s)))),['left','upper-right']);invariant(s);
 }
});
test('arbitrarily nested mixed splits, maximize/restore and close transfer one corner',()=>{
 let s=state(split('h0','h',group('left'),split('v0','v',split('h1','h',group('middle'),group('corner')),group('bottom'))));
 assert.deepEqual(corners(s),['left','corner']);
 s={...s,maximizedGroupId:'bottom'};assert.deepEqual(corners(s),['bottom','bottom']);
 s={...s,maximizedGroupId:undefined};assert.deepEqual(corners(s),['left','corner']);
 s=engine.closeSurface(s,'corner');assert.deepEqual(corners(s),['left','middle']);invariant(s);
});
test('closing the maximized group clears the stale mask; sibling remains visible',()=>{
 let s={...state(split('h','h',group('a'),group('b'))),maximizedGroupId:'b',focusedGroupId:'b',focusedTabId:'b'};
 s=engine.closeSurface(s,'b');invariant(s);assert.equal(s.maximizedGroupId,undefined);assert.equal(s.focusedTabId,undefined);assert.equal(s.focusedGroupId,'a');assert.deepEqual(corners(s),['a','a']);assert.equal(engine.activeBindingId(s),'a');
});
test('last real content returns to genuine rest and remains reopenable without changing its binding',()=>{
 let s=state(group('g',['doc']));const doc=s.surfaces.doc;s={...s,maximizedGroupId:'g'};
 s=engine.closeSurface(s,'doc');invariant(s);assert.equal(engine.openSurfaceCount(s),0);assert.equal(engine.activeBindingId(s),null);assert.equal(s.surfaces.doc,doc);assert.deepEqual(s.closedStack,['doc']);
 s=engine.reopenClosed(s);invariant(s);assert.equal(engine.openSurfaceCount(s),1);assert.equal(s.surfaces.doc,doc);assert.deepEqual(s.closedStack,[]);
});
test('an unpinned active New tab is consumed in place by pending and failed file opens',()=>{
 let s=engine.openBinding(freshLayout(),binding('blank','blank'));const groupId=s.root.id;
 s=engine.openBinding(s,{...binding('file','file'),pending:true});invariant(s);
 assert.equal(engine.openSurfaceCount(s),1);assert.deepEqual(s.root.tabs,['file']);assert.equal(s.root.id,groupId);assert.equal(s.surfaces.blank,undefined);assert.deepEqual(s.closedStack,[]);
 const failed={...s.surfaces.file,pending:false};s={...s,surfaces:{...s.surfaces,file:failed}};
 s=engine.closeSurface(s,'file');invariant(s);assert.equal(s.root,null);
 s=engine.openBinding(s,binding('next','draft'));invariant(s);assert.equal(engine.openSurfaceCount(s),1);
});
test('last blank has no phantom closed tab; repeated close/open never adds an invisible tab',()=>{
 let s=freshLayout();
 for(let i=0;i<30;i++){
  s=engine.openBinding(s,binding('blank-'+i,'blank'));s=engine.openBinding(s,binding('extra-'+i,'blank'));assert.equal(engine.openSurfaceCount(s),1);
  s=engine.closeSurface(s,engine.activeBindingId(s));invariant(s);assert.equal(s.root,null);assert.deepEqual(s.closedStack,[]);assert.deepEqual(s.surfaces,{});
 }
});
test('pinned placeholder and real dirty-document identities are not silently discarded',()=>{
 let s=engine.openBinding(freshLayout(),binding('blank','blank'));s=engine.togglePin(s,'blank');const pinned=s;
 assert.equal(engine.closeSurface(s,'blank'),s);
 s=engine.openBinding(s,binding('doc'));invariant(s);assert.equal(engine.openSurfaceCount(s),2);assert.deepEqual(s.root.pinned,['blank']);assert.equal(s.surfaces.blank,pinned.surfaces.blank);
 const doc=s.surfaces.doc;s=engine.openBinding(s,binding('other'));assert.equal(s.surfaces.doc,doc);
});
test('opening an already live binding activates rather than duplicates it, including while maximized',()=>{
 let s={...state(split('h','h',group('a'),group('b'))),maximizedGroupId:'a'};
 s=engine.openBinding(s,s.surfaces.b);invariant(s);assert.equal(engine.openSurfaceCount(s),2);assert.equal(s.maximizedGroupId,'b');assert.equal(engine.activeBindingId(s),'b');
});
test('restoration repairs invalid active/pinned/maximize state and excludes live bindings from closed history',()=>{
 const s=state(group('g',['one','two']));s.root.active='missing';s.root.pinned=['missing','one'];s.maximizedGroupId='gone';s.focusedGroupId='gone';s.closedStack=['one','two'];
 const restored=decodeLayout(s);invariant(restored);assert.equal(engine.activeBindingId(restored),'one');assert.deepEqual(restored.closedStack,[]);assert.deepEqual(restored.root.pinned,['one']);
});
test('empty split destinations do not keep a last-content workspace artificially alive',()=>{
 let s=state(split('h','h',group('real'),{...group('empty',[]),emptySlot:true}));
 s=engine.closeSurface(s,'real');invariant(s);assert.equal(s.root,null);assert.deepEqual(s.closedStack,['real']);
});
test('a detached window keeps its reserved slot and returns to the same source binding',()=>{
 let s=state(group('g',['doc']));const doc=s.surfaces.doc;
 s=engine.detachBinding(s,'doc');s=engine.reconcileLayout(s);assert.equal(s.root.id,'g');assert.equal(s.root.active,null);assert.equal(s.detached.length,1);assert.equal(engine.openSurfaceCount(s),0);
 s=engine.redockBinding(s,'doc');invariant(s);assert.equal(s.root.id,'g');assert.equal(s.surfaces.doc,doc);assert.equal(engine.activeBindingId(s),'doc');assert.equal(s.detached.length,0);
});
test('Settings takes the full workspace and returns its exact preceding layout/documents/session',()=>{
 for(const mode of ['base','factory','expressions','techne']){
  const layout={...state(split('h','h',group('a'),group('b'))),mode:mode==='base'?undefined:mode,agencyDepth:'panel',rightDepth:'panel',leftWidth:244,rightWidth:350,accompanying:{ref:'existing-session',project:'P',space:'existing-space'},maximizedGroupId:'b'};
  const w={id:'w',name:'Central',writing:'',layout};const settings=switchWorkspaceMode(w,'settings');
  assert.equal(settings.layout.agencyDepth,'collapsed');assert.equal(settings.layout.rightDepth,'collapsed');assert.equal(settings.layout.settingsReturnMode,mode);assert.equal(settings.modeLayouts[mode].root,layout.root);assert.equal(settings.layout.accompanying,layout.accompanying);
  assert.equal(decodeLayout(JSON.parse(JSON.stringify(settings.layout))).settingsReturnMode,mode);
  const back=switchWorkspaceMode(settings,settings.layout.settingsReturnMode);
  assert.equal(back.layout.root,layout.root);assert.equal(back.layout.surfaces,layout.surfaces);assert.equal(back.layout.accompanying,layout.accompanying);assert.equal(back.layout.agencyDepth,'panel');assert.equal(back.layout.rightDepth,'panel');assert.equal(back.layout.maximizedGroupId,'b');
 }
});

import {warmWorkspaceTrees} from '../src/surface/warmTrees.ts';
test('visible new-tab/draft/empty/over-budget trees cannot be filtered out by hidden retention',()=>{
 for(const layout of [engine.openBinding(freshLayout(),binding('new','blank')),state(group('draft')),state({...group('empty',[]),emptySlot:true}),state(group('large',Array.from({length:200},(_,i)=>'doc-'+i)))]){
  const w={id:'w',name:'Central',writing:'',layout};const trees=warmWorkspaceTrees([w],w.id,'base');
  assert.equal(trees.length,1);assert.equal(trees[0].layout,layout);assert.equal(trees[0].presented,true);
 }
});
test('a draft-only editor tree stays mounted when Settings stands, without cloning document identity',()=>{
 const base=state(group('g',['draft']));const w=switchWorkspaceMode({id:'w',name:'Central',writing:'',layout:base},'settings');
 const tree=warmWorkspaceTrees([w],w.id,'settings').find(t=>t.key==='w:base');
 assert.ok(tree);assert.equal(tree.presented,false);assert.equal(tree.layout.root,base.root);assert.equal(tree.layout.surfaces,base.surfaces);
});


test('compact presentation assigns both corners to the visible focused pane without changing the tree',()=>{
 const s=state(split('h','h',group('left'),split('v','v',group('top'),group('bottom'))));
 const before=JSON.stringify(s);
 for(const id of ['left','top','bottom']) {
  const focused={...s,focusedGroupId:id};
  assert.equal(engine.upperCornerGroupId(focused,'right',true),id);
  assert.equal(engine.upperCornerGroupId(focused,'left',true),id);
  assert.equal(engine.upperCornerGroupId(focused,'right',false),'top');
 }
 assert.equal(engine.upperCornerGroupId({...s,maximizedGroupId:'bottom'},'right',true),'bottom');
 assert.equal(engine.upperCornerGroupId({...s,focusedGroupId:'stale'},'right',true),'top');
 assert.equal(JSON.stringify(s),before,'resizing never rewrites a retained layout');
});

test('presented documents never consume the hidden-tree budget or evict a returning editor',()=>{
 const hidden=state(group('hidden',['retained-draft']));
 const active=state(group('large',Array.from({length:200},(_,i)=>'active-'+i)));
 const w={id:'w',name:'Central',writing:'',layout:{...active,mode:'factory'},modeLayouts:{base:hidden}};
 const trees=warmWorkspaceTrees([w],w.id,'factory');
 assert.equal(trees.find(t=>t.key==='w:base')?.layout,hidden,'the retained editor remains the same tree');
 assert.equal(trees.find(t=>t.key==='w:factory')?.presented,true);
});
