/** Canonical Lane A §4; 02-ARCHITECTURE §5; DESKTOP-LANGUAGE ruling 8. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {read,files,rustCode} from './source.mjs';
import {assertKernelReceipt,assertKernelLog,assertEvidence} from './receipt-law.mjs';
import {aggregateVerdict} from '../verify-shell-evidence.mjs';
test('native receipt and TypeScript envelope declare the same required fields without conflating evidence metadata',()=>{
 const rust=rustCode(read('kernel/src/events.rs')),typescript=read('src/kernel/types.ts');
 assert.match(rust,/struct KernelEventReceipt\s*\{\s*pub seq: u64,/);assert.match(rust,/pub envelope: KernelEventEnvelope/);assert.match(rust,/struct KernelEventEnvelope\s*\{\s*pub schema: String,\s*pub version: u32,/);assert.match(rust,/pub event: KernelEvent/);
 const envelope=typescript.match(/interface KernelReceipt\s*\{([^}]*)\}/)?.[1];assert.ok(envelope);for(const [field,type]of[['seq','number'],['schema','string'],['version','number'],['event','string']])assert.match(envelope,new RegExp(`\\b${field}: ${type}\\b`));
});
test('retained native event observations obey schema, version, discriminant and order',()=>{
 let observed=0;for(const file of files('walk/artifacts',/\.json$/)){let value;try{value=JSON.parse(read(file));}catch{continue;}const visit=node=>{if(!node||typeof node!=='object')return;if(node.schema==='oi.kernel-event/v1'){assertKernelReceipt(node);observed++;}for(const child of Object.values(node))if(child&&typeof child==='object')visit(child);};visit(value);}assert.ok(observed>0,'must inspect actual retained event observations, not solely invented validator input');
});
test('receipt validators refuse missing fields, sequence corruption and promoted controlled evidence',()=>{
 // Parser adversarial inputs only; these are never represented as runtime observations.
 const valid={schema:'oi.kernel-event/v1',version:1,seq:1,event:'surface_changed'};
 for(const field of ['schema','version','seq','event']){const broken={...valid};delete broken[field];assert.throws(()=>assertKernelReceipt(broken));}
 assert.throws(()=>assertKernelLog([valid,{...valid,seq:3}]));assert.throws(()=>assertKernelLog([valid,valid]));
 assert.throws(()=>assertEvidence({spec_ref:'02-ARCHITECTURE §5',grade:'A',standing:'deterministic native protocol campaign'}));
 assert.throws(()=>assertEvidence({spec_ref:'02-ARCHITECTURE §5',grade:'C',classification:'static',passed:true,receipts:[{grade:'C'}]}));
 assert.deepEqual(aggregateVerdict([{name:'static',grade:'C'}]),{grade:'C',accepted:false});
});
