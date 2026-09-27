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
