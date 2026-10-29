import test from 'node:test';
import assert from 'node:assert/strict';
import {isGenuineWorkspaceSwitch,captureNativeAdoption} from '../build/nativeWorkspace.js';

// Regression for: on Technē boot, nativeWorkspace's own `changed()` boot
// association (app.ts calling it once with the already-showing document) was
// indistinguishable from a real later journey switch — both bumped the same
// generation counter used to guard adoption of a native "Open file" reply.
// A native open captured (captureNativeAdoption) just before boot's own
// `changed()` settled was then refused with "The working draft changed while
// opening", even though nothing the person did was an edit — only boot's own
// bookkeeping had run. isGenuineWorkspaceSwitch must say "no" on its own
// first call for a workspace and "yes" on every call after that.

test('a workspace\'s own first changed() call is boot association, not a genuine switch',()=>{
 const state={booted:false};
 assert.equal(isGenuineWorkspaceSwitch(state),false,'the first call must not read as a genuine switch');
 assert.equal(state.booted,true);
 assert.equal(isGenuineWorkspaceSwitch(state),true,'a later call is a real switch and must invalidate in-flight opens');
 assert.equal(isGenuineWorkspaceSwitch(state),true,'every call after the first stays a genuine switch');
});

test('a native open captured before boot settles survives boot\'s own association',()=>{
 // Mirrors nativeWorkspace.changed(): restoreGeneration only advances on a
 // genuine switch, gated by isGenuineWorkspaceSwitch — this is the exact
 // sequencing that produced the reported refusal before the fix.
 let restoreGeneration=0;
 const bootState={booted:false};
 const document={id:'source-twelve-faces'};
 const host={snapshot:()=>({journey:document,sceneId:'scene',entityId:null}),version:()=>0};
 const changed=()=>{if(isGenuineWorkspaceSwitch(bootState))restoreGeneration++;};
 // The person (or a test) clicks "Open file" and its adoption token is
 // captured while boot's own async `changed()` call is still in flight.
 const adoption=captureNativeAdoption(host,()=>restoreGeneration);
 changed(); // app.ts's boot-time `await nativeWorkspace?.changed(store.document)` resolves
 assert.equal(adoption(),true,'an untouched boot canvas must not invalidate a concurrently captured native open');
 // A genuine later switch (the person opens a different local journey) must
 // still invalidate any in-flight adoption token — the guard is not weakened.
 changed();
 assert.equal(adoption(),false,'a real journey switch after boot must still refuse a now-stale adoption');
});

// O-I #763: leaving a local draft for another work keeps it as a work in its folder only when it was edited since it was opened
// (the workspace side, run unchanged, is packages/expressions-boundary/tests/opened-work-recovery.test.mjs). app.ts is a DOM entry
// that cannot load under node: its wiring is read from the source (code-reading).
test('code-reading: the app tells the workspace whether the local draft standing in the frame was edited since it was opened',async()=>{
 const fs=await import('node:fs');
 const app=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
 assert.match(app,/localDraftEdited:\(\)=>store\.revision!==localOpenedRevision,/,'the workspace is told by the store\'s revision since the open');
 const apply=app.slice(app.indexOf('function applyJourney('),app.indexOf('\n',app.indexOf('function applyJourney(')));
 assert.match(apply,/if\(!native\)localOpenedRevision=store\.revision;markSaved\(\);renderAll\(\);\}$/,'a local open records where its edits begin, after the open itself');
 assert.match(app,/let localOpenedRevision=0;/,'the opening canvas begins unedited');
});

// O-I #763: a draft kept as a work is linked from its Library copy, so reopening the copy opens the work (libraryStore.ts linkLibraryCopy, run
// in library-origin.test.mjs), and the host is asked to list its works again, so the browser shows the kept work at once (the panel's
// works-changed answer, packages/live-shell/ui/tests/expressions-opened-recovery.test.mjs). The workspace side runs unchanged in
// packages/expressions-boundary/tests/opened-work-recovery.test.mjs; app.ts's wiring is read from the source (code-reading).
test('code-reading: a draft kept as a work links its Library copy to the work and asks the host to list its works again',async()=>{
 const fs=await import('node:fs');
 const app=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
 const port=app.slice(app.indexOf('keptAsWork:'),app.indexOf('\n',app.indexOf('keptAsWork:')));
 assert.match(port,/linkLibraryCopy\(journey,\{ref:kept\.expression_ref,title:kept\.title,at:new Date\(\)\.toISOString\(\)\}\)/,'the Library copy records the work');
 assert.match(port,/hostRequest\(\{request:'works-changed'\}\)/,'the host lists its works again');
 assert.ok(port.indexOf('linkLibraryCopy(')<port.indexOf("hostRequest({request:'works-changed'})"),'the link is recorded before the host lists');
});
