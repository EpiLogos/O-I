/** 02-ARCHITECTURE §5/§12: humans and agents cross the same typed native seam. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {read,root,registry,rustVariants,tsOps} from './source.mjs';
test('Lane A §3: Rust KernelOp wire discriminants exactly match the TS union',()=>{
 const rust=rustVariants(read('kernel/src/lib.rs'),'KernelOp'),typescript=tsOps();
 assert.ok(rust.length>0);assert.equal(new Set(typescript).size,typescript.length);assert.deepEqual(typescript,rust);
});
test('Lane A §3: every typed operation has individually named walk coverage or explicit unverified debt',()=>{
 const rows=registry('op-walk-coverage').operations;
 assert.deepEqual(rows.map(r=>r.op).sort(),tsOps());
 for(const row of rows){assert.ok(row.native_owner&&existsSync(join(root,row.native_owner)));assert.ok(row.spec_ref&&row.reason);assert.ok(['referenced','unverified'].includes(row.status));if(row.status==='referenced'){assert.ok(row.scenarios.length);for(const file of row.scenarios)assert.ok(existsSync(join(root,file)),`${row.op}: missing scenario ${file}`);}else assert.ok(row.owner_lane);}
});
test('variant parser ignores comments and nested request fields, preserves acronym and digit tags',()=>{
 assert.deepEqual(rustVariants('pub enum KernelOp { // IgnoreThis,\n State, A2aExchange { request: X }, NativeExpression { value: Option<X> }, }','KernelOp'),['a2a_exchange','native_expression','state']);
 assert.deepEqual(tsOps('export type KernelOp = {op:"state"} | {op:"native_expression";request:{operation:"open"}};'),['native_expression','state']);
});
