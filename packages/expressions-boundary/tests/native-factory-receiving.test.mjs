/** Production scope and closed-owner checks. No successful native reply,
 * authorization, artifact path or verification result is manufactured. */
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-production-sources.mjs';
const [{factoryScopeRefusal,captureFactoryReceiver},{workbenchContextScope},{factoryOwner},{buildSnapshot}]=await Promise.all([
  import('../../../desktop/cradle/src/contributions/factory/receivingScope.ts'),
  import('../../live-shell/ui/src/native/workbenchContext.ts'),
  import('../../../desktop/cradle/src/contributions/factory/desk/factoryReads.ts'),
  import('../../../desktop/cradle/src/contributions/factory/development.ts'),
]);
const closed={kind:'unavailable',reason:'Factory source verification owner is closed.'};
test('explicit hosted Factory scope refuses local work without treating its conversation as local',()=>{
  assert.match(factoryScopeRefusal({project:'O-I',sourceWorldRef:'world:retained'}),/qualified Factory/);
  assert.match(factoryScopeRefusal({project:'O-I',sourceWorldRef:''}),/qualified Factory/);
  assert.equal(factoryScopeRefusal({project:'O-I',current:()=>true}),undefined);
  assert.equal(factoryScopeRefusal({unavailable:'Actual retained-binding refusal'}),'Actual retained-binding refusal');
});
test('Factory receiving capture retires exact scope, presentation and live gate changes',()=>{
  let scope={project:'O-I',current:()=>true},visible=true;
  const current=captureFactoryReceiver(()=>scope,()=>visible);
  assert.equal(current(),true);scope={...scope};assert.equal(current(),true);
  for(const changed of [{project:'another'},{sourceWorldRef:'world:another'},{unavailable:'missing binding'},{current:()=>false}]){
    scope={project:'O-I',current:()=>true,...changed};assert.equal(current(),false);
  }
  scope={project:'O-I',current:()=>true};visible=false;assert.equal(current(),false);
});
test('a new wrapper cannot revive the captured owner epoch even at the same Project',()=>{
  let originalAlive=true;
  let scope={project:'O-I',current:()=>originalAlive};
  const current=captureFactoryReceiver(()=>scope,()=>true);
  scope={project:'O-I',current:()=>true};assert.equal(current(),true);
  originalAlive=false;assert.equal(current(),false);
});
test('orphan accompanying cannot invent local provenance; exact retained local binding qualifies only that destination',()=>{
  const accompanying={project:'O-I',ref:'agent-session/retained',space:'session-space/retained'};
  const layout={surfaces:{},accompanying};
  assert.throws(()=>workbenchContextScope(layout,'workspace:retained',4,'O-I'),/no retained native owner binding/);
  assert.throws(()=>workbenchContextScope(layout,'workspace:retained',4,'O-I','world:explicit'),/no retained native owner binding/);
  layout.surfaces.held={id:'held',kind:'encounter',ref:accompanying.ref,project:'O-I',encounter:{space:accompanying.space}};
  const scope=workbenchContextScope(layout,'workspace:retained',4,'O-I');
  assert.equal(scope.sourceWorldRef,undefined);assert.deepEqual(scope.accompanying,accompanying);
  assert.throws(()=>workbenchContextScope(layout,'workspace:retained',4,'O-I','world:explicit'),/conflicting/);
  layout.surfaces.held.encounter.space='session-space/foreign';
  assert.throws(()=>workbenchContextScope(layout,'workspace:retained',4,'O-I'),/no retained/);
});
test('hosted binding requires actual World disclosure and conflicting retained provenance refuses',()=>{
  const accompanying={project:'O-I',ref:'agent-session/retained',space:'session-space/retained'};
  const binding={id:'held',kind:'encounter',ref:accompanying.ref,project:'O-I',encounter:{space:accompanying.space},hosted:{}};
  const layout={surfaces:{held:binding},accompanying};
  assert.throws(()=>workbenchContextScope(layout,'workspace:retained',4,'O-I'),/no disclosed native World/);
  binding.view={sourceWorldRef:'world:actual-retained'};
  const scope=workbenchContextScope(layout,'workspace:retained',4,'O-I');
  assert.equal(scope.sourceWorldRef,binding.view.sourceWorldRef);
  assert.match(factoryScopeRefusal(scope),/qualified Factory/);
  assert.throws(()=>workbenchContextScope(layout,'workspace:retained',4,'O-I','world:foreign'),/conflicting/);
  layout.surfaces.local={...binding,id:'local',hosted:undefined,view:undefined};
  assert.throws(()=>workbenchContextScope(layout,'workspace:retained',4,'O-I'),/conflicting/);
});
test('actual Factory read clients preserve real owner refusal, without successful action or artifact substitution',async()=>{
  for(const request of [{kind:'locate',project:'O-I'},{kind:'attempt-return',state_path:'retained-source',run_ref:'retained-run',attempt_ref:'retained-attempt'},{kind:'action-list',state_path:'retained-source',project_ref:'retained-project',run_ref:'retained-run'}])
    await assert.rejects(factoryOwner(closed,request),/Factory source verification owner is closed/);
  await assert.rejects(buildSnapshot(closed,'retained-source','retained-project','retained-run'),/Factory source verification owner is closed/);
});
