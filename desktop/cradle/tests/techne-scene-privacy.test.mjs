/** Real outward filter, planted sentinel fixture: local full Scene carriers and
 * recovery do not become shareable merely because native persistence supports
 * them. This does not claim rich-scene publication fidelity or live hosting. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {projectExpression,expressionPublicationLeaks,expressionPublicationPayloads} from '../../../shared-field/expression-projection.mjs';
test('private draft and saved Scene data never enter outward hosted payloads',()=>{
 const ref='expression:privacy-proof',sentinels=['PRIVATE_CURRENT_SCENE','PRIVATE_SAVED_SCENE','PRIVATE_WHOLE_SETTINGS','PRIVATE_RECOVERY_INTENT'];
 const doc={schema:'oi.expression/v1',expression_ref:ref,revision:3,title:'Deliberate outward title',
  scenes:[{scene_ref:ref+':scene:main',revision:2,title:'Public scene name',entity_refs:[],
   presentation:{schema:'oi.journey-scene/v1',scene:{text:[{body:sentinels[0]}]},saved:{text:[{body:sentinels[1]}]}}}],
  entities:{},relations:{},selection:{scene_ref:ref+':scene:main',entity_ref:null},provenance:[],representations:[],
  presentation:{schema:'oi.journey-properties/v1',description:sentinels[2],loop:true},
  nativeWorking:{pending:{input:sentinels[3]}}};
 const before=structuredClone(doc),bundle=projectExpression({document:doc,
  selection:{scene_refs:[ref+':scene:main'],summary:'A bounded public presentation.'},
  publisher:{participant_ref:'human:fixture',identity_ref:'human:fixture:owner',chosen_name:'Fixture'},
  audience:{visibility:'public'},projection_ref:'projection:fixture:scene',published_at:'2026-09-21T00:00:00Z'});
 assert.deepEqual(expressionPublicationLeaks(bundle,sentinels),[]);
 const outward=JSON.stringify(expressionPublicationPayloads(bundle));
 assert.ok(!outward.includes('oi.journey-scene/v1'));
 assert.ok(!outward.includes('nativeWorking'));
 assert.deepEqual(doc,before,'projection must not strip private material from the local source');
});
