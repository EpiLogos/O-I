// O-I #747 round 893, XS09 and XS10 (manual §20.1 The Launch panel: a scene's triggers, Occasion "Scene enters · Scene leaves · Activated ·
// Selected · Sequence moves on", "When a trigger runs"; Target "What a trigger does"). DLW build ruling 2026-11-07: each runs on every
// occasion the manual lists, and its target acts the same whatever the occasion; a Jump is a launch of its scene at that scene's Quantize;
// one launch's chain of triggered jumps enters each scene at most once, and a jump the chain already entered is not run and is said.
// Round 892 kept and listed every trigger, but only "Scene leaves → Jump" acted (the follow action, XS07).
// SCRIPTED: the frame's sources bundled with the app's esbuild — the trigger runner over a recording runtime that lands each launch at
// once, as a launch with nothing playing lands; the retained editor's scene focus. CODE-READING: app.ts gives the runner its transport.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const journeys = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'triggers-893-'));
after(() => rmSync(out, {recursive: true, force: true}));
const bundle = async (entry, name) => {
  const outfile = join(out, `${name}.mjs`);
  await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
    loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}});
  return import(pathToFileURL(outfile).href);
};
const triggers = await bundle(join(journeys, 'src/sceneTriggers.ts'), 'sceneTriggers');
const {kernelDocumentToJourney} = await bundle(join(journeys, 'src/kernelDocumentBridge.ts'), 'bridge');
const model = await bundle(join(journeys, 'src/model.ts'), 'model');
const {DocumentStore} = await bundle(join(journeys, 'src/store.ts'), 'store');
const {createRetainedNativeEditor} = await bundle(join(journeys, 'src/hostEditor.ts'), 'hostEditor');
const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8');

const E = 'expression:triggers-893';
const S = n => `${E}:scene:s${n}`;
const NAMES = ['Dawn', 'Noon', 'Dusk'];
let serial = 0;
const jump = (occasion, to) => ({trigger_ref: `${E}:trigger:t${++serial}`, occasion, target: {kind: 'navigate', scene_ref: S(to), entity_ref: null}});
const portal = occasion => ({trigger_ref: `${E}:trigger:p${++serial}`, occasion, target: {kind: 'portal', placement: 'beside', subject_ref: 'wiki:node:central'}});
const read = (occasion, operation) => ({trigger_ref: `${E}:trigger:r${++serial}`, occasion, target: {kind: 'expression_operation', operation, expression_ref: E}});
/** Dawn, Noon and Dusk (frame ids s1–s3), each with the triggers given for it. */
function world(kept = {}) {
  const scenes = NAMES.map((name, i) => {
    const scene = model.blankScene(name); scene.id = S(i + 1); scene.duration = 6;
    return {scene_ref: scene.id, revision: 1, title: name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}, ...(kept[i + 1] ? {triggers: kept[i + 1]} : {})};
  });
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 4, title: 'Triggers', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []});
}
/** A runtime that records what the triggers do; a launch lands at once (nothing plays), over the scene that plays. */
function runtime(view) {
  const r = {did: [], playing: null}
  r.rt = {journey: () => view.journey, view: () => view,
    place: (sceneId, chain) => { r.did.push(['land', name(sceneId)]); const outgoing = r.playing; r.playing = sceneId; triggers.launchLanded(r.rt, sceneId, chain, outgoing) },
    portal: (ref, sceneId, said) => r.did.push(['portal', name(sceneId), said]),
    read: act => r.did.push(['read', act.operation, act.said]),
    say: text => r.did.push(['say', text])}
  const name = id => NAMES[Number(id.slice(-1)) - 1]
  return r
}

test('XS09: one launch\'s chain enters each scene at most once; a jump to a scene it entered is not run, and the Info line says so', () => {
  const view = world({3: [jump('scene_enter', 1)], 1: [jump('scene_enter', 2)], 2: [jump('scene_enter', 1)]})
  const r = runtime(view)
  triggers.pressLaunch(r.rt, S(3))
  assert.deepEqual(r.did, [['land', 'Dusk'], ['land', 'Dawn'], ['land', 'Noon'],
    ['say', 'Noon enters → Dawn was not run: Dawn was already entered in this chain.']])
  // A new press is a new chain: Dawn enters again.
  r.did.length = 0
  triggers.pressLaunch(r.rt, S(1))
  assert.deepEqual(r.did, [['land', 'Dawn'], ['land', 'Noon'], ['say', 'Noon enters → Dawn was not run: Dawn was already entered in this chain.']])
  // A scene that jumps to itself on entering has entered already.
  const self = runtime(world({1: [jump('scene_enter', 1)]}))
  triggers.pressLaunch(self.rt, S(1))
  assert.deepEqual(self.did, [['land', 'Dawn'], ['say', 'Dawn enters → Dawn was not run: Dawn was already entered in this chain.']])
})

test('XS09 and XS10: the target acts the same whatever the occasion — a Jump launches, a portal is asked of the host, a read is read', () => {
  for (const occasion of ['scene_enter', 'scene_leave', 'activate', 'select', 'sequence_transition']) {
    const view = world({2: [jump(occasion, 3), portal(occasion), read(occasion, 'inspect')]})
    const acts = triggers.planTriggers(view.journey, view, S(2), occasion, triggers.newTriggerChain())
    const verb = triggers.OCCASION_SAID[occasion]
    assert.deepEqual(acts.map(act => [act.kind, act.said ?? act.text]), [['launch', `Noon ${verb} → Dusk`], ['portal', `Noon ${verb} → a portal beside`], ['read', `Noon ${verb}`]], occasion)
    assert.deepEqual(triggers.planTriggers(view.journey, view, S(2), occasion === 'select' ? 'activate' : 'select', triggers.newTriggerChain()), [], 'another occasion runs none of them')
  }
  // A native Action is said, never run; a jump whose scene is gone is said.
  const view = world({1: [{trigger_ref: `${E}:trigger:n`, occasion: 'scene_enter', target: {kind: 'native_action', action_ref: 'action:x', target_ref: 'thing:y', authority_requirement: 'human'}},
    {trigger_ref: `${E}:trigger:g`, occasion: 'scene_enter', target: {kind: 'navigate', scene_ref: `${E}:scene:gone`, entity_ref: null}}]})
  assert.deepEqual(triggers.planTriggers(view.journey, view, S(1), 'scene_enter', triggers.newTriggerChain()).map(act => act.text), [
    'Dawn enters → a native Action was not run: a scene\'s trigger does not run native Actions here.',
    'Dawn enters → its scene was not run: the scene it jumps to is no longer in this Expression.'])
})

test('XS09: Activated runs before the press\'s launch lands, and its Jump takes the press\'s place; a launch over a scene makes it leave', () => {
  const view = world({3: [portal('activate'), jump('activate', 1)], 1: [portal('scene_enter')]})
  const r = runtime(view)
  triggers.pressLaunch(r.rt, S(3))
  assert.deepEqual(r.did, [['portal', 'Dusk', 'Dusk is activated → a portal beside'], ['land', 'Dawn'], ['portal', 'Dawn', 'Dawn enters → a portal beside']])
  // Leaving: a launch lands over Noon. Its portal opens; its Jump is its follow action's, which comes only where Noon ends of itself.
  const leaving = world({2: [jump('scene_leave', 3), portal('scene_leave')]})
  const l = runtime(leaving); l.playing = S(2)
  triggers.pressLaunch(l.rt, S(1))
  assert.deepEqual(l.did, [['land', 'Dawn'], ['portal', 'Noon', 'Noon leaves → a portal beside']])
})

test('XS09: where the follow action takes the sequence on, the scene leaves and moves on and the next enters; where it only ends, it leaves', () => {
  const view = world({1: [portal('scene_leave'), jump('sequence_transition', 2), jump('scene_leave', 3)], 2: [read('scene_enter', 'list')]})
  const r = runtime(view); r.playing = S(2)
  triggers.followLanded(r.rt, S(1), S(2))
  assert.deepEqual(r.did, [['portal', 'Dawn', 'Dawn leaves → a portal beside'],
    ['say', 'Dawn moves on → Noon was not run: Noon was already entered in this chain.'], ['read', 'list', 'Noon enters']])
  r.did.length = 0
  triggers.sceneStopped(r.rt, S(1))
  assert.deepEqual(r.did, [['portal', 'Dawn', 'Dawn leaves → a portal beside']])
})

test('a read trigger says what it read in one line', () => {
  assert.equal(triggers.readSaid('Dawn enters', 'inspect', {state: 'ready', document: {title: 'Of Central', scenes: [{}], revision: 4}}), 'Dawn enters → Of Central: 1 scene, revision 4.')
  assert.equal(triggers.readSaid('Dawn enters', 'export', {state: 'exported', document: {title: 'Of Central', scenes: [{}, {}], revision: 4}}), 'Dawn enters → Of Central exported for reading here: 2 scenes.')
  assert.equal(triggers.readSaid('Dawn enters', 'list', {expressions: [{}, {}, {}]}), 'Dawn enters → 3 Expressions listed.')
  assert.equal(triggers.readSaid('Dawn enters', 'inspect', {state: 'rejected', message: 'Unknown Expression'}), 'Dawn enters → the Expression could not be read: Unknown Expression')
})

test('Selected: the scene the Session or the Arrangement selects is focused, then its triggers run; a launch is no selection', async () => {
  const view = world()
  const store = new DocumentStore(view.journey), calls = [], blocked = () => { throw Error('This test does not dispatch that effect') }
  const playback = {scene_ref: S(1), scene_elapsed_seconds: 0, expression_time_seconds: 0, scene_playing: false, saved_sequence_playing: false, field_paused: false, track_preview: false, intent_epoch: 0}
  const receiver = createRetainedNativeEditor({store, sceneId: () => S(1), selection: () => ({entity_ids: [], step_id: null}), nativeView: () => view,
    nativeSelect: async id => { view.document.selection = {scene_ref: id, entity_ref: null}; view.document.revision++; return 'applied' }, commit: blocked, change: (label, mutate) => store.change(label, mutate),
    afterHistory: blocked, selectLocal: blocked, openEditor: blocked, standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false,
    sceneControls: {read: () => playback, recording: () => false, transitionPending: () => false, focus: id => calls.push(['focus', id]), launch: id => calls.push(['launch', id]),
      selected: id => calls.push(['selected', id]), transport: action => calls.push(['transport', action]), seek: blocked, snapshot: blocked}})
  await receiver.scene({operation: 'scene', basis: receiver.read().basis, action: 'focus', scene_ref: S(2), intent_epoch: 0})
  await receiver.scene({operation: 'scene', basis: receiver.read().basis, action: 'play-scene', scene_ref: S(3), intent_epoch: 0})
  assert.deepEqual(calls, [['focus', S(2)], ['selected', S(2)], ['launch', S(3)]])
})

test('CODE-READING: the frame\'s transport runs the triggers — a press, a launch landing, the follow action, an end, a selection', () => {
  assert.match(app, /function launchScene\(sceneId:string\)\{[^\n]*\n[^\n]*\n[^\n]*\n\s*pressLaunch\(triggerRuntime,sceneId\);/)
  assert.match(app, /function placeLaunch\(sceneId:string,chain:TriggerChain\)\{/)
  assert.match(app, /if\(at===null\)\{pendingLaunch=null;landLaunch\(sceneId,chain\);return;\}\n sceneIntentEpoch\+\+;pendingLaunch=\{sceneId,at,chain\};/)
  assert.match(app, /launchLanded\(triggerRuntime,sceneId,chain,outgoing\);/)
  assert.match(app, /const \{sceneId:landing,chain\}=pendingLaunch;[\s\S]{0,300}landLaunch\(landing,chain,scene\(\)\.id!==landing\?scene\(\)\.id:null\)/)
  assert.match(app, /const followed=endedFrom===null\|\|heldSwitch\?undefined:\(id:string\)=>followLanded\(triggerRuntime,endedFrom,id\);/)
  assert.match(app, /advanceSavedScene\(sceneIndexOf\(landing\),0,followed\);else\{[^\n]*followed\?\.\(target\.id\);/)
  assert.match(app, /advanceSavedScene\(transportFrame\.advance_to_scene_index,transportFrame\.seek_local_seconds\?\?0,followed\);/)
  assert.match(app, /if\(endedFrom!==null\)sceneStopped\(triggerRuntime,endedFrom\);/)
  assert.match(app, /fireAutomations\(true\);entered\?\.\(target\.id\);/)
  assert.match(app, /selected:sceneId=>\{runTriggers\(triggerRuntime,sceneId,'select',newTriggerChain\(\)\);\}/)
  assert.match(app, /portal:\(trigger_ref,sceneId,said\)=>\{[^\n]*\n\s*void openScenePortal\(trigger_ref,/)
})
