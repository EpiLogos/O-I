/** Native-envelope, currentness and privacy regressions. No live person/model. */
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {modules} from './nara-personal-modules.mjs';
import {record,source,identityMaterialFixture,acceptedPattern} from './nara-personal-fixtures.mjs';
const {mod:m,dispose}=await modules();after(dispose);
const clone=structuredClone;
function sealed(){const r=record(),v=identityMaterialFixture(r);r.domain.identity.identity_hash_ref=clone(v.identity_hash_ref);v.sealed=true;return {r,v};}
test('unsealed native identity refuses presentation without invoking a hash algorithm',async()=>{const r=record();await assert.rejects(m.identityPattern(r,'cymatic',identityMaterialFixture(r)),/accept/);await assert.rejects(m.identityPattern(r,'cymatic'),/object/);});
for(const field of ['record_revision','identity_revision','event_ref','reception_generation']){
 test('native identity refuses stale '+field,()=>{const {r,v}=sealed();v[field]=typeof v[field]==='number'?v[field]+1:'changed';assert.throws(()=>m.readIdentityMaterial(v,r),/stale/);});
}
for(const field of ['nara_ref','subject_ref','record_ref']){
 test('identity cannot cross '+field,()=>{const {r,v}=sealed();v.target[field]='other';assert.throws(()=>m.readIdentityMaterial(v,r),/another/);});
}
test('native hash ref, receipt acceptance, source and quaternion remain distinct',()=>{for(const edit of [v=>v.identity_hash_ref.owner_ref='central',v=>v.identity_hash_ref.revision='other',v=>v.q_composed.w=2,v=>v.sealed=false,v=>v.source_revisions[0].revision='new',v=>v.m3_form_address_ref='invented']){const {r,v}=sealed();edit(v);assert.throws(()=>m.readIdentityMaterial(v,r));}});
test('minimal projection carries only the actual native digest, orientation and chosen form',async()=>{const {r,v}=sealed(),p=await m.identityPattern(r,'cymatic',v);assert.equal(p.fingerprint.value,v.value);assert.equal(p.schema,'oi.private-identity-presentation/v2');assert.deepEqual(Object.keys(p).sort(),['fingerprint','form','orientation','schema']);assert.ok(!JSON.stringify(p).includes('Control/user'));assert.ok(!JSON.stringify(p).includes(r.target.nara_ref));assert.throws(()=>m.validateIdentityPattern({...p,sources:v.source_revisions}));});
test('source-basis fingerprint from the old renderer cannot masquerade as native material',async()=>{const {r,v}=sealed(),p=await m.identityPattern(r,'cymatic',v);assert.throws(()=>m.validateIdentityPattern({...p,fingerprint:{...p.fingerprint,algorithm:'sha256-identity-source-basis/v1'}}));});
test('owner source addresses round-trip exactly and reject traversal or noncanonical spelling',()=>{assert.deepEqual(m.identitySourceLocation(source.location.ref),source.location);for(const ref of ['central:path:/test:Control/user/../other','central:path:/test:Control/user/%61bout.md','https://example.test/private','central:path:/test:Control/user/%FF','central:path:/test:Control/user/a%00.md'])assert.throws(()=>m.identitySourceLocation(ref));});
test('current identity sources are re-read but never rewritten or sent to QL',async()=>{const r=record(),calls=[];await m.verifyIdentitySources(r,async location=>{calls.push(location);return clone(source);});assert.deepEqual(calls,[source.location]);for(const altered of [{revision:'changed'},{location:{...source.location,ref:'other'}},{automatic_agent_or_model_invocation:true}])await assert.rejects(m.verifyIdentitySources(r,async()=>({...clone(source),...altered})),/changed/);await assert.rejects(m.verifyIdentitySources(r,async()=>{throw Error('Central withholds this source');}),/withholds/);});
test('end clears residual private particles before exposing the public engine',async()=>{
 const events=[],pub={scene:{id:'authored'},delta:0,params:{},camera:{},selectedIds:[],pointer:{active:false},simTime:1};
 const owner={render:f=>events.push(['render',f.scene.id]),command:c=>events.push(['command',c.type]),inspect:()=>({public:true}),dispose(){}};
 const port=m.privateIdentityEngine(owner,{canPresent:()=>true,requestFrame(){},onState:active=>events.push(['visible',active])});
 port.engine.render(pub);port.begin(await acceptedPattern(m,record(),'cymatic'));port.engine.render(pub);events.length=0;port.end();
 assert.deepEqual(events,[['render','authored'],['command','reset-field'],['render','authored'],['visible',false]]);assert.deepEqual(port.engine.inspect(),{public:true});
});
test('a failed physical reset keeps privacy protection instead of falsely reporting restoration',async()=>{
 const pub={scene:{id:'authored'},delta:0,params:{},camera:{},selectedIds:[],pointer:{active:false},simTime:1};
 const owner={render(){},command(){throw Error('GPU reset failed');},capture(){return 'must not escape';},inspect(){throw Error('must not inspect');},dispose(){}};
 const port=m.privateIdentityEngine(owner,{canPresent:()=>true,requestFrame(){}});port.engine.render(pub);port.begin(await acceptedPattern(m,record(),'cymatic'));port.engine.render(pub);
 assert.throws(()=>port.end(),/reset failed/);assert.equal(port.active,true);assert.throws(()=>port.engine.capture(),/Private identity/);assert.equal(port.engine.inspect().private,true);
});
