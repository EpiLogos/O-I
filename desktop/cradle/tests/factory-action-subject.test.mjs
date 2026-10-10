import test from 'node:test';
import assert from 'node:assert/strict';
import {actionSubjectReading, actionSubjectRefusal, mergeActionSubjectRead, sameActionTarget, FACTORY_ACTION_ADMISSION_MISSING} from '../src/contributions/factory/desk/runActionSubject.ts';

// Owner-contract value cases exercise the production join/validation. They
// are not native transport, admission, mutation or receipt evidence.
const target = {statePath:'/owned/factory.json', projectRef:'project:01ARZ3NDEKTSV4RRFFQ69G5FCA', runRef:'run:01ARZ3NDEKTSV4RRFFQ69G5FCB', actionRef:'action/request-evidence'};
const subjects = ['candidate:first', 'candidate:second'];
const listed = [{actionRef:target.actionRef,label:'Request evidence',subjectKinds:['candidate'],requiredCapabilityRef:'capability/request-evidence'}];
function run() {
  return {contract:'factory.run-reading/v1',projectRef:target.projectRef,runRef:target.runRef,revision:3,
    provenance:{owner:'factory',factoryStateRevision:7,subjectRevision:3,source:'canonical Factory Run/RunMap + Factory Build correlations'},
    candidates:[{candidateRef:subjects[0],label:'First return'},{candidateRef:subjects[1],label:'Second return'}],
    actions:[{...listed[0],authorityOwner:'factory',inputContract:'factory.action-projection/v1',resultContract:'factory.action-projection/v1',currentlyApplicable:true,applicableSubjectRefs:[...subjects]}]};
}
test('join uses exact owner subjects, capability and both native revisions',()=>{
  const reading=actionSubjectReading(target,listed,run());
  assert.deepEqual(reading.subjects,[{ref:subjects[0],label:'First return'},{ref:subjects[1],label:'Second return'}]);
  assert.equal(reading.factoryStateRevision,7); assert.equal(reading.runRevision,3);
  assert.equal(actionSubjectRefusal(reading,subjects[1]),undefined);
  assert.match(actionSubjectRefusal(reading,''),/Choose/);
  assert.match(actionSubjectRefusal(reading,'First return'),/no longer applicable/);
});
test('cross-owner/project/Run, unsupported contracts and disagreeing provenance refuse',()=>{
  for(const mutate of [r=>r.provenance.owner='central',r=>r.projectRef='project:another',r=>r.runRef='run:another',r=>r.contract='factory.build-view/v1',r=>r.actions[0].authorityOwner='central',r=>r.actions[0].inputContract='unknown',r=>r.provenance.subjectRevision=4,r=>r.provenance.factoryStateRevision=NaN]){
    const value=run();mutate(value);assert.throws(()=>actionSubjectReading(target,listed,value));
  }
});
test('action list mismatch, changed capability, duplicate identities and no applicability refuse',()=>{
  assert.throws(()=>actionSubjectReading(target,[],run()),/no longer uniquely/);
  assert.throws(()=>actionSubjectReading(target,[...listed,...listed],run()),/no longer uniquely/);
  assert.throws(()=>actionSubjectReading(target,[{...listed[0],requiredCapabilityRef:'capability:other'}],run()),/changed between/);
  for(const mutate of [r=>r.actions.push({...r.actions[0]}),r=>r.actions[0].applicableSubjectRefs.push(subjects[0]),r=>r.actions[0].currentlyApplicable=false,r=>r.actions[0].applicableSubjectRefs=[],r=>r.actions[0].applicableSubjectRefs=['']]){
    const value=run();mutate(value);assert.throws(()=>actionSubjectReading(target,listed,value));
  }
});
test('asynchronous read merge preserves uncommitted selection, even after owner removal',()=>{
  const previous=actionSubjectReading(target,listed,run());
  const draft=Object.freeze({target,label:'Request evidence',selected:subjects[1],reading:previous,error:'previous refusal'});
  const next=run();next.actions[0].applicableSubjectRefs=[subjects[0]];next.provenance.factoryStateRevision=8;
  const refreshed=mergeActionSubjectRead(draft,actionSubjectReading(target,listed,next));
  assert.equal(refreshed.selected,subjects[1]); assert.equal(refreshed.error,undefined);
  assert.equal(draft.error,'previous refusal');assert.equal(draft.reading.factoryStateRevision,7);
  assert.match(actionSubjectRefusal(refreshed.reading,refreshed.selected),/Choose explicitly/);
});
test('read merge rejects each captured target drift instead of binding another subject',()=>{
  const reading=actionSubjectReading(target,listed,run());
  for(const key of Object.keys(target)){
    const changed={...target,[key]:`${target[key]}:other`};
    assert.equal(sameActionTarget(target,changed),false);
    assert.throws(()=>mergeActionSubjectRead({target:changed,label:'Request evidence',selected:subjects[0]},reading),/another source/);
  }
});
test('missing native admission is precise and does not imply a successful receipt',()=>{
  assert.match(FACTORY_ACTION_ADMISSION_MISSING,/native desktop caller/);
  assert.match(FACTORY_ACTION_ADMISSION_MISSING,/authority\/capability grant/);
  assert.match(FACTORY_ACTION_ADMISSION_MISSING,/no request was sent/);
});
