// lane-1 A3–A4: connector presentation on the Research Canvas. Kinds, sides and
// labels are closed, presentation-only records keyed by the native edge id. An
// absent record is today's curved, auto-routed connector; the native relation
// (kind, direction, endpoints) is never written from here.
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
let temporary;
test.before(async()=>{
 temporary=await mkdtemp(join(tmpdir(),'oi-canvas-connectors-'));
 const out=join(temporary,'canvas-connectors.mjs');
 await build({
  stdin:{contents:"export * from './src/canvasConnectors.ts';export * from './src/researchMaterial.ts';",resolveDir:engine},
  tsconfig:join(engine,'tsconfig.json'),
  bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning',
 });
 api=await import(pathToFileURL(out));
});
test.after(()=>rm(temporary,{recursive:true,force:true}));

/** A working Scene with no occurrences; the connector write is the only writer under test. */
function blankScene(){return {entities:[{id:'a',name:'A',position:{x:0,y:0,z:0},size:{x:.6,y:.4},text:'',sequence:{steps:[]}}],research:api.emptyResearchMaterial()};}
const wire=scene=>JSON.parse(JSON.stringify(scene.research));
const refused=(value,pattern)=>assert.throws(()=>api.validateConnector(value),pattern,JSON.stringify(value));

test('kinds and sides are closed vocabularies', ()=>{
 assert.deepEqual([...api.CONNECTOR_KINDS],['straight','curved','elbow']);
 assert.deepEqual([...api.CONNECTOR_SIDES],['top','right','bottom','left']);
 for(const bad of ['arc','Elbow','',undefined,null,3]) assert.equal(api.isConnectorKind(bad),false,String(bad));
 for(const bad of ['middle','TOP','',undefined,null]) assert.equal(api.isConnectorSide(bad),false,String(bad));
});

test('a stored connector admits only its closed fields, with a bounded label', ()=>{
 api.validateConnector({kind:'straight'});
 api.validateConnector({kind:'elbow',label:'after review',fromSide:'bottom',toSide:'left'});
 api.validateConnector({kind:'curved',label:'x'.repeat(160)});
 refused({kind:'arc'},/Invalid connector kind/);
 refused({kind:'elbow',colour:'red'},/Unknown connector field/);
 refused({kind:'elbow',label:''},/Invalid connector label/);
 refused({kind:'elbow',label:'   '},/Invalid connector label/);
 refused({kind:'elbow',label:'x'.repeat(161)},/Invalid connector label/);
 refused({kind:'elbow',fromSide:'middle'},/Invalid connector side/);
 refused({kind:'elbow',toSide:3},/Invalid connector side/);
 refused(['elbow'],/Invalid connector/);
});

test('an owner edit is stored trimmed, capped, and absent when it is the default', ()=>{
 assert.equal(api.connectorRecord({kind:'curved'}),null,'curved with auto sides and no label is the absent default');
 assert.deepEqual(api.connectorRecord({kind:'straight'}),{kind:'straight'});
 assert.deepEqual(api.connectorRecord({kind:'elbow',label:'  check later  '}),{kind:'elbow',label:'check later'});
 assert.equal(api.connectorRecord({kind:'curved',label:''}),null,'an emptied label clears the record back to the default');
 assert.equal(api.connectorRecord({kind:'curved',label:'   '}),null);
 assert.equal(api.connectorRecord({kind:'curved',label:'y'.repeat(200)}).label.length,160);
 assert.deepEqual(api.connectorRecord({kind:'curved',fromSide:'top'}),{kind:'curved',fromSide:'top'});
});

test('a reconnect keeps the owner kind and label and takes the sides the handles now name', ()=>{
 const current={kind:'elbow',label:'after review'};
 assert.deepEqual(api.connectorWithSides(current,{fromSide:'right',toSide:'left'}),{kind:'elbow',label:'after review',fromSide:'right',toSide:'left'});
 assert.deepEqual(api.connectorWithSides(undefined,{toSide:'top'}),{kind:'curved',toSide:'top'});
 assert.equal(api.connectorWithSides(undefined,{}),null,'no side and default kind is the absent auto record');
});

test('a rendered handle id names its card side; anything else reads as auto', ()=>{
 assert.equal(api.sideFromHandleId('source-bottom','source'),'bottom');
 assert.equal(api.sideFromHandleId('target-left','target'),'left');
 assert.equal(api.sideFromHandleId('target-left','source'),undefined,'a target handle is not a source side');
 assert.equal(api.sideFromHandleId('source-middle','source'),undefined);
 assert.equal(api.sideFromHandleId(null,'source'),undefined);
 assert.equal(api.sideFromHandleId(undefined,'target'),undefined);
});

test('presentation: an absent record is today curved routing with no bound handles', ()=>{
 assert.deepEqual(api.connectorPresentation(undefined),{kind:'curved',label:undefined,sourceHandleId:undefined,targetHandleId:undefined});
 assert.deepEqual(api.connectorPresentation({kind:'elbow',label:'x',fromSide:'bottom',toSide:'top'}),{kind:'elbow',label:'x',sourceHandleId:'source-bottom',targetHandleId:'target-top'});
 assert.equal(api.connectorPresentation({kind:'straight',toSide:'left'}).sourceHandleId,undefined,'an unbound end stays on auto routing');
});

test('applyConnectorRecord writes one record per native edge id, and clears it to absence', ()=>{
 const scene=blankScene();
 const before=JSON.stringify(scene.entities);
 api.applyConnectorRecord(scene,'expr:relation:connection-1',{kind:'elbow',label:'after review',fromSide:'bottom'});
 assert.deepEqual(wire(scene).connectors,{'expr:relation:connection-1':{kind:'elbow',label:'after review',fromSide:'bottom'}});
 assert.equal(JSON.stringify(scene.entities),before,'the Expression and its occurrences are untouched');
 api.applyConnectorRecord(scene,'expr:relation:connection-1',null);
 assert.equal(wire(scene).connectors,undefined,'clearing the last record removes the map');
 assert.equal(JSON.stringify(scene.entities),before);
});

test('connector records survive serialize -> validate, and material saved before them still validates', ()=>{
 const scene=blankScene();
 api.applyConnectorRecord(scene,'e1',{kind:'straight'});
 api.applyConnectorRecord(scene,'e2',{kind:'curved',label:'owner words'});
 const saved=wire(scene);
 api.validateResearchMaterial(saved,new Set(['a']));
 assert.equal(Object.keys(saved.connectors).length,2);
 const legacy={schema:'oi.research-scene/v1',cards:{},strokes:[],views:{},timeline:{},frames:{},namedViews:{}};
 api.validateResearchMaterial(legacy,new Set());
});

test('the material admits no connector the closed record would refuse', ()=>{
 const scene=blankScene();
 assert.throws(()=>api.applyConnectorRecord(scene,'e1',{kind:'arc'}),/Invalid connector kind/);
 assert.throws(()=>api.applyConnectorRecord(scene,'',{kind:'straight'}),/Invalid connector edge/);
 assert.equal(scene.research.connectors,undefined,'a refused write leaves the Scene intact');
 const bad={schema:'oi.research-scene/v1',cards:{},strokes:[],views:{},timeline:{},connectors:{e:{kind:'elbow',label:''}}};
 assert.throws(()=>api.validateResearchMaterial(bad,new Set()),/Invalid connector label/);
});
