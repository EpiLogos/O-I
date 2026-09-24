import test from "node:test";
import assert from "node:assert/strict";
import {buildSituationFrame} from "../src/context/situation.ts";

const source={id:"source-1",kind:"source",ref:"source:o-i/context",title:"context.ts",project:"O-I"};
const terminal={id:"terminal-1",kind:"terminal",title:"Terminal",project:"O-I",terminal:{cwd:"/Central/Work/o-i"}};
const factory={id:"factory-1",kind:"factory",title:"Factory",project:"O-I",ref:"project:o-i"};
const layout={
  root:{type:"group",id:"g1",tabs:[source.id],pinned:[],active:source.id},
  surfaces:{[source.id]:source,[terminal.id]:terminal},
  closedStack:[],focusedGroupId:"g1",agencyDepth:"panel",
  detached:[{surfaceId:terminal.id,groupId:"g1",index:1,pinned:false}],
  mode:undefined,
};
const factoryLayout={
  root:{type:"group",id:"gf",tabs:[factory.id],pinned:[],active:factory.id},
  surfaces:{[factory.id]:factory},
  closedStack:[],focusedGroupId:"gf",agencyDepth:"panel",mode:"factory",
};
const workspace={
  id:"w1",name:"Working",project:"O-I",writing:"",layout,modeLayouts:{factory:factoryLayout},
  projectNavigation:{"project:o-i":{expanded:true,scroll:0,mode:"files",locationPath:"Work/o-i/desktop/cradle/src/context"}},
  recentPlaces:[{kind:"file",label:"store.ts",project:"O-I",path:"Work/o-i/desktop/cradle/src/workspace/store.ts",ref:"central:file:store",visitedAt:2}],
  context:{world:"central",subject:{ref:"source:o-i/context",kind:"source",title:"Context state",project:"O-I"}},
};
const snapshot={
  focus:{project:{ref:"project:o-i"},subject:{ref:"source:o-i/context",kind:"source",native_owner:"central"}},
  surfaces:{},
  buffers:{"source:o-i/context":{source_ref:"source:o-i/context",project:"O-I",world_ref:"world:central",content:"",saved_content:"",base_revision:"r1",dirty:false,path:"Work/o-i/desktop/cradle/src/context/context.ts"}},
};

test("SituationFrame composes active, resident and recent state without cloning owner truth",()=>{
  const frame=buildSituationFrame({workspace,snapshot});
  assert.equal(frame.schema,"oi.cradle.situation/v1");
  assert.equal(frame.focus?.id,"source-1");
  assert.equal(frame.focus?.presence,"focused");
  assert.equal(frame.surfaces.find(surface=>surface.id==="factory-1")?.presence,"resident");
  assert.equal(frame.surfaces.find(surface=>surface.id==="terminal-1")?.presence,"detached");
  assert.equal(frame.currentPlace?.path,"Work/o-i/desktop/cradle/src/context/context.ts");
  assert.ok(frame.places.some(place=>place.presence==="recent"&&place.title==="store.ts"));
  assert.ok(frame.capabilities.presentation.some(action=>action.action_ref==="surface.close"));
  assert.equal(frame.subject?.title,"Context state");
  assert.equal(frame.nativeFocus.subject?.ref,"source:o-i/context");
});
