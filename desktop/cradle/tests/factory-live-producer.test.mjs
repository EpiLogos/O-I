// Pure repertoire/catch-up/chain regressions. Native IO/state-machine acceptance
// is tests/shared-direct-native-owner.mjs + factory-live-native-path.mjs; no
// fabricated positive owner receipts or recording World remain in this suite.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
const P = await import("../src/contributions/factory/live/producer.ts");
const R = await import("../src/contributions/factory/live/repertoire.ts");
const E = await import("../src/contributions/factory/live/eventMap.ts");
const live = JSON.parse(readFileSync(new URL("./fixtures/factory-live-events.json", import.meta.url), "utf8"));
const root = new URL("../material/expressive-material/", import.meta.url);
const material = readdirSync(root, {recursive:true}).filter(path=>String(path).endsWith(".expression.json")).map(path=>{
 const document=JSON.parse(readFileSync(new URL(String(path),root),"utf8")),reuse=document.reuse;
 return {file_ref:`central:Work/O-I/desktop/cradle/material/expressive-material/${path}`,revision:"source-regression",title:reuse.title,kind:reuse.kind,
  roles:reuse.roles??[],states:reuse.states??{},gestures:reuse.gestures??{},playback:reuse.playback??[],entry_scene_ref:reuse.entry_scene_ref,
  associations:reuse.associations??{},expression_ref:document.expression_ref};
});

test("actual authored Factory material resolves explicit/workflow/generic precedence and distinct characters",()=>{
 const workflow=R.resolveRepertoire(material,{workflowKey:"expression-development"});
 assert.equal(workflow.basis,"workflow");
 assert.equal(R.resolveRepertoire(material,{explicit:workflow.expression.file_ref,workflowKey:"other"}).basis,"explicit");
 assert.equal(R.resolveRepertoire(material,{workflowKey:"unknown"}).basis,"generic");
 for(const key of ["arrival","work-passage","handoff","review","completion","continuation"])assert.ok(R.sceneFor(workflow,key)?.scene_ref);
 assert.notEqual(R.characterFor(workflow,undefined,0,"idle").file_ref,R.characterFor(workflow,undefined,1,"idle").file_ref);
});

test("bounded catch-up preserves selected arrival/latest state and excludes older material",()=>{
 const ops=E.mapEvents({runRef:live.runRef,attempts:live.attemptReadings[1],telemetry:live.telemetryWatch},{});
 assert.ok(ops.length>4);
 const caught=P.catchUp(ops,4);
 assert.ok(caught.keep.length<=4);
 assert.equal(new Set([...caught.keep,...caught.skip]).size,ops.length);
 assert.ok(caught.keep.every(op=>!caught.skip.includes(op)));
 for(const op of caught.keep){
  const same=ops.filter(candidate=>candidate.basis.event_ref===op.basis.event_ref);
  assert.ok(op.basis.family==='arrival'||same.slice(-2).includes(op));
 }
});

test("rollover refs cannot adopt a neighbouring or malformed Act chain",()=>{
 const base=P.actRefFor(live.runRef);
 assert.equal(P.chainIndex(base,base),1);
 assert.equal(P.chainIndex(base,P.chainRef(base,2)),2);
 for(const ref of [base+'-other',base+':two','act:neighbour:2'])assert.equal(P.chainIndex(base,ref),0);
});

test("retained source operations remain available for exact native prequalification",()=>{
 const readings={runRef:live.runRef,telemetry:live.telemetryWatch};
 const initial=E.mapEventsWithCursor(readings,{});
 assert.ok(initial.ops.length);
 const cursor={...E.emptyCursor(),performed:initial.ops.map(E.opKey)};
 assert.equal(E.mapEventsWithCursor(readings,{},cursor).ops.length,0);
 assert.deepEqual(E.mapEventsWithCursor(readings,{},cursor,undefined,true).ops,initial.ops);
});
