/** Product events disclose facts. Evidence wrappers describe how those facts were verified. */
import assert from 'node:assert/strict';
export function assertKernelReceipt(value){
 assert.equal(value?.schema,'oi.kernel-event/v1','foreign/missing kernel event schema');
 assert.equal(value.version,1,'unsupported kernel event version');
 assert.ok(Number.isSafeInteger(value.seq)&&value.seq>0,'event sequence must be a positive safe integer');
 assert.ok(typeof value.event==='string'&&/^[a-z][a-z0-9_]*$/.test(value.event),'event discriminant is required');
 return value;
}
export function assertKernelLog(receipts){let previous;for(const receipt of receipts){assertKernelReceipt(receipt);if(previous!==undefined)assert.equal(receipt.seq,previous+1,'event log repeats, reorders or gaps');previous=receipt.seq;}}
export function assertEvidence(value){
 assert.ok(typeof value.spec_ref==='string'&&value.spec_ref.trim(),'evidence requires its actual design source');
 assert.ok(['A','B','C','D'].includes(value.grade),'evidence requires an honest grade');
 if(/controlled|deterministic|fixture/i.test(`${value.standing??''} ${value.classification??''}`))assert.equal(value.grade,'D','deterministic or controlled evidence is grade D at most');
 if(Array.isArray(value.receipts)&&typeof value.classification==='string'&&(value.accepted===true||value.passed===true))assert.ok(value.receipts.some(r=>r.grade==='A'),'aggregate acceptance requires a native/live observation; green static checks alone are not acceptance');
}
