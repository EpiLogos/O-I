/** Lane-4 T23 — one identity across place and subject. Pure proof (no DOM):
 * the place lens names the reading's own subject, verbatim, and never mints
 * one. Loads `../src/placeReading.ts` through the same esbuild-in-tmp pattern
 * as place-reading.test.mjs.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-subject-'));
 try{
  const out=join(temporary,'places-subject-adapters.mjs');
  await build({
   stdin:{contents:"export * from './src/placeReading.ts';",resolveDir:engine},
   tsconfig:engine+'/tsconfig.json',
   bundle:true,
   platform:'node',
   format:'esm',
   outfile:out,
   logLevel:'warning',
  });
  api=await import(pathToFileURL(out));
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

test('T23: the place names its reading\'s own subject ref, verbatim', () => {
 const reading={subject:{subject_ref:'subject:pilgrim',native_owner:'wiki',kind:'person'}};
 assert.deepEqual(api.placeSubjectOf(reading),{subject_ref:'subject:pilgrim',kind:'person'});
});

test('T23: a subject without a disclosed kind keeps its ref and no kind is invented', () => {
 assert.deepEqual(api.placeSubjectOf({subject:{subject_ref:'subject:pilgrim',native_owner:'wiki'}}),{subject_ref:'subject:pilgrim',kind:null});
});

test('T23: a reading with no subject ref names no subject', () => {
 assert.equal(api.placeSubjectOf(null),null);
 assert.equal(api.placeSubjectOf({}),null);
 assert.equal(api.placeSubjectOf({subject:{subject_ref:'   ',native_owner:'wiki'}}),null);
});
