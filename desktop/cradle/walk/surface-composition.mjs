import assert from "node:assert/strict";
import {build} from "esbuild";
const result=await build({stdin:{contents:'export * from "./src/surface/engine"; export * from "./src/surface/composition"; export * from "./src/surface/persist"; export * from "./src/surface/types";',resolveDir:process.cwd()},bundle:true,write:false,platform:"node",format:"esm"});
const e=await import("data:text/javascript;base64,"+Buffer.from(result.outputFiles[0].text).toString("base64"));
const draft={id:crypto.randomUUID(),kind:"draft",title:"Draft"};
const factory={id:crypto.randomUUID(),kind:"factory",title:"O-I · Runs",project:"O-I",ref:"project:o-i"};
let ordinary=e.openBinding({...e.freshLayout(),rightWidth:310,leftWidth:238,rightDepth:"strip"},draft);
const checks=[];
function check(value,name){assert.ok(value,name);checks.push(name);console.log("PASS",name);}
let state=e.enterComposition(ordinary,factory);
const returnedId=state.composition.returnPaneId;
const returnedGroup=()=>e.groupsOf(e.paneById(state.root,returnedId))[0];
check(e.groupsOf(state.root).flatMap(g=>g.tabs).filter(id=>id===draft.id).length===1,"Entry retains one binding per source");
const note={id:crypto.randomUUID(),kind:"draft",title:"Working note"};
state=e.presentBinding(state,note,"right");
const detachedAnchorId=returnedGroup().id;
state=e.detachBinding(state,note.id);
state=e.tileSurfaces(state);
check(e.groupsOf(e.paneById(state.root,returnedId)).some(group=>group.id===detachedAnchorId&&group.tabs.length===0),"Tiling retains the detached return-pane anchor");
state=e.redockBinding(state,note.id);
check(e.groupsOf(e.paneById(state.root,returnedId)).find(group=>group.id===detachedAnchorId)?.tabs.includes(note.id),"Redock after tile returns the binding to its original group");
state=e.closeSurface(state,note.id);
check(!!returnedGroup(),"Closing final right tab retains its region destination");
state=e.presentBinding(state,note,"right");
state=e.splitOff(state,note.id,"v");
check(e.groupsOf(e.paneById(state.root,returnedId)).length===2,"Split within right region stays in that subtree");
state=e.tileSurfaces(state);
check(e.groupsOf(e.paneById(state.root,returnedId)).some(g=>g.tabs.includes(note.id)),"Tiling retains returned material in the right region");
state=e.decodeLayout(JSON.parse(JSON.stringify(state)));
check(state.composition?.returnPaneId===returnedId,"Composition and region tree survive layout decoder");
state=e.detachBinding(state,note.id);
state=e.leaveComposition(state);
check(state.rightWidth===310&&state.leftWidth===238&&state.rightDepth==="strip","Leave restores ordinary geometry");
check(e.groupsOf(state.root).find(g=>g.id===ordinary.focusedGroupId)?.active===draft.id,"Leave restores ordinary selection");
check(state.detached.some(d=>d.surfaceId===note.id),"Leave preserves detached binding identity");
state=e.redockBinding(state,note.id);
check(e.groupsOf(state.root).flatMap(g=>g.tabs).filter(id=>id===note.id).length===1,"Native redock after leave retains one exact binding");
state=e.enterComposition(state,factory);
const pinned={id:crypto.randomUUID(),kind:"draft",title:"Pinned output"};
state=e.presentBinding(state,pinned,"right");
state=e.togglePin(state,pinned.id);
state=e.selectCompositionCollection(state,factory.id,"owner-subject-one");
const pinnedGroup=e.groupsOf(e.paneById(state.root,state.composition.returnPaneId)).find(group=>group.tabs.includes(pinned.id));
check(!!pinnedGroup&&pinnedGroup.pinned.includes(pinned.id)&&!state.closedStack.includes(pinned.id),"Changing collection preserves explicitly pinned returned output");
const unpinned={id:crypto.randomUUID(),kind:"draft",title:"Unpinned output"};
state=e.presentBinding(state,unpinned,"right");
state=e.selectCompositionCollection(state,factory.id,"owner-subject-two");
check(!e.groupsOf(e.paneById(state.root,state.composition.returnPaneId)).some(group=>group.tabs.includes(unpinned.id))&&state.closedStack.includes(unpinned.id),"Changing collection clears unpinned returned output");
check(e.groupsOf(e.paneById(state.root,state.composition.returnPaneId)).some(group=>group.tabs.includes(pinned.id)&&group.pinned.includes(pinned.id)),"Unpinned collection cleanup retains pinned output state");

const duplicate={id:"duplicate-surface",kind:"draft",title:"Duplicate"};
const duplicateLayout={...e.freshLayout(),surfaces:{[duplicate.id]:duplicate},root:{type:"split",id:"duplicate-root",dir:"h",children:[
  {type:"group",id:"duplicate-left",tabs:[duplicate.id],pinned:[],active:duplicate.id},
  {type:"group",id:"duplicate-right",tabs:[duplicate.id],pinned:[],active:duplicate.id},
]},closedStack:[]};
const duplicateDecoded=e.decodeLayout(duplicateLayout);
check(!duplicateDecoded.root&&Object.keys(duplicateDecoded.surfaces).length===0,"Decoder rejects duplicate visible surface identity");

const visible={id:"visible-surface",kind:"draft",title:"Visible"};
let exclusive=e.openBinding(e.freshLayout(),visible);
const visibleGroup=e.groupsOf(exclusive.root)[0];
exclusive={...exclusive,detached:[{surfaceId:visible.id,groupId:visibleGroup.id,index:0,pinned:false}],closedStack:[visible.id]};
const exclusiveDecoded=e.decodeLayout(exclusive);
check(!exclusiveDecoded.detached?.some(entry=>entry.surfaceId===visible.id)&&!exclusiveDecoded.closedStack.includes(visible.id),"Decoder excludes detached and closed identities already visible");

console.log(JSON.stringify({standing:"C: production Surface engine and decoder, no owner execution assertion",checks},null,2));
