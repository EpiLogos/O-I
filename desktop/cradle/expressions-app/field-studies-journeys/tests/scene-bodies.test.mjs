import test from 'node:test';
import assert from 'node:assert/strict';
import {cacheKey,spanned,planBody,navigableTriggers} from '../build/sceneBodies.js';
import {validateSceneBody,validateSceneTriggers} from '../build/kernelDocumentBridge.js';

// ES1A/ES1B (O:I #352) — the active native Scene's own body/triggers,
// presented as real readable material. These tests cover the pure
// logic sceneBodies.ts exports for testing without a DOM (the module's
// installSceneBodies() itself renders into document.body and reads the
// kernel host channel; that overlay needs the browser/Playwright walk —
// see the walk steps in this worker's return).

const read=(ref,revision='r1')=>({ref,revision,availability:'available'});

function body(overrides={}){
 return validateSceneBody({carrier:'text_source',subject_ref:'Project/notes.md',native_owner:'oi',reading:read('Project/notes.md'),presentation:'inline',capability:{state:'renderable'},span:null,...overrides});
}

test('cacheKey changes with carrier, subject, revision and span — and only those',()=>{
 const a=body(),b=body({reading:read('Project/notes.md','r2')}),c=body({subject_ref:'Project/other.md'}),d=body({span:{start:0,end:5}});
 assert.notEqual(cacheKey(a),cacheKey(b));
 assert.notEqual(cacheKey(a),cacheKey(c));
 assert.notEqual(cacheKey(a),cacheKey(d));
 assert.equal(cacheKey(a),cacheKey(body())); // identical body, independently constructed
});

test('spanned honours code-point offsets and passes whole text through when absent',()=>{
 assert.equal(spanned('hello world',null),'hello world');
 assert.equal(spanned('hello world',{start:0,end:5}),'hello');
 assert.equal(spanned('hello world',{start:6,end:11}),'world');
 // Code-point aware: a span over an astral character does not split it.
 assert.equal(spanned('a🜁b',{start:0,end:2}),'a🜁');
});

test('planBody resolves the two admitted live carriers and degrades everything else honestly',()=>{
 assert.deepEqual(planBody(body({carrier:'text_source'})),{kind:'resolve'});
 assert.deepEqual(planBody(body({carrier:'image_media',reading:read('Project/art.png')})),{kind:'resolve'});
 assert.deepEqual(planBody(body({carrier:'file_thing',reading:read('Project/notes.pdf')})),{kind:'degraded',reason:'No live renderer for file_thing bodies here yet'});
 assert.deepEqual(planBody(body({carrier:'html_surface',reading:read('Project/page.html')})),{kind:'degraded',reason:'No live renderer for html_surface bodies here yet'});
});

test('planBody honours the body\'s own disclosed capability over the carrier default',()=>{
 assert.deepEqual(planBody(body({capability:{state:'degrades_to_thing',reason:'The reading is withheld'}})),{kind:'degraded',reason:'The reading is withheld'});
 assert.deepEqual(planBody(body({capability:{state:'unavailable',reason:'The native reading is currently unreachable'}})),{kind:'unavailable',reason:'The native reading is currently unreachable'});
});

test('navigableTriggers surfaces only Navigate triggers that name a scene, in declared order',()=>{
 const triggers=validateSceneTriggers([
  {trigger_ref:'t:1',occasion:'scene_enter',target:{kind:'navigate',scene_ref:'expression:x:scene:b'}},
  {trigger_ref:'t:2',occasion:'select',target:{kind:'expression_operation',operation:'inspect',expression_ref:'expression:x'}},
  {trigger_ref:'t:3',occasion:'activate',target:{kind:'navigate',entity_ref:'expression:x:entity:m0'}}, // no scene_ref — not navigable here
  {trigger_ref:'t:4',occasion:'activate',target:{kind:'navigate',scene_ref:'expression:x:scene:c'}},
 ]);
 assert.deepEqual(navigableTriggers(triggers),[
  {trigger_ref:'t:1',occasion:'scene_enter',scene_ref:'expression:x:scene:b'},
  {trigger_ref:'t:4',occasion:'activate',scene_ref:'expression:x:scene:c'},
 ]);
});

test('an engine_composition body plans nothing renderable here — it is the live field itself, handled by refresh() hiding the overlay',()=>{
 // engine_composition bodies are refused a presentation other than live and
 // are never passed to planBody by refresh(); confirm the kernel-exact
 // validator still accepts the one shape refresh() short-circuits on.
 const engine=validateSceneBody({carrier:'engine_composition',subject_ref:'expression:x',native_owner:'oi',reading:read('expression:x'),presentation:'live',capability:{state:'renderable'},span:null});
 assert.equal(engine.carrier,'engine_composition');
});
