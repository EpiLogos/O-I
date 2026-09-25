import test from 'node:test';
import assert from 'node:assert/strict';
import {settingsProducts} from '../src/workspace/settings/settingsProducts.ts';
import {restoreSettingsPlace,placeLabel} from '../src/workspace/settings/settingsNav.ts';
import {searchIndex,searchSettings} from '../src/workspace/settings/settingsSearch.ts';
import {modelRosterReason,readModelRoster} from '../src/agent/chat/modelRoster.ts';

// The canonical L6 test explicitly injects a seventh owner. This exercises
// production discovery, routing and search; it is not native availability evidence.
test('a seventh owner enters Settings navigation and search without a product constant',()=>{
 const ids=['oi','central','ai-kit','actuation','workcell','software-factory','seventh-owner'];
 const snapshot={census:{state:'ok',value:{positions:ids.map(product_id=>({product_id}))}},registry:{state:'ok',value:{mounts:[],entries:[],index:{}}},owners:{state:'ok',value:{}},suite:{state:'reading'},credentials:{state:'reading'}};
 const rows=settingsProducts(snapshot);
 assert.equal(rows.length,7);assert.deepEqual(rows.at(-1),{id:'seventh-owner',label:'Seventh owner'});
 assert.deepEqual(restoreSettingsPlace({kind:'product',id:'seventh-owner'}),{kind:'product',id:'seventh-owner'});
 assert.equal(placeLabel({kind:'product',id:'seventh-owner'}),'Seventh owner');
 const found=searchSettings(searchIndex(snapshot),'seventh');
 assert.equal(found.length,1);assert.deepEqual(found[0].place,{kind:'product',id:'seventh-owner'});
 snapshot.census={state:'failed',error:'offline'};snapshot.registry.value.mounts=[{owner_ref:'seventh-owner'}];
 assert.deepEqual(settingsProducts(snapshot),[{id:'seventh-owner',label:'Seventh owner'}]);
});

test('model eligibility only joins exact native provider/model/harness coordinates',()=>{
 const option={modelId:'opaque',name:'Live model',rosterIdentity:{provider_ref:'provider:zai',provider_native_id:'glm',harness_slug:'pi'}};
 const reading=readModelRoster({schema:'aikit.model-roster-reading/v1',route_facts:[{model:'model:glm',provider:'provider:zai',variant:'glm',harness:'pi',availability:{state:'observed'}}],roster:{entries:[{model:'model:glm',provider:'provider:zai',variant:'glm',explanation:{eligible:false,failed_gates:['harness-compatible']}}]}});
 assert.equal(modelRosterReason(option,reading),'Harness does not support this provider');
 assert.equal(modelRosterReason({...option,rosterIdentity:undefined},reading),undefined);
 for(const key of ['provider_ref','provider_native_id','harness_slug']) assert.equal(modelRosterReason({...option,rosterIdentity:{...option.rosterIdentity,[key]:'different'}},reading),undefined);
 reading.route_facts.push({...reading.route_facts[0]});assert.equal(modelRosterReason(option,reading),undefined,'an ambiguous join supplies no verdict');
 assert.equal(readModelRoster({schema:'other',roster:{entries:[]},route_facts:[]}),undefined);
});
