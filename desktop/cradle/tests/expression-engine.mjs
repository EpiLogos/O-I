import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {expressionConfig}=await server.ssrLoadModule('/src/expression/engineProjection.ts');
 const {nativeSnapshotToJourney,nativeExport}=await server.ssrLoadModule('../../packages/oi-design-system/expressions-engine/shell/nativeBridge.mjs');
 const d={schema:'oi.expression/v1',expression_ref:'expression:test',revision:3,title:'Test',scenes:[{scene_ref:'expression:test:scene:main',revision:3,title:'Main',entity_refs:['expression:test:entity:a','expression:test:entity:b']}],selection:{scene_ref:'expression:test:scene:main',entity_ref:'expression:test:entity:a'},entities:{'expression:test:entity:a':{entity_ref:'expression:test:entity:a',revision:3,title:'A',parameters:{glyph:{value:'EX1',automation:null},x:{value:-100,automation:null},scale:{value:1,automation:{min:0.5,max:1.5,rate_hz:0.2,waveform:'sine'}}}},'expression:test:entity:b':{entity_ref:'expression:test:entity:b',revision:3,title:'B',parameters:{glyph:{value:'B',automation:null},x:{value:100,automation:null}}}}};
 const material=expressionConfig(d);
 const restored=nativeExport(nativeSnapshotToJourney({config:material}).scenes[0]).config;
 assert.equal(restored.entities[0].id,'expression:test:entity:a');
 assert.equal(restored.entities[0].shape.text,'EX1');
 assert.equal(restored.entities[0].x,-100);
 assert.equal(restored.entities[1].id,'expression:test:entity:b');
 assert.equal(restored.automations[0].enabled,true);
 assert.equal(restored.automations[0].path,'entities.0.scale');
 assert.equal(restored.automations[0].rateHz,0.2);
 d.scenes[0].entity_refs.reverse();
 const reversed=nativeExport(nativeSnapshotToJourney({config:expressionConfig(d)}).scenes[0]).config;
 assert.equal(reversed.automations[0].path,'entities.1.scale');
 assert.equal(reversed.entities[1].id,'expression:test:entity:a');
 assert.equal(reversed.entities[1].shape.text,'EX1');
 console.log('Expression projection: 10 native engine round-trip assertions passed');
} finally {await server.close();}
