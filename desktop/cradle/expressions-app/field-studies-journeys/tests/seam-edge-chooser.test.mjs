// lane-5 T5 / T6 (seam chooser) and lane-3 E09 (bezier handles): the seam's own chooser offers the switch mode and the curve of its edge,
// writes them through the one edge path (planEdgeEdit, applyEdgeWrite; hosted, nativeEdgeRequest), and drags a bezier handle on the E09
// lane's maths, validated by E08 and written once per gesture. Run after `npm run build:journeys`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  SWITCH_MODES, seamChooserHTML, seamCurveLaneHTML, transitionCurveHandleEdit, curveGestureWrite, curvePointsOf, edgeEditLabel,
  seamEdgeSpec, edgeEditRefusal, pendingSwitchStillWaits, curveProgress, BEZIER_SEED,
} from '../build/transitions.js';
import {planEdgeEdit, applyEdgeWrite, nativeEdgeRequest} from '../build/journeyPath.js';
import {advanceSceneTransport} from '../build/sceneTransport.js';

const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
const instrument = readFileSync(new URL('../src/journeyInstrument.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/journeyInstrument.css', import.meta.url), 'utf8');

// Extracts one top-level function body from app.ts by its signature, to read what it calls.
function bodyOf(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `${signature} is in app.ts`);
  const next = source.indexOf('\nfunction ', start + signature.length);
  const end = next < 0 ? source.length : next;
  return source.slice(start, end);
}

const bezierScene = {
  id: 's1', name: 'Dusk', transition: 1.5,
  transitionSpec: {kind: 'crossfade', switchMode: 'sync', curve: {type: 'bezier', out: {dt: .3, dv: .1}, in: {dt: -.3, dv: -.1}}},
};

test('the seam chooser offers the edge\'s switch mode, with the current mode selected and every mode offered', () => {
  const html = seamChooserHTML(bezierScene, {min: 0, max: 30});
  assert.match(html, /<select data-edge-switch data-scene-id="s1"/);
  for (const mode of SWITCH_MODES) assert.match(html, new RegExp(`<option value="${mode}"${mode === 'sync' ? ' selected' : ''}>`));
  const cut = seamChooserHTML({id: 'c', name: 'Cut', transition: 0, transitionSpec: {kind: 'cut', switchMode: 'at-end'}}, {min: 0, max: 30});
  assert.match(cut, /data-edge-switch/, 'a cut still has a switch mode');
  assert.doesNotMatch(cut, /data-edge-curve/, 'a cut takes no curve');
  assert.doesNotMatch(cut, /data-seam-curve/);
});

test('the chooser offers the curve of the edge, and a bezier curve shows its two handles to drag', () => {
  const html = seamChooserHTML(bezierScene, {min: 0, max: 30});
  assert.match(html, /<select data-edge-curve data-scene-id="s1"/);
  assert.match(html, /<option value="bezier" selected>Bezier<\/option>/);
  assert.match(html, /class="seam-curve" data-seam-curve data-scene-id="s1"/);
  assert.match(html, /data-handle-index="0" data-end="out"/);
  assert.match(html, /data-handle-index="1" data-end="in"/);
  const plain = seamChooserHTML({id: 's2', name: 'Dawn', transition: 1.5}, {min: 0, max: 30});
  assert.match(plain, /<option value="linear" selected>Linear<\/option>/, 'an edge with no curve reads as linear');
  assert.doesNotMatch(plain, /data-seam-curve/, 'no curve, no lane');
  assert.match(plain, /<option value="immediate" selected>Immediate<\/option>/, 'an absent switch reads as immediate');
});

test('the bezier lane is drawn in the E09 lane geometry, and a drag preview replaces the stored handles on the lane', () => {
  const stored = seamChooserHTML(bezierScene, {min: 0, max: 30});
  const previewed = seamChooserHTML(bezierScene, {min: 0, max: 30}, {type: 'bezier', out: {dt: .1, dv: .9}});
  assert.notEqual(previewed, stored, 'the preview changes the lane');
  assert.equal(seamCurveLaneHTML({id: 's1', name: 'Dusk'}, {type: 'bezier'}).includes('data-end="out"'), true, 'a handle-less bezier still has handles');
  assert.deepEqual(curvePointsOf({type: 'bezier', out: {dt: .3, dv: .1}}), [
    {time: 0, value: 0, type: 'bezier', out: {dt: .3, dv: .1}}, {time: 1, value: 1},
  ]);
});

test('a local preset writes the edge through planEdgeEdit and applyEdgeWrite, as one labelled plan', () => {
  const journey = {scenes: [{id: 'a', name: 'A', duration: 4, transition: 0}, {id: 'b', name: 'B', duration: 4, transition: 1}], loop: true};
  const sync = planEdgeEdit(journey, {kind: 'switch', enterSceneId: 'b', mode: 'sync'});
  assert.equal(sync.ok, true);
  assert.equal(sync.label, 'Set transition switch sync');
  applyEdgeWrite(journey.scenes, sync.write);
  assert.deepEqual(journey.scenes[1].transitionSpec, {kind: 'crossfade', switchMode: 'sync'});
  const bezier = planEdgeEdit(journey, {kind: 'curve', enterSceneId: 'b', type: 'bezier'});
  assert.equal(bezier.label, edgeEditLabel({kind: 'curve', type: 'bezier'}));
  applyEdgeWrite(journey.scenes, bezier.write);
  assert.deepEqual(journey.scenes[1].transitionSpec, {kind: 'crossfade', switchMode: 'sync', curve: {type: 'bezier', out: {dt: 1 / 3, dv: 0}, in: {dt: -1 / 3, dv: 0}}}, 'the switch is kept and the first bezier takes its seeded handles');
});

test('the hosted route takes the same edge facts as the local route: one scene_material_set carrying the same spec', () => {
  const edit = {kind: 'curve', enterSceneId: 'b', type: 'smooth'};
  const view = {
    expression: {expression_ref: 'expression:j', revision: 3, scenes: [
      {scene_ref: 'scene:a', presentation: null},
      {scene_ref: 'scene:b', presentation: {schema: 'oi.journey-scene/v1', saved: null,
        scene: {id: 'b', name: 'B', duration: 4, transition: 1, character: 'x', view: {mode: '2d'}, field: {background: '#fff'}}}},
    ]},
    bindings: {a: {scene_ref: 'scene:a'}, b: {scene_ref: 'scene:b'}},
  };
  const hosted = nativeEdgeRequest(view, edit);
  assert.equal(hosted.ok, true);
  const local = {scenes: [{id: 'b', transition: 1}]};
  applyEdgeWrite(local.scenes, planEdgeEdit({scenes: [{id: 'b', transition: 1}]}, edit).write);
  assert.deepEqual(hosted.request.changes[0].presentation.scene.transitionSpec, local.scenes[0].transitionSpec, 'the owner receives the local spec');
  assert.equal(hosted.request.changes[0].change, 'scene_material_set');
});

test('a bezier handle dragged to a valid position is the whole curve, validated by E08', () => {
  const base = {type: 'bezier'};
  const out = transitionCurveHandleEdit(base, 0, 'out', .3, .6);
  assert.deepEqual(out, {ok: true, curve: {type: 'bezier', out: {dt: .3, dv: .6}}});
  const inn = transitionCurveHandleEdit(base, 1, 'in', .75, .5);
  assert.deepEqual(inn, {ok: true, curve: {type: 'bezier', in: {dt: -.25, dv: -.5}}});
});

test('a bezier handle dragged outside its segment or the 0 to 1 range is refused by name, with E08\'s own message', () => {
  const base = {type: 'bezier'};
  const late = transitionCurveHandleEdit(base, 0, 'out', 1.5, .5);
  assert.equal(late.ok, false);
  assert.match(late.reason, /Handle time must stay inside its segment/);
  const high = transitionCurveHandleEdit(base, 0, 'out', .4, 1.4);
  assert.equal(high.ok, false);
  assert.match(high.reason, /Handle value is outside the channel range/);
  const past = transitionCurveHandleEdit(base, 1, 'in', 1.2, .5);
  assert.equal(past.ok, false);
  assert.match(past.reason, /Handle time must stay inside its segment/);
});

test('one drag gesture writes at most once: a moved, valid release writes the curve; anything else writes nothing', () => {
  const base = {type: 'bezier', out: {dt: .3, dv: .1}};
  const writes = [];
  const gesture = (steps, ended) => {
    let preview = null, refused = false, moved = false;
    for (const [t, v] of steps) {
      moved = true;
      const r = transitionCurveHandleEdit(base, 0, 'out', t, v);
      if (r.ok) { preview = r.curve; refused = false; } else refused = true;
    }
    const write = curveGestureWrite(base, preview, {...ended, moved, refused});
    if (write) writes.push(write);
    return write;
  };
  assert.deepEqual(gesture([[.2, .4], [.3, .6]], {commit: true}), {type: 'bezier', out: {dt: .3, dv: .6}}, 'released after moves: one write');
  assert.equal(writes.length, 1);
  assert.equal(gesture([[.2, .4], [1.5, .5]], {commit: true}), undefined, 'released over a refused position writes nothing');
  assert.equal(gesture([[.2, .4]], {commit: false}), undefined, 'a cancelled drag writes nothing');
  assert.equal(gesture([], {commit: true}), undefined, 'a press with no move writes nothing');
  assert.equal(gesture([[.3, .1]], {commit: true}), undefined, 'a drag that comes back to the same curve writes nothing');
  assert.equal(writes.length, 1, 'across all the gestures, one write');
});

test('source: the preset path is one planned edge write inside one labelled change, with the hosted edit taken first', () => {
  const edit = bodyOf(app, 'function editSeamEdge(edit:EdgeEdit){');
  assert.match(edit, /journeyInstrument\?\.editEdge\(edit\)/, 'the path panel\'s own edit is taken first when hosted');
  assert.match(edit, /planEdgeEdit\(store\.document,edit\)/);
  assert.match(edit, /const write=plan\.write,label=plan\.label;/);
  assert.match(edit, /changed\(\(\)=>applyTimelineMove\(store\.document,scenes=>applyEdgeWrite\(scenes,write\)\),true,label\)/);
  assert.equal((edit.match(/changed\(/g) ?? []).length, 1, 'one labelled change per preset');
  assert.match(app, /if\(el\.hasAttribute\('data-edge-switch'\)\)editSeamEdge\(\{kind:'switch'/);
  assert.match(app, /else if\(el\.hasAttribute\('data-edge-curve'\)\)editSeamEdge\(\{kind:'curve'/);
});

test('source: the hosted instrument exposes its own edge edit, and that edit is the path panel\'s submitEdge', () => {
  assert.match(instrument, /editEdge\(edit:EdgeEdit\):boolean\{if\(!host\.nativeView\(\)\)return false;submitEdge\(edit\);return true;\}/);
});

test('source: a bezier drag previews without writing, and pointer-up makes exactly one labelled change', () => {
  const move = bodyOf(app, 'function moveSeamCurveDrag(ev:PointerEvent){');
  assert.doesNotMatch(move, /changed\(|store\.change|applyTimelineMove|applyEdgeWrite/, 'a move writes nothing; it previews');
  assert.match(move, /transitionCurveHandleEdit\(d\.base,d\.index,d\.end,p\.time,p\.value\)/, 'the drag is validated by E08 through the transition law');
  const end = bodyOf(app, 'function endSeamCurveDrag(commit:boolean){');
  assert.match(end, /curveGestureWrite\(d\.base,d\.preview,\{commit,moved:d\.moved,refused:d\.refused\}\)/);
  assert.equal((end.match(/changed\(/g) ?? []).length, 1, 'one labelled change per gesture');
  assert.match(end, /applyEdgeWrite\(scenes,\{sceneId,field:'transitionSpec',spec:seamEdgeSpec\(s\.transitionSpec,\{curve\}\)\}\)/);
  assert.match(end, /edgeEditLabel\(\{kind:'curve',type:'bezier'\}\)/);
  assert.match(app, /document\.addEventListener\('pointerdown',ev=>\{if\(ev\.button!==0\)return;const lane=\(ev\.target as Element\)\.closest\?\.<HTMLElement>\('\.seam-curve'\);if\(lane\)beginSeamCurveDrag\(ev,lane\);\}\);/);
});

test('source: the bezier lane reuses the E09 curve editor\'s maths and is styled from tokens', () => {
  const begin = bodyOf(app, 'function beginSeamCurveDrag(ev:PointerEvent,lane:HTMLElement){');
  assert.match(begin, /curveHit\(points,frame,0,/, 'the handle is hit by E09\'s curveHit');
  assert.match(begin, /laneFrame\(points,TRANSITION_LANE\.duration,TRANSITION_LANE\.range,/, 'the lane frame is E09\'s laneFrame');
  assert.match(css, /\.seam-curve\{position:relative;[^}]*var\(--ui-line,var\(--line\)\)/);
  assert.doesNotMatch(css.split('.seam-curve')[1] ?? '', /#[0-9a-f]{3,6}\b/i, 'no literal colours in the lane');
});

// Review (14 Oct): a cut has no curve; a first bezier must show; a pending jump must not outlive a pause.
test('a cut has no curve: a curve edit on a cut is refused by name, and a cut stays a cut', () => {
  assert.equal(edgeEditRefusal({kind: 'cut'}, {kind: 'curve'}), 'A cut has no curve.');
  assert.equal(edgeEditRefusal({kind: 'cut', switchMode: 'sync'}, {kind: 'curve'}), 'A cut has no curve.');
  assert.equal(edgeEditRefusal({kind: 'cut'}, {kind: 'switch'}), undefined, 'a cut still takes a switch mode');
  assert.equal(edgeEditRefusal({kind: 'crossfade'}, {kind: 'curve'}), undefined, 'a blend takes a curve');
  assert.deepEqual(seamEdgeSpec({kind: 'cut'}, {curve: {type: 'hold'}}), {kind: 'cut'}, 'the curve is dropped by the cut: the no-op the refusal prevents');
  const cut = seamChooserHTML({id: 'c', name: 'Cut', transition: 0, transitionSpec: {kind: 'cut'}}, {min: 0, max: 30});
  assert.doesNotMatch(cut, /data-edge-curve/, 'the seam chooser offers no curve on a cut');
});

test('the path panel and the hosted submit refuse a cut curve and never send an edit the edge already has', () => {
  const instrument = readFileSync(new URL('../src/journeyInstrument.tsx', import.meta.url), 'utf8');
  assert.match(instrument, /const takesCurve=transitionKindOf\(journey\.scenes\.find\(v=>v\.id===enterSceneId\)\?\.transitionSpec\)!=='cut';/);
  assert.match(instrument, /\{takesCurve\?<select aria-label=\{`Curve into \$\{name\}`\}/, 'the path panel offers the curve only where it applies');
  assert.match(instrument, /const refusal=edit\.kind!=='loop'\?edgeEditRefusal\(/);
  assert.match(instrument, /if\(JSON\.stringify\(before\)===JSON\.stringify\(after\)\)\{message\(`\$\{routed\.label\} changed nothing/);
  const edit = bodyOf(app, 'function editSeamEdge(edit:EdgeEdit){');
  assert.match(edit, /edgeEditRefusal\(store\.document\.scenes\.find/, 'the chooser refuses a cut curve before it writes');
  assert.match(edit, /changed nothing: this edge already has it/, 'the chooser names a no-op edit');
  assert.equal((edit.match(/changed\(/g) ?? []).length, 1);
});

test('a first bezier takes E08\'s smooth handles, so choosing it visibly changes the curve and its handles can be dragged', () => {
  const first = seamEdgeSpec(undefined, {curve: {type: 'bezier'}});
  assert.deepEqual(first, {kind: 'crossfade', curve: {type: 'bezier', out: {dt: 1 / 3, dv: 0}, in: {dt: -1 / 3, dv: 0}}});
  assert.deepEqual(first.curve, BEZIER_SEED);
  assert.ok(Math.abs(curveProgress(first.curve, .25) - .25) > .05, 'the seeded bezier is not the linear line');
  // A bezier already chosen keeps the handles it has, when its type is chosen again.
  const dragged = {kind: 'crossfade', curve: {type: 'bezier', out: {dt: .1, dv: .9}}};
  assert.deepEqual(seamEdgeSpec(dragged, {curve: {type: 'bezier'}}).curve, {type: 'bezier', out: {dt: .1, dv: .9}});
  // Explicit handles from a drag are written as given.
  assert.deepEqual(seamEdgeSpec(undefined, {curve: {type: 'bezier', out: {dt: .2, dv: .3}}}).curve, {type: 'bezier', out: {dt: .2, dv: .3}});
});

test('a jump held for a Scene\'s end waits while playback runs toward it, and a pause or stop drops it', () => {
  const journey = {scenes: [{id: 'a', name: 'A', duration: 4, transition: 0}, {id: 'b', name: 'B', duration: 4, transition: 1}], loop: true};
  const state = {savedSequence: false, hidden: false, libraryOpen: false, propertyRecording: false, editing: false, loopRegion: undefined};
  const playing = advanceSceneTransport(journey, 0, 1, .1, {...state, playing: true});
  assert.equal(pendingSwitchStillWaits(playing), true, 'playing mid-scene keeps the jump');
  const atEnd = advanceSceneTransport(journey, 0, 3.99, .1, {...state, playing: true});
  assert.equal(atEnd.completed, true);
  assert.equal(pendingSwitchStillWaits(atEnd), true, 'the natural end lands the jump this frame');
  const paused = advanceSceneTransport(journey, 0, 1, .1, {...state, playing: false});
  assert.equal(paused.scene_playing, false);
  assert.equal(pendingSwitchStillWaits(paused), false, 'a pause drops the held jump');
});

test('source: the tick clears a held jump on pause or stop, and the transport shows it while it is pending', () => {
  assert.match(app, /if\(pendingAtEnd!==null&&!pendingSwitchStillWaits\(transportFrame\)\)\{pendingAtEnd=null;renderAll\(\);\}/);
  assert.match(app, /\$\{transportBarHTML\(\)\}\$\{pendingSwitchCueHTML\(\)\}\$\{body\}/);
  const cue = bodyOf(app, 'function pendingSwitchCueHTML(){');
  assert.match(cue, /role="status"/);
  assert.match(cue, /Switch to \$\{esc\(name\)\} when this scene ends\./);
});
