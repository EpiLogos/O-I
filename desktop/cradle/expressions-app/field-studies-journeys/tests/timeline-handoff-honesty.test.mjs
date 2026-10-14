/** Lane-2 T19–T22 — the chronology mount's handoff honesty, read from its source. The pure rules are tested in
 * timeline-navigation-glue.test.mjs and timeline-traversal-glue.test.mjs; these assertions pin how the mount wires them, so a
 * change that makes a refusal compare a value with itself, or drops the planned identity, fails here. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const engine = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mount = await readFile(resolve(engine, 'src/researchInstruments.tsx'), 'utf8');
const css = await readFile(resolve(engine, 'src/researchInstruments.css'), 'utf8');
const at = (needle, from = 0) => {
  const index = mount.indexOf(needle, from);
  assert.ok(index >= 0, `the mount contains ${needle}`);
  return index;
};

test('T22: a globe crossing is planned over the session its control is offered on, and refused by name before its first write', () => {
  assert.match(mount, /const showOnGlobe=async\(carry:Extract<GlobeCarry,\{state:'offer'\|'window'\}>,planned:ReturnType<typeof sessionCrossingIdentity>\)/);
  assert.match(mount, /const planned=sessionCrossingIdentity\(sharedTime\.session\);\s*\n\s*const onClick=/, 'the offer captures its planned identity at render');
  assert.ok(at('refuse(sharedTime.session);') < at('writeSharedSpatialFocus(request,nativeReading,\'timeline\',sharedTime,carry.place_ref)'),
    'the drift check runs before the spatial write');
  assert.ok(at('writeSharedSpatialFocus(request,nativeReading,\'timeline\',sharedTime,carry.place_ref)') < at('refuse(sharedTime.session);', at('writeSharedSpatialFocus(request,nativeReading')),
    'the reply of the spatial write is checked again before the window write');
});

test('T22: a traversal step is judged on the owner\'s reply, never on the session it was planned from', () => {
  assert.match(mount, /const reason=handoffRefusal\(planned,reply\.session\);/);
  const recordStep = mount.slice(at('const recordStep='), at('const runSteps='));
  assert.ok(recordStep.length > 0, 'the timeline trail step is one function');
  assert.doesNotMatch(recordStep, /handoffRefusal\(planned,sharedTime\?\.session/, 'no self-comparison against the acknowledged session');
});

test('T20: a native relation opened from the chronology is co-referenced once its hop is recorded, through the Relations route', () => {
  assert.match(mount, /const relationRef=relation\.relation_ref;/);
  assert.match(mount, /\.then\(recorded=>\{if\(recorded\)host\.select\(sceneId,null,relationRef\);\}\)/);
  assert.doesNotMatch(mount, /host\.select\(sceneId,null,relation\.relation_ref\)/, 'a refused step never selects');
});

test('T21: a place-less event offers its window to the globe, and the crossing clears the place focus rather than keeping an earlier one', () => {
  assert.match(mount, /if\(settled\.state==='window'\)return <button/);
  assert.match(mount, /writeSharedSpatialFocus\(request,nativeReading,'timeline',sharedTime,carry\.place_ref\)/);
  assert.match(mount, /A place-less event writes a null place/);
});

test('T19: the evidence control exists only for a disclosed passage; otherwise the honest absence stands in its place', () => {
  assert.match(mount, /const eventEvidence=\(ref:string\):EvidenceAnchor=>\{/);
  assert.match(mount, /if\(!control\.present\)return <span className="research-evidence-absent" role="note">\{control\.reason\}<\/span>;/);
  assert.match(mount, /aria-label=\{control\.label\}/);
  assert.match(mount, /control=\{eventControls\}/);
  assert.match(css, /\.research-evidence-absent\)\{color:var\(--ui-muted\)/, 'the absence is styled as instrument status text');
});

test("the globe's Open in Timeline plans its crossing when offered, not when pressed, so a drifted session refuses", async () => {
  const {readFile} = await import('node:fs/promises');
  const source = await readFile(new URL('../src/researchInstruments.tsx', import.meta.url), 'utf8');
  const render = source.slice(source.indexOf('const renderPlaces=():ReactNode=>{'));
  assert.match(render, /const offeredCrossing=sharedTime\?sessionCrossingIdentity\(sharedTime\.session\):null;/, 'planned at render, the moment it is offered');
  assert.match(render, /const openInTimeline=async\(facet:TechnePlaceFacet,planned:/);
  assert.doesNotMatch(render.slice(render.indexOf('const openInTimeline'), render.indexOf('const openInTimeline') + 600), /const planned=sessionCrossingIdentity/, 'never re-planned at press time');
  assert.match(render, /onOpenInTimeline=\{facet=>\{void openInTimeline\(facet,offeredCrossing\)/);
});
