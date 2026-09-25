/** 02-ARCHITECTURE §6: owner truth, retained resources and presentation are distinct. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {files,registry,storageSites,storageReferences,keyLiterals,law} from './source.mjs';
const declared=registry('state-registry');
test(`${law}: every browser-storage entry point and key is explicitly classified`,()=>{
 const actual=files('src',/\.(?:ts|tsx|mjs)$/).map(owner=>({owner,references:storageReferences(owner),sites:storageSites(owner)})).filter(r=>r.references.length||r.sites.length);
 assert.deepEqual(actual.map(r=>r.owner),declared.owners.map(r=>r.owner),'new storage owner needs explicit source-derived classification; no auto-baseline');
 for(const row of actual){const entry=declared.owners.find(x=>x.owner===row.owner);assert.deepEqual(row.references,entry.references,row.owner);assert.deepEqual(row.sites,entry.sites,`${row.owner}: undeclared access/key or changed key generator`);assert.deepEqual(keyLiterals(row.owner),entry.key_literals,`${row.owner}: changed key family`);assert.ok(entry.rationale&&entry.spec_ref);for(const key of entry.keys){assert.ok(['presentation-local','device-draft','forbidden-semantic'].includes(key.classification));assert.ok(key.family&&key.rationale);if(key.classification==='forbidden-semantic')assert.ok(key.debt_id&&registry('violation-baseline').debts.some(d=>d.id===key.debt_id));}}
 for(const input of declared.indirect_key_sources)assert.deepEqual(keyLiterals(input.owner),input.key_literals,`${input.owner}: imported/caller-supplied storage key changed`);
});
test('storage scan includes aliases, bracket methods and keys changed behind constants',()=>{
 const original='const KEY="oi.test.v1"; const s=window.localStorage; s["setItem"](KEY,"held");';
 const next=original.replace('oi.test.v1','oi.undeclared.v1');
 assert.notDeepEqual(storageSites('probe.ts',original),storageSites('probe.ts',next));
 assert.deepEqual(storageReferences('probe.ts',original),['localStorage']);
 assert.equal(storageSites('probe.ts','const x=new Map(); x.clear();').length,0,'Map.clear is not browser storage');
});
